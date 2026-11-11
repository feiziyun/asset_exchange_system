const assetService = require('../service/asset');

const findFileByField = (files, fieldName) => {
  if (!Array.isArray(files)) return null;
  return files.find((item) => item.fieldname === fieldName) || null;
};

exports.generateHash = async (req, res) => {
  try {
    const sourceFile = findFileByField(req.files, 'file') || req.files?.[0];
    if (!sourceFile) return res.cc('请上传源文件');

    const algorithm = req.body?.algorithm || 'SHA2_256';
    const result = await assetService.generateFileHash(sourceFile, algorithm);
    return res.send({
      status: 0,
      message: '哈希生成成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.generateFingerprint = async (req, res) => {
  try {
    const sourceFile = findFileByField(req.files, 'file') || req.files?.[0];
    if (!sourceFile) return res.cc('请上传源文件');

    const result = await assetService.generateFileFingerprint(sourceFile, req.body?.assetId || '');
    return res.send({
      success: true,
      message: '数字指纹生成成功',
      type: result.type,
      fingerprint: result.fingerprint,
      fingerprint_bits: result.fingerprint_bits,
      raw: result.raw,
    });
  } catch (error) {
    if (error?.statusCode === 409) {
      return res.status(409).send({
        success: false,
        message: error.message || '发现相似资产，未生成新数字指纹',
        similarAssets: error.data || null,
      });
    }
    if (Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 600) {
      return res.status(Number(error.statusCode)).send({
        success: false,
        message: error.message || 'OmniPrint 指纹生成失败',
        remote: error.data || null,
      });
    }
    return res.status(500).send({
      success: false,
      message: 'OmniPrint 服务异常',
      error: error.message || '数字指纹生成失败',
    });
  }
};

exports.checkOmniPrintSimilarity = async (req, res) => {
  try {
    const result = await assetService.checkOmniPrintSimilarity(req.body || {});
    return res.send(result);
  } catch (error) {
    return res.status(502).send({
      status: 1,
      success: false,
      message: 'OmniPrint 相似度检测失败',
      error: error?.message || String(error),
    });
  }
};

exports.classifyAsset = async (req, res) => {
  try {
    const result = await assetService.classifyAssetText(req.body.text, req.body.method_name);
    return res.send({
      status: 0,
      message: '分类分级成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.saveAssetValuationRecord = async (req, res) => {
  try {
    const userId = req.auth?.id || null;
    const username = req.auth?.account || req.auth?.username || req.body?.createdByUsername || '';
    const result = await assetService.saveAssetValuationRecord(req.body, {
      userId,
      username,
    });
    return res.send({
      status: 0,
      message: '估值记录保存成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.getAssetMeta = async (_req, res) => {
  try {
    const result = await assetService.getAssetMeta();
    return res.send({
      status: 0,
      message: '查询成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.createSubCategory = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.createSubCategory(req.body, userId, req.auth?.identity || '');
    return res.send({
      status: 0,
      message: '子类创建成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

// 资产登记
exports.registerAsset = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const data = {
      ...req.body,
      picture_file: req.file || null,
      collect_time_start: req.body.collect_time_start || null,
      collect_time_end: req.body.collect_time_end || null,
    };

    const result = await assetService.createAsset(data, userId, req.auth?.identity || '');
    const chainResult = result.chain || {};
    return res.send({
      status: 0,
      message: '资产登记成功',
      data: {
        asset_id: result.assetId,
        chain_status: chainResult.chain_status || 1,
        chain: chainResult,
      },
    });
  } catch (error) {
    return res.cc(error);
  }
};

// 资产展示（列表）
exports.listAsset = async (req, res) => {
  try {
    const result = await assetService.listAssets(req.query);
    return res.send({
      status: 0,
      message: '查询成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

// 首页统计
exports.homeStats = async (_req, res) => {
  try {
    const result = await assetService.getHomeStats();
    return res.send({
      status: 0,
      message: '查询成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

// 资产详情界面
exports.getAssetDetail = async (req, res) => {
  try {
    const result = await assetService.getAssetDetail(req.params.id, req.query.publish_id);
    if (!result) return res.cc('资产不存在');

    return res.send({
      status: 0,
      message: '查询成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.listMyAsset = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.listMyAssets(req.query, userId, req.auth?.identity || '');
    return res.send({
      status: 0,
      message: '查询成功',
      data: result,
    });
  } catch (error) {
    console.error('[asset/my/list] request failed', {
      userId: req.auth?.id,
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
    return res.cc(error);
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    await assetService.updateAssetByOwner(req.params.id, userId, req.body, req.auth?.identity || '');
    return res.send({
      status: 0,
      message: '资产更新成功',
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.updateAssetStatus = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    await assetService.updateAssetStatusByOwner(
      req.params.id,
      userId,
      req.body.status,
      req.auth?.identity || '',
    );
    return res.send({
      status: 0,
      message: '资产状态更新成功',
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.proxyCustody = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.proxyCustodyByOwner(
      req.params.id,
      userId,
      req.body,
      req.auth?.identity || '',
    );
    return res.send({
      status: 0,
      message: '代理托管设置成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.publishAsset = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.publishAsset(req.body, userId, req.auth?.identity || '');
    return res.send({
      status: 0,
      message: '资产上架成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.getAuction = async (req, res) => {
  try {
    const result = await assetService.getAuctionByAssetId(req.params.asset_id);
    return res.send({ status: 0, message: '查询成功', data: result });
  } catch (error) {
    return res.cc(error);
  }
};

exports.listAuctionBids = async (req, res) => {
  try {
    const result = await assetService.listAuctionBids(req.params.asset_id);
    return res.send({ status: 0, message: '查询成功', data: result });
  } catch (error) {
    return res.cc(error);
  }
};

exports.placeAuctionBid = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');
    const result = await assetService.placeAuctionBid(
      req.params.asset_id,
      userId,
      req.body?.bid_price,
      req.auth?.identity || '',
    );
    return res.send({ status: 0, message: '出价成功', data: result });
  } catch (error) {
    return res.cc(error);
  }
};

exports.settleAuction = async (req, res) => {
  try {
    const result = await assetService.settleAuctionByAssetId(req.params.asset_id);
    return res.send({ status: 0, message: '拍卖结算完成', data: result });
  } catch (error) {
    return res.cc(error);
  }
};

exports.listWonAuctions = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');
    const result = await assetService.listWonAuctions(userId);
    return res.send({ status: 0, message: '查询成功', data: result });
  } catch (error) {
    return res.cc(error);
  }
};

exports.createOrder = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.createOrder(req.body, userId, req.auth?.identity || '');
    return res.send({
      status: 0,
      message: '下单成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.createOrderByAsset = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.createOrderByAsset(req.body, userId, req.auth?.identity || '');
    return res.send({
      status: 0,
      message: '下单成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.payOrder = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');
    const result = await assetService.payOrder(req.params.order_no, userId, req.body || {});
    return res.send({ status: 0, message: '订单已确认，等待卖家交付', data: result });
  } catch (error) {
    return res.cc(error);
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    if (!req.auth?.id) return res.cc('缺少用户身份信息');
    const result = await assetService.cancelOrder(req.params.order_no, req.auth.id);
    return res.send({ status: 0, message: '订单已关闭', data: result });
  } catch (error) {
    return res.cc(error);
  }
};

exports.rejectOrder = async (req, res) => {
  try {
    if (!req.auth?.id) return res.cc('缺少用户身份信息');
    const result = await assetService.cancelOrder(req.params.order_no, null, { sellerId: req.auth.id });
    return res.send({ status: 0, message: '订单已拒绝并退款', data: result });
  } catch (error) { return res.cc(error); }
};

exports.deleteClosedOrder = async (req, res) => {
  try {
    if (!req.auth?.id) return res.cc('缺少用户身份信息');
    const result = await assetService.deleteClosedOrder(req.params.order_no, req.auth.id);
    return res.send({ status: 0, message: '订单已删除', data: result });
  } catch (error) {
    return res.cc(error);
  }
};

exports.sellerConfirmOrder = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.sellerConfirmOrder(
      req.params.order_no,
      userId,
      req.auth?.identity || '',
    );
    return res.send({
      status: 0,
      message: '卖家确认交易成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.saveOrderContract = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.saveOrderContract(
      req.params.order_no,
      userId,
      req.body || {},
      req.auth?.identity || '',
    );
    return res.send({
      status: 0,
      message: '数字合约配置成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.bindBuyerDeliveryCertificate = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.bindBuyerDeliveryCertificate(
      req.params.order_no,
      userId,
      req.body || {},
    );
    return res.send({
      status: 0,
      message: '买家证书绑定成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.sellerDeliver = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const chainData = await assetService.sellerDeliver(req.params.order_no, userId, req.body || {});
    return res.send({
      status: 0,
      message: '卖家交付成功，等待买家确认',
      data: chainData,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.confirmDelivery = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const chainData = await assetService.confirmDelivery(req.params.order_no, userId, req.body || {});
    return res.send({
      status: 0,
      message: '交付确认成功，订单已完成',
      data: chainData,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.requestSecureDelivery = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.requestSecureDelivery(req.params.order_no, userId, req.body || {});
    return res.send({
      status: 0,
      message: '交付申请已提交',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.getDeliveryExportEligible = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.getDeliveryExportEligible(req.params.order_no, userId);
    return res.send({
      status: 0,
      message: '查询成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};

exports.downloadDeliveryResult = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.downloadDeliveryResult(req.params.order_no, userId, req.body || {});
    if (!result?.buffer) return res.cc('下载结果为空');

    res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename || 'delivery_result.bin')}"`);
    return res.send(result.buffer);
  } catch (error) {
    return res.cc(error);
  }
};

exports.listOrders = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return res.cc('缺少用户身份信息');

    const result = await assetService.listOrders(req.query, userId, req.auth?.identity || '');
    return res.send({
      status: 0,
      message: '查询成功',
      data: result,
    });
  } catch (error) {
    return res.cc(error);
  }
};
