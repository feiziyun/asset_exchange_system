const db = require('../db/index');
const chainClient = require('./chainClient');

const pool = db.promise();

const CONFIG = {
  enabled: process.env.RECONCILE_ENABLED !== '0',
  intervalMs: Number(process.env.RECONCILE_INTERVAL_MS || 120000),
  confirmDelayMinutes: Number(process.env.RECONCILE_CONFIRM_DELAY_MINUTES || 3),
  batchSize: Number(process.env.RECONCILE_BATCH_SIZE || 50),
  maxRetry: Number(process.env.RECONCILE_MAX_RETRY || 8),
  baseBackoffMinutes: Number(process.env.RECONCILE_BACKOFF_BASE_MINUTES || 2),
  maxBackoffMinutes: Number(process.env.RECONCILE_MAX_BACKOFF_MINUTES || 360),
};

let timer = null;
let running = false;

const toSafeJson = (value) => {
  try {
    return JSON.stringify(value ?? {});
  } catch (_error) {
    return '{}';
  }
};

const truncate = (value, max = 1000) => String(value || '').slice(0, max);

const deriveAddressFromUserId = (userId) => {
  const numberId = Number(userId || 0);
  const hex = (numberId + 1000000).toString(16).padStart(40, '0');
  return `0x${hex.slice(-40)}`;
};

const calcBackoffMinutes = (retryCount) => {
  const retry = Math.max(0, Number(retryCount || 0));
  const backoff = CONFIG.baseBackoffMinutes * Math.pow(2, Math.min(retry, 10));
  return Math.min(backoff, CONFIG.maxBackoffMinutes);
};

const shouldSkipByBackoff = (lastSyncTime, retryCount) => {
  if (!lastSyncTime) return false;
  const backoffMs = calcBackoffMinutes(retryCount) * 60 * 1000;
  const lastTs = new Date(lastSyncTime).getTime();
  if (!Number.isFinite(lastTs)) return false;
  return Date.now() - lastTs < backoffMs;
};

const ensureReconcileLogTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reconcile_log (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      biz_type VARCHAR(20) NOT NULL COMMENT 'asset/order',
      biz_id VARCHAR(64) NOT NULL COMMENT 'asset_id or order_no',
      expected_state JSON NULL,
      onchain_state JSON NULL,
      action VARCHAR(100) NOT NULL,
      retry_count INT NOT NULL DEFAULT 0,
      result VARCHAR(20) NOT NULL COMMENT 'success/failed/warning/skipped',
      error_message VARCHAR(1000) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_biz_type_id (biz_type, biz_id),
      KEY idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链上链下对账日志表'
  `);
};

const writeReconcileLog = async ({
  bizType,
  bizId,
  expectedState,
  onchainState,
  action,
  retryCount = 0,
  result,
  errorMessage = '',
}) => {
  await pool.query(
    `
      INSERT INTO reconcile_log
        (biz_type, biz_id, expected_state, onchain_state, action, retry_count, result, error_message)
      VALUES (?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?, ?)
    `,
    [
      bizType,
      String(bizId),
      toSafeJson(expectedState),
      toSafeJson(onchainState),
      action,
      Number(retryCount || 0),
      result,
      truncate(errorMessage),
    ],
  );
};

const hasRecentWarningAction = async (bizType, bizId, action) => {
  const [rows] = await pool.query(
    `
      SELECT id
      FROM reconcile_log
      WHERE biz_type = ?
        AND biz_id = ?
        AND action = ?
        AND result = 'warning'
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      ORDER BY id DESC
      LIMIT 1
    `,
    [bizType, String(bizId), action, CONFIG.confirmDelayMinutes],
  );
  return rows.length > 0;
};

const fetchAssetCandidates = async () => {
  const [rows] = await pool.query(
    `
      SELECT
        aci.asset_id,
        aci.chain_status,
        aci.token_id,
        aci.owner_address,
        aci.chain_tx_hash,
        aci.retry_count,
        aci.last_sync_time,
        da.file_hash
      FROM asset_chain_info aci
      LEFT JOIN digital_asset da ON da.id = aci.asset_id
      WHERE aci.chain_status IN (0, 2)
      ORDER BY aci.last_sync_time ASC
      LIMIT ?
    `,
    [CONFIG.batchSize],
  );

  return rows.filter((item) => {
    if (Number(item.retry_count || 0) >= CONFIG.maxRetry) return false;
    if (shouldSkipByBackoff(item.last_sync_time, item.retry_count)) return false;
    return true;
  });
};

const reconcileSingleAsset = async (item) => {
  const tokenId = item.token_id || item.file_hash || '';
  const expectedState = {
    chain_status: Number(item.chain_status || 0),
    token_id: item.token_id || '',
    owner_address: item.owner_address || '',
    chain_tx_hash: item.chain_tx_hash || '',
  };

  if (!tokenId) {
    await writeReconcileLog({
      bizType: 'asset',
      bizId: item.asset_id,
      expectedState,
      onchainState: {},
      action: 'skip_missing_token_id',
      retryCount: Number(item.retry_count || 0),
      result: 'skipped',
      errorMessage: 'token_id 和 file_hash 均为空，无法对账',
    });
    return { fixed: false, skipped: true };
  }

  try {
    const ownerRes = await chainClient.ownerOf(tokenId);
    const owner = ownerRes?.data?.owner || ownerRes?.result || '';

    if (!owner) {
      throw new Error('链上 owner 为空，无法确认资产状态');
    }

    const firstDetectAction = 'asset_drift_first_detected';
    const confirmed = await hasRecentWarningAction('asset', item.asset_id, firstDetectAction);
    if (!confirmed) {
      await writeReconcileLog({
        bizType: 'asset',
        bizId: item.asset_id,
        expectedState,
        onchainState: { token_id: tokenId, owner_address: owner },
        action: firstDetectAction,
        retryCount: Number(item.retry_count || 0),
        result: 'warning',
        errorMessage: `首次检测到链上链下不一致，${CONFIG.confirmDelayMinutes} 分钟后再次确认再修复`,
      });
      return { fixed: false, skipped: false, delayed: true };
    }

    await pool.query(
      `
        UPDATE asset_chain_info
        SET chain_status = 1,
            token_id = ?,
            owner_address = ?,
            last_sync_time = NOW(),
            fail_reason = NULL
        WHERE asset_id = ?
      `,
      [tokenId, owner, item.asset_id],
    );

    await writeReconcileLog({
      bizType: 'asset',
      bizId: item.asset_id,
      expectedState,
      onchainState: { token_id: tokenId, owner_address: owner },
      action: 'fix_asset_chain_status',
      retryCount: Number(item.retry_count || 0),
      result: 'success',
    });

    return { fixed: true, skipped: false, delayed: false };
  } catch (error) {
    const nextRetry = Number(item.retry_count || 0) + 1;
    const failMessage = truncate(error?.message || 'asset reconcile failed');

    await pool.query(
      `
        UPDATE asset_chain_info
        SET chain_status = 2,
            retry_count = ?,
            last_sync_time = NOW(),
            fail_reason = ?
        WHERE asset_id = ?
      `,
      [nextRetry, failMessage, item.asset_id],
    );

    await writeReconcileLog({
      bizType: 'asset',
      bizId: item.asset_id,
      expectedState,
      onchainState: {},
      action: 'asset_reconcile_failed',
      retryCount: nextRetry,
      result: 'failed',
      errorMessage: failMessage,
    });

    return { fixed: false, skipped: false, delayed: false };
  }
};

const fetchOrderCandidates = async () => {
  const [rows] = await pool.query(
    `
      SELECT
        ao.id,
        ao.order_no,
        ao.asset_id,
        ao.buyer_id,
        ao.order_status,
        ao.updated_at,
        da.file_hash,
        da.can_sell_ownership,
        da.can_sell_view_right,
        da.can_sell_process_right,
        aci.token_id,
        aci.owner_address
      FROM asset_order ao
      LEFT JOIN digital_asset da ON da.id = ao.asset_id
      LEFT JOIN asset_chain_info aci ON aci.asset_id = ao.asset_id
      WHERE ao.order_status IN (5, 1)
        AND ao.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY ao.updated_at DESC
      LIMIT ?
    `,
    [CONFIG.batchSize],
  );
  return rows;
};

const inferTradeMode = (item) => {
  if (Number(item.can_sell_ownership) === 1) return 'ownership';
  if (Number(item.can_sell_view_right) === 1) return 'view';
  if (Number(item.can_sell_process_right) === 1) return 'process';
  return 'ownership';
};

const reconcileSingleOrder = async (item) => {
  const tokenId = item.token_id || item.file_hash || '';
  const buyerAddress = deriveAddressFromUserId(item.buyer_id);
  const tradeMode = inferTradeMode(item);

  const expectedState = {
    order_status: Number(item.order_status || 0),
    trade_mode: tradeMode,
    token_id: tokenId,
    expected_owner: buyerAddress,
  };

  if (!tokenId) {
    await writeReconcileLog({
      bizType: 'order',
      bizId: item.order_no,
      expectedState,
      onchainState: {},
      action: 'skip_order_missing_token_id',
      result: 'skipped',
      errorMessage: 'order 缺少 token_id/file_hash，无法对账',
    });
    return { fixed: false, warning: false, delayed: false };
  }

  try {
    const ownerRes = await chainClient.ownerOf(tokenId);
    const owner = ownerRes?.data?.owner || ownerRes?.result || '';

    if (Number(item.order_status) === 5 && tradeMode === 'ownership' && owner === buyerAddress) {
      const firstDetectAction = 'order_drift_first_detected';
      const confirmed = await hasRecentWarningAction('order', item.order_no, firstDetectAction);
      if (!confirmed) {
        await writeReconcileLog({
          bizType: 'order',
          bizId: item.order_no,
          expectedState,
          onchainState: { owner_address: owner },
          action: firstDetectAction,
          result: 'warning',
          errorMessage: `首次检测到订单状态滞后，${CONFIG.confirmDelayMinutes} 分钟后再次确认再修复`,
        });
        return { fixed: false, warning: true, delayed: true };
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('UPDATE asset_order SET order_status = 1 WHERE id = ? AND order_status = 5', [item.id]);
        await conn.query('UPDATE digital_asset SET trade_count = IFNULL(trade_count, 0) + 1 WHERE id = ?', [item.asset_id]);
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }

      await writeReconcileLog({
        bizType: 'order',
        bizId: item.order_no,
        expectedState,
        onchainState: { owner_address: owner },
        action: 'fix_order_status_to_completed',
        result: 'success',
      });

      return { fixed: true, warning: false, delayed: false };
    }

    if (Number(item.order_status) === 1 && tradeMode === 'ownership' && owner && owner !== buyerAddress) {
      await writeReconcileLog({
        bizType: 'order',
        bizId: item.order_no,
        expectedState,
        onchainState: { owner_address: owner },
        action: 'mark_order_drift',
        result: 'warning',
        errorMessage: '订单已完成但链上 owner 与买方地址不一致',
      });
      return { fixed: false, warning: true };
    }

    await writeReconcileLog({
      bizType: 'order',
      bizId: item.order_no,
      expectedState,
      onchainState: { owner_address: owner },
      action: 'order_no_change',
      result: 'success',
    });

    return { fixed: false, warning: false, delayed: false };
  } catch (error) {
    await writeReconcileLog({
      bizType: 'order',
      bizId: item.order_no,
      expectedState,
      onchainState: {},
      action: 'order_reconcile_failed',
      result: 'failed',
      errorMessage: truncate(error?.message || 'order reconcile failed'),
    });

    return { fixed: false, warning: false, delayed: false };
  }
};

const runReconciliationOnce = async (trigger = 'timer') => {
  await ensureReconcileLogTable();

  const summary = {
    trigger,
    asset_total: 0,
    asset_fixed: 0,
    asset_skipped: 0,
    asset_delayed: 0,
    order_total: 0,
    order_fixed: 0,
    order_warning: 0,
    order_delayed: 0,
  };

  const assetCandidates = await fetchAssetCandidates();
  summary.asset_total = assetCandidates.length;
  for (const item of assetCandidates) {
    const result = await reconcileSingleAsset(item);
    if (result.fixed) summary.asset_fixed += 1;
    if (result.skipped) summary.asset_skipped += 1;
    if (result.delayed) summary.asset_delayed += 1;
  }

  const orderCandidates = await fetchOrderCandidates();
  summary.order_total = orderCandidates.length;
  for (const item of orderCandidates) {
    const result = await reconcileSingleOrder(item);
    if (result.fixed) summary.order_fixed += 1;
    if (result.warning) summary.order_warning += 1;
    if (result.delayed) summary.order_delayed += 1;
  }

  return summary;
};

const startReconcileScheduler = () => {
  if (!CONFIG.enabled) {
    console.log('[reconcile] disabled by RECONCILE_ENABLED=0');
    return () => {};
  }

  const run = async () => {
    if (running) {
      console.log('[reconcile] previous round still running, skip this tick');
      return;
    }

    running = true;
    try {
      const summary = await runReconciliationOnce('timer');
      console.log('[reconcile] round summary', summary);
    } catch (error) {
      console.error('[reconcile] round failed', error?.message || error);
    } finally {
      running = false;
    }
  };

  run();
  timer = setInterval(run, CONFIG.intervalMs);
  console.log('[reconcile] scheduler started', {
    intervalMs: CONFIG.intervalMs,
    confirmDelayMinutes: CONFIG.confirmDelayMinutes,
    batchSize: CONFIG.batchSize,
    maxRetry: CONFIG.maxRetry,
  });

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      console.log('[reconcile] scheduler stopped');
    }
  };
};

module.exports = {
  startReconcileScheduler,
  runReconciliationOnce,
};
