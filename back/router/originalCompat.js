const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const assetService = require('../service/asset');
const certificateService = require('../service/certificate');
const { memoryUpload } = require('../middleware/upload');
const db = require('../db/index');
const { services } = require('../config/services');
const { loggedFetch } = require('../service/httpLogger');
const tpsConfig = require('../config/tps.json');

const router = express.Router();
const pool = db.promise();

const LOCAL_BASE = services.localBackBaseUrl;
const VM_HOST_BASE_URL = services.vmHostBaseUrl;
const VM_SERVICE_BASE_URL = services.vmServiceBaseUrl;
const REMOTE_JSON_URL = services.remoteJsonUrl;
const REMOTE_FILE_URL = services.remoteFileUrl;
const REMOTE_KEY_URL = services.remoteKeyUrl;
const TPS_SCRIPT_CWD = tpsConfig.scriptDirectory;
const TPS_SCRIPT_CMD = 'bash -lc "ulimit -n 65535 && bash ./run_tps.sh"';

const getCurrentUserId = (req) => req.auth?.id || req.query?.userId || req.body?.userId;

const readRemoteBody = async (response) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const raw = await response.text();
  if (contentType.includes('application/json')) {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (_error) {
      return { message: raw };
    }
  }
  return raw;
};

const buildMultipartFormData = (req) => {
  const formData = new FormData();
  Object.entries(req.body || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, item));
      return;
    }
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  (req.files || []).forEach((file) => {
    const blob = new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' });
    formData.append(file.fieldname, blob, file.originalname || 'upload.bin');
  });
  return formData;
};

const proxyToTarget = async (req, res, targetUrl, { method = req.method, rawBody = false } = {}) => {
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => targetUrl.searchParams.append(key, item));
      return;
    }
    if (value !== undefined && value !== null) {
      targetUrl.searchParams.set(key, value);
    }
  });

  const headers = {};
  if (req.headers['content-type']) {
    headers['Content-Type'] = req.headers['content-type'];
  } else if (!['GET', 'HEAD'].includes(String(method).toUpperCase())) {
    headers['Content-Type'] = 'application/json';
  }

  const options = { method, headers };
  if (!['GET', 'HEAD'].includes(String(method).toUpperCase())) {
    options.body = rawBody ? req.body : JSON.stringify(req.body || {});
  }

  const response = await loggedFetch(targetUrl, options, 'original-compat-proxy');
  const contentType = response.headers.get('content-type') || '';
  res.status(response.status);
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }

  if (contentType.includes('application/json')) {
    const data = await readRemoteBody(response);
    return res.send(data);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return res.send(buffer);
};

const proxyRemote = async (req, res, remotePath, options = {}) => {
  const targetUrl = new URL(remotePath, LOCAL_BASE);
  return proxyToTarget(req, res, targetUrl, options);
};

const proxyExternal = async (req, res, baseUrl, remotePath = '', options = {}) => {
  const targetUrl = new URL(remotePath, baseUrl);
  return proxyToTarget(req, res, targetUrl, options);
};

const proxyMultipart = async (req, res, baseUrl, remotePath = '', { method = req.method } = {}) => {
  const targetUrl = new URL(remotePath, baseUrl);
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => targetUrl.searchParams.append(key, item));
      return;
    }
    if (value !== undefined && value !== null) {
      targetUrl.searchParams.set(key, value);
    }
  });

  const response = await loggedFetch(targetUrl, {
    method,
    body: buildMultipartFormData(req),
  });
  const contentType = response.headers.get('content-type') || '';
  res.status(response.status);
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }
  if (contentType.includes('application/json')) {
    const data = await readRemoteBody(response);
    return res.send(data);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return res.send(buffer);
};

const toBase64Picture = (value) => {
  if (!value) return '';
  if (Buffer.isBuffer(value)) return value.toString('base64');
  return Buffer.from(value).toString('base64');
};

const mapLegacyUserRow = (row = {}) => ({
  ...row,
  username: row.account || row.username || '',
  usertype: row.identity || row.usertype || '',
  address: row.address || row.department || '',
  phone_number: row.phone_number || '',
  avatar: toBase64Picture(row.avatarData),
  password: undefined,
  avatarData: undefined,
});

const mapLegacyAssetRow = (row = {}) => ({
  id: row.id,
  asset_name: row.asset_name || '',
  asset_type: row.sub_category_name || row.asset_type || '',
  email: row.email || '',
  address: row.address || row.trade_region || '',
  description: row.description || '',
  algorithm: row.hash_algorithm || row.algorithm || '',
  custom_algorithm: row.custom_algorithm || '',
  file_hash: row.file_hash || '',
  industry: row.classification_category_name || row.category_name || '',
  industry_raw_name: row.classification_category_name || row.category_name || '',
  txperm: row.txperm || '',
  user_id: row.user_id || null,
  owner_address: row.owner_address || '',
  current_owner_address: row.owner_address || '',
  is_proxied: Number(row.is_proxied || 0),
  number: Number(row.total_qty || row.number || 1),
  can_sell_asset: Number(row.can_sell_ownership || row.can_sell_asset || 0),
  can_sell_view: Number(row.can_sell_view_right || row.can_sell_view || 0),
  can_sell_process: Number(row.can_sell_process_right || row.can_sell_process || 0),
  allow_resale: Number(row.allow_resale || 0),
  picture: toBase64Picture(row.picture),
  picture_mime_type: row.picture_mime_type || '',
  price: Number(row.price || 0),
  created_at: row.created_at || row.create_time || '',
  updated_at: row.updated_at || row.update_time || '',
});

