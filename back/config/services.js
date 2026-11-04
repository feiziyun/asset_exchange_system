const LOCAL_SERVICE_HOST = process.env.LOCAL_SERVICE_HOST || '127.0.0.1';
// OmniPrint follows the original backend's service address. Keep this
// separate from LOCAL_SERVICE_HOST because the fingerprint service may bind
// to the server's LAN address instead of loopback.
const OMNIPRINT_HOST = process.env.OMNIPRINT_HOST || '10.112.191.163';
const digitalContractConfig = require('./digital-contract.json');
let pcpConfig = {};
try {
  pcpConfig = require('./pcp.local.json');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND' || !error.message.includes('pcp.local.json')) throw error;
}

const buildLocalUrl = (port, path = '') => `http://${LOCAL_SERVICE_HOST}:${port}${path}`;
const buildOmniPrintUrl = (port) => `http://${OMNIPRINT_HOST}:${port}`;

const services = {
  // Set to true only when seller confirmation must proceed without a chain call.
  skipChainOnSellerConfirm: false,
  digitalContractEnabled: process.env.DIGITAL_CONTRACT_ENABLED !== undefined
    ? process.env.DIGITAL_CONTRACT_ENABLED === '1' : digitalContractConfig.enabled === true,
  digitalContractBaseUrl: process.env.DIGITAL_CONTRACT_BASE_URL || digitalContractConfig.baseUrl || '',
  digitalContractPublicKeyPath: process.env.DIGITAL_CONTRACT_PUBLIC_KEY_PATH || digitalContractConfig.publicKeyPath || '',
  digitalContractPrivateKeyPath: process.env.DIGITAL_CONTRACT_PRIVATE_KEY_PATH || digitalContractConfig.privateKeyPath || '',
  digitalContractModelDir: process.env.DIGITAL_CONTRACT_MODEL_DIR || digitalContractConfig.modelDir || '',
  localBackBaseUrl:
    process.env.LOCAL_BACK_BASE_URL ||
    buildLocalUrl(process.env.PORT || 3007),

  chainBaseUrl:
    process.env.CHAIN_BASE_URL ||
    buildLocalUrl(process.env.CHAIN_SERVICE_PORT || 8848, '/pre'),

  mintChainBaseUrl:
    process.env.MINT_CHAIN_BASE_URL ||
    buildLocalUrl(process.env.MINT_CHAIN_SERVICE_PORT || 8009, '/pre'),

  certGenerateUrl:
    process.env.CERT_GENERATE_URL ||
    buildLocalUrl(process.env.CERT_GENERATE_PORT || 9081),
  certGenerateTimeoutMs: 30 * 60 * 1000,
  certAddressTimeoutMs: 5 * 60 * 1000,
  certCaQueryTimeoutMs: 30 * 1000,
  certCaRenewTimeoutMs: 60 * 1000,

  certCaBaseUrl: process.env.CERT_CA_BASE_URL || buildLocalUrl(process.env.CERT_CA_PORT || 8090),
  certStoreRoot: process.env.CERT_STORE_ROOT || '/home/super/fqh/cert-store',
  certFileRoot: process.env.CERT_FILE_ROOT || '/home/super/r/GoSDK/crypto-config',
  certAdditionalSdkRoot: process.env.CERT_ADDITIONAL_SDK_ROOT || '/home/super/lihuihao/otherwork/mint_service/GoSDK/crypto-config',

  certAddrBaseUrl:
    process.env.CERT_ADDR_BASE_URL ||
    buildLocalUrl(process.env.CERT_ADDR_PORT || 9092),

  classificationBaseUrl:
    process.env.CLASSIFICATION_SERVICE_BASE_URL ||
    buildLocalUrl(process.env.CLASSIFICATION_SERVICE_PORT || 8007),

  dataCatalogBaseUrl:
    process.env.DATA_CATALOG_BASE_URL ||
    buildLocalUrl(process.env.DATA_CATALOG_PORT || 8008),

  dataCatalogPlatformUrl:
    process.env.DATA_CATALOG_PLATFORM_URL ||
    buildLocalUrl(process.env.DATA_CATALOG_PLATFORM_PORT || 8008),

  omniprint: {
    text:
      process.env.OMNIPRINT_TEXT_BASE_URL ||
      buildOmniPrintUrl(process.env.OMNIPRINT_TEXT_PORT || 8110),
    image:
      process.env.OMNIPRINT_IMAGE_BASE_URL ||
      buildOmniPrintUrl(process.env.OMNIPRINT_IMAGE_PORT || 8111),
    audio:
      process.env.OMNIPRINT_AUDIO_BASE_URL ||
      buildOmniPrintUrl(process.env.OMNIPRINT_AUDIO_PORT || 8112),
    video:
      process.env.OMNIPRINT_VIDEO_BASE_URL ||
      buildOmniPrintUrl(process.env.OMNIPRINT_VIDEO_PORT || 8113),
  },

  pcpBaseUrl:
    pcpConfig.baseUrl ||
    process.env.PCP_BASE_URL ||
    buildLocalUrl(process.env.PCP_PORT || 8130),

  pcpHeBaseUrl:
    pcpConfig.heBaseUrl ||
    pcpConfig.baseUrl ||
    process.env.PCP_HE_BASE_URL ||
    process.env.PCP_BASE_URL ||
    buildLocalUrl(process.env.PCP_PORT || 8130),

  pcpPreBaseUrl:
    pcpConfig.preBaseUrl ||
    pcpConfig.baseUrl ||
    process.env.PCP_PRE_BASE_URL ||
    process.env.PCP_BASE_URL ||
    buildLocalUrl(process.env.PCP_PORT || 8130),

  pcpFlBaseUrl:
    pcpConfig.flBaseUrl ||
    pcpConfig.baseUrl ||
    process.env.PCP_FL_BASE_URL ||
    process.env.PCP_BASE_URL ||
    buildLocalUrl(process.env.PCP_PORT || 8130),

  pcpClientId: pcpConfig.clientId || process.env.PCC_CLIENT_ID || 'trading-system',
  pcpClientSecret: pcpConfig.clientSecret || process.env.PCC_CLIENT_SECRET || process.env.PCP_CLIENT_SECRET || '',

  mpcBaseUrl:
    process.env.MPC_TASK_BASE_URL ||
    process.env.MPC_BASE_URL ||
    buildLocalUrl(process.env.MPC_FLASK_PORT || 28090, '/api/v1'),

  vmHostBaseUrl:
    process.env.VM_HOST_BASE_URL ||
    buildLocalUrl(process.env.VM_HOST_PORT || 8000),

  vmServiceBaseUrl:
    process.env.VM_SERVICE_BASE_URL ||
    buildLocalUrl(process.env.VM_SERVICE_PORT || 18080, '/api'),

  remoteJsonUrl:
    process.env.REMOTE_JSON_URL ||
    buildLocalUrl(process.env.REMOTE_JSON_PORT || 8081, '/api/recv-json'),

  remoteFileUrl:
    process.env.REMOTE_FILE_URL ||
    buildLocalUrl(process.env.REMOTE_FILE_PORT || 8082, '/api/recv-file'),

  remoteKeyUrl:
    process.env.REMOTE_KEY_URL ||
    buildLocalUrl(process.env.REMOTE_KEY_PORT || 8080, '/api/receive-key'),

  pamWebBaseUrl:
    process.env.PAM_WEB_BASE_URL ||
    buildLocalUrl(process.env.PAM_WEB_PORT || 5174),

  pamApiBaseUrl:
    process.env.PAM_API_BASE_URL ||
    buildLocalUrl(process.env.PAM_API_PORT || 8140),
};

module.exports = {
  LOCAL_SERVICE_HOST,
  buildLocalUrl,
  services,
};






