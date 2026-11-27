<template>
  <div class="cross-page">
    <h2 class="page-title">跨链跨平台</h2>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="资产信息" name="assets"><AssetCatalog /></el-tab-pane>
      <el-tab-pane label="跨链调配" name="bridge">
        <div class="cross-grid">
          <section class="panel-column">
            <h3>跨平台检索</h3>
            <el-input v-model="keyword" placeholder="输入资产名称 / 机构" clearable class="search-input" @keyup.enter="search">
              <template #append><el-button :loading="searching" @click="search">检索</el-button></template>
            </el-input>
            <el-alert v-if="searchError" :title="searchError" type="error" :closable="false" class="message" />
            <el-table :data="results" v-loading="searching" height="440" size="small"
              :empty-text="searching ? '检索中...' : searched ? '未找到匹配结果' : '输入关键词后回车检索目录链'"
              :row-class-name="rowClassName" @row-click="selectAsset">
              <el-table-column prop="asset_name" label="资产名称" min-width="200" show-overflow-tooltip />
              <el-table-column label="所在平台" min-width="240" show-overflow-tooltip>
                <template #default="{ row }">{{ row.platform_name || row.chain_type || 'ChainMaker(chain1)' }}</template>
              </el-table-column>
            </el-table>
          </section>
          <section class="panel-column">
            <h3>资产跨链调配</h3>
            <el-radio-group v-model="mode" class="mode">
              <el-radio-button value="in">转入</el-radio-button>
              <el-radio-button value="out">转出</el-radio-button>
            </el-radio-group>
            <p class="mode-hint">{{ mode === 'in'
              ? '转入：EVM → ChainMaker，先在 EVM 销毁，再在 ChainMaker 铸造'
              : '转出：ChainMaker → EVM，先在 EVM 铸造，再在 ChainMaker 销毁' }}</p>
            <el-form label-position="top">
              <el-form-item label="TokenId（唯一标识）">
                <el-input :model-value="selectedTokenId ? truncateHash(selectedTokenId) : ''" placeholder="请先在左侧选择资产" disabled />
              </el-form-item>
              <el-form-item label="Amount"><el-input v-model="form.amount" placeholder="例如 1 / 100" /></el-form-item>
              <template v-if="mode === 'in'">
                <el-form-item label="To（ChainMaker 地址）"><el-input v-model.trim="form.toChainmaker" placeholder="例如 64b6a0f6..." /></el-form-item>
              </template>
              <template v-else>
                <el-form-item label="OwnerAddress（ChainMaker 拥有者地址）"><el-input v-model.trim="form.ownerAddress" placeholder="例如 64b6a0f6..." /></el-form-item>
                <el-form-item label="To（EVM 接收地址）"><el-input v-model.trim="form.toEvm" placeholder="例如 0x70997970..." /></el-form-item>
              </template>
            </el-form>
            <el-button type="primary" class="submit-button" :loading="submitting" @click="submit">
              {{ submitting ? '提交中...' : mode === 'in' ? '执行转入' : '执行转出' }}
            </el-button>
            <div v-if="response" class="result-box">
              <div class="result-title">返回</div>
              <pre>{{ JSON.stringify(response, null, 2) }}</pre>
            </div>
          </section>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/http/index.js'
import AssetCatalog from './AssetCatalog.vue'

const allowedPlatform = '北京国家大数据交易所'
const activeTab = ref('assets')
const keyword = ref('')
const searching = ref(false)
const searched = ref(false)
const searchError = ref('')
const results = ref([])
const selectedAsset = ref(null)
const selectedTokenId = computed(() => selectedAsset.value?.file_hash || selectedAsset.value?.asset_id || '')
const mode = ref('in')
const submitting = ref(false)
const response = ref(null)
const form = reactive({ amount: '1', toChainmaker: '', ownerAddress: '', toEvm: '' })

const truncateHash = value => String(value).length <= 12 ? value : `${String(value).slice(0, 6)}...${String(value).slice(-4)}`
const rowClassName = ({ row }) => selectedAsset.value?.file_hash === row.file_hash ? 'is-selected' : ''
const selectAsset = row => { selectedAsset.value = row }

