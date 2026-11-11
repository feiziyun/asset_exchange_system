<template>
  <div class="cross-page">
    <h2>跨链跨平台</h2>
    <div class="cross-grid">
      <el-card>
        <template #header><strong>跨平台检索</strong></template>
        <div class="search-row">
          <el-input v-model.trim="keyword" placeholder="资产名称、编码、目录 ID 或机构" clearable @keyup.enter="search" />
          <el-button type="primary" :loading="searching" @click="search">检索</el-button>
        </div>
        <el-alert v-if="searchError" :title="searchError" type="error" :closable="false" class="message" />
        <el-table :data="results" v-loading="searching" height="480" highlight-current-row @current-change="selectAsset">
          <el-table-column prop="asset_name" label="资产名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="chain_name" label="所在平台（链）" min-width="150" show-overflow-tooltip />
          <el-table-column prop="file_hash" label="唯一标识" min-width="165" show-overflow-tooltip />
        </el-table>
        <p class="hint">选择左侧资产后，右侧会填入 Token ID。</p>
      </el-card>
      <el-card>
        <template #header><strong>资产跨链调配</strong></template>
        <el-radio-group v-model="mode" class="mode">
          <el-radio-button value="in">转入 CB-In</el-radio-button>
          <el-radio-button value="out">转出 CB-Out</el-radio-button>
        </el-radio-group>
        <el-form label-position="top">
          <el-form-item label="TokenId（唯一标识）"><el-input v-model.trim="form.tokenId" /></el-form-item>
          <el-form-item label="Amount"><el-input v-model.trim="form.amount" /></el-form-item>
          <template v-if="mode === 'in'">
            <el-form-item label="To（ChainMaker 地址）"><el-input v-model.trim="form.toChainmaker" /></el-form-item>
            <el-form-item label="CategoryName"><el-input v-model.trim="form.categoryName" /></el-form-item>
            <el-form-item label="Metadata.source"><el-input v-model.trim="form.metaSource" /></el-form-item>
            <el-form-item label="Metadata.desc"><el-input v-model.trim="form.metaDesc" /></el-form-item>
          </template>
          <template v-else>
            <el-form-item label="OwnerAddress"><el-input v-model.trim="form.ownerAddress" /></el-form-item>
            <el-form-item label="To（EVM 地址）"><el-input v-model.trim="form.toEvm" /></el-form-item>
          </template>
        </el-form>
        <el-button type="primary" :loading="submitting" @click="submit">{{ mode === 'in' ? '执行转入' : '执行转出' }}</el-button>
        <pre v-if="response" class="response">{{ JSON.stringify(response, null, 2) }}</pre>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/http/index.js'

const keyword = ref('')
const searching = ref(false)
const searchError = ref('')
const results = ref([])
const mode = ref('in')
const submitting = ref(false)
const response = ref(null)
const form = reactive({ tokenId: '', amount: '1', toChainmaker: '', categoryName: 'WH', metaSource: 'peer-burn', metaDesc: 'mint after peer burn', ownerAddress: '', toEvm: '' })

const selectAsset = (row) => { form.tokenId = String(row?.file_hash || '') }

const search = async () => {
  const term = keyword.value.trim().toLowerCase()
  results.value = []
  searchError.value = ''
  searching.value = true
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
      if (Number(item.status) === -1) continue
      const searchable = [item.name, item.code, item.id, item.remark, item.orgId, item.orgDID, item.platform_name, item.PlatformName]
        .map((part) => String(part || '').toLowerCase()).join(' ')
      if (term && !searchable.includes(term)) continue
      const id = String(item.id || item.code || item.name || '')
      if (id && (!latest.has(id) || Number(item.version || 0) > Number(latest.get(id).version || 0))) latest.set(id, item)
    }
    results.value = [...latest.values()].map((item) => ({
      asset_name: item.name || '', file_hash: item.id || item.code || '',
      chain_name: item.chain_type || item.platform_name || item.PlatformName || 'ChainMaker (chain1)',
    }))
  } catch (error) {
    searchError.value = error?.response?.data?.message || '跨平台检索失败'
  } finally { searching.value = false }
}

onMounted(search)

const submit = async () => {
  if (!form.tokenId || !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
    ElMessage.warning('请填写 TokenId 和有效的 Amount')
    return
  }
  const payload = mode.value === 'in'
    ? { amount: String(form.amount), to: form.toChainmaker, tokenId: form.tokenId,
        categoryName: form.categoryName, metadata: { source: form.metaSource, desc: form.metaDesc } }
    : { amount: String(form.amount), to: form.toEvm, tokenId: form.tokenId, ownerAddress: form.ownerAddress }
  if (!payload.to || (mode.value === 'out' && !form.ownerAddress)) {
    ElMessage.warning('请填写转入或转出地址')
    return
  }
  submitting.value = true
  response.value = null
  try {
    const res = await request.post(`/api/regulator/chainbridge/pre/CB-${mode.value === 'in' ? 'In' : 'Out'}`, payload)
    response.value = res.data
    const code = res.data?.code ?? res.data?.local?.code
    if (Number(code) !== 0) throw new Error(res.data?.message || res.data?.local?.message || '链服务返回失败')
    ElMessage.success(mode.value === 'in' ? '转入成功' : '转出成功')
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || '跨链调配失败')
  } finally { submitting.value = false }
}
</script>

<style scoped>
.cross-page { padding: 20px; }
h2 { margin: 0 0 18px; color: #0f2744; }
.cross-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.search-row { display: flex; gap: 8px; margin-bottom: 12px; }
.mode { margin-bottom: 12px; }
.hint { color: #667085; font-size: 12px; }
.message { margin-bottom: 12px; }
.response { margin-top: 14px; padding: 12px; max-height: 180px; overflow: auto; background: #f3f6fb; white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 1000px) { .cross-grid { grid-template-columns: 1fr; } }
</style>
