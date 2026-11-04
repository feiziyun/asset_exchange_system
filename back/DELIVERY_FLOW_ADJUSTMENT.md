# 交付流程调整 - 对齐 1015c 原系统

## 调整日期
2026-04-22

## 调整原因

用户要求将交付流程改为与 1015c 原系统一致：**链上转移在卖家交付时执行**，而不是买家确认时。

## 原流程 vs 新流程

### 原流程（修改前）
```
1. 买家下单 → 买家支付
2. 卖家交付 (sellerDeliver) - 仅更新订单状态
3. 买家确认 (confirmDelivery) - 执行链上转移 + 完成订单
```

### 新流程（修改后，对齐 1015c）
```
1. 买家下单 → 买家支付
2. 卖家交付 (sellerDeliver) - 执行链上转移 + 更新订单状态
3. 买家确认 (confirmDelivery) - 仅确认收货 + 完成订单
```

## 修改内容

### 1. 后端修改

#### 文件：`/Users/feiziyun/Downloads/bupt/back/service/asset.js`

**修改 1：sellerDeliver 函数（L1279-1397）**

**修改前**：
```javascript
exports.sellerDeliver = async (orderNo, sellerId, payload = {}) => {
  // 仅更新订单状态为待买家确认
  await conn.query('UPDATE asset_order SET order_status = 2 WHERE id = ?', [order.id]);
  return { order_no: orderNo, message: '卖家交付成功，等待买家确认' };
};
```

**修改后**：
```javascript
exports.sellerDeliver = async (orderNo, sellerId, payload = {}) => {
  // 1. 查询订单和资产信息（包括 trade_mode, certificate_name 等）
  // 2. 验证权限（can_sell_ownership/view_right/process_right）
  // 3. 生成卖家和买家地址（支持证书地址解析）
  // 4. 链上交易前检查 owner
  // 5. 配置证书 (dynamicCertConfig)
  // 6. 执行链上转移 (transferFrom 或 buyPermission)
  // 7. 更新链上信息（如果是所有权转移）
  // 8. 更新订单状态为待买家确认
  return {
    order_no: orderNo,
    message: '卖家交付成功，链上转移已完成，等待买家确认',
    token_id: tokenId,
    trade_mode: tradeMode,
    txid,
    // ... 链上交易结果
  };
};
```

**关键改进**：
- 添加了完整的链上转移逻辑
- 支持三种交易模式（ownership/view/process）
- 支持证书地址解析
- 添加证书配置（`dynamicCertConfig`）
- 验证权限和链上状态

**修改 2：confirmDelivery 函数（L1399-1433）**

**修改前**：
```javascript
exports.confirmDelivery = async (orderNo, buyerId, payload = {}) => {
  // 执行链上转移
  await chainClient.transferFrom({...});
  // 更新订单状态为已完成
  await conn.query('UPDATE asset_order SET order_status = 3 WHERE id = ?', [order.id]);
  return { token_id, trade_mode, txid, ... };
};
```

**修改后**：
```javascript
exports.confirmDelivery = async (orderNo, buyerId, payload = {}) => {
  // 仅验证买家身份和订单状态
  // 更新订单状态为已完成
  await conn.query('UPDATE asset_order SET order_status = 3 WHERE id = ?', [order.id]);
  // 更新资产交易次数
  await conn.query('UPDATE digital_asset SET trade_count = trade_count + 1 WHERE id = ?', [order.asset_id]);
  return { order_no: orderNo, message: '买家确认收货成功，订单已完成' };
};
```

**关键简化**：
- 移除了所有链上转移逻辑
- 仅保留订单状态更新和交易次数统计
- 简化查询语句，只查询必要字段

### 2. 前端修改

#### 文件：`/Users/feiziyun/Downloads/bupt/front/vue-project/src/views/assetDelivery/index.vue`

**修改 1：确认对话框（L121-146）**

**修改前**：
```vue
<el-dialog title="确认交付（链上执行）">
  <el-form-item label="交易类型">
    <el-input :value="tradeModeText(confirmForm.trade_mode)" disabled />
  </el-form-item>
  <el-form-item label="买方链地址">
    <el-input :value="confirmForm.buyer_address" disabled />
  </el-form-item>
  <el-button>执行确认</el-button>
</el-dialog>
```

**修改后**：
```vue
<el-dialog title="确认收货">
  <el-form-item label="交易类型">
    <el-input :value="tradeModeText(confirmForm.trade_mode)" disabled />
  </el-form-item>
  <el-alert title="提示：链上转移已在卖家交付时完成，此操作仅确认收货" type="info" />
  <el-button>确认收货</el-button>
</el-dialog>
```

