const db = require('../db/index');

const pool = db.promise();
const { isEnabled: digitalContractEnabled } = require('./digitalContract');

const COMPLETED_PCP_STATUSES = new Set(['COMPLETED']);
const COMPLETED_MPC_STATUSES = new Set(['done']);

const parseJson = (value, fallback = null) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const buildPlaceholders = (list = []) => list.map(() => '?').join(', ');

const generateBizId = (prefix) => {
  const now = new Date();
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${stamp}${random}`;
};

const normalizePcType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized || normalized === 'NONE' || normalized === 'STANDARD' || normalized === 'BASIC') {
    return null;
  }
  if (normalized === 'GC') return 'MPC';
  return normalized;
};

const getTradeModeLabel = (tradeMode) => {
  if (tradeMode === 'view') return '查阅权';
  if (tradeMode === 'process') return '加工权';
  return '所有权';
};

const normalizeOperationLabel = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text === '所有权' || text === '持有权') return '所有';
  if (text === '查阅权') return '查阅权';
  if (text === '加工权' || text === '加工使用权') return '加工权';
  return text;
};

const buildOperationsFromQuality = (quality, tradeMode) => {
  const values = String(quality || '')
    .split(',')
    .map((item) => normalizeOperationLabel(item))
    .filter(Boolean);
  if (values.length) return values.join(',');
  return normalizeOperationLabel(getTradeModeLabel(tradeMode)) || '所有';
};

const normalizeProcessingType = (value, tradeMode = 'ownership') => {
  const normalized = String(value || '').trim();
  if (normalized) return normalized;
  return getTradeModeLabel(tradeMode);
};

const buildContractName = (assetName) => `${String(assetName || '数字资产').trim() || '数字资产'}-数字合约`;

const serializeRecordPayload = (payload) => {
  if (payload == null) return null;
  try {
    return JSON.stringify(payload);
  } catch (_error) {
    return null;
  }
};

const mapTransactionRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    delivery_count: Number(row.delivery_count || 0),
    delivery_limit: Number(row.delivery_limit || 0),
  };
};

const mapDigitalContractRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    pc_type: normalizePcType(row.pc_type),
  };
};

const mapDeliveryRecordRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    record_payload: parseJson(row.record_payload, null),
  };
};

const mapFlRecordRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    seller_ids: parseJson(row.seller_ids_json, []),
    seller_join_packages: parseJson(row.seller_join_packages_json, {}),
    seller_result_packages: parseJson(row.seller_result_packages_json, {}),
  };
};

const mapMpcRecordRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    compute_params: parseJson(row.compute_params_json, {}),
    seller_input: parseJson(row.seller_input_json, null),
    result: parseJson(row.result_json, null),
  };
};

async function getTransactionByOrderNo(conn, orderNo) {
  const [rows] = await conn.query(
    'SELECT * FROM transactions WHERE order_no = ? LIMIT 1',
    [orderNo],
  );
  return mapTransactionRow(rows[0] || null);
}

async function getDigitalContractByOrderNo(conn, orderNo) {
  const [rows] = await conn.query(
    'SELECT * FROM digital_contracts WHERE order_no = ? LIMIT 1',
    [orderNo],
  );
  return mapDigitalContractRow(rows[0] || null);
}

async function ensureTransactionForOrder(conn, order, payload = {}) {
  const existing = await getTransactionByOrderNo(conn, order.order_no);
  const buyerCertificateName =
    String(payload.buyer_certificate_name || order.buyer_certificate_name || '').trim() || null;
  const sellerCertificateName =
    String(payload.seller_certificate_name || order.seller_certificate_name || '').trim() || null;
  const buyerAddress =
    String(payload.buyer_address || order.buyer_address || '').trim();
  const sellerAddress =
    String(payload.seller_address || order.seller_address || order.owner_address || '').trim();
  const transactionId = existing?.transaction_id || generateBizId('TX');
  const status = String(payload.status || existing?.status || '已确认').trim();
  const processingType = normalizeProcessingType(
    payload.processing_type || existing?.processing_type,
    order.trade_mode,
  );
  const pcType = normalizePcType(payload.pc_type || existing?.pc_type || order.pc_type);
  const deliveryLimit = Number(payload.delivery_limit || existing?.delivery_limit || 1);
  const deliveryCount = Number(payload.delivery_count ?? existing?.delivery_count ?? 0);
  const expirationTime =
    payload.expiration_time || existing?.expiration_time || null;
  const quantity = Number(payload.quantity || existing?.quantity || order.buy_qty || 1);
  const quality =
    String(
      payload.quality || existing?.quality || order.classification_data_level || '',
    ).trim() || null;
  const modelFileHash = String(
    digitalContractEnabled() ? existing?.model_file_hash || '' : payload.model_file_hash || existing?.model_file_hash || order.file_hash || '',
  ).trim() || null;

  if (existing) {
    await conn.query(
      `
        UPDATE transactions
        SET owner_id = ?,
            seller_id = ?,
            buyer_certificate_name = ?,
            buyer_address = ?,
            seller_certificate_name = ?,
            seller_address = ?,
            status = ?,
            quantity = ?,
            quality = ?,
            processing_type = ?,
            pc_type = ?,
            expiration_time = ?,
            model_file_hash = ?,
            delivery_count = ?,
            delivery_limit = ?,
            updated_at = NOW()
        WHERE id = ?
      `,
      [
        order.owner_id || order.publisher_id,
        order.publisher_id,
        buyerCertificateName,
        buyerAddress,
        sellerCertificateName,
        sellerAddress,
        status,
        quantity,
        quality,
        processingType,
        pcType,
        expirationTime,
        modelFileHash,
        deliveryCount,
        deliveryLimit,
        existing.id,
      ],
    );
    return getTransactionByOrderNo(conn, order.order_no);
  }

  await conn.query(
    `
      INSERT INTO transactions (
        transaction_id,
        order_no,
        asset_id,
        owner_id,
        buyer_id,
        buyer_certificate_name,
        buyer_address,
        seller_id,
        seller_certificate_name,
        seller_address,
        status,
        quantity,
        quality,
        processing_type,
        pc_type,
        expiration_time,
        model_file_hash,
        delivery_count,
        delivery_limit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      transactionId,
      order.order_no,
      order.asset_id,
      order.owner_id || order.publisher_id,
      order.buyer_id,
      buyerCertificateName,
      buyerAddress,
      order.publisher_id,
      sellerCertificateName,
      sellerAddress,
      status,
      quantity,
      quality,
      processingType,
      pcType,
      expirationTime,
      modelFileHash,
      deliveryCount,
      deliveryLimit,
    ],
  );

  return getTransactionByOrderNo(conn, order.order_no);
}

