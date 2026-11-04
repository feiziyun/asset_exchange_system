-- Apply once to an existing database before deploying the order deletion endpoint.
ALTER TABLE asset_order
  ADD COLUMN buyer_deleted_at DATETIME DEFAULT NULL COMMENT '买家删除已关闭订单的时间';