const getAssetRowByFileHash = async (fileHash) => {
  const normalizedHash = String(fileHash || '').trim();
  if (!normalizedHash) return null;

  const [rows] = await pool.query(
    `
      SELECT
        da.*,
        ac.category_name,
        ascg.sub_category_name,
        aci.owner_address
      FROM digital_asset da
      LEFT JOIN asset_category ac ON da.category_id = ac.id
      LEFT JOIN asset_sub_category ascg ON da.sub_category_id = ascg.id
      LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
      WHERE da.file_hash = ?
      ORDER BY da.id DESC
      LIMIT 1
    `,
    [normalizedHash],
  );
  return rows[0] || null;
};

const getAssetRowByFileHashOrId = async (assetId) => {
  const normalized = String(assetId || '').trim();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    const [rows] = await pool.query(
      `
        SELECT
          da.*,
          ac.category_name,
          ascg.sub_category_name,
          aci.owner_address
        FROM digital_asset da
        LEFT JOIN asset_category ac ON da.category_id = ac.id
        LEFT JOIN asset_sub_category ascg ON da.sub_category_id = ascg.id
        LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
        WHERE da.id = ?
        LIMIT 1
      `,
      [Number(normalized)],
    );
    if (rows[0]) return rows[0];
  }

  return getAssetRowByFileHash(normalized);
};

const queryLegacyAssets = async ({ where = '1=1', params = [], orderBy = 'da.id DESC', limit = '' } = {}) => {
  const [rows] = await pool.query(
    `
      SELECT
        da.*,
        u.email,
        ac.category_name,
        ascg.sub_category_name,
        aci.owner_address
      FROM digital_asset da
      LEFT JOIN users u ON da.user_id = u.id
      LEFT JOIN asset_category ac ON da.category_id = ac.id
      LEFT JOIN asset_sub_category ascg ON da.sub_category_id = ascg.id
      LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
      WHERE ${where}
      ORDER BY ${orderBy}
      ${limit}
    `,
    params,
  );
  return rows.map(mapLegacyAssetRow);
};

const runTpsScript = () => new Promise((resolve, reject) => {
  if (!TPS_SCRIPT_CWD || !fs.existsSync(path.join(TPS_SCRIPT_CWD, 'run_tps.sh'))) {
    reject(new Error('TPS 脚本不存在，请检查 config/tps.json 中的 scriptDirectory'));
    return;
  }
  console.log('[external][tps-request]', {
    time: new Date().toISOString(),
    command: TPS_SCRIPT_CMD,
    cwd: TPS_SCRIPT_CWD,
  });
  exec(
    TPS_SCRIPT_CMD,
    {
      cwd: TPS_SCRIPT_CWD,
      timeout: 900000,
      maxBuffer: 100 * 1024 * 1024,
    },
    (error, stdout, stderr) => {
      if (error) {
        console.error('[external][tps-error]', {
          time: new Date().toISOString(),
          code: error.code,
          message: error.message,
          stderr: String(stderr || '').slice(0, 1200),
        });
        reject(new Error(stderr || error.message || 'TPS 脚本执行失败'));
        return;
      }
      console.log('[external][tps-response]', {
        time: new Date().toISOString(),
        stdout: String(stdout || '').slice(0, 1200),
        stderr: String(stderr || '').slice(0, 1200),
      });
      const match = String(stdout || '').match(/Average\s+TPS\s*:\s*([0-9.]+)/i);
      if (!match || !Number.isFinite(Number(match[1]))) {
        reject(new Error('TPS 脚本未输出有效的 Average TPS'));
        return;
      }
      resolve({
        success: true,
        tps: Number(match[1]),
      });
    },
  );
});