async function upsertDigitalContractForOrder(conn, order, transaction, payload = {}) {
  const existing = await getDigitalContractByOrderNo(conn, order.order_no);
  const contractId =
    String(existing?.contract_id || payload.contract_id || '').trim() ||
    `CONTRACT-${transaction.transaction_id}`;
  const contractName =
    String(payload.contract_name || existing?.contract_name || buildContractName(order.asset_name)).trim() ||
    buildContractName(order.asset_name);
  const productName =
    String(payload.product_name || existing?.product_name || order.asset_name || '').trim() ||
    order.asset_name ||
    null;
  const contractDescription =
    String(
      payload.contract_description ||
        existing?.contract_description ||
        order.description ||
        '该数字合约依据平台交易信息自动生成，用于界定交易双方权责与限制条件。',
    ).trim() || null;
  const operations =
    String(
      payload.operations ||
        existing?.operations ||
        buildOperationsFromQuality(transaction?.quality || order?.quality, order.trade_mode),
    ).trim() || null;
  const processingType = normalizeProcessingType(
    payload.processing_type || existing?.processing_type,
    order.trade_mode,
  );
  const pcType = normalizePcType(payload.pc_type || existing?.pc_type);
  const tokenId = String(payload.token_id || existing?.token_id || order.token_id || order.file_hash || '').trim() || null;
  const modelFileHash =
    digitalContractEnabled()
      ? (existing?.model_hash_verified === 1 ? existing.model_file_hash : null)
      : String(payload.model_file_hash || existing?.model_file_hash || order.file_hash || '').trim() || null;
  const quantityLimit = Number(payload.quantity_limit || existing?.quantity_limit || order.buy_qty || 1);
  const expirationTime =
    payload.expiration_time || existing?.expiration_time || transaction.expiration_time || null;
  const status = String(payload.status || existing?.status || (pcType ? '已配置' : '草稿')).trim();

  if (existing) {
    await conn.query(
      `
        UPDATE digital_contracts
        SET contract_name = ?,
            product_name = ?,
            token_id = ?,
            contract_description = ?,
            seller_address = ?,
            buyer_address = ?,
            operations = ?,
            expiration_time = ?,
            quantity_limit = ?,
            processing_type = ?,
            pc_type = ?,
            model_file_hash = ?,
            status = ?,
            ${digitalContractEnabled() ? "policy_version = policy_version + 1, verification_status = 'UNVERIFIED', verified_at = NULL," : ''}
            updated_at = NOW()
        WHERE id = ?
      `,
      [
        contractName,
        productName,
        tokenId,
        contractDescription,
        transaction.seller_address,
        transaction.buyer_address,
        operations,
        expirationTime,
        quantityLimit,
        processingType,
        pcType,
        modelFileHash,
        status,
        existing.id,
      ],
    );
    return getDigitalContractByOrderNo(conn, order.order_no);
  }

  await conn.query(
    `
      INSERT INTO digital_contracts (
        contract_id,
        transaction_id,
        order_no,
        asset_id,
        contract_name,
        product_name,
        token_id,
        contract_description,
        seller_address,
        buyer_address,
        operations,
        expiration_time,
        quantity_limit,
        processing_type,
        pc_type,
        model_file_hash,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      contractId,
      transaction.transaction_id,
      order.order_no,
      order.asset_id,
      contractName,
      productName,
      tokenId,
      contractDescription,
      transaction.seller_address,
      transaction.buyer_address,
      operations,
      expirationTime,
      quantityLimit,
      processingType,
      pcType,
      modelFileHash,
      status,
    ],
  );

  return getDigitalContractByOrderNo(conn, order.order_no);
}

async function saveDeliveryRequest(conn, payload = {}) {
  const transactionId = String(payload.transaction_id || '').trim();
  if (!transactionId) throw new Error('缺少 transaction_id');

  const [rows] = await conn.query(
    'SELECT id FROM delivery_requests WHERE transaction_id = ? ORDER BY id DESC LIMIT 1',
    [transactionId],
  );
  const requestType = String(payload.request_type || 'TEE').trim().toUpperCase();
  const status = String(payload.status || 'APPROVED').trim().toUpperCase();
  const note = String(payload.note || '').trim() || null;

  if (rows.length) {
    await conn.query(
      `
        UPDATE delivery_requests
        SET order_no = ?,
            buyer_address = ?,
            seller_address = ?,
            request_type = ?,
            vm_name = ?,
            vm_cpu = ?,
            vm_memory_mb = ?,
            note = ?,
            status = ?,
            requested_by = ?,
            approved_by = ?,
            updated_at = NOW()
        WHERE id = ?
      `,
      [
        payload.order_no || null,
        payload.buyer_address || '',
        payload.seller_address || '',
        requestType,
        payload.vm_name || null,
        payload.vm_cpu || null,
        payload.vm_memory_mb || null,
        note,
        status,
        payload.requested_by || null,
        payload.approved_by || null,
        rows[0].id,
      ],
    );
  } else {
    await conn.query(
      `
        INSERT INTO delivery_requests (
          transaction_id,
          order_no,
          buyer_address,
          seller_address,
          request_type,
          vm_name,
          vm_cpu,
          vm_memory_mb,
          note,
          status,
          requested_by,
          approved_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        transactionId,
        payload.order_no || null,
        payload.buyer_address || '',
        payload.seller_address || '',
        requestType,
        payload.vm_name || null,
        payload.vm_cpu || null,
        payload.vm_memory_mb || null,
        note,
        status,
        payload.requested_by || null,
        payload.approved_by || null,
      ],
    );
  }

  const [savedRows] = await conn.query(
    'SELECT * FROM delivery_requests WHERE transaction_id = ? ORDER BY id DESC LIMIT 1',
    [transactionId],
  );
  return savedRows[0] || null;
}

