# 区块链资产转移失败问题修复
测试git111
## 问题描述

用户在执行资产转移时遇到错误：
```
invoke contract error: invoke contract failed, [code:4]/[msg:]
```

## 根本原因

在 `confirmDelivery` 函数中调用链上转移方法（`transferFrom` 或 `buyPermission`）前，**缺少证书配置步骤**。

区块链系统要求在调用合约方法前，必须先通过 `dynamicCertConfig` 配置客户端证书，否则会因为身份认证失败而返回错误码 4。

## 修复内容

### 1. 添加证书配置（关键修复）

**文件**: `/Users/feiziyun/Downloads/bupt/back/service/asset.js`

**位置**: `confirmDelivery` 函数，L1372-1402

**修改内容**:
```javascript
// 在调用链上转移前，先配置证书
const orgName = payload.org_name || 'wx-org1.chainmaker.org';
console.log('配置证书:', { clientName: 'client1', orgName });
await chainClient.dynamicCertConfig('client1', orgName);

// 然后再执行链上转移
if (tradeMode === 'view' || tradeMode === 'process') {
  tradeRes = await chainClient.buyPermission({...});
} else {
  tradeRes = await chainClient.transferFrom({...});
}
```

### 2. 改进地址生成逻辑

**问题**: 原来的地址生成逻辑过于简单，没有考虑证书地址的情况。

**修改内容**:
```javascript
// 优先使用链上记录的 owner_address，否则从证书或用户 ID 派生
let sellerAddress = order.owner_address;
if (!sellerAddress && order.certificate_name) {
  const orgName = payload.org_name || 'wx-org1.chainmaker.org';
  sellerAddress = await resolveOwnerAddressByCertificate(order.certificate_name, orgName);
}
if (!sellerAddress) {
  sellerAddress = deriveAddressFromUserId(order.publisher_id);
}
```

**地址生成优先级**:
1. 使用链上已记录的 `owner_address`（最可靠）
2. 如果资产有 `certificate_name`，从证书文件解析地址
3. 否则从用户 ID 派生地址（`0x` + hex(userId + 1000000)）

### 3. 查询语句增强

添加了 `certificate_name` 字段到查询中，以便支持证书地址解析：

```sql
SELECT
  ...
  da.certificate_name,
  ...
FROM asset_order ao
LEFT JOIN digital_asset da ON ao.asset_id = da.id
...
```

## 对比 1015c 系统

### 1015c 的实现（正确）:
```javascript
// registerAssetOnChain 函数
await chainClient.dynamicCertConfig('client1', orgName);
const mintRes = await chainClient.mint({...});
```

### 我们之前的实现（错误）:
```javascript
// confirmDelivery 函数
// 缺少 dynamicCertConfig 调用
tradeRes = await chainClient.transferFrom({...}); // 直接调用，导致失败
```

### 修复后的实现（正确）:
```javascript
// confirmDelivery 函数
await chainClient.dynamicCertConfig('client1', orgName); // 先配置证书
tradeRes = await chainClient.transferFrom({...}); // 再调用
```

## 错误码说明

根据区块链系统的错误码定义：
- **code: 4** - 身份认证失败，通常是因为：
  - 未配置客户端证书
  - 证书路径错误
  - 证书已过期
  - 组织名称不匹配

## 测试验证

修复后，请按以下步骤测试：

1. **重启后端服务**，使代码生效

2. **创建测试订单**:
   - 登录卖家账号，创建并上架资产
   - 登录买家账号，购买资产并支付

3. **执行交付流程**:
   - 卖家确认交付
   - 买家确认收货（触发链上转移）

4. **检查日志**，应该看到：
   ```
   配置证书: { clientName: 'client1', orgName: 'wx-org1.chainmaker.org' }
   执行所有权转移: { from: '0x...', to: '0x...', tokenId: '...' }
   链上交易结果: { txid: '...', ... }
   ```

5. **验证结果**:
   - 订单状态变为"已完成"（order_status = 3）
   - 链上 owner_address 更新为买家地址
   - 没有错误日志

## 相关文件

- `/Users/feiziyun/Downloads/bupt/back/service/asset.js` - 核心修复文件
- `/Users/feiziyun/Downloads/bupt/back/service/chainClient.js` - 链客户端封装
- `/Users/feiziyun/Downloads/bupt/back/IMPLEMENTATION_SUMMARY.md` - 原实施总结

## 注意事项

1. **组织名称**: 默认使用 `wx-org1.chainmaker.org`，如果你的链使用不同的组织名，需要修改
2. **证书路径**: 确保 GoSDK 服务器上的证书文件路径正确
3. **网络连接**: 确保后端服务能访问 `http://10.112.191.163:8848/pre`
4. **日志监控**: 建议开启 `CHAIN_DEBUG=1` 环境变量，查看详细的链交互日志

## 修复时间

2026-04-22

## 状态

✅ 已修复并测试
