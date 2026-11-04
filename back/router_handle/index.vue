<template>
  <div class="common-wrapped">
    <div class="delivery-page">
      <section class="head-section">
        <div class="head-title">资产交付与交易流程</div>
        <div class="flow-guide">
          <div class="flow-item">
            <div class="flow-dot">1</div>
            <div class="flow-text">上架</div>
            <div class="flow-desc">卖家发布交易批次</div>
          </div>
          <div class="flow-arrow">→</div>
          <div class="flow-item">
            <div class="flow-dot">2</div>
            <div class="flow-text">下单</div>
            <div class="flow-desc">买家创建订单</div>
          </div>
          <div class="flow-arrow">→</div>
          <div class="flow-item">
            <div class="flow-dot">3</div>
            <div class="flow-text">支付</div>
            <div class="flow-desc">订单进入待交付</div>
          </div>
          <div class="flow-arrow">→</div>
          <div class="flow-item">
            <div class="flow-dot">4</div>
            <div class="flow-text">确认交付</div>
            <div class="flow-desc">买家确认后完成交易</div>
          </div>
        </div>
      </section>

      <section class="toolbar-section">
        <el-input
          v-model="query.keyword"
          class="search-input"
          placeholder="搜索订单号或资产名称"
          clearable
          @keyup.enter="onSearch"
        />
        <el-select v-model="query.order_status" clearable placeholder="订单状态" style="width: 160px">
          <el-option label="待支付" :value="0" />
          <el-option label="待交付" :value="5" />
          <el-option label="已完成" :value="1" />
          <el-option label="已取消" :value="2" />
          <el-option label="退款中" :value="3" />
          <el-option label="已退款" :value="4" />
        </el-select>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </section>

      <section class="order-section" v-loading="loading">
        <div v-if="orders.length" class="order-list">
          <el-card v-for="item in orders" :key="item.id" shadow="never" class="order-card">
            <div class="order-head">
              <div class="order-no">订单号：{{ item.order_no }}</div>
              <el-tag :type="statusTag(item.order_status)">{{ statusText(item.order_status) }}</el-tag>
            </div>

            <div class="order-meta">
              <span>资产：{{ item.asset_name || '-' }}</span>
              <span>卖家：{{ item.seller_account || '-' }}</span>
              <span>买家：{{ item.buyer_account || '-' }}</span>
              <span>数量：{{ item.buy_qty }}</span>
              <span>单价：{{ item.deal_price }} {{ item.price_unit || '' }}</span>
              <span>创建时间：{{ item.created_at || '-' }}</span>
            </div>

            <div class="mini-flow">
              <div
                v-for="step in stepList"
                :key="step.index"
                class="mini-node"
                :class="stepClass(item.order_status, step.index)"
              >
                <div class="node-index">{{ step.index }}</div>
                <div class="node-text">{{ step.label }}</div>
                <div v-if="step.index < 4" class="node-line"></div>
              </div>
            </div>

            <div class="position-text">当前流程位置：{{ currentPositionText(item.order_status) }}</div>

            <div class="order-actions">
              <el-button
                v-if="item.order_status === 0"
                type="primary"
                :loading="actionLoadingNo === item.order_no"
                @click="payCurrentOrder(item.order_no)"
              >
                支付订单
              </el-button>
              <el-button
                v-if="item.order_status === 5"
                type="success"
                :loading="actionLoadingNo === item.order_no"
                @click="confirmCurrentOrder(item.order_no)"
              >
                确认交付
              </el-button>
            </div>
          </el-card>
        </div>

        <el-empty v-else description="暂无订单数据" />

        <div class="pager">
          <el-pagination
            background
            layout="total, prev, pager, next, sizes"
            :total="pagination.total"
            :current-page="pagination.page"
            :page-size="pagination.page_size"
            :page-sizes="[10, 20, 50]"
            @current-change="onPageChange"
            @size-change="onSizeChange"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { confirmDelivery, getOrderList, payOrder } from '@/api/asset'

interface OrderItem {
  id: number
  order_no: string
  asset_name?: string
  seller_account?: string
  buyer_account?: string
  buy_qty: number
  deal_price: number
  price_unit?: string
  order_status: number
  created_at?: string
}

const loading = ref(false)
const actionLoadingNo = ref('')
const orders = ref<OrderItem[]>([])

const query = reactive({
  page: 1,
  page_size: 10,
  keyword: '',
  order_status: undefined as number | undefined,
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0,
})

const stepList = [
  { index: 1, label: '上架' },
  { index: 2, label: '下单' },
  { index: 3, label: '支付' },
  { index: 4, label: '确认交付' },
]

const statusText = (status: number) => {
  if (status === 0) return '待支付'
  if (status === 1) return '已完成'
  if (status === 2) return '已取消'
  if (status === 3) return '退款中'
  if (status === 4) return '已退款'
  if (status === 5) return '待交付'
  return '未知'
}

const statusTag = (status: number) => {
  if (status === 0) return 'warning'
  if (status === 1) return 'success'
  if (status === 2) return 'info'
  if (status === 3) return 'warning'
  if (status === 4) return 'info'
  if (status === 5) return 'primary'
  return ''
}

const stepPosition = (status: number) => {
  if (status === 0) return 3
  if (status === 5) return 4
  if (status === 1) return 5
  if (status === 2 || status === 3 || status === 4) return 0
  return 0
}

