const express = require('express');

const router = express.Router();
const auditHandler = require('../router_handle/audit');

router.post('/entry-start', auditHandler.startPamEntry);
router.get('/entry-start', auditHandler.startPamEntry);
router.get('/entry-continue', auditHandler.continuePamEntry);
router.get('/nodes', auditHandler.getPamNodes);
router.get('/authorize', auditHandler.authorizePamEntry);
router.post('/node-ticket', auditHandler.createNodeTicket);
router.get('/node-launch', auditHandler.launchNode);

module.exports = router;
