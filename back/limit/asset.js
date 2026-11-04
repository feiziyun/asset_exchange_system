const joi = require('joi');

const id = joi.number().integer().positive().required();
const page = joi.number().integer().min(1).default(1);
const pageSize = joi.number().integer().min(1).max(100).default(10);
const optionalId = joi.number().integer().positive();
const orderNo = joi.string().max(40).required();

exports.classifyAsset_limit = {
  body: {
    method_name: joi.string().trim().min(1).max(50).required(),
    text: joi.string().trim().min(2).max(5000).required(),
  },
};

exports.saveValuationRecord_limit = {
  body: {
    asset_id: joi.number().integer().positive().allow(null),
    fileHash: joi.string().trim().max(128).allow('').default(''),
    assetName: joi.string().trim().max(100).allow('').default(''),
    methodKey: joi.string().trim().max(40).required(),
    methodName: joi.string().trim().max(100).required(),
    finalValuation: joi.number().allow(null).required(),
    valuationUnit: joi.string().trim().max(20).default('万元'),
    calcStatus: joi.number().integer().valid(0, 1).default(1),
    statusMessage: joi.string().trim().max(200).allow('').default(''),
    inputSnapshot: joi.object().required(),
    resultSnapshot: joi.object().required(),
    createdByUsername: joi.string().trim().max(100).allow('').default(''),
  },
};

exports.registerAsset_limit = {
  body: {
    asset_name: joi.string().max(100).required(),
    brief: joi.string().max(300).allow('').default(''),
    description: joi.string().allow('').default(''),
    category_id: joi.number().integer().positive(),
    sub_category_id: joi.number().integer().positive(),
    sub_category_name: joi.string().max(100).allow('').default(''),
    custom_sub_category_name: joi.string().max(100).allow('').default(''),
    region_id: joi.number().integer().positive().required(),

    file_hash: joi.string().max(128).required(),
    hash_algorithm: joi.string().max(30).default('SHA2_256'),
    cover_image_url: joi.string().max(500).allow('').default(''),
    file_size: joi.number().integer().min(0).default(0),
    file_format: joi.string().max(30).allow('').default(''),

    price: joi.number().min(0).default(0),
    price_unit: joi.string().max(10).default('人民币'),
    total_qty: joi.number().integer().valid(1).default(1),
    available_qty: joi.number().integer().valid(1).default(1),
    is_divisible: joi.number().integer().valid(0).default(0),
    classification_category_name: joi.string().max(100).allow('').default(''),
    classification_data_level: joi.string().max(100).allow('').default(''),
    pc_type: joi.string().valid('HE', 'PRE', 'FL', 'MPC').default('HE'),
    pricing_mode: joi.string().valid('fixed', 'auction').default('fixed'),
    auction_start_price: joi.number().min(0).allow('', null),
    auction_end_time: joi.alternatives().try(joi.string().allow('', null), joi.date().allow(null)),
    omniprint_fingerprint: joi.string().allow('').default(''),
    omniprint_fingerprint_bits: joi.number().integer().min(1).allow('', null),
    omniprint_modality: joi.string().valid('text', 'image', 'audio', 'video').allow('').default(''),
    omniprint_source: joi.string().valid('file').allow('').default(''),

    can_sell_ownership: joi.number().integer().valid(0, 1).default(0),
    can_sell_view_right: joi.number().integer().valid(0, 1).default(0),
    can_sell_process_right: joi.number().integer().valid(0, 1).default(0),
    allow_resale: joi.number().integer().valid(0, 1, 2).default(0),
    is_proxied: joi.number().integer().valid(0, 1).default(0),
    is_third_party: joi.number().integer().valid(0, 1).default(0),

    trade_region: joi.string().max(100).allow('').default(''),

    collect_time_start: joi.date().allow(null),
    collect_time_end: joi.date().allow(null),
    collect_location: joi.string().max(200).allow('').default(''),
    sensor_type: joi.string().max(100).allow('').default(''),
    data_volume: joi.string().max(50).allow('').default(''),

    certificate_name: joi.string().max(100).allow('').default(''),
    owner_address: joi.string().max(128).allow('').default(''),
    org_name: joi.string().max(100).allow('').default('wx-org1.chainmaker.org'),

    // 兼容原系统字段
    assetName: joi.string().max(100).allow(''),
    assetType: joi.string().max(100).allow(''),
    fileHash: joi.string().max(128).allow(''),
    algorithm: joi.string().max(30).allow(''),
    customAlgorithm: joi.string().max(60).allow(''),
    picture: joi.string().max(500).allow(''),
    email: joi.string().max(100).allow(''),
    address: joi.string().max(200).allow(''),
    industry: joi.string().max(30).allow('').default('WH'),
    industry_raw: joi.string().max(30).allow('').default('WH'),
    industry_raw_name: joi.string().max(100).allow('').default('自动驾驶数字资产'),
    modelSelection: joi.string().max(100).allow('').default(''),
    model_selection: joi.string().max(100).allow('').default(''),
    can_sell_asset: joi.number().integer().valid(0, 1),
    can_sell_view: joi.number().integer().valid(0, 1),
    can_sell_process: joi.number().integer().valid(0, 1),
    isProxied: joi.boolean(),
    selectedCertificate: joi.string().max(100).allow(''),
    allowedLocations: joi.array().items(joi.object()),
    status: joi.number().integer().valid(0, 1, 2).default(0),
  },
};