**关键改进**：
- 标题改为"确认收货"（而非"确认交付（链上执行）"）
- 添加提示信息，说明链上转移已完成
- 移除买方链地址字段（不再需要）
- 按钮文字改为"确认收货"

**修改 2：确认函数（L371-396）**

**修改前**：
```javascript
const confirmCurrentOrder = async (orderNo: string) => {
  const res = await confirmDelivery(orderNo, {
    trade_mode: confirmForm.trade_mode,
    buyer_address: confirmForm.buyer_address,
  })
  ElMessage.success('交付确认成功')
  chainResultVisible.value = true // 显示链上结果
}
```

**修改后**：
```javascript
const confirmCurrentOrder = async (orderNo: string) => {
  const res = await confirmDelivery(orderNo, {})
  ElMessage.success('确认收货成功，订单已完成')
  // 不再显示链上结果弹窗
}
```

**关键简化**：
- 不再传递 `trade_mode` 和 `buyer_address`
- 移除链上结果展示
- 简化成功提示

## 对比 1015c 原系统

### 1015c 的实现
```javascript
// DeliverySeller.vue - 卖家确认交付
async confirmDelivery(asset) {
  const r = await axios.post('/api/delivery/seller/confirm', {
    transactionId: asset.transaction_id,
    sellerAddress: asset.seller_address,
  });
  // 此时执行链上转移
}
```

### 我们的实现（修改后）
```javascript
// asset.js - 卖家交付
exports.sellerDeliver = async (orderNo, sellerId, payload = {}) => {
  // 配置证书
  await chainClient.dynamicCertConfig('client1', orgName);
  // 执行链上转移
  await chainClient.transferFrom({...});
  // 更新订单状态
}
```

**完全对齐！** ✅

## 优势分析

### 新流程的优势
1. **卖家主导**：卖家在交付时完成链上转移，符合"卖家发货"的业务逻辑
2. **买家简化**：买家只需确认收货，无需关心链上操作
3. **对齐原系统**：与 1015c 流程一致，便于维护

### 原流程的优势（已废弃）
1. **买家保护**：买家确认后才转移，更安全
2. **可撤销**：卖家交付后，买家可以拒绝确认

## 测试验证

### 测试步骤
1. **创建订单**：买家下单并支付
2. **卖家交付**：
   - 卖家点击"卖家交付"按钮
   - 后端执行链上转移
   - 检查日志：应看到"配置证书"、"执行所有权转移"、"链上交易结果"
   - 订单状态变为"待买家确认"（order_status = 2）
3. **买家确认**：
   - 买家点击"买家确认"按钮
   - 后端仅更新订单状态
   - 订单状态变为"已完成"（order_status = 3）
4. **验证结果**：
   - 链上 owner_address 已更新为买家地址
   - 资产 trade_count 增加 1
   - 订单完成

### 预期日志
```
卖家交付 - 链上交易前检查: { tokenId: '...', beforeOwner: '0x...', sellerAddress: '0x...', buyerAddress: '0x...', tradeMode: 'ownership' }
配置证书: { clientName: 'client1', orgName: 'wx-org1.chainmaker.org' }
执行所有权转移: { from: '0x...', to: '0x...', tokenId: '...' }
链上交易结果: { txid: '...', ... }
```

## 相关文件

### 修改文件
- `/Users/feiziyun/Downloads/bupt/back/service/asset.js` - 后端核心逻辑（2 个函数）
- `/Users/feiziyun/Downloads/bupt/front/vue-project/src/views/assetDelivery/index.vue` - 前端订单管理页（2 处修改）

### 参考文档
- `/Users/feiziyun/Downloads/bupt/back/IMPLEMENTATION_SUMMARY.md` - 原实施总结
- `/Users/feiziyun/Downloads/bupt/back/BUGFIX_CHAIN_AUTH.md` - 证书配置修复

## 注意事项

1. **证书配置**：确保在链上转移前调用 `dynamicCertConfig`
2. **地址生成**：优先使用链上记录的 owner_address，其次从证书解析，最后从用户 ID 派生
3. **权限验证**：在卖家交付时验证 can_sell_* 权限
4. **错误处理**：如果链上转移失败，订单状态不会更新，买家无法确认
5. **回滚机制**：如果需要撤销交付，需要手动处理链上状态

## 下一步

1. **重启后端服务**使修改生效
2. **测试完整流程**：创建订单 → 支付 → 卖家交付（链上转移）→ 买家确认
3. **监控日志**：确认链上转移在卖家交付时执行
4. **验证结果**：检查链上 owner_address 和订单状态

## 状态

✅ 已完成并对齐 1015c 原系统
