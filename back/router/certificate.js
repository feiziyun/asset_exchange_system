const express = require('express');
const router = express.Router();

const certificateHandler = require('../router_handle/certificate');

// 证书生成接口（代理到证书生成服务）
router.post('/generate', certificateHandler.generateCertificate);

// 兼容原系统接口语义
router.post('/get-user-id', certificateHandler.getUserId);
router.post('/get-certificates', certificateHandler.getCertificates);
router.post('/get-certificates2', certificateHandler.getCertificates2);
router.post('/add-certificate', certificateHandler.addCertificate);
router.post('/resolve-owner-address', certificateHandler.resolveOwnerAddress);
router.get('/user-certificates', certificateHandler.getAllCertificates);
router.get('/default-cert', certificateHandler.getDefaultCertificates);
router.post('/default-cert', certificateHandler.saveDefaultCertificates);
router.get('/default-register-cert-info', certificateHandler.getDefaultRegisterCertInfo);
router.get('/default-trade-cert-info', certificateHandler.getDefaultTradeCertInfo);

module.exports = router;
