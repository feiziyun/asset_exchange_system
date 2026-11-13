<template>
  <div class="common-wrapped">
    <div class="orders-page">
      <header class="orders-header app-search-layout">
        <h2 class="page-title">订单列表</h2>
        <div class="app-search-bar">
          <el-input
            v-model="searchInput"
            class="app-search-input"
            placeholder="搜索订单号或资产名称"
            clearable
            @keyup.enter="onSearch"
            @clear="onSearch"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button class="app-search-button" @click="onSearch">搜索</el-button>
        </div>
        <div class="header-actions">
          <span class="order-count">共 {{ pagination.total }} 笔订单</span>
        </div>
      </header>

      <section class="orders-panel" v-loading="loading">
        <div v-if="orders.length" class="order-list">
          <article v-for="row in orders" :key="row.id" class="order-item">
            <div class="order-main">
              <div class="order-heading">
                <h3 class="order-name">{{ row.asset_name || '未命名资产' }}</h3>
                <span class="order-status" :class="statusTagType(row)">{{ transactionStatusText(row) }}</span>
              </div>
              <div class="order-meta">
                <div class="meta-item meta-item-wide">
                  <span class="meta-label">交易 ID</span>
                  <span class="meta-value mono">{{ row.transaction?.transaction_id || '-' }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">资产 ID</span>
                  <span class="meta-value">{{ row.asset_id || '-' }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">申请数量</span>
                  <span class="meta-value">{{ row.buy_qty || 1 }}</span>
                </div>
                <div class="meta-item meta-item-wide">
                  <span class="meta-label">卖家地址</span>
                  <span class="meta-value mono">{{ sellerAddress(row) }}</span>
                </div>
                <div class="meta-item meta-item-wide">
                  <span class="meta-label">买家地址</span>
                  <span class="meta-value mono">{{ buyerAddress(row) }}</span>
                </div>
              </div>
            </div>
            <div class="order-side">
              <div class="order-price">
                <span class="price-label">价格</span>
                <strong>{{ formatPrice(row.deal_price) }} <span>{{ row.price_unit || '人民币' }}</span></strong>
              </div>
              <el-button
                v-if="isPendingOrder(row)"
                type="primary"
                :loading="actionLoadingNo === row.order_no"
                @click="handleSellerConfirm(row)"
              >确认交易</el-button>
              <el-button
                v-else-if="row.delegation_id && row.chain_transfer_status !== 'SUCCESS' && ['已确认', '已完成'].includes(row.transaction?.status || '')"
                type="primary"
                :loading="actionLoadingNo === row.order_no"
                @click="transferProxyOrder(row)"
              >链上过户</el-button>
            </div>
          </article>
        </div>
        <el-empty v-else-if="!loading" description="暂无订单" />

        <div v-if="pagination.total" class="pager">
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
import { Search } from '@element-plus/icons-vue'
import { getOrderList, proxyTransfer, sellerConfirmOrder } from '@/api/asset'
import { formatPrice } from '@/utils/price'

interface OrderItem {
  id: number
  order_no: string
  asset_id: number
  asset_name?: string
  buy_qty: number
  deal_price: number
  order_status: number
  order_status_text?: string
  price_unit?: string
  delegation_id?: number | null
  chain_transfer_status?: string
  buyer_address?: string
  transaction?: {
    transaction_id?: string
    buyer_address?: string
    seller_address?: string
    status?: string
  } | null
}

const loading = ref(false)
const actionLoadingNo = ref('')
const orders = ref<OrderItem[]>([])
const searchInput = ref('')
let ordersRequestId = 0

const query = reactive({
  page: 1,
  page_size: 10,
  keyword: '',
  order_role: 'seller',
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0,
})

const transactionStatusText = (order?: OrderItem | null) => {
  if (Number(order?.order_status) === 0) return '待支付'
  if (Number(order?.order_status) === 4) return '已关闭'
  if (Number(order?.order_status) === 3) return '已完成'
  const status = String(order?.transaction?.status || '').trim()
  return status || (Number(order?.order_status) === 1 ? '待确认' : order?.order_status_text || '-')
}

const isPendingOrder = (order?: OrderItem | null) => {
  return Number(order?.order_status) === 1 && transactionStatusText(order) === '待确认'
}

const statusTagType = (order: OrderItem) => {
  if (isPendingOrder(order)) return 'warning'
  if ([1, 2, 3].includes(Number(order.order_status))) return 'success'
  return 'info'
}

const sellerAddress = (order?: OrderItem | null) => {
  return order?.transaction?.seller_address || '-'
}

const buyerAddress = (order?: OrderItem | null) => {
  return order?.transaction?.buyer_address || order?.buyer_address || '-'
}

const fetchOrders = async () => {
  const requestId = ++ordersRequestId
  loading.value = true
  try {
    const res = await getOrderList({ ...query })
    if (requestId !== ordersRequestId) return
    if (res.data.status === 0) {
      const list = res.data.data?.list || []
      orders.value = list
      const p = res.data.data?.pagination || {}
      pagination.page = p.page || 1
      pagination.page_size = p.page_size || query.page_size
      pagination.total = Number(p.total || 0)
    } else {
      ElMessage.error(res.data.message || '获取订单失败')
    }
  } catch {
    if (requestId !== ordersRequestId) return
    ElMessage.error('获取订单失败')
  } finally {
    if (requestId === ordersRequestId) loading.value = false
  }
}

const onSearch = () => {
  query.keyword = searchInput.value.trim()
  query.page = 1
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

const handleSellerConfirm = async (order: OrderItem) => {
  actionLoadingNo.value = order.order_no
  try {
    const res = await sellerConfirmOrder(order.order_no)
    if (res.data.status === 0) {
      if (order.delegation_id && res.data.data?.transaction?.transaction_id) {
        const transaction = res.data.data.transaction
        try {
          await proxyTransfer({
            transaction_id: transaction.transaction_id,
            seller_address: transaction.seller_address,
          })
        } catch (error: any) {
          ElMessage.warning(error?.response?.data?.message || '交易已确认，链上过户未完成，请重试')
          await fetchOrders()
          return
        }
      }
      ElMessage.success(res.data.message || '确认交易成功')
      fetchOrders()
      return
    }
    ElMessage.error(res.data.message || '确认交易失败')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '确认交易失败')
  } finally {
    actionLoadingNo.value = ''
  }
}

const transferProxyOrder = async (order: OrderItem) => {
  const transactionId = order.transaction?.transaction_id
  const address = order.transaction?.seller_address
  if (!transactionId || !address) return
  actionLoadingNo.value = order.order_no
  try {
    const response = await proxyTransfer({ transaction_id: transactionId, seller_address: address })
    if (!response.data.success) throw new Error(response.data.message || '链上过户失败')
    ElMessage.success('链上过户成功')
    await fetchOrders()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error.message || '链上过户失败')
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
}

.orders-page {
  width: min(100%, 1240px);
  min-height: calc(100vh - 112px);
  padding: 24px 24px 48px;
  box-sizing: border-box;
  background: #f5f7fb;
}

.orders-header {
  margin-bottom: 12px;
  padding: 14px 18px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(12, 46, 117, 0.06);
}

.orders-header h2 {
  margin: 0;
}

.header-actions {
  grid-column: 3;
  justify-self: end;
}

@media (max-width: 900px) {
  .header-actions {
    grid-column: 1;
    justify-self: start;
  }
}

.order-count {
  color: #57606a;
  font-size: 13px;
}

.orders-panel {
  min-height: 160px;
  overflow: hidden;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(12, 46, 117, 0.06);
}

.order-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 24px;
  padding: 20px 24px;
}

.order-item + .order-item {
  border-top: 1px solid #d8dee4;
}

.order-item:hover {
  background: #f6f8fa;
}

.order-main {
  min-width: 0;
}

.order-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.order-name {
  margin: 0;
  color: #1f2328;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.order-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #57606a;
  font-size: 12px;
  white-space: nowrap;
}

.order-status::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8c959f;
}

.order-status.warning::before {
  background: #bf8700;
}

.order-status.success::before {
  background: #1a7f37;
}

.order-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 20px;
}

.meta-item {
  display: flex;
  gap: 10px;
  min-width: 0;
  font-size: 12px;
  line-height: 1.6;
}

.meta-item-wide {
  grid-column: 1 / -1;
}

.meta-label {
  flex: 0 0 64px;
  color: #6e7781;
}

.meta-value {
  min-width: 0;
  color: #57606a;
  overflow-wrap: anywhere;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
}

.order-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 20px;
}

.order-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  white-space: nowrap;
}

.order-price strong {
  color: #1f2328;
  font-size: 18px;
  font-weight: 600;
}

.order-price .price-label,
.order-price strong span {
  color: #57606a;
  font-size: 12px;
  font-weight: 400;
}

.order-side .el-button {
  margin: 0;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid #d8dee4;
}

.pager :deep(.el-pagination) {
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .orders-page {
    padding: 18px 12px 32px;
  }

  .order-item {
    grid-template-columns: 1fr;
    gap: 14px;
    padding: 18px 16px;
  }

  .order-side {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .pager {
    padding: 14px 12px;
  }
}
</style>
