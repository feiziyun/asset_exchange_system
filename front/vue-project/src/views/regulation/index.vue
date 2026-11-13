<template>
  <div class="regulation-page">
    <section class="page-header">
      <div>
        <p class="eyebrow">自动监管分析平台</p>
        <h2 class="page-title">穿透式账户监管工作台</h2>
        <span>持续发现、排队检测并沉淀账户风险快照。</span>
      </div>
      <div class="header-actions">
        <el-button plain @click="openRemoteAudit">打开远程监管台</el-button>
        <div class="manual-check">
          <el-input
            v-model.trim="manualAddress"
            placeholder="人工补检账户 0x..."
            :disabled="submitting"
            @keyup.enter="submitManualTask"
          />
          <el-button type="primary" :loading="submitting" @click="submitManualTask">
            提交补检
          </el-button>
        </div>
      </div>
    </section>

    <el-alert
      v-if="!serviceStatus.api_ready"
      class="service-warning"
      title="模型 API 当前未运行"
      description="监管数据暂停刷新，可通过下方开关恢复服务。"
      type="warning"
      show-icon
      :closable="false"
    />

    <section class="kpi-grid">
      <article v-for="item in kpis" :key="item.label" class="kpi-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.note }}</small>
      </article>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="section-kicker">自动监管状态</p>
          <h3>监管流水线</h3>
        </div>
        <div class="toolbar">
          <div class="service-control">
            <span>模型 API</span>
            <el-switch
              v-model="modelApiSwitch"
              :loading="serviceActionBusy"
              inline-prompt
              active-text="开"
              inactive-text="关"
              @change="toggleModelApi"
            />
            <b :class="{ online: serviceStatus.api_ready }">
              {{ serviceStatus.api_ready ? '服务正常' : '服务停止' }}
            </b>
          </div>
          <span class="auto-state" :class="autoStatus.status">
            {{ autoStatusText }}
          </span>
          <el-radio-group v-model="autoMode" size="small" :disabled="autoStatus.status === 'running'">
            <el-radio-button value="continuous">持续监管</el-radio-button>
            <el-radio-button value="scan_once">单次扫描</el-radio-button>
          </el-radio-group>
          <el-button plain :disabled="autoActionBusy" @click="discoverAccounts">发现账户</el-button>
          <el-button
            v-if="autoStatus.status !== 'running'"
            type="primary"
            :loading="autoActionBusy"
            @click="startAutoSupervision"
          >
            启动自动监管
          </el-button>
          <el-button
            v-else
            type="danger"
            :loading="autoActionBusy"
            @click="stopAutoSupervision"
          >
            停止自动监管
          </el-button>
        </div>
      </div>

      <div class="agent-grid">
        <div v-for="agent in agentStates" :key="agent.name" class="agent-item">
          <i :class="agent.state"></i>
          <div>
            <strong>{{ agent.name }}</strong>
            <span>{{ agent.description }}</span>
          </div>
          <b>{{ agent.metric }}</b>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="section-kicker">异常检测记录</p>
          <h3>异常账户检测快照</h3>
        </div>
        <span>{{ anomalyRecords.length }} 条</span>
      </div>
      <el-table
        :data="anomalyRecords"
        stripe
        height="280"
        empty-text="暂无异常账户检测记录"
        row-class-name="clickable-row"
        @row-click="openAccountDetail"
      >
        <el-table-column prop="address" label="账户地址" min-width="280" show-overflow-tooltip />
        <el-table-column label="异常类别" width="130">
          <template #default="{ row }">{{ labelText(row.display_label) }}</template>
        </el-table-column>
        <el-table-column label="异常概率" width="120">
          <template #default="{ row }">{{ formatPercent(row.anomaly_probability) }}</template>
        </el-table-column>
        <el-table-column label="风险等级" width="110">
          <template #default="{ row }">{{ riskLevelText(row.risk_level) }}</template>
        </el-table-column>
        <el-table-column prop="num_nodes" label="节点" width="80" />
        <el-table-column prop="num_edges" label="边" width="80" />
        <el-table-column label="检测时间" width="180">
          <template #default="{ row }">{{ formatTime(row.detected_at) }}</template>
        </el-table-column>
        <el-table-column prop="model_version" label="模型版本" min-width="220" show-overflow-tooltip />
      </el-table>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="section-kicker">任务队列</p>
          <h3>正在检测与最近任务</h3>
        </div>
        <el-button plain @click="refreshDashboard">刷新</el-button>
      </div>
      <el-table :data="tasks" stripe height="280" empty-text="暂无检测任务">
        <el-table-column prop="address" label="账户地址" min-width="280" show-overflow-tooltip />
        <el-table-column prop="source" label="来源" width="120">
          <template #default="{ row }">{{ sourceText(row.source) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="taskTagType(row.status)" effect="plain">{{ taskStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="180">
          <template #default="{ row }">
            <el-progress :percentage="Math.round((row.progress || 0) * 100)" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column prop="num_nodes" label="节点" width="80" />
        <el-table-column prop="num_edges" label="边" width="80" />
        <el-table-column label="排队时间" width="180">
          <template #default="{ row }">{{ formatTime(row.queued_at) }}</template>
        </el-table-column>
        <el-table-column label="错误" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.error_message || '-' }}</template>
        </el-table-column>
        <el-table-column label="检测过程" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openTaskProcess(row)">查看过程</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="section-kicker">风险交易提示</p>
          <h3>中高风险交易事件</h3>
        </div>
        <span>{{ riskTransactions.length }} 条</span>
      </div>
      <el-table :data="riskTransactions" stripe height="280" empty-text="暂无风险交易">
        <el-table-column label="等级" width="90">
          <template #default="{ row }">
            <el-tag :type="row.risk_level === 'high' ? 'danger' : 'warning'">
              {{ riskLevelText(row.risk_level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="tx_hash" label="交易哈希" min-width="190" show-overflow-tooltip />
        <el-table-column prop="from_address" label="From" min-width="190" show-overflow-tooltip />
        <el-table-column prop="to_address" label="To" min-width="190" show-overflow-tooltip />
        <el-table-column prop="value" label="金额" width="110" />
        <el-table-column prop="related_account" label="关联异常账户" min-width="190" show-overflow-tooltip />
        <el-table-column label="类别" width="120">
          <template #default="{ row }">{{ labelText(row.related_account_label) }}</template>
        </el-table-column>
        <el-table-column label="风险原因" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ (row.risk_reasons || []).join('；') || '-' }}</template>
        </el-table-column>
        <el-table-column label="处置状态" width="110">
          <template #default="{ row }">{{ row.action_status === 'unhandled' ? '待处置' : row.action_status }}</template>
        </el-table-column>
      </el-table>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="section-kicker">账户状态库</p>
          <h3>已检测账户</h3>
        </div>
        <span>点击账户查看检测快照和交易子图</span>
      </div>
      <el-table
        :data="accounts"
        stripe
        height="360"
        empty-text="暂无已检测账户"
        row-class-name="clickable-row"
        @row-click="openAccountDetail"
      >
        <el-table-column prop="address" label="账户地址" min-width="300" show-overflow-tooltip />
        <el-table-column label="检测类别" width="130">
          <template #default="{ row }">{{ labelText(row.current_label) }}</template>
        </el-table-column>
        <el-table-column label="异常状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.is_anomaly ? 'danger' : 'success'">
              {{ row.is_anomaly ? '异常' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="异常概率" width="120">
          <template #default="{ row }">{{ formatPercent(row.anomaly_probability) }}</template>
        </el-table-column>
        <el-table-column label="风险等级" width="110">
          <template #default="{ row }">{{ riskLevelText(row.risk_level) }}</template>
        </el-table-column>
        <el-table-column prop="detection_count" label="检测次数" width="100" />
        <el-table-column prop="num_nodes" label="节点" width="80" />
        <el-table-column prop="num_edges" label="边" width="80" />
        <el-table-column label="最后检测" width="180">
          <template #default="{ row }">{{ formatTime(row.last_detected_at) }}</template>
        </el-table-column>
      </el-table>
    </section>

    <el-drawer
      v-model="processDrawerVisible"
      size="72%"
      :destroy-on-close="true"
      @closed="closeTaskProcess"
    >
      <template #header>
        <div class="drawer-title">
          <div>
            <p class="section-kicker">检测过程</p>
            <h3>{{ processTask.address || '-' }}</h3>
          </div>
        </div>
      </template>
      <div class="drawer-content">
        <section class="process-steps">
          <div v-for="step in processSteps" :key="step.key" class="step-item" :class="step.state">
            <i></i>
            <div>
              <strong>{{ step.label }}</strong>
              <span>{{ step.description }}</span>
            </div>
          </div>
        </section>

        <section class="process-progress">
          <div class="section-heading compact">
            <div>
              <p class="section-kicker">任务进度</p>
              <h3>{{ taskStatusText(processTask.status) }}</h3>
            </div>
            <div class="progress-summary">
              <span>{{ processProgressText }}</span>
              <b>{{ processVisualProgress }}%</b>
            </div>
          </div>
          <el-progress :percentage="processVisualProgress" :show-text="false" :stroke-width="10" />
        </section>

        <section class="process-result">
          <div class="process-verdict">
            <span>异常类别</span>
            <strong>{{ processCategoryText }}</strong>
          </div>
          <div class="process-verdict">
            <span>异常概率</span>
            <strong>
              {{
                processResultSnapshot.anomaly_probability == null
                  ? '分析中'
                  : formatPercent(processResultSnapshot.anomaly_probability)
              }}
            </strong>
          </div>
          <div class="process-probabilities">
            <div v-for="(value, key) in processResultSnapshot.class_probabilities || {}" :key="key">
              <span>{{ labelText(key) }}</span>
              <b>{{ formatPercent(value) }}</b>
              <el-progress
                :percentage="Math.round((value || 0) * 100)"
                :show-text="false"
                :status="processResultSnapshot.pass_threshold?.[key] ? 'exception' : ''"
              />
            </div>
            <span v-if="!Object.keys(processResultSnapshot.class_probabilities || {}).length" class="result-pending">
              模型完成分析后显示四类账户概率。
            </span>
          </div>
        </section>

        <section class="process-graph-panel">
          <div class="section-heading">
            <div>
              <p class="section-kicker">{{ processShouldAnimate ? '动态构图' : '采样结果' }}</p>
              <h3>{{ processShouldAnimate ? '分析过程中逐步展开节点' : '账户交易子图' }}</h3>
            </div>
            <span>{{ processDisplayedNodes.length }} / {{ processGraphData?.nodes?.length || processTask.num_nodes || 0 }} 节点</span>
          </div>
          <div ref="processGraphRef" class="graph-box"></div>
          <div v-if="!processTask.subgraph_path" class="process-waiting">
            <strong>{{ processTask.status === 'queued' ? '等待采样任务启动' : '正在生成账户交易子图' }}</strong>
            <span>子图文件生成后，节点会以 2.5 秒间隔逐步显示。</span>
          </div>
        </section>
      </div>
    </el-drawer>

    <el-drawer v-model="drawerVisible" size="78%" :destroy-on-close="true" @closed="disposeDetailChart">
      <template #header>
        <div class="drawer-title">
          <div>
            <p class="section-kicker">账户详情</p>
            <h3>{{ detailAddress }}</h3>
          </div>
          <el-button plain :disabled="submitting" @click="rescanDetail">重新检测</el-button>
        </div>
      </template>
      <div v-loading="detailLoading" class="drawer-content">
        <section class="detail-summary">
          <div>
            <span>当前类别</span>
            <strong>{{ labelText(detailState.current_label) }}</strong>
          </div>
          <div>
            <span>异常概率</span>
            <strong>{{ formatPercent(detailState.anomaly_probability) }}</strong>
          </div>
          <div>
            <span>风险等级</span>
            <strong>{{ riskLevelText(detailState.risk_level) }}</strong>
          </div>
          <div>
            <span>子图规模</span>
            <strong>{{ detailState.num_nodes || 0 }} / {{ detailState.num_edges || 0 }}</strong>
          </div>
          <div>
            <span>模型版本</span>
            <strong>{{ detailState.last_model_version || '-' }}</strong>
          </div>
        </section>

        <section class="detail-grid">
          <div class="graph-panel">
            <div class="section-heading">
              <h3>账户交易关系子图</h3>
              <span>{{ graphSummary }}</span>
            </div>
            <div ref="detailGraphRef" class="graph-box detail-box"></div>
            <p v-if="!detailState.subgraph_path && !detailLoading" class="empty-hint">该账户暂无可用子图。</p>
          </div>

          <aside class="probability-panel">
            <h3>分类结果</h3>
            <div v-for="(value, key) in detailSnapshot.class_probabilities || {}" :key="key" class="probability-row">
              <div>
                <span>{{ labelText(key) }}</span>
                <b>{{ formatPercent(value) }}</b>
              </div>
              <el-progress
                :percentage="Math.round((value || 0) * 100)"
                :show-text="false"
                :status="detailSnapshot.pass_threshold?.[key] ? 'exception' : ''"
              />
            </div>
            <h3>目标账户摘要</h3>
            <dl>
              <dt>入账次数</dt><dd>{{ formatNumber(anchorSummary.inCount) }}</dd>
              <dt>出账次数</dt><dd>{{ formatNumber(anchorSummary.outCount) }}</dd>
              <dt>入账金额</dt><dd>{{ formatCompact(anchorSummary.inAmount) }}</dd>
              <dt>出账金额</dt><dd>{{ formatCompact(anchorSummary.outAmount) }}</dd>
            </dl>
          </aside>
        </section>

        <section class="panel inner-panel">
          <div class="section-heading">
            <h3>目标账户关联交易</h3>
            <span>{{ detailTransactions.length }} 条</span>
          </div>
          <el-table :data="detailTransactions" stripe height="260" empty-text="暂无交易边">
            <el-table-column prop="direction" label="方向" width="90" />
            <el-table-column prop="from" label="From" min-width="220" show-overflow-tooltip />
            <el-table-column prop="to" label="To" min-width="220" show-overflow-tooltip />
            <el-table-column prop="count" label="次数" width="90" />
            <el-table-column prop="amount" label="金额" width="140" />
            <el-table-column prop="fee" label="手续费" width="120" />
          </el-table>
        </section>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import axios from '@/http/index.js'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const MODEL_API_BASE = '/api/regulator/model'
const SERVICE_CONTROL_BASE = '/api/regulator/control'
const REMOTE_AUDIT_URL = import.meta.env.VITE_REMOTE_AUDIT_URL || 'http://127.0.0.1:8081'
const POLL_INTERVAL_MS = 5000
const GET_TIMEOUT = 30000
const POST_TIMEOUT = 120000
const GRAPH_NODE_REVEAL_MS = 2500
const INFERENCE_DURATION_MS = 5500

const overview = ref<Record<string, any>>({})
const tasks = ref<any[]>([])
const anomalyRecords = ref<any[]>([])
const accounts = ref<any[]>([])
const riskTransactions = ref<any[]>([])
const autoStatus = ref<Record<string, any>>({ status: 'stopped' })
const autoMode = ref('continuous')
const serviceStatus = ref<Record<string, any>>({ status: 'stopped', active: false, api_ready: false })
const modelApiSwitch = ref(false)
const manualAddress = ref('')
const submitting = ref(false)
const autoActionBusy = ref(false)
const serviceActionBusy = ref(false)
const refreshing = ref(false)

const drawerVisible = ref(false)
const detailLoading = ref(false)
const detailAddress = ref('')
const detail = ref<Record<string, any>>({})
const detailGraphData = ref<any>(null)
const detailTransactions = ref<any[]>([])

const processDrawerVisible = ref(false)
const processTask = ref<Record<string, any>>({})
const processGraphData = ref<any>(null)
const processResultDetail = ref<Record<string, any>>({})
const processDisplayedNodes = ref<any[]>([])
const processDisplayedLinks = ref<any[]>([])
const processInferenceProgress = ref(0)
const processGraphLoadedPath = ref('')

const processGraphRef = ref<HTMLDivElement | null>(null)
const detailGraphRef = ref<HTMLDivElement | null>(null)

let pollingTimer: number | null = null
let processAnimationTimer: number | null = null
let processProgressTimer: number | null = null
let processChart: echarts.ECharts | null = null
let detailChart: echarts.ECharts | null = null

const kpis = computed(() => [
  { label: '已检测账户数', value: overview.value.detected_accounts || 0, note: '账户状态库' },
  { label: '异常账户数', value: overview.value.anomaly_accounts || 0, note: '通过分类阈值' },
  { label: '异常账户占比', value: formatPercent(overview.value.anomaly_ratio), note: '异常 / 已检测' },
  { label: '正在检测账户数', value: overview.value.running_tasks || 0, note: '采样、推理或保存' },
  { label: '待检测账户数', value: overview.value.pending_tasks || 0, note: '任务队列' },
  { label: '高风险交易数', value: overview.value.high_risk_transactions || 0, note: '待监管处置' },
])

const agentStates = computed(() => {
  const running = autoStatus.value.status === 'running'
  return [
    {
      name: 'Observer',
      state: running ? 'active' : 'idle',
      description: running ? '正在发现预生成子图账户' : '等待启动自动发现',
      metric: `${overview.value.pending_tasks || 0} 待检`,
    },
    {
      name: 'Analysis',
      state: (overview.value.running_tasks || 0) > 0 ? 'active' : 'idle',
      description: '执行子图采样与异常模型推理',
      metric: `${overview.value.running_tasks || 0} 运行`,
    },
    {
      name: 'Governance',
      state: (overview.value.high_risk_transactions || 0) > 0 ? 'warning' : 'idle',
      description: '汇总异常账户和风险交易事件',
      metric: `${overview.value.high_risk_transactions || 0} 高风险`,
    },
  ]
})

const autoStatusText = computed(() => {
  if (autoStatus.value.status === 'running') {
    return autoStatus.value.mode === 'scan_once' ? '单次扫描执行中' : '持续监管运行中'
  }
  if (autoStatus.value.completion_reason === 'scan_completed') return '单次扫描已完成'
  return '自动监管已停止'
})

const processSteps = computed(() => {
  const order = ['queued', 'sampling', 'inferencing', 'saving', 'done']
  const currentIndex = order.indexOf(processTask.value.status)
  const failed = processTask.value.status === 'failed'
  return [
    { key: 'sampling', label: '子图采样', description: '提取目标账户交易邻域', index: 1 },
    { key: 'drawing', label: '动态构图', description: '逐步展开节点和交易关系', index: 2 },
    { key: 'inferencing', label: '模型分析', description: '执行四类异常账户检测', index: 2 },
    { key: 'saving', label: '结果保存', description: '写入快照和账户状态', index: 3 },
  ].map((step) => ({
    ...step,
    state: failed ? 'failed' : currentIndex > step.index ? 'done' : currentIndex === step.index ? 'active' : 'pending',
  }))
})

const processVisualProgress = computed(() => {
  if (processInferenceProgress.value > 0 && processInferenceProgress.value < 100) {
    return Math.max(65, Math.round(65 + processInferenceProgress.value * 0.25))
  }
  return Math.round((processTask.value.progress || 0) * 100)
})

const processProgressText = computed(() => {
  if (processInferenceProgress.value > 0 && processInferenceProgress.value < 100) {
    return '模型正在分析账户行为特征'
  }
  return {
    queued: '任务等待执行',
    sampling: '正在采样账户交易子图',
    inferencing: '正在执行异常模型分析',
    saving: '正在保存检测结果',
    done: '检测与结果保存已完成',
    failed: processTask.value.error_message || '检测任务失败',
  }[processTask.value.status] || '等待任务状态'
})

const processShouldAnimate = computed(() => ['sampling', 'inferencing', 'saving'].includes(processTask.value.status))
const processResultSnapshot = computed(() => processResultDetail.value.latest_snapshot || {})
const processCategoryText = computed(() => {
  const snapshot = processResultSnapshot.value
  if (!snapshot.pred_label) return '模型分析中'
  return snapshot.is_anomaly ? `${labelText(snapshot.display_label || snapshot.pred_label)}（异常）` : '正常账户'
})

const detailState = computed(() => detail.value.current_state || {})
const detailSnapshot = computed(() => detail.value.latest_snapshot || {})
const graphSummary = computed(() => {
  const summary = detailGraphData.value?.summary
  if (!summary) return '等待加载'
  return `${summary.num_nodes_returned} 节点 / ${summary.num_links_returned} 边`
})
const anchorSummary = computed(() => {
  const node = findNodeByAddress(detailAddress.value)
  const raw = node?.raw || {}
  return {
    inCount: raw.N_in_cnt || 0,
    outCount: raw.N_out_cnt || 0,
    inAmount: raw.N_in_sum_amt || 0,
    outAmount: raw.N_out_sum_amt || 0,
  }
})

const openRemoteAudit = () => {
  window.open(REMOTE_AUDIT_URL, '_blank')
}

const refreshDashboard = async () => {
  if (refreshing.value) return
  refreshing.value = true
  const requests = [
    axios.get(`${MODEL_API_BASE}/api/supervision/overview`, { timeout: GET_TIMEOUT }),
    axios.get(`${MODEL_API_BASE}/api/supervision/tasks`, { params: { page: 1, page_size: 50 }, timeout: GET_TIMEOUT }),
    axios.get(`${MODEL_API_BASE}/api/supervision/anomaly-records`, { params: { page: 1, page_size: 100 }, timeout: GET_TIMEOUT }),
    axios.get(`${MODEL_API_BASE}/api/supervision/accounts`, { params: { page: 1, page_size: 100 }, timeout: GET_TIMEOUT }),
    axios.get(`${MODEL_API_BASE}/api/supervision/risk-transactions`, { params: { page: 1, page_size: 50 }, timeout: GET_TIMEOUT }),
    axios.get(`${MODEL_API_BASE}/api/supervision/auto/status`, { timeout: GET_TIMEOUT }),
    axios.get(`${SERVICE_CONTROL_BASE}/api/service/model/status`, { timeout: GET_TIMEOUT }),
  ]
  const [overviewRes, tasksRes, anomalyRes, accountsRes, risksRes, autoRes, serviceRes] = await Promise.allSettled(requests)
  if (overviewRes.status === 'fulfilled') overview.value = overviewRes.value.data
  if (tasksRes.status === 'fulfilled') {
    tasks.value = tasksRes.value.data.items || []
    syncProcessTask()
  }
  if (anomalyRes.status === 'fulfilled') anomalyRecords.value = anomalyRes.value.data.items || []
  if (accountsRes.status === 'fulfilled') accounts.value = accountsRes.value.data.items || []
  if (risksRes.status === 'fulfilled') riskTransactions.value = risksRes.value.data.items || []
  if (autoRes.status === 'fulfilled') {
    autoStatus.value = autoRes.value.data
    if (autoRes.value.data.mode) autoMode.value = autoRes.value.data.mode
  }
  if (serviceRes.status === 'fulfilled') {
    serviceStatus.value = serviceRes.value.data
    modelApiSwitch.value = Boolean(serviceRes.value.data.active)
  }
  refreshing.value = false
}

const toggleModelApi = async (enabled: boolean) => {
  serviceActionBusy.value = true
  try {
    const action = enabled ? 'start' : 'stop'
    const response = await axios.post(`${SERVICE_CONTROL_BASE}/api/service/model/${action}`, null, { timeout: POST_TIMEOUT })
    serviceStatus.value = response.data
    modelApiSwitch.value = Boolean(response.data.active)
    ElMessage.success(enabled ? '模型 API 已启动' : '模型 API 已停止')
    if (enabled) await refreshDashboard()
  } catch (error: any) {
    modelApiSwitch.value = !enabled
    ElMessage.error(errorMessage(error, '模型 API 操作失败'))
  } finally {
    serviceActionBusy.value = false
  }
}

const submitManualTask = async () => {
  const address = manualAddress.value.trim().toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    ElMessage.warning('请输入有效的以太坊账户地址')
    return
  }
  submitting.value = true
  try {
    const response = await axios.post(
      `${MODEL_API_BASE}/api/supervision/tasks`,
      { address, source: 'manual', force: false },
      { timeout: POST_TIMEOUT },
    )
    ElMessage.success(`任务已创建：${response.data.task_id}`)
    manualAddress.value = ''
    await refreshDashboard()
  } catch (error: any) {
    ElMessage.error(errorMessage(error, '补检任务创建失败'))
  } finally {
    submitting.value = false
  }
}

const runAutoAction = async (path: string, successMessage: string) => {
  autoActionBusy.value = true
  try {
    const response = await axios.post(`${MODEL_API_BASE}${path}`, null, { timeout: POST_TIMEOUT })
    const queued = response.data.queued
    ElMessage.success(queued === undefined ? successMessage : `${successMessage}，新增 ${queued} 个任务`)
    await refreshDashboard()
  } catch (error: any) {
    ElMessage.error(errorMessage(error, '自动监管操作失败'))
  } finally {
    autoActionBusy.value = false
  }
}

const discoverAccounts = async () => runAutoAction('/api/supervision/auto/discover-prebuilt?limit=50', '账户发现已执行')
const startAutoSupervision = async () =>
  runAutoAction(
    `/api/supervision/auto/start?mode=${autoMode.value}&limit=50&interval_seconds=60`,
    autoMode.value === 'continuous' ? '持续监管已启动' : '单次扫描已启动',
  )
const stopAutoSupervision = async () => runAutoAction('/api/supervision/auto/stop', '自动监管已停止')

const openAccountDetail = async (row: any) => {
  drawerVisible.value = true
  detailLoading.value = true
  detailAddress.value = row.address
  detail.value = {}
  detailGraphData.value = null
  detailTransactions.value = []
  try {
    const response = await axios.get(`${MODEL_API_BASE}/api/supervision/accounts/${encodeURIComponent(row.address)}`, {
      timeout: GET_TIMEOUT,
    })
    detail.value = response.data
    const path = detail.value.current_state?.subgraph_path
    if (path) await loadDetailGraph(path, row.address)
  } catch (error: any) {
    ElMessage.error(errorMessage(error, '账户详情加载失败'))
  } finally {
    detailLoading.value = false
  }
}

const openTaskProcess = async (row: any) => {
  closeTaskProcess()
  processTask.value = { ...row }
  processDrawerVisible.value = true
  if (row.status === 'done') await loadProcessResult(row.address)
  if (row.subgraph_path) await loadProcessGraph(row.subgraph_path, row.address)
}

const syncProcessTask = () => {
  if (!processDrawerVisible.value || !processTask.value.task_id) return
  const updated = tasks.value.find((task) => task.task_id === processTask.value.task_id)
  if (!updated) return
  const previousStatus = processTask.value.status
  processTask.value = { ...updated }
  if (updated.subgraph_path && updated.subgraph_path !== processGraphLoadedPath.value) {
    loadProcessGraph(updated.subgraph_path, updated.address)
  }
  if (updated.status === 'done' && previousStatus !== 'done') {
    showCompleteProcessGraph()
    loadProcessResult(updated.address)
  }
}

const loadProcessResult = async (address: string) => {
  try {
    const response = await axios.get(`${MODEL_API_BASE}/api/supervision/accounts/${encodeURIComponent(address)}`, {
      timeout: GET_TIMEOUT,
    })
    processResultDetail.value = response.data
  } catch (error: any) {
    ElMessage.error(errorMessage(error, '检测概率结果加载失败'))
  }
}

const loadProcessGraph = async (filePath: string, address: string) => {
  processGraphLoadedPath.value = filePath
  try {
    const response = await axios.post(
      `${MODEL_API_BASE}/api/subgraph/echarts`,
      { file_path: filePath, anchor_address: address, max_nodes: 24, max_links: 72 },
      { timeout: POST_TIMEOUT },
    )
    processGraphData.value = response.data
    processDisplayedNodes.value = []
    processDisplayedLinks.value = []
    await nextTick()
    initProcessChart()
    if (processShouldAnimate.value) {
      animateProcessGraph()
    } else {
      showCompleteProcessGraph()
    }
  } catch (error: any) {
    processGraphLoadedPath.value = ''
    ElMessage.error(errorMessage(error, '检测过程子图加载失败'))
  }
}

const initProcessChart = () => {
  if (!processGraphRef.value) return
  disposeProcessChart()
  processChart = echarts.init(processGraphRef.value)
  renderProcessGraph()
}

const renderProcessGraph = () => {
  if (!processChart || !processGraphData.value) return
  processChart.setOption(
    {
      tooltip: { trigger: 'item' },
      legend: [{ data: (processGraphData.value.categories || []).map((item: any) => item.name), bottom: 8 }],
      animationDurationUpdate: 800,
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          data: processDisplayedNodes.value,
          links: processDisplayedLinks.value,
          categories: processGraphData.value.categories || [],
          label: { show: false },
          emphasis: { focus: 'adjacency', label: { show: true } },
          lineStyle: { color: 'source', curveness: 0.08, opacity: 0.58 },
          force: { repulsion: 130, edgeLength: [65, 130], gravity: 0.08 },
        },
      ],
    },
    true,
  )
}

