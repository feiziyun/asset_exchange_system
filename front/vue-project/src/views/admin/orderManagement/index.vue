<template>
  <div class="order-management">
    <el-card class="stats-card">
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-label">总订单数</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">待确认</div>
          <div class="stat-value warning">{{ stats.pending }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">已完成</div>
          <div class="stat-value success">{{ stats.completed }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">已取消</div>
          <div class="stat-value">{{ stats.cancelled }}</div>
        </div>
      </div>
    </el-card>

    <el-card class="table-card">
      <div class="toolbar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索订单号或资产名称"
          style="width: 300px"
          clearable
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="状态筛选" style="width: 150px" @change="handleSearch">
          <el-option label="全部" :value="null" />
          <el-option label="待确认" :value="0" />
          <el-option label="待卖家交付" :value="1" />
          <el-option label="待买家确认" :value="2" />
          <el-option label="已完成" :value="3" />
          <el-option label="已取消" :value="4" />
          <el-option label="退款中" :value="5" />
          <el-option label="已退款" :value="6" />
        </el-select>
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>查询
        </el-button>
        <el-button @click="handleReset">
          <el-icon><RefreshLeft /></el-icon>重置
        </el-button>
      </div>

      <el-table :data="orderList" style="width: 100%" v-loading="loading">
        <el-table-column prop="order_no" label="订单号" width="180" />
        <el-table-column prop="asset_name" label="资产名称" min-width="200" />
        <el-table-column prop="buyer_account" label="买家账号" width="120" />
        <el-table-column prop="buy_qty" label="数量" width="80" />
        <el-table-column prop="deal_price" label="单价" width="120">
          <template #default="{ row }">
            ¥{{ formatPrice(row.deal_price) }}
          </template>
        </el-table-column>
        <el-table-column label="总价" width="120">
          <template #default="{ row }">
            ¥{{ formatPrice(row.deal_price * row.buy_qty) }}
          </template>
        </el-table-column>
        <el-table-column prop="order_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.order_status === 0" type="warning">待确认</el-tag>
            <el-tag v-else-if="row.order_status === 1" type="primary">待卖家交付</el-tag>
            <el-tag v-else-if="row.order_status === 2" type="primary">待买家确认</el-tag>
            <el-tag v-else-if="row.order_status === 3" type="success">已完成</el-tag>
            <el-tag v-else-if="row.order_status === 4" type="info">已取消</el-tag>
            <el-tag v-else-if="row.order_status === 5" type="danger">退款中</el-tag>
            <el-tag v-else type="info">已退款</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleViewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSearch"
        @current-change="handleSearch"
        style="margin-top: 20px; justify-content: flex-end"
      />
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="订单详情" width="600px">
      <el-descriptions :column="1" border v-if="currentDetail">
        <el-descriptions-item label="订单号">{{ currentDetail.order_no }}</el-descriptions-item>
        <el-descriptions-item label="资产名称">{{ currentDetail.asset_name }}</el-descriptions-item>
        <el-descriptions-item label="买家账号">{{ currentDetail.buyer_account }}</el-descriptions-item>
        <el-descriptions-item label="购买数量">{{ currentDetail.buy_qty }}</el-descriptions-item>
        <el-descriptions-item label="成交单价">¥{{ formatPrice(currentDetail.deal_price) }}</el-descriptions-item>
        <el-descriptions-item label="订单总价">
          ¥{{ formatPrice(currentDetail.deal_price * currentDetail.buy_qty) }}
        </el-descriptions-item>
        <el-descriptions-item label="订单状态">
          <el-tag v-if="currentDetail.order_status === 0" type="warning">待确认</el-tag>
          <el-tag v-else-if="currentDetail.order_status === 1" type="primary">待卖家交付</el-tag>
          <el-tag v-else-if="currentDetail.order_status === 2" type="primary">待买家确认</el-tag>
          <el-tag v-else-if="currentDetail.order_status === 3" type="success">已完成</el-tag>
          <el-tag v-else-if="currentDetail.order_status === 4" type="info">已取消</el-tag>
          <el-tag v-else-if="currentDetail.order_status === 5" type="danger">退款中</el-tag>
          <el-tag v-else type="info">已退款</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ currentDetail.created_at }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ currentDetail.updated_at }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
import { getOrderList } from '@/api/asset'
import { formatPrice } from '@/utils/price'

const loading = ref(false)
const orderList = ref([])
const searchQuery = ref('')
const statusFilter = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const detailDialogVisible = ref(false)
const currentDetail = ref(null)

const stats = ref({
  total: 0,
  pending: 0,
  completed: 0,
  cancelled: 0
})

const fetchOrderList = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
      scope: 'all'  // 管理员查看所有订单
    }
    if (searchQuery.value) {
      params.keyword = searchQuery.value
    }
    if (statusFilter.value !== null) {
      params.status = statusFilter.value
    }

    const res = await getOrderList(params)
    if (res.data.status === 0) {
      orderList.value = res.data.data.list || []
      total.value = res.data.data.total || 0

      // 更新统计数据
      stats.value.total = res.data.data.total || 0
      stats.value.pending = res.data.data.stats?.pending || 0
      stats.value.completed = res.data.data.stats?.completed || 0
      stats.value.cancelled = res.data.data.stats?.cancelled || 0
    }
  } catch (error) {
    ElMessage.error('获取订单列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchOrderList()
}

const handleReset = () => {
  searchQuery.value = ''
  statusFilter.value = null
  currentPage.value = 1
  fetchOrderList()
}

const handleViewDetail = (row) => {
  currentDetail.value = row
  detailDialogVisible.value = true
}

onMounted(() => {
  fetchOrderList()
})
</script>

<style lang="scss" scoped>
.order-management {
  .stats-card {
    margin-bottom: 20px;

    .stats-row {
      display: flex;
      justify-content: space-around;

      .stat-item {
        text-align: center;

        .stat-label {
          font-size: 14px;
          color: #666;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 600;
          color: #1890ff;

          &.success {
            color: #52c41a;
          }

          &.warning {
            color: #faad14;
          }
        }
      }
    }
  }

  .table-card {
    .toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
  }
}
</style>