async function appendDeliveryRecord(conn, payload = {}) {
  const transactionId = String(payload.transaction_id || '').trim();
  if (!transactionId) throw new Error('缺少 transaction_id');

  const [indexRows] = await conn.query(
    'SELECT IFNULL(MAX(delivery_index), 0) AS currentIndex FROM delivery_records WHERE transaction_id = ?',
    [transactionId],
  );
  const nextIndex = Number(indexRows[0]?.currentIndex || 0) + 1;
  await conn.query(
    `
      INSERT INTO delivery_records (
        transaction_id,
        order_no,
        delivery_index,
        delivery_type,
        buyer_address,
        seller_address,
        delivery_message,
        result_status,
        record_payload,
        delivered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      transactionId,
      payload.order_no || null,
      nextIndex,
      String(payload.delivery_type || 'TEE').trim().toUpperCase(),
      payload.buyer_address || '',
      payload.seller_address || '',
      String(payload.delivery_message || '').trim() || null,
      String(payload.result_status || 'DELIVERED').trim().toUpperCase(),
      serializeRecordPayload(payload.record_payload),
    ],
  );
  const [rows] = await conn.query(
    `
      SELECT *
      FROM delivery_records
      WHERE transaction_id = ? AND delivery_index = ?
      LIMIT 1
    `,
    [transactionId, nextIndex],
  );
  return mapDeliveryRecordRow(rows[0] || null);
}

async function attachDeliveryMeta(orderList = []) {
  if (!Array.isArray(orderList) || !orderList.length) return orderList;

  const orderNos = orderList.map((item) => item.order_no).filter(Boolean);
  const placeholders = buildPlaceholders(orderNos);
  const [transactionRows] = await pool.query(
    `SELECT * FROM transactions WHERE order_no IN (${placeholders})`,
    orderNos,
  );

  const txMap = new Map(transactionRows.map((row) => [row.order_no, mapTransactionRow(row)]));
  const transactionIds = transactionRows.map((row) => row.transaction_id).filter(Boolean);

  let contractRows = [];
  let requestRows = [];
  let recordRows = [];
  let heRows = [];
  let preRows = [];
  let flRows = [];
  let mpcRows = [];

  if (transactionIds.length) {
    const txPlaceholders = buildPlaceholders(transactionIds);
    [contractRows] = await pool.query(
      `SELECT * FROM digital_contracts WHERE transaction_id IN (${txPlaceholders})`,
      transactionIds,
    );
    [requestRows] = await pool.query(
      `SELECT * FROM delivery_requests WHERE transaction_id IN (${txPlaceholders}) ORDER BY id DESC`,
      transactionIds,
    );
    [recordRows] = await pool.query(
      `SELECT * FROM delivery_records WHERE transaction_id IN (${txPlaceholders}) ORDER BY transaction_id ASC, delivery_index ASC`,
      transactionIds,
    );
    [heRows] = await pool.query(
      `SELECT * FROM he_delivery_contracts WHERE transaction_id IN (${txPlaceholders})`,
      transactionIds,
    );
    [preRows] = await pool.query(
      `SELECT * FROM pre_delivery_contracts WHERE transaction_id IN (${txPlaceholders})`,
      transactionIds,
    );
    [flRows] = await pool.query(
      `SELECT * FROM fl_delivery_contracts WHERE transaction_id IN (${txPlaceholders})`,
      transactionIds,
    );
    [mpcRows] = await pool.query(
      `SELECT * FROM mpc_delivery_contracts WHERE transaction_id IN (${txPlaceholders})`,
      transactionIds,
    );
  }

  const contractMap = new Map(contractRows.map((row) => [row.transaction_id, mapDigitalContractRow(row)]));
  const latestRequestMap = new Map();
  requestRows.forEach((row) => {
    if (!latestRequestMap.has(row.transaction_id)) {
      latestRequestMap.set(row.transaction_id, row);
    }
  });
  const recordMap = new Map();
  recordRows.forEach((row) => {
    const list = recordMap.get(row.transaction_id) || [];
    list.push(mapDeliveryRecordRow(row));
    recordMap.set(row.transaction_id, list);
  });
  const heMap = new Map(heRows.map((row) => [row.transaction_id, row]));
  const preMap = new Map(preRows.map((row) => [row.transaction_id, row]));
  const flMap = new Map(flRows.map((row) => [row.transaction_id, mapFlRecordRow(row)]));
  const mpcMap = new Map(mpcRows.map((row) => [row.transaction_id, mapMpcRecordRow(row)]));

  return orderList.map((item) => {
    const transaction = txMap.get(item.order_no) || null;
    const transactionId = transaction?.transaction_id || null;
    const deliveryHistory = transactionId ? recordMap.get(transactionId) || [] : [];
    return {
      ...item,
      transaction,
      digital_contract: transactionId ? contractMap.get(transactionId) || null : null,
      latest_delivery_request: transactionId ? latestRequestMap.get(transactionId) || null : null,
      delivery_history: deliveryHistory,
      he_record: transactionId ? heMap.get(transactionId) || null : null,
      pre_record: transactionId ? preMap.get(transactionId) || null : null,
      fl_record: transactionId ? flMap.get(transactionId) || null : null,
      mpc_record: transactionId ? mpcMap.get(transactionId) || null : null,
    };
  });
}

function isPrivacyResultReady({ digitalContract, heRecord, preRecord, flRecord, mpcRecord }) {
  const pcType = normalizePcType(digitalContract?.pc_type);
  if (!pcType) return true;

  if (pcType === 'HE') {
    return (
      COMPLETED_PCP_STATUSES.has(String(heRecord?.pcp_status || '').toUpperCase()) &&
      Boolean(heRecord?.download_token || heRecord?.result_storage_path)
    );
  }

  if (pcType === 'PRE') {
    return (
      COMPLETED_PCP_STATUSES.has(String(preRecord?.pcp_status || '').toUpperCase()) &&
      Boolean(preRecord?.download_token || preRecord?.result_storage_path)
    );
  }

  if (pcType === 'FL') {
    return (
      COMPLETED_PCP_STATUSES.has(String(flRecord?.pcp_status || '').toUpperCase()) &&
      Boolean(flRecord?.buyer_download_token || flRecord?.buyer_result_storage_path)
    );
  }

  if (pcType === 'MPC') {
    return COMPLETED_MPC_STATUSES.has(String(mpcRecord?.task_status || '').toLowerCase());
  }

  return true;
}

module.exports = {
  attachDeliveryMeta,
  appendDeliveryRecord,
  buildContractName,
  buildOperationsFromQuality,
  ensureTransactionForOrder,
  generateBizId,
  getDigitalContractByOrderNo,
  getTradeModeLabel,
  isPrivacyResultReady,
  normalizePcType,
  normalizeProcessingType,
  saveDeliveryRequest,
  upsertDigitalContractForOrder,
};
