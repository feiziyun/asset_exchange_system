-- 买家取得交付结果后，订单进入待确认完成（7），确认后进入已完成（3）。
-- 先部署本迁移，再启动包含新状态逻辑的后端。
ALTER TABLE asset_order
  ADD COLUMN buyer_result_downloaded_at DATETIME NULL COMMENT '买家取得交付结果时间' AFTER seller_delivery_time,
  MODIFY COLUMN order_status TINYINT NOT NULL DEFAULT 0
    COMMENT '0=待支付，1=待卖家交付，2=交付中/待下载，3=已完成，4=已关闭，5=退款中，6=已退款，7=待买家确认完成';
