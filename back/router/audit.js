const express = require('express');

const router = express.Router();
const auditHandler = require('../router_handle/audit');

router.post('/entry-start', auditHandler.startPamEntry);
router.get('/authorize', auditHandler.authorizePamEntry);

module.exports = router;
