const db = require('../db/index');
const { services } = require('../config/services');
const { loggedFetch } = require('./httpLogger');
const fs = require('node:fs/promises');
const path = require('node:path');
const { X509Certificate } = require('node:crypto');

const pool = db.promise();
const DEFAULT_CERT_ORG_CODE = 'wx-org1';
const DEFAULT_CERT_ORG_NAME = 'wx-org1.chainmaker.org';
const CERT_ADDR_BASE_URL = services.certAddrBaseUrl;
const CERT_FILE_ROOT = services.certFileRoot;
const CERT_GENERATE_URL = services.certGenerateUrl;

const normalizeOrgCode = (org) => {
  const raw = String(org || '').trim();
  if (!raw) return '';
  return raw.endsWith('.chainmaker.org') ? raw.split('.')[0] : raw;
};

const normalizeOrgName = (org) => {
  const raw = String(org || '').trim();
  if (!raw) return '';
  return raw.endsWith('.chainmaker.org') ? raw : `${raw}.chainmaker.org`;
};

const forceDefaultOrgCode = () => DEFAULT_CERT_ORG_CODE;
const forceDefaultOrgName = () => DEFAULT_CERT_ORG_NAME;

const describeFetchError = (label, url, error) => {
  const cause = error?.cause || {};
  const reason = cause.code || cause.message || error?.message || 'fetch failed';
  return `${label}不可达：${url}（${reason}）`;
};

const buildCertPaths = (certificateName, org) => {
  const orgName = normalizeOrgName(org);
  const baseDir = `${CERT_FILE_ROOT}/${orgName}/user/${certificateName}`;
  return {
    base_dir: baseDir,
    sign_cert_path: `${baseDir}/${certificateName}.sign.crt`,
    tls_cert_path: `${baseDir}/${certificateName}.tls.crt`,
    pem_path: `${baseDir}/${certificateName}.pem`,
  };
};

const getUserDefaultColumnFlags = async () => {
  const [registerRows] = await pool.query(`SHOW COLUMNS FROM users LIKE 'default_register_cert'`);
  const [tradeRows] = await pool.query(`SHOW COLUMNS FROM users LIKE 'default_trade_cert'`);
  return {
    hasDefaultRegisterCert: registerRows.length > 0,
    hasDefaultTradeCert: tradeRows.length > 0,
  };
};

const getUserDefaultCertNames = async (userId) => {
  if (!userId) throw new Error('缺少 userId 参数');

  const flags = await getUserDefaultColumnFlags();
  if (!flags.hasDefaultRegisterCert && !flags.hasDefaultTradeCert) {
    return {
      default_register_cert: '',
      default_trade_cert: '',
      schema_ready: false,
    };
  }

  const selectParts = [];
  if (flags.hasDefaultRegisterCert) {
    selectParts.push('default_register_cert');
  } else {
    selectParts.push(`'' AS default_register_cert`);
  }

  if (flags.hasDefaultTradeCert) {
    selectParts.push('default_trade_cert');
  } else {
    selectParts.push(`'' AS default_trade_cert`);
  }

  const [rows] = await pool.query(
    `
      SELECT ${selectParts.join(', ')}
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );

  return {
    default_register_cert: rows?.[0]?.default_register_cert || '',
    default_trade_cert: rows?.[0]?.default_trade_cert || '',
    schema_ready: true,
  };
};

const ensureCertificateOwnedByUser = async (userId, certificateName) => {
  const cert = String(certificateName || '').trim();
  if (!cert) return;
  const [rows] = await pool.query(
    `
      SELECT id
      FROM certificate_registry
      WHERE user_id = ?
        AND certificate_name = ?
        AND org = ?
      LIMIT 1
    `,
    [userId, cert, forceDefaultOrgCode()],
  );
  if (!rows.length) {
    throw new Error(`证书 ${cert} 不属于当前用户或尚未登记`);
  }
};

const getRegistryCertificate = async (certificateName, userId = null) => {
  const normalizedOrg = forceDefaultOrgCode();
  const userClause = userId ? 'AND user_id = ?' : '';
  const params = userId
    ? [certificateName, normalizedOrg, userId]
    : [certificateName, normalizedOrg];
  const [rows] = await pool.query(
    `
      SELECT
        user_id,
        certificate_name,
        org,
        sign_cert_path,
        tls_cert_path,
        pem_path,
        address,
        expires_at,
        created_at
      FROM certificate_registry
      WHERE certificate_name = ?
        AND org = ?
        ${userClause}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    params,
  );
  return rows?.[0] || null;
};

