const express = require('express');
const service = require('../service/alipay');
const config = require('../config/alipay');

const router = express.Router();
const sendError = (res, error) => res.status(error.statusCode || 500).json({
  status: 1,
  message: error.message || '支付服务异常',
});

router.get('/mode', (_req, res) => {
  res.json({ status: 0, data: { skip_payment: config.skipPayment === true } });
});

router.post('/create/:orderNo', async (req, res) => {
  try {
    res.json({ status: 0, data: await service.createPayment(req.params.orderNo, req.auth.id) });
  } catch (error) { sendError(res, error); }
});

router.get('/status/:orderNo', async (req, res) => {
  try {
    res.json({ status: 0, data: await service.getPaymentStatus(req.params.orderNo, req.auth.id) });
  } catch (error) { sendError(res, error); }
});

module.exports = router;
