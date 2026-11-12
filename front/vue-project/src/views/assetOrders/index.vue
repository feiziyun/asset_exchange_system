<template>
  <div class="common-wrapped">
    <div class="orders-page">
      <section class="toolbar-section">
        <div class="toolbar-row">
          <div class="list-title">订单列表</div>
          <el-button type="primary" @click="fetchOrders">刷新</el-button>
        </div>
      </section>

      <section class="table-section">
        <el-table :data="orders" v-loading="loading" style="width: 100%" empty-text="暂无订单" class="orders-table">
          <el-table-column prop="asset_name" label="资产名" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.asset_name || '-' }}</template>
          </el-table-column>
          <el-table-column label="交易ID" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.transaction?.transaction_id || '-' }}</template>
          </el-table-column>
          <el-table-column label="价格" min-width="130">
            <template #default="{ row }">{{ formatPrice(row.deal_price) }} {{ row.price_unit || '人民币' }}</template>
          </el-table-column>
          <el-table-column label="资产ID" width="90">
            <template #default="{ row }">{{ row.asset_id || '-' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="105">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row)" effect="light">{{ transactionStatusText(row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="卖家地址" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ sellerAddress(row) }}</template>
          </el-table-column>
          <el-table-column label="买家地址" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ buyerAddress(row) }}</template>
          </el-table-column>
          <el-table-column label="申请数量" width="90">
            <template #default="{ row }">{{ row.buy_qty || 1 }}</template>
          </el-table-column>
          <el-table-column label="操作" width="105" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button
                  v-if="isPendingOrder(row)"
                  type="primary"
                  link
                  :loading="actionLoadingNo === row.order_no"
                  @click="handleSellerConfirm(row)"
                >确认交易</el-button>
                <el-button
                  v-else-if="row.delegation_id && row.chain_transfer_status !== 'SUCCESS' && ['已确认', '已完成'].includes(row.transaction?.status || '')"
                  type="primary"
                  link
                  :loading="actionLoadingNo === row.order_no"
                  @click="transferProxyOrder(row)"
                >链上过户</el-button>
                <span v-else>-</span>
              </div>
            </template>
          </el-table-column>
        </el-table>

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

const query = reactive({
  page: 1,
  page_size: 10,
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
  loading.value = true
  try {
    const res = await getOrderList(query)
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
    ElMessage.error('获取订单失败')
  } finally {
    loading.value = false
  }
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
  width: 96%;
  min-height: 100vh;
  padding: 8px 10px;
  box-sizing: border-box;
}

.toolbar-section,
.table-section {
  background: #fff;
  border: 1px solid #e4e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 2px 8px rgba(18, 41, 79, 0.06);
}

.table-section {
  margin-top: 8px;
}

.toolbar-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.list-title {
  color: #1d3972;
  font-size: 15px;
  font-weight: 700;
}

.orders-table {
  --el-table-header-bg-color: #fff;
  --el-table-border-color: #e9edf2;
  color: #22304f;
}

.orders-table :deep(.el-table__header th) {
  color: #46546b;
  font-weight: 600;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  white-space: nowrap;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 1400px) {
  .orders-page {
    width: 96%;
  }
}
</style>