const animateProcessGraph = () => {
  clearProcessTimers()
  const nodes = processGraphData.value?.nodes || []
  const links = processGraphData.value?.links || []
  if (!nodes.length) return
  let index = 0
  const revealNext = () => {
    processDisplayedNodes.value = nodes.slice(0, index + 1)
    const visibleIds = new Set(processDisplayedNodes.value.map((node: any) => String(node.id || node.name)))
    processDisplayedLinks.value = links.filter(
      (link: any) => visibleIds.has(String(link.source)) && visibleIds.has(String(link.target)),
    )
    renderProcessGraph()
    index += 1
    if (index >= nodes.length) {
      if (processAnimationTimer) window.clearInterval(processAnimationTimer)
      processAnimationTimer = null
      startProcessInferenceAnimation()
    }
  }
  revealNext()
  if (nodes.length > 1) processAnimationTimer = window.setInterval(revealNext, GRAPH_NODE_REVEAL_MS)
}

const showCompleteProcessGraph = () => {
  clearProcessTimers()
  processInferenceProgress.value = 100
  processDisplayedNodes.value = processGraphData.value?.nodes || []
  processDisplayedLinks.value = processGraphData.value?.links || []
  renderProcessGraph()
}

const startProcessInferenceAnimation = () => {
  processInferenceProgress.value = 1
  const tickMs = 110
  const increment = 100 / (INFERENCE_DURATION_MS / tickMs)
  processProgressTimer = window.setInterval(() => {
    processInferenceProgress.value = Math.min(100, processInferenceProgress.value + increment)
    if (processInferenceProgress.value >= 100 && processProgressTimer) {
      window.clearInterval(processProgressTimer)
      processProgressTimer = null
    }
  }, tickMs)
}