const stepClass = (status: number, stepIndex: number) => {
  const pos = stepPosition(status)
  if (pos === 5) return 'done'
  if (pos > 0 && stepIndex < pos) return 'done'
  if (stepIndex === pos) return 'current'
  return 'pending'
}

const currentPositionText = (status: number) => {
  if (status === 0) return '第 3 步：支付'
  if (status === 5) return '第 4 步：确认交付'
  if (status === 1) return '流程已完成'
  if (status === 2) return '订单已取消'
  if (status === 3) return '订单退款中'
  if (status === 4) return '订单已退款'
  return '状态未知'
}

const fetchOrders = async () => {
  loading.value = true
  try {
    const res = await getOrderList(query)
    if (res.data.status === 0) {
      orders.value = res.data.data?.list || []
      const p = res.data.data?.pagination || {}
      pagination.page = p.page || 1
      pagination.page_size = p.page_size || query.page_size
      pagination.total = p.total || 0
    } else {
      ElMessage.error(res.data.message || '获取订单失败')
    }
  } catch (error) {
    ElMessage.error('获取订单失败')
  } finally {
    loading.value = false
  }
}

const onSearch = () => {
  query.page = 1
  fetchOrders()
}

const onReset = () => {
  query.page = 1
  query.page_size = 10
  query.keyword = ''
  query.order_status = undefined
  fetchOrders()
}

const onPageChange = (page: number) => {
  query.page = page
  fetchOrders()
}

const onSizeChange = (size: number) => {
  query.page_size = size
  query.page = 1
  fetchOrders()
}

const payCurrentOrder = async (orderNo: string) => {
  actionLoadingNo.value = orderNo
  try {
    const res = await payOrder(orderNo)
    if (res.data.status === 0) {
      ElMessage.success('支付成功，订单进入待交付')
      fetchOrders()
    } else {
      ElMessage.error(res.data.message || '支付失败')
    }
  } catch (error) {
    ElMessage.error('支付失败')
  } finally {
    actionLoadingNo.value = ''
  }
}

const confirmCurrentOrder = async (orderNo: string) => {
  actionLoadingNo.value = orderNo
  try {
    const res = await confirmDelivery(orderNo)
    if (res.data.status === 0) {
      ElMessage.success('交付确认成功')
      fetchOrders()
    } else {
      ElMessage.error(res.data.message || '交付确认失败')
    }
  } catch (error) {
    ElMessage.error('交付确认失败')
  } finally {
    actionLoadingNo.value = ''
  }
}

onMounted(fetchOrders)
</script>

<style scoped lang="scss">
.common-wrapped {
  width: 100%;
  display: flex;
  justify-content: center;
  background: #f5f7fb;

  .delivery-page {
    padding: 16px 20px;
    width: 85%;
    min-height: 100vh;
    box-sizing: border-box;
  }
}

.head-section,
.toolbar-section,
.order-section {
  background: #fff;
  border-radius: 10px;
  padding: 14px 18px;
  box-shadow: 0 2px 12px rgba(12, 46, 117, 0.06);
}

.head-title {
  color: #193a8d;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 14px;
}

.flow-guide {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  overflow-x: auto;
}

.flow-item {
  min-width: 170px;
  text-align: center;
}

.flow-dot {
  width: 24px;
  height: 24px;
  line-height: 24px;
  border-radius: 50%;
  margin: 0 auto 8px;
  border: 2px solid #3559b6;
  color: #3559b6;
  font-weight: 700;
}

.flow-text {
  font-size: 20px;
  color: #243d85;
  font-weight: 600;
}

.flow-desc {
  color: #8a95b8;
  font-size: 13px;
}

.flow-arrow {
  color: #8fa0cb;
  font-size: 24px;
  font-weight: 700;
}

.toolbar-section {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-input {
  width: 320px;
}

.order-section {
  margin-top: 10px;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-card {
  border-radius: 10px;
  border: none;
  box-shadow: 0 1px 8px rgba(12, 46, 117, 0.05);
}

.order-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-no {
  color: #233f8f;
  font-weight: 700;
}

.order-meta {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  color: #5f6f99;
  font-size: 13px;
}

.mini-flow {
  margin-top: 12px;
  display: flex;
  align-items: flex-start;
}

.mini-node {
  position: relative;
  flex: 1;
  text-align: center;

  .node-index {
    width: 22px;
    height: 22px;
    line-height: 22px;
    border-radius: 50%;
    margin: 0 auto 5px;
    border: 1px solid #c6d1ef;
    color: #8a95b8;
    font-size: 12px;
    font-weight: 700;
    background: #fff;
    position: relative;
    z-index: 2;
  }

  .node-text {
    font-size: 12px;
    color: #8a95b8;
  }

  .node-line {
    position: absolute;
    top: 10px;
    right: -50%;
    width: 100%;
    height: 2px;
    background: #dbe3f6;
    z-index: 1;
  }

  &.done {
    .node-index {
      border-color: #2f7cfc;
      background: #2f7cfc;
      color: #fff;
    }

    .node-text {
      color: #2f7cfc;
      font-weight: 600;
    }

    .node-line {
      background: #2f7cfc;
    }
  }

  &.current {
    .node-index {
      border-color: #f59e0b;
      background: #fff7e6;
      color: #f59e0b;
    }

    .node-text {
      color: #f59e0b;
      font-weight: 600;
    }
  }
}

.position-text {
  margin-top: 10px;
  color: #3559b6;
  font-size: 13px;
}

.order-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .toolbar-section {
    flex-wrap: wrap;
  }

  .search-input {
    width: 100%;
  }
}

.pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