exports.createSubCategory_limit = {
  body: {
    category_id: joi.number().integer().positive().required(),
    sub_category_name: joi.string().trim().min(1).max(100).required(),
    sub_category_desc: joi.string().allow('').max(200).default(''),
  },
};

exports.listAsset_limit = {
  query: {
    page,
    page_size: pageSize,
    keyword: joi.string().allow('').default(''),
    category_id: joi.number().integer().positive(),
    sub_category_id: joi.number().integer().positive(),
    region_id: joi.number().integer().positive(),
    classification_category_name: joi.string().max(100),
    classification_data_level: joi.string().max(100).allow(''),
    status: joi.number().integer().valid(0, 1, 2),
    sort_by: joi.string().valid('created_at', 'price', 'view_count').default('created_at'),
    sort_order: joi.string().valid('asc', 'desc').default('desc'),
  },
};

exports.assetDetail_limit = {
  params: {
    id,
  },
};

exports.myListAsset_limit = {
  query: {
    page,
    page_size: pageSize,
    scope: joi.string().valid('my', 'all').default('my'),
    keyword: joi.string().allow('').default(''),
    category_id: optionalId,
    sub_category_id: optionalId,
    region_id: optionalId,
    classification_category_name: joi.string().max(100),
    classification_data_level: joi.string().max(100).allow(''),
    status: joi.number().integer().valid(0, 1, 2),
    sort_by: joi.string().valid('created_at', 'price', 'view_count').default('created_at'),
    sort_order: joi.string().valid('asc', 'desc').default('desc'),
  },
};

exports.updateAsset_limit = {
  params: {
    id,
  },
  body: {
    asset_name: joi.string().max(100),
    brief: joi.string().max(300).allow(''),
    description: joi.string().allow(''),
    category_id: optionalId,
    sub_category_id: optionalId,
    region_id: optionalId,

    cover_image_url: joi.string().max(500).allow(''),
    file_size: joi.number().integer().min(0),
    file_format: joi.string().max(30).allow(''),
    classification_category_name: joi.string().max(100).allow(''),
    classification_data_level: joi.string().max(100).allow(''),
    pc_type: joi.string().valid('HE', 'PRE', 'FL', 'MPC'),
    pricing_mode: joi.string().valid('fixed', 'auction'),
    auction_start_price: joi.number().min(0).allow(null),
    auction_end_time: joi.alternatives().try(joi.string().allow('', null), joi.date().allow(null)),

    price: joi.number().min(0),
    price_unit: joi.string().max(10),
    total_qty: joi.number().integer().valid(1),
    available_qty: joi.number().integer().valid(0, 1),

    can_sell_ownership: joi.number().integer().valid(0, 1),
    can_sell_view_right: joi.number().integer().valid(0, 1),
    can_sell_process_right: joi.number().integer().valid(0, 1),
    allow_resale: joi.number().integer().valid(0, 1, 2),
    is_proxied: joi.number().integer().valid(0, 1),
    is_third_party: joi.number().integer().valid(0, 1),

    trade_region: joi.string().max(100).allow(''),

    collect_time_start: joi.date().allow(null),
    collect_time_end: joi.date().allow(null),
    collect_location: joi.string().max(200).allow(''),
    sensor_type: joi.string().max(100).allow(''),
    data_volume: joi.string().max(50).allow(''),

    certificate_name: joi.string().max(100).allow(''),
  },
};

exports.updateAssetStatus_limit = {
  params: {
    id,
  },
  body: {
    status: joi.number().integer().valid(0, 1, 2).required(),
  },
};