const clearProcessTimers = () => {
  if (processAnimationTimer) window.clearInterval(processAnimationTimer)
  if (processProgressTimer) window.clearInterval(processProgressTimer)
  processAnimationTimer = null
  processProgressTimer = null
}

const closeTaskProcess = () => {
  clearProcessTimers()
  disposeProcessChart()
  processTask.value = {}
  processGraphData.value = null
  processResultDetail.value = {}
  processDisplayedNodes.value = []
  processDisplayedLinks.value = []
  processInferenceProgress.value = 0
  processGraphLoadedPath.value = ''
}

const disposeProcessChart = () => {
  if (processChart) {
    processChart.dispose()
    processChart = null
  }
}

const resizeProcessChart = () => {
  if (processChart) processChart.resize()
}

const loadDetailGraph = async (filePath: string, address: string) => {
  const response = await axios.post(
    `${MODEL_API_BASE}/api/subgraph/echarts`,
    { file_path: filePath, anchor_address: address, max_nodes: 600, max_links: 1500 },
    { timeout: POST_TIMEOUT },
  )
  detailGraphData.value = response.data
  detailTransactions.value = buildTransactionRows(response.data.links || [], address)
  await nextTick()
  renderDetailGraph()
}

const renderDetailGraph = () => {
  if (!detailGraphRef.value || !detailGraphData.value) return
  disposeDetailChart()
  detailChart = echarts.init(detailGraphRef.value)
  const series = {
    ...(detailGraphData.value.series?.[0] || {}),
    data: detailGraphData.value.nodes || [],
    links: detailGraphData.value.links || [],
    categories: detailGraphData.value.categories || [],
    label: { show: false },
    emphasis: { focus: 'adjacency', label: { show: true } },
    lineStyle: { color: 'source', curveness: 0.08, opacity: 0.55 },
    force: { repulsion: 125, edgeLength: [60, 130], gravity: 0.08 },
  }
  detailChart.setOption(
    {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) =>
          params.dataType === 'node'
            ? `${params.name}<br/>连接度：${params.value || 0}`
            : `${params.data.source} → ${params.data.target}<br/>金额：${formatCompact(params.data.value)}`,
      },
      legend: [{ data: (detailGraphData.value.categories || []).map((item: any) => item.name), bottom: 8 }],
      animationDurationUpdate: 600,
      series: [series],
    },
    true,
  )
}

