const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const referenceEnvPath = path.resolve(__dirname, '../../backend/.env');
if (!fs.existsSync(referenceEnvPath)) {
  console.warn(`[alipay] 原始系统测试配置不存在，使用当前系统配置：${referenceEnvPath}`);
  module.exports = null;
} else {
  const referenceEnv = parseEnv(fs.readFileSync(referenceEnvPath, 'utf8'));
  const requiredKeys = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_ALIPAY_PUBLIC_KEY'];
  const missingKeys = requiredKeys.filter((key) => !referenceEnv[key]);
  if (missingKeys.length) {
    throw new Error(`原始系统支付宝测试配置缺少：${missingKeys.join(', ')}`);
  }

  module.exports = {
    skipPayment: false,
    appId: referenceEnv.ALIPAY_APP_ID,
    privateKey: referenceEnv.ALIPAY_PRIVATE_KEY,
    alipayPublicKey: referenceEnv.ALIPAY_ALIPAY_PUBLIC_KEY,
    gateway: referenceEnv.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
    notifyUrl: '',
  };
}
