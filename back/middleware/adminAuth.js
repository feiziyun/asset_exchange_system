// 管理员权限验证中间件
const adminAuth = (req, res, next) => {
  const identity = req.auth?.identity || '';

  if (identity !== 'admin') {
    return res.status(403).send({
      status: 1,
      message: '权限不足，仅管理员可访问'
    });
  }

  next();
};

module.exports = adminAuth;