const rescanDetail = async () => {
  manualAddress.value = detailAddress.value
  await submitManualTask()
}

const buildTransactionRows = (links: any[], address: string) => {
  const target = String(address || '').toLowerCase()
  return links
    .filter((link) => String(link.source).toLowerCase() === target || String(link.target).toLowerCase() === target)
    .slice(0, 100)
    .map((link) => ({
      direction: String(link.target).toLowerCase() === target ? '转入' : '转出',
      from: link.source,
      to: link.target,
      count: formatNumber(link.raw?.E_cnt || 0),
      amount: formatCompact(link.raw?.E_sum_amt || link.value || 0),
      fee: formatCompact(link.raw?.E_sum_fee || 0),
    }))
}

const findNodeByAddress = (address: string) => {
  const target = String(address || '').toLowerCase()
  return (detailGraphData.value?.nodes || []).find(
    (node: any) => String(node.id || node.name).toLowerCase() === target,
  )
}

const disposeDetailChart = () => {
  if (detailChart) {
    detailChart.dispose()
    detailChart = null
  }
}

const resizeDetailChart = () => {
  if (detailChart) detailChart.resize()
}

const taskTagType = (status: string) => {
  if (status === 'done') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'queued') return 'info'
  return 'warning'
}

const taskStatusText = (status: string) =>
  (
    {
      queued: '等待检测',
      sampling: '子图采样',
      inferencing: '模型推理',
      saving: '保存结果',
      done: '已完成',
      failed: '失败',
    } as Record<string, string>
  )[status] || status || '-'

