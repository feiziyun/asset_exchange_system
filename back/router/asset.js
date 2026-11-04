const express = require('express');
const router = express.Router();
const expressJoi = require('@escook/express-joi');
const { memoryUpload } = require('../middleware/upload');

const assetHandler = require('../router_handle/asset');
const alipayRouter = require('./alipay');
const {
  classifyAsset_limit,
  saveValuationRecord_limit,
  registerAsset_limit,
  createSubCategory_limit,
  listAsset_limit,
  assetDetail_limit,
  myListAsset_limit,
  updateAsset_limit,
  updateAssetStatus_limit,
  proxyCustody_limit,
  publishAsset_limit,
  createOrder_limit,
  createOrderByAsset_limit,
  payOrder_limit,
  sellerConfirmOrder_limit,
  saveContract_limit,
  sellerDeliver_limit,
  confirmDelivery_limit,
  listOrder_limit,
} = require('../limit/asset');

router.post('/classify', expressJoi(classifyAsset_limit), assetHandler.classifyAsset);
router.post('/valuation/record', expressJoi(saveValuationRecord_limit), assetHandler.saveAssetValuationRecord);
router.get('/meta', assetHandler.getAssetMeta);
router.post('/sub-category', expressJoi(createSubCategory_limit), assetHandler.createSubCategory);

// 资产登记
router.post('/register', memoryUpload.single('picture_file'), assetHandler.registerAsset);
// 生成文件哈希（1015c流程）
router.post('/generate-hash', memoryUpload.any(), assetHandler.generateHash);
router.post('/generate-fingerprint', memoryUpload.any(), assetHandler.generateFingerprint);
router.post('/omniprint/similarity-check', assetHandler.checkOmniPrintSimilarity);
// 资产列表展示
router.get('/list', expressJoi(listAsset_limit), assetHandler.listAsset);
// 首页统计
router.get('/home/stats', assetHandler.homeStats);
// 资产详情
router.get('/detail/:id', expressJoi(assetDetail_limit), assetHandler.getAssetDetail);

// 当前用户资产列表（资产管理页）
router.get('/my/list', expressJoi(myListAsset_limit), assetHandler.listMyAsset);

// 编辑当前用户资产
router.put('/manage/:id', expressJoi(updateAsset_limit), assetHandler.updateAsset);

// 修改资产状态（上架/下架/售罄）
router.patch('/manage/:id/status', expressJoi(updateAssetStatus_limit), assetHandler.updateAssetStatus);

// 资产代理托管
router.post('/manage/:id/proxy-custody', expressJoi(proxyCustody_limit), assetHandler.proxyCustody);

// 资产上架
router.post('/publish', expressJoi(publishAsset_limit), assetHandler.publishAsset);

// 拍卖：查询、出价、结算与买家竞拍结果
router.get('/auction/:asset_id', assetHandler.getAuction);
router.get('/auction/:asset_id/bids', assetHandler.listAuctionBids);
router.post('/auction/:asset_id/bid', assetHandler.placeAuctionBid);
router.post('/auction/:asset_id/settle', assetHandler.settleAuction);
router.get('/auction/won/me', assetHandler.listWonAuctions);

// 订单：下单
router.post('/order/create', expressJoi(createOrder_limit), assetHandler.createOrder);

// 订单：从资产详情直接购买（自动选可用上架批次）
router.post('/order/create-by-asset', expressJoi(createOrderByAsset_limit), assetHandler.createOrderByAsset);

// 订单付款只由支付宝查单或通知确认后完成。
router.use('/order/alipay', alipayRouter);

// Only available when config/alipay.js explicitly skips sandbox payment.
router.post('/order/pay/:order_no', expressJoi(payOrder_limit), assetHandler.payOrder);

router.post('/order/cancel/:order_no', assetHandler.cancelOrder);
router.delete('/order/closed/:order_no', assetHandler.deleteClosedOrder);

// 订单：卖家确认交易（对齐原始系统卖家交易市场）
router.post('/order/seller-confirm/:order_no', expressJoi(sellerConfirmOrder_limit), assetHandler.sellerConfirmOrder);

// 订单：配置数字合约/交付方式
router.post('/order/contract/:order_no', expressJoi(saveContract_limit), assetHandler.saveOrderContract);

// 买家在交付阶段绑定证书
router.post('/order/delivery/bind-buyer-certificate/:order_no', assetHandler.bindBuyerDeliveryCertificate);

// 卖家交付（卖家交付后进入待买家确认）
router.post('/order/delivery/seller/:order_no', expressJoi(sellerDeliver_limit), assetHandler.sellerDeliver);

// 买家请求安全交付（对齐原始系统）
router.post('/order/delivery/request-secure/:order_no', assetHandler.requestSecureDelivery);

// 买家查询是否可下载交付结果
router.get('/order/delivery/export-eligible/:order_no', assetHandler.getDeliveryExportEligible);

// 买家下载交付结果
router.post('/order/delivery/download/:order_no', assetHandler.downloadDeliveryResult);

// 交付确认（买家确认后订单完成）
router.post('/order/delivery/confirm/:order_no', expressJoi(confirmDelivery_limit), assetHandler.confirmDelivery);

// 订单列表（资产交付页展示）
router.get('/order/list', expressJoi(listOrder_limit), assetHandler.listOrders);

module.exports = router;