const upsertCertificateRegistry = async ({
  userId = null,
  certificateName,
  org,
  signCertPath = null,
  tlsCertPath = null,
  pemPath = null,
  address = null,
  expiresAt = null,
}) => {
  await pool.query(
    `
      INSERT INTO certificate_registry
        (user_id, certificate_name, org, sign_cert_path, tls_cert_path, pem_path, address, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        user_id = COALESCE(VALUES(user_id), user_id),
        sign_cert_path = COALESCE(VALUES(sign_cert_path), sign_cert_path),
        tls_cert_path = COALESCE(VALUES(tls_cert_path), tls_cert_path),
        pem_path = COALESCE(VALUES(pem_path), pem_path),
        address = COALESCE(VALUES(address), address),
        expires_at = COALESCE(VALUES(expires_at), expires_at)
    `,
    [
      userId || null,
      certificateName,
      normalizeOrgCode(org),
      signCertPath || null,
      tlsCertPath || null,
      pemPath || null,
      address || null,
      expiresAt || null,
    ],
  );
};

exports.generateCertificate = async (clientNumber) => {
  if (!clientNumber) {
    throw new Error('缺少 client_number 参数');
  }

  if (typeof fetch !== 'function') {
    throw new Error('当前 Node 版本不支持 fetch，无法调用证书生成服务');
  }

  const generateUrl = `${CERT_GENERATE_URL}/generate`;
  let response;
  try {
    response = await loggedFetch(generateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_number: clientNumber, org: forceDefaultOrgCode() }),
    });
  } catch (error) {
    throw new Error(describeFetchError('证书生成服务', generateUrl, error));
  }

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(`证书生成失败：${rawText || response.status}`);
  }

  const result = data || { status: 'success', message: '证书生成成功' };
  if (String(result.status || '').toLowerCase() !== 'success') {
    throw new Error(result.msg || result.message || '证书生成服务返回失败');
  }

  if (result.warning) {
    throw new Error(`证书生成未完成：${result.warning}`);
  }

  return result;
};

exports.getUserIdByUsername = async (username) => {
  if (!username) throw new Error('缺少 username 参数');

  const [rows] = await pool.query(
    'SELECT id, account, name FROM users WHERE account = ? OR name = ? LIMIT 1',
    [username, username],
  );
  if (!rows.length) throw new Error('用户未找到');
  return rows[0].id;
};

exports.getCertificates = async (userId) => {
  if (!userId) throw new Error('缺少 userId 参数');

  const [rows] = await pool.query(
    `
      SELECT
        certificate_name AS cert,
        org AS organization,
        sign_cert_path,
        tls_cert_path,
        pem_path,
        address,
        created_at,
        expires_at
      FROM certificate_registry
      WHERE user_id = ? AND org = ?
      ORDER BY created_at DESC, id DESC
    `,
    [userId, forceDefaultOrgCode()],
  );

  return (rows || []).map((row) => ({
    cert: row.cert,
    organization: row.organization,
    address: row.address || null,
    sign_cert_path: row.sign_cert_path || null,
    tls_cert_path: row.tls_cert_path || null,
    pem_path: row.pem_path || null,
    registry_created_at: row.created_at || null,
    expires_at: row.expires_at || null,
    data: {
      org_code: row.organization,
      org_id: row.organization,
      chain_address: row.address || '',
      cert_path: row.sign_cert_path || null,
      status: 1,
      created_at: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : null,
    },
  }));
};

exports.getAllCertificates = async (userId) => {
  if (!userId) throw new Error('缺少 userId 参数');

  const [rows] = await pool.query(
    `
      SELECT
        certificate_name AS cert,
        org AS organization,
        address,
        sign_cert_path,
        tls_cert_path,
        pem_path,
        expires_at,
        created_at
      FROM certificate_registry
      WHERE user_id = ?
        AND org = ?
      ORDER BY created_at DESC, id DESC
    `,
    [userId, forceDefaultOrgCode()],
  );

  return rows || [];
};

