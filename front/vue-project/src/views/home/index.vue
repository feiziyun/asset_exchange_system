<template>
  <div class="home-page" v-loading="loading">
    <h2 class="dashboard-title">数据面板</h2>

    <section class="dashboard dashboard-new">
      <article class="dashboard-item summary-card">
        <div class="summary-top">
          <div class="summary-title">
            <h3>交易概览</h3>
            <img :src="transactionIcon" alt="transaction" class="dashboard-icon" />
          </div>

          <div class="main-trade">
            <div class="main-number">{{ todayTransactionVolume }}</div>
            <div class="main-label">今日交易量</div>
          </div>

          <div class="trade-sub">
            <div class="trade-box">
              <span>总交易量</span>
              <strong>{{ totalTransactionVolume }}</strong>
            </div>
            <div class="trade-box">
              <span>最大单日处理量</span>
              <strong>{{ maxDailyTransactionVolume }}</strong>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="summary-bottom">
          <div class="summary-title">
            <h3>系统运行概览</h3>
          </div>

          <div class="system-grid">
            <div class="system-box">
              <div class="system-title">
                <span>交易 TPS</span>
                <button class="refresh-btn" :disabled="tpsLoading" @click="fetchTPS">
                  {{ tpsLoading ? '刷新中' : '刷新' }}
                </button>
              </div>
              <strong>{{ currentTPS }}</strong>
            </div>

            <div class="system-box">
              <span>监管账户</span>
              <strong>{{ detectedAccounts }}</strong>
              <small>{{ anomalyAccountRatio }}</small>
            </div>

            <div class="system-box">
              <span>审计交易</span>
              <strong>{{ auditedTransactions }}</strong>
            </div>
          </div>
        </div>
      </article>

      <article class="dashboard-item industry-card">
        <div class="summary-title">
          <h3>领域交易数量</h3>
          <img :src="auditedIcon" alt="industry" class="dashboard-icon" />
        </div>

        <div class="industry-grid">
          <div v-for="item in displayIndustryStats" :key="item.industryName" class="industry-chip">
            <span class="industry-name">{{ item.industryName }}</span>
            <span class="industry-count">{{ item.count }}</span>
          </div>
        </div>
      </article>
    </section>

    <section class="sales-details">
      <h3>交易历史</h3>
      <div ref="historyChartRef" class="line-chart-container"></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import axios from '@/http/index.js'
import * as echarts from 'echarts'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import transactionIcon from '@/assets/img/transaction-icon.png'
import auditedIcon from '@/assets/img/audited-icon.png'
import { getChainTPS, getHomeStats } from '@/api/asset'
import { getTodayTransactionStats, getTotalTransactionStats, getTransactionHistory, getIndustryTransactionStats } from '@/api/regulatorDashboard'
import { getRoleKey, parseTokenPayload } from '@/utils/auth'

interface IndustryStatItem {
  industryName: string
  count: number
}

interface TransactionHistoryItem {
  date?: string
  transaction_count?: number
  sum_price?: number
}

const MODEL_API_BASE = '/api/regulator/model'
const isRegulator = getRoleKey(parseTokenPayload()?.identity || '') === 'regulator'
const isAdmin = getRoleKey(parseTokenPayload()?.identity || '') === 'admin'

const loading = ref(false)
const tpsLoading = ref(false)
const todayTransactionVolume = ref(0)
const totalTransactionVolume = ref(0)
const maxDailyTransactionVolume = ref(0)
const auditedTransactions = ref(0)
const currentTPS = ref('--')
const detectedAccounts = ref(0)
const anomalyAccountRatio = ref('0.00%')
const industryStats = ref<IndustryStatItem[]>([])
const transactionHistory = ref<TransactionHistoryItem[]>([])
const historyChartRef = ref<HTMLDivElement | null>(null)

let historyChart: echarts.ECharts | null = null

const displayIndustryStats = computed(() =>
  industryStats.value.filter((item) => item.industryName && item.industryName !== '未分类'),
)