const sourceText = (source: string) =>
  (
    {
      manual: '人工补检',
      prebuilt: '自动发现',
      watchlist: '观察名单',
      transaction_stream: '交易流',
      risk_expand: '风险扩展',
      external_label: '外部标签',
    } as Record<string, string>
  )[source] || source || '-'

const labelText = (label: string) =>
  (
    {
      normal: '正常',
      exchange: '交易所',
      ico_wallet: 'ICO 钱包',
      mining: '挖矿账户',
      phish_hack: '钓鱼/黑客',
    } as Record<string, string>
  )[label] || label || '-'

const riskLevelText = (level: string) =>
  (
    {
      high: '高风险',
      medium: '中风险',
      low: '低风险',
      normal: '正常',
      unknown: '未知',
    } as Record<string, string>
  )[level] || level || '-'

function formatPercent(value: any) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '0.00%'
}

function formatNumber(value: any) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '0'
}

function formatCompact(value: any) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 2 }).format(number)
}

function formatTime(value: any) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function errorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail?.message) return detail.message
  return error?.message || fallback
}

onMounted(() => {
  refreshDashboard()
  pollingTimer = window.setInterval(refreshDashboard, POLL_INTERVAL_MS)
  window.addEventListener('resize', resizeDetailChart)
  window.addEventListener('resize', resizeProcessChart)
})

