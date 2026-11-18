const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const auditConfig = require('../config/audit.json');

const keyFile = path.resolve(__dirname, '../storage/pam-node-credential.key');

function credentialKey(createIfMissing = false, file = keyFile) {
  const configured = auditConfig.nodeCredentialKey || process.env.PAM_NODE_CREDENTIAL_KEY;
  if (configured) {
    if (!/^[0-9a-fA-F]{64}$/.test(configured)) {
      throw new Error('nodeCredentialKey 必须为 64 位十六进制字符串');
    }
    return Buffer.from(configured, 'hex');
  }

  if (createIfMissing) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    try {
      fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  let hex;
  try {
    hex = fs.readFileSync(file, 'utf8').trim();
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('节点凭据密钥文件缺失，请恢复 back/storage/pam-node-credential.key；已保存的密码不能使用新密钥解密');
    }
    throw error;
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('节点凭据密钥文件格式无效');
  }
  return Buffer.from(hex, 'hex');
}

module.exports = { credentialKey };
