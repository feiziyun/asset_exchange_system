-- Execute once against the asset exchange database before deploying this backend.
ALTER TABLE fl_delivery_contracts
  ADD COLUMN current_attempt_id VARCHAR(128) DEFAULT NULL AFTER pcp_contract_id;
UPDATE fl_delivery_contracts
  SET current_attempt_id = JSON_UNQUOTE(JSON_EXTRACT(seller_result_packages_json, '$.__attempt_id'))
  WHERE current_attempt_id IS NULL
    AND JSON_EXTRACT(seller_result_packages_json, '$.__attempt_id') IS NOT NULL;
