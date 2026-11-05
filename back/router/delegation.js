const express = require('express');
const service = require('../service/delegation');
const assetService = require('../service/asset');
const router = express.Router();
const sendError = (req, res, cause) => {
  console.error('[delegation] request failed', {
    path: req.path,
    userId: req.auth?.id,
    code: cause.code,
    message: cause.message,
    stack: cause.stack,
  });
  return res.status(cause.statusCode || 500).json({ success: false, message: cause.message });
};

router.post('/delegate-asset', async (req, res) => {
  try { res.json({ success: true, message: '代理托管成功', delegation: await service.delegate(req.body || {}, req.auth.id) }); }
  catch (cause) { sendError(req, res, cause); }
});
router.post('/revoke-delegation', async (req, res) => {
  try { res.json({ success: true, message: '代理关系已撤销', ...await service.revoke(req.body || {}, req.auth.id) }); }
  catch (cause) { sendError(req, res, cause); }
});
router.get('/agent-delegations', async (req, res) => {
  try {
    if (Number(req.query.agentUserId || req.query.agent_user_id) !== Number(req.auth.id)) {
      return res.status(403).json({ success: false, message: '只能查看自己的代理资产' });
    }
    return res.json({ success: true, delegations: await service.listAgent(req.auth.id) });
  } catch (cause) { return sendError(req, res, cause); }
});
router.get('/owner-delegations', async (req, res) => {
  try { res.json({ success: true, delegations: await service.listOwner(req.auth.id) }); }
  catch (cause) { sendError(req, res, cause); }
});
router.get('/delegation/:id', async (req, res) => {
  try { res.json({ success: true, delegation: await service.get(req.params.id, req.auth.id) }); }
  catch (cause) { sendError(req, res, cause); }
});
router.post('/proxy-transfer', async (req, res) => {
  try {
    const transactionId = String(req.body?.transaction_id || '').trim();
    const sellerAddress = String(req.body?.seller_address || '').trim();
    if (!transactionId || !sellerAddress) {
      return res.status(400).json({ success: false, message: '缺少 transaction_id 或 seller_address' });
    }
    const result = await assetService.proxyTransfer(transactionId, sellerAddress, req.auth.id);
    return res.json({ success: true, message: '链上过户成功', transaction_id: transactionId, ...result });
  } catch (cause) { return sendError(req, res, cause); }
});
module.exports = router;
