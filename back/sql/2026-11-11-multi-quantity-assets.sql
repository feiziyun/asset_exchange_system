-- 现有数量列已是 INT；新增订单链上操作记录表。历史 Mint 资产保留 is_divisible=0、total_qty=1。
-- 新登记资产由应用写入 is_divisible=1、total_qty=N，并调用 En-Mint(from, amount=N)。
-- 不得只修改历史记录的 total_qty/is_divisible：这样不会在链上铸造新份数。
ALTER TABLE digital_asset MODIFY COLUMN total_qty INT NOT NULL DEFAULT 1 COMMENT '登记铸造总份数';
ALTER TABLE digital_asset MODIFY COLUMN available_qty INT NOT NULL DEFAULT 1 COMMENT '未上架剩余份数';
ALTER TABLE digital_asset MODIFY COLUMN is_divisible TINYINT NOT NULL DEFAULT 0 COMMENT '0=Mint单份资产，1=En-Mint多份资产';
-- asset_chain_info.chain_tx_hash 记录本资产的铸造交易；digital_asset.total_qty 对应该交易铸造份数。
-- 每笔订单以 asset_order.asset_id、publish_id、buy_qty 记录从该资产售出的份数。
-- 原型的 En-Mint/En-Transfer 请求只传地址和份数，链上接口没有文件哈希字段。
CREATE TABLE IF NOT EXISTS `asset_chain_transfer_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL COMMENT '对应订单',
  `asset_id` BIGINT NOT NULL COMMENT '对应登记资产',
  `chain_action` VARCHAR(32) NOT NULL COMMENT 'TransferFrom/En-Transfer/BuyPermission',
  `quantity` INT NOT NULL COMMENT '订单购买份数；BuyPermission 链上接口不接收份数',
  `from_address` VARCHAR(128) NOT NULL DEFAULT '',
  `to_address` VARCHAR(128) NOT NULL DEFAULT '',
  `chain_tx_hash` VARCHAR(128) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chain_transfer_order` (`order_id`),
  KEY `idx_chain_transfer_asset` (`asset_id`),
  CONSTRAINT `fk_chain_transfer_order` FOREIGN KEY (`order_id`) REFERENCES `asset_order` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_chain_transfer_asset` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单链上权益操作与登记资产份数对应记录';
