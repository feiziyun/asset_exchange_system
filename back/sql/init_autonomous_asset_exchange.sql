-- ============================================
-- 自动驾驶数字资产流通系统 - 新库初始化脚本
-- 目标数据库：autonomous_asset_exchange
-- 适用版本：MySQL 8.x / 9.x
-- 说明：仅创建结构和基础字典数据，不导入历史业务数据
-- ============================================

CREATE DATABASE IF NOT EXISTS `autonomous_asset_exchange`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `autonomous_asset_exchange`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `reconcile_log`;
DROP TABLE IF EXISTS `asset_valuation_record`;
DROP TABLE IF EXISTS `mpc_delivery_contracts`;
DROP TABLE IF EXISTS `fl_delivery_contracts`;
DROP TABLE IF EXISTS `pre_delivery_contracts`;
DROP TABLE IF EXISTS `he_delivery_contracts`;
DROP TABLE IF EXISTS `delivery_records`;
DROP TABLE IF EXISTS `delivery_requests`;
DROP TABLE IF EXISTS `digital_contracts`;
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `wallet_ledger`;
DROP TABLE IF EXISTS `wallet_recharge`;
DROP TABLE IF EXISTS `wallet_order_payment`;
DROP TABLE IF EXISTS `asset_order`;
DROP TABLE IF EXISTS `auction_settlement`;
DROP TABLE IF EXISTS `auction_bid`;
DROP TABLE IF EXISTS `asset_publish_record`;
DROP TABLE IF EXISTS `asset_chain_info`;
DROP TABLE IF EXISTS `digital_asset`;
DROP TABLE IF EXISTS `asset_sub_category`;
DROP TABLE IF EXISTS `asset_category`;
DROP TABLE IF EXISTS `region`;
DROP TABLE IF EXISTS `user_role_logs`;
DROP TABLE IF EXISTS `certificate_registry`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` BIGINT AUTO_INCREMENT COMMENT '用户唯一标识',
  `account` VARCHAR(50) NOT NULL COMMENT '账号',
  `password` VARCHAR(255) NOT NULL COMMENT '密码（加密存储）',
  `identity` VARCHAR(20) DEFAULT NULL COMMENT '身份/角色',
  `auditor_target` VARCHAR(64) DEFAULT NULL COMMENT '审计入口：HUB 或 NODE:<node_id>',
  `department` VARCHAR(100) DEFAULT NULL COMMENT '所属部门',
  `name` VARCHAR(50) DEFAULT NULL COMMENT '姓名',
  `sex` CHAR(1) DEFAULT NULL COMMENT '性别（M-男/F-女）',
  `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态（0-正常，1-冻结）',
  `avatarData` LONGBLOB DEFAULT NULL COMMENT '头像二进制',
  `avatarMimeType` VARCHAR(120) NOT NULL DEFAULT '' COMMENT '头像 MIME 类型',
  `default_register_cert` VARCHAR(100) DEFAULT NULL COMMENT '默认登记证书',
  `default_trade_cert` VARCHAR(100) DEFAULT NULL COMMENT '默认交易证书',
  `balance` DECIMAL(18,2) NOT NULL DEFAULT 0.00 COMMENT '可用余额（人民币）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_account` (`account`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

CREATE TABLE `region` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `region_key` VARCHAR(20) NOT NULL COMMENT '地区标识',
  `region_name` VARCHAR(50) NOT NULL COMMENT '地区名称',
  `province` VARCHAR(50) DEFAULT NULL COMMENT '所属省份',
  `city` VARCHAR(50) DEFAULT NULL COMMENT '城市名',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序权重',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_region_key` (`region_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='地区表';