onBeforeUnmount(() => {
  if (pollingTimer) window.clearInterval(pollingTimer)
  window.removeEventListener('resize', resizeDetailChart)
  window.removeEventListener('resize', resizeProcessChart)
  disposeDetailChart()
  closeTaskProcess()
})
</script>

<style scoped lang="scss">
.regulation-page {
  max-width: 1720px;
  margin: 0 auto;
  padding: 18px 22px 28px;
  background: #f5f7fb;
  min-height: calc(100vh - 140px);
}

.page-header,
.section-heading,
.drawer-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-header {
  margin-bottom: 16px;
}

.eyebrow,
.section-kicker {
  margin: 0 0 6px;
  color: #5f6f92;
  font-size: 12px;
  letter-spacing: 0;
}

h2,
h3,
p {
  margin: 0;
}

.page-header h2,
.drawer-title h3 {
  color: #1f2328;
}

.page-header span,
.section-heading span {
  color: var(--app-text-secondary);
  font-size: 13px;
}

.header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  min-width: 420px;
}

.manual-check {
  display: flex;
  gap: 10px;
  width: 100%;
}

.service-warning {
  margin-bottom: 16px;
}

:deep(.clickable-row) {
  cursor: pointer;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.kpi-card,
.panel,
.process-result,
.process-progress,
.process-graph-panel,
.detail-summary,
.probability-panel {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(12, 46, 117, 0.06);
}

.kpi-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kpi-card span,
.kpi-card small {
  color: var(--app-text-secondary);
  font-size: 12px;
}

.kpi-card strong {
  font-size: 26px;
  color: #1f2328;
}

.panel {
  padding: 16px;
  margin-bottom: 16px;
}

.toolbar,
.service-control {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.service-control b {
  color: #b42318;
  font-weight: 600;
}

.service-control b.online {
  color: #067647;
}

.auto-state {
  padding: 4px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3551b5;
  font-size: 12px;
  font-weight: 600;
}

.auto-state.running {
  background: #ecfdf3;
  color: #067647;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.agent-item {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid #ebeff5;
  border-radius: 8px;
}

.agent-item i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #98a2b3;
}

.agent-item i.active {
  background: #12b76a;
}

.agent-item i.warning {
  background: #f79009;
}

.agent-item strong {
  display: block;
  color: #1f2328;
}

.agent-item span {
  color: var(--app-text-secondary);
  font-size: 12px;
}

.agent-item b {
  color: #1f2328;
}

:deep(.clickable-row) {
  cursor: pointer;
}

.drawer-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.process-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.step-item {
  display: flex;
  gap: 10px;
  padding: 14px;
  border: 1px solid #e8edf5;
  border-radius: 8px;
}

.step-item i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 5px;
  background: #c7d0e0;
}

