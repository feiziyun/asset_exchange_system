# 支付宝支付集成指南

## 一、功能说明

本项目已集成支付宝电脑网站支付功能，实现了以下交易流程：
1. 买家下单
2. 买家通过支付宝支付
3. 支付成功后，卖家确认交付
4. 交易完成

## 二、数据库表结构

已创建以下支付相关表：

### 1. alipay_transaction（支付交易表）
记录每笔支付交易的详细信息，包括订单号、支付宝交易号、交易状态等。

### 2. alipay_notify_log（异步通知日志表）
记录支付宝发送的所有异步通知，用于排查问题和防止重复处理。

### 3. alipay_refund（退款记录表）
记录退款申请和处理结果。

**执行SQL脚本：**
```bash
mysql -u root -p bupt_asset < sql/alipay_payment.sql
```

## 三、配置步骤

### 1. 获取支付宝沙箱账号

1. 访问支付宝开放平台：https://open.alipay.com/
2. 登录后进入"开发者中心" -> "研发服务" -> "沙箱环境"
3. 获取以下信息：
   - APPID（应用ID）
   - 应用私钥（需要生成RSA2密钥）
   - 支付宝公钥
   - 沙箱网关地址

### 2. 生成RSA2密钥

**方式一：使用支付宝密钥生成工具**
1. 下载工具：https://ideservice.alipay.com/cms/site/0j0cjj
2. 运行工具，选择"RSA2(SHA256)密钥"
3. 生成后会得到应用私钥和应用公钥
4. 将应用公钥上传到支付宝开放平台，获取支付宝公钥

**方式二：使用OpenSSL命令**
```bash
# 生成私钥
openssl genrsa -out app_private_key.pem 2048

# 生成公钥
openssl rsa -in app_private_key.pem -pubout -out app_public_key.pem

# 转换为PKCS8格式（支付宝要求）
openssl pkcs8 -topk8 -inform PEM -in app_private_key.pem -outform PEM -nocrypt -out app_private_key_pkcs8.pem
```

### 3. 配置项目

编辑 `config/alipay.js` 文件，填入以下信息：

```javascript
module.exports = {
  // 沙箱APPID
  appId: '你的沙箱APPID',

  // 应用私钥（PKCS8格式，去掉头尾和换行）
  privateKey: `你的应用私钥`,

  // 支付宝公钥（从支付宝开放平台获取）
  alipayPublicKey: `支付宝公钥`,

  // 沙箱网关
  gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',

  // 同步回调地址（前端页面地址）
  returnUrl: 'http://localhost:5173/payment/return',

  // 异步通知地址（后端接口，必须是公网可访问）
  notifyUrl: 'http://your-domain.com/api/alipay/notify',
};
```

**重要提示：**
- 私钥格式：去掉 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`，并去掉所有换行符
- 公钥格式：去掉 `-----BEGIN PUBLIC KEY-----` 和 `-----END PUBLIC KEY-----`，并去掉所有换行符
- 生产环境建议使用环境变量存储私钥

### 4. 配置异步通知地址

异步通知地址必须是公网可访问的URL。开发环境可以使用内网穿透工具：

**使用 ngrok：**
```bash
# 安装 ngrok
npm install -g ngrok

# 启动内网穿透（将本地3007端口映射到公网）
ngrok http 3007

# 获取公网地址，例如：https://abc123.ngrok.io
# 将异步通知地址配置为：https://abc123.ngrok.io/api/alipay/notify
```

**使用 localtunnel：**
```bash
# 安装 localtunnel
npm install -g localtunnel

# 启动内网穿透
lt --port 3007

# 获取公网地址并配置
```

## 四、API接口说明

### 1. 创建支付（生成支付表单）

**接口：** `POST /api/alipay/pay/:order_no`

**请求头：**
```
Authorization: Bearer <token>
```

**响应示例：**
```json
{
  "status": 0,
  "message": "支付表单生成成功",
  "data": {
    "order_no": "ORD20240422001",
    "payment_form": "<form>...</form>"
  }
}
```

**前端处理：**
```javascript
// 获取支付表单
const response = await axios.post(`/api/alipay/pay/${orderNo}`);
const paymentForm = response.data.data.payment_form;

// 方式一：在新窗口打开支付页面
const newWindow = window.open('', '_blank');
newWindow.document.write(paymentForm);
newWindow.document.close();

