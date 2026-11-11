const { services } = require('../config/services');
const { loggedFetch, preview } = require('./httpLogger');

const CHAIN_BASE_URL = services.chainBaseUrl;
const MINT_CHAIN_BASE_URL = services.mintChainBaseUrl || services.chainBaseUrl;
// Axios in the reference chain flow has no request timeout. A positive override can cap it.
const CHAIN_TIMEOUT_MS = Number(process.env.CHAIN_TIMEOUT_MS || 0);
const CHAIN_DEBUG = process.env.CHAIN_DEBUG === '1';

const ensureFetch = () => {
  if (typeof fetch !== 'function') {
    throw new Error('当前 Node 版本不支持 fetch，请升级到 Node 18+');
  }
};

const normalizeChainMessage = (message) => {
  const text = String(message || '');
  if (text.includes('grpc connections unavailable')) {
    return `链网关可达，但链节点 grpc 连接不可用（请检查 ${CHAIN_BASE_URL} 对应的 GoSDK 日志与链节点状态）`;
  }
  return text;
};

const postChain = async (path, payload, options = {}) => {
  const {
    requireCodeZero = true,
    baseUrl = CHAIN_BASE_URL,
  } = options;
  ensureFetch();
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = CHAIN_TIMEOUT_MS > 0
    ? setTimeout(() => controller.abort(), CHAIN_TIMEOUT_MS)
    : null;

  if (CHAIN_DEBUG) {
    console.log('[chainClient][request]', { path, url, payload: preview(payload) });
  }

  let response;
  try {
    response = await loggedFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload || {}),
        signal: controller.signal,
      },
      'chain',
    );
  } catch (error) {
    clearTimeout(timer);
    if (error && error.name === 'AbortError') {
      const timeoutErr = new Error(`链服务请求超时：${CHAIN_TIMEOUT_MS}ms`);
      timeoutErr.code = 'CHAIN_TIMEOUT';
      throw timeoutErr;
    }
    throw error;
  }
  clearTimeout(timer);

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    data = null;
  }

  if (CHAIN_DEBUG) {
    console.log('[chainClient][response]', {
      path,
      status: response.status,
      ok: response.ok,
      data: preview(data),
      rawText: preview(rawText),
    });
  }

  if (!response.ok) {
    const message = normalizeChainMessage(data?.message || rawText || `链服务请求失败：${response.status}`);
    const err = new Error(message);
    err.code = response.status;
    err.data = data;
    err.raw = rawText;
    throw err;
  }

  if (requireCodeZero && (!data || Number(data.code) !== 0)) {
    const message = normalizeChainMessage(data?.message || rawText || '链服务返回失败');
    const err = new Error(message);
    err.code = data?.code || 1;
    err.data = data;
    err.raw = rawText;
    throw err;
  }

  return data || { message: rawText || 'ok' };
};

const dynamicCertConfig = (clientName, orgName) =>
  postChain('/DynamicCertConfig', { clientName, orgName }, { requireCodeZero: false });
const mint = (payload) => postChain('/Mint', payload, { baseUrl: MINT_CHAIN_BASE_URL });
const enMint = (payload) => postChain('/En-Mint', payload, { baseUrl: MINT_CHAIN_BASE_URL });
const ownerOf = (tokenId) => postChain('/OwnerOf', { tokenId });
const setApproval = (payload) => postChain('/SetApproval', payload);
const enApprove = (payload) => postChain('/En-Approve', payload);
const buyPermission = (payload) => postChain('/BuyPermission', payload);
const transferFrom = (payload) => postChain('/TransferFrom', payload);
const enTransfer = (payload) => postChain('/En-Transfer', payload);
const metadata = (tokenId) => postChain('/Metadata', { tokenId });
const getTxInfo = (txid) => postChain('/gettxinfo', { txid });

module.exports = {
  CHAIN_BASE_URL,
  MINT_CHAIN_BASE_URL,
  dynamicCertConfig,
  mint,
  enMint,
  ownerOf,
  setApproval,
  enApprove,
  buyPermission,
  transferFrom,
  enTransfer,
  metadata,
  getTxInfo,
};
