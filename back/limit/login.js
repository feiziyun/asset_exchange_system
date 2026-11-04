const joi = require('joi');

const account = joi.string().alphanum().min(6).max(12).required();
const password = joi.string().pattern(/^(?![0-9]+$)[a-z0-9]{1,50}$/).min(6).max(12).required();
const email = joi.string().email().required();// 邮箱：必须是符合邮箱格式的字符串
const identity = joi.string().valid('buyer', 'seller').required();

// 登陆和注册数据限制
exports.login_limit = {
  body:{
    account,
    password
  }
}

exports.register_limit = {
  body: {
    account,
    password,
    identity,
  }
}

exports.resetPassword_limit = {
  body: {
    account,
    newPassword: password
  }
}
