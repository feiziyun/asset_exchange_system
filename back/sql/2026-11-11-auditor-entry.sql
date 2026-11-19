-- 审计账号由管理员分配 Hub 或指定节点入口。
-- 可重复执行；旧库可能尚未创建审计入口字段。
-- Hub 接入凭据保存在后端本地配置；Node 查看账号由 Node 运维台创建，
-- 交易系统按 PCP 流程加密保存其账号密码用于自动跳转。
SET @auditor_target_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'auditor_target'
);
SET @auditor_target_ddl = IF(@auditor_target_exists = 0,
  'ALTER TABLE users ADD COLUMN auditor_target VARCHAR(64) NULL',
  'SELECT 1');
PREPARE auditor_target_stmt FROM @auditor_target_ddl;
EXECUTE auditor_target_stmt;
DEALLOCATE PREPARE auditor_target_stmt;

CREATE TABLE IF NOT EXISTS pam_node_credentials (
  node_id VARCHAR(64) NOT NULL PRIMARY KEY,
  node_name VARCHAR(128) NULL,
  username VARCHAR(128) NOT NULL,
  password_enc TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