router.get('/get-assets', async (_req, res) => {
  try {
    const rows = await queryLegacyAssets();
    return res.send(rows);
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.get('/get-user', async (_req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users ORDER BY id DESC');
    return res.send({
      total_users: users.length,
      users: users.map(mapLegacyUserRow),
    });
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.post('/get-user-user', async (req, res) => {
  try {
    const userId = Number(req.body?.user_id || req.body?.id || 0);
    if (!userId) {
      return res.status(400).send({ error: '缺少 user_id 参数' });
    }
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? ORDER BY id DESC', [userId]);
    return res.send({
      count: rows.length,
      records: rows.map(mapLegacyUserRow),
    });
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.get('/get-asset', async (_req, res) => {
  try {
    const rows = await queryLegacyAssets({ limit: 'LIMIT 1' });
    return res.send(rows);
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.get('/query-asset', async (req, res) => {
  try {
    const assetName = String(req.query.assetName || '').trim();
    if (!assetName) {
      return res.status(400).send({ error: '缺少 assetName 参数' });
    }
    const rows = await queryLegacyAssets({
      where: 'TRIM(da.asset_name) = ?',
      params: [assetName],
    });
    if (!rows.length) {
      return res.send({ count: 0, message: '未找到匹配的资产' });
    }
    return res.send({
      count: rows.length,
      latestRecord: rows[0],
    });
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.get('/query-assets', async (req, res) => {
  try {
    const assetName = String(req.query.assetName || '').trim();
    if (!assetName) {
      return res.status(400).send({ error: '缺少 assetName 参数' });
    }
    const rows = await queryLegacyAssets({
      where: 'TRIM(da.asset_name) = ?',
      params: [assetName],
    });
    if (!rows.length) {
      return res.send({ count: 0, message: '未找到匹配的资产' });
    }
    return res.send({
      count: rows.length,
      records: rows,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.get('/query-asset-hash', async (req, res) => {
  try {
    const fileHash = String(req.query.fileHash || '').trim();
    if (!fileHash) {
      return res.status(400).send({ error: '缺少 fileHash 参数' });
    }
    const rows = await queryLegacyAssets({
      where: 'TRIM(da.file_hash) = ?',
      params: [fileHash],
    });
    if (!rows.length) {
      return res.send({ count: 0, message: '未找到匹配的资产' });
    }
    return res.send({
      count: rows.length,
      latestRecord: rows[0],
    });
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.get('/query-assets-hash', async (req, res) => {
  try {
    const fileHash = String(req.query.fileHash || '').trim();
    if (!fileHash) {
      return res.status(400).send({ error: '缺少 fileHash 参数' });
    }
    const rows = await queryLegacyAssets({
      where: 'TRIM(da.file_hash) = ?',
      params: [fileHash],
    });
    if (!rows.length) {
      return res.send({ count: 0, message: '未找到匹配的资产' });
    }
    return res.send({
      count: rows.length,
      records: rows,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.post('/get-user-assets', async (req, res) => {
  try {
    const userId = Number(req.body?.user_id || 0);
    if (!userId) {
      return res.status(400).send({ error: '缺少 user_id 参数' });
    }
    const rows = await queryLegacyAssets({
      where: 'da.user_id = ?',
      params: [userId],
    });
    return res.send({
      count: rows.length,
      records: rows,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.post('/get-purchased-assets', async (req, res) => {
  try {
    const addresses = Array.isArray(req.body?.addresses) ? req.body.addresses.map((item) => String(item || '').trim()).filter(Boolean) : [];
    if (!addresses.length) {
      return res.status(400).send({ error: '请求体必须包含地址数组 addresses' });
    }
    const placeholders = addresses.map(() => '?').join(',');
    const [rows] = await pool.query(
      `
        SELECT DISTINCT
          da.*,
          u.email,
          ac.category_name,
          ascg.sub_category_name,
          aci.owner_address,
          t.quality
        FROM transactions t
        INNER JOIN digital_asset da ON t.asset_id = da.id
        LEFT JOIN users u ON da.user_id = u.id
        LEFT JOIN asset_category ac ON da.category_id = ac.id
        LEFT JOIN asset_sub_category ascg ON da.sub_category_id = ascg.id
        LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
        WHERE t.buyer_address IN (${placeholders})
          AND t.status IN ('已确认', '已交付', '已完成', 'VM_RUNNING')
        ORDER BY da.updated_at DESC, da.id DESC
      `,
      addresses,
    );
    return res.send({
      assets: rows.map((row) => ({
        ...mapLegacyAssetRow(row),
        quality: row.quality || row.classification_data_level || '',
      })),
    });
  } catch (error) {
    return res.status(500).send({ error: error.message || '数据库查询失败' });
  }
});

router.post('/update-user', async (req, res) => {
  try {
    const userId = Number(req.body?.id || 0);
    if (!userId) {
      return res.status(400).send({ message: '缺少用户ID' });
    }

    const updateData = {};
    if (req.body?.username !== undefined) updateData.account = String(req.body.username || '').trim();
    if (req.body?.usertype !== undefined) updateData.identity = String(req.body.usertype || '').trim();
    if (req.body?.email !== undefined) updateData.email = String(req.body.email || '').trim();
    if (req.body?.address !== undefined) updateData.department = String(req.body.address || '').trim();

    if (!Object.keys(updateData).length) {
      return res.status(400).send({ message: '没有可更新的字段' });
    }

    updateData.update_time = new Date();
    const [result] = await pool.query('UPDATE users SET ? WHERE id = ?', [updateData, userId]);
    if (!result.affectedRows) {
      return res.status(404).send({ message: '用户未找到' });
    }
    return res.send({ message: '用户信息更新成功' });
  } catch (error) {
    return res.status(500).send({ message: error.message || '数据库更新错误' });
  }
});

router.post('/update-user-user', async (req, res) => {
  try {
    const userId = Number(req.body?.id || 0);
    if (!userId) {
      return res.status(400).send({ message: '缺少用户ID' });
    }

    const username = String(req.body?.username || '').trim();
    const email = String(req.body?.email || '').trim();
    const address = String(req.body?.address || '').trim();
    const phoneNumber = String(req.body?.phone_number || '').trim();

    if (!username || !email) {
      return res.status(400).send({ message: '用户名和邮箱不能为空' });
    }

    const updateData = {
      account: username,
      email,
      department: address,
      update_time: new Date(),
    };

    if (phoneNumber) {
      updateData.phone_number = phoneNumber;
    }

    if (req.body?.password) {
      updateData.password = await bcrypt.hash(String(req.body.password), 10);
    }

    const [result] = await pool.query('UPDATE users SET ? WHERE id = ?', [updateData, userId]);
    if (!result.affectedRows) {
      return res.status(404).send({ message: '用户未找到' });
    }
    return res.send({ message: '用户信息更新成功' });
  } catch (error) {
    if (error?.code === 'ER_BAD_FIELD_ERROR' && String(error.message || '').includes('phone_number')) {
      try {
        const fallbackData = {
          account: String(req.body?.username || '').trim(),
          email: String(req.body?.email || '').trim(),
          department: String(req.body?.address || '').trim(),
          update_time: new Date(),
        };
        if (req.body?.password) {
          fallbackData.password = await bcrypt.hash(String(req.body.password), 10);
        }
        const [result] = await pool.query('UPDATE users SET ? WHERE id = ?', [fallbackData, Number(req.body?.id || 0)]);
        if (!result.affectedRows) {
          return res.status(404).send({ message: '用户未找到' });
        }
        return res.send({ message: '用户信息更新成功' });
      } catch (fallbackError) {
        return res.status(500).send({ message: fallbackError.message || '数据库更新错误' });
      }
    }
    return res.status(500).send({ message: error.message || '数据库更新错误' });
  }
});

router.get('/get-tps', async (req, res) => {
  if (req.auth?.identity !== 'admin') {
    return res.status(403).send({ success: false, message: '仅管理员可获取交易 TPS' });
  }
  try {
    const result = await runTpsScript();
    return res.send(result);
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: error.message || '获取 TPS 失败',
    });
  }
});

router.post('/seller-confirm-transaction', async (req, res) => {
  try {
    const result = await assetService.sellerConfirmTransactionCompatible(req.body || {});
    return res.send(result);
  } catch (error) {
    return res.status(400).send({ message: error.message || '卖家确认交易失败' });
  }
});

router.post('/save-digital-contract', async (req, res) => {
  try {
    const result = await assetService.saveDigitalContractCompatible(req.body || {});
    return res.status(201).send({
      message: '数字合约已成功保存',
      contractDbId: result?.id || null,
      data: result,
    });
  } catch (error) {
    return res.status(400).send({ message: error.message || '保存数字合约失败' });
  }
});

router.post('/save-transaction', async (req, res) => {
  try {
    const payload = req.body || {};
    const transactionId = String(payload.transaction_id || payload.transactionId || '').trim();
    const orderNo = String(payload.order_no || payload.orderNo || '').trim();
    const assetId = Number(payload.asset_id || payload.assetId || 0) || null;
    if (!transactionId || !orderNo || !assetId) {
      return res.status(400).send({ error: '缺少 transaction_id、order_no 或 asset_id 参数' });
    }

    await pool.query(
      `
        INSERT INTO transactions
          (
            transaction_id,
            order_no,
            asset_id,
            buyer_id,
            buyer_address,
            seller_address,
            price,
            quantity,
            quality,
            processing_type,
            pc_type,
            status,
            expiration_time,
            model_file_hash,
            created_at,
            updated_at
          )
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          buyer_id = VALUES(buyer_id),
          buyer_address = VALUES(buyer_address),
          seller_address = VALUES(seller_address),
          price = VALUES(price),
          quantity = VALUES(quantity),
          quality = VALUES(quality),
          processing_type = VALUES(processing_type),
          pc_type = VALUES(pc_type),
          status = VALUES(status),
          expiration_time = VALUES(expiration_time),
          model_file_hash = VALUES(model_file_hash),
          updated_at = NOW()
      `,
      [
        transactionId,
        orderNo,
        assetId,
        payload.buyer_id || null,
        payload.buyer_address || '',
        payload.seller_address || '',
        Number(payload.price || 0),
        Number(payload.quantity || payload.buy_qty || 1),
        payload.quality || '',
        payload.processing_type || '',
        payload.pc_type || '',
        payload.status || '待确认',
        payload.expiration_time || null,
        payload.model_file_hash || '',
      ],
    );
    return res.send({ success: true, message: '交易记录保存成功' });
  } catch (error) {
    return res.status(500).send({ error: error.message || '保存交易失败' });
  }
});

router.get('/get-transaction-detail/:transaction_id', async (req, res) => {
  try {
    const transaction = await assetService.getTransactionDetailByTransactionId(req.params.transaction_id);
    if (!transaction) {
      return res.status(404).send({ message: '交易不存在' });
    }
    return res.send({ transaction });
  } catch (error) {
    return res.status(500).send({ message: error.message || '查询交易详情失败' });
  }
});

router.get('/get-today-transaction-stats', async (_req, res) => {
  try {
    const [[stats]] = await pool.query(
      `
        SELECT
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_count,
          SUM(CASE WHEN DATE(created_at) = CURDATE() - INTERVAL 1 DAY THEN 1 ELSE 0 END) AS yesterday_count
        FROM transactions
      `
    );
    const today = Number(stats?.today_count || 0);
    const yesterday = Number(stats?.yesterday_count || 0);
    const change = today - yesterday;
    const percentChange =
      yesterday > 0 ? `${((change / yesterday) * 100).toFixed(2)}%` : today > 0 ? '100.00%' : '0.00%';

    return res.send({
      today_transaction_count: today,
      yesterday_transaction_count: yesterday,
      change,
      percent_change: percentChange,
      trend: change > 0 ? '上升' : change < 0 ? '下降' : '持平',
    });
  } catch (error) {
    return res.status(500).send({ error: error.message || '数据库错误' });
  }
});

router.get('/get-transaction-history', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS transaction_count,
          AVG(CAST(price AS DECIMAL(18,2))) AS avg_price,
          SUM(CAST(price AS DECIMAL(18,2))) AS sum_price
        FROM transactions
        WHERE created_at >= CURDATE() - INTERVAL 30 DAY
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `
    );
    return res.send(rows);
  } catch (error) {
    return res.status(500).send({ error: error.message || '数据库错误' });
  }
});

router.get('/get-total-transaction-stats', async (_req, res) => {
  try {
    const [[row]] = await pool.query('SELECT COUNT(*) AS total_transaction_count FROM transactions');
    return res.send({
      success: true,
      total_transaction_count: Number(row?.total_transaction_count || 0),
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: error.message || '获取总交易量失败',
    });
  }
});

router.get('/industry-transaction-stats', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          COALESCE(NULLIF(classification_category_name, ''), '未分类') AS industryName,
          COUNT(*) AS count
        FROM digital_asset
        GROUP BY COALESCE(NULLIF(classification_category_name, ''), '未分类')
        ORDER BY count DESC
      `
    );
    return res.send({
      success: true,
      data: rows,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: error.message || '获取领域交易数量失败',
    });
  }
});

router.get('/delivery/status/:transactionId', async (req, res) => {
  try {
    const transactionId = String(req.params.transactionId || '').trim();
    const request = await assetService.getSellerDeliveryRequestStatus(transactionId);
    if (!request) {
      return res.send({
        success: true,
        exists: false,
        transactionId,
      });
    }
    return res.send({
      success: true,
      exists: true,
      transactionId,
      job: {
        status: request.status,
        step: request.request_type || '',
        vmId: request.vm_name || '',
        vmStatus: request.status,
        key1Status: '',
        contractStatus: '',
        sellerKeyStatus: '',
        buyerKeyStatus: '',
        dataFileStatus: '',
      },
      request,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message || '查询交付状态失败' });
  }
});

router.get('/asset/:id', async (req, res) => {
  try {
    const asset = await assetService.getAssetDetail(req.params.id);
    if (!asset) {
      return res.status(404).send({ message: '资产不存在' });
    }
    return res.send(asset);
  } catch (error) {
    return res.status(500).send({ message: error.message || '查询资产失败' });
  }
});

router.get('/get-asset-details/:file_hash', async (req, res) => {
  try {
    const row = await getAssetRowByFileHash(req.params.file_hash);
    if (!row) {
      return res.status(404).send({ message: '未找到指定的资产' });
    }
    return res.send(mapLegacyAssetRow(row));
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.get('/get-asset2', async (_req, res) => {
  try {
    const rows = await queryLegacyAssets();
    return res.send(rows);
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.get('/image/:hash', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT picture, picture_mime_type FROM digital_asset WHERE file_hash = ? ORDER BY id DESC LIMIT 1',
      [String(req.params.hash || '').trim()],
    );
    if (!rows.length || !rows[0].picture) {
      return res.status(404).send('图片未找到');
    }
    res.setHeader('Content-Type', rows[0].picture_mime_type || 'image/jpeg');
    return res.send(rows[0].picture);
  } catch (error) {
    return res.status(500).send(error.message || '服务器内部错误');
  }
});

router.post('/omniprint/fingerprint', memoryUpload.any(), async (req, res) => {
  try {
    const sourceFile = Array.isArray(req.files) ? req.files[0] : null;
    if (!sourceFile) {
      return res.status(400).send({ message: '请上传文件' });
    }
    const result = await assetService.generateFileFingerprint(sourceFile, req.body?.assetId || '');
    return res.send({
      success: true,
      message: '数字指纹生成成功',
      ...result,
    });
  } catch (error) {
    if (error?.statusCode === 409) {
      return res.status(409).send({
        success: false,
        message: error.message || '发现相似资产，未生成新数字指纹',
        similarAssets: error.data || null,
      });
    }
    if (Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 600) {
      return res.status(Number(error.statusCode)).send({
        success: false,
        message: error.message || 'OmniPrint 指纹生成失败',
        remote: error.data || null,
      });
    }
    return res.status(500).send({
      success: false,
      message: 'OmniPrint 服务异常',
      error: error.message || '数字指纹生成失败',
    });
  }
});

router.post('/omniprint/similarity-check', async (req, res) => {
  try {
    const result = await assetService.checkOmniPrintSimilarity(req.body || {});
    return res.send({ success: true, message: '相似度检测完成', ...result });
  } catch (error) {
    return res.status(502).send({
      success: false,
      message: 'OmniPrint 相似度检测失败',
      error: error.message || '相似度检测失败',
    });
  }
});

router.post('/check-hash', async (req, res) => {
  try {
    const hash = String(req.body?.hash || '').trim();
    if (!hash) {
      return res.status(400).send({ message: '缺少 hash 参数' });
    }
    const [[row]] = await pool.query('SELECT COUNT(*) AS count FROM digital_asset WHERE file_hash = ?', [hash]);
    const exists = Number(row?.count || 0) > 0;
    return res.status(exists ? 409 : 200).send({
      message: exists ? '资产已存在，file_hash 重复' : '文件哈希不存在，可继续上传',
      exists,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message || '检查失败，请稍后再试' });
  }
});

router.get('/model-options', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT asset_name, file_hash, file_format AS model_type
        FROM digital_asset
        WHERE TRIM(IFNULL(file_hash, '')) <> ''
        ORDER BY id DESC
      `,
    );
    return res.send({ models: rows });
  } catch (error) {
    return res.status(500).send({ error: error.message || '服务器内部错误' });
  }
});

router.post('/get-user-id', async (req, res) => {
  try {
    const username = req.body?.username || req.body?.account || '';
    const id = await certificateService.getUserIdByUsername(username);
    return res.send({ id, username });
  } catch (error) {
    return res.status(400).send({ message: error.message || '用户不存在' });
  }
});

router.post('/get-certificates', async (req, res) => {
  try {
    const certificates = await certificateService.getCertificates(req.auth?.id || req.body?.userId);
    return res.send({ status: 0, certificates });
  } catch (error) {
    return res.status(400).send({ message: error.message || '获取证书失败' });
  }
});

router.post('/get-certificates2', async (req, res) => {
  try {
    return res.send({ status: 0, message: '当前系统仅使用 wx-org1 证书', certificates: [] });
  } catch (error) {
    return res.status(400).send({ message: error.message || '获取证书失败' });
  }
});

router.get('/user-certificates', async (req, res) => {
  try {
    const certificates = await certificateService.getAllCertificates(getCurrentUserId(req));
    return res.send({ success: true, certificates });
  } catch (error) {
    return res.status(400).send({ message: error.message || '获取用户证书失败' });
  }
});

router.get('/default-cert', async (req, res) => {
  try {
    const data = await certificateService.getDefaultCertificates(getCurrentUserId(req));
    return res.send({ status: 0, success: true, data });
  } catch (error) {
    return res.status(400).send({ message: error.message || '查询默认证书失败' });
  }
});

router.post('/save-default-cert', async (req, res) => {
  try {
    const payload = req.body || {};
    const data = await certificateService.saveDefaultCertificates({
      userId: getCurrentUserId(req),
      defaultRegisterCert: payload.defaultRegisterCert || payload.default_register_cert || '',
      defaultTradeCert: payload.defaultTradeCert || payload.default_trade_cert || '',
    });
    return res.send({ status: 0, success: true, data });
  } catch (error) {
    return res.status(400).send({ message: error.message || '保存默认证书失败' });
  }
});

router.get('/default-register-cert-info', async (req, res) => {
  try {
    const data = await certificateService.getDefaultRegisterCertInfo(getCurrentUserId(req));
    return res.send({ status: 0, data });
  } catch (error) {
    return res.status(400).send({ message: error.message || '查询默认登记证书失败' });
  }
});

router.get('/default-trade-cert-info', async (req, res) => {
  try {
    const data = await certificateService.getDefaultTradeCertInfo(getCurrentUserId(req));
    return res.send({ status: 0, data });
  } catch (error) {
    return res.status(400).send({ message: error.message || '查询默认交易证书失败' });
  }
});

router.post('/add-certificate', async (req, res) => {
  try {
    const payload = req.body || {};
    const data = await certificateService.addCertificate({
      userId: req.auth?.id || payload.userId || payload.user_id,
      certificateName: payload.certificateName || payload.certificate_name || payload.cert,
    });
    return res.send({ status: 0, data });
  } catch (error) {
    return res.status(400).send({ message: error.message || '添加证书失败' });
  }
});

router.post('/update-asset', async (req, res) => {
  try {
    const fileHash = String(req.body?.fileHash || req.body?.file_hash || '').trim();
    if (!fileHash) {
      return res.status(400).send({ message: '缺少 fileHash 参数' });
    }

    const asset = await getAssetRowByFileHash(fileHash);
    if (!asset) {
      return res.status(404).send({ message: '未找到对应的资产' });
    }

    const operatorId = Number(req.auth?.id || req.body?.userId || asset.user_id || 0);
    const payload = {};

    if (req.body?.assetName !== undefined) payload.asset_name = String(req.body.assetName || '').trim();
    if (req.body?.assetType !== undefined) payload.sub_category_name = String(req.body.assetType || '').trim();
    if (req.body?.description !== undefined) payload.description = String(req.body.description || '').trim();
    if (req.body?.address !== undefined) payload.trade_region = String(req.body.address || '').trim();
    if (req.body?.txperm !== undefined) {
      const txperm = Number(req.body.txperm || 0);
      payload.can_sell_ownership = txperm === 1 || Number(req.body?.can_sell_asset || 0) === 1 ? 1 : 0;
      payload.can_sell_view_right = txperm === 2 || Number(req.body?.can_sell_view || 0) === 1 ? 1 : 0;
      payload.can_sell_process_right = txperm === 3 || Number(req.body?.can_sell_process || 0) === 1 ? 1 : 0;
    } else {
      if (req.body?.can_sell_asset !== undefined) payload.can_sell_ownership = Number(req.body.can_sell_asset || 0);
      if (req.body?.can_sell_view !== undefined) payload.can_sell_view_right = Number(req.body.can_sell_view || 0);
      if (req.body?.can_sell_process !== undefined) payload.can_sell_process_right = Number(req.body.can_sell_process || 0);
    }
    if (req.body?.price !== undefined) payload.price = Number(req.body.price || 0);

    await assetService.updateAssetByOwner(asset.id, operatorId, payload, req.auth?.identity || 'seller');
    return res.send({ message: '资产信息更新成功' });
  } catch (error) {
    return res.status(500).send({ message: error.message || '更新失败，请稍后再试' });
  }
});

router.post('/authorize', async (req, res) => {
  try {
    const fileHash = String(req.body?.fileHash || '').trim();
    const agentAddr = String(req.body?.agent_addr || req.body?.target_address || '').trim();
    if (!fileHash || !agentAddr) {
      return res.status(400).send({ message: '文件哈希和目标地址是必填的' });
    }
    const asset = await getAssetRowByFileHash(fileHash);
    if (!asset) {
      return res.status(404).send({ message: '未找到对应的资产' });
    }
    const result = await assetService.proxyCustodyByOwner(
      asset.id,
      Number(req.auth?.id || asset.user_id || 0),
      { target_address: agentAddr },
      req.auth?.identity || 'seller',
    );
    return res.send({ message: '授权成功', data: result });
  } catch (error) {
    return res.status(500).send({ message: error.message || '授权失败，请稍后再试' });
  }
});

router.post('/update-owner', async (req, res) => {
  try {
    const assetId = req.body?.assetId;
    const newOwner = String(req.body?.newOwner || '').trim();
    if (!assetId || !newOwner) {
      return res.status(400).send({ message: '缺少 assetId 或 newOwner 参数' });
    }

    const asset = await getAssetRowByFileHashOrId(assetId);
    if (!asset) {
      return res.status(404).send({ message: '资产未找到' });
    }

    const [existsRows] = await pool.query(
      'SELECT id FROM asset_chain_info WHERE asset_id = ? LIMIT 1',
      [asset.id],
    );
    if (existsRows.length) {
      await pool.query(
        `
          UPDATE asset_chain_info
          SET owner_address = ?,
              last_sync_time = NOW(),
              updated_at = NOW()
          WHERE asset_id = ?
        `,
        [newOwner, asset.id],
      );
    } else {
      await pool.query(
        `
          INSERT INTO asset_chain_info (asset_id, owner_address, chain_status, last_sync_time)
          VALUES (?, ?, 0, NOW())
        `,
        [asset.id, newOwner],
      );
    }

    return res.send({ message: '当前拥有者更新成功' });
  } catch (error) {
    return res.status(500).send({ message: error.message || '服务器内部错误' });
  }
});

router.post('/update-agent', async (req, res) => {
  try {
    const fileHash = String(req.body?.file_hash || '').trim();
    if (!fileHash) {
      return res.status(400).send({ message: '缺少 file_hash 参数' });
    }
    const asset = await getAssetRowByFileHash(fileHash);
    if (!asset) {
      return res.status(404).send({ message: '未找到匹配的资产记录，file_hash 不存在' });
    }

    const isProxied = String(req.body?.agent_addr || '').trim() ? 1 : Number(asset.is_proxied || 0);
    await pool.query(
      'UPDATE digital_asset SET is_proxied = ?, updated_at = NOW() WHERE id = ?',
      [isProxied, asset.id],
    );

    return res.send({
      message: '代理信息更新成功',
      file_hash: fileHash,
      agent_addr: req.body?.agent_addr || '',
      agent_count: Number(req.body?.agent_count || 0),
    });
  } catch (error) {
    return res.status(500).send({ message: error.message || '服务器内部错误' });
  }
});

router.get('/seller-pending-transactions/:seller_address', async (req, res) => {
  try {
    const pendingTransactions = await assetService.getTransactionsBySellerAddress(req.params.seller_address, {
      status: '待确认',
    });
    return res.send({ pendingTransactions });
  } catch (error) {
    return res.status(500).send({ message: error.message || '查询卖家待确认交易失败' });
  }
});

router.get('/buyer-transaction-status/:buyer_address', async (req, res) => {
  try {
    const transactions = await assetService.getTransactionsByBuyerAddress(req.params.buyer_address);
    return res.send({ transactions });
  } catch (error) {
    return res.status(500).send({ message: error.message || '查询买家交易状态失败' });
  }
});

router.get('/seller-transaction-status/:seller_address', async (req, res) => {
  try {
    const transactions = await assetService.getTransactionsBySellerAddress(req.params.seller_address);
    return res.send({ transactions });
  } catch (error) {
    return res.status(500).send({ message: error.message || '查询卖家交易状态失败' });
  }
});

router.get('/delivery/seller/request-status/:transaction_id', async (req, res) => {
  try {
    const request = await assetService.getSellerDeliveryRequestStatus(req.params.transaction_id);
    return res.send({ success: true, request });
  } catch (error) {
    return res.status(500).send({ message: error.message || '查询交付申请状态失败' });
  }
});

router.post('/digital-contract/verify', async (req, res) => {
  try {
    const result = await assetService.verifyDigitalContract(req.body || {}, req.auth);
    return res.send(result);
  } catch (error) {
    return res.status(400).send({ success: false, verified: false, message: error.message || '数字合约校验失败' });
  }
});

router.post('/privacy/send-contract', async (req, res) => {
  try {
    const payload = req.body || {};
    const deliveryMethod = String(payload.deliveryMethod || payload.delivery_method || '').trim().toUpperCase();
    const contract = payload.contract || {};
    const result = await assetService.saveDigitalContractCompatible({
      transaction_id: payload.transactionId || payload.transaction_id,
      contract_id: contract.contract_id,
      buyer_address: contract.buyer_id || payload.buyer_address,
      seller_address: contract.seller_id || payload.seller_address,
      pc_type:
        deliveryMethod === 'FEDERATED' ? 'FL' :
        deliveryMethod === 'HOMOMORPHIC' ? 'HE' :
        deliveryMethod || undefined,
    });
    return res.send({ success: true, delivery_url: '', contract: result });
  } catch (error) {
    return res.status(400).send({ success: false, message: error.message || '发送业务合同失败' });
  }
});
router.post('/privacy/pre/create-contract', async (req, res) => {
  const transactionId = String(req.body?.transactionId || '').trim();
  if (!transactionId) return res.status(400).send({ success: false, message: '缺少 transactionId' });
  return res.send({ success: true, preContractId: `PRE-${transactionId}` });
});
router.post('/privacy/pre/upload-file', memoryUpload.any(), (req, res) => proxyMultipart(req, res, LOCAL_BASE, '/api/privacy/pre/publish'));
router.post('/privacy/fl/init', async (req, res) => {
  const transactionId = String(req.body?.transactionId || '').trim();
  if (!transactionId) return res.status(400).send({ success: false, message: '缺少 transactionId' });
  return res.send({ success: true, taskId: `FL-${transactionId}` });
});
router.post('/privacy/fl/forward-upload', memoryUpload.any(), (req, res) => proxyMultipart(req, res, LOCAL_BASE, '/api/privacy/fl/upload-batch'));
router.get('/privacy/results', async (req, res) => {
  try {
    const result = await assetService.listPrivacyResultsCompatible(req.query || {});
    return res.send(result);
  } catch (error) {
    return res.status(400).send({ success: false, message: error.message || '查询隐私计算结果失败' });
  }
});
router.post('/delivery/record', async (req, res) => {
  try {
    const result = await assetService.recordDeliveryCompatible(req.body || {});
    return res.send(result);
  } catch (error) {
    return res.status(400).send({ success: false, message: error.message || '记录交付失败' });
  }
});
router.post('/delivery/request-secure', async (req, res) => {
  try {
    const result = await assetService.requestSecureDeliveryCompatible(req.body || {});
    return res.send(result);
  } catch (error) {
    return res.status(400).send({ success: false, message: error.message || '交付申请失败' });
  }
});
router.post('/delivery/request-vm', async (req, res) => {
  try {
    const result = await assetService.requestVmCompatible(req.body || {});
    return res.status(201).send(result);
  } catch (error) {
    return res.status(400).send({ message: error.message || '交付申请提交失败' });
  }
});
router.post('/delivery/secure-confirm', async (req, res) => {
  try {
    const result = await assetService.secureConfirmCompatible(req.body || {});
    return res.send(result);
  } catch (error) {
    return res.status(400).send({ success: false, message: error.message || '安全交付流程失败' });
  }
});
router.post('/delivery/test-start-vm', async (req, res) => {
  try {
    const result = await assetService.testStartVmCompatible(req.body || {});
    return res.send(result);
  } catch (error) {
    return res.status(400).send({ success: false, message: error.message || '虚机启动失败' });
  }
});

router.post('/vm/create', (req, res) => proxyExternal(req, res, VM_HOST_BASE_URL, '/api/v2/vms'));
router.get('/vm/list', (req, res) => proxyExternal(req, res, VM_HOST_BASE_URL, '/api/v2/vms'));
router.post('/vm/send-key', (req, res) => proxyExternal(req, res, REMOTE_KEY_URL, ''));
router.get('/vm/send-key/response/:vmId', async (_req, res) => res.status(404).send({ message: 'send-key 响应缓存未在当前 back 中保留，请重新发起 send-key' }));
router.post('/vm/send-json', (req, res) => proxyExternal(req, res, REMOTE_JSON_URL, ''));
router.post('/vm/send-file', memoryUpload.any(), (req, res) => proxyMultipart(req, res, REMOTE_FILE_URL, ''));
router.post('/vm/verify-contract', (req, res) => proxyExternal(req, res, VM_SERVICE_BASE_URL, '/verify-contract'));
router.post('/vm/mount-assets', (req, res) => proxyExternal(req, res, VM_SERVICE_BASE_URL, '/mount-assets'));
router.post('/vm/compute', (req, res) => proxyExternal(req, res, VM_SERVICE_BASE_URL, '/compute'));
router.get('/vm/export/eligible', async (req, res) => {
  try {
    const result = await assetService.getVmExportEligibleCompatible(req.query || {});
    return res.send(result);
  } catch (error) {
    return res.status(400).send({ success: false, message: error.message || '查询下载资格失败' });
  }
});
router.post('/vm/export', async (req, res) => {
  try {
    const result = await assetService.exportVmCompatible(req.body || {});
    res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename || 'result.bin'}"`);
    return res.send(result.buffer);
  } catch (error) {
    return res.status(400).send({ success: false, message: error.message || '导出结果失败' });
  }
});
router.post('/vm/asset/record', async (req, res) => {
  try {
    const result = await assetService.recordDeliveryCompatible(req.body || {});
    return res.send(result);
  } catch (error) {
    return res.status(400).send({ success: false, message: error.message || '记录资产交付失败' });
  }
});

router.get('/available-assets', async (req, res) => {
  try {
    const result = await assetService.listAvailableAssetsCompatible(req.query || {});
    return res.send(result);
  } catch (error) {
    return res.status(500).send({ message: error.message || '查询可交易资产失败' });
  }
});
router.get('/resalable-assets', async (req, res) => {
  try {
    const result = await assetService.listResalableAssetsCompatible(req.query || {});
    return res.send(result);
  } catch (error) {
    return res.status(500).send({ message: error.message || '查询可二次交易资产失败' });
  }
});
router.post('/datacatalog/publish-asset', async (req, res) => {
  try {
    const result = await assetService.publishAssetToDataCatalogCompatible(req.body || {});
    return res.send(result);
  } catch (error) {
    return res.status(400).send({ success: false, message: error.message || '目录发布失败' });
  }
});

module.exports = router;