CREATE TABLE `user_role_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `old_identity` VARCHAR(20) DEFAULT NULL COMMENT '原角色',
  `new_identity` VARCHAR(20) DEFAULT NULL COMMENT '新角色',
  `operator_user_id` BIGINT DEFAULT NULL COMMENT '操作人ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_role_logs_user_id` (`user_id`),
  KEY `idx_user_role_logs_operator_user_id` (`operator_user_id`),
  CONSTRAINT `fk_user_role_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_role_logs_operator` FOREIGN KEY (`operator_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色变更日志';

CREATE TABLE `certificate_registry` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` BIGINT DEFAULT NULL COMMENT '证书所属用户ID',
  `certificate_name` VARCHAR(120) NOT NULL COMMENT '证书名称',
  `org` VARCHAR(120) NOT NULL DEFAULT 'wx-org1' COMMENT '组织编码',
  `sign_cert_path` VARCHAR(500) DEFAULT NULL COMMENT '签名证书路径',
  `tls_cert_path` VARCHAR(500) DEFAULT NULL COMMENT 'TLS证书路径',
  `pem_path` VARCHAR(500) DEFAULT NULL COMMENT '私钥PEM路径',
  `address` VARCHAR(128) DEFAULT NULL COMMENT '证书解析出的链上地址',
  `expires_at` DATETIME DEFAULT NULL COMMENT '过期时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cert_org` (`certificate_name`, `org`),
  KEY `idx_certificate_registry_user_id` (`user_id`),
  KEY `idx_certificate_registry_address` (`address`),
  CONSTRAINT `fk_certificate_registry_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户证书登记表';

CREATE TABLE `asset_category` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_key` VARCHAR(50) NOT NULL COMMENT '大类编码',
  `category_name` VARCHAR(100) NOT NULL COMMENT '大类名称',
  `category_desc` VARCHAR(255) DEFAULT NULL COMMENT '大类描述',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_key` (`category_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产大类表';

CREATE TABLE `asset_sub_category` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `sub_category_key` VARCHAR(50) NOT NULL COMMENT '子类编码',
  `sub_category_name` VARCHAR(100) NOT NULL COMMENT '子类名称',
  `sub_category_desc` VARCHAR(255) DEFAULT NULL COMMENT '子类描述',
  `category_id` INT NOT NULL COMMENT '所属大类ID',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sub_category_key` (`sub_category_key`),
  KEY `idx_sub_category_category_id` (`category_id`),
  CONSTRAINT `fk_sub_category_category` FOREIGN KEY (`category_id`) REFERENCES `asset_category` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产子类表';

CREATE TABLE `digital_asset` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `asset_name` VARCHAR(255) NOT NULL COMMENT '资产名称',
  `brief` VARCHAR(500) DEFAULT NULL COMMENT '资产摘要',
  `description` TEXT DEFAULT NULL COMMENT '资产描述',
  `security_level` TINYINT NOT NULL DEFAULT 1 COMMENT '安全等级',
  `classification_category_name` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '分类分级服务返回的资产类别名称',
  `classification_data_level` VARCHAR(20) NOT NULL DEFAULT '一般数据' COMMENT '分类分级服务返回的数据分级',
  `category_id` INT NOT NULL COMMENT '资产大类ID',
  `category_key` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '资产大类编码',
  `sub_category_id` INT NULL DEFAULT NULL COMMENT '资产子类ID（可选）',
  `sub_category_key` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '资产子类编码',
  `region_id` INT NOT NULL COMMENT '地区ID',
  `region_key` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '地区编码',
  `file_hash` VARCHAR(128) NOT NULL COMMENT '文件哈希',
  `hash_algorithm` VARCHAR(50) NOT NULL DEFAULT 'SHA2_256' COMMENT '哈希算法',
  `picture` LONGBLOB DEFAULT NULL COMMENT '资产封面图片二进制',
  `picture_mime_type` VARCHAR(120) NOT NULL DEFAULT '' COMMENT '资产封面图片 MIME 类型',
  `cover_image_url` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '预览图可访问 URL',
  `file_size` BIGINT NOT NULL DEFAULT 0 COMMENT '文件大小',
  `file_format` VARCHAR(50) DEFAULT NULL COMMENT '文件格式',
  `price` DECIMAL(18,2) NOT NULL DEFAULT 0.00 COMMENT '价格',
  `price_unit` VARCHAR(20) NOT NULL DEFAULT '人民币' COMMENT '价格单位',
  `total_qty` INT NOT NULL DEFAULT 1 COMMENT '登记铸造总份数',
  `available_qty` INT NOT NULL DEFAULT 1 COMMENT '未上架剩余份数',
  `is_divisible` TINYINT NOT NULL DEFAULT 0 COMMENT '0=旧版Mint单份资产，1=En-Mint多份资产',
  `pc_type` VARCHAR(32) NOT NULL DEFAULT 'HE' COMMENT '交付方式：HE/PRE/FL/MPC',
  `omniprint_fingerprint` TEXT DEFAULT NULL COMMENT 'OmniPrint 原始指纹，仅用于相似度比较',
  `omniprint_fingerprint_bits` INT DEFAULT NULL COMMENT 'OmniPrint 指纹位数',
  `omniprint_modality` VARCHAR(16) DEFAULT NULL COMMENT 'OmniPrint 模态：text/image/audio/video',
  `omniprint_source` VARCHAR(16) DEFAULT NULL COMMENT 'OmniPrint 来源：file',
  `omniprint_generated_at` DATETIME DEFAULT NULL COMMENT 'OmniPrint 指纹生成时间',
  `can_sell_ownership` TINYINT NOT NULL DEFAULT 0 COMMENT '是否允许出售所有权',
  `can_sell_view_right` TINYINT NOT NULL DEFAULT 0 COMMENT '是否允许出售查阅权',
  `can_sell_process_right` TINYINT NOT NULL DEFAULT 0 COMMENT '是否允许出售加工使用权',
  `allow_resale` TINYINT NOT NULL DEFAULT 0 COMMENT '是否允许转售',
  `is_proxied` TINYINT NOT NULL DEFAULT 0 COMMENT '是否可代理',
  `proxy_agent_address` VARCHAR(128) DEFAULT NULL COMMENT '最近一次成功授权的代理地址',
  `is_third_party` TINYINT NOT NULL DEFAULT 0 COMMENT '是否第三方托管',
  `trade_region` VARCHAR(255) DEFAULT NULL COMMENT '交易区域限制',
  `trade_valid_start` DATETIME DEFAULT NULL COMMENT '交易有效开始时间',
  `trade_valid_end` DATETIME DEFAULT NULL COMMENT '交易有效结束时间',
  `collect_time_start` DATETIME DEFAULT NULL COMMENT '采集开始时间',
  `collect_time_end` DATETIME DEFAULT NULL COMMENT '采集结束时间',
  `collect_location` VARCHAR(255) DEFAULT NULL COMMENT '采集地点',
  `sensor_type` VARCHAR(255) DEFAULT NULL COMMENT '传感器类型',
  `data_volume` VARCHAR(255) DEFAULT NULL COMMENT '数据体量',
  `user_id` BIGINT NOT NULL COMMENT '登记用户ID',
  `certificate_name` VARCHAR(120) DEFAULT NULL COMMENT '登记使用证书名',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '状态：0未上架 1已上架 2已售罄',
  `view_count` INT NOT NULL DEFAULT 0 COMMENT '浏览量',
  `trade_count` INT NOT NULL DEFAULT 0 COMMENT '成交次数',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_file_hash` (`file_hash`),
  KEY `idx_asset_user_id` (`user_id`),
  KEY `idx_asset_category_id` (`category_id`),
  KEY `idx_asset_sub_category_id` (`sub_category_id`),
  KEY `idx_asset_region_id` (`region_id`),
  KEY `idx_classification_data_level` (`classification_data_level`),
  KEY `idx_omniprint_lookup` (`omniprint_modality`, `omniprint_fingerprint_bits`),
  CONSTRAINT `fk_asset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_asset_category` FOREIGN KEY (`category_id`) REFERENCES `asset_category` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_asset_sub_category` FOREIGN KEY (`sub_category_id`) REFERENCES `asset_sub_category` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_asset_region` FOREIGN KEY (`region_id`) REFERENCES `region` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数字资产表';

CREATE TABLE `asset_chain_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `asset_id` BIGINT NOT NULL COMMENT '资产ID',
  `token_id` VARCHAR(128) DEFAULT NULL COMMENT '链上Token ID',
  `owner_address` VARCHAR(128) DEFAULT NULL COMMENT '链上所有者地址',
  `chain_tx_hash` VARCHAR(128) DEFAULT NULL COMMENT '上链交易哈希',
  `chain_status` TINYINT NOT NULL DEFAULT 0 COMMENT '链状态：0待上链 1已上链 2失败',
  `chain_time` DATETIME DEFAULT NULL COMMENT '上链时间',
  `last_sync_time` DATETIME DEFAULT NULL COMMENT '最近同步时间',
  `fail_reason` TEXT DEFAULT NULL COMMENT '失败原因',
  `retry_count` INT NOT NULL DEFAULT 0 COMMENT '重试次数',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chain_asset_id` (`asset_id`),
  KEY `idx_chain_token_id` (`token_id`),
  CONSTRAINT `fk_chain_asset` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产链上信息表';

CREATE TABLE `asset_valuation_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `record_no` VARCHAR(32) NOT NULL COMMENT '估值记录号',
  `asset_id` BIGINT NULL COMMENT '资产ID',
  `file_hash` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '资产哈希/数字标识',
  `asset_name` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '资产名称',
  `method_key` VARCHAR(40) NOT NULL COMMENT '估值方法键',
  `method_name` VARCHAR(100) NOT NULL COMMENT '估值方法名称',
  `final_valuation` DECIMAL(18,2) DEFAULT NULL COMMENT '最终估值；分级模型可为空',
  `valuation_unit` VARCHAR(20) NOT NULL DEFAULT '万元' COMMENT '估值单位',
  `calc_status` TINYINT NOT NULL DEFAULT 1 COMMENT '计算状态：0失败，1成功',
  `status_message` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '状态说明',
  `input_snapshot` JSON NOT NULL COMMENT '估值输入参数快照',
  `result_snapshot` JSON NOT NULL COMMENT '估值结果快照',
  `created_by_user_id` BIGINT NULL COMMENT '创建人用户ID',
  `created_by_username` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '创建人用户名',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asset_valuation_record_no` (`record_no`),
  KEY `idx_asset_valuation_asset_id` (`asset_id`),
  KEY `idx_asset_valuation_file_hash` (`file_hash`),
  KEY `idx_asset_valuation_user_id` (`created_by_user_id`),
  CONSTRAINT `fk_asset_valuation_asset` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asset_valuation_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产估值记录表';

CREATE TABLE `asset_publish_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `asset_id` BIGINT NOT NULL COMMENT '资产ID',
  `publisher_id` BIGINT NOT NULL COMMENT '发布者用户ID',
  `delegation_id` BIGINT DEFAULT NULL COMMENT '代理关系ID，原所有者上架时为空',
  `seller_certificate_name` VARCHAR(120) DEFAULT NULL COMMENT '卖家默认交易证书名快照',
  `seller_address` VARCHAR(128) DEFAULT NULL COMMENT '卖家默认证书地址快照',
  `publish_price` DECIMAL(18,2) NOT NULL DEFAULT 0.00 COMMENT '上架价格',
  `publish_qty` INT NOT NULL DEFAULT 1 COMMENT '上架数量',
  `remaining_qty` INT NOT NULL DEFAULT 1 COMMENT '剩余数量',
  `sold_qty_total` INT NOT NULL DEFAULT 0 COMMENT '累计售出数量',
  `publish_status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1上架中 0已下架 2已售罄',
  `pricing_mode` VARCHAR(16) NOT NULL DEFAULT 'fixed' COMMENT '定价方式：fixed/auction',
  `auction_start_price` DECIMAL(18,2) DEFAULT NULL COMMENT '拍卖起拍价',
  `auction_current_price` DECIMAL(18,2) DEFAULT NULL COMMENT '拍卖当前最高价',
  `auction_end_time` DATETIME DEFAULT NULL COMMENT '拍卖截止时间',
  `auction_bid_count` INT NOT NULL DEFAULT 0 COMMENT '拍卖出价次数',
  `auction_status` VARCHAR(16) DEFAULT NULL COMMENT '拍卖状态：OPEN/CLOSED/UNSOLD',
  `auction_settled_at` DATETIME DEFAULT NULL COMMENT '拍卖结算时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_publish_asset_id` (`asset_id`),
  UNIQUE KEY `uk_publish_delegation` (`delegation_id`),
  KEY `idx_publish_publisher_id` (`publisher_id`),
  KEY `idx_publish_auction_status` (`pricing_mode`, `auction_status`, `auction_end_time`),
  CONSTRAINT `fk_publish_asset` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_publish_user` FOREIGN KEY (`publisher_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产上架记录表';

CREATE TABLE `auction_bid` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `publish_id` BIGINT NOT NULL COMMENT '上架记录ID',
  `asset_id` BIGINT NOT NULL COMMENT '资产ID',
  `bidder_user_id` BIGINT NOT NULL COMMENT '出价用户ID',
  `bid_price` DECIMAL(18,2) NOT NULL COMMENT '出价金额',
  `bid_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '出价时间',
  PRIMARY KEY (`id`),
  KEY `idx_auction_bid_publish_price` (`publish_id`, `bid_price`, `bid_time`),
  KEY `idx_auction_bid_bidder` (`bidder_user_id`, `bid_time`),
  CONSTRAINT `fk_auction_bid_publish` FOREIGN KEY (`publish_id`) REFERENCES `asset_publish_record` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_auction_bid_asset` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_auction_bid_user` FOREIGN KEY (`bidder_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拍卖出价记录表';

CREATE TABLE `auction_settlement` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `publish_id` BIGINT NOT NULL COMMENT '上架记录ID',
  `asset_id` BIGINT NOT NULL COMMENT '资产ID',
  `winner_user_id` BIGINT DEFAULT NULL COMMENT '获胜买家ID，流拍为空',
  `winning_bid_id` BIGINT DEFAULT NULL COMMENT '获胜出价ID',
  `final_price` DECIMAL(18,2) DEFAULT NULL COMMENT '最终成交价',
  `order_no` VARCHAR(40) DEFAULT NULL COMMENT '竞拍成功后生成的待支付订单号',
  `settlement_status` VARCHAR(16) NOT NULL COMMENT 'CLOSED/UNSOLD',
  `settled_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '结算时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_auction_settlement_publish` (`publish_id`),
  UNIQUE KEY `uk_auction_settlement_order` (`order_no`),
  KEY `idx_auction_settlement_winner` (`winner_user_id`),
  CONSTRAINT `fk_auction_settlement_publish` FOREIGN KEY (`publish_id`) REFERENCES `asset_publish_record` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_auction_settlement_asset` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_auction_settlement_winner` FOREIGN KEY (`winner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_auction_settlement_bid` FOREIGN KEY (`winning_bid_id`) REFERENCES `auction_bid` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拍卖结算表';

CREATE TABLE `asset_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_no` VARCHAR(40) NOT NULL COMMENT '订单号',
  `publish_id` BIGINT NOT NULL COMMENT '上架记录ID',
  `delegation_id` BIGINT DEFAULT NULL COMMENT '代理关系ID',
  `chain_transfer_status` VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '代理订单链上过户状态',
  `asset_id` BIGINT NOT NULL COMMENT '资产ID',
  `buyer_id` BIGINT NOT NULL COMMENT '买家ID',
  `buy_qty` INT NOT NULL DEFAULT 1 COMMENT '购买数量',
  `deal_price` DECIMAL(18,2) NOT NULL DEFAULT 0.00 COMMENT '成交单价',
  `trade_mode` VARCHAR(20) DEFAULT 'ownership' COMMENT '交易模式：ownership/view/process',
  `processing_type` VARCHAR(32) DEFAULT NULL COMMENT '处理/权益类型',
  `pc_type` VARCHAR(32) DEFAULT NULL COMMENT '交付方式：HE/PRE/FL/MPC',
  `expiration_time` DATETIME DEFAULT NULL COMMENT '经营权/加工使用权有效截止时间',
  `seller_certificate_name` VARCHAR(120) DEFAULT NULL COMMENT '卖家交易证书名快照',
  `seller_address` VARCHAR(128) DEFAULT NULL COMMENT '卖家链上地址快照',
  `buyer_certificate_name` VARCHAR(120) DEFAULT NULL COMMENT '买家交易证书名快照',
  `buyer_address` VARCHAR(128) DEFAULT NULL COMMENT '买家链上地址',
  `order_status` TINYINT NOT NULL DEFAULT 0 COMMENT '订单状态：0=待支付，1=待卖家交付，2=待买家确认，3=已完成，4=已关闭，5=退款中，6=已退款',
  `buyer_deleted_at` DATETIME DEFAULT NULL COMMENT '买家删除已关闭订单的时间',
  `payment_confirm_time` DATETIME DEFAULT NULL COMMENT '支付确认时间',
  `seller_delivery_time` DATETIME DEFAULT NULL COMMENT '卖家交付时间',
  `buyer_confirm_time` DATETIME DEFAULT NULL COMMENT '买家确认时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_order_publish_id` (`publish_id`),
  KEY `idx_order_delegation` (`delegation_id`),
  KEY `idx_order_asset_id` (`asset_id`),
  KEY `idx_order_buyer_id` (`buyer_id`),
  KEY `idx_order_status` (`order_status`),
  CONSTRAINT `fk_order_publish` FOREIGN KEY (`publish_id`) REFERENCES `asset_publish_record` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_order_asset` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_order_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';
+CREATE TABLE IF NOT EXISTS `asset_chain_transfer_record` (
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

CREATE TABLE `wallet_ledger` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `event_key` VARCHAR(100) NOT NULL,
  `event_type` VARCHAR(24) NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `balance_after` DECIMAL(18,2) NOT NULL,
  `order_no` VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_wallet_event` (`event_key`),
  KEY `idx_wallet_user` (`user_id`, `id`),
  CONSTRAINT `fk_wallet_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `wallet_recharge` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `out_trade_no` VARCHAR(64) NOT NULL,
  `trade_no` VARCHAR(64) DEFAULT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `qr_code` TEXT,
  `expires_at` DATETIME NOT NULL,
  `paid_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_recharge_trade` (`out_trade_no`),
  UNIQUE KEY `uk_recharge_alipay_trade` (`trade_no`),
  KEY `idx_recharge_user` (`user_id`, `id`),
  CONSTRAINT `fk_recharge_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `wallet_order_payment` (
  `order_no` VARCHAR(40) NOT NULL PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PAID',
  `paid_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `refunded_at` DATETIME DEFAULT NULL,
  CONSTRAINT `fk_wallet_payment_order` FOREIGN KEY (`order_no`) REFERENCES `asset_order` (`order_no`),
  CONSTRAINT `fk_wallet_payment_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `transactions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `transaction_id` VARCHAR(64) NOT NULL COMMENT '交易ID（业务唯一）',
  `order_no` VARCHAR(40) NOT NULL COMMENT '关联订单号',
  `asset_id` BIGINT NOT NULL COMMENT '资产ID',
  `owner_id` BIGINT DEFAULT NULL COMMENT '所有者用户ID',
  `buyer_id` BIGINT NOT NULL COMMENT '买家用户ID',
  `buyer_certificate_name` VARCHAR(120) DEFAULT NULL COMMENT '买家交易证书名快照',
  `buyer_address` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '买家链上地址',
  `seller_id` BIGINT DEFAULT NULL COMMENT '卖家用户ID',
  `seller_certificate_name` VARCHAR(120) DEFAULT NULL COMMENT '卖家交易证书名快照',
  `seller_address` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '卖家链上地址',
  `status` VARCHAR(32) NOT NULL DEFAULT '已确认' COMMENT '交易状态',
  `quantity` INT NOT NULL DEFAULT 1 COMMENT '交易数量',
  `quality` VARCHAR(50) DEFAULT NULL COMMENT '资产等级/质量说明',
  `processing_type` VARCHAR(32) DEFAULT NULL COMMENT '处理/权益类型',
  `pc_type` VARCHAR(32) DEFAULT NULL COMMENT '交付方式：HE/PRE/FL/MPC',
  `expiration_time` DATETIME DEFAULT NULL COMMENT '有效截止时间',
  `model_file_hash` VARCHAR(128) DEFAULT NULL COMMENT '模型或源文件哈希',
  `delivery_count` INT NOT NULL DEFAULT 0 COMMENT '交付次数',
  `delivery_limit` INT NOT NULL DEFAULT 1 COMMENT '允许交付次数',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_transaction_id` (`transaction_id`),
  UNIQUE KEY `uk_transaction_order_no` (`order_no`),
  KEY `idx_transaction_asset_id` (`asset_id`),
  KEY `idx_transaction_buyer_id` (`buyer_id`),
  KEY `idx_transaction_seller_id` (`seller_id`),
  KEY `idx_transaction_status` (`status`),
  KEY `idx_transaction_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交易主表';

CREATE TABLE `digital_contracts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `contract_id` VARCHAR(128) NOT NULL COMMENT '数字合约ID（业务唯一）',
  `transaction_id` VARCHAR(64) NOT NULL COMMENT '关联交易ID',
  `order_no` VARCHAR(40) NOT NULL COMMENT '关联订单号',
  `asset_id` BIGINT NOT NULL COMMENT '关联资产ID',
  `contract_name` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '合约名称',
  `product_name` VARCHAR(255) DEFAULT NULL COMMENT '产品名称',
  `token_id` VARCHAR(128) DEFAULT NULL COMMENT 'Token ID或资产唯一标识',
  `contract_description` TEXT DEFAULT NULL COMMENT '合约描述',
  `seller_address` VARCHAR(128) DEFAULT NULL COMMENT '卖家链上地址',
  `buyer_address` VARCHAR(128) DEFAULT NULL COMMENT '买家链上地址',
  `operations` VARCHAR(255) DEFAULT NULL COMMENT '可执行操作/权益',
  `expiration_time` DATETIME DEFAULT NULL COMMENT '失效时间',
  `quantity_limit` INT DEFAULT NULL COMMENT '数量限制',
  `processing_type` VARCHAR(32) DEFAULT NULL COMMENT '处理/权益类型',
  `pc_type` VARCHAR(32) DEFAULT NULL COMMENT '隐私计算方式：HE/PRE/FL/MPC',
  `model_file_hash` VARCHAR(128) DEFAULT NULL COMMENT '模型或源文件哈希',
  `status` VARCHAR(32) NOT NULL DEFAULT '草稿' COMMENT '合约状态',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contract_id` (`contract_id`),
  UNIQUE KEY `uk_contract_transaction_id` (`transaction_id`),
  UNIQUE KEY `uk_contract_order_no` (`order_no`),
  KEY `idx_contract_asset_id` (`asset_id`),
  KEY `idx_contract_pc_type` (`pc_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数字合约表';

CREATE TABLE `delivery_requests` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `transaction_id` VARCHAR(64) NOT NULL COMMENT '关联交易ID',
  `order_no` VARCHAR(40) DEFAULT NULL COMMENT '关联订单号',
  `buyer_address` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '买家链上地址',
  `seller_address` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '卖家链上地址',
  `request_type` VARCHAR(32) NOT NULL DEFAULT 'HE' COMMENT '交付方式：HE/PRE/FL/MPC',
  `vm_name` VARCHAR(100) DEFAULT NULL COMMENT '虚拟机名称',
  `vm_cpu` INT DEFAULT NULL COMMENT '虚拟机CPU',
  `vm_memory_mb` INT DEFAULT NULL COMMENT '虚拟机内存MB',
  `note` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '申请状态',
  `requested_by` BIGINT DEFAULT NULL COMMENT '申请人ID',
  `approved_by` BIGINT DEFAULT NULL COMMENT '审批人ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_delivery_request_transaction_id` (`transaction_id`),
  KEY `idx_delivery_request_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交付申请表';

CREATE TABLE `delivery_records` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `transaction_id` VARCHAR(64) NOT NULL COMMENT '关联交易ID',
  `order_no` VARCHAR(40) DEFAULT NULL COMMENT '关联订单号',
  `delivery_index` INT NOT NULL DEFAULT 1 COMMENT '交付序号',
  `delivery_type` VARCHAR(32) NOT NULL DEFAULT 'HE' COMMENT '交付方式：HE/PRE/FL/MPC',
  `buyer_address` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '买家链上地址',
  `seller_address` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '卖家链上地址',
  `delivery_message` VARCHAR(500) DEFAULT NULL COMMENT '交付说明',
  `result_status` VARCHAR(32) NOT NULL DEFAULT 'DELIVERED' COMMENT '交付结果状态',
  `record_payload` JSON DEFAULT NULL COMMENT '补充记录',
  `delivered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '交付时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_delivery_record_tx_index` (`transaction_id`, `delivery_index`),
  KEY `idx_delivery_record_order_no` (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交付记录表';

CREATE TABLE `he_delivery_contracts` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `transaction_id` VARCHAR(128) NOT NULL,
  `business_contract_id` VARCHAR(128) NOT NULL,
  `current_attempt_id` VARCHAR(128) DEFAULT NULL,
  `pcp_contract_id` VARCHAR(128) DEFAULT NULL,
  `buyer_id` VARCHAR(255) NOT NULL,
  `seller_id` VARCHAR(255) NOT NULL,
  `selected_enc_type` VARCHAR(32) DEFAULT NULL,
  `selected_operation` VARCHAR(16) DEFAULT NULL,
  `paillier_public_key_json` JSON DEFAULT NULL,
  `elgamal_public_key_json` JSON DEFAULT NULL,
  `pcp_status` VARCHAR(32) DEFAULT 'WAITING_INPUT',
  `download_token` TEXT DEFAULT NULL,
  `result_filename` VARCHAR(255) DEFAULT NULL,
  `result_storage_path` TEXT DEFAULT NULL,
  `last_error` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_he_tx` (`transaction_id`),
  UNIQUE KEY `uniq_he_pcp_contract` (`pcp_contract_id`),
  KEY `idx_he_business_contract` (`business_contract_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='HE交付合约表';

CREATE TABLE `pre_delivery_contracts` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `transaction_id` VARCHAR(128) NOT NULL,
  `business_contract_id` VARCHAR(128) NOT NULL,
  `pcp_contract_id` VARCHAR(128) DEFAULT NULL,
  `current_attempt_id` VARCHAR(128) DEFAULT NULL,
  `buyer_id` VARCHAR(255) NOT NULL,
  `seller_id` VARCHAR(255) NOT NULL,
  `buyer_public_key` TEXT DEFAULT NULL,
  `seller_source_public_key` JSON DEFAULT NULL,
  `reencryption_key` JSON DEFAULT NULL,
  `tee_key_id` VARCHAR(255) DEFAULT NULL,
  `pcp_status` VARCHAR(32) DEFAULT 'CREATED',
  `download_token` TEXT DEFAULT NULL,
  `result_filename` VARCHAR(255) DEFAULT NULL,
  `result_storage_path` TEXT DEFAULT NULL,
  `last_error` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_pre_tx` (`transaction_id`),
  UNIQUE KEY `uniq_pre_pcp_contract` (`pcp_contract_id`),
  KEY `idx_pre_business_contract` (`business_contract_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PRE交付合约表';

CREATE TABLE `fl_delivery_contracts` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `transaction_id` VARCHAR(128) NOT NULL,
  `business_contract_id` VARCHAR(128) NOT NULL,
  `pcp_contract_id` VARCHAR(128) DEFAULT NULL,
  `buyer_id` VARCHAR(255) NOT NULL,
  `seller_ids_json` JSON DEFAULT NULL,
  `buyer_result_public_key` TEXT DEFAULT NULL,
  `max_epochs` INT NOT NULL DEFAULT 10,
  `learning_rate` DOUBLE NOT NULL DEFAULT 0.001,
  `batch_size` INT NOT NULL DEFAULT 32,
  `loss_function` VARCHAR(64) NOT NULL DEFAULT 'CrossEntropy',
  `dp_noise_scale` DOUBLE NOT NULL DEFAULT 0,
  `dp_clipping_threshold` DOUBLE NOT NULL DEFAULT 1,
  `pcp_status` VARCHAR(32) DEFAULT 'CREATED',
  `current_epoch` INT NOT NULL DEFAULT 0,
  `buyer_download_token` TEXT DEFAULT NULL,
  `buyer_result_filename` VARCHAR(255) DEFAULT NULL,
  `buyer_result_storage_path` TEXT DEFAULT NULL,
  `seller_join_packages_json` JSON DEFAULT NULL,
  `seller_result_packages_json` JSON DEFAULT NULL,
  `last_error` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_fl_tx` (`transaction_id`),
  UNIQUE KEY `uniq_fl_pcp_contract` (`pcp_contract_id`),
  KEY `idx_fl_business_contract` (`business_contract_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='FL交付合约表';

CREATE TABLE `mpc_delivery_contracts` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `transaction_id` VARCHAR(128) NOT NULL,
  `business_contract_id` VARCHAR(128) NOT NULL,
  `remote_task_id` VARCHAR(128) DEFAULT NULL,
  `mpc_task_type` VARCHAR(32) NOT NULL DEFAULT 'gc',
  `buyer_id` VARCHAR(255) NOT NULL,
  `seller_id` VARCHAR(255) NOT NULL,
  `compute_params_json` JSON DEFAULT NULL,
  `seller_input_json` JSON DEFAULT NULL,
  `seller_filename` VARCHAR(255) DEFAULT NULL,
  `task_status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `remote_status` VARCHAR(32) DEFAULT NULL,
  `result_json` JSON DEFAULT NULL,
  `last_error` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_mpc_tx` (`transaction_id`),
  UNIQUE KEY `uniq_mpc_remote_task` (`remote_task_id`),
  KEY `idx_mpc_business_contract` (`business_contract_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='MPC交付合约表';

CREATE TABLE `reconcile_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `biz_type` VARCHAR(20) NOT NULL COMMENT 'asset/order',
  `biz_id` VARCHAR(64) NOT NULL COMMENT 'asset_id or order_no',
  `expected_state` JSON NULL,
  `onchain_state` JSON NULL,
  `action` VARCHAR(100) NOT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `result` VARCHAR(20) NOT NULL COMMENT 'success/failed/warning/skipped',
  `error_message` VARCHAR(1000) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_type_id` (`biz_type`, `biz_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='链上链下对账日志表';

CREATE TABLE `asset_delegations` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `asset_id` BIGINT NOT NULL,
  `owner_id` BIGINT NOT NULL,
  `owner_address` VARCHAR(128) NOT NULL,
  `agent_user_id` BIGINT NOT NULL,
  `agent_address` VARCHAR(128) NOT NULL,
  `quantity_total` INT NOT NULL DEFAULT 1,
  `quantity_remaining` INT NOT NULL DEFAULT 1,
  `allowed_rights` VARCHAR(255) NOT NULL,
  `price` DECIMAL(18,2) DEFAULT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `revoked_at` DATETIME DEFAULT NULL,
  KEY `idx_asset_status` (`asset_id`, `status`),
  KEY `idx_agent_status` (`agent_user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `region` (`region_key`, `region_name`, `province`, `city`, `sort_order`) VALUES
('all', '全部', '全部', '全部', 0),
('bj', '北京', '北京市', '北京市', 1),
('sh', '上海', '上海市', '上海市', 2),
('gz', '广州', '广东省', '广州市', 3),
('sz', '深圳', '广东省', '深圳市', 4),
('hz', '杭州', '浙江省', '杭州市', 5),
('cd', '成都', '四川省', '成都市', 6);

