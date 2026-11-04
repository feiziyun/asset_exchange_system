-- MySQL dump 10.13  Distrib 9.4.0, for macos15 (arm64)
--
-- Host: localhost    Database: ManagementSystem
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `alipay_notify_log`
--

DROP TABLE IF EXISTS `alipay_notify_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alipay_notify_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `notify_id` varchar(128) NOT NULL COMMENT '支付宝通知校验ID',
  `notify_type` varchar(64) NOT NULL COMMENT '通知类型',
  `trade_no` varchar(64) DEFAULT NULL COMMENT '支付宝交易号',
  `order_no` varchar(40) DEFAULT NULL COMMENT '商户订单号',
  `trade_status` varchar(32) DEFAULT NULL COMMENT '交易状态',
  `total_amount` decimal(18,2) DEFAULT NULL COMMENT '订单金额',
  `notify_time` datetime DEFAULT NULL COMMENT '通知发送时间',
  `notify_params` text COMMENT '通知参数（JSON格式）',
  `verify_result` tinyint NOT NULL DEFAULT '0' COMMENT '验签结果：0-未验证，1-验证成功，2-验证失败',
  `process_status` tinyint NOT NULL DEFAULT '0' COMMENT '处理状态：0-未处理，1-处理成功，2-处理失败',
  `process_message` varchar(500) DEFAULT NULL COMMENT '处理结果消息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_notify_id` (`notify_id`),
  KEY `idx_trade_no` (`trade_no`),
  KEY `idx_order_no` (`order_no`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='支付宝异步通知日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alipay_notify_log`
--

LOCK TABLES `alipay_notify_log` WRITE;
/*!40000 ALTER TABLE `alipay_notify_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `alipay_notify_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `alipay_refund`
--

DROP TABLE IF EXISTS `alipay_refund`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alipay_refund` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `refund_no` varchar(64) NOT NULL COMMENT '退款单号（商户生成）',
  `trade_no` varchar(64) NOT NULL COMMENT '支付宝交易号',
  `order_no` varchar(40) NOT NULL COMMENT '商户订单号',
  `refund_amount` decimal(18,2) NOT NULL COMMENT '退款金额',
  `refund_reason` varchar(256) DEFAULT NULL COMMENT '退款原因',
  `refund_status` varchar(32) NOT NULL DEFAULT 'PROCESSING' COMMENT '退款状态：PROCESSING-处理中，SUCCESS-退款成功，FAILED-退款失败',
  `gmt_refund` datetime DEFAULT NULL COMMENT '退款时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_no` (`refund_no`),
  KEY `idx_trade_no` (`trade_no`),
  KEY `idx_order_no` (`order_no`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='支付宝退款记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alipay_refund`
--

LOCK TABLES `alipay_refund` WRITE;
/*!40000 ALTER TABLE `alipay_refund` DISABLE KEYS */;
/*!40000 ALTER TABLE `alipay_refund` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `alipay_transaction`
--

DROP TABLE IF EXISTS `alipay_transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alipay_transaction` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_no` varchar(40) NOT NULL COMMENT '商户订单号（关联 asset_order.order_no）',
  `trade_no` varchar(64) DEFAULT NULL COMMENT '支付宝交易号',
  `buyer_id` bigint NOT NULL COMMENT '买家ID（users.id）',
  `total_amount` decimal(18,2) NOT NULL COMMENT '订单总金额（元）',
  `subject` varchar(256) NOT NULL COMMENT '订单标题',
  `body` varchar(400) DEFAULT NULL COMMENT '订单描述',
  `trade_status` varchar(32) NOT NULL DEFAULT 'WAIT_BUYER_PAY' COMMENT '交易状态：WAIT_BUYER_PAY-等待支付，TRADE_SUCCESS-支付成功，TRADE_CLOSED-交易关闭，TRADE_FINISHED-交易完成',
  `buyer_pay_amount` decimal(18,2) DEFAULT NULL COMMENT '买家实际支付金额',
  `receipt_amount` decimal(18,2) DEFAULT NULL COMMENT '商家实收金额',
  `gmt_create` datetime DEFAULT NULL COMMENT '支付宝交易创建时间',
  `gmt_payment` datetime DEFAULT NULL COMMENT '支付宝交易付款时间',
  `gmt_close` datetime DEFAULT NULL COMMENT '支付宝交易关闭时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_trade_no` (`trade_no`),
  KEY `idx_buyer_id` (`buyer_id`),
  KEY `idx_trade_status` (`trade_status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_alipay_order` FOREIGN KEY (`order_no`) REFERENCES `asset_order` (`order_no`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='支付宝支付交易表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alipay_transaction`
--

LOCK TABLES `alipay_transaction` WRITE;
/*!40000 ALTER TABLE `alipay_transaction` DISABLE KEYS */;
INSERT INTO `alipay_transaction` VALUES (1,'OD20260422171242064080',NULL,2,22000.00,'购买数字资产-北京语义标注数据集','模型训练数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 17:13:06','2026-04-22 17:13:06'),(2,'OD20260422171514342014',NULL,2,22000.00,'购买数字资产-北京语义标注数据集','模型训练数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 17:15:14','2026-04-22 17:15:14'),(3,'OD20260422171602049769',NULL,2,22000.00,'购买数字资产-北京语义标注数据集','模型训练数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 17:16:02','2026-04-22 17:16:02'),(4,'OD20260422171605087124',NULL,2,22000.00,'购买数字资产-北京语义标注数据集','模型训练数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 17:16:05','2026-04-22 17:16:05'),(5,'OD20260422171911151264',NULL,2,8000.00,'购买数字资产-深圳信号灯周期数据','信号优化数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 17:19:14','2026-04-22 17:19:14'),(6,'OD20260422172520781923',NULL,2,30000.00,'购买数字资产-上海复杂交互场景','博弈决策训练。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 17:25:20','2026-04-22 17:25:20'),(7,'OD20260422173624540127','2026042222001436410508568249',2,15200.00,'购买数字资产-广州高精地图增量Q1','新增/修改/删除地图要素。','TRADE_SUCCESS',NULL,NULL,NULL,'2026-04-22 17:40:35',NULL,'2026-04-22 17:36:24','2026-04-22 17:40:35'),(8,'OD20260422174413808951',NULL,2,15000.00,'购买数字资产-北京城区多路口视频集','用于检测与跟踪训练。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 17:44:13','2026-04-22 17:44:13'),(9,'OD20260422175209172545',NULL,2,13500.00,'购买数字资产-深圳高速轨迹样本','车辆动态行为数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 17:52:09','2026-04-22 17:52:09'),(10,'OD20260422175603374143',NULL,2,26200.00,'购买数字资产-北京极端天气事件集','极端天气数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 17:56:03','2026-04-22 17:56:03'),(11,'OD20260422180823507289',NULL,12,9000.00,'购买数字资产-广州交通指标周报','结构化统计数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 18:08:23','2026-04-22 18:08:23'),(12,'OD20260422181143563477',NULL,12,14000.00,'购买数字资产-广州雨天路口视频','鲁棒性训练数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 18:11:43','2026-04-22 18:11:43'),(13,'OD20260422182053284977',NULL,12,20000.00,'购买数字资产-上海高密度车流点云','复杂车流建模数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 18:20:53','2026-04-22 18:20:53'),(14,'OD20260422182403106724',NULL,12,15200.00,'购买数字资产-广州高精地图增量Q1','新增/修改/删除地图要素。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 18:24:03','2026-04-22 18:24:03'),(15,'OD20260422182627226427',NULL,12,13000.00,'购买数字资产-深圳自动驾驶轨迹集','行为预测训练数据。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 18:26:28','2026-04-22 18:26:28'),(16,'OD20260422182818876791',NULL,12,16600.00,'购买数字资产-北京地图增量包Q3','地图版本更新。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 18:28:18','2026-04-22 18:28:18'),(17,'OD20260422183029833476',NULL,12,28500.00,'购买数字资产-深圳模型版本资产AVM-2.1','包含评测报告与授权策略。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 18:30:29','2026-04-22 18:30:29'),(18,'OD20260422183237850557',NULL,12,22500.00,'购买数字资产-深圳语义标注数据V3','城市道路模型训练集。','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 18:32:37','2026-04-22 18:32:37'),(19,'OD20260422183448247559','2026042222001436410508573051',12,16600.00,'购买数字资产-北京地图增量包Q3','地图版本更新。','TRADE_SUCCESS',NULL,NULL,NULL,'2026-04-22 18:35:23',NULL,'2026-04-22 18:34:48','2026-04-22 18:35:23'),(20,'OD20260422184459245830','2026042222001436410508573052',12,1.00,'购买数字资产-自动驾驶数字资产测试1','购买数字资产-自动驾驶数字资产测试1','TRADE_SUCCESS',NULL,NULL,NULL,'2026-04-22 18:47:05',NULL,'2026-04-22 18:44:59','2026-04-22 18:47:05'),(21,'OD20260422220049252024','2026042222001436410508578637',12,1.00,'购买数字资产-自动驾驶数字资产测试2','购买数字资产-自动驾驶数字资产测试2','TRADE_SUCCESS',NULL,NULL,NULL,'2026-04-22 22:04:03',NULL,'2026-04-22 22:00:49','2026-04-22 22:04:02'),(22,'OD20260422225627316774',NULL,12,0.00,'购买数字资产-自动驾驶数字资产测试3','购买数字资产-自动驾驶数字资产测试3','WAIT_BUYER_PAY',NULL,NULL,NULL,NULL,NULL,'2026-04-22 22:56:27','2026-04-22 22:56:27'),(23,'OD20260423103745559911','2026042322001436410508573055',12,16600.00,'购买数字资产-北京地图增量包Q3','地图版本更新。','TRADE_SUCCESS',NULL,NULL,NULL,'2026-04-23 10:38:53',NULL,'2026-04-23 10:37:45','2026-04-23 10:38:52');
/*!40000 ALTER TABLE `alipay_transaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asset_category`
--

DROP TABLE IF EXISTS `asset_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_category` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键',
  `category_key` varchar(30) NOT NULL COMMENT '大类标识，如 raw',
  `category_name` varchar(50) NOT NULL COMMENT '大类名称',
  `category_desc` varchar(200) DEFAULT NULL COMMENT '大类描述',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序权重',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_category_key` (`category_key`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产大类表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_category`
--

LOCK TABLES `asset_category` WRITE;
/*!40000 ALTER TABLE `asset_category` DISABLE KEYS */;
INSERT INTO `asset_category` VALUES (1,'raw','原始感知类','传感器/车端原始数据',1,'2026-03-02 10:58:55'),(2,'scene','场景事件类','可交易的场景与事件包',2,'2026-03-02 10:58:55'),(3,'struct','结构化指标类','交通/时空统计要素',3,'2026-03-02 10:58:55'),(4,'derived','衍生加工类','加工后的训练集与模型',4,'2026-03-02 10:58:55');
/*!40000 ALTER TABLE `asset_category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asset_chain_info`
--

DROP TABLE IF EXISTS `asset_chain_info`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_chain_info` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `asset_id` bigint NOT NULL COMMENT '资产 ID，对应 digital_asset.id',
  `token_id` varchar(128) DEFAULT NULL COMMENT '链上 Token ID',
  `owner_address` varchar(128) DEFAULT NULL COMMENT '当前持有者链上地址',
  `chain_tx_hash` varchar(128) DEFAULT NULL COMMENT '最近一次上链交易哈希',
  `chain_status` tinyint NOT NULL DEFAULT '0' COMMENT '链上状态：0=待上链，1=已上链，2=上链失败',
  `chain_time` datetime DEFAULT NULL COMMENT '成功上链时间',
  `last_sync_time` datetime DEFAULT NULL COMMENT '最后一次与链同步的时间',
  `fail_reason` varchar(500) DEFAULT NULL COMMENT '上链失败原因（chain_status=2 时填写）',
  `retry_count` int NOT NULL DEFAULT '0' COMMENT '上链重试次数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_id` (`token_id`),
  KEY `idx_chain_status` (`chain_status`),
  KEY `idx_owner_address` (`owner_address`),
  KEY `fk_chain_asset` (`asset_id`),
  CONSTRAINT `fk_chain_asset` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产链上信息表（与 digital_asset 一对一）';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_chain_info`
--

LOCK TABLES `asset_chain_info` WRITE;
/*!40000 ALTER TABLE `asset_chain_info` DISABLE KEYS */;
INSERT INTO `asset_chain_info` VALUES (1,51,'12323','0x00000000000000000000000000000000000f4241','0x19d072d88c7f43fccea',1,'2026-03-20 01:38:37','2026-03-20 01:38:37',NULL,0,'2026-03-20 01:38:37','2026-03-20 01:38:37'),(2,52,'123223','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-21 20:32:25','2026-03-24 18:13:16'),(3,53,'1111','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-21 20:33:22','2026-03-24 18:13:16'),(4,54,'123','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-21 20:59:25','2026-03-24 18:13:16'),(5,55,'232312321312','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-21 21:10:39','2026-03-24 18:13:16'),(6,56,'12323242345','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-21 21:10:54','2026-03-24 18:13:16'),(7,57,'123232','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-21 21:53:15','2026-03-24 18:13:16'),(8,58,'12323232','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-21 22:33:10','2026-03-24 18:13:16'),(9,59,'323232','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-21 23:01:42','2026-03-24 18:13:16'),(10,60,'5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-22 02:19:52','2026-03-24 18:13:16'),(11,61,'1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-22 02:26:46','2026-03-24 18:13:16'),(12,62,'8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-22 02:29:50','2026-03-24 18:13:16'),(13,63,'fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-22 02:30:31','2026-03-24 18:13:16'),(14,64,'22dcf3f2d5c70aef4df9ba189552b5194083e2908632e9e0d4d7c4e0199adf45','0x00000000000000000000000000000000000f4241','189f0a2870482931cade0c0531c8f4148e74c29eecb844a2b70c2b633f0f0036',1,'2026-03-22 10:52:27','2026-03-22 10:52:27',NULL,0,'2026-03-22 10:52:26','2026-03-22 10:52:27'),(15,65,'b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-22 16:22:19','2026-03-24 18:13:16'),(16,66,'5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-22 16:27:36','2026-03-24 18:13:16'),(17,67,'c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12','0x00000000000000000000000000000000000f4241',NULL,2,NULL,'2026-03-24 18:13:16','fetch failed',7,'2026-03-22 16:29:40','2026-03-24 18:13:16'),(18,68,'3c85efe147e02944e9ed09ceabea6ebdbab04a41dcb13bc36fb23209d3e15857','0x00000000000000000000000000000000000f4241','189f1cab56cb081aca87e2ad712f0aa6b227f8fd226841d3a995e9dbc3b727df',1,'2026-03-22 16:31:40','2026-03-22 16:31:40',NULL,0,'2026-03-22 16:31:40','2026-03-22 16:31:40'),(29,69,'e3e5e07d474ec002dfd64d810481e8e17cff5903b192a1641f7036a3e0f33a96','0x00000000000000000000000000000000000f4242','18a0098adef80e5ccaff6e20f8cf1f4c8eccf3a0da264699bd8ba7a9aa7929a8',1,'2026-03-25 16:52:25','2026-03-25 16:52:25',NULL,0,'2026-03-25 16:52:25','2026-03-25 16:52:25'),(30,70,'f19e4f645f53a40265802264368622e124161563c65384caf31d1b378700ff76','0x00000000000000000000000000000000000f4243','18a8a7ec57dd9f3cca92403bab9fdba4f5a4245d6c1e416a9b22e5ccf1fe4fff',1,'2026-04-22 18:44:47','2026-04-22 18:44:47',NULL,0,'2026-04-22 18:44:46','2026-04-22 18:44:47'),(31,71,'3b92c90701ddfdf006da9341bdb1a07f7fa07db22e92e863cd08ce1bae2e0a6b','0x00000000000000000000000000000000000f4243','18a8b2996067e71dca806e0b3dc97c9f9173e91962a64ec7a489ef493db774d8',1,'2026-04-22 22:00:25','2026-04-22 22:00:25',NULL,0,'2026-04-22 22:00:24','2026-04-22 22:00:25'),(32,72,'a7be09e5a6e2e2f7d44df1414735e89127276d06a590766b1186caed3cc50101','0x00000000000000000000000000000000000f4243','18a8b5a66baff6bdcaf30bc25f04687f3d93727e85b8489ea5385b2aab8c307e',1,'2026-04-22 22:56:19','2026-04-22 22:56:19',NULL,0,'2026-04-22 22:56:19','2026-04-22 22:56:19'),(33,73,'9a5c014bdd7cc46820776d7b10f0a419c6a5ae4dc8dac6833d417801dc7ee381','0x00000000000000000000000000000000000f4241','18ab78c8eb5f76a4ca897a398cbf8227a3716bd326794a009b742aad1af8fb08',1,'2026-05-01 22:54:42','2026-05-01 22:54:42',NULL,0,'2026-05-01 22:54:42','2026-05-01 22:54:42'),(34,74,'fa7aaa8742851154b33ebb3c7b23dfc64cb9fdfda5ac8961c37cd3e9a2599bbb','cf66c161f2efd23696fabe9d287174e6a0b4636b','18ad3cdefe1974a3ca171c465cb57bba1596b7dfe31d4345aada784082d33a79',1,'2026-05-07 16:59:16','2026-05-07 16:59:16',NULL,0,'2026-05-07 16:59:16','2026-05-07 16:59:16');
/*!40000 ALTER TABLE `asset_chain_info` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asset_order`
--

DROP TABLE IF EXISTS `asset_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_order` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `order_no` varchar(40) NOT NULL COMMENT '订单号（业务唯一）',
  `publish_id` bigint NOT NULL COMMENT '来源上架记录ID（asset_publish_record.id）',
  `asset_id` bigint NOT NULL COMMENT '资产ID（digital_asset.id）',
  `buyer_id` bigint NOT NULL COMMENT '买家ID（users.id）',
  `buy_qty` int NOT NULL DEFAULT '1' COMMENT '购买数量',
  `deal_price` decimal(18,6) NOT NULL DEFAULT '0.000000' COMMENT '成交单价（下单时快照）',
  `order_status` tinyint NOT NULL DEFAULT '0' COMMENT '订单状态：0=待支付，1=待卖家交付，2=待买家确认，3=已完成，4=已取消，5=退款中，6=已退款',
  `payment_confirm_time` datetime DEFAULT NULL COMMENT '支付确认时间',
  `seller_delivery_time` datetime DEFAULT NULL COMMENT '卖家交付时间',
  `buyer_confirm_time` datetime DEFAULT NULL COMMENT '买家确认时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `trade_mode` varchar(20) DEFAULT NULL,
  `buyer_address` varchar(128) DEFAULT NULL COMMENT '买家链上地址',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_publish_id` (`publish_id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_buyer_id` (`buyer_id`),
  KEY `idx_order_status` (`order_status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_order_asset` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_order_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_order_publish` FOREIGN KEY (`publish_id`) REFERENCES `asset_publish_record` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=117 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产订单表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_order`
--

LOCK TABLES `asset_order` WRITE;
/*!40000 ALTER TABLE `asset_order` DISABLE KEYS */;
INSERT INTO `asset_order` VALUES (68,'AO202603240001',18,7,1,2,15200.000000,1,NULL,NULL,NULL,'2026-02-23 01:39:23','2026-02-24 01:39:23',NULL,NULL),(69,'AO202603240003',18,7,2,1,15200.000000,2,NULL,NULL,NULL,'2026-02-27 01:39:23','2026-02-27 01:39:23',NULL,NULL),(70,'AO202603240002',18,7,5,2,15200.000000,1,NULL,NULL,NULL,'2026-02-25 01:39:23','2026-02-26 01:39:23',NULL,NULL),(71,'AO202603240004',19,8,1,2,22500.000000,1,NULL,NULL,NULL,'2026-02-24 01:39:23','2026-02-25 01:39:23',NULL,NULL),(72,'AO202603240005',19,8,2,1,22500.000000,1,NULL,NULL,NULL,'2026-02-26 01:39:23','2026-02-27 01:39:23',NULL,NULL),(73,'AO202603240007',19,8,3,1,22500.000000,2,NULL,NULL,NULL,'2026-03-02 01:39:23','2026-03-02 01:39:23',NULL,NULL),(74,'AO202603240006',19,8,5,3,22300.000000,1,NULL,NULL,NULL,'2026-02-28 01:39:23','2026-03-01 01:39:23',NULL,NULL),(75,'AO202603240008',20,9,1,2,28500.000000,1,NULL,NULL,NULL,'2026-02-26 01:39:23','2026-02-27 01:39:23',NULL,NULL),(76,'AO202603240009',20,9,3,2,28200.000000,1,NULL,NULL,NULL,'2026-03-01 01:39:23','2026-03-02 01:39:23',NULL,NULL),(77,'AO202603240010',26,15,2,1,31200.000000,0,NULL,NULL,NULL,'2026-03-05 01:39:23','2026-03-05 01:39:23',NULL,NULL),(78,'AO202603240011',27,16,4,1,27500.000000,2,NULL,NULL,NULL,'2026-03-06 01:39:23','2026-03-06 01:39:23',NULL,NULL),(79,'AO202603240014',32,21,1,1,23800.000000,1,NULL,NULL,NULL,'2026-02-21 01:39:23','2026-02-22 01:39:23',NULL,NULL),(80,'AO202603240015',32,21,3,1,23800.000000,4,NULL,NULL,NULL,'2026-02-23 01:39:23','2026-02-24 01:39:23',NULL,NULL),(81,'AO202603240012',32,21,4,2,23800.000000,1,NULL,NULL,NULL,'2026-02-15 01:39:23','2026-02-16 01:39:23',NULL,NULL),(82,'AO202603240013',32,21,5,2,23600.000000,1,NULL,NULL,NULL,'2026-02-18 01:39:23','2026-02-19 01:39:23',NULL,NULL),(83,'AO202603240016',33,22,2,1,16600.000000,1,NULL,NULL,NULL,'2026-02-17 01:39:23','2026-02-18 01:39:23',NULL,NULL),(84,'AO202603240017',33,22,5,2,16500.000000,1,NULL,NULL,NULL,'2026-02-20 01:39:23','2026-02-21 01:39:23',NULL,NULL),(85,'AO202603240018',34,23,1,2,31500.000000,1,NULL,NULL,NULL,'2026-02-19 01:39:23','2026-02-20 01:39:23',NULL,NULL),(86,'AO202603240019',35,24,3,1,15000.000000,0,NULL,NULL,NULL,'2026-03-15 01:39:23','2026-03-15 01:39:23',NULL,NULL),(87,'AO202603240020',40,29,5,1,30000.000000,2,NULL,NULL,NULL,'2026-03-19 01:39:23','2026-03-19 01:39:23',NULL,NULL),(88,'AO202603240021',43,32,1,2,22000.000000,1,NULL,NULL,NULL,'2026-03-21 01:39:23','2026-03-22 01:39:23',NULL,NULL),(89,'AO202603240022',43,32,3,2,21800.000000,1,NULL,NULL,NULL,'2026-03-22 01:39:23','2026-03-23 01:39:23',NULL,NULL),(90,'AO202603240023',44,33,2,2,32200.000000,1,NULL,NULL,NULL,'2026-03-22 01:39:23','2026-03-23 01:39:23',NULL,NULL),(91,'OD20260422170234592621',44,33,2,1,32200.000000,0,NULL,NULL,NULL,'2026-04-22 17:02:34','2026-04-22 17:02:34',NULL,NULL),(92,'OD20260422170347448980',44,33,2,1,32200.000000,0,NULL,NULL,NULL,'2026-04-22 17:03:47','2026-04-22 17:03:47',NULL,NULL),(93,'OD20260422170939061913',43,32,2,1,22000.000000,0,NULL,NULL,NULL,'2026-04-22 17:09:39','2026-04-22 17:09:39',NULL,NULL),(94,'OD20260422171242064080',43,32,2,1,22000.000000,0,NULL,NULL,NULL,'2026-04-22 17:12:42','2026-04-22 17:12:42',NULL,NULL),(95,'OD20260422171514342014',43,32,2,1,22000.000000,0,NULL,NULL,NULL,'2026-04-22 17:15:14','2026-04-22 17:15:14',NULL,NULL),(96,'OD20260422171602049769',43,32,2,1,22000.000000,0,NULL,NULL,NULL,'2026-04-22 17:16:02','2026-04-22 17:16:02',NULL,NULL),(97,'OD20260422171605087124',43,32,2,1,22000.000000,0,NULL,NULL,NULL,'2026-04-22 17:16:05','2026-04-22 17:16:05',NULL,NULL),(98,'OD20260422171911151264',42,31,2,1,8000.000000,0,NULL,NULL,NULL,'2026-04-22 17:19:11','2026-04-22 17:19:11',NULL,NULL),(99,'OD20260422172520781923',46,29,2,1,30000.000000,0,NULL,NULL,NULL,'2026-04-22 17:25:20','2026-04-22 17:25:20',NULL,NULL),(100,'OD20260422173624540127',18,7,2,1,15200.000000,1,NULL,NULL,NULL,'2026-04-22 17:36:24','2026-04-22 17:40:03',NULL,NULL),(101,'OD20260422174413808951',35,24,2,1,15000.000000,0,NULL,NULL,NULL,'2026-04-22 17:44:13','2026-04-22 17:44:13',NULL,NULL),(102,'OD20260422175209172545',24,13,2,1,13500.000000,0,NULL,NULL,NULL,'2026-04-22 17:52:09','2026-04-22 17:52:09',NULL,NULL),(103,'OD20260422175603374143',39,28,2,1,26200.000000,0,NULL,NULL,NULL,'2026-04-22 17:56:03','2026-04-22 17:56:03',NULL,NULL),(104,'OD20260422180823507289',41,30,12,1,9000.000000,0,NULL,NULL,NULL,'2026-04-22 18:08:23','2026-04-22 18:08:23',NULL,NULL),(105,'OD20260422181143563477',37,26,12,1,14000.000000,0,NULL,NULL,NULL,'2026-04-22 18:11:43','2026-04-22 18:11:43',NULL,NULL),(106,'OD20260422182053284977',36,25,12,1,20000.000000,0,NULL,NULL,NULL,'2026-04-22 18:20:53','2026-04-22 18:20:53',NULL,NULL),(107,'OD20260422182403106724',18,7,12,1,15200.000000,0,NULL,NULL,NULL,'2026-04-22 18:24:03','2026-04-22 18:24:03',NULL,NULL),(108,'OD20260422182627226427',38,27,12,1,13000.000000,0,NULL,NULL,NULL,'2026-04-22 18:26:27','2026-04-22 18:26:27',NULL,NULL),(109,'OD20260422182818876791',33,22,12,1,16600.000000,0,NULL,NULL,NULL,'2026-04-22 18:28:18','2026-04-22 18:28:18',NULL,NULL),(110,'OD20260422183029833476',20,9,12,1,28500.000000,0,NULL,NULL,NULL,'2026-04-22 18:30:29','2026-04-22 18:30:29',NULL,NULL),(111,'OD20260422183237850557',19,8,12,1,22500.000000,0,NULL,NULL,NULL,'2026-04-22 18:32:37','2026-04-22 18:32:37',NULL,NULL),(112,'OD20260422183448247559',33,22,12,1,16600.000000,2,NULL,NULL,NULL,'2026-04-22 18:34:48','2026-04-22 18:38:49',NULL,NULL),(113,'OD20260422184459245830',47,70,12,1,1.000000,2,NULL,NULL,NULL,'2026-04-22 18:44:59','2026-04-22 22:27:35',NULL,NULL),(114,'OD20260422220049252024',48,71,12,1,1.000000,3,NULL,NULL,NULL,'2026-04-22 22:00:49','2026-04-22 22:46:36',NULL,NULL),(115,'OD20260422225627316774',49,72,12,1,0.000000,0,NULL,NULL,NULL,'2026-04-22 22:56:27','2026-04-22 22:56:27','ownership',NULL),(116,'OD20260423103745559911',33,22,12,1,16600.000000,1,NULL,NULL,NULL,'2026-04-23 10:37:45','2026-04-23 10:38:52','ownership',NULL);
/*!40000 ALTER TABLE `asset_order` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asset_publish_record`
--

DROP TABLE IF EXISTS `asset_publish_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_publish_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `asset_id` bigint NOT NULL COMMENT '资产ID（digital_asset.id）',
  `publisher_id` bigint NOT NULL COMMENT '上架人ID（users.id）',
  `publish_price` decimal(18,6) NOT NULL DEFAULT '0.000000' COMMENT '上架价格',
  `publish_qty` int NOT NULL DEFAULT '1' COMMENT '上架数量',
  `remaining_qty` int NOT NULL DEFAULT '1' COMMENT '当前该上架批次剩余数量',
  `publish_status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：0=已下架，1=上架中，2=已售罄',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_publisher_id` (`publisher_id`),
  KEY `idx_publish_status` (`publish_status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_publish_asset` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_publish_user` FOREIGN KEY (`publisher_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产上架记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_publish_record`
--

LOCK TABLES `asset_publish_record` WRITE;
/*!40000 ALTER TABLE `asset_publish_record` DISABLE KEYS */;
INSERT INTO `asset_publish_record` VALUES (11,0,1,12800.000000,1,1,0,'2026-01-26 01:30:01','2026-03-24 01:30:01'),(12,1,2,18800.000000,1,1,0,'2026-01-28 01:30:01','2026-03-24 01:30:01'),(13,2,3,26800.000000,1,1,0,'2026-02-05 01:30:01','2026-03-23 01:30:01'),(14,3,4,8600.000000,1,1,0,'2026-02-10 01:30:01','2026-03-24 01:30:01'),(15,4,5,7600.000000,1,1,0,'2026-02-13 01:30:01','2026-03-22 01:30:01'),(16,5,1,30000.000000,1,1,1,'2026-02-16 01:30:01','2026-03-24 01:30:01'),(17,6,2,33800.000000,1,1,1,'2026-02-18 01:30:01','2026-03-23 01:30:01'),(18,7,3,15200.000000,12,6,1,'2026-02-20 01:30:01','2026-04-22 18:24:03'),(19,8,4,22500.000000,15,8,1,'2026-02-22 01:30:01','2026-04-22 18:32:37'),(20,9,5,28500.000000,6,1,2,'2026-02-24 01:30:01','2026-04-22 18:30:29'),(21,10,1,15500.000000,1,1,1,'2026-01-16 01:30:01','2026-03-24 01:30:01'),(22,11,2,16000.000000,1,1,1,'2026-01-18 01:30:01','2026-03-23 01:30:01'),(23,12,3,21000.000000,1,1,1,'2026-01-21 01:30:01','2026-03-24 01:30:01'),(24,13,4,13500.000000,1,0,2,'2026-01-23 01:30:01','2026-04-22 17:52:09'),(25,14,5,24200.000000,1,1,1,'2026-01-26 01:30:01','2026-03-23 01:30:01'),(26,15,1,31200.000000,1,1,1,'2026-01-28 01:30:01','2026-03-24 01:30:01'),(27,16,2,27500.000000,1,1,1,'2026-01-30 01:30:01','2026-03-24 01:30:01'),(28,17,3,32800.000000,1,1,1,'2026-02-01 01:30:01','2026-03-23 01:30:01'),(29,18,4,9500.000000,1,1,1,'2026-02-03 01:30:01','2026-03-24 01:30:01'),(30,19,5,7800.000000,1,1,1,'2026-02-05 01:30:01','2026-03-24 01:30:01'),(31,20,1,10200.000000,1,1,1,'2026-02-07 01:30:01','2026-03-24 01:30:01'),(32,21,2,23800.000000,13,8,1,'2026-02-09 01:30:01','2026-03-24 01:30:01'),(33,22,3,16600.000000,9,3,1,'2026-02-11 01:30:01','2026-04-23 10:37:45'),(34,23,4,31500.000000,6,4,1,'2026-02-13 01:30:01','2026-03-24 01:30:01'),(35,24,1,15000.000000,1,0,2,'2026-03-12 01:30:01','2026-04-22 17:44:13'),(36,25,2,20000.000000,1,0,2,'2026-03-13 01:30:01','2026-04-22 18:20:53'),(37,26,3,14000.000000,1,0,2,'2026-03-14 01:30:01','2026-04-22 18:11:43'),(38,27,4,13000.000000,1,0,2,'2026-03-15 01:30:01','2026-04-22 18:26:27'),(39,28,5,26200.000000,1,0,2,'2026-03-16 01:30:01','2026-04-22 17:56:03'),(40,29,1,30000.000000,1,1,0,'2026-03-17 01:30:01','2026-04-09 10:13:39'),(41,30,2,9000.000000,1,0,2,'2026-03-18 01:30:01','2026-04-22 18:08:23'),(42,31,3,8000.000000,1,0,2,'2026-03-19 01:30:01','2026-04-22 17:19:11'),(43,32,4,22000.000000,10,1,2,'2026-03-20 01:30:01','2026-04-22 17:16:05'),(44,33,5,32200.000000,5,1,2,'2026-03-21 01:30:01','2026-04-22 17:03:47'),(45,69,2,0.000000,1,1,0,'2026-03-25 16:52:30','2026-03-25 16:52:35'),(46,29,1,30000.000000,1,0,2,'2026-04-09 10:13:41','2026-04-22 17:25:20'),(47,70,3,1.000000,1,0,2,'2026-04-22 18:44:49','2026-04-22 18:45:46'),(48,71,3,1.000000,1,0,2,'2026-04-22 22:00:28','2026-04-22 22:01:42'),(49,72,3,0.000000,1,0,2,'2026-04-22 22:56:21','2026-04-22 22:56:27'),(50,73,1,0.000000,1,1,1,'2026-05-03 11:21:25','2026-05-03 11:21:25'),(51,74,1,980.000000,1,1,1,'2026-05-07 16:59:16','2026-05-07 16:59:16');
/*!40000 ALTER TABLE `asset_publish_record` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asset_sub_category`
--

DROP TABLE IF EXISTS `asset_sub_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_sub_category` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键',
  `sub_category_key` varchar(40) NOT NULL COMMENT '子类标识，如 raw_video',
  `sub_category_name` varchar(50) NOT NULL COMMENT '子类名称',
  `sub_category_desc` varchar(200) DEFAULT NULL COMMENT '子类简介',
  `category_id` int NOT NULL COMMENT '关联大类 ID',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序权重',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sub_category_key` (`sub_category_key`),
  KEY `idx_category_id` (`category_id`),
  CONSTRAINT `fk_sub_category_category` FOREIGN KEY (`category_id`) REFERENCES `asset_category` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产子类表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_sub_category`
--

LOCK TABLES `asset_sub_category` WRITE;
/*!40000 ALTER TABLE `asset_sub_category` DISABLE KEYS */;
INSERT INTO `asset_sub_category` VALUES (1,'raw_video','车端/路侧视频','脱敏后原始视频流',1,1,'2026-03-02 10:59:58'),(2,'raw_lidar','激光雷达点云','高稀缺高价值点云原始包',1,2,'2026-03-02 10:59:58'),(3,'raw_radar','毫米波/路侧雷达','雷达原始或融合感知数据',1,3,'2026-03-02 10:59:58'),(4,'raw_traj','车辆轨迹与控制指令','定位、轨迹、加速度等',1,4,'2026-03-02 10:59:58'),(5,'scene_pkg','场景数据包','时间+空间切片索引资产',2,1,'2026-03-02 11:00:01'),(6,'event_clip','事件数据资产','急刹/碰撞/险情片段',2,2,'2026-03-02 11:00:01'),(7,'rare_weather','稀缺天气场景','雨雪/夜间/逆光等场景',2,3,'2026-03-02 11:00:01'),(8,'game_scene','复杂博弈场景','高交互密度场景库',2,4,'2026-03-02 11:00:01'),(9,'traffic_metrics','交通指标数据集','速度/流量/占有率等统计',3,1,'2026-03-02 11:00:04'),(10,'signal_state','信号灯时序状态','路口信控周期数据',3,2,'2026-03-02 11:00:04'),(11,'lane_topo','车道拓扑道路几何','道路结构化要素',3,3,'2026-03-02 11:00:04'),(12,'junction_state','路口运行状态','排队/拥堵/通行效率',3,4,'2026-03-02 11:00:04'),(13,'labeled_pkg','标注训练数据包','OpenX/JSON 标准格式包',4,1,'2026-03-02 11:00:46'),(14,'semantic_ds','语义标注数据集','语义分割/检测标注结果',4,2,'2026-03-02 11:00:46'),(15,'map_update','高精地图增量','新增/修改/删除地图要素',4,3,'2026-03-02 11:00:46'),(16,'model_ver','模型版本资产','模型ID/性能摘要/授权策略',4,4,'2026-03-02 11:00:46'),(17,'auth_contract','授权合约资产','训练/仿真/商用权限合约',4,5,'2026-03-02 11:00:46');
/*!40000 ALTER TABLE `asset_sub_category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asset_upload_file`
--

DROP TABLE IF EXISTS `asset_upload_file`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_upload_file` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `asset_id` bigint DEFAULT NULL,
  `user_id` bigint unsigned NOT NULL,
  `upload_token` varchar(80) NOT NULL,
  `file_role` enum('source','picture') NOT NULL,
  `original_name` varchar(255) NOT NULL DEFAULT '',
  `stored_name` varchar(255) NOT NULL DEFAULT '',
  `stored_path` varchar(500) NOT NULL,
  `file_hash` varchar(128) NOT NULL DEFAULT '',
  `hash_algorithm` varchar(30) NOT NULL DEFAULT 'SHA2_256',
  `mime_type` varchar(120) NOT NULL DEFAULT '',
  `file_size` bigint unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_upload_token` (`upload_token`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_user_role` (`user_id`,`file_role`),
  CONSTRAINT `fk_upload_asset_id` FOREIGN KEY (`asset_id`) REFERENCES `digital_asset` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_upload_file`
--

LOCK TABLES `asset_upload_file` WRITE;
/*!40000 ALTER TABLE `asset_upload_file` DISABLE KEYS */;
INSERT INTO `asset_upload_file` VALUES (1,60,1,'1774117186842_l0n17xzdqk','picture','wechat_2026-03-21_211846_630.png','efadc3e508d52a929d965793d0f9e7b8','public/upload/efadc3e508d52a929d965793d0f9e7b8','','SHA2_256','image/png',44109,'2026-03-22 02:19:46'),(2,61,1,'1774117577890_b4y2f8gkx9','picture','wechat_2026-03-21_211846_630.png','f118a14d9cca84fe56204370ffaec7af','public/upload/f118a14d9cca84fe56204370ffaec7af','','SHA2_256','image/png',44109,'2026-03-22 02:26:17'),(3,62,1,'1774117788139_go3bwxrzk8','picture','wechat_2026-03-21_211846_630.png','bd6c38a226605016398206c86a5e4c02','public/upload/bd6c38a226605016398206c86a5e4c02','','SHA2_256','image/png',44109,'2026-03-22 02:29:48'),(4,63,1,'1774117810892_4qevpt1pxy','picture','wechat_2026-03-21_211846_630.png','95f461f4276c8eb9956b3e3d4ad96c57','public/upload/95f461f4276c8eb9956b3e3d4ad96c57','','SHA2_256','image/png',44109,'2026-03-22 02:30:10'),(5,64,1,'1774147937995_ewyap4y46h','picture','loginBG.jpg','86752ccdf1f7189e180558ac6bffa3c6','public/upload/86752ccdf1f7189e180558ac6bffa3c6','','SHA2_256','image/jpeg',521589,'2026-03-22 10:52:17'),(6,65,1,'1774167721724_jmpxx1n4jc','picture','loginBG.jpg','14ebe4503fabc244616effec03cefb49','public/upload/14ebe4503fabc244616effec03cefb49','','SHA2_256','image/jpeg',521589,'2026-03-22 16:22:01'),(7,66,1,'1774168038272_8aquj7d2cp','picture','loginBG.jpg','c97f65e8cf8abb962dcb5c99c9ec13ab','public/upload/c97f65e8cf8abb962dcb5c99c9ec13ab','','SHA2_256','image/jpeg',521589,'2026-03-22 16:27:18'),(8,67,1,'1774168160102_xg6hovmshm','picture','loginBG.jpg','32fde2f73fdf8a1e73760a3ce63de74b','public/upload/32fde2f73fdf8a1e73760a3ce63de74b','','SHA2_256','image/jpeg',521589,'2026-03-22 16:29:20'),(9,68,1,'1774168283537_8meje9ucp3','picture','loginBG.jpg','c45963d879407110d843180439ae62d7','public/upload/c45963d879407110d843180439ae62d7','','SHA2_256','image/jpeg',521589,'2026-03-22 16:31:23');
/*!40000 ALTER TABLE `asset_upload_file` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_records`
--

DROP TABLE IF EXISTS `delivery_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_records` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `transaction_id` varchar(64) NOT NULL COMMENT '关联交易ID',
  `order_no` varchar(40) DEFAULT NULL COMMENT '关联订单号',
  `delivery_index` int NOT NULL DEFAULT '1' COMMENT '交付序号',
  `delivery_type` varchar(32) NOT NULL DEFAULT 'STANDARD' COMMENT '交付方式',
  `buyer_address` varchar(128) NOT NULL DEFAULT '' COMMENT '买家链上地址',
  `seller_address` varchar(128) NOT NULL DEFAULT '' COMMENT '卖家链上地址',
  `delivery_message` varchar(500) DEFAULT NULL COMMENT '交付说明',
  `result_status` varchar(32) NOT NULL DEFAULT 'DELIVERED' COMMENT '交付结果状态',
  `record_payload` json DEFAULT NULL COMMENT '补充记录',
  `delivered_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '交付时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_delivery_record_tx_index` (`transaction_id`,`delivery_index`),
  KEY `idx_delivery_record_order_no` (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='交付记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_records`
--

LOCK TABLES `delivery_records` WRITE;
/*!40000 ALTER TABLE `delivery_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_requests`
--

DROP TABLE IF EXISTS `delivery_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `transaction_id` varchar(64) NOT NULL COMMENT '关联交易ID',
  `order_no` varchar(40) DEFAULT NULL COMMENT '关联订单号',
  `buyer_address` varchar(128) NOT NULL DEFAULT '' COMMENT '买家链上地址',
  `seller_address` varchar(128) NOT NULL DEFAULT '' COMMENT '卖家链上地址',
  `request_type` varchar(32) NOT NULL DEFAULT 'STANDARD' COMMENT '交付方式',
  `vm_name` varchar(100) DEFAULT NULL COMMENT '虚拟机名称',
  `vm_cpu` int DEFAULT NULL COMMENT '虚拟机CPU',
  `vm_memory_mb` int DEFAULT NULL COMMENT '虚拟机内存MB',
  `note` varchar(500) DEFAULT NULL COMMENT '备注',
  `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '申请状态',
  `requested_by` bigint DEFAULT NULL COMMENT '申请人ID',
  `approved_by` bigint DEFAULT NULL COMMENT '审批人ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_delivery_request_transaction_id` (`transaction_id`),
  KEY `idx_delivery_request_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='交付申请表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_requests`
--

LOCK TABLES `delivery_requests` WRITE;
/*!40000 ALTER TABLE `delivery_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `digital_asset`
--

DROP TABLE IF EXISTS `digital_asset`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `digital_asset` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `asset_name` varchar(100) NOT NULL DEFAULT '' COMMENT '资产名称',
  `brief` varchar(300) NOT NULL DEFAULT '' COMMENT '卡片摘要（短文本，用于列表展示）',
  `description` text NOT NULL COMMENT '详细描述',
  `security_level` tinyint NOT NULL DEFAULT '1' COMMENT '安全等级：1/2/3',
  `assetgrade` varchar(20) NOT NULL DEFAULT '一般数据' COMMENT '数据来源评级：一般数据/重要数据/核心数据',
  `category_id` int NOT NULL DEFAULT '0' COMMENT '关联大类 ID',
  `category_key` varchar(30) NOT NULL DEFAULT '' COMMENT '大类标识（冗余）',
  `sub_category_id` int NOT NULL DEFAULT '0' COMMENT '关联子类 ID',
  `sub_category_key` varchar(40) NOT NULL DEFAULT '' COMMENT '子类标识（冗余）',
  `region_id` int NOT NULL DEFAULT '0' COMMENT '关联地区 ID',
  `region_key` varchar(20) NOT NULL DEFAULT '' COMMENT '地区标识（冗余）',
  `file_hash` varchar(128) NOT NULL DEFAULT '' COMMENT '文件哈希值（内容唯一性校验）',
  `hash_algorithm` varchar(30) NOT NULL DEFAULT 'SHA2_256' COMMENT '哈希算法：SHA2_256/SHA3_256/其他',
  `cover_image_url` varchar(500) NOT NULL DEFAULT '' COMMENT '预览图可访问 URL',
  `file_size` bigint NOT NULL DEFAULT '0' COMMENT '文件大小（字节）',
  `file_format` varchar(30) NOT NULL DEFAULT '' COMMENT '文件格式，如 mp4、pcd、json',
  `price` decimal(18,6) NOT NULL DEFAULT '0.000000' COMMENT '资产价格',
  `price_unit` varchar(10) NOT NULL DEFAULT 'ETH' COMMENT '价格单位',
  `total_qty` int NOT NULL DEFAULT '1' COMMENT '资产总数量',
  `available_qty` int NOT NULL DEFAULT '1' COMMENT '未上架的剩余库存',
  `is_divisible` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否可分割：0=否，1=是',
  `can_sell_ownership` tinyint(1) NOT NULL DEFAULT '0' COMMENT '允许出售所有权：0=否，1=是',
  `can_sell_view_right` tinyint(1) NOT NULL DEFAULT '0' COMMENT '允许出售查阅权：0=否，1=是',
  `can_sell_process_right` tinyint(1) NOT NULL DEFAULT '0' COMMENT '允许出售加工权：0=否，1=是',
  `allow_resale` tinyint NOT NULL DEFAULT '0' COMMENT '二次交易：0=不允许，1=需审批，2=直接允许',
  `is_proxied` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否允许授权给他人：0=否，1=是',
  `is_third_party` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否允许第三方监管：0=否，1=是',
  `trade_region` varchar(100) NOT NULL DEFAULT '' COMMENT '允许交易地点（省-市-区）',
  `trade_valid_start` datetime DEFAULT NULL COMMENT '允许交易开始时间（日期+时间）',
  `trade_valid_end` datetime DEFAULT NULL COMMENT '允许交易截止时间（日期+时间）',
  `collect_time_start` datetime DEFAULT NULL COMMENT '数据采集开始时间',
  `collect_time_end` datetime DEFAULT NULL COMMENT '数据采集结束时间',
  `collect_location` varchar(200) NOT NULL DEFAULT '' COMMENT '采集地点描述',
  `sensor_type` varchar(100) NOT NULL DEFAULT '' COMMENT '传感器类型，如 激光雷达+摄像头',
  `data_volume` varchar(50) NOT NULL DEFAULT '' COMMENT '数据规模描述，如 2TB / 10万帧',
  `user_id` bigint NOT NULL DEFAULT '0' COMMENT '登记用户 ID',
  `certificate_name` varchar(100) NOT NULL DEFAULT '' COMMENT '使用的证书名称',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：0=下架，1=上架中，2=已售罄',
  `view_count` int NOT NULL DEFAULT '0' COMMENT '浏览次数',
  `trade_count` int NOT NULL DEFAULT '0' COMMENT '成交次数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_file_hash` (`file_hash`),
  KEY `idx_category_key` (`category_key`),
  KEY `idx_sub_category_key` (`sub_category_key`),
  KEY `idx_region_key` (`region_key`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `fk_asset_category` (`category_id`),
  KEY `fk_asset_sub_category` (`sub_category_id`),
  KEY `fk_asset_region` (`region_id`),
  CONSTRAINT `fk_asset_category` FOREIGN KEY (`category_id`) REFERENCES `asset_category` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_asset_region` FOREIGN KEY (`region_id`) REFERENCES `region` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_asset_sub_category` FOREIGN KEY (`sub_category_id`) REFERENCES `asset_sub_category` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='自动驾驶数字资产主表（基础信息）';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `digital_asset`
--

LOCK TABLES `digital_asset` WRITE;
/*!40000 ALTER TABLE `digital_asset` DISABLE KEYS */;
INSERT INTO `digital_asset` VALUES (0,'北京早高峰多路口视频包','国贸片区脱敏视频','用于目标检测与轨迹预测训练。',2,'一般数据',1,'raw',1,'raw_video',1,'bj','demo_hash_000','SHA2_256','/asset-cover/1.png',2147483648,'mp4',12800.000000,'人民币',1,1,0,1,1,0,1,0,0,'北京市朝阳区','2026-01-24 01:26:50','2026-09-21 01:26:50','2026-01-19 01:26:50','2026-01-24 01:26:50','北京国贸','摄像头+RSU','2.0TB',1,'wx-org1-user-1',0,66,3,'2026-01-26 01:26:50','2026-03-24 01:26:50'),(1,'上海夜间点云稀缺包','临港夜间点云','低照度复杂场景点云。',3,'一般数据',1,'raw',2,'raw_lidar',2,'sh','demo_hash_001','SHA2_256','/asset-cover/1.png',3221225472,'pcd',18800.000000,'人民币',1,1,0,1,1,1,1,0,0,'上海市浦东新区','2026-01-26 01:26:50','2026-09-21 01:26:50','2026-01-22 01:26:50','2026-01-26 01:26:50','上海临港','激光雷达','3.0TB',2,'wx-org1-user-2',0,88,5,'2026-01-28 01:26:50','2026-03-24 01:26:50'),(2,'广州暴雨场景数据包','暴雨低可见度场景','极端天气鲁棒性数据。',3,'一般数据',2,'scene',7,'rare_weather',3,'gz','demo_hash_002','SHA2_256','/asset-cover/2.png',1610612736,'zip',26800.000000,'人民币',1,1,0,1,1,1,2,1,0,'广州市天河区','2026-02-03 01:26:50','2026-08-22 01:26:50','2026-01-30 01:26:50','2026-02-03 01:26:50','广州天河','摄像头+毫米波雷达','1.5TB',3,'wx-org1-user-3',0,72,2,'2026-02-05 01:26:50','2026-03-23 01:26:50'),(3,'深圳交通指标月度集','速度流量占有率','结构化交通统计指标。',2,'一般数据',3,'struct',9,'traffic_metrics',4,'sz','demo_hash_003','SHA2_256','/asset-cover/3.png',536870912,'csv',8600.000000,'人民币',1,1,0,1,1,0,1,0,0,'深圳市南山区','2026-02-08 01:26:50','2026-07-23 01:26:50','2026-02-05 01:26:50','2026-02-08 01:26:50','深圳南山','路侧统计设备','0.5TB',4,'wx-org1-user-4',0,54,4,'2026-02-10 01:26:50','2026-03-24 01:26:50'),(4,'北京信号灯时序周包','路口信控周期状态','可用于配时优化和仿真。',2,'一般数据',3,'struct',10,'signal_state',1,'bj','demo_hash_004','SHA2_256','/asset-cover/3.png',402653184,'json',7600.000000,'人民币',1,1,0,1,1,0,1,0,0,'北京市海淀区','2026-02-11 01:26:50','2026-07-23 01:26:50','2026-02-09 01:26:50','2026-02-11 01:26:50','北京海淀','信号机接口','0.38TB',5,'wx-org1-user-5',0,49,1,'2026-02-13 01:26:50','2026-03-22 01:26:50'),(5,'北京可交易场景包A','复杂交互场景切片','含事件索引，可直接交易。',2,'一般数据',2,'scene',5,'scene_pkg',1,'bj','demo_hash_005','SHA2_256','/asset-cover/2.png',1073741824,'zip',30000.000000,'人民币',1,0,0,1,1,0,2,1,0,'北京市朝阳区','2026-02-15 01:26:50','2026-07-23 01:26:50','2026-02-13 01:26:50','2026-02-15 01:26:50','北京CBD','摄像头+RSU','1.0TB',1,'wx-org1-user-1',1,181,12,'2026-02-16 01:26:50','2026-05-03 11:19:32'),(6,'上海复杂博弈场景包B','高交互密度场景','策略训练高价值样本。',3,'一般数据',2,'scene',8,'game_scene',2,'sh','demo_hash_006','SHA2_256','/asset-cover/2.png',1288490188,'zip',34000.000000,'人民币',1,0,0,1,1,0,2,1,0,'上海浦东新区','2026-02-17 01:26:50','2026-07-23 01:26:50','2026-02-15 01:26:50','2026-02-17 01:26:50','上海临港','摄像头+雷达','1.2TB',2,'wx-org1-user-2',1,141,8,'2026-02-18 01:26:50','2026-05-03 11:19:49'),(7,'广州高精地图增量Q1','地图变更要素包','新增/修改/删除地图要素。',2,'一般数据',4,'derived',15,'map_update',3,'gz','demo_hash_007','SHA2_256','/asset-cover/4.png',805306368,'bin',15000.000000,'人民币',20,8,1,1,1,1,2,1,0,'广州市黄埔区','2026-02-19 01:26:50','2026-08-22 01:26:50','2026-02-17 01:26:50','2026-02-19 01:26:50','广州开发区','测绘设备','0.75TB',3,'wx-org1-user-3',1,212,18,'2026-02-20 01:26:50','2026-04-22 18:23:59'),(8,'深圳语义标注数据V3','语义分割+检测标注','城市道路模型训练集。',2,'一般数据',4,'derived',14,'semantic_ds',4,'sz','demo_hash_008','SHA2_256','/asset-cover/4.png',1503238553,'tar',22000.000000,'人民币',30,15,1,1,1,1,2,1,0,'深圳市福田区','2026-02-21 01:26:50','2026-09-21 01:26:50','2026-02-19 01:26:50','2026-02-21 01:26:50','深圳福田','摄像头','1.4TB',4,'wx-org1-user-4',1,253,22,'2026-02-22 01:26:50','2026-05-03 11:20:15'),(9,'深圳模型版本资产AVM-2.1','模型版本+性能摘要','包含评测报告与授权策略。',2,'一般数据',4,'derived',16,'model_ver',4,'sz','demo_hash_009','SHA2_256','/asset-cover/4.png',314572800,'onnx',28000.000000,'人民币',8,2,1,1,1,1,2,1,0,'深圳市南山区','2026-02-23 01:26:50','2026-09-01 01:26:50','2026-02-21 01:26:50','2026-02-23 01:26:50','深圳南山','模型产线','0.29TB',5,'wx-org1-user-5',1,171,14,'2026-02-24 01:26:50','2026-04-22 18:30:26'),(10,'北京环路全天视频集','二三环全天流量视频','覆盖全天交通状态变化。',2,'一般数据',1,'raw',1,'raw_video',1,'bj','demo_hash_110','SHA2_256','/asset-cover/1.png',2147483648,'mp4',15500.000000,'人民币',1,1,0,1,1,0,1,0,0,'北京市丰台区','2026-01-14 01:26:50','2026-09-21 01:26:50','2026-01-09 01:26:50','2026-01-14 01:26:50','北京三环','摄像头','2TB',1,'wx-org1-user-1',1,102,7,'2026-01-16 01:26:50','2026-04-23 10:37:17'),(11,'上海隧道视频采集','隧道进出口视频','低光环境目标识别。',2,'一般数据',1,'raw',1,'raw_video',2,'sh','demo_hash_111','SHA2_256','/asset-cover/1.png',2147483648,'mp4',16200.000000,'人民币',1,1,0,1,1,0,1,0,0,'上海市黄浦区','2026-01-16 01:26:50','2026-09-21 01:26:50','2026-01-12 01:26:50','2026-01-16 01:26:50','上海隧道口','摄像头','2TB',2,'wx-org1-user-2',1,89,6,'2026-01-18 01:26:50','2026-03-23 01:26:50'),(12,'广州桥梁点云数据','桥梁结构点云','用于结构识别训练。',3,'一般数据',1,'raw',2,'raw_lidar',3,'gz','demo_hash_112','SHA2_256','/asset-cover/1.png',3221225472,'pcd',21000.000000,'人民币',1,1,0,1,1,1,1,0,0,'广州市番禺区','2026-01-19 01:26:50','2026-09-21 01:26:50','2026-01-15 01:26:50','2026-01-19 01:26:50','广州番禺桥','激光雷达','3TB',3,'wx-org1-user-3',1,73,5,'2026-01-21 01:26:50','2026-03-24 01:26:50'),(13,'深圳高速轨迹样本','高速行驶轨迹','车辆动态行为数据。',2,'一般数据',1,'raw',4,'raw_traj',4,'sz','demo_hash_113','SHA2_256','/asset-cover/1.png',1073741824,'csv',13500.000000,'人民币',1,1,0,1,1,0,1,0,0,'深圳市龙华区','2026-01-21 01:26:50','2026-08-22 01:26:50','2026-01-17 01:26:50','2026-01-21 01:26:50','深圳高速','GPS+IMU','1TB',4,'wx-org1-user-4',1,64,4,'2026-01-23 01:26:50','2026-03-24 01:26:50'),(14,'北京拥堵事件切片','拥堵与排队场景','交通瓶颈分析数据。',3,'一般数据',2,'scene',6,'event_clip',1,'bj','demo_hash_114','SHA2_256','/asset-cover/2.png',805306368,'zip',24000.000000,'人民币',1,0,0,1,1,1,2,1,0,'北京市西城区','2026-01-24 01:26:50','2026-08-22 01:26:50','2026-01-20 01:26:50','2026-01-24 01:26:50','北京西城','摄像头','0.75TB',5,'wx-org1-user-5',1,110,8,'2026-01-26 01:26:50','2026-03-23 01:26:50'),(15,'上海晚高峰场景包','高峰拥堵场景','复杂交互样本。',3,'一般数据',2,'scene',5,'scene_pkg',2,'sh','demo_hash_115','SHA2_256','/asset-cover/2.png',1073741824,'zip',31000.000000,'人民币',1,0,0,1,1,0,2,1,0,'上海市静安区','2026-01-26 01:26:50','2026-07-23 01:26:50','2026-01-22 01:26:50','2026-01-26 01:26:50','上海静安','摄像头','1TB',1,'wx-org1-user-1',1,150,12,'2026-01-28 01:26:50','2026-03-24 01:26:50'),(16,'广州暴雨夜间合集','夜间+暴雨场景','极端天气训练集。',3,'一般数据',2,'scene',7,'rare_weather',3,'gz','demo_hash_116','SHA2_256','/asset-cover/2.png',1610612736,'zip',27500.000000,'人民币',1,0,0,1,1,1,2,1,0,'广州市荔湾区','2026-01-28 01:26:50','2026-08-22 01:26:50','2026-01-24 01:26:50','2026-01-28 01:26:50','广州荔湾','摄像头','1.5TB',2,'wx-org1-user-2',1,134,9,'2026-01-30 01:26:50','2026-03-24 01:26:50'),(17,'深圳交互冲突场景','多车博弈数据','决策训练数据。',3,'一般数据',2,'scene',8,'game_scene',4,'sz','demo_hash_117','SHA2_256','/asset-cover/2.png',1288490188,'zip',33000.000000,'人民币',1,0,0,1,1,0,2,1,0,'深圳市宝安区','2026-01-30 01:26:50','2026-07-23 01:26:50','2026-01-26 01:26:50','2026-01-30 01:26:50','深圳宝安','摄像头','1.2TB',3,'wx-org1-user-3',1,142,10,'2026-02-01 01:26:50','2026-03-23 01:26:50'),(18,'北京交通流量月度集','整月统计数据','宏观交通分析数据。',2,'一般数据',3,'struct',9,'traffic_metrics',1,'bj','demo_hash_118','SHA2_256','/asset-cover/3.png',536870912,'csv',9500.000000,'人民币',1,1,0,1,1,0,1,0,0,'北京市通州区','2026-02-01 01:26:50','2026-07-23 01:26:50','2026-01-28 01:26:50','2026-02-01 01:26:50','北京通州','统计设备','0.5TB',4,'wx-org1-user-4',1,67,3,'2026-02-03 01:26:50','2026-05-03 11:20:22'),(19,'上海信号灯优化数据','周期与相位数据','信控优化输入数据。',2,'一般数据',3,'struct',10,'signal_state',2,'sh','demo_hash_119','SHA2_256','/asset-cover/3.png',402653184,'json',7800.000000,'人民币',1,1,0,1,1,0,1,0,0,'上海市杨浦区','2026-02-03 01:26:50','2026-07-23 01:26:50','2026-01-30 01:26:50','2026-02-03 01:26:50','上海杨浦','信号机','0.38TB',5,'wx-org1-user-5',1,59,2,'2026-02-05 01:26:50','2026-03-24 01:26:50'),(20,'广州车道拓扑数据','道路结构信息','高精结构数据。',2,'一般数据',3,'struct',11,'lane_topo',3,'gz','demo_hash_120','SHA2_256','/asset-cover/3.png',805306368,'json',10200.000000,'人民币',1,1,0,1,1,0,1,0,0,'广州市白云区','2026-02-05 01:26:50','2026-07-23 01:26:50','2026-02-01 01:26:50','2026-02-05 01:26:50','广州白云','测绘设备','0.75TB',1,'wx-org1-user-1',1,61,4,'2026-02-07 01:26:50','2026-03-24 01:26:50'),(21,'深圳语义训练增强集','增强标注数据','提升模型泛化能力。',2,'一般数据',4,'derived',14,'semantic_ds',4,'sz','demo_hash_121','SHA2_256','/asset-cover/4.png',1503238553,'tar',23500.000000,'人民币',25,12,1,1,1,1,2,1,0,'深圳市龙岗区','2026-02-07 01:26:50','2026-09-21 01:26:50','2026-02-03 01:26:50','2026-02-07 01:26:50','深圳龙岗','摄像头','1.4TB',2,'wx-org1-user-2',1,215,17,'2026-02-09 01:26:50','2026-03-24 01:26:50'),(22,'北京地图增量包Q3','地图变化数据','地图版本更新。',2,'一般数据',4,'derived',15,'map_update',1,'bj','demo_hash_122','SHA2_256','/asset-cover/4.png',805306368,'bin',16500.000000,'人民币',18,9,1,1,1,1,2,1,0,'北京市顺义区','2026-02-09 01:26:50','2026-08-22 01:26:50','2026-02-05 01:26:50','2026-02-09 01:26:50','北京顺义','测绘车','0.75TB',3,'wx-org1-user-3',1,200,14,'2026-02-11 01:26:50','2026-04-23 10:37:42'),(23,'上海自动驾驶模型AVM-3.2','模型版本升级','含评测报告。',2,'一般数据',4,'derived',16,'model_ver',2,'sh','demo_hash_123','SHA2_256','/asset-cover/4.png',314572800,'onnx',31000.000000,'人民币',10,4,1,1,1,1,2,1,0,'上海市浦东新区','2026-02-11 01:26:50','2026-09-01 01:26:50','2026-02-07 01:26:50','2026-02-11 01:26:50','上海张江','模型产线','0.29TB',4,'wx-org1-user-4',1,245,19,'2026-02-13 01:26:50','2026-03-24 01:26:50'),(24,'北京城区多路口视频集','复杂城区视频','用于检测与跟踪训练。',2,'一般数据',1,'raw',1,'raw_video',1,'bj','demo_hash_024','SHA2_256','/asset-cover/1.png',2147483648,'mp4',15000.000000,'人民币',1,1,0,1,1,0,1,0,0,'北京市朝阳区','2026-03-11 01:26:50','2026-09-21 01:26:50','2026-03-07 01:26:50','2026-03-11 01:26:50','北京朝阳','摄像头','2TB',1,'wx-org1-user-1',1,121,10,'2026-03-12 01:26:50','2026-04-22 17:44:11'),(25,'上海高密度车流点云','拥堵路段点云','复杂车流建模数据。',3,'一般数据',1,'raw',2,'raw_lidar',2,'sh','demo_hash_025','SHA2_256','/asset-cover/1.png',3221225472,'pcd',20000.000000,'人民币',1,1,0,1,1,1,1,0,0,'上海市浦东新区','2026-03-12 01:26:50','2026-09-21 01:26:50','2026-03-08 01:26:50','2026-03-12 01:26:50','上海浦东','激光雷达','3TB',2,'wx-org1-user-2',1,95,6,'2026-03-13 01:26:50','2026-03-24 01:26:50'),(26,'广州雨天路口视频','雨天低能见度','鲁棒性训练数据。',2,'一般数据',1,'raw',1,'raw_video',3,'gz','demo_hash_026','SHA2_256','/asset-cover/1.png',2147483648,'mp4',14000.000000,'人民币',1,1,0,1,1,0,1,0,0,'广州市天河区','2026-03-13 01:26:50','2026-08-22 01:26:50','2026-03-09 01:26:50','2026-03-13 01:26:50','广州天河','摄像头','2TB',3,'wx-org1-user-3',1,88,5,'2026-03-14 01:26:50','2026-03-24 01:26:50'),(27,'深圳自动驾驶轨迹集','车辆行为轨迹','行为预测训练数据。',2,'一般数据',1,'raw',4,'raw_traj',4,'sz','demo_hash_027','SHA2_256','/asset-cover/1.png',1073741824,'csv',13000.000000,'人民币',1,1,0,1,1,0,1,0,0,'深圳市南山区','2026-03-14 01:26:50','2026-08-22 01:26:50','2026-03-10 01:26:50','2026-03-14 01:26:50','深圳南山','GPS+IMU','1TB',4,'wx-org1-user-4',1,77,4,'2026-03-15 01:26:50','2026-04-22 18:26:25'),(28,'北京极端天气事件集','暴雨+雪天场景','极端天气数据。',3,'一般数据',2,'scene',7,'rare_weather',1,'bj','demo_hash_028','SHA2_256','/asset-cover/2.png',1610612736,'zip',26000.000000,'人民币',1,0,0,1,1,1,2,1,0,'北京市海淀区','2026-03-15 01:26:50','2026-08-22 01:26:50','2026-03-11 01:26:50','2026-03-15 01:26:50','北京海淀','摄像头','1.5TB',5,'wx-org1-user-5',1,133,9,'2026-03-16 01:26:50','2026-04-22 17:56:00'),(29,'上海复杂交互场景','高密度交互','博弈决策训练。',3,'一般数据',2,'scene',8,'game_scene',2,'sh','demo_hash_029','SHA2_256','/asset-cover/2.png',1288490188,'zip',30000.000000,'人民币',1,0,0,1,1,0,2,1,0,'上海市闵行区','2026-03-16 01:26:50','2026-07-23 01:26:50','2026-03-12 01:26:50','2026-03-16 01:26:50','上海闵行','摄像头','1.2TB',1,'wx-org1-user-1',1,140,11,'2026-03-17 01:26:50','2026-04-09 10:13:41'),(30,'广州交通指标周报','流量与速度','结构化统计数据。',2,'一般数据',3,'struct',9,'traffic_metrics',3,'gz','demo_hash_030','SHA2_256','/asset-cover/3.png',536870912,'csv',9000.000000,'人民币',1,1,0,1,1,0,1,0,0,'广州市越秀区','2026-03-17 01:26:50','2026-07-23 01:26:50','2026-03-13 01:26:50','2026-03-17 01:26:50','广州越秀','统计设备','0.5TB',2,'wx-org1-user-2',1,62,3,'2026-03-18 01:26:50','2026-04-22 18:08:21'),(31,'深圳信号灯周期数据','信控周期','信号优化数据。',2,'一般数据',3,'struct',10,'signal_state',4,'sz','demo_hash_031','SHA2_256','/asset-cover/3.png',402653184,'json',8000.000000,'人民币',1,1,0,1,1,0,1,0,0,'深圳市福田区','2026-03-18 01:26:50','2026-07-23 01:26:50','2026-03-14 01:26:50','2026-03-18 01:26:50','深圳福田','信号机','0.38TB',3,'wx-org1-user-3',1,57,2,'2026-03-19 01:26:50','2026-04-22 18:07:11'),(32,'北京语义标注数据集','语义分割数据','模型训练数据。',2,'一般数据',4,'derived',14,'semantic_ds',1,'bj','demo_hash_032','SHA2_256','/asset-cover/4.png',1503238553,'tar',22000.000000,'人民币',20,10,1,1,1,1,2,1,0,'北京市海淀区','2026-03-19 01:26:50','2026-09-21 01:26:50','2026-03-15 01:26:50','2026-03-19 01:26:50','北京中关村','摄像头','1.4TB',4,'wx-org1-user-4',1,213,14,'2026-03-20 01:26:50','2026-04-22 17:16:23'),(33,'上海模型版本AVM-3.1','模型+评测报告','最新模型资产。',2,'一般数据',4,'derived',16,'model_ver',2,'sh','demo_hash_033','SHA2_256','/asset-cover/4.png',314572800,'onnx',32000.000000,'人民币',8,3,1,1,1,1,2,1,0,'上海市浦东新区','2026-03-20 01:26:50','2026-09-01 01:26:50','2026-03-16 01:26:50','2026-03-20 01:26:50','上海张江','模型产线','0.29TB',5,'wx-org1-user-5',1,267,18,'2026-03-21 01:26:50','2026-04-22 17:03:45'),(51,'资产1','资产1的资产摘要','资产1的详细描述',1,'一般数据',1,'raw',1,'raw_video',1,'bj','12323','SHA2_256','',3,'1232',0.000000,'ETH',1,0,0,0,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'123232',1,1,0,'2026-03-20 01:38:37','2026-03-21 00:40:07'),(52,'资产2','','asdf2345详细描述',1,'一般数据',2,'scene',7,'rare_weather',2,'sh','123223','SHA2_256','',0,'zip',0.000000,'ETH',1,1,0,1,1,1,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,0,0,'2026-03-21 20:32:25','2026-03-21 20:32:25'),(53,'111','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','1111','SHA2_256','',0,'',0.000000,'ETH',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,0,0,'2026-03-21 20:33:22','2026-03-21 20:33:22'),(54,'测试一下我的资产','','123',1,'一般数据',1,'raw',1,'raw_video',1,'bj','123','SHA2_256','',0,'1232',0.000000,'ETH',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,0,0,'2026-03-21 20:59:25','2026-03-21 20:59:25'),(55,'12323','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','232312321312','SHA2_256','',0,'',0.000000,'ETH',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',0,0,0,'2026-03-21 21:10:39','2026-03-22 02:26:05'),(56,'123','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','12323242345','SHA2_256','',0,'',0.000000,'ETH',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',0,0,0,'2026-03-21 21:10:54','2026-03-22 02:26:03'),(57,'1232','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','123232','SHA2_256','',0,'',0.000000,'ETH',1,0,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,1,0,'2026-03-21 21:53:15','2026-03-24 20:44:46'),(58,'122232323','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','12323232','SHA2_256','',0,'',0.000000,'ETH',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,0,0,'2026-03-21 22:33:10','2026-03-21 22:33:10'),(59,'2323232','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','323232','SHA2_256','',0,'',0.000000,'ETH',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,0,0,'2026-03-21 23:01:42','2026-03-21 23:01:42'),(60,'11111111','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37','SHA2_256','/efadc3e508d52a929d965793d0f9e7b8',44109,'png',0.000000,'ETH',1,0,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,4,0,'2026-03-22 02:19:52','2026-03-22 02:34:02'),(61,'1111111','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448','SHA2_256','/f118a14d9cca84fe56204370ffaec7af',13580,'docx',0.000000,'ETH',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',0,0,0,'2026-03-22 02:26:46','2026-03-22 02:26:46'),(62,'111111','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7','SHA2_256','/bd6c38a226605016398206c86a5e4c02',135,'js',0.000000,'ETH',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',0,0,0,'2026-03-22 02:29:50','2026-03-22 02:29:50'),(63,'22222222','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c','SHA2_256','/95f461f4276c8eb9956b3e3d4ad96c57',7979,'py',2.000000,'ETH',1,0,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,0,0,'2026-03-22 02:30:31','2026-03-22 02:35:41'),(64,'12323223','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','22dcf3f2d5c70aef4df9ba189552b5194083e2908632e9e0d4d7c4e0199adf45','SHA2_256','/86752ccdf1f7189e180558ac6bffa3c6',521589,'jpg',0.000000,'人民币',1,0,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,1,0,'2026-03-22 10:52:26','2026-03-24 20:44:43'),(65,'自动驾驶资产 1','','',1,'一般数据',1,'raw',1,'raw_video',3,'gz','b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c','SHA2_256','/14ebe4503fabc244616effec03cefb49',1510,'svg',0.000000,'人民币',1,1,0,1,1,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',0,0,0,'2026-03-22 16:22:19','2026-03-22 16:22:19'),(66,'自动驾驶数字资产','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3','SHA2_256','/c97f65e8cf8abb962dcb5c99c9ec13ab',43058,'ani',0.000000,'人民币',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',0,0,0,'2026-03-22 16:27:36','2026-03-22 16:27:36'),(67,'自动驾驶','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12','SHA2_256','/32fde2f73fdf8a1e73760a3ce63de74b',75675369,'zip',0.000000,'人民币',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',0,0,0,'2026-03-22 16:29:40','2026-03-22 16:29:40'),(68,'自动驾驶','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','3c85efe147e02944e9ed09ceabea6ebdbab04a41dcb13bc36fb23209d3e15857','SHA2_256','/c45963d879407110d843180439ae62d7',695,'py',0.000000,'人民币',1,0,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,3,0,'2026-03-22 16:31:40','2026-04-24 16:42:17'),(69,'车端资产','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','e3e5e07d474ec002dfd64d810481e8e17cff5903b192a1641f7036a3e0f33a96','SHA2_256','/asset-cover/1.png',404,'html',0.000000,'人民币',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',2,'wx-org1-user-2-default',0,0,0,'2026-03-25 16:52:25','2026-03-25 16:52:35'),(70,'自动驾驶数字资产测试1','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','f19e4f645f53a40265802264368622e124161563c65384caf31d1b378700ff76','SHA2_256','/asset-cover/1.png',4095836,'docx',0.000000,'人民币',1,0,0,1,1,1,0,0,0,'',NULL,NULL,NULL,NULL,'','','',3,'wx-org1-user-3-default',1,1,0,'2026-04-22 18:44:46','2026-04-22 18:44:56'),(71,'自动驾驶数字资产测试2','','',1,'一般数据',1,'raw',3,'raw_radar',1,'bj','3b92c90701ddfdf006da9341bdb1a07f7fa07db22e92e863cd08ce1bae2e0a6b','SHA2_256','/asset-cover/1.png',2978330,'docx',0.000000,'人民币',1,0,0,1,1,1,0,0,0,'',NULL,NULL,NULL,NULL,'','','',3,'wx-org1-user-3-default',1,0,1,'2026-04-22 22:00:24','2026-04-22 22:46:36'),(72,'自动驾驶数字资产测试3','','',1,'一般数据',1,'raw',3,'raw_radar',3,'gz','a7be09e5a6e2e2f7d44df1414735e89127276d06a590766b1186caed3cc50101','SHA2_256','/asset-cover/1.png',1675535,'docx',0.000000,'人民币',1,0,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',3,'wx-org1-user-3-default',1,0,0,'2026-04-22 22:56:19','2026-04-22 22:56:21'),(73,'自动驾驶资产测试3','','',1,'一般数据',1,'raw',1,'raw_video',1,'bj','9a5c014bdd7cc46820776d7b10f0a419c6a5ae4dc8dac6833d417801dc7ee381','SHA2_256','/asset-cover/1.png',15684,'svg',3000.000000,'人民币',1,1,0,1,0,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'wx-org1-user-1-default',1,139412,0,'2026-05-01 22:54:42','2026-05-07 17:50:02'),(74,'自动驾驶资产33','','',1,'一般数据',3,'struct',9,'traffic_metrics',1,'bj','fa7aaa8742851154b33ebb3c7b23dfc64cb9fdfda5ac8961c37cd3e9a2599bbb','SHA2_256','/asset-cover/3.png',312668,'png',980.000000,'人民币',1,0,0,0,1,0,0,0,0,'',NULL,NULL,NULL,NULL,'','','',1,'asdf2345',1,0,0,'2026-05-07 16:59:16','2026-05-07 16:59:16');
/*!40000 ALTER TABLE `digital_asset` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `digital_contracts`
--

DROP TABLE IF EXISTS `digital_contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `digital_contracts` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `contract_id` varchar(128) NOT NULL COMMENT '数字合约ID（业务唯一）',
  `transaction_id` varchar(64) NOT NULL COMMENT '关联交易ID',
  `order_no` varchar(40) NOT NULL COMMENT '关联订单号',
  `asset_id` bigint NOT NULL COMMENT '关联资产ID',
  `contract_name` varchar(255) NOT NULL DEFAULT '' COMMENT '合约名称',
  `product_name` varchar(255) DEFAULT NULL COMMENT '产品名称',
  `token_id` varchar(128) DEFAULT NULL COMMENT 'Token ID或资产唯一标识',
  `contract_description` text COMMENT '合约描述',
  `seller_address` varchar(128) DEFAULT NULL COMMENT '卖家链上地址',
  `buyer_address` varchar(128) DEFAULT NULL COMMENT '买家链上地址',
  `operations` varchar(255) DEFAULT NULL COMMENT '可执行操作/权益',
  `expiration_time` datetime DEFAULT NULL COMMENT '失效时间',
  `quantity_limit` int DEFAULT NULL COMMENT '数量限制',
  `processing_type` varchar(32) DEFAULT NULL COMMENT '处理/权益类型',
  `pc_type` varchar(32) DEFAULT NULL COMMENT '隐私计算方式：HE/PRE/FL/MPC',
  `model_file_hash` varchar(128) DEFAULT NULL COMMENT '模型或源文件哈希',
  `status` varchar(32) NOT NULL DEFAULT '草稿' COMMENT '合约状态',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contract_id` (`contract_id`),
  UNIQUE KEY `uk_contract_transaction_id` (`transaction_id`),
  UNIQUE KEY `uk_contract_order_no` (`order_no`),
  KEY `idx_contract_asset_id` (`asset_id`),
  KEY `idx_contract_pc_type` (`pc_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='数字合约表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `digital_contracts`
--

LOCK TABLES `digital_contracts` WRITE;
/*!40000 ALTER TABLE `digital_contracts` DISABLE KEYS */;
/*!40000 ALTER TABLE `digital_contracts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fl_delivery_contracts`
--

DROP TABLE IF EXISTS `fl_delivery_contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fl_delivery_contracts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `transaction_id` varchar(128) NOT NULL,
  `business_contract_id` varchar(128) NOT NULL,
  `pcp_contract_id` varchar(128) DEFAULT NULL,
  `buyer_id` varchar(255) NOT NULL,
  `seller_ids_json` json DEFAULT NULL,
  `buyer_result_public_key` text,
  `max_epochs` int NOT NULL DEFAULT '10',
  `learning_rate` double NOT NULL DEFAULT '0.001',
  `batch_size` int NOT NULL DEFAULT '32',
  `loss_function` varchar(64) NOT NULL DEFAULT 'CrossEntropy',
  `dp_noise_scale` double NOT NULL DEFAULT '0',
  `dp_clipping_threshold` double NOT NULL DEFAULT '1',
  `pcp_status` varchar(32) DEFAULT 'CREATED',
  `current_epoch` int NOT NULL DEFAULT '0',
  `buyer_download_token` text,
  `buyer_result_filename` varchar(255) DEFAULT NULL,
  `buyer_result_storage_path` text,
  `seller_join_packages_json` json DEFAULT NULL,
  `seller_result_packages_json` json DEFAULT NULL,
  `last_error` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_fl_tx` (`transaction_id`),
  UNIQUE KEY `uniq_fl_pcp_contract` (`pcp_contract_id`),
  KEY `idx_fl_business_contract` (`business_contract_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='FL交付合约表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fl_delivery_contracts`
--

LOCK TABLES `fl_delivery_contracts` WRITE;
/*!40000 ALTER TABLE `fl_delivery_contracts` DISABLE KEYS */;
/*!40000 ALTER TABLE `fl_delivery_contracts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `he_delivery_contracts`
--

DROP TABLE IF EXISTS `he_delivery_contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `he_delivery_contracts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `transaction_id` varchar(128) NOT NULL,
  `business_contract_id` varchar(128) NOT NULL,
  `pcp_contract_id` varchar(128) DEFAULT NULL,
  `buyer_id` varchar(255) NOT NULL,
  `seller_id` varchar(255) NOT NULL,
  `selected_enc_type` varchar(32) DEFAULT NULL,
  `selected_operation` varchar(16) DEFAULT NULL,
  `paillier_public_key_json` json DEFAULT NULL,
  `elgamal_public_key_json` json DEFAULT NULL,
  `pcp_status` varchar(32) DEFAULT 'WAITING_INPUT',
  `download_token` text,
  `result_filename` varchar(255) DEFAULT NULL,
  `result_storage_path` text,
  `last_error` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_he_tx` (`transaction_id`),
  UNIQUE KEY `uniq_he_pcp_contract` (`pcp_contract_id`),
  KEY `idx_he_business_contract` (`business_contract_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='HE交付合约表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `he_delivery_contracts`
--

LOCK TABLES `he_delivery_contracts` WRITE;
/*!40000 ALTER TABLE `he_delivery_contracts` DISABLE KEYS */;
/*!40000 ALTER TABLE `he_delivery_contracts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mpc_delivery_contracts`
--

DROP TABLE IF EXISTS `mpc_delivery_contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mpc_delivery_contracts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `transaction_id` varchar(128) NOT NULL,
  `business_contract_id` varchar(128) NOT NULL,
  `remote_task_id` varchar(128) DEFAULT NULL,
  `mpc_task_type` varchar(32) NOT NULL DEFAULT 'gc',
  `buyer_id` varchar(255) NOT NULL,
  `seller_id` varchar(255) NOT NULL,
  `compute_params_json` json DEFAULT NULL,
  `seller_input_json` json DEFAULT NULL,
  `seller_filename` varchar(255) DEFAULT NULL,
  `task_status` varchar(32) NOT NULL DEFAULT 'pending',
  `remote_status` varchar(32) DEFAULT NULL,
  `result_json` json DEFAULT NULL,
  `last_error` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_mpc_tx` (`transaction_id`),
  UNIQUE KEY `uniq_mpc_remote_task` (`remote_task_id`),
  KEY `idx_mpc_business_contract` (`business_contract_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='MPC交付合约表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mpc_delivery_contracts`
--

LOCK TABLES `mpc_delivery_contracts` WRITE;
/*!40000 ALTER TABLE `mpc_delivery_contracts` DISABLE KEYS */;
/*!40000 ALTER TABLE `mpc_delivery_contracts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pre_delivery_contracts`
--

DROP TABLE IF EXISTS `pre_delivery_contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_delivery_contracts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `transaction_id` varchar(128) NOT NULL,
  `business_contract_id` varchar(128) NOT NULL,
  `pcp_contract_id` varchar(128) DEFAULT NULL,
  `buyer_id` varchar(255) NOT NULL,
  `seller_id` varchar(255) NOT NULL,
  `buyer_public_key` text,
  `tee_key_id` varchar(255) DEFAULT NULL,
  `pcp_status` varchar(32) DEFAULT 'CREATED',
  `download_token` text,
  `result_filename` varchar(255) DEFAULT NULL,
  `result_storage_path` text,
  `last_error` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_pre_tx` (`transaction_id`),
  UNIQUE KEY `uniq_pre_pcp_contract` (`pcp_contract_id`),
  KEY `idx_pre_business_contract` (`business_contract_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='PRE交付合约表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pre_delivery_contracts`
--

LOCK TABLES `pre_delivery_contracts` WRITE;
/*!40000 ALTER TABLE `pre_delivery_contracts` DISABLE KEYS */;
/*!40000 ALTER TABLE `pre_delivery_contracts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reconcile_log`
--

DROP TABLE IF EXISTS `reconcile_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reconcile_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `biz_type` varchar(20) NOT NULL COMMENT 'asset/order',
  `biz_id` varchar(64) NOT NULL COMMENT 'asset_id or order_no',
  `expected_state` json DEFAULT NULL,
  `onchain_state` json DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `retry_count` int NOT NULL DEFAULT '0',
  `result` varchar(20) NOT NULL COMMENT 'success/failed/warning/skipped',
  `error_message` varchar(1000) NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_biz_type_id` (`biz_type`,`biz_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=149 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='链上链下对账日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reconcile_log`
--

LOCK TABLES `reconcile_log` WRITE;
/*!40000 ALTER TABLE `reconcile_log` DISABLE KEYS */;
INSERT INTO `reconcile_log` VALUES (1,'asset','52','{\"token_id\": \"123223\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(2,'asset','52','{\"token_id\": \"123223\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(3,'asset','53','{\"token_id\": \"1111\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(4,'asset','53','{\"token_id\": \"1111\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(5,'asset','54','{\"token_id\": \"123\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(6,'asset','54','{\"token_id\": \"123\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(7,'asset','55','{\"token_id\": \"232312321312\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(8,'asset','55','{\"token_id\": \"232312321312\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(9,'asset','56','{\"token_id\": \"12323242345\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(10,'asset','56','{\"token_id\": \"12323242345\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(11,'asset','57','{\"token_id\": \"123232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(12,'asset','57','{\"token_id\": \"123232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(13,'asset','58','{\"token_id\": \"12323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(14,'asset','58','{\"token_id\": \"12323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(15,'asset','59','{\"token_id\": \"323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(16,'asset','59','{\"token_id\": \"323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(17,'asset','60','{\"token_id\": \"5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(18,'asset','60','{\"token_id\": \"5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(19,'asset','61','{\"token_id\": \"1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(20,'asset','61','{\"token_id\": \"1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(21,'asset','62','{\"token_id\": \"8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(22,'asset','62','{\"token_id\": \"8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(23,'asset','63','{\"token_id\": \"fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(24,'asset','63','{\"token_id\": \"fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(25,'asset','65','{\"token_id\": \"b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(26,'asset','65','{\"token_id\": \"b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(27,'asset','66','{\"token_id\": \"5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(28,'asset','66','{\"token_id\": \"5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(29,'asset','67','{\"token_id\": \"c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(30,'asset','67','{\"token_id\": \"c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',2,'failed','fetch failed','2026-03-24 14:01:32'),(31,'asset','52','{\"token_id\": \"123223\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(32,'asset','53','{\"token_id\": \"1111\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(33,'asset','54','{\"token_id\": \"123\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(34,'asset','53','{\"token_id\": \"1111\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(35,'asset','55','{\"token_id\": \"232312321312\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(36,'asset','54','{\"token_id\": \"123\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(37,'asset','56','{\"token_id\": \"12323242345\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(38,'asset','55','{\"token_id\": \"232312321312\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(39,'asset','57','{\"token_id\": \"123232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(40,'asset','56','{\"token_id\": \"12323242345\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(41,'asset','58','{\"token_id\": \"12323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(42,'asset','57','{\"token_id\": \"123232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(43,'asset','59','{\"token_id\": \"323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(44,'asset','58','{\"token_id\": \"12323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(45,'asset','59','{\"token_id\": \"323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(46,'asset','60','{\"token_id\": \"5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(47,'asset','60','{\"token_id\": \"5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(48,'asset','61','{\"token_id\": \"1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(49,'asset','61','{\"token_id\": \"1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(50,'asset','62','{\"token_id\": \"8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(51,'asset','62','{\"token_id\": \"8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(52,'asset','63','{\"token_id\": \"fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(53,'asset','63','{\"token_id\": \"fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(54,'asset','65','{\"token_id\": \"b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(55,'asset','65','{\"token_id\": \"b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(56,'asset','66','{\"token_id\": \"5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(57,'asset','66','{\"token_id\": \"5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(58,'asset','67','{\"token_id\": \"c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(59,'asset','67','{\"token_id\": \"c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',3,'failed','fetch failed','2026-03-24 14:11:31'),(60,'asset','52','{\"token_id\": \"123223\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(61,'asset','53','{\"token_id\": \"1111\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(62,'asset','54','{\"token_id\": \"123\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(63,'asset','53','{\"token_id\": \"1111\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(64,'asset','54','{\"token_id\": \"123\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(65,'asset','55','{\"token_id\": \"232312321312\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(66,'asset','55','{\"token_id\": \"232312321312\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(67,'asset','56','{\"token_id\": \"12323242345\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(68,'asset','56','{\"token_id\": \"12323242345\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(69,'asset','57','{\"token_id\": \"123232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(70,'asset','57','{\"token_id\": \"123232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(71,'asset','58','{\"token_id\": \"12323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(72,'asset','58','{\"token_id\": \"12323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(73,'asset','59','{\"token_id\": \"323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(74,'asset','59','{\"token_id\": \"323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(75,'asset','60','{\"token_id\": \"5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(76,'asset','60','{\"token_id\": \"5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(77,'asset','61','{\"token_id\": \"1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(78,'asset','61','{\"token_id\": \"1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(79,'asset','62','{\"token_id\": \"8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(80,'asset','62','{\"token_id\": \"8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(81,'asset','63','{\"token_id\": \"fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(82,'asset','63','{\"token_id\": \"fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(83,'asset','65','{\"token_id\": \"b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(84,'asset','65','{\"token_id\": \"b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(85,'asset','66','{\"token_id\": \"5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(86,'asset','66','{\"token_id\": \"5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(87,'asset','67','{\"token_id\": \"c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(88,'asset','67','{\"token_id\": \"c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',4,'failed','fetch failed','2026-03-24 14:27:31'),(89,'asset','52','{\"token_id\": \"123223\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(90,'asset','53','{\"token_id\": \"1111\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(91,'asset','54','{\"token_id\": \"123\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(92,'asset','55','{\"token_id\": \"232312321312\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(93,'asset','56','{\"token_id\": \"12323242345\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(94,'asset','57','{\"token_id\": \"123232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(95,'asset','58','{\"token_id\": \"12323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(96,'asset','59','{\"token_id\": \"323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(97,'asset','60','{\"token_id\": \"5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(98,'asset','61','{\"token_id\": \"1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(99,'asset','62','{\"token_id\": \"8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(100,'asset','63','{\"token_id\": \"fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(101,'asset','65','{\"token_id\": \"b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(102,'asset','66','{\"token_id\": \"5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(103,'asset','67','{\"token_id\": \"c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',5,'failed','fetch failed','2026-03-24 14:59:31'),(104,'asset','52','{\"token_id\": \"123223\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(105,'asset','53','{\"token_id\": \"1111\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(106,'asset','54','{\"token_id\": \"123\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(107,'asset','55','{\"token_id\": \"232312321312\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(108,'asset','56','{\"token_id\": \"12323242345\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(109,'asset','57','{\"token_id\": \"123232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(110,'asset','58','{\"token_id\": \"12323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(111,'asset','59','{\"token_id\": \"323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(112,'asset','60','{\"token_id\": \"5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(113,'asset','61','{\"token_id\": \"1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(114,'asset','62','{\"token_id\": \"8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(115,'asset','63','{\"token_id\": \"fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(116,'asset','65','{\"token_id\": \"b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(117,'asset','66','{\"token_id\": \"5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(118,'asset','67','{\"token_id\": \"c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',6,'failed','fetch failed','2026-03-24 16:03:32'),(119,'asset','52','{\"token_id\": \"123223\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(120,'asset','52','{\"token_id\": \"123223\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(121,'asset','53','{\"token_id\": \"1111\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(122,'asset','53','{\"token_id\": \"1111\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(123,'asset','54','{\"token_id\": \"123\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(124,'asset','54','{\"token_id\": \"123\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(125,'asset','55','{\"token_id\": \"232312321312\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(126,'asset','55','{\"token_id\": \"232312321312\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(127,'asset','56','{\"token_id\": \"12323242345\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(128,'asset','56','{\"token_id\": \"12323242345\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(129,'asset','57','{\"token_id\": \"123232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(130,'asset','57','{\"token_id\": \"123232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(131,'asset','58','{\"token_id\": \"12323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(132,'asset','58','{\"token_id\": \"12323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(133,'asset','59','{\"token_id\": \"323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(134,'asset','59','{\"token_id\": \"323232\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(135,'asset','60','{\"token_id\": \"5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(136,'asset','60','{\"token_id\": \"5d12db6894ba7599705d14e10251c7a844a614879c4ac5004b9bb6d4d3ef7e37\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(137,'asset','61','{\"token_id\": \"1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(138,'asset','61','{\"token_id\": \"1ea0ee52dcc6d638766a40423b0e51d45476c7b5e5fe73dfab14052716aa0448\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(139,'asset','62','{\"token_id\": \"8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(140,'asset','62','{\"token_id\": \"8bf01629936f6aa3012deaafbf8e21d9134981ab8dfcc15af76f5cfe101fcee7\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(141,'asset','63','{\"token_id\": \"fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(142,'asset','63','{\"token_id\": \"fce45af443e15eb4d26e819471a61177b45994cb81577f75207193d4adefe09c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(143,'asset','65','{\"token_id\": \"b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(144,'asset','65','{\"token_id\": \"b0a71acd5018fcbad877f220697f727e7fe681ed4af8bed15b05a0f08bd5388c\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(145,'asset','66','{\"token_id\": \"5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(146,'asset','66','{\"token_id\": \"5ad69e2eaca2750db2b1fab0cb5e10ccb265ec2316784351aef261f0732dc3a3\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(147,'asset','67','{\"token_id\": \"c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16'),(148,'asset','67','{\"token_id\": \"c4115f037d541de0940cb70f99f8ac9a0af698fa5dd6c9b2c87e846132dbeb12\", \"chain_status\": 2, \"chain_tx_hash\": \"\", \"owner_address\": \"0x00000000000000000000000000000000000f4241\"}','{}','asset_reconcile_failed',7,'failed','fetch failed','2026-03-24 18:13:16');
/*!40000 ALTER TABLE `reconcile_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `region`
--

DROP TABLE IF EXISTS `region`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `region` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键',
  `region_key` varchar(20) NOT NULL COMMENT '地区标识，如 bj',
  `region_name` varchar(50) NOT NULL COMMENT '地区名称，如 北京',
  `province` varchar(50) DEFAULT NULL COMMENT '所属省份',
  `city` varchar(50) DEFAULT NULL COMMENT '城市名',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序权重',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_region_key` (`region_key`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='地区表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `region`
--

LOCK TABLES `region` WRITE;
/*!40000 ALTER TABLE `region` DISABLE KEYS */;
INSERT INTO `region` VALUES (1,'bj','北京','北京市','北京市',1,'2026-03-02 10:58:28'),(2,'sh','上海','上海市','上海市',2,'2026-03-02 10:58:28'),(3,'gz','广州','广东省','广州市',3,'2026-03-02 10:58:28'),(4,'sz','深圳','广东省','深圳市',4,'2026-03-02 10:58:28');
/*!40000 ALTER TABLE `region` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `transaction_id` varchar(64) NOT NULL COMMENT '交易ID（业务唯一）',
  `order_no` varchar(40) NOT NULL COMMENT '关联订单号',
  `asset_id` bigint NOT NULL COMMENT '资产ID',
  `owner_id` bigint DEFAULT NULL COMMENT '所有者用户ID',
  `buyer_id` bigint NOT NULL COMMENT '买家用户ID',
  `buyer_address` varchar(128) NOT NULL DEFAULT '' COMMENT '买家链上地址',
  `seller_id` bigint DEFAULT NULL COMMENT '卖家用户ID',
  `seller_address` varchar(128) NOT NULL DEFAULT '' COMMENT '卖家链上地址',
  `status` varchar(32) NOT NULL DEFAULT '已确认' COMMENT '交易状态',
  `quantity` int NOT NULL DEFAULT '1' COMMENT '交易数量',
  `quality` varchar(50) DEFAULT NULL COMMENT '资产等级/质量说明',
  `processing_type` varchar(32) DEFAULT NULL COMMENT '处理/权益类型',
  `expiration_time` datetime DEFAULT NULL COMMENT '有效截止时间',
  `model_file_hash` varchar(128) DEFAULT NULL COMMENT '模型或源文件哈希',
  `delivery_count` int NOT NULL DEFAULT '0' COMMENT '交付次数',
  `delivery_limit` int NOT NULL DEFAULT '1' COMMENT '允许交付次数',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_transaction_id` (`transaction_id`),
  UNIQUE KEY `uk_transaction_order_no` (`order_no`),
  KEY `idx_transaction_asset_id` (`asset_id`),
  KEY `idx_transaction_buyer_id` (`buyer_id`),
  KEY `idx_transaction_seller_id` (`seller_id`),
  KEY `idx_transaction_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='交易主表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_certificate`
--

DROP TABLE IF EXISTS `user_certificate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_certificate` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `org_code` varchar(32) NOT NULL COMMENT '组织编码，如 wx-org1 / wx-org2',
  `cert_name` varchar(120) NOT NULL COMMENT '证书名称',
  `chain_address` varchar(128) NOT NULL DEFAULT '' COMMENT '证书对应链地址',
  `cert_path` varchar(500) DEFAULT NULL COMMENT '证书文件路径（可选）',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：1可用 0禁用',
  `is_default` tinyint NOT NULL DEFAULT '0' COMMENT '是否默认证书',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_org_cert` (`user_id`,`org_code`,`cert_name`),
  KEY `idx_user_org_status` (`user_id`,`org_code`,`status`),
  CONSTRAINT `fk_user_certificate_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户证书表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_certificate`
--

LOCK TABLES `user_certificate` WRITE;
/*!40000 ALTER TABLE `user_certificate` DISABLE KEYS */;
INSERT INTO `user_certificate` VALUES (1,1,'wx-org1','asdf2345','0x00000000000000000000000000000000000f4241',NULL,1,0,'2026-05-07 16:52:29','2026-05-07 16:52:29');
/*!40000 ALTER TABLE `user_certificate` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `userAvatar`
--

DROP TABLE IF EXISTS `userAvatar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `userAvatar` (
  `id` int NOT NULL AUTO_INCREMENT,
  `avatarUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `onlyId` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `originalName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '文件原名',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `userAvatar`
--

LOCK TABLES `userAvatar` WRITE;
/*!40000 ALTER TABLE `userAvatar` DISABLE KEYS */;
INSERT INTO `userAvatar` VALUES (14,'http://localhost:3007/upload/f9f3411f-3980-45ab-8ac5-55f5d7556ee8.png','f9f3411f-3980-45ab-8ac5-55f5d7556ee8','asdf2345','截屏2026-02-26 11.04.11.png'),(15,'http://localhost:3007/upload/2ba0ceb6-fbdb-4b10-ab3f-3b1d15c04711.png','2ba0ceb6-fbdb-4b10-ab3f-3b1d15c04711',NULL,'截屏2026-02-26 11.04.11.png');
/*!40000 ALTER TABLE `userAvatar` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '用户唯一标识',
  `account` varchar(50) NOT NULL COMMENT '账号',
  `password` varchar(255) NOT NULL COMMENT '密码（加密存储）',
  `identity` varchar(20) DEFAULT NULL COMMENT '身份/角色',
  `department` varchar(100) DEFAULT NULL COMMENT '所属部门',
  `name` varchar(50) DEFAULT NULL COMMENT '姓名',
  `sex` char(1) DEFAULT NULL COMMENT '性别（M-男/F-女）',
  `email` varchar(100) DEFAULT NULL COMMENT '邮箱',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '状态（0-正常，1-冻结）',
  `avatarOnlyId` varchar(255) DEFAULT NULL,
  `avatarUrl` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_account` (`account`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'asdf2345','$2b$10$x4dKqf5SaZs1aBG91O2TmeSUiOXCVEnlCpcUEn.dkKaSRmcSHe3uO','seller',NULL,'王王','男','1232@qq.com','2026-02-27 01:15:45','2026-04-02 11:06:00',0,'f9f3411f-3980-45ab-8ac5-55f5d7556ee8','http://localhost:3007/upload/f9f3411f-3980-45ab-8ac5-55f5d7556ee8.png'),(2,'usertest1','$2b$10$K.KFQptq8YaDRcWOdSWKMeIbc23pIgHwsO6rnyxr.fJufN8ePsYYW','buyer',NULL,'王一','男','usertest1@qq.com','2026-03-24 21:50:09','2026-04-22 17:35:15',0,NULL,NULL),(3,'usertest2','$2b$10$khndu9UX/wSkBgAx1CPetu7kJU2BljiIZvZ86rZj7Mqgs71RUGff2','seller',NULL,NULL,NULL,NULL,'2026-03-24 21:52:06','2026-04-02 11:06:00',0,NULL,NULL),(4,'usertest3','$2b$10$Y0TaZis63KJmyHmdNmjWgeEhBsCf22CPfRMz.qAVK7ui27v2dtvra','buyer',NULL,NULL,NULL,NULL,'2026-03-24 21:52:19','2026-04-02 11:06:00',0,NULL,NULL),(5,'usertest4','$2b$10$nggMJLPSzOfObgmeZzxjeOcCdhu6QsE6Z3pNaAGV/WC56cmC0ApCm','admin',NULL,NULL,NULL,NULL,'2026-03-24 21:52:27','2026-04-16 01:51:52',0,NULL,NULL),(12,'asdf1234','$2b$10$HIzg6VI8uErNHA8F0D6r7e7/ULoPN.bzOMK.ndqqzcCT4imcuyrn6','buyer',NULL,NULL,NULL,NULL,'2026-04-02 11:41:35','2026-04-02 11:41:34',0,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-11 20:44:23
