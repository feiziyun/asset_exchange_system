<template>
  <div class="common-wrapped">
    <div class="orders-page">
      <header class="orders-header toolbar-section">
        <div class="orders-title"><h2 class="page-title">订单列表</h2></div>
        <div class="app-search-bar orders-search">
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
      </header>

      <section class="orders-panel" v-loading="loading">
        <div class="orders-filter-row">
          <div class="order-filter-bar">
            <span class="order-filter-label">订单状态</span>
            <el-checkbox
              :model-value="selectedStatuses.length === statusOptions.length"
              class="order-filter-checkbox"
              @change="toggleAllStatuses"
            >全部</el-checkbox>
            <el-checkbox-group v-model="selectedStatuses" class="order-filter-options" @change="selectStatus">
              <el-checkbox v-for="option in statusOptions" :key="option.value" :label="option.value">
                {{ option.label }}
              </el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="header-actions">
            <span class="order-count">共 {{ pagination.total }} 笔订单</span>
          </div>
        </div>
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
                <strong>{{ formatPrice(row.deal_price) }} <span>{{ row.price_unit || '人民币' }}</span></strong>
              </div>
              <div class="order-actions">
                <el-button
                  v-if="isPendingOrder(row)"
                  class="confirm-order-button app-primary-action"
                  type="primary"
                  :loading="actionLoadingNo === row.order_no"
                  @click="handleSellerConfirm(row)"
                >确认交易</el-button>
                <template v-if="isConfirmedOrder(row)">
                  <el-button class="confirm-order-button" disabled>已确认</el-button>
                  <button type="button" class="delivery-link" @click="goToDelivery(row)">前往交付工作台</button>
                </template>
                <el-button
                  v-if="row.delegation_id && row.chain_transfer_status !== 'SUCCESS' && ['已确认', '已完成'].includes(row.transaction?.status || '')"
                  type="primary"
                  :loading="actionLoadingNo === row.order_no"
                  @click="transferProxyOrder(row)"
                >链上过户</el-button>
              </div>
            </div>
          </article>
        </div>
        <el-empty v-else-if="!loading" description="暂无订单" />
      </section>
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
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
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
const router = useRouter()
const actionLoadingNo = ref('')
const orders = ref<OrderItem[]>([])
const searchInput = ref('')
let ordersRequestId = 0

const query = reactive({
  page: 1,
  page_size: 10,
  keyword: '',
  order_role: 'seller',
  seller_confirm_state: 'pending',
})

const statusOptions = [
  { label: '待确认', value: 'pending' },
  { label: '已确认', value: 'confirmed' },
]
const selectedStatuses = ref<string[]>(['pending'])

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

const isConfirmedOrder = (order?: OrderItem | null) => {
  const status = Number(order?.order_status)
  return [1, 2, 3].includes(status) && (status >= 2 || ['已确认', '已完成'].includes(String(order?.transaction?.status || '')))
}

const goToDelivery = (order: OrderItem) => {
  router.push({ path: '/assetDelivery/seller', query: { order_no: order.order_no } })
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

const selectStatus = (statuses: string[]) => {
  query.seller_confirm_state = statuses.length === statusOptions.length ? 'all' : statuses.length ? statuses[0] : 'none'
  query.page = 1
  fetchOrders()
}

const toggleAllStatuses = (checked: boolean) => {
  selectedStatuses.value = checked ? statusOptions.map((option) => option.value) : []
  selectStatus(selectedStatuses.value)
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
  width: 85%;
  min-height: 100vh;
  padding: 16px 20px;
  box-sizing: border-box;
  background: #f5f7fb;
}

.orders-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 650px) minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  box-sizing: border-box;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #e4e8f0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(12, 46, 117, 0.06);
}

.orders-header h2 {
  margin: 0;
}

.orders-title { grid-column: 1; min-width: 0; }

.orders-search {
  grid-column: 2;
  grid-row: 1;
  width: min(100%, 420px);
  justify-self: center;
}

.orders-filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  min-width: 0;
  min-height: 48px;
  padding: 8px 24px;
  border-bottom: 1px solid #d8dee4;
}

.header-actions {
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
  white-space: nowrap;
}

.order-filter-bar {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
}

.order-filter-label {
  flex: none;
  color: #6e7781;
  line-height: 1.4;
  font-size: 12px;
}

.order-filter-options {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.order-filter-bar :deep(.el-checkbox) {
  margin-right: 0;
}

.order-filter-bar :deep(.el-checkbox__label) {
  color: #57606a;
  font-size: 12px;
}

.order-filter-bar :deep(.el-checkbox__input .el-checkbox__original) {
  appearance: none;
  border: 1px solid #8c959f;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
}

.order-filter-bar :deep(.el-checkbox__input .el-checkbox__original:checked) {
  border-color: #0969da;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%230969da' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m3 8 3.2 3.2L13 4.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 14px 14px;
}

@media (max-width: 1150px) {
  .orders-header {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .orders-search {
    grid-column: 1 / -1;
    grid-row: 2;
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
  align-items: center;
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
  display: flex;
  flex-direction: column;
  justify-content: center;
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
  justify-content: center;
  gap: 12px;
}

.order-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.order-actions :deep(.el-button.confirm-order-button) {
  width: 104px;
  margin: 0;
}

.delivery-link {
  border: 0;
  padding: 0;
  background: none;
  color: #0969da;
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.delivery-link:hover { color: #0550ae; text-decoration: underline; }
.delivery-link:focus-visible { outline: 2px solid #0969da; outline-offset: 2px; }

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
  justify-content: center;
  padding: 16px 0 0;
}

.pager :deep(.el-pagination) {
  flex-wrap: wrap;
  justify-content: center;
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
    padding-top: 14px;
  }
}
</style>
