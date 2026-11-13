<template>
  <div class="chain-info">
    <el-card class="stats-card">
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-label">总资产数</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">已上链</div>
          <div class="stat-value success">{{ stats.onChain }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">待上链</div>
          <div class="stat-value warning">{{ stats.pending }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">上链失败</div>
          <div class="stat-value danger">{{ stats.failed }}</div>
        </div>
      </div>
    </el-card>

    <el-card class="table-card">
      <div class="toolbar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索资产名称或Token ID"
          style="width: 300px"
          clearable
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="链上状态筛选" style="width: 150px" @change="handleSearch">
          <el-option label="全部" :value="null" />
          <el-option label="已上链" :value="1" />
          <el-option label="待上链" :value="0" />
          <el-option label="上链失败" :value="2" />
        </el-select>
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>查询
        </el-button>
        <el-button @click="handleReset">
          <el-icon><RefreshLeft /></el-icon>重置
        </el-button>
      </div>

      <el-table :data="chainInfoList" style="width: 100%" v-loading="loading">
        <el-table-column prop="asset_id" label="资产ID" width="100" />
        <el-table-column prop="asset_name" label="资产名称" min-width="200" />
        <el-table-column prop="token_id" label="Token ID" width="150" />
        <el-table-column prop="owner_address" label="持有者地址" min-width="180">
          <template #default="{ row }">
            <span class="address-text">{{ row.owner_address || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="chain_status" label="链上状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.chain_status === 1" type="success">已上链</el-tag>
            <el-tag v-else-if="row.chain_status === 0" type="warning">待上链</el-tag>
            <el-tag v-else type="danger">上链失败</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="chain_time" label="上链时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.chain_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="retry_count" label="重试次数" width="100" />
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
    <el-dialog v-model="detailDialogVisible" title="链上信息详情" width="600px">
      <el-descriptions :column="1" border v-if="currentDetail">
        <el-descriptions-item label="资产ID">{{ currentDetail.asset_id }}</el-descriptions-item>
        <el-descriptions-item label="资产名称">{{ currentDetail.asset_name }}</el-descriptions-item>
        <el-descriptions-item label="Token ID">{{ currentDetail.token_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="持有者地址">{{ currentDetail.owner_address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="交易哈希">{{ currentDetail.chain_tx_hash || '-' }}</el-descriptions-item>
        <el-descriptions-item label="链上状态">
          <el-tag v-if="currentDetail.chain_status === 1" type="success">已上链</el-tag>
          <el-tag v-else-if="currentDetail.chain_status === 0" type="warning">待上链</el-tag>
          <el-tag v-else type="danger">上链失败</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="上链时间">{{ formatDateTime(currentDetail.chain_time) }}</el-descriptions-item>
        <el-descriptions-item label="最后同步时间">{{ formatDateTime(currentDetail.last_sync_time) }}</el-descriptions-item>
        <el-descriptions-item label="重试次数">{{ currentDetail.retry_count }}</el-descriptions-item>
        <el-descriptions-item label="失败原因" v-if="currentDetail.chain_status === 2">
          {{ currentDetail.fail_reason || '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
import { getChainInfo } from '@/api/admin'
import { formatDateTime } from '@/utils/dateTime'

const loading = ref(false)
const chainInfoList = ref([])
const searchQuery = ref('')
const statusFilter = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const detailDialogVisible = ref(false)
const currentDetail = ref(null)

const stats = ref({
  total: 0,
  onChain: 0,
  pending: 0,
  failed: 0
})

const fetchChainInfo = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value
    }
    if (searchQuery.value) {
      params.keyword = searchQuery.value
    }
    if (statusFilter.value !== null) {
      params.chain_status = statusFilter.value
    }

    const res = await getChainInfo(params)
    if (res.data.status === 0) {
      chainInfoList.value = res.data.data.list || []
      total.value = res.data.data.total || 0

      // 更新统计数据
      if (res.data.data.stats) {
        stats.value.total = res.data.data.stats.total || 0
        stats.value.onChain = res.data.data.stats.onChain || 0
        stats.value.pending = res.data.data.stats.pending || 0
        stats.value.failed = res.data.data.stats.failed || 0
      }
    }
  } catch (error) {
    ElMessage.error('获取链上信息失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchChainInfo()
}

const handleReset = () => {
  searchQuery.value = ''
  statusFilter.value = null
  currentPage.value = 1
  fetchChainInfo()
}

const handleViewDetail = (row) => {
  currentDetail.value = row
  detailDialogVisible.value = true
}

onMounted(() => {
  fetchChainInfo()
})
</script>

<style lang="scss" scoped>
.chain-info {
  .stats-card {
    margin-bottom: 20px;

    .stats-row {
      display: flex;
      justify-content: space-around;

      .stat-item {
        text-align: center;

        .stat-label {
          font-size: 14px;
          color: var(--app-text-secondary);
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 600;
          color: var(--app-text-primary);

          &.success {
            color: #1a7f37;
          }

          &.warning {
            color: #9a6700;
          }

          &.danger {
            color: #cf222e;
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

    .address-text {
      font-family: monospace;
      font-size: 12px;
    }
  }
}
</style>
