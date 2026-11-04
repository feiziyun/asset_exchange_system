-- Apply to the existing database before deploying the asset detail change.
ALTER TABLE digital_asset
  ADD COLUMN proxy_agent_address VARCHAR(128) DEFAULT NULL COMMENT '最近一次成功授权的代理地址';
