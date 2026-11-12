const { loadEnvFile } = require('./config/loadEnv');
loadEnvFile();
const { services } = require('./config/services');

// 1. 导入express框架
const express = require('express');
// 2. 创建express应用实例
const app = express();

//CORS 是用来解决：浏览器“跨域请求”被拦截的问题
const cors = require('cors');
const pamCors = cors({ origin: true, credentials: true });
const defaultCors = cors();
app.use((req, res, next) => req.path.startsWith('/api/pam/')
  ? pamCors(req, res, next) : defaultCors(req, res, next));

//导入body-parser
var bodyParser = require('body-parser');
const db = require('./db/index');
const Joi = require('joi');
const { memoryUpload } = require('./middleware/upload');
const { registerHeRoutes, registerPreRoutes, registerFlRoutes } = require('./service/pcp');
const { registerMpcRoutes } = require('./service/mpc');
//处理表单数据（就像纸质表格，例如：account=zhangsan&password=123456），
app.use(bodyParser.urlencoded({extended:false}));//此时值只能是字符串或数组
//处理json格式数据
app.use(bodyParser.json())

//给 res 对象添加一个自定义方法 cc（可能是 custom callback 的缩写）
app.use((req, res, next)=>{
  //status: 0成功，1失败
  //给 res 对象添加一个自定义方法 cc（可能是 custom callback 的缩写）
  res.cc = (err, status = 1)=>{
    //返回统一格式的错误信息
    // 如果err是Error对象，提取message；否则直接用err
    res.send({
      status,
      message:err instanceof Error ? err.message : err,
    })
  }
  next();
})

//导入jwt配置文件（身份验证）
const jwtconfig = require('./jwt_config/index.js');
//导入express-jwt， 解构赋值+重命名（从 express-jwt 这个工具箱里，把叫 expressjwt 的那个工具拿出来，并且我以后叫它 jwt。）
const {expressjwt:jwt} = require('express-jwt');


const accessJwt = jwt({
  secret: jwtconfig.accessSecretKey, // 登录token密钥
  algorithms: ['HS256'],
});

const resetJwt = jwt({
  secret: jwtconfig.resetSecretKey, // 找回密码token密钥
  algorithms: ['HS256'],
});

const businessJwt = jwt({
  secret: jwtconfig.businessSecretKey, // 业务接口token密钥
  algorithms: ['HS256'],
});

app.use('/api/resetPassword', resetJwt);

app.use(
  '/api',
  accessJwt.unless({
    path: [
      '/api/register',
      '/api/login',
      '/api/verifyEmail',
      '/api/resetPassword',
      '/api/get-tps',
      '/api/get-today-transaction-stats',
      '/api/get-total-transaction-stats',
      '/api/get-transaction-history',
      '/api/industry-transaction-stats',
      /^\/api\/transaction-supervision(?:\/|$)/,
      /^\/api\/regulator(?:\/|$)/,
      '/api/pam/entry-start',
      '/api/pam/entry-continue',
      '/api/pam/node-ticket',
      '/api/pam/nodes',
      '/api/pam/authorize',
      '/api/pam/node-launch',
      /^\/api\/admin\/nodes(?:\/|$)/,
      '/api/alipay/notify',
      '/api/delegate-asset',
      '/api/revoke-delegation',
      '/api/agent-delegations',
      '/api/owner-delegations',
      /^\/api\/delegation\/[^/]+$/,
      '/api/proxy-transfer',
      /^\/api\/asset-picture\//,
      /^\/api\/privacy\//,
    ],
  }),
);


//配置JWT验证规则，排除不需要token的接口（注册、登陆）

// app.use(jwt({
//   secret:jwtconfig.jwtSecretKey,// 密钥（解密钥匙）
//   algorithms:['HS256']// 加密算法
// }).unless({
//   path:[/^\/api\//]
// }))
// ^ 表示开头
// \/ 表示斜杠 /（因为/是特殊字符，要转义）
// api 就是字面意思
// \/ 又一个斜杠
// 匹配所有以 /api/ 开头的路径



