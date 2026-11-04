const express = require('express');
const service = require('../service/wallet');
const router = express.Router();

const handle = (action) => async (req, res) => {
  try { res.json({ status: 0, data: await action(req) }); }
  catch (error) { res.status(error.statusCode || 500).json({ status: 1, message: error.message }); }
};

router.get('/', handle((req) => service.getBalance(req.auth.id)));
router.get('/ledger', handle((req) => service.getLedger(req.auth.id, req.query.page)));
router.get('/order/:orderNo', handle((req) => service.getOrderAmount(req.params.orderNo, req.auth.id)));
router.post('/recharge', handle((req) => service.createRecharge(req.auth.id, req.body.amount)));
router.get('/recharge/:outTradeNo', handle((req) => service.getRechargeStatus(req.params.outTradeNo, req.auth.id)));
router.post('/pay/:orderNo', handle((req) => service.payOrder(req.params.orderNo, req.auth.id)));

module.exports = router;
