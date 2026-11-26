'use strict';

const crypto = require('node:crypto');
const db = require('../db/index');
const { services } = require('../config/services');
const assetService = require('../service/asset');

const apply = process.argv.includes('--apply');
const catalogKey = (fileHash) => `catalog_${crypto.createHash('md5').update(fileHash).digest('hex').slice(0, 16)}`;

async function loadCatalogIds() {
  const latest = new Map();
  const seenTokens = new Set();
  let pageToken = '';

  for (let page = 0; page < 1000; page += 1) {
    const url = new URL('/contract/datacatalog/list', services.dataCatalogBaseUrl);
    url.searchParams.set('page_size', '50');
    if (pageToken) url.searchParams.set('page_token', pageToken);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`目录查询失败：HTTP ${response.status}`);
    const body = await response.json();
    if (body?.bizCode !== 'SUCCESS') throw new Error(body?.message || '目录查询失败');
    const result = body?.data?.result || {};
    for (const item of Array.isArray(result.list) ? result.list : []) {
      const id = String(item.id || item.code || '');
      if (id && (!latest.has(id) || Number(item.version || 0) > Number(latest.get(id).version || 0))) {
        latest.set(id, item);
      }
    }
    const next = String(result.next_page_token || '');
    if (!next) return new Set([...latest].filter(([, item]) => Number(item.status) !== -1).map(([id]) => id));
    if (seenTokens.has(next)) throw new Error('目录分页游标重复，已停止补发');
    seenTokens.add(next);
    pageToken = next;
  }
  throw new Error('目录超过 1000 页，已停止补发');
}

async function main() {
  const catalogIds = await loadCatalogIds();
  const [assets] = await db.promise().query(`
    SELECT da.id, da.file_hash, da.asset_name, da.description,
           da.classification_data_level, da.user_id
    FROM digital_asset da
    JOIN asset_chain_info aci ON aci.asset_id = da.id AND aci.chain_status = 1
    WHERE da.file_hash IS NOT NULL AND da.file_hash <> ''
    ORDER BY da.id
  `);

  const missing = assets.filter((asset) => !catalogIds.has(catalogKey(asset.file_hash)));
  console.log(`已上链资产 ${assets.length} 条，目录缺少 ${missing.length} 条；模式：${apply ? '补发' : '预览'}`);
  if (!apply) {
    missing.forEach((asset) => console.log(`待补发：${asset.id} ${asset.asset_name}`));
    console.log('确认后运行 node scripts/backfill-data-catalog.js --apply');
    return;
  }

  let failed = 0;
  for (const asset of missing) {
    try {
      await assetService.publishAssetToDataCatalogCompatible({
        identifier: asset.file_hash,
        assetName: asset.asset_name,
        description: asset.description,
        assetType: asset.classification_data_level,
        userId: asset.user_id,
      });
      console.log(`已补发：${asset.id} ${asset.asset_name}`);
    } catch (error) {
      failed += 1;
      console.error(`补发失败：${asset.id} ${asset.asset_name}：${error.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => db.end());
