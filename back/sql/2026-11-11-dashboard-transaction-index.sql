-- 为数据面板的今日交易量和 30 天交易历史提供日期索引；可重复执行。
SET @dashboard_created_index_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'
    AND INDEX_NAME = 'idx_transaction_created_at'
);
SET @dashboard_created_index_ddl = IF(@dashboard_created_index_exists = 0,
  'ALTER TABLE transactions ADD INDEX idx_transaction_created_at (created_at)',
  'SELECT 1');
PREPARE dashboard_created_index_stmt FROM @dashboard_created_index_ddl;
EXECUTE dashboard_created_index_stmt;
DEALLOCATE PREPARE dashboard_created_index_stmt;
