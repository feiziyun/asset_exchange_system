// 导入express模块
const express = require('express');
// 使用express框架的路由
const router = express.Router();
// 导入admin路由处理模块
const adminHandler = require('../router_handle/admin');

// 用户管理
router.get('/users', adminHandler.getUserList);
router.post('/users', adminHandler.createUser);
router.patch('/users/:id/status', adminHandler.updateUserStatus);
router.patch('/users/:id/identity', adminHandler.updateUserIdentity);
router.get('/assets', adminHandler.listAdminAssets);
router.get('/orders', adminHandler.listAdminOrders);
router.get('/audit-nodes', adminHandler.getAuditNodes);
router.get('/audit-nodes/credentials', adminHandler.getAuditNodeCredentials);
router.post('/audit-nodes/:nodeId/credentials', adminHandler.saveAuditNodeCredentials);

// 链上信息
router.get('/chain-info', adminHandler.getChainInfo);

// 资产管理
router.patch('/asset/:id/status', adminHandler.updateAssetStatus);

// 向外暴露
module.exports = router;
