-- Apply to the deployed database after checking whether alipay_transaction already exists.
CREATE TABLE IF NOT EXISTS alipay_payment (
  id BIGINT NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(40) NOT NULL,
  out_trade_no VARCHAR(64) NOT NULL,
  trade_no VARCHAR(64) DEFAULT NULL,
  amount DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  qr_code TEXT DEFAULT NULL,
  expires_at DATETIME NOT NULL,
  paid_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_alipay_out_trade_no (out_trade_no),
  KEY idx_alipay_order (order_no, id),
  CONSTRAINT fk_alipay_payment_order FOREIGN KEY (order_no)
    REFERENCES asset_order (order_no) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
