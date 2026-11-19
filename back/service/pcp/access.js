function assertTradeActor(req, transaction, role = 'participant') {
  const id = Number(req.auth?.id);
  const buyerId = Number(transaction?.buyer_id);
  const sellerId = Number(transaction?.seller_id);
  const allowed = Number.isSafeInteger(id) && id > 0 && (
    role === 'buyer' ? id === buyerId :
      role === 'seller' ? id === sellerId :
        id === buyerId || id === sellerId
  );
  if (!allowed) {
    const error = new Error('无权操作该交易的隐私计算交付');
    error.statusCode = 403;
    throw error;
  }
}

function assertTradeWritable(transaction) {
  if (!['已确认', '已交付'].includes(String(transaction?.status || ''))) {
    const error = new Error('交易尚未确认或已结束，不能提交隐私计算材料');
    error.statusCode = 409;
    throw error;
  }
  const expiresAt = transaction?.expiration_time;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    const error = new Error('数字合约已过期，不能提交隐私计算材料');
    error.statusCode = 409;
    throw error;
  }
}

module.exports = { assertTradeActor, assertTradeWritable };
