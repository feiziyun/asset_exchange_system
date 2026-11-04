const db = require('../db/index');
const chainClient = require('./chainClient');
const certificateService = require('./certificate');
const digitalContractService = require('./digitalContract');
const {
  attachDeliveryMeta,
  appendDeliveryRecord,
  buildOperationsFromQuality,
  ensureTransactionForOrder,
  isPrivacyResultReady,
  normalizePcType,
  normalizeProcessingType,
  saveDeliveryRequest,
  upsertDigitalContractForOrder,
} = require('./delivery');
const crypto = require('crypto');
const { loggedFetch, createLoggedAxios } = require('./httpLogger');
const { services } = require('../config/services');
const alipayConfig = require('../config/alipay');

const loggedAxios = createLoggedAxios('asset-external');

const pool = db.promise();
const CLASSIFICATION_SERVICE_BASE_URL =
  process.env.CLASSIFICATION_SERVICE_BASE_URL || 'http://10.112.191.163:8007';
const LOCAL_BACK_BASE_URL =
  process.env.LOCAL_BACK_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3007}`;
const DATA_CATALOG_BASE_URL =
  process.env.DATA_CATALOG_BASE_URL || 'http://127.0.0.1:8008';
const DATA_CATALOG_PLATFORM_NAME =
  process.env.DATA_CATALOG_PLATFORM_NAME || '数字资产交易平台';
const DATA_CATALOG_PLATFORM_DID =
  process.env.DATA_CATALOG_PLATFORM_DID || 'did:web:data.web';
const DATA_CATALOG_PLATFORM_URL =
  process.env.DATA_CATALOG_PLATFORM_URL || 'http://10.112.191.163';
const DATA_CATALOG_ORG_DID =
  process.env.DATA_CATALOG_ORG_DID || 'did:web:data.web';
const OMNIPRINT_BASE = {
  text: services.omniprint.text,
  image: services.omniprint.image,
  audio: services.omniprint.audio,
  video: services.omniprint.video,
};
const ALLOWED_DELIVERY_METHODS = new Set(['HE', 'PRE', 'FL', 'MPC']);

const toBase64Picture = (buffer) => {
  if (!buffer) return null;
  if (Buffer.isBuffer(buffer)) return buffer.toString('base64');
  if (buffer instanceof Uint8Array) return Buffer.from(buffer).toString('base64');
  return null;
};

const mapHashAlgorithm = (algorithm = 'SHA2_256') => {
  const upper = String(algorithm || '').toUpperCase();
  if (upper === 'SHA3_256') return 'sha3-256';
  return 'sha256';
};

const hashFileBuffer = (buffer, algorithm = 'SHA2_256') => {
  if (!buffer) {
    throw new Error('源文件上传失败');
  }
  const hash = crypto.createHash(mapHashAlgorithm(algorithm));
  hash.update(buffer);
  return hash.digest('hex');
};

const formatDatePart = (value) => String(value).padStart(2, '0');

const normalizeExpirationTime = (value) => {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('权限过期时间格式不正确');
    return [
      value.getFullYear(),
      formatDatePart(value.getMonth() + 1),
      formatDatePart(value.getDate()),
    ].join('-') + ' ' + [
      formatDatePart(value.getHours()),
      formatDatePart(value.getMinutes()),
      formatDatePart(value.getSeconds()),
    ].join(':');
  }

  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) throw new Error('权限过期时间格式不正确');
  return [
    parsed.getFullYear(),
    formatDatePart(parsed.getMonth() + 1),
    formatDatePart(parsed.getDate()),
  ].join('-') + ' ' + [
    formatDatePart(parsed.getHours()),
    formatDatePart(parsed.getMinutes()),
    formatDatePart(parsed.getSeconds()),
  ].join(':');
};

const detectOmniPrintType = (file) => {
  const mime = String(file?.mimetype || '');
  const name = String(file?.originalname || '');

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';

  if (/\.(png|jpg|jpeg|bmp|webp)$/i.test(name)) return 'image';
  if (/\.(mp3|wav|flac|m4a)$/i.test(name)) return 'audio';
  if (/\.(mp4|avi|mov|mkv)$/i.test(name)) return 'video';

  return 'text';
};

const resolveOwnerAddressByCertificate = async (certificateName, orgName) => {
  if (!certificateName || !orgName) return '';
  const result = await certificateService.resolveOwnerAddressByCertificate(certificateName, orgName);
  return String(result?.owner_address || '').trim();
};

const configureChainCertificate = async (certificateName, orgName) => {
  const clientName = String(certificateName || '').trim();
  const rawOrgName = String(orgName || 'wx-org1.chainmaker.org').trim();
  const normalizedOrgName = rawOrgName.endsWith('.chainmaker.org')
    ? rawOrgName
    : `${rawOrgName}.chainmaker.org`;
  if (!clientName) {
    throw new Error('缺少上链证书名称，无法配置 GoSDK 证书');
  }
  console.log('[asset][configureChainCertificate]', {
    clientName,
    orgName: normalizedOrgName,
  });
  const result = await chainClient.dynamicCertConfig(clientName, normalizedOrgName);
  if (
    result &&
    Object.prototype.hasOwnProperty.call(result, 'code') &&
    Number(result.code) !== 0
  ) {
    throw new Error(
      `${result.message || `GoSDK 动态证书配置失败：${clientName}`} ` +
      `(certificate=${clientName}, org=${normalizedOrgName})`,
    );
  }
  return result;
};

const getDefaultRegisterCertInfoByUserId = async (userId) => {
  if (!userId) return null;
  try {
    return await certificateService.getDefaultRegisterCertInfo(userId);
  } catch (_error) {
    return null;
  }
};

const getDefaultTradeCertInfoByUserId = async (userId) => {
  if (!userId) return null;
  try {
    return await certificateService.getDefaultTradeCertInfo(userId);
  } catch (_error) {
    return null;
  }
};

const derivePublishStatusFromAsset = (assetStatus, remainingQty, fallbackStatus = 0) => {
  const normalizedAssetStatus = Number(assetStatus);
  const normalizedRemainingQty = Number(remainingQty || 0);
  if (normalizedRemainingQty <= 0) return 2;
  if (normalizedAssetStatus === 1) return 1;
  if (normalizedAssetStatus === 0) return 0;
  if (normalizedAssetStatus === 2) return 2;
  return Number(fallbackStatus || 0);
};

const requireDeliveryMethod = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!ALLOWED_DELIVERY_METHODS.has(normalized)) {
    throw new Error('交付方式仅支持 HE、PRE、FL、MPC');
  }
  return normalized;
};

const syncOrderBuyerAddress = async (conn, orderNo, buyerAddress) => {
  const normalizedBuyerAddress = String(buyerAddress || '').trim();
  if (!orderNo || !normalizedBuyerAddress) {
    throw new Error('买家证书地址不能为空');
  }

  await conn.query(
    `
      UPDATE asset_order
      SET buyer_address = ?
      WHERE order_no = ?
    `,
    [normalizedBuyerAddress, orderNo],
  );

  await conn.query(
    `
      UPDATE transactions
      SET buyer_address = ?,
          updated_at = NOW()
      WHERE order_no = ?
    `,
    [normalizedBuyerAddress, orderNo],
  );

  await conn.query(
    `
      UPDATE digital_contracts
      SET buyer_address = ?,
          updated_at = NOW()
      WHERE order_no = ?
    `,
    [normalizedBuyerAddress, orderNo],
  );

  await conn.query(
    `
      UPDATE delivery_requests
      SET buyer_address = ?,
          updated_at = NOW()
      WHERE order_no = ?
    `,
    [normalizedBuyerAddress, orderNo],
  );

  await conn.query(
    `
      UPDATE delivery_records
      SET buyer_address = ?
      WHERE order_no = ?
    `,
    [normalizedBuyerAddress, orderNo],
  );
};

const fetchRemoteJson = async (url, options = {}) => {
  if (typeof fetch !== 'function') {
    throw new Error('当前 Node 版本不支持 fetch');
  }
  const response = await loggedFetch(url, options, 'asset-remote-json');
  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.message || rawText || `远端接口请求失败：${response.status}`);
  }
  return data;
};

const getBuyerDeliveryOrderContext = async (orderNo, buyerId) => {
  const [rows] = await pool.query(
    `
      SELECT
        ao.id,
        ao.order_no,
        ao.asset_id,
        ao.buyer_id,
        ao.buyer_address,
        ao.seller_address,
        ao.order_status,
        t.transaction_id,
        t.buyer_address AS transaction_buyer_address,
        t.seller_address AS transaction_seller_address,
        dc.pc_type,
        dr.status AS request_status
      FROM asset_order ao
      LEFT JOIN transactions t ON ao.order_no = t.order_no
      LEFT JOIN digital_contracts dc ON t.transaction_id = dc.transaction_id
      LEFT JOIN delivery_requests dr ON t.transaction_id = dr.transaction_id
      WHERE ao.order_no = ?
      ORDER BY dr.id DESC
      LIMIT 1
    `,
    [orderNo],
  );
  const order = rows[0];
  if (!order) throw new Error('订单不存在');
  if (Number(order.buyer_id) !== Number(buyerId)) throw new Error('无权限操作该订单');
  return order;
};

const getOrderStatusLabel = (status) => {
  const numericStatus = Number(status);
  if (numericStatus === 0) return '待支付';
  if (numericStatus === 1) return '待卖家交付';
  if (numericStatus === 2) return '待买家确认';
  if (numericStatus === 3) return '已完成';
  if (numericStatus === 4) return '已关闭';
  if (numericStatus === 5) return '退款中';
  if (numericStatus === 6) return '已退款';
  return '未知';
};

const normalizeTradeMode = (tradeMode) => {
  if (tradeMode === 'view' || tradeMode === 'process') return tradeMode;
  return 'ownership';
};

const getDefaultTradeModeByPermission = (permission) => {
  if (Number(permission?.can_sell_ownership) === 1) return 'ownership';
  if (Number(permission?.can_sell_view_right) === 1) return 'view';
  if (Number(permission?.can_sell_process_right) === 1) return 'process';
  return '';
};

const getChainRightTypeByTradeMode = (tradeMode) => {
  const normalized = normalizeTradeMode(tradeMode);
  if (normalized === 'view') return '查阅权';
  if (normalized === 'process') return '加工权';
  return '';
};

const formatChainExpiration = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  if (!Number.isFinite(date.getTime())) {
    throw new Error('权限过期时间格式不正确，无法写入链上权益');
  }
  return date.toISOString();
};

const normalizeChainFailReason = (error) => {
  const rawMessage = String(error?.message || 'unknown chain error');
  if (rawMessage.includes('grpc 连接不可用') || rawMessage.includes('grpc connections unavailable')) {
    return '链网关可达，但链节点 grpc 连接不可用，请在 10.112.191.163 查看 GoSDK 进程日志并检查链节点端口连通性（如 14301/14302）';
  }
  return rawMessage;
};

const mintRegisterAssetOnChain = async (registerData, userId) => {
  const tokenId = String(registerData.file_hash || '').trim();
  const defaultRegisterCert = await certificateService.resolveDefaultRegisterCertInfo(userId);

  // Mint 由平台 client1 签名，资产所属地址取当前用户的证书。
  registerData.certificate_name = defaultRegisterCert.certificate_name;
  registerData.owner_address = defaultRegisterCert.address || defaultRegisterCert.owner_address || '';
  registerData.org_name = defaultRegisterCert.org || 'wx-org1.chainmaker.org';

  const orgName = 'wx-org1.chainmaker.org';
  const categoryName = 'WH';
  const ownerAddress = String(registerData.owner_address || '').trim();
  if (!ownerAddress) {
    throw new Error('默认登记证书地址为空，请重新申请证书或检查 certificate_registry.address');
  }

  console.log('[asset][mintRegisterAssetOnChain] start', {
    userId,
    tokenId,
    ownerAddress,
    orgName,
    categoryName,
    certificateName: registerData.certificate_name,
  });

  try {
    await configureChainCertificate('client1', 'wx-org1.chainmaker.org');
    const metadata = {
      assetName: registerData.asset_name,
      assetType: registerData.asset_type || registerData.assetType || '',
      assetCategory: registerData.asset_category || registerData.classification_category_name || '',
      email: registerData.email || '',
      address: registerData.address || '',
      description: registerData.description || '',
      algorithm: registerData.algorithm || registerData.hash_algorithm || '',
      customAlgorithm: registerData.customAlgorithm || registerData.custom_algorithm || '',
      // 原始前端把封面 File 放进 JSON，序列化后对应空对象；保持字段形状一致。
      picture: registerData.picture_file ? {} : (registerData.picture || ''),
      isProxied: Boolean(registerData.is_proxied),
      number: 1,
      modelSelection: registerData.model_selection || registerData.modelSelection || '',
    };
    const allowedLocations = registerData.allowed_locations || registerData.allowedLocations;
    if (Array.isArray(allowedLocations) && allowedLocations.length > 0) {
      metadata.allowedLocations = allowedLocations;
    }

    const mintRes = await chainClient.mint({
      to: ownerAddress,
      tokenId,
      categoryName,
      metadata,
    });

    const txHash = mintRes.txid || mintRes?.data?.tx_id || mintRes.result || '';
    return {
      chain_status: 1,
      token_id: tokenId,
      owner_address: ownerAddress,
      chain_tx_hash: txHash,
      chain_result: mintRes,
    };
  } catch (error) {
    const normalizedReason = normalizeChainFailReason(error);
    console.error('[asset][mintRegisterAssetOnChain] failed', {
      tokenId,
      ownerAddress,
      orgName,
      categoryName,
      error: {
        message: error?.message,
        code: error?.code,
        data: error?.data,
        raw: error?.raw,
      },
    });
    const wrappedError = new Error(`链上登记失败：${normalizedReason}`);
    wrappedError.code = error?.code || 'CHAIN_REGISTER_FAILED';
    wrappedError.data = error?.data;
    wrappedError.raw = error?.raw;
    throw wrappedError;
  }
};

const isAdminIdentity = (identity = '') => String(identity || '').includes('管理');
const normalizeIdentityRole = (identity = '') => {
  const raw = String(identity || '').toLowerCase();
  if (raw.includes('admin') || String(identity || '').includes('管理')) return 'admin';
  if (raw.includes('seller') || String(identity || '').includes('卖')) return 'seller';
  if (raw.includes('buyer') || String(identity || '').includes('买') || String(identity || '').includes('用户')) {
    return 'buyer';
  }
  return 'buyer';
};
const isSellerIdentity = (identity = '') => normalizeIdentityRole(identity) === 'seller';
const isBuyerIdentity = (identity = '') => normalizeIdentityRole(identity) === 'buyer';

const getCategoryInfo = async (categoryId) => {
  const [rows] = await pool.query(
    'SELECT id, category_key, category_name FROM asset_category WHERE id = ? LIMIT 1',
    [categoryId],
  );
  return rows[0] || null;
};

const getCategoryByName = async (executor, categoryName) => {
  const normalizedName = String(categoryName || '').trim();
  if (!normalizedName) return null;

  const [rows] = await executor.query(
    `
      SELECT id, category_key, category_name
      FROM asset_category
      WHERE category_name = ?
      LIMIT 1
    `,
    [normalizedName],
  );
  return rows[0] || null;
};

const buildCategoryKey = (categoryName) => {
  const normalizedName = String(categoryName || '').trim();
  const hash = crypto.createHash('md5').update(normalizedName || 'category').digest('hex').slice(0, 16);
  return `cat_${hash}`;
};

const buildDataCatalogKey = (identifier) => {
  const raw = String(identifier || '').trim() || `catalog-${Date.now()}`;
  const hash = crypto.createHash('md5').update(raw).digest('hex').slice(0, 16);
  return `catalog_${hash}`;
};

const getSubCategoryInfo = async (subCategoryId) => {
  const [rows] = await pool.query(
    'SELECT id, sub_category_key, sub_category_name, category_id FROM asset_sub_category WHERE id = ? LIMIT 1',
    [subCategoryId],
  );
  return rows[0] || null;
};

const getSubCategoryByName = async (conn, categoryId, subCategoryName) => {
  const normalizedName = String(subCategoryName || '').trim();
  if (!normalizedName) return null;

  const [rows] = await conn.query(
    `
      SELECT id, sub_category_key, sub_category_name, category_id
      FROM asset_sub_category
      WHERE category_id = ? AND sub_category_name = ?
      LIMIT 1
    `,
    [categoryId, normalizedName],
  );
  return rows[0] || null;
};

const buildSubCategoryKey = (categoryKey, subCategoryName) => {
  const rawKey = `${String(categoryKey || 'category').trim()}::${String(subCategoryName || 'custom').trim()}`;
  const hash = crypto.createHash('md5').update(rawKey).digest('hex').slice(0, 16);
  return `sub_${hash}`;
};

const resolveCategoryAndSubCategory = async (conn, registerData, { allowCreateSubCategory = false } = {}) => {
  const normalizedClassificationName = String(registerData.classification_category_name || '').trim();

  let category = null;
  if (normalizedClassificationName) {
    category = await getCategoryByName(conn, normalizedClassificationName);
    if (!category) {
      const categoryKey = buildCategoryKey(normalizedClassificationName);
      try {
        await conn.query(
          `
            INSERT INTO asset_category
              (category_key, category_name, category_desc, sort_order)
            VALUES
              (?, ?, ?, 999)
          `,
          [categoryKey, normalizedClassificationName, `由分类分级结果自动生成：${normalizedClassificationName}`],
        );
      } catch (error) {
        if (error?.code !== 'ER_DUP_ENTRY') {
          throw error;
        }
      }
      category = await getCategoryByName(conn, normalizedClassificationName);
    }
  } else if (registerData.category_id) {
    category = await getCategoryInfo(registerData.category_id);
  }

  if (!category) throw new Error('数据产品类型不存在');
  registerData.category_id = Number(category.id);
  registerData.classification_category_name = normalizedClassificationName || category.category_name;

  let subCategory = null;
  if (registerData.sub_category_id) {
    subCategory = await getSubCategoryInfo(registerData.sub_category_id);
    if (!subCategory) throw new Error('数据产品方向不存在');
    if (Number(subCategory.category_id) !== Number(category.id)) {
      throw new Error('该方向不属于当前数据产品类型');
    }
    return { category, subCategory };
  }

  const customSubCategoryName = String(
    registerData.sub_category_name || registerData.custom_sub_category_name || '',
  ).trim();
  if (!customSubCategoryName) {
    return { category, subCategory: null };
  }

  subCategory = await getSubCategoryByName(conn, category.id, customSubCategoryName);
  if (!subCategory && allowCreateSubCategory) {
    const subCategoryKey = buildSubCategoryKey(category.category_key, customSubCategoryName);
    try {
      const [insertResult] = await conn.query(
        `
          INSERT INTO asset_sub_category
            (sub_category_key, sub_category_name, sub_category_desc, category_id, sort_order)
          VALUES
            (?, ?, ?, ?, 0)
        `,
        [
          subCategoryKey,
          customSubCategoryName,
          `用户自定义方向：${customSubCategoryName}`,
          category.id,
        ],
      );
      subCategory = {
        id: insertResult.insertId,
        sub_category_key: subCategoryKey,
        sub_category_name: customSubCategoryName,
        category_id: category.id,
      };
    } catch (error) {
      if (error?.code !== 'ER_DUP_ENTRY') {
        throw error;
      }
      subCategory = await getSubCategoryByName(conn, category.id, customSubCategoryName);
    }
  }

  if (!subCategory) {
    throw new Error('数据产品方向不存在');
  }

  return { category, subCategory };
};

const getRegionInfo = async (regionId) => {
  const [rows] = await pool.query(
    'SELECT id, region_key, region_name FROM region WHERE id = ? LIMIT 1',
    [regionId],
  );
  return rows[0] || null;
};

const CLASSIFICATION_DATA_LEVELS = [
  '核心数据',
  '重要数据',
  '一般数据',
  '高风险数据',
  '中风险数据',
  '低风险数据',
  '敏感数据',
  '非敏感数据',
];

const PRESET_ASSET_CATEGORIES = [
  { category_key: 'crypto_stablecoin', category_name: '加密货币与稳定币', category_desc: '预置数据产品类型：加密货币与稳定币', sort_order: 1 },
  { category_key: 'cbdc', category_name: '央行数字货币', category_desc: '预置数据产品类型：央行数字货币', sort_order: 2 },
  { category_key: 'digital_content_ip', category_name: '数字内容和知识产权', category_desc: '预置数据产品类型：数字内容和知识产权', sort_order: 3 },
  { category_key: 'account_identity_asset', category_name: '账户与身份型虚拟资产', category_desc: '预置数据产品类型：账户与身份型虚拟资产', sort_order: 4 },
  { category_key: 'data_asset', category_name: '数据资产', category_desc: '预置数据产品类型：数据资产', sort_order: 5 },
  { category_key: 'digital_certificate', category_name: '数字化凭证', category_desc: '预置数据产品类型：数字化凭证', sort_order: 6 },
  { category_key: 'digital_security_asset', category_name: '数字证券资产', category_desc: '预置数据产品类型：数字证券资产', sort_order: 7 },
];

const ensurePresetAssetCategories = async () => {
  await Promise.all(PRESET_ASSET_CATEGORIES.map((item) => pool.query(
    `
      INSERT INTO asset_category
        (category_key, category_name, category_desc, sort_order)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        category_name = VALUES(category_name),
        category_desc = VALUES(category_desc),
        sort_order = VALUES(sort_order)
    `,
    [item.category_key, item.category_name, item.category_desc, item.sort_order],
  )));
};

exports.getAssetMeta = async () => {
  await ensurePresetAssetCategories();

  const [categoryRows] = await pool.query(
    `
      SELECT
        id,
        category_key,
        category_name,
        category_desc,
        sort_order
      FROM asset_category
      ORDER BY sort_order ASC, id ASC
    `,
  );

  const [subCategoryRows] = await pool.query(
    `
      SELECT
        id,
        sub_category_key,
        sub_category_name,
        sub_category_desc,
        category_id,
        sort_order
      FROM asset_sub_category
      ORDER BY category_id ASC, sort_order ASC, id ASC
    `,
  );

  const [regionRows] = await pool.query(
    `
      SELECT
        id,
        region_key,
        region_name,
        province,
        city,
        sort_order
      FROM region
      ORDER BY sort_order ASC, id ASC
    `,
  );

  const [classificationCategoryRows] = await pool.query(
    `
      SELECT DISTINCT classification_category_name
      FROM digital_asset
      WHERE TRIM(IFNULL(classification_category_name, '')) <> ''
      ORDER BY classification_category_name ASC
    `,
  );

  const subCategoryMap = subCategoryRows.reduce((acc, item) => {
    const key = Number(item.category_id || 0);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return {
    categories: categoryRows.map((item) => ({
      ...item,
      sub_categories: subCategoryMap[Number(item.id)] || [],
    })),
    regions: regionRows,
    classification_categories: classificationCategoryRows
      .map((item) => String(item.classification_category_name || '').trim())
      .filter(Boolean),
    classification_data_levels: CLASSIFICATION_DATA_LEVELS,
  };
};

exports.createSubCategory = async ({ category_id, sub_category_name, sub_category_desc = '' }, userId, identity = '') => {
  if (!isSellerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅卖家可新增数据产品方向');
  }

  const normalizedCategoryId = Number(category_id || 0);
  const normalizedName = String(sub_category_name || '').trim();
  const normalizedDesc = String(sub_category_desc || '').trim();

  if (!normalizedCategoryId) throw new Error('缺少数据产品类型');
  if (!normalizedName) throw new Error('方向名称不能为空');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const category = await getCategoryInfo(normalizedCategoryId);
    if (!category) throw new Error('数据产品类型不存在');

    const existed = await getSubCategoryByName(conn, normalizedCategoryId, normalizedName);
    if (existed) {
      await conn.commit();
      return existed;
    }

    const subCategoryKey = buildSubCategoryKey(category.category_key, normalizedName);
    const [dupKeyRows] = await conn.query(
      'SELECT id FROM asset_sub_category WHERE sub_category_key = ? LIMIT 1',
      [subCategoryKey],
    );
    const finalKey = dupKeyRows.length ? `${subCategoryKey}_${userId}` : subCategoryKey;

    const [insertResult] = await conn.query(
      `
        INSERT INTO asset_sub_category
          (sub_category_key, sub_category_name, sub_category_desc, category_id, sort_order)
        VALUES
          (?, ?, ?, ?, 0)
      `,
      [finalKey, normalizedName, normalizedDesc || `用户自定义子类：${normalizedName}`, normalizedCategoryId],
    );

    const created = await getSubCategoryInfo(insertResult.insertId);
    await conn.commit();
    return created;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const generateOrderNo = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const randomPart = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `OD${datePart}${timePart}${randomPart}`;
};

const generateValuationRecordNo = () => {
  const now = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `VR${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}${pad(now.getSeconds())}${pad(Math.floor(Math.random() * 1000), 3)}`;
};

const normalizeRegisterPayload = (payload = {}) => {
  const classificationDataLevel = String(
    payload.classification_data_level || payload.classificationDataLevel || payload.assetgrade || payload.assetGrade || '',
  ).trim() || '';
  const classificationCategoryName = String(
    payload.classification_category_name || payload.classificationCategoryName || '',
  ).trim();
  const normalized = {
    ...payload,
    asset_name: payload.asset_name || payload.assetName || '',
    brief: payload.brief || '',
    description: payload.description || '',
    price_unit: payload.price_unit || '人民币',
    file_hash: payload.file_hash || payload.fileHash || '',
    hash_algorithm: payload.hash_algorithm || payload.algorithm || 'SHA2_256',
    certificate_name: payload.certificate_name || payload.selectedCertificate || '',
    owner_address: payload.owner_address || payload.certAddr || '',
    is_proxied:
      payload.is_proxied !== undefined
        ? Number(payload.is_proxied)
        : payload.isProxied
          ? 1
          : 0,
    can_sell_ownership:
      payload.can_sell_ownership !== undefined
        ? Number(payload.can_sell_ownership)
        : payload.can_sell_asset
          ? 1
          : 0,
    can_sell_view_right:
      payload.can_sell_view_right !== undefined
        ? Number(payload.can_sell_view_right)
        : payload.can_sell_view
          ? 1
          : 0,
    can_sell_process_right:
      payload.can_sell_process_right !== undefined
        ? Number(payload.can_sell_process_right)
        : payload.can_sell_process
          ? 1
          : 0,
    classification_category_name: classificationCategoryName,
    classification_data_level: classificationDataLevel,
    pc_type: requireDeliveryMethod(payload.pc_type || payload.pcType || 'HE'),
    pricing_mode: String(payload.pricing_mode || payload.pricingMode || 'fixed').trim().toLowerCase() === 'auction'
      ? 'auction'
      : 'fixed',
    auction_start_price: payload.auction_start_price ?? payload.auctionStartPrice ?? payload.price ?? 0,
    auction_end_time: payload.auction_end_time ?? payload.auctionEndTime ?? null,
    omniprint_fingerprint: String(payload.omniprint_fingerprint || payload.omniprintFingerprint || '').trim(),
    omniprint_fingerprint_bits: Number(payload.omniprint_fingerprint_bits || payload.fingerprint_bits || 0) || null,
    omniprint_modality: String(payload.omniprint_modality || payload.omniprintModality || '').trim().toLowerCase(),
    omniprint_source: String(payload.omniprint_source || '').trim(),
    sub_category_name: String(
      payload.sub_category_name || payload.subCategoryName || payload.custom_sub_category_name || '',
    ).trim(),
    allow_resale: payload.allow_resale !== undefined ? Number(payload.allow_resale) : 0,
    status: payload.status !== undefined ? Number(payload.status) : 0,
  };

  normalized.picture_file = payload.picture_file || null;
  normalized.picture_mime_type =
    payload.picture_mime_type || payload.pictureMimeType || payload.picture_file?.mimetype || '';
  normalized.picture = payload.picture || '';

  // 自动驾驶资产统一按不可分割处理
  normalized.is_divisible = 0;
  normalized.total_qty = 1;
  normalized.available_qty = 1;

  return normalized;
};

exports.generateFileHash = async (file, algorithm = 'SHA2_256') => {
  if (!file?.buffer) {
    throw new Error('源文件上传失败');
  }
  const fileHash = hashFileBuffer(file.buffer, algorithm);
  return {
    hash: fileHash,
    file_hash: fileHash,
    algorithm: String(algorithm || 'SHA2_256').toUpperCase(),
    file_size: Number(file.size || 0),
    file_format: String(file.originalname || '').includes('.')
      ? String(file.originalname).split('.').pop().toLowerCase()
      : '',
    file_name: file.originalname || '',
  };
};

exports.generateFileFingerprint = async (file, assetId = '') => {
  if (!file?.buffer) {
    throw new Error('源文件上传失败');
  }

  const type = detectOmniPrintType(file);
  const originalName = String(file.originalname || 'asset.bin');
  const payload = {
    asset_id: String(assetId || `asset-${Date.now()}`),
    save_output: false,
  };

  let remoteResp;
  let tempPath = '';
  try {
    if (type === 'text') {
      payload.text = file.buffer.toString('utf8');
    } else {
      const tempDir = '/tmp/omniprint_uploads';
      const fs = require('fs/promises');
      const path = require('path');
      await fs.mkdir(tempDir, { recursive: true });
      const safeName = originalName.replace(/[^A-Za-z0-9._-]/g, '_');
      tempPath = path.join(tempDir, `${Date.now()}_${safeName}`);
      await fs.writeFile(tempPath, file.buffer);

      if (type === 'image') payload.image_path = tempPath;
      if (type === 'audio') payload.audio_path = tempPath;
      if (type === 'video') payload.video_path = tempPath;
    }

    remoteResp = await loggedAxios.post(
      `${OMNIPRINT_BASE[type]}/fingerprint`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 300000,
        validateStatus: () => true,
      },
    );
  } catch (error) {
    throw new Error(`数字指纹服务调用失败：${error?.message || 'unknown error'}`);
  } finally {
    if (tempPath) {
      const fs = require('fs/promises');
      fs.unlink(tempPath).catch(() => {});
    }
  }

  if (remoteResp.status === 409) {
    const error = new Error('发现相似资产，未生成新数字指纹');
    error.statusCode = 409;
    error.data = remoteResp.data;
    throw error;
  }

  if (remoteResp.status < 200 || remoteResp.status >= 300) {
    const remoteMessage =
      remoteResp.data?.message ||
      remoteResp.data?.error ||
      remoteResp.data?.detail ||
      '';
    const error = new Error(
      remoteMessage
        ? `OmniPrint ${type} 指纹生成失败：${remoteMessage}`
        : `OmniPrint ${type} 指纹生成失败`,
    );
    error.statusCode = remoteResp.status;
    error.data = remoteResp.data;
    throw error;
  }

  const data = remoteResp.data || {};
  if (!data?.fingerprint) {
    throw new Error('数字指纹服务未返回 fingerprint');
  }

  const rawFingerprint = String(data.fingerprint || '').trim();
  const sanitizedFingerprint = rawFingerprint.replace(/[^A-Za-z0-9_.]/g, '');
  const fileHash = sanitizedFingerprint && sanitizedFingerprint.length <= 128
    ? sanitizedFingerprint
    : crypto.createHash('sha256').update(rawFingerprint).digest('hex');

  return {
    success: true,
    hash: fileHash,
    file_hash: fileHash,
    algorithm: 'FINGERPRINT',
    file_size: Number(file.size || 0),
    file_format: originalName.includes('.')
      ? originalName.split('.').pop().toLowerCase()
      : '',
    file_name: originalName,
    fingerprint: rawFingerprint,
    fingerprint_bits: Number(data.fingerprint_bits || 0) || null,
    type,
    raw: data,
  };
};

exports.checkOmniPrintSimilarity = async ({
  fingerprint,
  fingerprint_bits,
  modality,
}) => {
  const rawFingerprint = String(fingerprint || '').trim();
  const normalizedModality = String(modality || '').trim().toLowerCase();
  const bits = Number(fingerprint_bits || 0);

  if (!rawFingerprint) throw new Error('缺少 OmniPrint 原始指纹');
  if (!['text', 'image', 'audio', 'video'].includes(normalizedModality)) {
    throw new Error('OmniPrint 模态仅支持 text、image、audio、video');
  }
  if (!Number.isInteger(bits) || bits <= 0) {
    throw new Error('OmniPrint 指纹位数不正确');
  }

  const [assets] = await pool.query(
    `
      SELECT id, file_hash, asset_name, omniprint_fingerprint, omniprint_source
      FROM digital_asset
      WHERE omniprint_modality = ?
        AND omniprint_fingerprint_bits = ?
        AND omniprint_fingerprint IS NOT NULL
        AND omniprint_fingerprint <> ''
    `,
    [normalizedModality, bits],
  );

  const comparisons = [];
  await Promise.all(assets.map(async (asset) => {
    const response = await loggedAxios.post(
      `${OMNIPRINT_BASE[normalizedModality]}/compare`,
      {
        fingerprint_a: rawFingerprint,
        fingerprint_b: asset.omniprint_fingerprint,
        fingerprint_bits: bits,
        asset_id_b: asset.file_hash,
      },
      { timeout: 15000 },
    );
    comparisons.push({
      file_hash: asset.file_hash,
      asset_name: asset.asset_name,
      source: asset.omniprint_source,
      ...response.data,
    });
  }));

  comparisons.sort((a, b) => Number(b.bit_similarity || 0) - Number(a.bit_similarity || 0));
  return {
    success: true,
    comparedCount: comparisons.length,
    matches: comparisons,
  };
};

exports.classifyAssetText = async (text, methodName) => {
  const normalizedText = String(text || '').trim();
  const normalizedMethodName = String(methodName || '').trim();
  if (!normalizedText) {
    throw new Error('分类文本不能为空');
  }
  if (!normalizedMethodName) {
    throw new Error('分类分级方法不能为空');
  }

  if (typeof fetch !== 'function') {
    throw new Error('当前 Node 版本不支持 fetch，无法调用分类服务');
  }

  const response = await loggedFetch(`${CLASSIFICATION_SERVICE_BASE_URL}/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method_name: normalizedMethodName,
      text: normalizedText,
    }),
  });

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || rawText || `分类服务请求失败：${response.status}`);
  }

  const categoryName =
    data?.['分类结果'] ||
    data?.category_name ||
    data?.categoryName ||
    data?.classification ||
    data?.category ||
    '';
  const dataLevel =
    data?.['分级结果'] ||
    data?.data_level ||
    data?.dataLevel ||
    data?.grade ||
    data?.level ||
    '';

  return {
    method_name: normalizedMethodName,
    category_name: String(categoryName || '').trim(),
    data_level: String(dataLevel || '').trim(),
    raw: data,
  };
};

