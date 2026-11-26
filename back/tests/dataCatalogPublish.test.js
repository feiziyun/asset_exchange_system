'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.EXTERNAL_LOG_DIR = path.join(os.tmpdir(), 'fzy-data-catalog-test-logs');
const assetService = require('../service/asset');
const assetHandler = require('../router_handle/asset');

test('catalog publication uses the registration identifier and checks business success', async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ bizCode: 'SUCCESS' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await assetService.publishAssetToDataCatalogCompatible({
      identifier: 'hash-123', assetName: '测试资产', assetType: '一般数据', certOrg: 'wx-org1.chainmaker.org',
    });
    assert.equal(result.success, true);
    assert.equal(request.body.name, '测试资产');
    assert.equal(request.body.id, result.catalogIdentifier);
    assert.match(request.url, /\/contract\/datacatalog\/publish$/);

    global.fetch = async () => new Response(JSON.stringify({ bizCode: 'FAILED', message: '目录拒绝' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    await assert.rejects(
      assetService.publishAssetToDataCatalogCompatible({ identifier: 'hash-123', assetName: '测试资产', certOrg: 'wx-org1.chainmaker.org' }),
      /目录拒绝/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('registration reports a catalog failure without losing the completed registration', async () => {
  const originalCreate = assetService.createAsset;
  const originalPublish = assetService.publishAssetToDataCatalogCompatible;
  assetService.createAsset = async () => ({ assetId: 42, chain: { chain_status: 1, token_id: 'hash-123' } });
  assetService.publishAssetToDataCatalogCompatible = async () => { throw new Error('目录服务暂不可用'); };
  const originalError = console.error;
  console.error = () => {};
  try {
    let response;
    await assetHandler.registerAsset(
      { auth: { id: 7, identity: 'seller' }, body: { file_hash: 'hash-123', asset_name: '测试资产' }, file: null },
      { send: (data) => { response = data; }, cc: (error) => { throw error; } },
    );
    assert.equal(response.status, 0);
    assert.equal(response.data.asset_id, 42);
    assert.equal(response.data.catalog_publish.success, false);
  } finally {
    assetService.createAsset = originalCreate;
    assetService.publishAssetToDataCatalogCompatible = originalPublish;
    console.error = originalError;
  }
});
