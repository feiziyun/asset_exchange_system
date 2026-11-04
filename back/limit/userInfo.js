const joi = require('joi');

// id：必须是一个正整数
const id = joi.number().integer().positive().required();
// 姓名：必须是2-12个汉字的字符串
const name = joi.string().min(2).max(12).pattern(/^[\u4e00-\u9fa5]+$/).required();
// 性别：必须是'男'或'女'
const gender = joi.string().valid('男', '女').required();
// 邮箱：必须是符合邮箱格式的字符串
const email = joi.string().email().required();
//旧密码
const oldPassword = joi.string().pattern(/^(?![0-9]+$)[a-z0-9]{1,50}$/).min(6).max(12).required();
//新密码
const newPassword = joi.string().pattern(/^(?![0-9]+$)[a-z0-9]{1,50}$/).min(6).max(12).required();
//账号
const account = joi.string().alphanum().min(6).max(12).required();

exports.updatePassword_limit = {
  body: {
    id,
    oldPassword,
    newPassword 
  }
} 

exports.updateUserName_limit = {
  body: {
    id,
    name
  }
}

exports.updateUserGender_limit = {
  body: { 
    id, 
    gender 
  }
}
exports.updateUserEmail_limit = {
  body: { 
    id, 
    email 
  }   
}