const search = async () => {
  const term = keyword.value.trim().toLowerCase()
  searched.value = true
  if (!term) {
    results.value = []
    selectedAsset.value = null
    searchError.value = ''
    return
  }
  searching.value = true
  searchError.value = ''
  try {
    const all = []
    const tokens = new Set()
    let pageToken = ''
    for (let page = 0; page < 20; page += 1) {
      const res = await request.get('/api/regulator/catalogapi/contract/datacatalog/list', {
        params: { page_size: '50', ...(pageToken ? { page_token: pageToken } : {}) },
      })
      const result = res.data?.data?.result || {}
      all.push(...(Array.isArray(result.list) ? result.list : []))
      const next = String(result.next_page_token || '')
      if (!next || tokens.has(next)) break
      tokens.add(next)
      pageToken = next
    }
    const latest = new Map()
    for (const item of all) {
      if (String(item?.platform_name || '') !== allowedPlatform) continue
      const fields = [item.name, item.code, item.id, item.remark, item.orgId, item.orgDID, item.platform_name, item.platform_url]
      if (!fields.some(value => String(value || '').toLowerCase().includes(term))) continue
      if (Number(item.status) === -1) continue
      const id = item.id || item.code || item.name
      if (!id) continue
      const previous = latest.get(id)
      if (!previous || Number(item.version ?? 0) > Number(previous.version ?? 0)) latest.set(id, item)
    }
    results.value = [...latest.values()].map(item => ({
      asset_name: item.name || '', file_hash: item.id || item.code || '',
      asset_id: item.id || '', category_name: item.industry || item.categoryName || 'WH',
      platform_name: item.platform_name || '', chain_type: item.chain_type || '',
    }))
    selectedAsset.value = null
    if (!results.value.length) ElMessage.warning('未在目录链中检索到匹配资产')
  } catch (error) {
    results.value = []
    selectedAsset.value = null
    searchError.value = error?.response?.data?.message || '跨平台检索失败：请检查目录链服务'
  } finally { searching.value = false }
}

const submit = async () => {
  if (!selectedAsset.value || !selectedTokenId.value) return ElMessage.warning('请先在左侧选择一个资产')
  if (!form.amount || Number(form.amount) <= 0) return ElMessage.warning('请输入有效的 amount')
  if (mode.value === 'in' && !form.toChainmaker) return ElMessage.warning('请输入转入地址（to：ChainMaker 地址）')
  if (mode.value === 'out' && !form.ownerAddress) return ElMessage.warning('请输入 ownerAddress（ChainMaker 资产拥有者地址）')
  if (mode.value === 'out' && !form.toEvm) return ElMessage.warning('请输入转出接收地址（to：EVM 地址）')

  const payload = mode.value === 'in'
    ? { amount: String(form.amount), to: form.toChainmaker, tokenId: selectedTokenId.value,
        categoryName: selectedAsset.value.category_name, metadata: { source: 'peer-burn', desc: 'mint after peer burn' } }
    : { amount: String(form.amount), to: form.toEvm, tokenId: selectedTokenId.value, ownerAddress: form.ownerAddress }
  submitting.value = true
  response.value = null
  try {
    const res = await request.post(`/api/regulator/chainbridge/pre/CB-${mode.value === 'in' ? 'In' : 'Out'}`, payload)
    response.value = res.data
    const body = res.data || {}
    const code = body.code ?? body.local?.code
    if (res.status === 200 && code === 0) {
      ElMessage.success(mode.value === 'in' ? '转入成功（CB-In）' : '转出成功（CB-Out）')
    } else {
      ElMessage.error(`${mode.value === 'in' ? '转入' : '转出'}失败：${body.message ?? body.local?.message ?? 'unknown error'}`)
    }
  } catch (error) {
    response.value = error?.response?.data || null
    let message = response.value?.message || response.value?.local?.message || (error?.response ? `HTTP ${error.response.status}` : '网络异常，请检查后端服务')
    if (String(message).includes('[code:4]')) {
      message += mode.value === 'in'
        ? '（合约执行失败：常见原因是该 tokenId 已在链上存在）'
        : '（合约执行失败：常见原因是 OwnerAddress 不是该 token 的真实 owner，或该 tokenId 在链上不存在）'
    }
    ElMessage.error(`${mode.value === 'in' ? '转入' : '转出'}失败：${message}`)
  } finally { submitting.value = false }
}
</script>

<style scoped>
.cross-page { padding: 20px; }
h2 { margin: 0 0 18px; color: #1f2328; }
.cross-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 18px; }
.panel-column { min-width: 0; padding: 18px; border: 1px solid #d8dee4; border-radius: 8px; background: #fff; }
.panel-column h3 { margin: 0 0 18px; color: #1f2328; font-size: 17px; }
.search-input { margin-bottom: 14px; }
.mode { margin-bottom: 10px; }
.mode-hint { margin: 0 0 18px; color: #57606a; font-size: 13px; line-height: 1.5; }
.submit-button { min-width: 120px; }
.message { margin-bottom: 12px; }
.result-box { margin-top: 18px; padding: 12px; border: 1px solid #d8dee4; border-radius: 6px; background: #f6f8fa; }
.result-title { margin-bottom: 8px; color: #57606a; font-size: 13px; }
.result-box pre { margin: 0; max-height: 180px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
:deep(.el-table .is-selected > td) { background: #eaf2ff !important; }
@media (max-width: 1000px) { .cross-grid { grid-template-columns: 1fr; } }
</style>