exports.getDefaultCertificates = async (userId) => {
  return getUserDefaultCertNames(userId);
};

exports.saveDefaultCertificates = async ({ userId, defaultRegisterCert = '', defaultTradeCert = '' }) => {
  if (!userId) throw new Error('缺少 userId 参数');

  const flags = await getUserDefaultColumnFlags();
  if (!flags.hasDefaultRegisterCert || !flags.hasDefaultTradeCert) {
    throw new Error('users 表缺少默认证书字段，请先执行默认证书迁移 SQL');
  }

  await ensureCertificateOwnedByUser(userId, defaultRegisterCert);
  await ensureCertificateOwnedByUser(userId, defaultTradeCert);

  await pool.query(
    `
      UPDATE users
      SET default_register_cert = ?,
          default_trade_cert = ?
      WHERE id = ?
    `,
    [String(defaultRegisterCert || '').trim() || null, String(defaultTradeCert || '').trim() || null, userId],
  );

  return {
    userId,
    default_register_cert: String(defaultRegisterCert || '').trim(),
    default_trade_cert: String(defaultTradeCert || '').trim(),
  };
};

const getDefaultCertificateInfo = async (userId, type = 'register') => {
  const defaults = await getUserDefaultCertNames(userId);
  const certName =
    type === 'trade'
      ? String(defaults.default_trade_cert || '').trim()
      : String(defaults.default_register_cert || '').trim();

  if (!certName) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT
        user_id,
        certificate_name,
        org,
        sign_cert_path,
        tls_cert_path,
        pem_path,
        address,
        expires_at,
        created_at
      FROM certificate_registry
      WHERE user_id = ?
        AND certificate_name = ?
        AND org = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [userId, certName, forceDefaultOrgCode()],
  );

  const row = rows?.[0];
  if (!row) {
    throw new Error(`默认证书 ${certName} 未在 certificate_registry 中找到`);
  }

  return {
    user_id: row.user_id,
    cert: row.certificate_name,
    certificate_name: row.certificate_name,
    organization: row.org,
    org: row.org,
    address: row.address || '',
    sign_cert_path: row.sign_cert_path || null,
    tls_cert_path: row.tls_cert_path || null,
    pem_path: row.pem_path || null,
    expires_at: row.expires_at || null,
    created_at: row.created_at || null,
    owner_address: row.address || '',
  };
};

exports.getDefaultRegisterCertInfo = async (userId) => getDefaultCertificateInfo(userId, 'register');

exports.getDefaultTradeCertInfo = async (userId) => getDefaultCertificateInfo(userId, 'trade');

// 登记链调用使用当前用户的默认登记证书，并以 certificate_registry.address 为准。
// 历史数据如果地址为空，则按原始系统流程通过 cert-to-addr 补解析并回写。
exports.resolveDefaultRegisterCertInfo = async (userId) => {
  const cert = await exports.getDefaultRegisterCertInfo(userId);
  if (!cert?.certificate_name) {
    throw new Error('请先在个人中心设置默认登记证书');
  }

  if (String(cert.address || '').trim()) {
    return cert;
  }

  const resolved = await exports.resolveOwnerAddressByCertificate(
    cert.certificate_name,
    cert.org || DEFAULT_CERT_ORG_NAME,
    userId,
  );
  const address = String(resolved?.owner_address || '').trim();
  if (!address) {
    throw new Error(`默认证书 ${cert.certificate_name} 未解析出链上地址`);
  }

  await pool.query(
    `
      UPDATE certificate_registry
      SET address = ?
      WHERE user_id = ?
        AND certificate_name = ?
        AND org = ?
    `,
    [address, userId, cert.certificate_name, forceDefaultOrgCode()],
  );

  return {
    ...cert,
    address,
    owner_address: address,
  };
};