// 路由挂载
const loginRouter = require('./router/login');
const userInfoRouter = require('./router/userInfo');
const assetRouter = require('./router/asset');
const digitalContractRouter = require('./router/digitalContract');
const certificateRouter = require('./router/certificate');
const adminRouter = require('./router/admin');
const adminHandler = require('./router_handle/admin');
const auditRouter = require('./router/audit');
const originalCompatRouter = require('./router/originalCompat');
const transactionSupervisionRouter = require('./router/transactionSupervision');
const alipayService = require('./service/alipay');
const assetPicture = require('./service/assetPicture');
const { startPaymentTimeoutScheduler } = require('./service/paymentTimeout');
const adminAuth = require('./middleware/adminAuth');
const { startReconcileScheduler } = require('./service/reconcile');
app.use('/api',loginRouter); //把 "/api" 路径交给 loginRouter 处理
app.get('/api/asset-picture/:fileHash', assetPicture);
app.post('/api/alipay/notify', async (req, res) => {
  try {
    await alipayService.handleNotify(req.body || {});
    res.type('text/plain').send('success');
  } catch (error) {
    console.error('支付宝通知处理失败:', error.message);
    res.type('text/plain').send('fail');
  }
});
app.use('/api/get-tps', businessJwt);
app.use([
  '/api/get-today-transaction-stats',
  '/api/get-total-transaction-stats',
  '/api/get-transaction-history',
  '/api/industry-transaction-stats',
], businessJwt);
app.use('/api/pam/entry-start', businessJwt);
app.use('/api/pam/node-ticket', businessJwt);
app.use('/api/pam/nodes', businessJwt);
app.use('/api/pam', auditRouter);
app.get('/api/admin/nodes', businessJwt, adminAuth, adminHandler.getAuditNodeCredentials);
app.post('/api/admin/nodes/:nodeId/credentials', businessJwt, adminAuth, adminHandler.saveAuditNodeCredentials);
app.use('/api/regulator', businessJwt, require('./router/regulatorProxy'));
app.use('/api', originalCompatRouter);
app.use('/api', businessJwt, require('./router/delegation'));
app.use('/api/transaction-supervision', businessJwt, require('./router/regulatorProxy').forwardTransaction, transactionSupervisionRouter);
app.use('/userInfo', businessJwt, userInfoRouter);
app.use('/asset', businessJwt, assetRouter);
// assetRouter owns the order list and delivery endpoints. Keep the
// digital-contract fallback after it so /asset/order/list is not returned as 503.
app.use('/asset/order', businessJwt, digitalContractRouter);
app.use('/asset/certificate', businessJwt, certificateRouter);
app.use('/asset/wallet', businessJwt, require('./router/wallet'));
app.use('/admin', businessJwt, adminAuth, adminRouter);
app.use('/api/privacy', businessJwt);

function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

function parseJsonField(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function safeBaseName(name) {
  const base = String(name || 'result').replace(/[^\w.\-]+/g, '_');
  return base.replace(/\.[^.]+$/, '');
}

function pickContentType(reqExt, fileExt) {
  const ext = String(reqExt || fileExt || '').replace(/^\./, '').toLowerCase();
  const contentTypeMap = {
    csv: 'text/csv; charset=utf-8',
    json: 'application/json; charset=utf-8',
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    tgz: 'application/gzip',
    txt: 'text/plain; charset=utf-8',
    bin: 'application/octet-stream',
  };
  return contentTypeMap[ext] || 'application/octet-stream';
}

registerHeRoutes({
  app,
  upload: memoryUpload,
  dbQuery,
  firstDefined,
  parseJsonField,
  safeBaseName,
  pickContentType,
});

registerPreRoutes({
  app,
  upload: memoryUpload,
  dbQuery,
  firstDefined,
  parseJsonField,
  safeBaseName,
  pickContentType,
});

registerFlRoutes({
  app,
  upload: memoryUpload,
  dbQuery,
  firstDefined,
  safeBaseName,
  pickContentType,
});

registerMpcRoutes({
  app,
  upload: memoryUpload,
  dbQuery,
});

//对不符合joi规则的值报错  
app.use((err, req, res, next)=>{
  if(err instanceof Joi.ValidationError) return res.cc(err);
  if (err.name === 'UnauthorizedError') return res.cc('身份认证失败，请重新登录');
  next(err);  // 如果不是Joi错误，继续传递给下一错误处理器
}) 



// 绑定侦听主机端口
let stopReconcileScheduler = () => {};
let stopPaymentTimeoutScheduler = () => {};
const PORT = Number(process.env.PORT || 3007);
const HOST = process.env.HOST || '127.0.0.1';
const server = app.listen(PORT, HOST, () => {
  console.log(`http://${HOST}:${PORT}`)
  console.log('[app] server started', { pid: process.pid, node: process.version });
  // stopReconcileScheduler = startReconcileScheduler();
  stopPaymentTimeoutScheduler = startPaymentTimeoutScheduler();
})

server.on('error', (error) => {
  console.error('[app] server listen error', {
    code: error.code,
    message: error.message,
    port: PORT,
    host: HOST,
  });
  process.exitCode = 1;
  process.exit(1);
});

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('[app] shutdown signal received', { signal, pid: process.pid });
  try {
    stopReconcileScheduler();
    stopPaymentTimeoutScheduler();
  } catch (_error) {}

  server.close(() => {
    console.log('[app] server closed');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
