const certificateService = require('../service/certificate');

// 证书操作必须绑定当前登录身份，不能信任前端任意传入的 userId。
const getCurrentUserId = (req) => req.auth?.id;
const DEFAULT_CERT_ORG = 'wx-org1.chainmaker.org';

exports.generateCertificate = async (req, res) => {
  try {
    const { client_number } = req.body || {};
    if (!client_number) {
      return res.cc('缺少 client_number 参数');
    }
    const result = await certificateService.generateCertificate(client_number, DEFAULT_CERT_ORG);
    return res.send(result);
  } catch (error) {
    return res.cc(error);
  }
};

exports.getUserId = async (req, res) => {
  try {
    const username = req.body?.username || req.body?.account || '';
    const userId = await certificateService.getUserIdByUsername(username);
    return res.send({ id: userId, username });
  } catch (error) {
    return res.cc(error);
  }
};

exports.getCertificates = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.cc('身份认证失败，请重新登录');
    const certificates = await certificateService.getCertificates(userId);
    return res.send({
      status: 0,
      message: '获取证书成功',
      userId,
      certificates,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.getCertificates2 = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.cc('身份认证失败，请重新登录');
    return res.send({
      status: 0,
      message: '当前系统仅使用 wx-org1 证书',
      userId,
      certificates: [],
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.getAllCertificates = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.cc('身份认证失败，请重新登录');
    const certificates = await certificateService.getAllCertificates(userId);
    return res.send({
      success: true,
      certificates,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.getDefaultCertificates = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.cc('身份认证失败，请重新登录');
    const result = await certificateService.getDefaultCertificates(userId);
    return res.send({
      status: 0,
      success: true,
      message: '查询默认证书成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.saveDefaultCertificates = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.cc('身份认证失败，请重新登录');
    const result = await certificateService.saveDefaultCertificates({
      ...(req.body || {}),
      userId,
    });
    return res.send({
      status: 0,
      success: true,
      message: '默认证书保存成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.getDefaultRegisterCertInfo = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.cc('身份认证失败，请重新登录');
    const cert = await certificateService.getDefaultRegisterCertInfo(userId);
    return res.send({
      status: 0,
      success: true,
      message: '查询默认登记证书成功',
      data: cert,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.getDefaultTradeCertInfo = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.cc('身份认证失败，请重新登录');
    const cert = await certificateService.getDefaultTradeCertInfo(userId);
    return res.send({
      status: 0,
      success: true,
      message: '查询默认交易证书成功',
      data: cert,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.addCertificate = async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) return res.cc('身份认证失败，请重新登录');
    await certificateService.addCertificate({
      ...(req.body || {}),
      userId,
      org: DEFAULT_CERT_ORG,
    });
    return res.send({
      status: 0,
      message: '证书添加成功',
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.resolveOwnerAddress = async (req, res) => {
  try {
    const { certificateName } = req.body || {};
    const userId = getCurrentUserId(req);
    if (!userId) return res.cc('身份认证失败，请重新登录');
    const result = await certificateService.resolveOwnerAddressByCertificate(
      certificateName,
      DEFAULT_CERT_ORG,
      userId,
    );
    return res.send({
      status: 0,
      message: '解析证书地址成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};
