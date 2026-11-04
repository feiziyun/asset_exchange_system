// 导入express模块
const express = require('express');
// 使用express框架的路由
const router = express.Router();
const { memoryUpload } = require('../middleware/upload');
// 导入express-joi验证中间件(设计修改密码)
// 在请求到达路由处理函数前，自动验证 req.body、req.query、req.params 等数据是否符合预定义的规则
const expressJoi = require('@escook/express-joi');
// 导入验证规则对象
const {
  updateUserName_limit, 
  updateUserGender_limit, 
  updateUserEmail_limit,
  updatePassword_limit, 
  resetPassword_limit} = require('../limit/userInfo');


// 导入userInfo路由处理模块
const userInfoHandler = require('../router_handle/userInfo');

// 上传用户头像接口
router.post('/uploadAvatar', memoryUpload.single('avatar_file'), userInfoHandler.uploadAvatar);
// 修改密码
router.post('/updatePassword', expressJoi(updatePassword_limit), userInfoHandler.updatePassword);
// 获取用户信息
router.get('/getUserInfo', userInfoHandler.getUserInfo);
// 修改用户名
router.post('/updateUserName', expressJoi(updateUserName_limit), userInfoHandler.updateUserName);
// 修改用户性别
router.post('/updateUserGender', expressJoi(updateUserGender_limit), userInfoHandler.updateUserGender);
// 修改邮箱
router.post('/updateUserEmail', expressJoi(updateUserEmail_limit), userInfoHandler.updateUserEmail);



// 向外暴露路由
module.exports = router;
