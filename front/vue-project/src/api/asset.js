import instance from '@/http/index.js'

// 资产登记
export const registerAsset = (data) => {
  return instance.post('/asset/register', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
  })
}

// 分类分级
export const classifyAsset = (data) => {
  return instance.post('/asset/classify', data)
}

// 资产元数据（地区 / 大类 / 子类 / 分类分级选项）
export const getAssetMeta = () => {
  return instance.get('/asset/meta')
}

export const saveAssetValuationRecord = (data) => {
  return instance.post('/asset/valuation/record', data)
}

export const createAssetSubCategory = (data) => {
  return instance.post('/asset/sub-category', data)
}

// 生成文件哈希（1015c流程）
export const generateAssetHash = (formData) => {
  return instance.post('/asset/generate-hash', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const generateAssetFingerprint = (formData) => {
  return instance.post('/asset/generate-fingerprint', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const checkOmniPrintSimilarity = (data) => {
  return instance.post('/asset/omniprint/similarity-check', data)
}

// 资产展示（列表）
export const getAssetList = (params) => {
  return instance.get('/asset/list', { params })
}

// 首页统计
export const getHomeStats = () => {
  return instance.get('/asset/home/stats')
}

export const getChainTPS = () => {
  return instance.get('/api/get-tps', { timeout: 910000 })
}

// 资产详情
export const getAssetDetail = (id) => {
  return instance.get(`/asset/detail/${id}`)
}

// 当前用户资产列表
export const getMyAssetList = (params) => {
  return instance.get('/asset/my/list', { params })
}

// 编辑资产
export const updateAsset = (id, data) => {
  return instance.put(`/asset/manage/${id}`, data)
}

// 修改资产状态
export const updateAssetStatus = (id, status) => {
  return instance.patch(`/asset/manage/${id}/status`, { status })
}

export const proxyCustodyAsset = (id, data) => {
  return instance.post(`/asset/manage/${id}/proxy-custody`, data, {
    timeout: 0,
  })
}

export const delegateAsset = (data) => instance.post('/api/delegate-asset', data, { timeout: 0 })
export const revokeDelegation = (data) => instance.post('/api/revoke-delegation', data, { timeout: 0 })
export const getAgentDelegations = (agentUserId) => instance.get('/api/agent-delegations', { params: { agentUserId } })
export const getOwnerDelegations = () => instance.get('/api/owner-delegations')
export const proxyTransfer = (data) => instance.post('/api/proxy-transfer', data, { timeout: 0 })

// 资产上架
export const publishAsset = (data) => {
  return instance.post('/asset/publish', data)
}

export const getAuction = (assetId) => {
  return instance.get(`/asset/auction/${assetId}`)
}

export const getAuctionBids = (assetId) => {
  return instance.get(`/asset/auction/${assetId}/bids`)
}

export const placeAuctionBid = (assetId, bidPrice) => {
  return instance.post(`/asset/auction/${assetId}/bid`, { bid_price: bidPrice })
}

export const settleAuction = (assetId) => {
  return instance.post(`/asset/auction/${assetId}/settle`)
}

export const getMyWonAuctions = () => {
  return instance.get('/asset/auction/won/me')
}

// 下单
export const createOrder = (data) => {
  return instance.post('/asset/order/create', data)
}

// 从资产详情直接下单
export const createOrderByAsset = (data) => {
  return instance.post('/asset/order/create-by-asset', data)
}

export const createAlipayPayment = (orderNo) => {
  return instance.post(`/asset/order/alipay/create/${encodeURIComponent(orderNo)}`)
}

export const getPaymentMode = () => {
  return instance.get('/asset/order/alipay/mode')
}

export const payOrder = (orderNo) => {
  return instance.post(`/asset/order/pay/${encodeURIComponent(orderNo)}`)
}

export const cancelOrder = (orderNo) => {
  return instance.post(`/asset/order/cancel/${encodeURIComponent(orderNo)}`)
}

export const deleteClosedOrder = (orderNo) => {
  return instance.delete(`/asset/order/closed/${encodeURIComponent(orderNo)}`)
}

export const getAlipayPaymentStatus = (orderNo) => {
  return instance.get(`/asset/order/alipay/status/${encodeURIComponent(orderNo)}`)
}

// 卖家确认交易
export const sellerConfirmOrder = (orderNo) => {
  return instance.post(`/asset/order/seller-confirm/${orderNo}`, {}, {
    timeout: 0,
  })
}

export const rejectOrder = (orderNo) => instance.post(`/asset/order/reject/${orderNo}`)

// 保存订单数字合约与交付方式
export const saveOrderContract = (orderNo, data = {}) => {
  return instance.post(`/asset/order/contract/${orderNo}`, data)
}

export const bindBuyerDeliveryCertificate = (orderNo, data = {}) => {
  return instance.post(`/asset/order/delivery/bind-buyer-certificate/${orderNo}`, data)
}

// 卖家交付
export const sellerDeliver = (orderNo, data = {}) => {
  return instance.post(`/asset/order/delivery/seller/${orderNo}`, data, { timeout: 130000 })
}

// 交付确认
export const confirmDelivery = (orderNo, data = {}) => {
  return instance.post(`/asset/order/delivery/confirm/${orderNo}`, data)
}

export const requestSecureDelivery = (orderNo, data = {}) => {
  return instance.post(`/asset/order/delivery/request-secure/${orderNo}`, data)
}

export const getDeliveryExportEligible = (orderNo) => {
  return instance.get(`/asset/order/delivery/export-eligible/${orderNo}`)
}

export const downloadDeliveryResult = (orderNo, data = {}) => {
  return instance.post(`/asset/order/delivery/download/${orderNo}`, data, {
    responseType: 'blob',
  })
}

// 订单列表
export const getOrderList = (params) => {
  return instance.get('/asset/order/list', { params })
}

// 隐私交付状态同步
export const getHeStatus = (transactionId, params = {}) => {
  return instance.get('/api/privacy/he/status', { params: { transactionId, ...params } })
}

export const getPreStatus = (transactionId, params = {}) => {
  return instance.get('/api/privacy/pre/status', { params: { transactionId, ...params } })
}

export const getFlStatus = (transactionId, params = {}) => {
  return instance.get('/api/privacy/fl/status', { params: { transactionId, ...params } })
}

export const getMpcStatus = (transactionId) => {
  return instance.get('/api/privacy/mpc/status', { params: { transaction_id: transactionId } })
}

export const uploadHePublicKeys = (data) => {
  return instance.post('/api/privacy/he/public-keys', data)
}

export const getHePublicKeyStatus = (transactionId) => {
  return instance.get('/api/privacy/he/public-key-status', { params: { transactionId } })
}

export const submitHePrivacyDelivery = (formData) => {
  return instance.post('/api/privacy/he/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const downloadHePrivacyResult = (transactionId) => {
  return instance.get('/api/privacy/he/result', {
    params: { transactionId },
    responseType: 'blob',
  })
}

export const uploadPreBuyerPublicKey = (data) => {
  return instance.post('/api/privacy/pre/buyer-public-key', data)
}

export const submitPrePrivacyDelivery = (formData) => {
  return instance.post('/api/privacy/pre/publish', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const downloadPrePrivacyResult = (transactionId) => {
  return instance.get('/api/privacy/pre/result', {
    params: { transactionId },
    responseType: 'blob',
  })
}

export const decryptPrePrivacyResult = (formData) => {
  return instance.post('/api/privacy/pre/decrypt-result', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob',
  })
}

export const createFlPrivacyContract = (formData) => {
  return instance.post('/api/privacy/fl/create-contract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const joinFlPrivacyContract = (data) => {
  return instance.post('/api/privacy/fl/join', data)
}

export const submitFlPrivacyBatch = (formData) => {
  return instance.post('/api/privacy/fl/upload-batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const downloadFlPrivacyResult = (params) => {
  return instance.get('/api/privacy/fl/result', {
    params,
    responseType: 'blob',
  })
}

export const createMpcPrivacyTask = (formData) => {
  return instance.post('/api/privacy/mpc/create-task', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const submitMpcSellerData = (formData) => {
  return instance.post('/api/privacy/mpc/upload-seller-data', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const getMpcPrivacyResult = (transactionId) => {
  return instance.get('/api/privacy/mpc/result', { params: { transaction_id: transactionId } })
}

// 证书：根据用户名获取用户ID
const CERT_READ_TIMEOUT_MS = 60000
const CERT_ADDRESS_TIMEOUT_MS = 5 * 60 * 1000
const CERT_OPERATION_TIMEOUT_MS = 35 * 60 * 1000

export const getUserIdByUsername = (username) => {
  return instance.post('/asset/certificate/get-user-id', { username }, { timeout: CERT_READ_TIMEOUT_MS })
}

// 证书：不可分割资产（org1）
export const getCertificates = () => {
  return instance.post('/asset/certificate/get-certificates', {}, { timeout: CERT_READ_TIMEOUT_MS })
}

export const checkCertificateNameAvailable = (certificateName) => {
  return instance.get('/asset/certificate/certificate-name-available', {
    params: { certificateName }, timeout: CERT_READ_TIMEOUT_MS,
  })
}

export const generateCertificate = (clientNumber) => {
  return instance.post('/asset/certificate/generate', {
    client_number: clientNumber, org: 'wx-org1.chainmaker.org',
  }, { timeout: CERT_OPERATION_TIMEOUT_MS })
}

export const addCertificate = (certificateName) => {
  return instance.post('/asset/certificate/add-certificate', {
    certificateName,
  }, { timeout: CERT_ADDRESS_TIMEOUT_MS })
}

export const renewCertificate = (certificateName) => {
  return instance.post('/asset/certificate/renew-certificate', {
    certificateName, org: 'wx-org1',
  }, { timeout: CERT_OPERATION_TIMEOUT_MS })
}

export const getAllUserCertificates = () => {
  return instance.get('/asset/certificate/user-certificates', { timeout: CERT_READ_TIMEOUT_MS })
}

export const getDefaultCertificates = () => {
  return instance.get('/asset/certificate/default-cert', { timeout: CERT_READ_TIMEOUT_MS })
}

export const saveDefaultCertificates = (data) => {
  return instance.post('/asset/certificate/default-cert', data, { timeout: CERT_READ_TIMEOUT_MS })
}

export const getDefaultRegisterCertInfo = () => {
  return instance.get('/asset/certificate/default-register-cert-info', { timeout: CERT_READ_TIMEOUT_MS })
}

export const getDefaultTradeCertInfo = () => {
  return instance.get('/asset/certificate/default-trade-cert-info', { timeout: CERT_READ_TIMEOUT_MS })
}

// 证书地址解析（按 1015c 流程）
export const resolveOwnerAddress = (certificateName, orgName = 'wx-org1.chainmaker.org') => {
  return instance.post('/asset/certificate/resolve-owner-address', {
    certificateName, orgName,
  }, { timeout: CERT_ADDRESS_TIMEOUT_MS })
}