exports.addCertificate = async ({ userId, certificateName }) => {
  const name = String(certificateName || '').trim();
  if (!userId || !/^[a-zA-Z0-9]{1,10}$/.test(name)) {
    throw new Error('缺少 userId 或 certificateName 参数');
  }
  const normalizedOrg = forceDefaultOrgCode();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query(
      'SELECT id, user_id, address FROM certificate_registry WHERE certificate_name = ? LIMIT 1 FOR UPDATE',
      [name],
    );
    if (existing.length && existing[0].user_id != null) {
      throw new Error('证书名称已被使用');
    }
    const [owned] = await connection.query(
      'SELECT id FROM certificate_registry WHERE user_id = ? LIMIT 1', [userId],
    );
    if (owned.length) throw new Error('当前账户已有证书，请使用续期功能');
    const certPaths = buildCertPaths(name, normalizedOrg);
    const resolved = await exports.resolveOwnerAddressByCertificate(name, normalizedOrg);
    let expiresAt = null;
    try {
      expiresAt = new Date(new X509Certificate(await fs.readFile(certPaths.sign_cert_path)).validTo);
    } catch (_) {
      // The generator may store files on another host; renewal will refresh this value.
    }
    await connection.query(
      `INSERT INTO certificate_registry
       (user_id, certificate_name, org, sign_cert_path, tls_cert_path, pem_path, address, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), sign_cert_path = VALUES(sign_cert_path),
         tls_cert_path = VALUES(tls_cert_path), pem_path = VALUES(pem_path),
         address = VALUES(address), expires_at = VALUES(expires_at)`,
      [userId, name, normalizedOrg, certPaths.sign_cert_path, certPaths.tls_cert_path,
        certPaths.pem_path, resolved.owner_address, expiresAt],
    );
    await connection.query(
      'UPDATE users SET default_register_cert = ?, default_trade_cert = ? WHERE id = ?',
      [name, name, userId],
    );
    await connection.commit();
    return { cert: name, organization: normalizedOrg, address: resolved.owner_address, expiresAt };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.certificateNameAvailable = async (certificateName) => {
  const name = String(certificateName || '').trim();
  if (!/^[a-zA-Z0-9]{1,10}$/.test(name)) throw new Error('证书名称格式不正确');
  const [rows] = await pool.query(
    'SELECT id FROM certificate_registry WHERE certificate_name = ? LIMIT 1', [name],
  );
  return rows.length === 0;
};

const postCa = async (endpoint, body, raw = false) => {
  const response = await loggedFetch(`${services.certCaBaseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`CA 请求失败：${text || response.status}`);
  return raw ? text : JSON.parse(text);
};

const latestCertSn = async (name, usage) => {
  const raw = await postCa('/api/ca/querycerts', JSON.stringify({
    orgId: DEFAULT_CERT_ORG_NAME, userId: `${name}.${usage}`,
    userType: 'client', certUsage: usage,
  }), true);
  let latest = null;
  for (const block of raw.split('{"userId"').slice(1)) {
    if (!block.includes('"certContent"')) continue;
    const sn = block.match(/"certSn"\s*:\s*(\d+)/)?.[1];
    const expires = Number(block.match(/"expirationDate"\s*:\s*(\d+)/)?.[1] || 0);
    if (sn && (!latest || expires > latest.expires)) latest = { sn, expires };
  }
  if (!latest) throw new Error(`${usage} 证书不存在`);
  return latest.sn;
};

const renewCaCert = async (sn) => {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const result = await postCa('/api/ca/renewcert', `{"certSn":${sn}}`);
    const cert = result?.data?.cert;
    if (!cert) throw new Error(result?.msg || '证书续期返回为空');
    if (new Date(new X509Certificate(cert).validTo).getTime() > Date.now()) return cert;
  }
  throw new Error('证书已过期过久，续期后仍未生效');
};

exports.renewCertificate = async (userId, certificateName) => {
  const name = String(certificateName || '').trim();
  if (!name) throw new Error('缺少 certificateName 参数');
  const [rows] = await pool.query(
    `SELECT certificate_name, org, address, sign_cert_path, tls_cert_path
     FROM certificate_registry WHERE user_id = ? AND certificate_name = ? AND org = ? LIMIT 1`,
    [userId, name, DEFAULT_CERT_ORG_CODE],
  );
  if (!rows.length) throw new Error('证书不存在或不属于当前用户');
  const [signSn, tlsSn] = await Promise.all([latestCertSn(name, 'sign'), latestCertSn(name, 'tls')]);
  const [signCert, tlsCert] = await Promise.all([renewCaCert(signSn), renewCaCert(tlsSn)]);
  const baseDir = path.join(services.certStoreRoot, DEFAULT_CERT_ORG_NAME, name);
  const signPath = rows[0].sign_cert_path || path.join(baseDir, `${name}.sign.crt`);
  const tlsPath = rows[0].tls_cert_path || path.join(baseDir, `${name}.tls.crt`);
  const destinations = [
    [signPath, tlsPath],
    ...[services.certFileRoot, services.certAdditionalSdkRoot].filter(Boolean).map((root) => {
      const dir = path.join(root, DEFAULT_CERT_ORG_NAME, 'user', name);
      return [path.join(dir, `${name}.sign.crt`), path.join(dir, `${name}.tls.crt`)];
    }),
  ];
  for (const [index, [sign, tls]] of destinations.entries()) {
    try {
      await fs.mkdir(path.dirname(sign), { recursive: true });
      await fs.mkdir(path.dirname(tls), { recursive: true });
      await fs.writeFile(sign, signCert, { mode: 0o644 });
      await fs.writeFile(tls, tlsCert, { mode: 0o644 });
    } catch (error) {
      if (index < 2) throw error;
      console.warn('同步续期证书到附加 GoSDK 目录失败:', error.message);
    }
  }
  const expiresAt = new Date(new X509Certificate(signCert).validTo);
  await pool.query(
    `UPDATE certificate_registry SET sign_cert_path = ?, tls_cert_path = ?, expires_at = ?
     WHERE user_id = ? AND certificate_name = ? AND org = ?`,
    [signPath, tlsPath, expiresAt, userId, name, DEFAULT_CERT_ORG_CODE],
  );
  return { cert: name, organization: rows[0].org, address: rows[0].address, expiresAt };
};

exports.resolveOwnerAddressByCertificate = async (
  certificateName,
  orgName = DEFAULT_CERT_ORG_NAME,
  userId = null,
) => {
  if (!certificateName) throw new Error('缺少 certificateName 参数');

  const orgCode = forceDefaultOrgName();
  const registryCert = await getRegistryCertificate(certificateName, userId).catch(() => null);
  const certPaths = buildCertPaths(certificateName, orgName || orgCode);
  const signCertPath = registryCert?.sign_cert_path || certPaths.sign_cert_path;
  const tlsCertPath = registryCert?.tls_cert_path || certPaths.tls_cert_path;
  const pemPath = registryCert?.pem_path || certPaths.pem_path;

  if (typeof fetch !== 'function') {
    throw new Error('当前 Node 版本不支持 fetch，无法调用 cert-to-addr');
  }

  const certAddrUrl = `${CERT_ADDR_BASE_URL}/cert-to-addr`;
  let response;
  try {
    response = await loggedFetch(certAddrUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cert_path: signCertPath }),
    });
  } catch (error) {
    if (registryCert?.address) {
      return {
        owner_address: registryCert.address,
        cert_path: signCertPath,
        sign_cert_path: signCertPath,
        tls_cert_path: tlsCertPath,
        pem_path: pemPath,
        org_name: orgCode,
      };
    }
    throw new Error(describeFetchError('证书地址解析服务', certAddrUrl, error));
  }

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    data = null;
  }

  let ownerAddress = data?.ethereum?.address || data?.address || '';
  if ((!response.ok || !ownerAddress) && registryCert?.address) {
    ownerAddress = registryCert.address;
  }
  if (!response.ok && !ownerAddress) {
    throw new Error(`证书文件未生成或地址解析失败：${rawText || response.status}`);
  }
  if (!ownerAddress) {
    throw new Error(`证书地址为空：${rawText || response.status}`);
  }

  return {
    owner_address: ownerAddress,
    cert_path: signCertPath,
    sign_cert_path: signCertPath,
    tls_cert_path: tlsCertPath,
    pem_path: pemPath,
    org_name: orgCode,
  };
};
