-- Incremental migration for the inspected fzy schema. Run once after backup.
-- Existing model_file_hash values are NOT trusted as model commitments.
ALTER TABLE digital_contracts
  ADD COLUMN policy_json JSON NULL,
  ADD COLUMN policy_version INT NOT NULL DEFAULT 1,
  ADD COLUMN model_manifest_json JSON NULL,
  ADD COLUMN model_hash_verified TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN verification_status VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN verified_at DATETIME NULL;

CREATE TABLE digital_contract_verification_log (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  contract_id VARCHAR(128) NOT NULL,
  policy_version INT NOT NULL,
  actor_id BIGINT NOT NULL,
  plain_contract_json JSON NOT NULL,
  remote_result_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_contract_time (contract_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