exports.proxyCustody_limit = {
  params: {
    id,
  },
  body: {
    target_address: joi.string().trim().min(1).max(128).required(),
    quantity: joi.number().integer().min(1).default(1),
  },
};

exports.publishAsset_limit = {
  body: {
    asset_id: id,
    publish_price: joi.number().min(0).required(),
    publish_qty: joi.number().integer().min(1).required(),
    pricing_mode: joi.string().valid('fixed', 'auction').default('fixed'),
    auction_start_price: joi.number().min(0).allow(null),
    auction_end_time: joi.alternatives().try(joi.string().allow('', null), joi.date().allow(null)),
  },
};

exports.createOrder_limit = {
  body: {
    publish_id: id,
    buy_qty: joi.number().integer().min(1).required(),
    trade_mode: joi.string().valid('ownership', 'view', 'process').default('ownership'),
    buyer_address: joi.string().max(128).allow('').default(''),
    processing_type: joi.string().max(32).allow('').default(''),
    expiration_time: joi.alternatives().try(joi.string().allow('', null), joi.date().allow(null)),
    pc_type: joi.string().valid('HE', 'PRE', 'FL', 'MPC'),
  },
};

exports.createOrderByAsset_limit = {
  body: {
    asset_id: id,
    buy_qty: joi.number().integer().min(1).required(),
    trade_mode: joi.string().valid('ownership', 'view', 'process').default('ownership'),
    buyer_address: joi.string().max(128).allow('').default(''),
    processing_type: joi.string().max(32).allow('').default(''),
    expiration_time: joi.alternatives().try(joi.string().allow('', null), joi.date().allow(null)),
    pc_type: joi.string().valid('HE', 'PRE', 'FL', 'MPC'),
  },
};

exports.payOrder_limit = {
  params: {
    order_no: orderNo,
  },
  body: {
    buyer_address: joi.string().max(128).allow('').default(''),
  },
};

exports.sellerConfirmOrder_limit = {
  params: {
    order_no: orderNo,
  },
};

exports.saveContract_limit = {
  params: {
    order_no: orderNo,
  },
  body: {
    contract_name: joi.string().max(255).allow('').default(''),
    product_name: joi.string().max(255).allow('').default(''),
    contract_description: joi.string().allow('').default(''),
    operations: joi.string().max(255).allow('').default(''),
    expiration_time: joi.date().allow(null),
    quantity_limit: joi.number().integer().min(1).allow(null),
    processing_type: joi.string().max(32).allow('').default(''),
    pc_type: joi.string().valid('HE', 'PRE', 'FL', 'MPC'),
    model_file_hash: joi.string().max(128).allow('').default(''),
    delivery_limit: joi.number().integer().min(1).max(100).default(1),
  },
};

exports.sellerDeliver_limit = {
  params: {
    order_no: orderNo,
  },
  body: {
    contract_name: joi.string().max(255).allow('').default(''),
    product_name: joi.string().max(255).allow('').default(''),
    contract_description: joi.string().allow('').default(''),
    operations: joi.string().max(255).allow('').default(''),
    expiration_time: joi.date().allow(null),
    quantity_limit: joi.number().integer().min(1).allow(null),
    processing_type: joi.string().max(32).allow('').default(''),
    pc_type: joi.string().valid('HE', 'PRE', 'FL', 'MPC'),
    buyer_address: joi.string().max(128).allow('').default(''),
    seller_address: joi.string().max(128).allow('').default(''),
    note: joi.string().max(500).allow('').default(''),
    vm_name: joi.string().max(100).allow('').default(''),
    vm_cpu: joi.number().integer().min(1).max(128).allow(null),
    vm_memory_mb: joi.number().integer().min(128).max(1048576).allow(null),
    model_file_hash: joi.string().max(128).allow('').default(''),
    delivery_limit: joi.number().integer().min(1).max(100).default(1),
  },
};

exports.confirmDelivery_limit = {
  params: {
    order_no: orderNo,
  },
  body: {
    trade_mode: joi.string().valid('ownership', 'view', 'process').default('ownership'),
    buyer_address: joi.string().max(128).allow('').default(''),
  },
};

exports.listOrder_limit = {
  query: {
    page,
    page_size: pageSize,
    keyword: joi.string().allow('').default(''),
    order_status: joi.number().integer().valid(0, 1, 2, 3, 4, 5, 6),
    order_role: joi.string().valid('buyer', 'seller', 'both').default('both'),
  },
};
