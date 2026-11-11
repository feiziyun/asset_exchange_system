const express = require('express');
const config = require('../config/regulator.json');

const router = express.Router();
router.use((req, res, next) => {
  if (!['regulator', 'admin'].includes(String(req.auth?.identity || '').toLowerCase())) {
    return res.status(403).json({ message: '仅监管方或管理员可使用监管服务' });
  }
  next();
});

async function forward(req, res, baseUrl, path, method = 'GET') {
  if (!baseUrl) return res.status(503).json({ message: '监管服务地址未配置' });
  try {
    const url = new URL(path, `${String(baseUrl).replace(/\/$/, '')}/`);
    for (const [key, value] of Object.entries(req.query || {})) {
      if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)));
      else if (value != null) url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      method,
      headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(req.body || {}),
      signal: AbortSignal.timeout(method === 'GET' ? 20000 : 120000),
    });
    if (response.status === 401) return res.status(502).json({ message: '监管服务认证失败，请检查服务配置' });
    const contentType = response.headers.get('content-type') || 'application/json';
    const body = await response.text();
    return res.status(response.status).type(contentType).send(body);
  } catch (error) {
    console.error('监管服务代理失败:', { path, message: error.message });
    return res.status(502).json({ message: `监管服务连接失败：${error.message}` });
  }
}

router.get('/model/api/supervision/overview', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/supervision/overview'));
router.get('/model/api/supervision/tasks', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/supervision/tasks'));
router.post('/model/api/supervision/tasks', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/supervision/tasks', 'POST'));
router.get('/model/api/supervision/anomaly-records', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/supervision/anomaly-records'));
router.get('/model/api/supervision/accounts', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/supervision/accounts'));
router.get('/model/api/supervision/accounts/:address', (req, res) => forward(req, res, config.modelApiBaseUrl, `/api/supervision/accounts/${encodeURIComponent(req.params.address)}`));
router.get('/model/api/supervision/risk-transactions', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/supervision/risk-transactions'));
router.get('/model/api/supervision/auto/status', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/supervision/auto/status'));
router.post('/model/api/supervision/auto/discover-prebuilt', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/supervision/auto/discover-prebuilt', 'POST'));
router.post('/model/api/supervision/auto/start', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/supervision/auto/start', 'POST'));
router.post('/model/api/supervision/auto/stop', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/supervision/auto/stop', 'POST'));
router.post('/model/api/subgraph/echarts', (req, res) => forward(req, res, config.modelApiBaseUrl, '/api/subgraph/echarts', 'POST'));
router.get('/control/api/service/model/status', (req, res) => forward(req, res, config.serviceControlBaseUrl, '/api/service/model/status'));
router.post('/control/api/service/model/:action', (req, res) => {
  if (!['start', 'stop', 'restart'].includes(req.params.action)) return res.status(400).json({ message: '无效的模型操作' });
  return forward(req, res, config.serviceControlBaseUrl, `/api/service/model/${req.params.action}`, 'POST');
});
router.get('/catalogapi/contract/datacatalog/list', (req, res) => forward(req, res, config.catalogApiBaseUrl, '/contract/datacatalog/list'));
router.post('/chainbridge/pre/:action', (req, res) => {
  if (!['CB-In', 'CB-Out'].includes(req.params.action)) return res.status(400).json({ message: '无效的跨链操作' });
  return forward(req, res, config.chainBridgeBaseUrl, `/pre/${req.params.action}`, 'POST');
});

module.exports = router;
module.exports.forwardTransaction = (req, res, next) => {
  if (!config.transactionSupervisionBaseUrl) return next();
  if (!['regulator', 'admin'].includes(String(req.auth?.identity || '').toLowerCase())) {
    return res.status(403).json({ message: '仅监管方或管理员可查看交易穿透监管' });
  }
  return forward(req, res, config.transactionSupervisionBaseUrl,
    `/api/transaction-supervision${req.path}`, req.method);
};
