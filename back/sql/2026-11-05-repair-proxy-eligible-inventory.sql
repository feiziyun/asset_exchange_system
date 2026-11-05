-- 修复编辑已上架资产时，将未上架库存 0 错写成上架库存 0 的历史记录。
-- 仅处理从未产生订单、没有代理关系的固定价资产。
-- 请先单独执行 SELECT 段核对候选记录，确认后再执行 UPDATE 段；运行整文件会立即更新。
SELECT da.id, da.asset_name, apr.id AS publish_id, apr.publish_qty,
       apr.remaining_qty, apr.sold_qty_total, da.available_qty
FROM digital_asset da
JOIN asset_publish_record apr ON apr.asset_id = da.id
WHERE da.status = 1 AND da.available_qty = 0
  AND apr.delegation_id IS NULL AND apr.pricing_mode = 'fixed'
  AND apr.publish_status = 2 AND apr.publish_qty = 1
  AND apr.remaining_qty = 0 AND apr.sold_qty_total = 0
  AND NOT EXISTS (SELECT 1 FROM asset_order ao WHERE ao.asset_id = da.id)
  AND NOT EXISTS (SELECT 1 FROM asset_delegations d WHERE d.asset_id = da.id);

UPDATE asset_publish_record apr
JOIN digital_asset da ON da.id = apr.asset_id
SET apr.remaining_qty = 1, apr.publish_status = 1
WHERE da.status = 1 AND da.available_qty = 0
  AND apr.delegation_id IS NULL AND apr.pricing_mode = 'fixed'
  AND apr.publish_status = 2 AND apr.publish_qty = 1
  AND apr.remaining_qty = 0 AND apr.sold_qty_total = 0
  AND NOT EXISTS (SELECT 1 FROM asset_order ao WHERE ao.asset_id = da.id)
  AND NOT EXISTS (SELECT 1 FROM asset_delegations d WHERE d.asset_id = da.id);