const renderHistoryChart = async () => {
  await nextTick()
  if (!historyChartRef.value) return
  historyChart = historyChart || echarts.init(historyChartRef.value)
  historyChart.setOption({
    color: ['#3b82f6', '#ef4444'],
    tooltip: { trigger: 'axis' },
    legend: {
      top: 6,
      textStyle: { color: '#4b5563' },
    },
    grid: {
      left: 54,
      right: 56,
      top: 48,
      bottom: 36,
    },
    xAxis: {
      type: 'category',
      data: transactionHistory.value.map((item) =>
        item.date ? new Date(item.date).toLocaleDateString('zh-CN') : '-',
      ),
      axisLine: { lineStyle: { color: '#d7deeb' } },
      axisLabel: { color: '#667085' },
    },
    yAxis: [
      {
        type: 'value',
        name: '交易数量',
        minInterval: 1,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#eef2f7' } },
        axisLabel: { color: '#667085' },
      },
      {
        type: 'value',
        name: '交易总额（¥）',
        axisLine: { show: false },
        splitLine: { show: false },
        axisLabel: { color: '#667085' },
      },
    ],
    series: [
      {
        name: '交易数量',
        type: 'line',
        smooth: true,
        data: transactionHistory.value.map((item) => Number(item.transaction_count || 0)),
        areaStyle: { opacity: 0.12 },
      },
      {
        name: '交易总额',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: transactionHistory.value.map((item) => Number(item.sum_price || 0)),
      },
    ],
  })
}

const fetchTPS = async () => {
  tpsLoading.value = true
  try {
    const response = await getChainTPS()
    const tps = Number(response?.data?.tps)
    currentTPS.value = response?.data?.success && response.data.tps != null && Number.isFinite(tps)
      ? tps.toFixed(2)
      : '--'
  } catch (_error) {
    currentTPS.value = '--'
  } finally {
    tpsLoading.value = false
  }
}

const fetchSupervisionOverview = async () => {
  const response = await axios.get(`${MODEL_API_BASE}/api/supervision/overview`, { timeout: 10000 })
  const overview = response.data || {}
  detectedAccounts.value = Number(overview.detected_accounts || 0)
  const ratio = Number(overview.anomaly_ratio)
  anomalyAccountRatio.value = Number.isFinite(ratio) ? `${(ratio * 100).toFixed(2)}%` : '0.00%'
  // 原型此卡片使用静态演示值；不要把检测账户或风险交易数误称为审计交易。
  if (isRegulator || isAdmin) auditedTransactions.value = 1
  else auditedTransactions.value = Number(
    overview.completed_tasks || overview.detected_accounts || overview.high_risk_transactions || 0,
  )
}

const fetchLocalDashboard = async () => {
  const response = await getHomeStats()
  const payload = response?.data?.data || {}
  const summary = payload.summary || {}

  todayTransactionVolume.value = Number(summary.today_order_count || 0)
  totalTransactionVolume.value = Number(summary.total_order_count || 0)
  maxDailyTransactionVolume.value = Number(summary.max_daily_order_count || 0)

  transactionHistory.value = Array.isArray(payload.daily_trend)
    ? payload.daily_trend.map((item: any) => ({
        date: item.stat_date,
        transaction_count: Number(item.order_count || 0),
        sum_price: Number(item.trade_amount || 0),
      }))
    : []

  industryStats.value = Array.isArray(payload.category_distribution)
    ? payload.category_distribution.map((item: any) => ({
        industryName: item.category_name || '未分类',
        count: Number(item.asset_count || 0),
      }))
    : []

  await renderHistoryChart()
}

const fetchRegulatorDashboard = async () => {
  const results = await Promise.allSettled([
    getTodayTransactionStats(),
    getTotalTransactionStats(),
    getTransactionHistory(),
    getIndustryTransactionStats(),
  ])
  if (results[0].status === 'fulfilled') {
    todayTransactionVolume.value = Number(results[0].value.data?.today_transaction_count || 0)
  }
  if (results[1].status === 'fulfilled') {
    totalTransactionVolume.value = Number(results[1].value.data?.total_transaction_count || 0)
  }
  if (results[2].status === 'fulfilled') {
    const data = results[2].value.data
    transactionHistory.value = Array.isArray(data) ? data : data?.transaction_history || []
    await renderHistoryChart()
  }
  if (results[3].status === 'fulfilled') {
    industryStats.value = results[3].value.data?.data || []
  }
  maxDailyTransactionVolume.value = 70000
}

