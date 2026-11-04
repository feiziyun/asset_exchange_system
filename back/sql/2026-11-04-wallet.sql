-- Apply once to an existing database before deploying the wallet code.
ALTER TABLE users ADD COLUMN balance DECIMAL(18,2) NOT NULL DEFAULT 0.00;

CREATE TABLE wallet_ledger (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  event_key VARCHAR(100) NOT NULL,
  event_type VARCHAR(24) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  balance_after DECIMAL(18,2) NOT NULL,
  order_no VARCHAR(64) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_wallet_event (event_key),
  KEY idx_wallet_user (user_id, id),
  CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wallet_recharge (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  out_trade_no VARCHAR(64) NOT NULL,
  trade_no VARCHAR(64) DEFAULT NULL,
  amount DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  qr_code TEXT,
  expires_at DATETIME NOT NULL,
  paid_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_recharge_trade (out_trade_no),
  UNIQUE KEY uk_recharge_alipay_trade (trade_no),
  KEY idx_recharge_user (user_id, id),
  CONSTRAINT fk_recharge_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wallet_order_payment (
  order_no VARCHAR(40) NOT NULL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PAID',
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  refunded_at DATETIME DEFAULT NULL,
  CONSTRAINT fk_wallet_payment_order FOREIGN KEY (order_no) REFERENCES asset_order(order_no),
  CONSTRAINT fk_wallet_payment_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
