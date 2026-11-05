-- 代理托管需要独立的上架记录，避免修改原上架记录影响历史订单。
CREATE TABLE IF NOT EXISTS asset_delegations (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  asset_id BIGINT NOT NULL,
  owner_id BIGINT NOT NULL,
  owner_address VARCHAR(128) NOT NULL,
  agent_user_id BIGINT NOT NULL,
  agent_address VARCHAR(128) NOT NULL,
  quantity_total INT NOT NULL DEFAULT 1,
  quantity_remaining INT NOT NULL DEFAULT 1,
  allowed_rights VARCHAR(255) NOT NULL,
  price DECIMAL(18,2) DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  KEY idx_asset_status (asset_id, status),
  KEY idx_agent_status (agent_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE asset_publish_record ADD KEY idx_publish_asset_id (asset_id);
ALTER TABLE asset_publish_record DROP INDEX uk_publish_asset_id;
ALTER TABLE asset_publish_record ADD COLUMN delegation_id BIGINT NULL;
ALTER TABLE asset_publish_record ADD UNIQUE KEY uk_publish_delegation (delegation_id);
ALTER TABLE asset_order ADD COLUMN delegation_id BIGINT NULL;
ALTER TABLE asset_order ADD KEY idx_order_delegation (delegation_id);
ALTER TABLE asset_order ADD COLUMN chain_transfer_status VARCHAR(16) NOT NULL DEFAULT 'PENDING';