exports.saveAssetValuationRecord = async (payload = {}, operator = {}) => {
  const recordNo = generateValuationRecordNo();
  const assetId = payload.asset_id ? Number(payload.asset_id) : null;
  const fileHash = String(payload.fileHash || '').trim();
  const assetName = String(payload.assetName || '').trim();
  const methodKey = String(payload.methodKey || '').trim();
  const methodName = String(payload.methodName || '').trim();
  const rawFinalValuation = payload.finalValuation;
  const finalValuation =
    rawFinalValuation === null || rawFinalValuation === undefined || rawFinalValuation === ''
      ? null
      : Number(rawFinalValuation);
  const valuationUnit = String(payload.valuationUnit || '万元').trim() || '万元';
  const calcStatus = Number(payload.calcStatus ?? 1);
  const statusMessage = String(payload.statusMessage || '').trim();
  const inputSnapshot = payload.inputSnapshot || {};
  const resultSnapshot = payload.resultSnapshot || {};
  const createdByUserId = operator.userId ? Number(operator.userId) : null;
  const createdByUsername = String(operator.username || payload.createdByUsername || '').trim();

  if (!methodKey || !methodName) {
    throw new Error('估值方法不能为空');
  }
  if (finalValuation !== null && !Number.isFinite(finalValuation)) {
    throw new Error('估值结果必须为数字');
  }
  if (!fileHash && !assetId) {
    throw new Error('缺少资产标识，无法保存估值记录');
  }

  const [result] = await pool.query(
    `
      INSERT INTO asset_valuation_record
        (
          record_no, asset_id, file_hash, asset_name,
          method_key, method_name, final_valuation, valuation_unit,
          calc_status, status_message, input_snapshot, result_snapshot,
          created_by_user_id, created_by_username
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      recordNo,
      assetId,
      fileHash,
      assetName,
      methodKey,
      methodName,
      finalValuation,
      valuationUnit,
      calcStatus,
      statusMessage,
      JSON.stringify(inputSnapshot),
      JSON.stringify(resultSnapshot),
      createdByUserId,
      createdByUsername,
    ],
  );

  return {
    id: result.insertId,
    record_no: recordNo,
  };
};

exports.createAsset = async (assetData, userId, identity = '') => {
  if (!isSellerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅卖家可登记资产');
  }

  const registerData = normalizeRegisterPayload(assetData);
  registerData.status = 0;

  const defaultRegisterCert = await certificateService.resolveDefaultRegisterCertInfo(userId);
  registerData.certificate_name = defaultRegisterCert.certificate_name;
  registerData.owner_address = defaultRegisterCert.address || defaultRegisterCert.owner_address || '';
  registerData.org_name = 'wx-org1.chainmaker.org';

  if (!registerData.owner_address) {
    throw new Error('默认登记证书地址为空，请重新申请证书或检查 certificate_registry.address');
  }

  if (!String(registerData.classification_category_name || '').trim()) {
    throw new Error('请先执行分类分级，确定数据产品类型');
  }
  if (registerData.hash_algorithm === 'FINGERPRINT') {
    if (!registerData.omniprint_fingerprint || !registerData.omniprint_fingerprint_bits) {
      throw new Error('请重新选择源文件生成 OmniPrint 数字指纹');
    }
    if (!['text', 'image', 'audio', 'video'].includes(registerData.omniprint_modality)) {
      throw new Error('OmniPrint 指纹模态不正确');
    }
    registerData.omniprint_source = 'file';
  } else {
    registerData.omniprint_fingerprint = null;
    registerData.omniprint_fingerprint_bits = null;
    registerData.omniprint_modality = null;
    registerData.omniprint_source = null;
  }

  if (registerData.pricing_mode === 'auction') {
    const startPrice = Number(registerData.auction_start_price || registerData.price || 0);
    const endTime = new Date(String(registerData.auction_end_time || '').replace(' ', 'T'));
    if (!Number.isInteger(startPrice) || startPrice <= 0) {
      throw new Error('拍卖起拍价必须为正整数');
    }
    if (!Number.isFinite(endTime.getTime()) || endTime.getTime() <= Date.now() + 60 * 1000) {
      throw new Error('拍卖截止时间至少应晚于当前时间 1 分钟');
    }
    registerData.price = startPrice;
    registerData.auction_start_price = startPrice;
    registerData.auction_end_time = normalizeExpirationTime(registerData.auction_end_time);
  }

  const [dupRows] = await pool.query(
    'SELECT id FROM digital_asset WHERE file_hash = ? LIMIT 1',
    [registerData.file_hash],
  );
  if (dupRows.length) {
    throw new Error('资产已存在，file_hash 重复');
  }

  const region = await getRegionInfo(registerData.region_id);
  if (!region) throw new Error('地区不存在');

  if (registerData.available_qty > registerData.total_qty) {
    throw new Error('available_qty 不能大于 total_qty');
  }

  const shouldPublishOnRegister = Number(registerData.publish_on_register || 0) === 1;
  const defaultTradeCert = await getDefaultTradeCertInfoByUserId(userId);
  const sellerCertificateName =
    String(defaultTradeCert?.certificate_name || defaultTradeCert?.cert || '').trim() || null;
  const sellerAddress =
    String(defaultTradeCert?.owner_address || defaultTradeCert?.address || '').trim() || null;
  if (shouldPublishOnRegister && (!sellerCertificateName || !sellerAddress)) {
    throw new Error('请先在个人中心设置默认交易证书后再登记上架');
  }

  if (!registerData.sub_category_id && !registerData.sub_category_name) {
    const [columns] = await pool.query("SHOW COLUMNS FROM digital_asset LIKE 'sub_category_id'");
    if (columns[0]?.Null !== 'YES') {
      throw new Error('数据库尚未支持空产品方向，请先执行 sql/20261017_optional_asset_sub_category.sql');
    }
  }

  const chainResult = await mintRegisterAssetOnChain(registerData, userId);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { category, subCategory } = await resolveCategoryAndSubCategory(conn, registerData, {
      allowCreateSubCategory: true,
    });

    registerData.category_id = category.id;
    registerData.sub_category_id = subCategory?.id || null;

    const initialAssetStatus = shouldPublishOnRegister ? 1 : 0;
    const initialAvailableQty = shouldPublishOnRegister ? 0 : registerData.available_qty;
    const initialPublishQty = shouldPublishOnRegister ? registerData.total_qty : 0;
    const initialRemainingQty = shouldPublishOnRegister ? registerData.total_qty : 0;
    const initialPublishStatus = shouldPublishOnRegister ? 1 : 0;

    const insertAssetSql = `
      INSERT INTO digital_asset (
        asset_name, brief, description, classification_category_name, classification_data_level,
        category_id, category_key,
        sub_category_id, sub_category_key,
        region_id, region_key,
        file_hash, hash_algorithm, picture, picture_mime_type, cover_image_url, file_size, file_format,
        omniprint_fingerprint, omniprint_fingerprint_bits, omniprint_modality, omniprint_source, omniprint_generated_at,
        price, price_unit, total_qty, available_qty, is_divisible, pc_type,
        can_sell_ownership, can_sell_view_right, can_sell_process_right,
        allow_resale, is_proxied, is_third_party,
        trade_region,
        collect_time_start, collect_time_end, collect_location, sensor_type, data_volume,
        user_id, certificate_name, status
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `;

    const insertAssetParams = [
      registerData.asset_name,
      registerData.brief,
      registerData.description,
      registerData.classification_category_name,
      registerData.classification_data_level,
      registerData.category_id,
      category.category_key,
      registerData.sub_category_id,
      subCategory?.sub_category_key || '',
      registerData.region_id,
      region.region_key,
      registerData.file_hash,
      registerData.hash_algorithm,
      registerData.picture_file?.buffer || null,
      registerData.picture_mime_type || null,
      '',
      registerData.file_size,
      registerData.file_format,
      registerData.omniprint_fingerprint,
      registerData.omniprint_fingerprint_bits,
      registerData.omniprint_modality,
      registerData.omniprint_source,
      registerData.omniprint_fingerprint ? new Date() : null,
      registerData.price,
      registerData.price_unit,
      registerData.total_qty,
      initialAvailableQty,
      registerData.is_divisible,
      registerData.pc_type,
      registerData.can_sell_ownership,
      registerData.can_sell_view_right,
      registerData.can_sell_process_right,
      registerData.allow_resale,
      registerData.is_proxied,
      registerData.is_third_party,
      registerData.trade_region,
      registerData.collect_time_start,
      registerData.collect_time_end,
      registerData.collect_location,
      registerData.sensor_type,
      registerData.data_volume,
      userId,
      registerData.certificate_name,
      initialAssetStatus,
    ];

    const [insertResult] = await conn.query(insertAssetSql, insertAssetParams);
    const assetId = insertResult.insertId;

    await conn.query(
      `
        INSERT INTO asset_chain_info (
          asset_id,
          token_id,
          owner_address,
          chain_tx_hash,
          chain_status,
          chain_time,
          last_sync_time,
          fail_reason
        ) VALUES (?, ?, ?, ?, 1, NOW(), NOW(), NULL)
      `,
      [
        assetId,
        chainResult.token_id,
        chainResult.owner_address,
        chainResult.chain_tx_hash,
      ],
    );

    await conn.query(
      `
        INSERT INTO asset_publish_record (
          asset_id,
          publisher_id,
          seller_certificate_name,
          seller_address,
          publish_price,
          publish_qty,
          remaining_qty,
          sold_qty_total,
          publish_status,
          pricing_mode,
          auction_start_price,
          auction_current_price,
          auction_end_time,
          auction_bid_count,
          auction_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, ?)
      `,
      [
        assetId,
        userId,
        sellerCertificateName,
        sellerAddress,
        Number(registerData.price || 0),
        initialPublishQty,
        initialRemainingQty,
        initialPublishStatus,
        registerData.pricing_mode,
        registerData.pricing_mode === 'auction' ? Number(registerData.auction_start_price) : null,
        registerData.pricing_mode === 'auction' ? Number(registerData.auction_start_price) : null,
        registerData.pricing_mode === 'auction' ? registerData.auction_end_time : null,
        registerData.pricing_mode === 'auction' ? (shouldPublishOnRegister ? 'OPEN' : null) : null,
      ],
    );

    await conn.commit();
    return { assetId, chain: chainResult };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.registerAssetOnChain = async (assetId, userId, assetData) => {
  const registerData = normalizeRegisterPayload(assetData);

  const [rows] = await pool.query(
    `
      SELECT
        da.id,
        da.asset_name,
        da.file_hash,
        da.hash_algorithm,
        da.description,
        da.category_key,
        da.sub_category_key,
        da.region_key,
        aci.owner_address,
        aci.token_id,
        aci.chain_status
      FROM digital_asset da
      LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
      WHERE da.id = ?
      LIMIT 1
    `,
    [assetId],
  );

  const asset = rows[0];
  if (!asset) throw new Error('资产不存在，无法执行上链');

  const tokenId = String(asset.file_hash || '').trim();
  const defaultRegisterCert = await certificateService.resolveDefaultRegisterCertInfo(userId);
  const orgName = 'wx-org1.chainmaker.org';
  const categoryName = 'WH';
  const ownerAddress = String(
    defaultRegisterCert.address || defaultRegisterCert.owner_address || '',
  ).trim();
  if (!ownerAddress) {
    throw new Error('默认登记证书地址为空，请重新申请证书或检查 certificate_registry.address');
  }

  console.log('[asset][registerAssetOnChain] start', {
    assetId,
    userId,
    tokenId,
    ownerAddress,
    orgName,
    categoryName,
    certificateName: registerData.certificate_name,
  });

  try {
    await configureChainCertificate('client1', 'wx-org1.chainmaker.org');
    const metadata = {
      assetName: registerData.asset_name || asset.asset_name,
      assetType: registerData.asset_type || registerData.assetType || '',
      assetCategory: registerData.asset_category || registerData.classification_category_name || '',
      email: registerData.email || '',
      address: registerData.address || '',
      description: registerData.description || asset.description || '',
      algorithm: registerData.algorithm || registerData.hash_algorithm || asset.hash_algorithm || '',
      customAlgorithm: registerData.customAlgorithm || registerData.custom_algorithm || '',
      picture: registerData.picture_file ? {} : (registerData.picture || ''),
      isProxied: Boolean(registerData.is_proxied),
      number: 1,
      modelSelection: registerData.model_selection || registerData.modelSelection || '',
    };
    const allowedLocations = registerData.allowed_locations || registerData.allowedLocations;
    if (Array.isArray(allowedLocations) && allowedLocations.length > 0) {
      metadata.allowedLocations = allowedLocations;
    }

    const mintRes = await chainClient.mint({
      to: ownerAddress,
      tokenId,
      categoryName,
      metadata,
    });

    console.log('[asset][registerAssetOnChain] mint response', {
      assetId,
      tokenId,
      mintRes,
    });

    const txHash = mintRes.txid || mintRes?.data?.tx_id || mintRes.result || '';

    await pool.query(
      `
        UPDATE asset_chain_info
        SET token_id = ?, owner_address = ?, chain_tx_hash = ?, chain_status = 1,
            chain_time = NOW(), last_sync_time = NOW(), fail_reason = NULL
        WHERE asset_id = ?
      `,
      [tokenId, ownerAddress, txHash, assetId],
    );

    return {
      chain_status: 1,
      token_id: tokenId,
      owner_address: ownerAddress,
      chain_tx_hash: txHash,
      chain_result: mintRes,
    };
  } catch (error) {
    const normalizedReason = normalizeChainFailReason(error);
    const failReason = [
      normalizedReason,
      error?.code ? `(code=${error.code})` : '',
      error?.data ? `data=${JSON.stringify(error.data)}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    console.error('[asset][registerAssetOnChain] failed', {
      assetId,
      tokenId,
      ownerAddress,
      orgName,
      categoryName,
      error: {
        message: error?.message,
        code: error?.code,
        data: error?.data,
        raw: error?.raw,
      },
    });

    await pool.query(
      `
        UPDATE asset_chain_info
        SET token_id = ?, owner_address = ?, chain_status = 2,
            last_sync_time = NOW(), fail_reason = ?, retry_count = IFNULL(retry_count, 0) + 1
        WHERE asset_id = ?
      `,
      [tokenId, ownerAddress, failReason, assetId],
    );

    return {
      chain_status: 2,
      token_id: tokenId,
      owner_address: ownerAddress,
      error: normalizedReason,
    };
  }
};

const getAuctionTradeMode = (asset) => {
  if (Number(asset.can_sell_ownership) === 1) return 'ownership';
  if (Number(asset.can_sell_view_right) === 1) return 'view';
  if (Number(asset.can_sell_process_right) === 1) return 'process';
  return '';
};

const settleAuctionByPublishId = async (publishId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `
        SELECT
          apr.*, da.asset_name, da.pc_type,
          da.can_sell_ownership, da.can_sell_view_right, da.can_sell_process_right
        FROM asset_publish_record apr
        INNER JOIN digital_asset da ON da.id = apr.asset_id
        WHERE apr.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [publishId],
    );
    const auction = rows[0];
    if (!auction || auction.pricing_mode !== 'auction') throw new Error('拍卖不存在');
    if (auction.auction_status && auction.auction_status !== 'OPEN') {
      const [settlements] = await conn.query(
        'SELECT * FROM auction_settlement WHERE publish_id = ? LIMIT 1',
        [publishId],
      );
      await conn.commit();
      return settlements[0] || { status: auction.auction_status };
    }
    if (!auction.auction_end_time || new Date(auction.auction_end_time).getTime() > Date.now()) {
      throw new Error('拍卖尚未截止');
    }

    const [bidRows] = await conn.query(
      `
        SELECT id, bidder_user_id, bid_price, bid_time
        FROM auction_bid
        WHERE publish_id = ?
        ORDER BY bid_price DESC, bid_time ASC, id ASC
        LIMIT 1
        FOR UPDATE
      `,
      [publishId],
    );
    const winner = bidRows[0] || null;
    if (!winner) {
      await conn.query(
        `
          UPDATE asset_publish_record
          SET auction_status = 'UNSOLD',
              auction_settled_at = NOW(),
              publish_status = 0,
              remaining_qty = 0,
              updated_at = NOW()
          WHERE id = ?
        `,
        [publishId],
      );
      await conn.query(
        'UPDATE digital_asset SET status = 0, available_qty = 1 WHERE id = ?',
        [auction.asset_id],
      );
      await conn.query(
        `
          INSERT INTO auction_settlement
            (publish_id, asset_id, settlement_status)
          VALUES (?, ?, 'UNSOLD')
        `,
        [publishId, auction.asset_id],
      );
      await conn.commit();
      return { status: 'UNSOLD', publish_id: Number(publishId) };
    }

    const tradeMode = getAuctionTradeMode(auction);
    if (!tradeMode) throw new Error('竞拍资产没有可交付的交易权益');
    const buyerCert = await getDefaultTradeCertInfoByUserId(winner.bidder_user_id);
    const buyerCertificateName = String(buyerCert?.certificate_name || buyerCert?.cert || '').trim();
    const buyerAddress = String(buyerCert?.owner_address || buyerCert?.address || '').trim();
    if (!buyerCertificateName || !buyerAddress) {
      throw new Error('竞拍获胜买家未设置默认交易证书，暂无法生成订单');
    }

    let orderNo = generateOrderNo();
    for (let index = 0; index < 3; index += 1) {
      const [exists] = await conn.query('SELECT id FROM asset_order WHERE order_no = ? LIMIT 1', [orderNo]);
      if (!exists.length) break;
      orderNo = generateOrderNo();
    }

    const processingType = normalizeProcessingType('', tradeMode);
    await conn.query(
      `
        INSERT INTO asset_order
          (
            order_no, publish_id, asset_id, buyer_id, buy_qty, deal_price, trade_mode,
            processing_type, pc_type, seller_certificate_name, seller_address,
            buyer_certificate_name, buyer_address, order_status
          )
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [
        orderNo,
        auction.id,
        auction.asset_id,
        winner.bidder_user_id,
        winner.bid_price,
        tradeMode,
        processingType,
        requireDeliveryMethod(auction.pc_type || 'HE'),
        auction.seller_certificate_name,
        auction.seller_address,
        buyerCertificateName,
        buyerAddress,
      ],
    );
    await conn.query(
      `
        UPDATE asset_publish_record
        SET auction_current_price = ?, auction_status = 'CLOSED', auction_settled_at = NOW(),
            publish_status = 2, remaining_qty = 0, sold_qty_total = sold_qty_total + 1, updated_at = NOW()
        WHERE id = ?
      `,
      [winner.bid_price, publishId],
    );
    await conn.query(
      'UPDATE digital_asset SET status = 2, available_qty = 0 WHERE id = ?',
      [auction.asset_id],
    );
    await conn.query(
      `
        INSERT INTO auction_settlement
          (publish_id, asset_id, winner_user_id, winning_bid_id, final_price, order_no, settlement_status)
        VALUES (?, ?, ?, ?, ?, ?, 'CLOSED')
      `,
      [publishId, auction.asset_id, winner.bidder_user_id, winner.id, winner.bid_price, orderNo],
    );
    await conn.commit();
    return {
      status: 'CLOSED',
      publish_id: Number(publishId),
      winner_user_id: winner.bidder_user_id,
      final_price: winner.bid_price,
      order_no: orderNo,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const settleExpiredAuctions = async () => {
  const [rows] = await pool.query(
    `
      SELECT id
      FROM asset_publish_record
      WHERE pricing_mode = 'auction'
        AND auction_status = 'OPEN'
        AND auction_end_time IS NOT NULL
        AND auction_end_time <= NOW()
    `,
  );
  for (const row of rows) {
    try {
      await settleAuctionByPublishId(row.id);
    } catch (error) {
      console.error('[auction] automatic settlement failed', { publishId: row.id, message: error?.message });
    }
  }
};

const isEndedAuctionStatus = (status) => ['CLOSED', 'APPLIED'].includes(String(status || '').toUpperCase());
const isUnsoldAuctionStatus = (status) => String(status || '').toUpperCase() === 'UNSOLD';

exports.getAuctionByAssetId = async (assetId) => {
  await settleExpiredAuctions();
  const [rows] = await pool.query(
    `
      SELECT
        apr.id AS publish_id, apr.asset_id, apr.pricing_mode, apr.auction_start_price,
        apr.auction_current_price, apr.auction_end_time, apr.auction_bid_count, apr.auction_status,
        apr.auction_settled_at, apr.publish_status, apr.publisher_id, da.asset_name
      FROM asset_publish_record apr
      INNER JOIN digital_asset da ON da.id = apr.asset_id
      WHERE apr.asset_id = ? AND apr.pricing_mode = 'auction'
      LIMIT 1
    `,
    [assetId],
  );
  if (!rows.length) throw new Error('拍卖不存在');
  return rows[0];
};

exports.listAuctionBids = async (assetId) => {
  const auction = await exports.getAuctionByAssetId(assetId);
  const [rows] = await pool.query(
    `
      SELECT ab.bid_price, ab.bid_time, u.account AS bidder_account
      FROM auction_bid ab
      LEFT JOIN users u ON u.id = ab.bidder_user_id
      WHERE ab.publish_id = ?
      ORDER BY ab.bid_price DESC, ab.bid_time ASC, ab.id ASC
    `,
    [auction.publish_id],
  );
  return { auction, bids: rows };
};

exports.placeAuctionBid = async (assetId, bidderUserId, rawBidPrice, identity = '') => {
  if (!isBuyerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅买家可参与拍卖');
  }
  await settleExpiredAuctions();
  const bidPrice = Number(rawBidPrice);
  if (!Number.isFinite(bidPrice) || bidPrice <= 0) throw new Error('出价必须大于 0');
  const buyerCert = await getDefaultTradeCertInfoByUserId(bidderUserId);
  if (
    !String(buyerCert?.certificate_name || buyerCert?.cert || '').trim() ||
    !String(buyerCert?.owner_address || buyerCert?.address || '').trim()
  ) {
    throw new Error('请先在个人中心设置默认交易证书后再参与拍卖');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `
        SELECT apr.*, da.asset_name
        FROM asset_publish_record apr
        INNER JOIN digital_asset da ON da.id = apr.asset_id
        WHERE apr.asset_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [assetId],
    );
    const auction = rows[0];
    if (!auction || auction.pricing_mode !== 'auction') throw new Error('拍卖不存在');
    if (Number(auction.publisher_id) === Number(bidderUserId)) throw new Error('不能参与自己资产的拍卖');
    if (Number(auction.publish_status) !== 1 || auction.auction_status !== 'OPEN') throw new Error('拍卖已结束');
    if (!auction.auction_end_time || new Date(auction.auction_end_time).getTime() <= Date.now()) {
      throw new Error('拍卖已截止，请刷新页面查看结果');
    }
    if (!Number.isInteger(bidPrice)) throw new Error('拍卖出价必须为正整数');
    const current = Number(auction.auction_current_price || auction.auction_start_price || 0);
    if (bidPrice <= current) throw new Error(`出价必须高于当前价格 ${current}`);

    await conn.query(
      'INSERT INTO auction_bid (publish_id, asset_id, bidder_user_id, bid_price) VALUES (?, ?, ?, ?)',
      [auction.id, auction.asset_id, bidderUserId, bidPrice],
    );
    await conn.query(
      `
        UPDATE asset_publish_record
        SET auction_current_price = ?, auction_bid_count = auction_bid_count + 1, updated_at = NOW()
        WHERE id = ?
      `,
      [bidPrice, auction.id],
    );
    await conn.commit();
    return {
      asset_id: Number(assetId),
      publish_id: auction.id,
      current_price: bidPrice,
      auction_bid_count: Number(auction.auction_bid_count || 0) + 1,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.settleAuctionByAssetId = async (assetId) => {
  const [rows] = await pool.query(
    'SELECT id FROM asset_publish_record WHERE asset_id = ? AND pricing_mode = \'auction\' LIMIT 1',
    [assetId],
  );
  if (!rows.length) throw new Error('拍卖不存在');
  return settleAuctionByPublishId(rows[0].id);
};

exports.listWonAuctions = async (buyerId) => {
  await settleExpiredAuctions();
  const [rows] = await pool.query(
    `
      SELECT ast.*, da.asset_name, ao.order_status
      FROM auction_settlement ast
      INNER JOIN digital_asset da ON da.id = ast.asset_id
      LEFT JOIN asset_order ao ON ao.order_no = ast.order_no
      WHERE ast.winner_user_id = ?
      ORDER BY ast.settled_at DESC
    `,
    [buyerId],
  );
  return rows;
};

exports.listAssets = async (query) => {
  await settleExpiredAuctions();
  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || 10);
  const offset = (page - 1) * pageSize;

  const where = ['1=1'];
  const params = [];

  if (query.keyword) {
    where.push('(da.asset_name LIKE ? OR da.brief LIKE ? OR da.description LIKE ?)');
    params.push(`%${query.keyword}%`, `%${query.keyword}%`, `%${query.keyword}%`);
  }
  if (query.category_id) {
    where.push('da.category_id = ?');
    params.push(query.category_id);
  }
  if (query.sub_category_id) {
    where.push('da.sub_category_id = ?');
    params.push(query.sub_category_id);
  }
  if (query.region_id) {
    where.push('da.region_id = ?');
    params.push(query.region_id);
  }
  if (query.classification_category_name) {
    where.push('da.classification_category_name = ?');
    params.push(query.classification_category_name);
  }
  if (query.classification_data_level) {
    where.push('da.classification_data_level = ?');
    params.push(query.classification_data_level);
  }
  if (query.status !== undefined) {
    where.push('da.status = ?');
    params.push(query.status);
  }

  const orderBy = query.sort_by || 'created_at';
  const order = (query.sort_order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const baseSql = `
    FROM digital_asset da
    LEFT JOIN asset_publish_record apr ON apr.asset_id = da.id
    LEFT JOIN asset_category ac ON da.category_id = ac.id
    LEFT JOIN asset_sub_category ascg ON da.sub_category_id = ascg.id
    LEFT JOIN region r ON da.region_id = r.id
    LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
    WHERE ${where.join(' AND ')}
      AND apr.id IS NOT NULL
      AND apr.publish_status <> 0
  `;

  const [countRows] = await pool.query(
    `SELECT COUNT(1) AS total ${baseSql}`,
    params,
  );

  const [listRows] = await pool.query(
    `
      SELECT
        da.id,
        da.asset_name,
        da.brief,
        da.description,
        da.file_hash,
        da.picture_mime_type,
        da.cover_image_url,
        da.category_id,
        da.classification_category_name,
        da.classification_data_level,
        da.can_sell_ownership,
        da.can_sell_view_right,
        da.can_sell_process_right,
        da.pc_type,
        da.price,
        da.price_unit,
        da.status,
        da.view_count,
        da.trade_count,
        da.created_at,
        IFNULL(apr.publish_status, 0) AS publish_status,
        IFNULL(apr.pricing_mode, 'fixed') AS pricing_mode,
        apr.auction_start_price,
        apr.auction_current_price,
        apr.auction_end_time,
        apr.auction_bid_count,
        apr.auction_status,
        IFNULL(apr.remaining_qty, 0) AS remaining_qty,
        IFNULL(apr.publish_qty, 0) AS publish_qty,
        IFNULL(apr.sold_qty_total, 0) AS sold_qty_total,
        ac.category_name,
        ascg.sub_category_name,
        r.region_name,
        IFNULL(aci.chain_status, 0) AS chain_status
      ${baseSql}
      ORDER BY da.${orderBy} ${order}
      LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset],
  );

  return {
    list: listRows,
    pagination: {
      page,
      page_size: pageSize,
      total: countRows[0].total,
    },
  };
};

exports.getHomeStats = async () => {
  const [summaryRows] = await pool.query(
    `
      SELECT
        (SELECT COUNT(*) FROM users WHERE status = 0) AS total_user_count,
        (SELECT COUNT(*) FROM users WHERE status = 0 AND identity = 'seller') AS seller_count,
        (SELECT COUNT(*) FROM users WHERE status = 0 AND identity = 'buyer') AS buyer_count,
        (SELECT COUNT(*) FROM digital_asset) AS total_asset_count,
        (
          SELECT COUNT(*)
          FROM digital_asset da
          WHERE EXISTS (
            SELECT 1
            FROM asset_publish_record apr
            WHERE apr.asset_id = da.id
              AND apr.publish_status = 1
              AND apr.remaining_qty > 0
          )
        ) AS listed_asset_count,
        (SELECT IFNULL(SUM(view_count), 0) FROM digital_asset) AS total_view_count,
        (SELECT IFNULL(SUM(trade_count), 0) FROM digital_asset) AS total_trade_count,
        (SELECT COUNT(*) FROM asset_chain_info WHERE chain_status = 1) AS on_chain_count,
        (SELECT COUNT(*) FROM asset_order) AS total_order_count,
        (SELECT COUNT(*) FROM asset_order WHERE order_status = 3) AS completed_order_count,
        (
          SELECT COUNT(*)
          FROM asset_order
          WHERE DATE(created_at) = CURRENT_DATE
        ) AS today_order_count,
        (
          SELECT IFNULL(SUM(deal_price * buy_qty), 0)
          FROM asset_order
          WHERE order_status IN (1, 2, 3)
        ) AS total_trade_amount,
        (
          SELECT IFNULL(SUM(deal_price * buy_qty), 0)
          FROM asset_order
          WHERE order_status IN (1, 2, 3)
            AND DATE(created_at) = CURRENT_DATE
        ) AS today_trade_amount,
        (SELECT COUNT(*) FROM delivery_records) AS total_delivery_count
    `,
  );

  const [dailyTrendRows] = await pool.query(
    `
      SELECT
        DATE_FORMAT(d.dt, '%m-%d') AS stat_date,
        IFNULL(o.order_count, 0) AS order_count,
        IFNULL(o.trade_amount, 0) AS trade_amount,
        IFNULL(a.asset_count, 0) AS asset_count
      FROM (
        SELECT CURDATE() - INTERVAL seq.day_offset DAY AS dt
        FROM (
          SELECT 0 AS day_offset
          UNION ALL SELECT 1
          UNION ALL SELECT 2
          UNION ALL SELECT 3
          UNION ALL SELECT 4
          UNION ALL SELECT 5
          UNION ALL SELECT 6
        ) seq
      ) d
      LEFT JOIN (
        SELECT
          DATE(created_at) AS stat_day,
          COUNT(*) AS order_count,
          IFNULL(SUM(deal_price * buy_qty), 0) AS trade_amount
        FROM asset_order
        GROUP BY DATE(created_at)
      ) o ON o.stat_day = d.dt
      LEFT JOIN (
        SELECT
          DATE(created_at) AS stat_day,
          COUNT(*) AS asset_count
        FROM digital_asset
        GROUP BY DATE(created_at)
      ) a ON a.stat_day = d.dt
      ORDER BY d.dt ASC
    `,
  );

  const [categoryRows] = await pool.query(
    `
      SELECT
        ac.category_name,
        COUNT(*) AS asset_count
      FROM digital_asset da
      LEFT JOIN asset_category ac ON da.category_id = ac.id
      GROUP BY da.category_id, ac.category_name
      ORDER BY asset_count DESC, da.category_id ASC
      LIMIT 8
    `,
  );

  const [regionRows] = await pool.query(
    `
      SELECT
        r.region_name,
        COUNT(*) AS asset_count
      FROM digital_asset da
      LEFT JOIN region r ON da.region_id = r.id
      GROUP BY da.region_id, r.region_name
      ORDER BY asset_count DESC, da.region_id ASC
      LIMIT 8
    `,
  );

  const [tradeModeRows] = await pool.query(
    `
      SELECT
        trade_mode,
        COUNT(*) AS order_count
      FROM asset_order
      GROUP BY trade_mode
      ORDER BY order_count DESC
    `,
  );

  const [tpsRows] = await pool.query(
    `
      SELECT
        ROUND(COUNT(*) / 300, 2) AS local_tps
      FROM asset_order
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        AND order_status IN (1, 2, 3)
    `,
  );

  const [latestRows] = await pool.query(
    `
      SELECT
        da.id,
        da.asset_name,
        da.brief,
        da.description,
        da.picture,
        da.picture_mime_type,
        da.cover_image_url,
        da.category_id,
        da.classification_category_name,
        da.classification_data_level,
        da.price,
        da.price_unit,
        da.view_count,
        da.trade_count,
        da.created_at,
        ac.category_name,
        ascg.sub_category_name,
        r.region_name,
        IFNULL(aci.chain_status, 0) AS chain_status
      FROM digital_asset da
      LEFT JOIN asset_category ac ON da.category_id = ac.id
      LEFT JOIN asset_sub_category ascg ON da.sub_category_id = ascg.id
      LEFT JOIN region r ON da.region_id = r.id
      LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
      WHERE EXISTS (
        SELECT 1
        FROM asset_publish_record apr
        WHERE apr.asset_id = da.id
          AND apr.publish_status = 1
          AND apr.remaining_qty > 0
      )
      ORDER BY da.created_at DESC
      LIMIT 6
    `,
  );

  const summary = summaryRows[0] || {
    total_user_count: 0,
    seller_count: 0,
    buyer_count: 0,
    total_asset_count: 0,
    listed_asset_count: 0,
    total_view_count: 0,
    total_trade_count: 0,
    on_chain_count: 0,
    total_order_count: 0,
    completed_order_count: 0,
    today_order_count: 0,
    total_trade_amount: 0,
    today_trade_amount: 0,
    total_delivery_count: 0,
  };

  summary.local_tps = Number(tpsRows?.[0]?.local_tps || 0);
  summary.max_daily_order_count = dailyTrendRows.reduce(
    (maxValue, item) => Math.max(maxValue, Number(item?.order_count || 0)),
    0,
  );

  return {
    summary,
    daily_trend: dailyTrendRows,
    category_distribution: categoryRows,
    region_distribution: regionRows,
    trade_mode_distribution: tradeModeRows,
    latest_assets: latestRows.map((row) => ({
      ...row,
      picture: toBase64Picture(row.picture),
    })),
  };
};

exports.getAssetDetail = async (id) => {
  try {
    await pool.query('UPDATE digital_asset SET view_count = IFNULL(view_count, 0) + 1 WHERE id = ?', [id]);
  } catch (error) {
    // 兼容历史库未加 view_count 字段的场景
    if (!String(error.message || '').includes('Unknown column')) {
      throw error;
    }
  }

  const [rows] = await pool.query(
    `
      SELECT
        da.*,
        owner_user.account AS owner_account,
        seller_user.account AS seller_account,
        COALESCE(agent_user.account,
          CASE WHEN apr.publisher_id <> da.user_id THEN seller_user.account ELSE NULL END) AS proxy_agent_account,
        ac.category_name,
        ascg.sub_category_name,
        r.region_name,
        aci.token_id,
        aci.owner_address,
        aci.chain_tx_hash,
        aci.chain_status,
        aci.chain_time,
        aci.last_sync_time,
        aci.fail_reason,
        aci.retry_count,
        IFNULL(apr.publish_status, 0) AS publish_status,
        IFNULL(apr.pricing_mode, 'fixed') AS pricing_mode,
        apr.publish_price,
        apr.auction_start_price,
        apr.auction_current_price,
        apr.auction_end_time,
        apr.auction_bid_count,
        apr.auction_status
      FROM digital_asset da
      LEFT JOIN users owner_user ON owner_user.id = da.user_id
      LEFT JOIN asset_category ac ON da.category_id = ac.id
      LEFT JOIN asset_sub_category ascg ON da.sub_category_id = ascg.id
      LEFT JOIN region r ON da.region_id = r.id
      LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
      LEFT JOIN asset_publish_record apr ON apr.asset_id = da.id
      LEFT JOIN users seller_user ON seller_user.id = apr.publisher_id
      LEFT JOIN certificate_registry agent_cert ON agent_cert.address = da.proxy_agent_address
      LEFT JOIN users agent_user ON agent_user.id = agent_cert.user_id
      WHERE da.id = ?
      ORDER BY (apr.publish_status = 1) DESC, apr.id DESC
      LIMIT 1
    `,
    [id],
  );

  if (!rows.length) return null;

  return {
    ...rows[0],
    picture: toBase64Picture(rows[0].picture),
  };
};

exports.listMyAssets = async (query, userId, identity = '') => {
  if (isBuyerIdentity(identity)) {
    throw new Error('买家无资产登记管理权限，请查看已购资产');
  }

  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || 10);
  const offset = (page - 1) * pageSize;

  const where = [];
  const params = [];
  const canViewAll = isAdminIdentity(identity) && String(query.scope || 'my') === 'all';

  if (!canViewAll) {
    where.push('da.user_id = ?');
    params.push(userId);
  }

  if (query.keyword) {
    where.push('(da.asset_name LIKE ? OR da.brief LIKE ? OR da.description LIKE ?)');
    params.push(`%${query.keyword}%`, `%${query.keyword}%`, `%${query.keyword}%`);
  }
  if (query.category_id) {
    where.push('da.category_id = ?');
    params.push(query.category_id);
  }
  if (query.sub_category_id) {
    where.push('da.sub_category_id = ?');
    params.push(query.sub_category_id);
  }
  if (query.region_id) {
    where.push('da.region_id = ?');
    params.push(query.region_id);
  }
  if (query.classification_category_name) {
    where.push('da.classification_category_name = ?');
    params.push(query.classification_category_name);
  }
  if (query.classification_data_level) {
    where.push('da.classification_data_level = ?');
    params.push(query.classification_data_level);
  }
  if (query.status !== undefined) {
    where.push('da.status = ?');
    params.push(query.status);
  }

  const orderBy = query.sort_by || 'created_at';
  const order = (query.sort_order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  if (!where.length) {
    where.push('1 = 1');
  }

  const baseSql = `
    FROM digital_asset da
    LEFT JOIN asset_category ac ON da.category_id = ac.id
    LEFT JOIN asset_sub_category ascg ON da.sub_category_id = ascg.id
    LEFT JOIN region r ON da.region_id = r.id
    LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
    LEFT JOIN asset_publish_record apr ON apr.asset_id = da.id
    LEFT JOIN users u ON da.user_id = u.id
    WHERE ${where.join(' AND ')}
  `;

  const [countRows] = await pool.query(`SELECT COUNT(1) AS total ${baseSql}`, params);

  const [listRows] = await pool.query(
    `
      SELECT
        da.id,
        da.asset_name,
        da.brief,
        da.description,
        da.file_hash,
        da.picture,
        da.picture_mime_type,
        da.cover_image_url,
        da.price,
        da.price_unit,
        da.pc_type,
        da.total_qty,
        da.available_qty,
        da.classification_category_name,
        da.classification_data_level,
        da.status,
        da.is_proxied,
        da.user_id,
        da.can_sell_ownership,
        da.can_sell_view_right,
        da.can_sell_process_right,
        da.view_count,
        da.trade_count,
        da.created_at,
        ac.category_name,
        ascg.sub_category_name,
        r.region_name,
        IFNULL(u.account, '') AS owner_account,
        IFNULL(u.identity, '') AS owner_identity,
        IFNULL(aci.chain_status, 0) AS chain_status
        ,IFNULL(apr.pricing_mode, 'fixed') AS pricing_mode
        ,apr.auction_start_price
        ,apr.auction_current_price
        ,apr.auction_end_time
        ,apr.auction_bid_count
        ,apr.auction_status
      ${baseSql}
      ORDER BY da.${orderBy} ${order}
      LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset],
  );

  return {
    list: listRows.map((row) => ({
      ...row,
      picture: toBase64Picture(row.picture),
    })),
    pagination: {
      page,
      page_size: pageSize,
      total: countRows[0].total,
    },
  };
};

exports.updateAssetByOwner = async (assetId, userId, payload, identity = '') => {
  if (!isSellerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅卖家可编辑资产');
  }

  const editableFields = [
    'asset_name',
    'brief',
    'description',
    'classification_category_name',
    'classification_data_level',
    'picture',
    'picture_mime_type',
    'cover_image_url',
    'file_size',
    'file_format',
    'price',
    'price_unit',
    'total_qty',
    'available_qty',
    'allow_resale',
    'is_proxied',
    'is_third_party',
    'trade_region',
    'collect_time_start',
    'collect_time_end',
    'collect_location',
    'sensor_type',
    'data_volume',
    'certificate_name',
    'pc_type',
  ];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [assetRows] = await conn.query(
      `
        SELECT
          id, user_id, category_id, sub_category_id, region_id,
          total_qty, available_qty, price, status,
          can_sell_ownership, can_sell_view_right, can_sell_process_right
        FROM digital_asset
        WHERE id = ?
        LIMIT 1
      `,
      [assetId],
    );
    const asset = assetRows[0];
    if (!asset) throw new Error('资产不存在');
    const canManage = Number(asset.user_id) === Number(userId) || isAdminIdentity(identity);
    if (!canManage) throw new Error('无权限编辑该资产');

    const updateData = {};
    editableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        updateData[field] = payload[field];
      }
    });

    const nextCategoryId = payload.category_id || asset.category_id;
    const nextSubCategoryId = payload.sub_category_id || asset.sub_category_id;
    const nextRegionId = payload.region_id || asset.region_id;
    const nextClassificationCategoryName =
      payload.classification_category_name || updateData.classification_category_name || '';

    if (
      payload.category_id ||
      payload.sub_category_id ||
      payload.sub_category_name ||
      payload.custom_sub_category_name ||
      payload.classification_category_name
    ) {
      const resolved = await resolveCategoryAndSubCategory(conn, {
        category_id: nextCategoryId,
        classification_category_name: nextClassificationCategoryName,
        sub_category_id: payload.sub_category_id || nextSubCategoryId,
        sub_category_name: payload.sub_category_name || payload.custom_sub_category_name || '',
      }, { allowCreateSubCategory: true });

      updateData.category_id = resolved.category.id;
      updateData.category_key = resolved.category.category_key;
      updateData.sub_category_id = resolved.subCategory?.id || null;
      updateData.sub_category_key = resolved.subCategory?.sub_category_key || '';
    }

    if (
      payload.can_sell_ownership !== undefined ||
      payload.can_sell_view_right !== undefined ||
      payload.can_sell_process_right !== undefined
    ) {
      if (payload.can_sell_ownership !== undefined) {
        updateData.can_sell_ownership = Number(payload.can_sell_ownership);
      }
      if (payload.can_sell_view_right !== undefined) {
        updateData.can_sell_view_right = Number(payload.can_sell_view_right);
      }
      if (payload.can_sell_process_right !== undefined) {
        updateData.can_sell_process_right = Number(payload.can_sell_process_right);
      }
    }

    if (payload.region_id) {
      const region = await getRegionInfo(nextRegionId);
      if (!region) throw new Error('地区不存在');
      updateData.region_id = nextRegionId;
      updateData.region_key = region.region_key;
    }

    if (payload.sub_category_id || payload.sub_category_name || payload.custom_sub_category_name) {
      const resolved = await resolveCategoryAndSubCategory(conn, {
        category_id: nextCategoryId,
        classification_category_name: nextClassificationCategoryName,
        sub_category_id: payload.sub_category_id,
        sub_category_name: payload.sub_category_name || payload.custom_sub_category_name || '',
      }, { allowCreateSubCategory: true });
      updateData.category_id = resolved.category.id;
      updateData.category_key = resolved.category.category_key;
      updateData.sub_category_id = resolved.subCategory?.id || null;
      updateData.sub_category_key = resolved.subCategory?.sub_category_key || '';
    }

    const finalTotalQty = Number(updateData.total_qty ?? asset.total_qty);
    const finalAvailableQty = Number(updateData.available_qty ?? asset.available_qty);
    if (finalTotalQty !== 1 || ![0, 1].includes(finalAvailableQty)) {
      throw new Error('不可分割资产总数量固定为 1，可用数量只能为 0 或 1');
    }
    if (finalAvailableQty > finalTotalQty) {
      throw new Error('available_qty 不能大于 total_qty');
    }

    const hasPricingUpdate = [
      'pricing_mode',
      'auction_start_price',
      'auction_end_time',
    ].some((field) => Object.prototype.hasOwnProperty.call(payload, field));
    if (!Object.keys(updateData).length && !hasPricingUpdate) throw new Error('没有可更新的字段');

    if (Object.keys(updateData).length) {
      await conn.query('UPDATE digital_asset SET ? WHERE id = ?', [updateData, assetId]);
    }

    const [publishRows] = await conn.query(
      `
        SELECT id, publish_price, publish_qty, remaining_qty, sold_qty_total, publish_status,
               pricing_mode, auction_start_price, auction_current_price, auction_end_time, auction_status
        FROM asset_publish_record
        WHERE asset_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [assetId],
    );

    const publishRecord = publishRows[0] || null;
    if (publishRecord) {
      const soldQtyTotal = Number(publishRecord.sold_qty_total || 0);
      const syncedRemainingQty = Math.max(0, finalAvailableQty);
      const syncedPublishQty = Math.max(soldQtyTotal + syncedRemainingQty, syncedRemainingQty);
      const syncedPublishPrice = Number(updateData.price ?? asset.price ?? publishRecord.publish_price ?? 0);
      const pricingMode = String(payload.pricing_mode || publishRecord.pricing_mode || 'fixed') === 'auction'
        ? 'auction'
        : 'fixed';
      if (
        pricingMode === 'auction' &&
        publishRecord.pricing_mode === 'auction' &&
        isEndedAuctionStatus(publishRecord.auction_status)
      ) {
        throw new Error('该资产拍卖已结束，不能重新上架拍卖');
      }
      const auctionStartPrice = pricingMode === 'auction'
        ? Number(payload.auction_start_price ?? publishRecord.auction_start_price ?? syncedPublishPrice)
        : null;
      const auctionEndTime = pricingMode === 'auction'
        ? normalizeExpirationTime(payload.auction_end_time ?? publishRecord.auction_end_time)
        : null;
      if (pricingMode === 'auction' && (!Number.isInteger(auctionStartPrice) || auctionStartPrice <= 0)) {
        throw new Error('拍卖起拍价必须为正整数');
      }
      if (pricingMode === 'auction' && (!auctionEndTime || new Date(auctionEndTime).getTime() <= Date.now() + 60 * 1000)) {
        throw new Error('拍卖截止时间至少应晚于当前时间 1 分钟');
      }
      const syncedPublishStatus = derivePublishStatusFromAsset(
        asset.status,
        syncedRemainingQty,
        publishRecord.publish_status,
      );
      const reopenUnsoldAuction =
        pricingMode === 'auction' &&
        syncedPublishStatus === 1 &&
        publishRecord.pricing_mode === 'auction' &&
        isUnsoldAuctionStatus(publishRecord.auction_status);
      if (reopenUnsoldAuction) {
        await conn.query('DELETE FROM auction_settlement WHERE publish_id = ?', [publishRecord.id]);
        await conn.query('DELETE FROM auction_bid WHERE publish_id = ?', [publishRecord.id]);
      }

      await conn.query(
        `
          UPDATE asset_publish_record
          SET publish_price = ?,
              publish_qty = ?,
              remaining_qty = ?,
              publish_status = ?,
              pricing_mode = ?,
              auction_start_price = ?,
              auction_current_price = CASE
                WHEN ? = 1 THEN ?
                WHEN ? = 'auction' THEN COALESCE(auction_current_price, ?)
                ELSE NULL
              END,
              auction_end_time = ?,
              auction_status = CASE WHEN ? = 'auction' AND ? = 1 THEN 'OPEN' WHEN ? = 'fixed' THEN NULL ELSE auction_status END,
              updated_at = NOW()
          WHERE id = ?
        `,
        [
          syncedPublishPrice,
          syncedPublishQty,
          syncedRemainingQty,
          syncedPublishStatus,
          pricingMode,
          auctionStartPrice,
          reopenUnsoldAuction ? 1 : 0,
          auctionStartPrice,
          pricingMode,
          auctionStartPrice,
          auctionEndTime,
          pricingMode,
          syncedPublishStatus,
          pricingMode,
          publishRecord.id,
        ],
      );
    } else {
      await conn.query(
        `
          INSERT INTO asset_publish_record (
            asset_id,
            publisher_id,
            publish_price,
            publish_qty,
            remaining_qty,
            sold_qty_total,
            publish_status
          ) VALUES (?, ?, ?, ?, ?, 0, 0)
        `,
        [
          assetId,
          Number(asset.user_id),
          Number(updateData.price ?? asset.price ?? 0),
          0,
          0,
        ],
      );
    }

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.updateAssetStatusByOwner = async (assetId, userId, status, identity = '') => {
  if (!isSellerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅卖家可修改资产状态');
  }

  const nextStatus = Number(status);
  if (![0, 1, 2].includes(nextStatus)) {
    throw new Error('无效的状态值');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, user_id, total_qty, available_qty FROM digital_asset WHERE id = ? LIMIT 1 FOR UPDATE',
      [assetId],
    );
    const asset = rows[0];
    if (!asset) throw new Error('资产不存在');
    const canManage = Number(asset.user_id) === Number(userId) || isAdminIdentity(identity);
    if (!canManage) throw new Error('无权限操作该资产');

    if (nextStatus === 0) {
      const [publishRows] = await conn.query(
        `
          SELECT id, remaining_qty
          FROM asset_publish_record
          WHERE asset_id = ? AND publish_status = 1
          FOR UPDATE
        `,
        [assetId],
      );

      const recoverQty = publishRows.reduce((sum, row) => sum + Number(row.remaining_qty || 0), 0);

      if (publishRows.length) {
        await conn.query(
          'UPDATE asset_publish_record SET publish_status = 0 WHERE asset_id = ? AND publish_status = 1',
          [assetId],
        );
      }

      if (recoverQty > 0) {
        await conn.query(
          'UPDATE digital_asset SET available_qty = LEAST(total_qty, available_qty + ?), status = 0 WHERE id = ?',
          [recoverQty, assetId],
        );
      } else {
        await conn.query('UPDATE digital_asset SET status = 0 WHERE id = ?', [assetId]);
      }
    } else {
      await conn.query('UPDATE digital_asset SET status = ? WHERE id = ?', [nextStatus, assetId]);

      const [publishRows] = await conn.query(
        `
          SELECT id, publish_qty, remaining_qty, sold_qty_total, pricing_mode, auction_status
          FROM asset_publish_record
          WHERE asset_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [assetId],
      );
      const publishRecord = publishRows[0] || null;

      if (publishRecord) {
        if (
          nextStatus === 1 &&
          publishRecord.pricing_mode === 'auction' &&
          (isEndedAuctionStatus(publishRecord.auction_status) || isUnsoldAuctionStatus(publishRecord.auction_status))
        ) {
          throw new Error(
            isUnsoldAuctionStatus(publishRecord.auction_status)
              ? '该资产已流拍，请通过定价上架重新设置拍卖'
              : '该资产拍卖已结束，不能重新上架拍卖',
          );
        }
        const nextPublishStatus = nextStatus === 1 ? 1 : 2;
        await conn.query(
          `
            UPDATE asset_publish_record
            SET publish_status = ?,
                auction_status = CASE
                  WHEN pricing_mode = 'auction' AND ? = 1 THEN 'OPEN'
                  WHEN pricing_mode = 'fixed' THEN NULL
                  ELSE auction_status
                END,
                updated_at = NOW()
            WHERE id = ?
          `,
          [nextPublishStatus, nextStatus, publishRecord.id],
        );
      } else {
        await conn.query(
          `
            INSERT INTO asset_publish_record (
              asset_id,
              publisher_id,
              publish_price,
              publish_qty,
              remaining_qty,
              sold_qty_total,
              publish_status
            ) VALUES (?, ?, 0, 0, 0, 0, ?)
          `,
          [assetId, Number(asset.user_id), nextStatus === 1 ? 1 : 2],
        );
      }
    }

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.proxyCustodyByOwner = async (assetId, userId, payload = {}, identity = '') => {
  if (!isSellerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅卖家可执行代理托管');
  }

  const [assetRows] = await pool.query(
    `
      SELECT
        da.id,
        da.user_id,
        da.asset_name,
        da.file_hash,
        da.is_proxied,
        aci.token_id
      FROM digital_asset da
      LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
      WHERE da.id = ?
      LIMIT 1
    `,
    [assetId],
  );

  const asset = assetRows[0];
  if (!asset) throw new Error('资产不存在');

  const canManage = Number(asset.user_id) === Number(userId) || isAdminIdentity(identity);
  if (!canManage) throw new Error('无权限操作该资产');
  if (Number(asset.is_proxied || 0) !== 1) {
    throw new Error('该资产未开启代理托管');
  }

  const targetAddress = String(payload.target_address || '').trim();
  if (!targetAddress) throw new Error('托管码不能为空');

  const tokenId = String(asset.token_id || asset.file_hash || '').trim();
  if (!tokenId) throw new Error('资产缺少链上标识，无法执行代理托管');

  const defaultCert =
    (await getDefaultRegisterCertInfoByUserId(userId)) || (await getDefaultTradeCertInfoByUserId(userId));
  if (!defaultCert?.certificate_name || !defaultCert?.org) {
    throw new Error('请先在个人中心配置默认登记证书或交易证书');
  }

  await configureChainCertificate(defaultCert.certificate_name || defaultCert.cert, defaultCert.org);

  const ownerRes = await chainClient.ownerOf(tokenId);
  const ownerAddress = String(ownerRes?.result || ownerRes?.owner || '').trim();
  if (!ownerAddress) {
    throw new Error('获取资产拥有者失败');
  }

  const approvalRes = await chainClient.setApproval({
    owner: ownerAddress,
    to: targetAddress,
    tokenId,
    isApproval: 'true',
  });

  await pool.query('UPDATE digital_asset SET proxy_agent_address=? WHERE id=?', [targetAddress, asset.id]);

  return {
    asset_id: Number(asset.id),
    asset_name: asset.asset_name,
    token_id: tokenId,
    owner_address: ownerAddress,
    target_address: targetAddress,
    chain_result: approvalRes,
  };
};

exports.publishAsset = async (payload, userId, identity = '') => {
  const {
    asset_id,
    publish_price,
    publish_qty,
    pricing_mode: rawPricingMode = 'fixed',
    auction_start_price: rawAuctionStartPrice,
    auction_end_time: rawAuctionEndTime,
  } = payload || {};
  if (!isSellerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅卖家可上架资产');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [assetRows] = await conn.query(
      'SELECT id, user_id, available_qty, total_qty, status FROM digital_asset WHERE id = ? LIMIT 1 FOR UPDATE',
      [asset_id],
    );
    const asset = assetRows[0];
    if (!asset) throw new Error('资产不存在');
    const canManage = Number(asset.user_id) === Number(userId) || isAdminIdentity(identity);
    if (!canManage) throw new Error('仅资产拥有者或管理员可上架');
    const defaultTradeCert = await getDefaultTradeCertInfoByUserId(userId);
    const sellerCertificateName = String(defaultTradeCert?.certificate_name || defaultTradeCert?.cert || '').trim();
    const sellerAddress = String(defaultTradeCert?.owner_address || defaultTradeCert?.address || '').trim();
    if (!sellerCertificateName || !sellerAddress) {
      throw new Error('请先在个人中心设置默认交易证书后再上架');
    }

    const [publishRows] = await conn.query(
      `
        SELECT id, publish_qty, remaining_qty, publish_status, sold_qty_total,
               pricing_mode, auction_start_price, auction_current_price, auction_end_time, auction_status
        FROM asset_publish_record
        WHERE asset_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [asset_id],
    );
    const existingPublish = publishRows[0] || null;
    const pricingMode = String(rawPricingMode || 'fixed').toLowerCase() === 'auction' ? 'auction' : 'fixed';
    if (
      pricingMode === 'auction' &&
      existingPublish?.pricing_mode === 'auction' &&
      isEndedAuctionStatus(existingPublish.auction_status)
    ) {
      throw new Error('该资产拍卖已结束，不能重新上架拍卖');
    }
    const recoverQty =
      existingPublish && Number(existingPublish.publish_status) === 1
        ? Number(existingPublish.remaining_qty || 0)
        : 0;
    const effectiveAvailableQty = Number(asset.available_qty || 0) + recoverQty;
    if (effectiveAvailableQty < Number(publish_qty)) throw new Error('可用库存不足，无法上架');

    const publisherId = Number(asset.user_id);
    const nextAvailableQty = effectiveAvailableQty - Number(publish_qty);
    const auctionStartPrice = pricingMode === 'auction'
      ? Number(rawAuctionStartPrice ?? publish_price)
      : null;
    const auctionEndTime = pricingMode === 'auction'
      ? normalizeExpirationTime(rawAuctionEndTime)
      : null;
    if (pricingMode === 'auction' && (!Number.isInteger(auctionStartPrice) || auctionStartPrice <= 0)) {
      throw new Error('拍卖起拍价必须为正整数');
    }
    if (pricingMode === 'auction' && (!auctionEndTime || new Date(auctionEndTime).getTime() <= Date.now() + 60 * 1000)) {
      throw new Error('拍卖截止时间至少应晚于当前时间 1 分钟');
    }

    if (existingPublish) {
      if (pricingMode === 'auction' && isUnsoldAuctionStatus(existingPublish.auction_status)) {
        await conn.query('DELETE FROM auction_settlement WHERE publish_id = ?', [existingPublish.id]);
        await conn.query('DELETE FROM auction_bid WHERE publish_id = ?', [existingPublish.id]);
      }
      await conn.query(
        `
          UPDATE asset_publish_record
          SET publisher_id = ?,
              seller_certificate_name = ?,
              seller_address = ?,
              publish_price = ?,
              publish_qty = ?,
              remaining_qty = ?,
              publish_status = 1,
              pricing_mode = ?,
              auction_start_price = ?,
              auction_current_price = ?,
              auction_end_time = ?,
              auction_bid_count = 0,
              auction_status = ?,
              auction_settled_at = NULL,
              updated_at = NOW()
          WHERE id = ?
        `,
        [
          publisherId,
          sellerCertificateName,
          sellerAddress,
          publish_price,
          publish_qty,
          publish_qty,
          pricingMode,
          auctionStartPrice,
          auctionStartPrice,
          auctionEndTime,
          pricingMode === 'auction' ? 'OPEN' : null,
          existingPublish.id,
        ],
      );
    } else {
      await conn.query(
        `
          INSERT INTO asset_publish_record
            (
              asset_id,
              publisher_id,
              seller_certificate_name,
              seller_address,
              publish_price,
              publish_qty,
              remaining_qty,
              sold_qty_total,
              publish_status,
              pricing_mode,
              auction_start_price,
              auction_current_price,
              auction_end_time,
              auction_bid_count,
              auction_status
            )
          VALUES
            (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, 0, ?)
        `,
        [
          asset_id,
          publisherId,
          sellerCertificateName,
          sellerAddress,
          publish_price,
          publish_qty,
          publish_qty,
          pricingMode,
          auctionStartPrice,
          auctionStartPrice,
          auctionEndTime,
          pricingMode === 'auction' ? 'OPEN' : null,
        ],
      );
    }

    await conn.query(
      'UPDATE digital_asset SET available_qty = ?, status = 1 WHERE id = ?',
      [nextAvailableQty, asset_id],
    );

    await conn.commit();
    const [finalRows] = await conn.query(
      'SELECT id FROM asset_publish_record WHERE asset_id = ? LIMIT 1',
      [asset_id],
    );
    return { publish_id: finalRows[0]?.id || null };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.createOrder = async (
  { publish_id, buy_qty, trade_mode, buyer_address, processing_type, expiration_time },
  buyerId,
  identity = '',
) => {
  if (!isBuyerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅买家可购买资产');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const normalizedBuyQty = Number(buy_qty || 0);
    if (!Number.isInteger(normalizedBuyQty) || normalizedBuyQty <= 0) {
      throw new Error('购买数量必须为正整数');
    }

    const [publishRows] = await conn.query(
      `
        SELECT
          apr.id,
          apr.asset_id,
          apr.publisher_id,
          apr.seller_certificate_name,
          apr.seller_address,
          apr.publish_price,
          apr.remaining_qty,
          apr.publish_status,
          apr.pricing_mode,
          da.is_divisible,
          da.can_sell_ownership,
          da.can_sell_view_right,
          da.can_sell_process_right,
          da.pc_type
        FROM asset_publish_record apr
        LEFT JOIN digital_asset da ON apr.asset_id = da.id
        WHERE apr.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [publish_id],
    );
    const publish = publishRows[0];
    if (!publish) throw new Error('上架记录不存在');
    if (Number(publish.publisher_id) === Number(buyerId)) throw new Error('不能购买自己上架的资产');
    if (publish.pricing_mode === 'auction') throw new Error('拍卖资产请通过出价参与竞拍');
    if (Number(publish.publish_status) !== 1) throw new Error('该上架记录不可下单');
    if (Number(publish.remaining_qty) < normalizedBuyQty) throw new Error('上架剩余库存不足');

    const permissionRule = {
      can_sell_ownership: Number(publish.can_sell_ownership || 0),
      can_sell_view_right: Number(publish.can_sell_view_right || 0),
      can_sell_process_right: Number(publish.can_sell_process_right || 0),
    };
    const fallbackTradeMode =
      getDefaultTradeModeByPermission(permissionRule) || 'ownership';
    const normalizedTradeMode = trade_mode
      ? normalizeTradeMode(trade_mode)
      : fallbackTradeMode;
    const normalizedProcessingType = normalizeProcessingType(processing_type, normalizedTradeMode);
    const normalizedPcType = requireDeliveryMethod(publish.pc_type || 'HE');

    if (Number(publish.is_divisible) === 0 && normalizedBuyQty !== 1) {
      throw new Error('不可分割资产仅支持购买 1 份');
    }
    if (normalizedTradeMode === 'ownership' && Number(publish.can_sell_ownership) !== 1) {
      throw new Error('该资产不支持购买所有权');
    }
    if (normalizedTradeMode === 'view' && Number(publish.can_sell_view_right) !== 1) {
      throw new Error('该资产不支持购买查阅权');
    }
    if (normalizedTradeMode === 'process' && Number(publish.can_sell_process_right) !== 1) {
      throw new Error('该资产不支持购买加工权');
    }

    const normalizedExpirationTime = normalizeExpirationTime(expiration_time);
    if (normalizedTradeMode !== 'ownership') {
      if (!normalizedExpirationTime) {
        throw new Error('购买经营权或加工使用权时请选择权限过期时间');
      }
      if (new Date(normalizedExpirationTime).getTime() <= Date.now()) {
        throw new Error('权限过期时间必须晚于当前时间');
      }
    }

    let orderNo = generateOrderNo();
    for (let i = 0; i < 3; i += 1) {
      const [existsRows] = await conn.query('SELECT id FROM asset_order WHERE order_no = ? LIMIT 1', [orderNo]);
      if (!existsRows.length) break;
      orderNo = generateOrderNo();
    }

    const [existsRowsFinal] = await conn.query('SELECT id FROM asset_order WHERE order_no = ? LIMIT 1', [orderNo]);
    if (existsRowsFinal.length) throw new Error('订单号生成失败，请重试');

    const buyerCert = await certificateService.getDefaultTradeCertInfo(buyerId);
    const buyerCertificateName = String(buyerCert?.certificate_name || '').trim();
    const normalizedBuyerAddress = String(buyerCert?.address || '').trim();
    if (!normalizedBuyerAddress || !buyerCertificateName) {
      throw new Error('请先在个人中心设置默认交易证书后再购买资产');
    }

    await conn.query(
      `
        INSERT INTO asset_order
          (
            order_no,
            publish_id,
            asset_id,
            buyer_id,
            buy_qty,
            deal_price,
            trade_mode,
            seller_certificate_name,
            seller_address,
            buyer_certificate_name,
            buyer_address,
            processing_type,
            pc_type,
            expiration_time,
            order_status
          )
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [
        orderNo,
        publish.id,
        publish.asset_id,
        buyerId,
        normalizedBuyQty,
        publish.publish_price,
        normalizedTradeMode,
        String(publish.seller_certificate_name || '').trim() || null,
        String(publish.seller_address || '').trim() || null,
        buyerCertificateName || null,
        normalizedBuyerAddress || null,
        normalizedProcessingType || null,
        normalizedPcType || null,
        normalizedExpirationTime,
      ],
    );

    await conn.query(
      `
        UPDATE asset_publish_record
        SET remaining_qty = remaining_qty - ?,
            sold_qty_total = sold_qty_total + ?,
            publish_status = CASE WHEN remaining_qty - ? <= 0 THEN 2 ELSE 1 END
        WHERE id = ?
      `,
      [normalizedBuyQty, normalizedBuyQty, normalizedBuyQty, publish.id],
    );

    await conn.commit();
    return {
      order_no: orderNo,
      asset_id: publish.asset_id,
      buy_qty: normalizedBuyQty,
      deal_price: publish.publish_price,
      trade_mode: normalizedTradeMode,
      processing_type: normalizedProcessingType,
      pc_type: normalizedPcType,
      expiration_time: normalizedExpirationTime,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.createOrderByAsset = async (
  { asset_id, buy_qty, trade_mode, buyer_address, processing_type, expiration_time },
  buyerId,
  identity = '',
) => {
  if (!isBuyerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅买家可购买资产');
  }

  const normalizedBuyQty = Number(buy_qty || 1);
  if (!Number.isInteger(normalizedBuyQty) || normalizedBuyQty <= 0) {
    throw new Error('购买数量必须为正整数');
  }

  const [publishRows] = await pool.query(
    `
      SELECT id
      FROM asset_publish_record
      WHERE asset_id = ?
        AND publish_status = 1
        AND pricing_mode = 'fixed'
        AND remaining_qty >= ?
      LIMIT 1
    `,
    [asset_id, normalizedBuyQty],
  );

  const publish = publishRows[0];
  if (!publish) throw new Error('当前资产暂无可用上架记录');

  return exports.createOrder(
    {
      publish_id: publish.id,
      buy_qty: normalizedBuyQty,
      trade_mode,
      buyer_address,
      processing_type,
      expiration_time,
    },
    buyerId,
    identity,
  );
};

const getOrderDeliveryContext = async (conn, orderNo) => {
  const [orderRows] = await conn.query(
    `
      SELECT
        ao.id,
        ao.order_no,
        ao.publish_id,
        ao.asset_id,
        ao.buyer_id,
        ao.buy_qty,
        ao.deal_price,
        ao.trade_mode,
        ao.processing_type,
        ao.expiration_time AS order_expiration_time,
        COALESCE(ao.pc_type, da.pc_type) AS pc_type,
        ao.seller_certificate_name,
        ao.seller_address,
        ao.buyer_certificate_name,
        ao.buyer_address,
        ao.order_status,
        ao.created_at,
        ao.updated_at,
        ao.payment_confirm_time,
        ao.seller_delivery_time,
        ao.buyer_confirm_time,
        apr.publisher_id,
        da.asset_name,
        da.classification_category_name,
        da.classification_data_level,
        da.price_unit,
        da.file_hash,
        aci.token_id,
        aci.owner_address
      FROM asset_order ao
      LEFT JOIN asset_publish_record apr ON ao.publish_id = apr.id
      LEFT JOIN digital_asset da ON ao.asset_id = da.id
      LEFT JOIN asset_chain_info aci ON ao.asset_id = aci.asset_id
      WHERE ao.order_no = ?
      LIMIT 1
      FOR UPDATE
    `,
    [orderNo],
  );
  return orderRows[0] || null;
};

const transferOrderRightOnChain = async (order, sellerId) => {
  const tokenId = String(order.file_hash || '').trim();
  const sellerAddress = String(order.seller_address || order.owner_address || '').trim();
  const buyerAddress = String(order.buyer_address || '').trim();
  if (!tokenId || !sellerAddress || !buyerAddress) {
    throw new Error('订单缺少资产标识或交易双方证书地址，无法执行链上权益转移');
  }

  const defaultTradeCert = await certificateService.getDefaultTradeCertInfo(sellerId);
  const sellerCertificateName = String(defaultTradeCert?.certificate_name || '').trim();
  const sellerOrg = String(
    defaultTradeCert?.org || defaultTradeCert?.organization || 'wx-org1.chainmaker.org',
  ).trim();
  if (!sellerCertificateName) {
    throw new Error('请先在个人中心设置默认交易证书后再确认交易');
  }

  const resolvedSeller = await certificateService.resolveOwnerAddressByCertificate(
    sellerCertificateName,
    sellerOrg,
    sellerId,
  );
  const certificateAddress = String(resolvedSeller?.owner_address || '').trim();
  if (certificateAddress && certificateAddress !== sellerAddress) {
    throw new Error('卖家交易证书地址与订单卖家地址不一致，无法执行链上权益转移');
  }

  try {
    await configureChainCertificate(sellerCertificateName, sellerOrg);
  } catch (error) {
    const certPath = String(
      resolvedSeller?.sign_cert_path ||
      resolvedSeller?.cert_path ||
      '',
    ).trim();
    const detail = certPath ? `，签名证书路径：${certPath}` : '';
    throw new Error(`卖家证书配置失败：${error.message || error}${detail}`);
  }

  if (normalizeTradeMode(order.trade_mode) === 'ownership') {
    const chainResult = await chainClient.transferFrom({
      from: sellerAddress,
      to: buyerAddress,
      tokenId,
    });
    return {
      action: 'TransferFrom',
      token_id: tokenId,
      from: sellerAddress,
      to: buyerAddress,
      chain_result: chainResult,
    };
  }

  const rightType = getChainRightTypeByTradeMode(order.trade_mode);
  const expiration = formatChainExpiration(order.order_expiration_time);
  if (!rightType || !expiration) {
    throw new Error('使用权交易缺少权益类型或权限过期时间，无法执行链上授权');
  }

  const chainResult = await chainClient.buyPermission({
    owner: buyerAddress,
    tokenID: tokenId,
    expiration,
    rightType,
  });
  return {
    action: 'BuyPermission',
    token_id: tokenId,
    owner: buyerAddress,
    expiration,
    right_type: rightType,
    chain_result: chainResult,
  };
};

const getCurrentTransactionStatus = async (conn, orderNo) => {
  const [rows] = await conn.query(
    `
      SELECT status
      FROM transactions
      WHERE order_no = ?
      LIMIT 1
    `,
    [orderNo],
  );
  return String(rows[0]?.status || '').trim();
};

const getOrderDeliveryContextByTransactionId = async (conn, transactionId) => {
  const [rows] = await conn.query(
    `
      SELECT
        t.id AS transaction_row_id,
        t.transaction_id,
        t.status AS transaction_status,
        t.quality,
        t.processing_type AS transaction_processing_type,
        t.pc_type AS transaction_pc_type,
        t.expiration_time AS transaction_expiration_time,
        t.model_file_hash AS transaction_model_file_hash,
        ao.id,
        ao.order_no,
        ao.publish_id,
        ao.asset_id,
        ao.buyer_id,
        ao.buy_qty,
        ao.deal_price,
        ao.trade_mode,
        ao.processing_type,
        ao.expiration_time AS order_expiration_time,
        COALESCE(ao.pc_type, da.pc_type, t.pc_type) AS pc_type,
        ao.seller_certificate_name,
        ao.seller_address,
        ao.buyer_certificate_name,
        ao.buyer_address,
        ao.order_status,
        ao.created_at,
        ao.updated_at,
        ao.payment_confirm_time,
        ao.seller_delivery_time,
        ao.buyer_confirm_time,
        apr.publisher_id,
        da.asset_name,
        da.description,
        da.classification_category_name,
        da.classification_data_level,
        da.price_unit,
        da.file_hash,
        aci.token_id,
        aci.owner_address
      FROM transactions t
      LEFT JOIN asset_order ao ON t.order_no = ao.order_no
      LEFT JOIN asset_publish_record apr ON ao.publish_id = apr.id
      LEFT JOIN digital_asset da ON ao.asset_id = da.id
      LEFT JOIN asset_chain_info aci ON ao.asset_id = aci.asset_id
      WHERE t.transaction_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [transactionId],
  );
  return rows[0] || null;
};

exports.payOrder = async (orderNo, buyerId, payload = {}, paymentProof = {}) => {
  if (paymentProof.verifiedAlipay !== true && paymentProof.verifiedWallet !== true && alipayConfig.skipPayment !== true) {
    throw new Error('请先完成支付');
  }
  const ownsConnection = !paymentProof.connection;
  const conn = paymentProof.connection || await pool.getConnection();
  try {
    if (ownsConnection) await conn.beginTransaction();

    const order = await getOrderDeliveryContext(conn, orderNo);
    if (!order) throw new Error('订单不存在');
    if (Number(order.buyer_id) !== Number(buyerId)) throw new Error('无权限支付该订单');
    if (Number(order.order_status) !== 0) throw new Error('订单当前状态不可支付');

    const buyerCert = await certificateService.getDefaultTradeCertInfo(buyerId);
    const buyerAddress = String(buyerCert?.address || '').trim();
    const buyerCertificateName = String(buyerCert?.certificate_name || '').trim();
    if (!buyerAddress || !buyerCertificateName) {
      throw new Error('请先在个人中心设置默认交易证书后再确认购买');
    }

    await conn.query(
      `
        UPDATE asset_order
        SET order_status = 1,
            buyer_certificate_name = ?,
            buyer_address = ?,
            payment_confirm_time = NOW()
        WHERE id = ?
      `,
      [buyerCertificateName, buyerAddress, order.id],
    );

    const refreshedOrder = {
      ...order,
      buyer_certificate_name: buyerCertificateName,
      buyer_address: buyerAddress,
      order_status: 1,
    };
    const transaction = await ensureTransactionForOrder(conn, refreshedOrder, {
      buyer_address: buyerAddress,
      status: '待确认',
      processing_type: refreshedOrder.processing_type || normalizeProcessingType('', refreshedOrder.trade_mode),
      pc_type: refreshedOrder.pc_type || '',
      expiration_time: refreshedOrder.order_expiration_time,
      model_file_hash: refreshedOrder.file_hash,
    });
    const digitalContract = await upsertDigitalContractForOrder(conn, refreshedOrder, transaction, {
      status: '草稿',
      processing_type: refreshedOrder.processing_type || normalizeProcessingType('', refreshedOrder.trade_mode),
      pc_type: refreshedOrder.pc_type || '',
    });

    if (ownsConnection) await conn.commit();
    return {
      order_no: orderNo,
      buyer_address: buyerAddress,
      seller_address: transaction.seller_address,
      transaction,
      digital_contract: digitalContract,
    };
  } catch (error) {
    if (ownsConnection) await conn.rollback();
    throw error;
  } finally {
    if (ownsConnection) conn.release();
  }
};

exports.cancelOrder = async (orderNo, buyerId, options = {}) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query(
      'SELECT id, publish_id, asset_id, buyer_id, buy_qty, order_status FROM asset_order WHERE order_no=? FOR UPDATE',
      [orderNo],
    );
    const order = orders[0];
    if (!order) throw new Error('订单不存在');
    if (!options.sellerId && Number(order.buyer_id) !== Number(buyerId)) throw new Error('无权取消该订单');
    if (Number(order.order_status) === 4) {
      await conn.commit();
      return { order_no: orderNo, order_status: 4 };
    }
    if (![0, 1].includes(Number(order.order_status))) throw new Error('订单已进入交付或完成，不能取消');
    if (options.sellerId) {
      const [owners] = await conn.query('SELECT publisher_id FROM asset_publish_record WHERE id=?', [order.publish_id]);
      if (Number(owners[0]?.publisher_id) !== Number(options.sellerId)) throw new Error('无权拒绝该订单');
      if (Number(order.order_status) !== 1) throw new Error('只能拒绝已付款、待确认的订单');
    }
    if (Number(order.order_status) === 0) {
      await require('./alipay').closeUnpaidPaymentsForOrder(orderNo, conn);
    } else {
      const [payments] = await conn.query('SELECT status FROM wallet_order_payment WHERE order_no=? FOR UPDATE', [orderNo]);
      if (payments[0]?.status !== 'PAID') throw new Error('该订单不是可退回的余额付款');
      const [confirmed] = await conn.query("SELECT id FROM transactions WHERE order_no=? AND status='已确认' LIMIT 1", [orderNo]);
      if (confirmed.length) throw new Error('卖家已确认交易，不能直接退款');
      await require('./wallet').refundOrder(conn, orderNo, order.buyer_id);
    }

    const [assets] = await conn.query(
      'SELECT id, status FROM digital_asset WHERE id=? FOR UPDATE', [order.asset_id],
    );
    const [publishes] = await conn.query(
      'SELECT id, pricing_mode, publish_status, remaining_qty, sold_qty_total FROM asset_publish_record WHERE id=? FOR UPDATE',
      [order.publish_id],
    );
    const asset = assets[0];
    const publish = publishes[0];
    if (!asset || !publish) throw new Error('资产或上架记录不存在，无法恢复库存');
    const quantity = Number(order.buy_qty);
    if (Number(publish.sold_qty_total) < quantity) throw new Error('上架库存数据异常，无法取消订单');

    if (publish.pricing_mode === 'auction') {
      await conn.query(
        "UPDATE auction_settlement SET settlement_status='CANCELLED' WHERE order_no=?",
        [orderNo],
      );
      await conn.query(
        `UPDATE asset_publish_record SET sold_qty_total=sold_qty_total-?,
          publish_status=0, remaining_qty=0 WHERE id=?`, [quantity, publish.id],
      );
      await conn.query(
        'UPDATE digital_asset SET available_qty=LEAST(total_qty,available_qty+?), status=0 WHERE id=?',
        [quantity, asset.id],
      );
    } else if (Number(asset.status) === 1 && [1, 2].includes(Number(publish.publish_status))) {
      await conn.query(
        `UPDATE asset_publish_record SET remaining_qty=remaining_qty+?,
          sold_qty_total=sold_qty_total-?, publish_status=1 WHERE id=?`,
        [quantity, quantity, publish.id],
      );
    } else {
      await conn.query(
        'UPDATE asset_publish_record SET sold_qty_total=sold_qty_total-? WHERE id=?',
        [quantity, publish.id],
      );
      await conn.query(
        'UPDATE digital_asset SET available_qty=LEAST(total_qty,available_qty+?) WHERE id=?',
        [quantity, asset.id],
      );
    }
    await conn.query('UPDATE asset_order SET order_status=4 WHERE id=? AND order_status=?', [order.id, order.order_status]);
    if (Number(order.order_status) === 1) {
      await conn.query("UPDATE transactions SET status='已取消' WHERE order_no=? AND status<>'已确认'", [orderNo]);
      await conn.query("UPDATE digital_contracts SET status='已取消' WHERE order_no=? AND status<>'已生效'", [orderNo]);
    }
    await conn.commit();
    return { order_no: orderNo, order_status: 4 };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.deleteClosedOrder = async (orderNo, buyerId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT id, buyer_id, order_status, buyer_deleted_at FROM asset_order WHERE order_no=? FOR UPDATE',
      [orderNo],
    );
    const order = rows[0];
    if (!order) throw new Error('订单不存在');
    if (Number(order.buyer_id) !== Number(buyerId)) throw new Error('无权删除该订单');
    if (Number(order.order_status) !== 4) throw new Error('只有已关闭订单可以删除');
    if (!order.buyer_deleted_at) {
      await conn.query('UPDATE asset_order SET buyer_deleted_at=NOW() WHERE id=?', [order.id]);
    }
    await conn.commit();
    return { order_no: orderNo, deleted: true };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.sellerConfirmOrder = async (orderNo, sellerId, identity = '') => {
  if (!isSellerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅卖家可确认交易');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const order = await getOrderDeliveryContext(conn, orderNo);
    if (!order) throw new Error('订单不存在');
    if (!isAdminIdentity(identity) && Number(order.publisher_id) !== Number(sellerId)) {
      throw new Error('无权限确认该订单');
    }

    if (Number(order.order_status) === 0) {
      throw new Error('订单尚未支付确认，请先由买家在我的资产/购买记录中点击确认支付');
    }
    if (Number(order.order_status) !== 1) {
      throw new Error(`订单当前状态为${getOrderStatusLabel(order.order_status)}，不可确认交易`);
    }
    if ((await getCurrentTransactionStatus(conn, orderNo)) === '已确认') {
      throw new Error('交易已确认，请勿重复操作');
    }

    const refreshedOrder = {
      ...order,
      order_status: 1,
    };
    const transaction = await ensureTransactionForOrder(conn, refreshedOrder, {
      buyer_address: refreshedOrder.buyer_address,
      status: '已确认',
      processing_type: refreshedOrder.processing_type || normalizeProcessingType('', refreshedOrder.trade_mode),
      pc_type: refreshedOrder.pc_type || '',
      expiration_time: refreshedOrder.order_expiration_time,
      model_file_hash: refreshedOrder.file_hash,
    });
    const digitalContract = await upsertDigitalContractForOrder(conn, refreshedOrder, transaction, {
      status: '草稿',
      processing_type: refreshedOrder.processing_type || normalizeProcessingType('', refreshedOrder.trade_mode),
      pc_type: refreshedOrder.pc_type || '',
    });

    // 暂时跳过链上权益转移，避免 ChainMaker gRPC 不可达时阻塞本地订单确认。
    // 返回显式的 SKIPPED 状态，避免把本地确认误认为链上转移成功。
    const chainTransfer = services.skipChainOnSellerConfirm
      ? {
        action: 'SKIPPED',
        status: 'pending',
        reason: '卖家确认已完成，链上权益转移暂未执行',
        token_id: String(refreshedOrder.file_hash || '').trim(),
      }
      : await transferOrderRightOnChain(refreshedOrder, sellerId);

    if (chainTransfer.action === 'TransferFrom') {
      await conn.query(
        `
          UPDATE asset_chain_info
          SET owner_address = ?,
              last_sync_time = NOW()
          WHERE asset_id = ?
        `,
        [chainTransfer.to, refreshedOrder.asset_id],
      );
    }

    await conn.commit();
    return {
      order_no: orderNo,
      transaction,
      digital_contract: digitalContract,
      chain_transfer: chainTransfer,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.saveOrderContract = async (orderNo, operatorId, payload = {}, identity = '') => {
  if (!isSellerIdentity(identity) && !isAdminIdentity(identity)) {
    throw new Error('仅卖家可配置数字合约');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const order = await getOrderDeliveryContext(conn, orderNo);
    if (!order) throw new Error('订单不存在');
    if (!isAdminIdentity(identity) && Number(order.publisher_id) !== Number(operatorId)) {
      throw new Error('无权限配置该订单');
    }
    if (![1, 2].includes(Number(order.order_status))) {
      throw new Error('订单当前状态不可配置数字合约');
    }

    const orderPcType = requireDeliveryMethod(order.pc_type || 'HE');
    const contractPayload = {
      ...payload,
      pc_type: orderPcType,
    };
    const currentTransactionStatus = await getCurrentTransactionStatus(conn, orderNo);
    const transaction = await ensureTransactionForOrder(conn, order, {
      buyer_address: order.buyer_address,
      status: currentTransactionStatus || '待确认',
      processing_type: payload.processing_type || order.processing_type,
      pc_type: orderPcType,
      expiration_time: payload.expiration_time || order.order_expiration_time,
      model_file_hash: payload.model_file_hash,
      delivery_limit: payload.delivery_limit,
    });
    const digitalContract = await upsertDigitalContractForOrder(conn, order, transaction, contractPayload);

    await conn.commit();
    return {
      order_no: orderNo,
      transaction,
      digital_contract: digitalContract,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.bindBuyerDeliveryCertificate = async (orderNo, buyerId, payload = {}) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const order = await getOrderDeliveryContext(conn, orderNo);
    if (!order) throw new Error('订单不存在');
    if (Number(order.buyer_id) !== Number(buyerId)) throw new Error('无权限绑定该订单的买方证书');
    if (![1, 2].includes(Number(order.order_status))) {
      throw new Error('当前订单状态不可绑定买方证书');
    }

    const buyerCert = await certificateService.getDefaultTradeCertInfo(buyerId);
    const certificateName = String(buyerCert?.certificate_name || '').trim();
    const buyerAddress = String(buyerCert?.address || '').trim();
    if (!certificateName || !buyerAddress) {
      throw new Error('请先在个人中心设置默认交易证书');
    }

    await syncOrderBuyerAddress(conn, orderNo, buyerAddress);
    await conn.query(
      'UPDATE asset_order SET buyer_certificate_name = ? WHERE id = ?',
      [certificateName, order.id],
    );

    const refreshedOrder = {
      ...order,
      buyer_certificate_name: certificateName,
      buyer_address: buyerAddress,
    };
    const currentTransactionStatus = await getCurrentTransactionStatus(conn, orderNo);
    const transaction = await ensureTransactionForOrder(conn, refreshedOrder, {
      buyer_address: buyerAddress,
      status: Number(order.order_status) >= 2 ? '已交付' : currentTransactionStatus || '待确认',
      processing_type: refreshedOrder.processing_type || normalizeProcessingType('', refreshedOrder.trade_mode),
      pc_type: refreshedOrder.pc_type || '',
      expiration_time: refreshedOrder.order_expiration_time,
      model_file_hash: refreshedOrder.file_hash,
    });
    const digitalContract = await upsertDigitalContractForOrder(conn, refreshedOrder, transaction, {
      processing_type: refreshedOrder.processing_type || normalizeProcessingType('', refreshedOrder.trade_mode),
      pc_type: refreshedOrder.pc_type || '',
    });

    await conn.commit();
    return {
      order_no: orderNo,
      buyer_address: buyerAddress,
      certificate_name: certificateName,
      transaction,
      digital_contract: digitalContract,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.sellerDeliver = async (orderNo, sellerId, payload = {}) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (digitalContractService.isEnabled()) {
      await conn.query('SELECT order_no FROM asset_order WHERE order_no = ? FOR UPDATE', [orderNo]);
    }

    const order = await getOrderDeliveryContext(conn, orderNo);
    if (!order) throw new Error('订单不存在');
    if (Number(order.publisher_id) !== Number(sellerId)) throw new Error('无权限操作该订单');
    if (Number(order.order_status) !== 1) throw new Error('订单当前状态不可交付，请确认买家已付款');

    const buyerAddress = String(order.buyer_address || payload.buyer_address || '').trim();
    if (!buyerAddress) {
      throw new Error('订单缺少买家默认证书地址，无法发起交付');
    }

    let sellerAddress = String(order.seller_address || payload.seller_address || '').trim();
    let sellerCertificateName = String(order.seller_certificate_name || payload.seller_certificate_name || '').trim();
    if (!sellerAddress || !sellerCertificateName) {
      const defaultTradeCert = await getDefaultTradeCertInfoByUserId(sellerId);
      sellerCertificateName =
        sellerCertificateName || String(defaultTradeCert?.certificate_name || defaultTradeCert?.cert || '').trim();
      sellerAddress = sellerAddress || String(defaultTradeCert?.owner_address || defaultTradeCert?.address || '').trim();
    }
    if (!sellerAddress) {
      sellerAddress = String(order.owner_address || '').trim();
    }
    if (!sellerAddress || !sellerCertificateName) {
      throw new Error('请先在个人中心设置默认交易证书后再发起交付');
    }

    const refreshedOrder = {
      ...order,
      seller_certificate_name: sellerCertificateName,
      buyer_address: buyerAddress,
      owner_address: sellerAddress,
    };
    const orderPcType = requireDeliveryMethod(refreshedOrder.pc_type || 'HE');
    const deliveryPayload = {
      ...payload,
      pc_type: orderPcType,
    };
    const transaction = await ensureTransactionForOrder(conn, refreshedOrder, {
      buyer_address: buyerAddress,
      seller_address: sellerAddress,
      status: '已交付',
      processing_type: payload.processing_type || refreshedOrder.processing_type,
      pc_type: orderPcType,
      expiration_time: payload.expiration_time || refreshedOrder.order_expiration_time,
      model_file_hash: payload.model_file_hash,
      delivery_limit: payload.delivery_limit,
    });
    const digitalContract = await upsertDigitalContractForOrder(conn, refreshedOrder, transaction, deliveryPayload);
    if (digitalContractService.isEnabled()) {
      await digitalContractService.verifyForOrder(conn, orderNo, { id: sellerId });
    }
    const requestType = requireDeliveryMethod(digitalContract.pc_type || orderPcType);

    const deliveryRequest = await saveDeliveryRequest(conn, {
      transaction_id: transaction.transaction_id,
      order_no: order.order_no,
      buyer_address: transaction.buyer_address,
      seller_address: transaction.seller_address,
      request_type: requestType,
      vm_name: payload.vm_name,
      vm_cpu: payload.vm_cpu,
      vm_memory_mb: payload.vm_memory_mb,
      note: payload.note,
      status: 'APPROVED',
      requested_by: order.buyer_id,
      approved_by: sellerId,
    });
    const deliveryRecord = await appendDeliveryRecord(conn, {
      transaction_id: transaction.transaction_id,
      order_no: order.order_no,
      delivery_type: requestType,
      buyer_address: transaction.buyer_address,
      seller_address: transaction.seller_address,
      delivery_message:
        String(payload.note || '').trim() ||
        `卖家已发起 ${requestType} 交付流程`,
      result_status: requestType === 'TEE' ? 'PENDING' : 'PROCESSING',
      record_payload: {
        pc_type: digitalContract.pc_type,
        processing_type: digitalContract.processing_type,
        vm_name: payload.vm_name || null,
        vm_cpu: payload.vm_cpu || null,
        vm_memory_mb: payload.vm_memory_mb || null,
      },
    });

    await conn.query(
      `
        UPDATE transactions
        SET delivery_count = delivery_count + 1,
            updated_at = NOW()
        WHERE transaction_id = ?
      `,
      [transaction.transaction_id],
    );
    await conn.query(
      `
        UPDATE asset_order
        SET order_status = 2,
            buyer_address = ?,
            seller_delivery_time = NOW()
        WHERE id = ?
      `,
      [buyerAddress, order.id],
    );

    await conn.commit();
    return {
      order_no: orderNo,
      transaction_id: transaction.transaction_id,
      transaction_status: '已交付',
      digital_contract: digitalContract,
      delivery_request: deliveryRequest,
      delivery_record: deliveryRecord,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.confirmDelivery = async (orderNo, buyerId, _payload = {}) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      `
        SELECT
          ao.id,
          ao.asset_id,
          ao.buyer_id,
          ao.order_status,
          ao.order_no,
          t.transaction_id,
          t.status AS transaction_status,
          dc.pc_type,
          he.pcp_status AS he_pcp_status,
          he.download_token AS he_download_token,
          he.result_storage_path AS he_result_storage_path,
          pre.pcp_status AS pre_pcp_status,
          pre.download_token AS pre_download_token,
          pre.result_storage_path AS pre_result_storage_path,
          fl.pcp_status AS fl_pcp_status,
          fl.buyer_download_token AS fl_buyer_download_token,
          fl.buyer_result_storage_path AS fl_buyer_result_storage_path,
          mpc.task_status AS mpc_task_status
        FROM asset_order ao
        LEFT JOIN transactions t ON ao.order_no = t.order_no
        LEFT JOIN digital_contracts dc ON t.transaction_id = dc.transaction_id
        LEFT JOIN he_delivery_contracts he ON t.transaction_id = he.transaction_id
        LEFT JOIN pre_delivery_contracts pre ON t.transaction_id = pre.transaction_id
        LEFT JOIN fl_delivery_contracts fl ON t.transaction_id = fl.transaction_id
        LEFT JOIN mpc_delivery_contracts mpc ON t.transaction_id = mpc.transaction_id
        WHERE ao.order_no = ?
        LIMIT 1
        FOR UPDATE
      `,
      [orderNo],
    );
    const order = orderRows[0];
    if (!order) throw new Error('订单不存在');
    if (Number(order.buyer_id) !== Number(buyerId)) throw new Error('无权限确认该订单交付');
    if (Number(order.order_status) !== 2) throw new Error('订单当前状态不可确认交付，请等待卖家交付');

    const privacyReady = isPrivacyResultReady({
      digitalContract: { pc_type: order.pc_type },
      heRecord: {
        pcp_status: order.he_pcp_status,
        download_token: order.he_download_token,
        result_storage_path: order.he_result_storage_path,
      },
      preRecord: {
        pcp_status: order.pre_pcp_status,
        download_token: order.pre_download_token,
        result_storage_path: order.pre_result_storage_path,
      },
      flRecord: {
        pcp_status: order.fl_pcp_status,
        buyer_download_token: order.fl_buyer_download_token,
        buyer_result_storage_path: order.fl_buyer_result_storage_path,
      },
      mpcRecord: {
        task_status: order.mpc_task_status,
      },
    });
    if (!privacyReady) {
      throw new Error('当前隐私计算交付结果尚未就绪，不能确认完成');
    }

    await conn.query(
      `
        UPDATE asset_order
        SET order_status = 3,
            buyer_confirm_time = NOW()
        WHERE id = ?
      `,
      [order.id],
    );
    if (order.transaction_id) {
      await conn.query(
        `
          UPDATE transactions
          SET status = '已完成',
              updated_at = NOW()
          WHERE transaction_id = ?
        `,
        [order.transaction_id],
      );
      await conn.query(
        `
          UPDATE delivery_requests
          SET status = 'CONFIRMED',
              updated_at = NOW()
          WHERE transaction_id = ?
        `,
        [order.transaction_id],
      );
    }

    await conn.query('UPDATE digital_asset SET trade_count = trade_count + 1 WHERE id = ?', [order.asset_id]);

    await conn.commit();
    return {
      order_no: orderNo,
      transaction_id: order.transaction_id || '',
      message: '买家确认收货成功，订单已完成',
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.requestSecureDelivery = async (orderNo, buyerId, payload = {}) => {
  const order = await getBuyerDeliveryOrderContext(orderNo, buyerId);
  if (!order.transaction_id) throw new Error('交易不存在，无法申请交付');

  const buyerAddress = String(order.transaction_buyer_address || order.buyer_address || '').trim();
  const sellerAddress = String(order.transaction_seller_address || order.seller_address || '').trim();
  if (!buyerAddress || !sellerAddress) {
    throw new Error('交易地址信息不完整，无法申请交付');
  }

  const remoteData = await exports.requestSecureDeliveryCompatible({
    transactionId: String(order.transaction_id),
    buyerAddress,
    sellerAddress,
    assetId: order.asset_id,
    vmCpu: Number(payload.vm_cpu || payload.vmCpu || 2),
    vmMemoryMb: Number(payload.vm_memory_mb || payload.vmMemoryMb || 2048),
    vmName: String(payload.vm_name || payload.vmName || `tx-${order.transaction_id}-vm`).trim(),
    note: String(payload.note || '').trim(),
  });

  return {
    transaction_id: order.transaction_id,
    request_status: 'PENDING',
    remote: remoteData,
  };
};

exports.getDeliveryExportEligible = async (orderNo, buyerId) => {
  const order = await getBuyerDeliveryOrderContext(orderNo, buyerId);
  if (!order.transaction_id) throw new Error('交易不存在');

  const buyerAddress = String(order.transaction_buyer_address || order.buyer_address || '').trim();
  if (!buyerAddress) {
    return { can_download: false, item: null };
  }

  const remoteData = await exports.getVmExportEligibleCompatible({ buyerAddress });
  const items = Array.isArray(remoteData?.items) ? remoteData.items : [];
  const item = items.find((current) => String(current.transaction_id ?? current.transactionId ?? '') === String(order.transaction_id)) || null;

  return {
    can_download: Boolean(item),
    item,
  };
};

exports.downloadDeliveryResult = async (orderNo, buyerId, payload = {}) => {
  const order = await getBuyerDeliveryOrderContext(orderNo, buyerId);
  if (!order.transaction_id) throw new Error('交易不存在');

  return exports.exportVmCompatible({
    transaction_id: order.transaction_id,
    buyerAddress: String(order.transaction_buyer_address || order.buyer_address || '').trim(),
    filename: String(payload.filename || `encrypted_result_${order.transaction_id}`),
    receiverRole: 'buyer',
  });
};

exports.listOrders = async (query, userId, identity = '') => {
  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || 10);
  const offset = (page - 1) * pageSize;

  const where = [];
  const params = [];
  const identityRole = normalizeIdentityRole(identity);
  const requestedRole = String(query.order_role || 'both');
  const role =
    identityRole === 'seller'
      ? 'seller'
      : identityRole === 'buyer'
        ? 'buyer'
        : requestedRole;

  if (!isAdminIdentity(identity)) {
    if (role === 'buyer') {
      where.push('ao.buyer_id = ?');
      params.push(userId);
      where.push('ao.buyer_deleted_at IS NULL');
    } else if (role === 'seller') {
      where.push('apr.publisher_id = ?');
      params.push(userId);
    } else {
      where.push('(ao.buyer_id = ? OR apr.publisher_id = ?)');
      params.push(userId, userId);
    }
  }

  if (query.order_status !== undefined && query.order_status !== null && query.order_status !== '') {
    where.push('ao.order_status = ?');
    params.push(Number(query.order_status));
  }

  if (query.keyword) {
    where.push('(ao.order_no LIKE ? OR da.asset_name LIKE ? OR bu.account LIKE ? OR su.account LIKE ?)');
    params.push(`%${query.keyword}%`, `%${query.keyword}%`, `%${query.keyword}%`, `%${query.keyword}%`);
  }

  if (!where.length) {
    where.push('1 = 1');
  }

  const baseSql = `
    FROM asset_order ao
    LEFT JOIN digital_asset da ON ao.asset_id = da.id
    LEFT JOIN users bu ON ao.buyer_id = bu.id
    LEFT JOIN asset_publish_record apr ON ao.publish_id = apr.id
    LEFT JOIN users su ON apr.publisher_id = su.id
    WHERE ${where.join(' AND ')}
  `;

  const [countRows] = await pool.query(`SELECT COUNT(1) AS total ${baseSql}`, params);

  const [listRows] = await pool.query(
    `
      SELECT
        ao.id,
        ao.order_no,
        ao.publish_id,
        ao.asset_id,
        ao.buyer_id,
        ao.buy_qty,
        ao.deal_price,
        ao.trade_mode,
        ao.processing_type,
        ao.pc_type,
        ao.buyer_address,
        ao.order_status,
        ao.created_at,
        ao.updated_at,
        ao.payment_confirm_time,
        ao.seller_delivery_time,
        ao.buyer_confirm_time,
        (SELECT wop.status FROM wallet_order_payment wop WHERE wop.order_no=ao.order_no) AS wallet_payment_status,
        (SELECT t.status FROM transactions t WHERE t.order_no=ao.order_no LIMIT 1) AS transaction_status,
        da.asset_name,
        da.classification_category_name,
        da.classification_data_level,
        da.price_unit,
        IFNULL(bu.account, '') AS buyer_account,
        IFNULL(su.account, '') AS seller_account
      ${baseSql}
      ORDER BY ao.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset],
  );

  const enrichedRows = await attachDeliveryMeta(listRows);

  return {
    list: enrichedRows.map((row) => ({
      ...row,
      order_status_text: getOrderStatusLabel(row.order_status),
    })),
    pagination: {
      page,
      page_size: pageSize,
      total: countRows[0].total,
    },
  };
};

exports.getTransactionsByBuyerAddress = async (buyerAddress) => {
  const normalized = String(buyerAddress || '').trim();
  if (!normalized) return [];
  const [rows] = await pool.query(
    `
      SELECT
        t.*,
        ao.order_no,
        ao.order_status,
        ao.trade_mode,
        ao.buy_qty,
        ao.deal_price,
        da.asset_name,
        da.file_hash,
        da.description,
        da.classification_category_name,
        da.classification_data_level
      FROM transactions t
      LEFT JOIN asset_order ao ON t.order_no = ao.order_no
      LEFT JOIN digital_asset da ON ao.asset_id = da.id
      WHERE t.buyer_address = ?
      ORDER BY t.updated_at DESC, t.id DESC
    `,
    [normalized],
  );
  return rows || [];
};

exports.getTransactionsBySellerAddress = async (sellerAddress, { status } = {}) => {
  const normalized = String(sellerAddress || '').trim();
  if (!normalized) return [];
  const where = ['t.seller_address = ?'];
  const params = [normalized];
  if (status) {
    where.push('t.status = ?');
    params.push(String(status).trim());
  }
  const [rows] = await pool.query(
    `
      SELECT
        t.*,
        ao.order_no,
        ao.order_status,
        ao.trade_mode,
        ao.buy_qty,
        ao.deal_price,
        da.asset_name,
        da.file_hash,
        da.description,
        da.classification_category_name,
        da.classification_data_level
      FROM transactions t
      LEFT JOIN asset_order ao ON t.order_no = ao.order_no
      LEFT JOIN digital_asset da ON ao.asset_id = da.id
      WHERE ${where.join(' AND ')}
      ORDER BY t.updated_at DESC, t.id DESC
    `,
    params,
  );
  return rows || [];
};

exports.getSellerDeliveryRequestStatus = async (transactionId) => {
  const normalized = String(transactionId || '').trim();
  if (!normalized) return null;
  const [rows] = await pool.query(
    `
      SELECT
        dr.*,
        t.transaction_id,
        t.status AS transaction_status
      FROM delivery_requests dr
      LEFT JOIN transactions t ON dr.transaction_id = t.transaction_id
      WHERE dr.transaction_id = ?
      ORDER BY dr.id DESC
      LIMIT 1
    `,
    [normalized],
  );
  return rows[0] || null;
};

exports.verifyDigitalContract = async (payload = {}, actor = {}) => {
  digitalContractService.ensureEnabled();
  const txId = String(payload.transaction_id || payload.transactionId || '').trim();
  const contractId = String(payload.contract_id || '').trim();
  if (!txId && !contractId) {
    throw new Error('缺少 transaction_id 或 contract_id');
  }

  const where = [];
  const params = [];
  if (txId) {
    where.push('dc.transaction_id = ?');
    params.push(txId);
  }
  if (contractId) {
    where.push('dc.contract_id = ?');
    params.push(contractId);
  }

  const [rows] = await pool.query(
    `
      SELECT
        dc.*,
        t.status AS transaction_status,
        ao.order_status,
        ao.trade_mode,
        da.asset_name
      FROM digital_contracts dc
      LEFT JOIN transactions t ON dc.transaction_id = t.transaction_id
      LEFT JOIN asset_order ao ON dc.order_no = ao.order_no
      LEFT JOIN digital_asset da ON dc.asset_id = da.id
      WHERE ${where.join(' AND ')}
      ORDER BY dc.updated_at DESC, dc.id DESC
      LIMIT 1
    `,
    params,
  );

  const contract = rows[0] || null;
  if (!contract) {
    return {
      success: false,
      verified: false,
      message: '未找到数字合约',
    };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await digitalContractService.verifyForOrder(conn, contract.order_no, actor);
    await conn.commit();
    return result;
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
};

exports.getTransactionDetailByTransactionId = async (transactionId) => {
  const [rows] = await pool.query(
    `
      SELECT
        t.*,
        ao.order_no,
        ao.order_status,
        ao.trade_mode,
        ao.deal_price,
        ao.buy_qty,
        da.asset_name,
        da.description,
        da.file_hash,
        da.classification_category_name,
        da.classification_data_level
      FROM transactions t
      LEFT JOIN asset_order ao ON t.order_no = ao.order_no
      LEFT JOIN digital_asset da ON ao.asset_id = da.id
      WHERE t.transaction_id = ?
      LIMIT 1
    `,
    [transactionId],
  );
  return rows[0] || null;
};

exports.listAvailableAssetsCompatible = async (query = {}) => {
  const where = [
    'apr.publish_status = 1',
    'IFNULL(apr.remaining_qty, 0) > 0',
  ];
  const params = [];

  if (query.asset_category) {
    where.push('(da.classification_category_name = ? OR ac.category_name = ?)');
    params.push(query.asset_category, query.asset_category);
  }
  if (query.asset_type) {
    where.push('ascg.sub_category_name = ?');
    params.push(query.asset_type);
  }
  if (query.industry_raw_name && query.industry_raw_name !== 'ALL') {
    where.push('r.region_name = ?');
    params.push(query.industry_raw_name);
  }

  const [rows] = await pool.query(
    `
      SELECT
        da.id,
        da.asset_name,
        ascg.sub_category_name AS asset_type,
        da.classification_category_name AS asset_category,
        u.email,
        da.trade_region AS address,
        da.description,
        da.hash_algorithm AS algorithm,
        NULL AS custom_algorithm,
        da.file_hash,
        da.classification_category_name AS industry,
        da.picture,
        da.user_id,
        IFNULL(aci.owner_address, '') AS owner_address,
        IFNULL(aci.owner_address, '') AS current_owner_address,
        '' AS agent_addr,
        da.is_proxied,
        da.allow_resale,
        da.price,
        ac.category_name,
        r.region_name
      FROM digital_asset da
      INNER JOIN asset_publish_record apr ON apr.asset_id = da.id
      LEFT JOIN asset_category ac ON da.category_id = ac.id
      LEFT JOIN asset_sub_category ascg ON da.sub_category_id = ascg.id
      LEFT JOIN users u ON da.user_id = u.id
      LEFT JOIN asset_chain_info aci ON da.id = aci.asset_id
      LEFT JOIN region r ON da.region_id = r.id
      WHERE ${where.join(' AND ')}
      ORDER BY da.updated_at DESC, da.id DESC
    `,
    params,
  );

  return rows.map((row) => ({
    ...row,
    picture: toBase64Picture(row.picture),
  }));
};

exports.listResalableAssetsCompatible = async (query = {}) => {
  const nextQuery = {
    ...query,
  };
  const rows = await exports.listAvailableAssetsCompatible(nextQuery);
  return rows.filter((row) => Number(row.allow_resale || 0) === 1);
};

exports.requestVmCompatible = async (payload = {}) => {
  const transactionId = String(payload.transaction_id || payload.transactionId || '').trim();
  const buyerAddress = String(payload.buyer_address || payload.buyerAddress || '').trim();
  const sellerAddress = String(payload.seller_address || payload.sellerAddress || '').trim();
  const vmName = String(payload.vm_name || payload.vmName || '').trim();
  if (!transactionId || !buyerAddress || !sellerAddress || !vmName) {
    throw new Error('缺少必填字段 transaction_id / buyer_address / seller_address / vm_name');
  }

  const [txRows] = await pool.query(
    'SELECT order_no, buyer_id FROM transactions WHERE transaction_id = ? LIMIT 1',
    [transactionId],
  );
  const tx = txRows[0] || {};

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const saved = await saveDeliveryRequest(conn, {
      transaction_id: transactionId,
      order_no: tx.order_no || null,
      buyer_address: buyerAddress,
      seller_address: sellerAddress,
      request_type: String(payload.request_type || payload.requestType || 'TEE').trim().toUpperCase(),
      vm_name: vmName,
      vm_cpu: Number(payload.vm_cpu || payload.vmCpu || 2),
      vm_memory_mb: Number(payload.vm_memory_mb || payload.vmMemoryMb || 2048),
      note: String(payload.note || '').trim(),
      status: 'PENDING',
      requested_by: tx.buyer_id || null,
      approved_by: null,
    });
    await conn.commit();
    return {
      message: '交付申请已提交（待卖方审批）',
      request: saved,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.requestSecureDeliveryCompatible = async (payload = {}) => {
  const transactionId = String(payload.transactionId || payload.transaction_id || '').trim();
  if (!transactionId) throw new Error('缺少 transactionId');

  const [txRows] = await pool.query(
    `
      SELECT transaction_id, order_no, asset_id, buyer_id, buyer_address, seller_address, pc_type
      FROM transactions
      WHERE transaction_id = ?
      LIMIT 1
    `,
    [transactionId],
  );
  const tx = txRows[0];
  if (!tx) throw new Error('交易不存在');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const saved = await saveDeliveryRequest(conn, {
      transaction_id: transactionId,
      order_no: tx.order_no || null,
      buyer_address: String(payload.buyerAddress || tx.buyer_address || '').trim(),
      seller_address: String(payload.sellerAddress || tx.seller_address || '').trim(),
      request_type: String(tx.pc_type || payload.request_type || 'TEE').trim().toUpperCase(),
      vm_name: String(payload.vmName || payload.vm_name || `tx-${transactionId}-vm`).trim(),
      vm_cpu: Number(payload.vmCpu || payload.vm_cpu || 2),
      vm_memory_mb: Number(payload.vmMemoryMb || payload.vm_memory_mb || 2048),
      note: String(payload.note || '').trim(),
      status: 'PENDING',
      requested_by: tx.buyer_id || null,
      approved_by: null,
    });
    await conn.commit();
    return {
      success: true,
      message: '交付申请已提交',
      request: saved,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.secureConfirmCompatible = async (payload = {}) => {
  const transactionId = String(payload.transactionId || payload.transaction_id || '').trim();
  if (!transactionId) throw new Error('缺少 transactionId');

  const syntheticVmId = String(payload.vmId || payload.vm_id || `vm-tx-${transactionId}`).trim();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const saved = await saveDeliveryRequest(conn, {
      transaction_id: transactionId,
      status: 'APPROVED',
      vm_name: syntheticVmId,
      approved_by: payload.approved_by || null,
      note: String(payload.note || '虚机创建启动成功（本地兼容模式）').trim(),
    });
    await conn.query(
      `
        UPDATE transactions
        SET status = 'VM_RUNNING',
            updated_at = NOW()
        WHERE transaction_id = ?
      `,
      [transactionId],
    );
    await conn.commit();
    return {
      success: true,
      message: '虚机创建并启动成功',
      transactionId,
      vmId: syntheticVmId,
      status: 'VM_RUNNING',
      request: saved,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.testStartVmCompatible = async ({ vmId } = {}) => {
  const normalizedVmId = String(vmId || '').trim();
  if (!normalizedVmId) throw new Error('缺少 vmId');
  return {
    success: true,
    message: '虚机启动成功',
    vmId: normalizedVmId,
    status: 'running',
  };
};

async function loadTransactionsForBuyerAddress(buyerAddress) {
  const [rows] = await pool.query(
    `
      SELECT
        t.transaction_id,
        t.order_no,
        t.asset_id,
        t.buyer_address,
        t.seller_address,
        t.pc_type,
        t.status AS transaction_status,
        dc.contract_id,
        dc.pc_type AS contract_pc_type,
        he.pcp_status AS he_pcp_status,
        he.download_token AS he_download_token,
        he.result_storage_path AS he_result_storage_path,
        pre.pcp_status AS pre_pcp_status,
        pre.download_token AS pre_download_token,
        pre.result_storage_path AS pre_result_storage_path,
        fl.pcp_status AS fl_pcp_status,
        fl.buyer_download_token AS fl_buyer_download_token,
        fl.buyer_result_storage_path AS fl_buyer_result_storage_path,
        mpc.task_status AS mpc_task_status
      FROM transactions t
      LEFT JOIN digital_contracts dc ON t.transaction_id = dc.transaction_id
      LEFT JOIN he_delivery_contracts he ON t.transaction_id = he.transaction_id
      LEFT JOIN pre_delivery_contracts pre ON t.transaction_id = pre.transaction_id
      LEFT JOIN fl_delivery_contracts fl ON t.transaction_id = fl.transaction_id
      LEFT JOIN mpc_delivery_contracts mpc ON t.transaction_id = mpc.transaction_id
      WHERE t.buyer_address = ?
      ORDER BY t.updated_at DESC, t.id DESC
    `,
    [buyerAddress],
  );
  return rows;
}

exports.getVmExportEligibleCompatible = async ({ buyerAddress } = {}) => {
  const normalizedBuyerAddress = String(buyerAddress || '').trim();
  if (!normalizedBuyerAddress) {
    return { success: true, items: [] };
  }

  const rows = await loadTransactionsForBuyerAddress(normalizedBuyerAddress);
  const items = rows
    .filter((row) => isPrivacyResultReady({
      digitalContract: { pc_type: row.contract_pc_type || row.pc_type },
      heRecord: {
        pcp_status: row.he_pcp_status,
        download_token: row.he_download_token,
        result_storage_path: row.he_result_storage_path,
      },
      preRecord: {
        pcp_status: row.pre_pcp_status,
        download_token: row.pre_download_token,
        result_storage_path: row.pre_result_storage_path,
      },
      flRecord: {
        pcp_status: row.fl_pcp_status,
        buyer_download_token: row.fl_buyer_download_token,
        buyer_result_storage_path: row.fl_buyer_result_storage_path,
      },
      mpcRecord: {
        task_status: row.mpc_task_status,
      },
    }))
    .map((row) => ({
      transaction_id: row.transaction_id,
      order_no: row.order_no,
      buyer_address: row.buyer_address,
      seller_address: row.seller_address,
      pc_type: normalizePcType(row.contract_pc_type || row.pc_type) || 'TEE',
      status: row.transaction_status,
      contract_id: row.contract_id || null,
    }));

  return {
    success: true,
    items,
  };
};

exports.exportVmCompatible = async (payload = {}) => {
  const transactionId = String(payload.transaction_id || payload.transactionId || '').trim();
  if (!transactionId) throw new Error('缺少 transaction_id');

  const [txRows] = await pool.query(
    `
      SELECT
        t.transaction_id,
        t.buyer_address,
        t.seller_address,
        t.pc_type,
        dc.contract_id,
        dc.pc_type AS contract_pc_type,
        mpc.result_json
      FROM transactions t
      LEFT JOIN digital_contracts dc ON t.transaction_id = dc.transaction_id
      LEFT JOIN mpc_delivery_contracts mpc ON t.transaction_id = mpc.transaction_id
      WHERE t.transaction_id = ?
      LIMIT 1
    `,
    [transactionId],
  );
  const tx = txRows[0];
  if (!tx) throw new Error('交易不存在');

  const pcType = normalizePcType(tx.contract_pc_type || tx.pc_type) || 'TEE';
  const fileBaseName = String(payload.filename || `delivery_result_${transactionId}`).trim() || `delivery_result_${transactionId}`;

  if (pcType === 'HE') {
    const response = await loggedFetch(`${LOCAL_BACK_BASE_URL}/api/privacy/he/result?transactionId=${encodeURIComponent(transactionId)}`, {}, 'asset-he-result');
    if (!response.ok) throw new Error(await response.text() || 'HE 结果下载失败');
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      filename: `${fileBaseName}.csv`,
      contentType: response.headers.get('content-type') || 'text/csv; charset=utf-8',
    };
  }

  if (pcType === 'PRE') {
    const response = await loggedFetch(`${LOCAL_BACK_BASE_URL}/api/privacy/pre/result?transactionId=${encodeURIComponent(transactionId)}`, {}, 'asset-pre-result');
    if (!response.ok) throw new Error(await response.text() || 'PRE 结果下载失败');
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      filename: `${fileBaseName}.tar`,
      contentType: response.headers.get('content-type') || 'application/x-tar',
    };
  }

  if (pcType === 'FL') {
    const response = await loggedFetch(
      `${LOCAL_BACK_BASE_URL}/api/privacy/fl/result?transactionId=${encodeURIComponent(transactionId)}&receiverRole=buyer`
    );
    if (!response.ok) throw new Error(await response.text() || 'FL 结果下载失败');
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      filename: `${fileBaseName}.zip`,
      contentType: response.headers.get('content-type') || 'application/zip',
    };
  }

  if (pcType === 'MPC') {
    const result = tx.result_json ? JSON.parse(tx.result_json) : {};
    return {
      buffer: Buffer.from(JSON.stringify(result, null, 2), 'utf8'),
      filename: `${fileBaseName}.json`,
      contentType: 'application/json; charset=utf-8',
    };
  }

  if (!TEE_EXPORT_BASE_URL) {
    throw new Error('当前 back 未配置 TEE_EXPORT_BASE_URL，无法下载 TEE 交付结果');
  }

  const response = await loggedFetch(`${TEE_EXPORT_BASE_URL.replace(/\/$/, '')}/api/vm/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vmId: payload.vmId || 1,
      format: payload.format || 'bin',
      filename: fileBaseName,
      purpose: payload.purpose || 'export',
      transaction_id: transactionId,
    }),
  });
  if (!response.ok) {
    throw new Error((await response.text()) || `TEE 结果下载失败：${response.status}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    filename: `${fileBaseName}.bin`,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
};

exports.recordDeliveryCompatible = async (payload = {}) => {
  const transactionId = String(payload.transaction_id || payload.transactionId || '').trim();
  if (!transactionId) throw new Error('缺少 transaction_id');

  const [txRows] = await pool.query(
    'SELECT order_no, buyer_address, seller_address FROM transactions WHERE transaction_id = ? LIMIT 1',
    [transactionId],
  );
  const tx = txRows[0];
  if (!tx?.order_no) throw new Error('交易未关联订单');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const record = await appendDeliveryRecord(conn, {
      transaction_id: transactionId,
      order_no: tx.order_no,
      buyer_address: String(payload.buyer_address || tx.buyer_address || '').trim() || null,
      seller_address: String(payload.seller_address || tx.seller_address || '').trim() || null,
      action: String(payload.action || payload.delivery_action || 'DOWNLOAD').trim().toUpperCase(),
      status: String(payload.status || 'SUCCESS').trim().toUpperCase(),
      record_payload: payload,
    });
    await conn.commit();
    return { success: true, record };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.listPrivacyResultsCompatible = async ({ buyerCertAddr } = {}) => {
  const normalizedBuyerAddress = String(buyerCertAddr || '').trim();
  const eligible = await exports.getVmExportEligibleCompatible({ buyerAddress: normalizedBuyerAddress });
  return {
    success: true,
    items: eligible.items.map((item) => ({
      id: item.transaction_id,
      transaction_id: item.transaction_id,
      contract_id: item.contract_id || '',
      buyer_id: item.buyer_address,
      seller_id: item.seller_address,
      pc_type: item.pc_type,
      status: item.status,
    })),
  };
};

exports.publishAssetToDataCatalogCompatible = async (payload = {}) => {
  const identifier = String(payload.identifier || '').trim();
  const assetName = String(payload.assetName || '').trim();
  const description = String(payload.description || '').trim();
  const assetType = String(payload.assetType || '').trim();
  const userId = Number(payload.userId || 0) || null;
  let certOrg = String(payload.certOrg || '').trim();

  if (!identifier) throw new Error('缺少 identifier');
  if (!assetName) throw new Error('缺少 assetName');

  if (!certOrg && userId) {
    const certInfo = await getDefaultRegisterCertInfoByUserId(userId);
    certOrg = String(certInfo?.org || '').trim();
  }
  if (!certOrg) {
    throw new Error('无法确定目录发布使用的组织信息');
  }

  const catalogKey = buildDataCatalogKey(identifier);
  const requestBody = {
    id: catalogKey,
    code: catalogKey,
    name: assetName,
    remark: description || assetName,
    orgId: certOrg,
    orgDID: DATA_CATALOG_ORG_DID,
    version: 1,
    dataVersion: '1',
    status: 1,
    asseType: assetType || '',
    platform_name: DATA_CATALOG_PLATFORM_NAME,
    platform_DID: DATA_CATALOG_PLATFORM_DID,
    platform_url: DATA_CATALOG_PLATFORM_URL,
    chain_type: 'Chainmaker',
  };

  const response = await fetchRemoteJson(
    `${DATA_CATALOG_BASE_URL}/contract/datacatalog/publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    },
  );

  return {
    success: true,
    message: '目录发布成功',
    sourceIdentifier: identifier,
    catalogIdentifier: catalogKey,
    payload: requestBody,
    result: response,
  };
};

exports.sellerConfirmTransactionCompatible = async ({ seller_address, transaction_id, isAgree }) => {
  if (!transaction_id) throw new Error('缺少 transaction_id');
  if (typeof isAgree !== 'boolean') throw new Error('缺少 isAgree');
  if (!isAgree) throw new Error('当前仅支持确认交易');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const order = await getOrderDeliveryContextByTransactionId(conn, transaction_id);
    if (!order) throw new Error('交易不存在');
    if (
      seller_address &&
      String(order.seller_address || order.owner_address || '').trim() !== String(seller_address).trim()
    ) {
      throw new Error('卖方地址不匹配');
    }

    if (Number(order.order_status) === 0) {
      throw new Error('订单尚未支付确认，请先由买家在我的资产/购买记录中点击确认支付');
    }
    if (Number(order.order_status) !== 1) {
      throw new Error(`订单当前状态为${getOrderStatusLabel(order.order_status)}，不可确认交易`);
    }

    await conn.query(
      `
        UPDATE transactions
        SET status = '已确认',
            seller_address = ?,
            updated_at = NOW()
        WHERE transaction_id = ?
      `,
      [String(order.seller_address || order.owner_address || '').trim(), transaction_id],
    );

    const refreshedOrder = {
      ...order,
      order_status: 1,
    };
    const transaction = await ensureTransactionForOrder(conn, refreshedOrder, {
      buyer_address: refreshedOrder.buyer_address,
      seller_address: refreshedOrder.seller_address || refreshedOrder.owner_address,
      status: '已确认',
      quality: refreshedOrder.quality || refreshedOrder.classification_data_level || '',
      processing_type:
        refreshedOrder.transaction_processing_type ||
        refreshedOrder.processing_type ||
        normalizeProcessingType('', refreshedOrder.trade_mode),
      pc_type: refreshedOrder.transaction_pc_type || refreshedOrder.pc_type || '',
      expiration_time:
        refreshedOrder.transaction_expiration_time ||
        refreshedOrder.order_expiration_time ||
        null,
      model_file_hash: refreshedOrder.transaction_model_file_hash || refreshedOrder.file_hash || '',
    });
    const digitalContract = await upsertDigitalContractForOrder(conn, refreshedOrder, transaction, {
      contract_id: `CONTRACT-${transaction.transaction_id}`,
      contract_name: `${refreshedOrder.asset_name || '数字产品'}-数字合约`,
      product_name: refreshedOrder.asset_name || '未知产品',
      token_id: refreshedOrder.file_hash || refreshedOrder.asset_id,
      contract_description:
        refreshedOrder.description ||
        '该数字合约依据平台交易信息自动生成，用于界定交易双方权责与限制条件。',
      operations: buildOperationsFromQuality(
        refreshedOrder.quality || refreshedOrder.classification_data_level || '',
        refreshedOrder.trade_mode,
      ),
      expiration_time:
        refreshedOrder.transaction_expiration_time ||
        refreshedOrder.order_expiration_time ||
        null,
      quantity_limit: transaction.quantity || refreshedOrder.buy_qty || 1,
      processing_type:
        refreshedOrder.transaction_processing_type ||
        refreshedOrder.processing_type ||
        normalizeProcessingType('', refreshedOrder.trade_mode),
      pc_type: refreshedOrder.transaction_pc_type || refreshedOrder.pc_type || '',
      model_file_hash: refreshedOrder.transaction_model_file_hash || refreshedOrder.file_hash || '',
      status: '草稿',
    });

    await conn.commit();
    return {
      status: '已确认',
      transaction,
      digital_contract: digitalContract,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.saveDigitalContractCompatible = async (payload = {}) => {
  const transactionId = String(payload.transaction_id || '').trim();
  if (!transactionId) throw new Error('缺少 transaction_id');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const order = await getOrderDeliveryContextByTransactionId(conn, transactionId);
    if (!order) throw new Error('交易不存在');

    const transaction = await ensureTransactionForOrder(conn, order, {
      buyer_address: payload.buyer_address || order.buyer_address,
      seller_address: payload.seller_address || order.seller_address || order.owner_address,
      status: order.transaction_status || '已确认',
      quality: order.quality || order.classification_data_level || '',
      processing_type:
        payload.processing_type ||
        order.transaction_processing_type ||
        order.processing_type ||
        normalizeProcessingType('', order.trade_mode),
      pc_type: payload.pc_type || order.transaction_pc_type || order.pc_type || '',
      expiration_time:
        payload.expiration_time ||
        order.transaction_expiration_time ||
        order.order_expiration_time ||
        null,
      model_file_hash: payload.model_file_hash || order.transaction_model_file_hash || order.file_hash || '',
      quantity: payload.quantity_limit || order.buy_qty || 1,
    });

    const digitalContract = await upsertDigitalContractForOrder(conn, order, transaction, {
      contract_id: payload.contract_id || `CONTRACT-${transaction.transaction_id}`,
      contract_name: payload.contract_name || `${order.asset_name || '数字产品'}-数字合约`,
      product_name: payload.product_name || order.asset_name || '未知产品',
      token_id: payload.token_id || order.file_hash || order.asset_id,
      contract_description:
        payload.contract_description ||
        order.description ||
        '该数字合约依据平台交易信息自动生成，用于界定交易双方权责与限制条件。',
      operations:
        payload.operations ||
        buildOperationsFromQuality(order.quality || order.classification_data_level || '', order.trade_mode),
      expiration_time:
        payload.expiration_time ||
        order.transaction_expiration_time ||
        order.order_expiration_time ||
        null,
      quantity_limit: payload.quantity_limit || transaction.quantity || order.buy_qty || 1,
      processing_type:
        payload.processing_type ||
        order.transaction_processing_type ||
        order.processing_type ||
        normalizeProcessingType('', order.trade_mode),
      pc_type: payload.pc_type || order.transaction_pc_type || order.pc_type || '',
      model_file_hash: payload.model_file_hash || order.transaction_model_file_hash || order.file_hash || '',
      status: payload.status || '草稿',
    });

    await conn.commit();
    return digitalContract;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};