const loadDashboard = async () => {
  loading.value = true
  try {
    await Promise.all([
      isRegulator || isAdmin ? fetchRegulatorDashboard() : fetchLocalDashboard(),
      fetchSupervisionOverview(),
    ])
  } catch (_error) {
  } finally {
    loading.value = false
  }
}

const handleResize = () => {
  historyChart?.resize()
}

onMounted(async () => {
  await loadDashboard()
  if (isRegulator || isAdmin) await fetchTPS()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  historyChart?.dispose()
  historyChart = null
})
</script>

<style scoped>
.home-page {
  width: 100%;
  padding: 20px;
  background: #f5f6fa;
  box-sizing: border-box;
}

.dashboard-title {
  margin: 0;
  padding: 10px 0 16px 10px;
  text-align: left;
  font-size: 24px;
  color: #333;
}

.dashboard-new {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  width: 100%;
  margin-bottom: 24px;
  align-items: stretch;
}

.dashboard-item {
  background: #fff;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  margin: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

.summary-card {
  height: 330px;
  display: flex;
  flex-direction: column;
}

.summary-card .summary-title {
  height: 35px;
  flex-shrink: 0;
}

.summary-top {
  height: 145px;
  flex-shrink: 0;
}

.summary-bottom {
  height: 130px;
  flex-shrink: 0;
}

.industry-card {
  height: 330px;
  display: flex;
  flex-direction: column;
}

.summary-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 35px;
  flex-shrink: 0;
}

.summary-title h3 {
  margin: 0;
  font-size: 15px;
  color: #222;
}

.dashboard-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.main-trade {
  text-align: center;
  height: 65px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.main-number {
  font-size: 30px;
  font-weight: 700;
  margin: 5px 0 0;
  color: #111;
}

.main-label {
  font-size: 13px;
  color: #777;
}

.trade-sub {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 5px;
}

.trade-box {
  background: #f6f8fc;
  border-radius: 8px;
  height: 42px;
  padding: 0 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: border-box;
}

.trade-box span {
  font-size: 13px;
  color: #666;
}

.trade-box strong {
  font-size: 18px;
  color: #222;
}

.divider {
  height: 1px;
  width: 100%;
  background: #edf0f5;
  margin: 8px 0;
  flex-shrink: 0;
}

.system-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 8px;
}

.system-box {
  background: #f6f8fc;
  border-radius: 8px;
  height: 65px;
  padding: 8px 12px;
  box-sizing: border-box;
  text-align: center;
  overflow: hidden;
}

.system-box span {
  display: block;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.system-box strong {
  display: block;
  margin-top: 4px;
  font-size: 20px;
  color: #111;
  line-height: 22px;
}

.system-box small {
  display: block;
  color: #ff5252;
  font-size: 12px;
}

.system-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.refresh-btn {
  border: none;
  background: #409eff;
  color: white;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.industry-grid {
  margin-top: 15px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  max-height: 210px;
  overflow-y: auto;
}

.industry-chip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f6f8fc;
  border: 1px solid #edf0f7;
  border-radius: 8px;
  padding: 10px;
  min-height: 38px;
  box-sizing: border-box;
}

.industry-name {
  font-size: 12px;
  color: #4b5563;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.industry-count {
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
  margin-left: 8px;
}

.sales-details {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sales-details h3 {
  margin: 0 0 20px;
  font-size: 18px;
  text-align: left;
}

.line-chart-container {
  height: 420px;
  width: 100%;
}

@media (max-width: 900px) {
  .dashboard-new {
    grid-template-columns: 1fr;
  }

  .industry-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