.step-item.active i {
  background: #3551b5;
}

.step-item.done i {
  background: #12b76a;
}

.step-item.failed i {
  background: #d92d20;
}

.step-item strong {
  display: block;
  color: #1f2328;
  margin-bottom: 4px;
}

.step-item span {
  color: var(--app-text-secondary);
  font-size: 12px;
}

.process-progress,
.process-result,
.process-graph-panel {
  padding: 16px;
}

.compact {
  margin-bottom: 12px;
}

.progress-summary {
  text-align: right;
}

.progress-summary span {
  display: block;
  margin-bottom: 4px;
}

.process-result {
  display: grid;
  grid-template-columns: 180px 180px 1fr;
  gap: 16px;
}

.process-verdict {
  padding: 14px;
  border: 1px solid #edf1f7;
  border-radius: 8px;
}

.process-verdict span {
  display: block;
  font-size: 12px;
  color: var(--app-text-secondary);
  margin-bottom: 8px;
}

.process-verdict strong {
  color: #1f2328;
  font-size: 18px;
}

.process-probabilities {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.process-probabilities div {
  display: grid;
  grid-template-columns: 90px 88px 1fr;
  align-items: center;
  gap: 10px;
}

.result-pending,
.empty-hint {
  color: var(--app-text-secondary);
  font-size: 13px;
}

.graph-box {
  width: 100%;
  height: 420px;
}

.detail-box {
  height: 520px;
}

.process-waiting {
  margin-top: 10px;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.process-waiting strong {
  display: block;
  color: #1f2328;
  margin-bottom: 6px;
}

.detail-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
}

.detail-summary span {
  display: block;
  margin-bottom: 6px;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.detail-summary strong {
  color: #1f2328;
  font-size: 18px;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
}

.graph-panel,
.probability-panel {
  padding: 16px;
}

.probability-panel h3 {
  margin-bottom: 12px;
  color: #1f2328;
}

.probability-row {
  margin-bottom: 12px;
}

.probability-row > div {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #57606a;
  font-size: 13px;
}

.probability-panel dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px 12px;
  margin: 0;
}

.probability-panel dt,
.probability-panel dd {
  margin: 0;
  font-size: 13px;
}

.probability-panel dt {
  color: var(--app-text-secondary);
}

.probability-panel dd {
  color: #1f2328;
  font-weight: 600;
}

.inner-panel {
  margin-bottom: 0;
}

@media (max-width: 1440px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .detail-grid,
  .process-result {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 980px) {
  .regulation-page {
    padding: 14px;
  }

  .page-header,
  .section-heading,
  .drawer-title,
  .manual-check,
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    min-width: 0;
  }

  .kpi-grid,
  .agent-grid,
  .process-steps,
  .detail-summary {
    grid-template-columns: 1fr;
  }
}
</style>
