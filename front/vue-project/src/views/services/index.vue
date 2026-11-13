<template>
  <div class="service-page">
    <section class="page-header">
      <div>
        <p class="eyebrow">系统运维</p>
        <h2 class="page-title">服务管理</h2>
        <span>集中查看和控制系统后台服务。</span>
      </div>
      <el-button plain :disabled="refreshing" @click="refreshServices">
        {{ refreshing ? '刷新中' : '刷新状态' }}
      </el-button>
    </section>

    <section class="summary-strip">
      <div>
        <span>服务总数</span>
        <strong>{{ services.length }}</strong>
      </div>
      <div>
        <span>运行中</span>
        <strong>{{ runningCount }}</strong>
      </div>
      <div>
        <span>健康服务</span>
        <strong>{{ healthyCount }}</strong>
      </div>
      <div>
        <span>异常或停止</span>
        <strong>{{ services.length - healthyCount }}</strong>
      </div>
    </section>

    <section class="service-list">
      <article v-for="service in services" :key="service.key" class="service-row">
        <div class="service-identity">
          <i :class="serviceStatusClass(service)"></i>
          <div>
            <div class="service-name-row">
              <h3>{{ service.name }}</h3>
              <span class="status-label" :class="serviceStatusClass(service)">
                {{ serviceStatusText(service) }}
              </span>
            </div>
            <p>{{ service.description }}</p>
            <code>{{ service.unit }}</code>
          </div>
        </div>

        <dl class="service-meta">
          <div>
            <dt>监听地址</dt>
            <dd>{{ service.endpoint }}</dd>
          </div>
          <div>
            <dt>开机启用</dt>
            <dd>{{ service.enabled ? '已启用' : '未启用' }}</dd>
          </div>
          <div>
            <dt>进程状态</dt>
            <dd>{{ service.active ? '运行中' : '已停止' }}</dd>
          </div>
          <div>
            <dt>健康检查</dt>
            <dd>{{ service.api_ready ? '通过' : '未通过' }}</dd>
          </div>
        </dl>

        <div class="service-actions">
          <div class="switch-control">
            <span>服务开关</span>
            <el-switch
              :model-value="service.active"
              :loading="service.busy"
              inline-prompt
              active-text="开"
              inactive-text="关"
              @change="toggleService(service, $event)"
            />
          </div>
          <el-button plain :disabled="service.busy || !service.active" @click="restartService(service)">
            重启服务
          </el-button>
        </div>
      </article>
    </section>

    <section class="event-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">操作记录</p>
          <h3>本页服务操作</h3>
        </div>
        <span>仅记录当前浏览器会话</span>
      </div>
      <el-table :data="operationLog" stripe height="260" empty-text="暂无服务操作">
        <el-table-column prop="time" label="时间" width="190" />
        <el-table-column prop="service" label="服务" min-width="220" />
        <el-table-column prop="action" label="操作" width="120" />
        <el-table-column label="结果" width="100">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'">
              {{ row.success ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="说明" min-width="260" show-overflow-tooltip />
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const SERVICE_CONTROL_BASE = import.meta.env.VITE_SERVICE_CONTROL_BASE || 'http://127.0.0.1:8001'
const MODEL_API_BASE = import.meta.env.VITE_MODEL_API_BASE || 'http://127.0.0.1:8000'
const CATALOG_API_BASE = import.meta.env.VITE_CATALOG_API_BASE || 'http://127.0.0.1:8008'
const CLASSIFIER_API_BASE = import.meta.env.VITE_CLASSIFIER_API_BASE || 'http://127.0.0.1:8007'
const VALUATION_API_BASE = import.meta.env.VITE_VALUATION_API_BASE || 'http://127.0.0.1:3001'
const FOUNDATION_ENDPOINT =
  import.meta.env.VITE_FOUNDATION_ENDPOINT ||
  '3000 / 8080 / 8090-8091 / 8848-8849 / 9081 / 9092'
const REQUEST_TIMEOUT = 30000
const ACTION_TIMEOUT = 120000
const POLL_INTERVAL_MS = 5000

interface ServiceItem {
  key: string
  name: string
  description: string
  unit: string
  endpoint: string
  statusPath: string
  actionPrefix: string
  active: boolean
  enabled: boolean
  api_ready: boolean
  busy: boolean
  reachable: boolean
}

const refreshing = ref(false)
const pollTimer = ref<number | null>(null)
const operationLog = ref<any[]>([])
const services = reactive<ServiceItem[]>([
  {
    key: 'supervision-model',
    name: '监管模型 API',
    description: '提供账户监管、子图采样、模型推理和 Selected Case 数据接口。',
    unit: 'ada-supervision-model-api.service',
    endpoint: MODEL_API_BASE,
    statusPath: '/api/service/model/status',
    actionPrefix: '/api/service/model',
    active: false,
    enabled: false,
    api_ready: false,
    busy: false,
    reachable: true,
  },
  {
    key: 'foundation',
    name: '基础后端集合',
    description: '统一运行 GoSDK、主 Node 后端、双组织 CA、哈希、证书地址和自动证书服务。',
    unit: 'ada-foundation-backends.service',
    endpoint: FOUNDATION_ENDPOINT,
    statusPath: '/api/service/foundation/status',
    actionPrefix: '/api/service/foundation',
    active: false,
    enabled: false,
    api_ready: false,
    busy: false,
    reachable: true,
  },
  {
    key: 'catalog',
    name: '目录链后端',
    description: '提供目录链智能合约交互、目录查询和链上数据维护接口。',
    unit: 'ada-catalog-chain-api.service',
    endpoint: CATALOG_API_BASE,
    statusPath: '/api/service/catalog/status',
    actionPrefix: '/api/service/catalog',
    active: false,
    enabled: false,
    api_ready: false,
    busy: false,
    reachable: true,
  },
  {
    key: 'classifier',
    name: '敏感数据分类 API',
    description: '提供数字资产分类、分级、RAG 文件分析和 Ollama 模型调用接口。',
    unit: 'ada-sensitive-classifier-api.service',
    endpoint: CLASSIFIER_API_BASE,
    statusPath: '/api/service/classifier/status',
    actionPrefix: '/api/service/classifier',
    active: false,
    enabled: false,
    api_ready: false,
    busy: false,
    reachable: true,
  },
  {
    key: 'valuation',
    name: '资产估值 API',
    description: '保存和查询资产估值记录，并连接估值业务数据库。',
    unit: 'ada-valuation-api.service',
    endpoint: VALUATION_API_BASE,
    statusPath: '/api/service/valuation/status',
    actionPrefix: '/api/service/valuation',
    active: false,
    enabled: false,
    api_ready: false,
    busy: false,
    reachable: true,
  },
])

const runningCount = computed(() => services.filter((service) => service.active).length)
const healthyCount = computed(() => services.filter((service) => service.active && service.api_ready).length)

const refreshServices = async () => {
  if (refreshing.value) return
  refreshing.value = true
  await Promise.all(
    services.map(async (service) => {
      if (service.busy) return
      try {
        const response = await axios.get(`${SERVICE_CONTROL_BASE}${service.statusPath}`, {
          timeout: REQUEST_TIMEOUT,
        })
        Object.assign(service, response.data, { reachable: true })
      } catch (_error) {
        service.reachable = false
      }
    }),
  )
  refreshing.value = false
}

const addLog = (service: string, action: string, success: boolean, message: string) => {
  operationLog.value.unshift({
    time: new Date().toLocaleString('zh-CN', { hour12: false }),
    service,
    action,
    success,
    message,
  })
  operationLog.value = operationLog.value.slice(0, 50)
}

const errorMessage = (error: any) => {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail?.message) return detail.message
  return error?.message || '未知错误'
}

const runAction = async (service: ServiceItem, action: string, actionText: string) => {
  service.busy = true
  try {
    const response = await axios.post(`${SERVICE_CONTROL_BASE}${service.actionPrefix}/${action}`, null, {
      timeout: ACTION_TIMEOUT,
    })
    Object.assign(service, response.data, { reachable: true })
    addLog(service.name, actionText, true, `${actionText}完成，健康检查${service.api_ready ? '通过' : '未通过'}`)
    ElMessage.success(`${service.name}${actionText}成功`)
  } catch (error: any) {
    const message = errorMessage(error)
    addLog(service.name, actionText, false, message)
    ElMessage.error(`${service.name}${actionText}失败：${message}`)
    await refreshServices()
  } finally {
    service.busy = false
  }
}

const toggleService = async (service: ServiceItem, enabled: boolean) => {
  await runAction(service, enabled ? 'start' : 'stop', enabled ? '启动' : '停止')
}

const restartService = async (service: ServiceItem) => {
  await runAction(service, 'restart', '重启')
}

const serviceStatusClass = (service: ServiceItem) => {
  if (!service.reachable) return 'unreachable'
  if (service.active && service.api_ready) return 'healthy'
  if (service.active) return 'warning'
  return 'stopped'
}

const serviceStatusText = (service: ServiceItem) => {
  if (!service.reachable) return '控制端不可达'
  if (service.active && service.api_ready) return '运行正常'
  if (service.active) return '服务启动，健康检查失败'
  return '已停止'
}

onMounted(async () => {
  await refreshServices()
  pollTimer.value = window.setInterval(refreshServices, POLL_INTERVAL_MS)
})

onBeforeUnmount(() => {
  if (pollTimer.value) window.clearInterval(pollTimer.value)
})
</script>

<style scoped lang="scss">
.service-page {
  width: 85%;
  min-height: 100vh;
  margin: 0 auto;
  padding: 16px 20px 24px;
  background: #f5f7fb;
  box-sizing: border-box;
}

.page-header,
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2,
.section-heading h3 {
  margin: 4px 0 0;
}

.page-header span,
.section-heading span {
  color: #687481;
  font-size: 13px;
}

.eyebrow {
  margin: 0;
  color: #397265;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.summary-strip,
.service-list,
.event-section {
  border: 1px solid #dce2e7;
  border-radius: 6px;
  background: #fff;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
}

.summary-strip div {
  padding: 18px;
  border-right: 1px solid #e4e8ec;
}

.summary-strip div:last-child {
  border-right: 0;
}

.summary-strip span,
.summary-strip strong {
  display: block;
}

.summary-strip span {
  color: #6c7782;
  font-size: 13px;
}

.summary-strip strong {
  margin-top: 9px;
  font-size: 25px;
}

.service-list {
  margin-bottom: 16px;
}

.service-row {
  display: grid;
  grid-template-columns: minmax(300px, 1.3fr) minmax(400px, 1.5fr) 190px;
  align-items: center;
  gap: 24px;
  min-height: 180px;
  padding: 22px;
  border-bottom: 1px solid #e4e8ec;
}

.service-row:last-child {
  border-bottom: 0;
}

.service-identity {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 14px;
}

.service-identity > i {
  width: 12px;
  height: 12px;
  margin-top: 7px;
  border-radius: 50%;
  background: #aeb7bf;
}

.service-identity > i.healthy {
  background: #2f806d;
  box-shadow: 0 0 0 5px #dcece8;
}

.service-identity > i.warning {
  background: #bc861f;
  box-shadow: 0 0 0 5px #f5ead0;
}

.service-identity > i.unreachable {
  background: #a83d48;
  box-shadow: 0 0 0 5px #f3dfe1;
}

.service-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.service-name-row h3 {
  margin: 0;
  font-size: 18px;
}

.status-label {
  color: #66727c;
  font-size: 12px;
  font-weight: 700;
}

.status-label.healthy {
  color: #2f665a;
}

.status-label.warning {
  color: #946516;
}

.status-label.unreachable {
  color: #a13c47;
}

.service-identity p {
  margin: 10px 0;
  color: #687481;
  font-size: 13px;
  line-height: 1.6;
}

.service-identity code {
  color: #46545f;
  font-size: 12px;
}

.service-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(150px, 1fr));
  gap: 16px 24px;
  margin: 0;
}

.service-meta dt {
  margin-bottom: 5px;
  color: #77828b;
  font-size: 12px;
}

.service-meta dd {
  overflow: hidden;
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-actions {
  display: flex;
  align-items: stretch;
  flex-direction: column;
  gap: 12px;
}

.switch-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  font-size: 13px;
}

.event-section {
  padding: 18px;
}

@media (max-width: 1200px) {
  .service-page {
    width: 94%;
  }

  .service-row {
    grid-template-columns: 1fr;
  }

  .summary-strip {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