// 方式二：在当前页面跳转
document.write(paymentForm);
document.forms[0].submit();
```

### 2. 支付宝异步通知接口

**接口：** `POST /api/alipay/notify`

**说明：** 此接口由支付宝服务器调用，无需前端处理。

### 3. 支付宝同步回调接口

**接口：** `GET /api/alipay/return`

**说明：** 用户支付完成后跳转到此接口，前端可以根据返回结果展示支付结果页面。

**注意：** 同步回调不可靠，实际支付结果以异步通知为准。

### 4. 查询支付状态

**接口：** `GET /api/alipay/query/:order_no`

**请求头：**
```
Authorization: Bearer <token>
```

**响应示例：**
```json
{
  "status": 0,
  "message": "查询成功",
  "data": {
    "order_no": "ORD20240422001",
    "trade_no": "2024042222001234567890",
    "trade_status": "TRADE_SUCCESS",
    "total_amount": "100.00",
    "buyer_pay_amount": "100.00"
  }
}
```

**交易状态说明：**
- `WAIT_BUYER_PAY`：等待买家付款
- `TRADE_SUCCESS`：交易支付成功
- `TRADE_CLOSED`：交易关闭
- `TRADE_FINISHED`：交易完成（不可退款）

### 5. 关闭支付（取消订单）

**接口：** `POST /api/alipay/close/:order_no`

**请求头：**
```
Authorization: Bearer <token>
```

## 五、测试流程

### 1. 启动项目
```bash
npm run dev
```

### 2. 创建订单
使用现有的订单创建接口创建一个订单。

### 3. 发起支付
```bash
# 调用支付接口
curl -X POST http://localhost:3007/api/alipay/pay/订单号 \
  -H "Authorization: Bearer <token>"
```

### 4. 使用沙箱账号支付
1. 在支付宝开放平台沙箱环境中获取买家账号
2. 使用沙箱买家账号登录支付宝
3. 完成支付

### 5. 查询支付结果
```bash
curl http://localhost:3007/api/alipay/query/订单号 \
  -H "Authorization: Bearer <token>"
```

## 六、安全注意事项

⚠️ **重要安全规则（必须遵守）：**

1. **私钥安全**
   - 私钥绝对不能泄露
   - 不能上传到GitHub等公共代码仓库
   - 生产环境使用环境变量存储私钥
   - 私钥不得出现在任何日志中

2. **验签机制**
   - 异步通知必须先验签
   - 验签失败的通知必须拒绝处理
   - 验证 app_id、out_trade_no、total_amount 等参数

3. **支付结果确认**
   - 前台同步跳转结果不可信
   - 必须以异步通知或查询接口结果为准
   - 未确认支付结果前，不能要求用户再次付款

4. **幂等性处理**
   - 异步通知可能重复发送
   - 使用 notify_id 防止重复处理
   - 订单状态变更要做幂等性检查

5. **金额校验**
   - 验证通知中的金额与订单金额是否一致
   - 防止金额篡改

## 七、常见问题

### 1. 异步通知收不到？
- 检查 notifyUrl 是否配置正确
- 确保 notifyUrl 是公网可访问的地址
- 检查服务器防火墙是否开放端口
- 查看支付宝开放平台的通知日志

### 2. 验签失败？
- 检查支付宝公钥是否正确
- 确认密钥格式是否正确（去掉头尾和换行）
- 检查签名类型是否为 RSA2

### 3. 支付后订单状态未更新？
- 查看 alipay_notify_log 表，确认是否收到通知
- 检查通知的 verify_result 和 process_status
- 查看服务器日志排查错误

### 4. 沙箱环境支付失败？
- 确认使用的是沙箱买家账号
- 检查沙箱网关地址是否正确
- 查看支付宝开放平台的错误日志

## 八、上线前检查清单

- [ ] 切换到正式环境网关地址
- [ ] 使用正式环境的 APPID 和密钥
- [ ] 配置正式的异步通知地址（公网可访问）
- [ ] 配置正式的同步回调地址
- [ ] 确认私钥未上传到代码仓库
- [ ] 测试完整的支付流程
- [ ] 测试异步通知处理
- [ ] 测试订单查询功能
- [ ] 测试退款功能（如需要）
- [ ] 配置监控和告警

## 九、相关文档

- 支付宝开放平台：https://open.alipay.com/
- 电脑网站支付文档：https://ideservice.alipay.com/cms/site/0iztfv
- SDK下载：https://ideservice.alipay.com/cms/site/0j0cjj
- 错误码说明：https://ideservice.alipay.com/cms/site/02km9f
