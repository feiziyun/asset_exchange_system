<template>
  <div class="common-wrapped">
    <div class="orders-page">
      <section class="toolbar-section">
        <div class="toolbar-row">
          <div class="list-title">订单列表</div>
          <el-button type="primary" @click="fetchOrders">刷新</el-button>
        </div>
      </section>

      <section class="table-section" v-loading="loading">
        <div v-if="orders.length" class="table-wrap">
          <table class="styled-table table-hover-row">
            <thead>
              <tr>
                <th>资产名</th>
                <th>交易ID</th>
                <th>价格</th>
                <th>资产ID</th>
                <th>状态</th>
                <th>卖家地址</th>
                <th>买家地址</th>
                <th>申请数量</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in orders" :key="item.id">
                <td>
                  <div class="truncate-cell" :title="item.asset_name || '-'">
                    {{ item.asset_name || '-' }}
                  </div>
                </td>
                <td>
                  <div class="truncate-cell" :title="item.transaction?.transaction_id || '-'">
                    {{ item.transaction?.transaction_id || '-' }}
                  </div>
                </td>
                <td>{{ formatPrice(item.deal_price) }} {{ item.price_unit || '人民币' }}</td>
                <td>{{ item.asset_id || '-' }}</td>
                <td>
                  <el-tag :type="statusTagType(item)" effect="light">
                    {{ transactionStatusText(item) }}
                  </el-tag>
                </td>
                <td>
                  <div class="truncate-cell" :title="sellerAddress(item)">
                    {{ sellerAddress(item) }}
                  </div>
                </td>
                <td>
                  <div class="truncate-cell" :title="buyerAddress(item)">
                    {{ buyerAddress(item) }}
                  </div>
                </td>
                <td>{{ item.buy_qty || 1 }}</td>
                <td>
                  <div class="row-actions">
                    <el-button
                      v-if="isPendingOrder(item)"
                      type="primary"
                      link
                      :loading="actionLoadingNo === item.order_no"
                      @click="handleSellerConfirm(item)"
                    >
                      确认交易
                    </el-button>
                    <span v-else>-</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <el-empty v-else description="暂无订单" />

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
import { getOrderList, sellerConfirmOrder } from '@/api/asset'
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

.table-wrap {
  overflow-x: auto;
}

.styled-table {
  width: 100%;
  min-width: 1120px;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}

.styled-table th,
.styled-table td {
  border: 1px solid #e1e6ef;
  padding: 5px 4px;
  text-align: center;
  vertical-align: middle;
  word-wrap: break-word;
  overflow: hidden;
  position: relative;
  line-height: 1.3;
  font-size: 12px;
  color: #22304f;
}

.styled-table th {
  background: #f8fafc;
  color: #3d4b66;
  font-weight: 700;
  font-size: 12px;
  white-space: nowrap;
  border-bottom: 2px solid #dde4ee;
}

.styled-table th:nth-child(1) { width: 110px; }
.styled-table th:nth-child(2) { width: 132px; }
.styled-table th:nth-child(3) { width: 88px; }
.styled-table th:nth-child(4) { width: 82px; }
.styled-table th:nth-child(5) { width: 72px; }
.styled-table th:nth-child(6) { width: 138px; }
.styled-table th:nth-child(7) { width: 138px; }
.styled-table th:nth-child(8) { width: 62px; }
.styled-table th:nth-child(9) { width: 66px; }

.styled-table td {
  background: #fff;
}

.styled-table tbody tr:nth-of-type(odd) td {
  background: #f9fbfd;
}

.styled-table tbody tr:nth-of-type(even) td {
  background: #ffffff;
}

.table-hover-row tbody tr:hover td {
  background: #eef3f8;
  transition: background-color 0.2s ease;
}

.truncate-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  padding: 0 4px;
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
