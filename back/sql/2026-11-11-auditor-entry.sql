-- 审计账号由管理员分配 Hub 或指定节点入口。
-- 可重复执行；旧库可能尚未创建审计入口字段。
-- 新版 Hub 接入凭据保存在后端本地配置，Node 查看账号由节点运维台管理，
-- 本交易库无需新建凭据表；旧库已有的 pam_node_credentials 保留，不在此处删除。
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
