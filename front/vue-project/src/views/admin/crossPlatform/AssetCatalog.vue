<template>
  <section class="catalog">
    <div class="toolbar">
      <el-select v-model="platform" class="platform" aria-label="所在平台">
        <el-option label="全部平台" value="all" />
        <el-option label="北京国家大数据交易所" value="北京国家大数据交易所" />
        <el-option label="数字资产交易平台" value="数字资产交易平台" />
      </el-select>
      <span class="count">共 {{ filtered.length }} 条资产</span>
      <el-input v-model.trim="keyword" class="search" clearable placeholder="搜索资产名称 / 机构" />
    </div>
    <div v-loading="loading" class="cards">
      <button v-for="item in paged" :key="item.id || item.code" type="button" class="asset-card" @click="selected = item">
        <span class="card-main"><strong>{{ item.name || item.code || item.id }}</strong><small>{{ item.remark || '暂无描述' }}</small></span>
        <span class="org">{{ item.orgId || '未知机构' }}</span>
        <span class="arrow">›</span>
      </button>
      <el-empty v-if="!loading && !filtered.length" description="暂无资产" />
    </div>
    <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[5, 10, 20]" :total="filtered.length" layout="total, sizes, prev, pager, next" class="pagination" />
    <el-dialog :model-value="!!selected" title="资产详情" width="640px" @close="selected = null">
      <div v-if="selected" class="details">
        <div><span>资产名称</span><strong>{{ selected.name || '-' }}</strong></div>
        <div><span>资产编号</span><a href="#" @click.prevent="copyId">{{ selected.id || selected.code || '-' }}（复制）</a></div>
        <div><span>所属机构</span><span>{{ selected.orgId || '-' }}</span></div>
        <div><span>所在平台</span><span>{{ selected.platform_name || '-' }}</span></div>
        <div><span>平台网址</span><a v-if="platformUrl" :href="platformUrl" target="_blank" rel="noopener noreferrer">{{ selected.platform_url }}</a><span v-else>未登记</span></div>
        <div><span>资产类型</span><span>{{ selected.asseType || '未标注' }}</span></div>
        <div><span>发布时间</span><span>{{ formatTime(selected.publishTime) }}</span></div>
        <div><span>版本</span><span>{{ selected.version ?? '-' }}</span></div>
        <div><span>状态</span><span>{{ Number(selected.status) === 1 ? '有效' : selected.status ?? '-' }}</span></div>
        <div><span>详细描述</span><span>{{ selected.remark || '无' }}</span></div>
      </div>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/http/index.js'

const loading = ref(false)
const assets = ref([])
const platform = ref('all')
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)
const selected = ref(null)
const filtered = computed(() => assets.value.filter(item => {
  const platformName = String(item.platform_name || '')
  const platformOk = platform.value === 'all' || platformName === platform.value
  const term = keyword.value.toLowerCase()
  return platformOk && (!term || `${item.name || ''} ${item.orgId || ''}`.toLowerCase().includes(term))
}))
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const platformUrl = computed(() => {
  const value = String(selected.value?.platform_url || '').trim()
  if (!value) return ''
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try { const url = new URL(withProtocol); return ['http:', 'https:'].includes(url.protocol) ? url.href : '' } catch { return '' }
})
watch([platform, keyword, pageSize], () => { page.value = 1 })
const formatTime = value => {
  const date = new Date(Number(value) || value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false })
}
const copyId = async () => {
  try { await navigator.clipboard.writeText(String(selected.value?.id || selected.value?.code || '')); ElMessage.success('资产编号已复制') }
  catch { ElMessage.error('复制失败，请手动选择') }
}
const load = async () => {
  loading.value = true
  try {
    const all = []
    const seen = new Set()
    let pageToken = ''
    for (let i = 0; i < 20; i += 1) {
      const res = await request.get('/api/regulator/catalogapi/contract/datacatalog/list', { params: { page_size: '50', ...(pageToken ? { page_token: pageToken } : {}) } })
      const result = res.data?.data?.result || {}
      all.push(...(Array.isArray(result.list) ? result.list : []))
      const next = String(result.next_page_token || '')
      if (!next || seen.has(next)) break
      seen.add(next)
      pageToken = next
    }
    const latest = new Map()
    for (const item of all) {
      if (Number(item.status) === -1) continue
      const id = String(item.id || item.code || item.name || '')
      if (id && (!latest.has(id) || Number(item.version || 0) > Number(latest.get(id).version || 0))) latest.set(id, item)
    }
    assets.value = [...latest.values()]
  } catch (error) { ElMessage.error(error?.response?.data?.message || '加载资产目录失败') }
  finally { loading.value = false }
}
onMounted(load)
</script>

<style scoped>
.catalog { padding: 18px; border: 1px solid #d8dee4; border-radius: 8px; background: white; }
.toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.platform { width: 210px; }
.count { color: #57606a; white-space: nowrap; }
.search { width: 300px; margin-left: auto; }
.cards { min-height: 280px; }
.asset-card { width: 100%; display: flex; align-items: center; gap: 16px; text-align: left; padding: 16px 20px; background: white; border: 1px solid #d8dee4; border-radius: 6px; color: #24292f; cursor: pointer; margin-bottom: 8px; }
.asset-card:hover { background: #f6f8fa; border-color: #afb8c1; }
.card-main { flex: 1; display: grid; gap: 5px; min-width: 0; }
.card-main small { color: #57606a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.org { color: #57606a; }
.arrow { font-size: 24px; color: #57606a; }
.pagination { justify-content: center; margin-top: 18px; }
.details > div { display: grid; grid-template-columns: 115px 1fr; gap: 16px; padding: 10px 0; border-bottom: 1px solid #d8dee4; color: #24292f; overflow-wrap: anywhere; }
.details > div > span:first-child { color: #57606a; }
.details a { color: #0969da; }
@media (max-width: 700px) { .toolbar { flex-wrap: wrap; } .search { margin-left: 0; width: 100%; } }
</style>
