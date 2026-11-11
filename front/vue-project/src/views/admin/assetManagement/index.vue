<template>
  <div class="asset-management">
    <el-card class="stats-card">
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-label">总资产数</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">上架中</div>
          <div class="stat-value">{{ stats.active }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">已售罄</div>
          <div class="stat-value">{{ stats.soldOut }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">已下架</div>
          <div class="stat-value">{{ stats.offline }}</div>
        </div>
      </div>
    </el-card>

    <el-card class="table-card">
      <div class="toolbar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索资产名称"
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
          <el-option label="上架中" :value="1" />
          <el-option label="已售罄" :value="2" />
          <el-option label="已下架" :value="0" />
        </el-select>
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>查询
        </el-button>
        <el-button @click="handleReset">
          <el-icon><RefreshLeft /></el-icon>重置
        </el-button>
      </div>

      <el-table :data="assetList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="asset_name" label="资产名称" min-width="200" />
        <el-table-column prop="category_name" label="分类" width="160" />
        <el-table-column prop="region_name" label="地区" width="120" />
        <el-table-column prop="price" label="价格" width="120">
          <template #default="{ row }">
            ¥{{ formatPrice(row.price) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 1" type="success">上架中</el-tag>
            <el-tag v-else-if="row.status === 2" type="info">已售罄</el-tag>
            <el-tag v-else type="danger">已下架</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="view_count" label="浏览量" width="100" />
        <el-table-column prop="trade_count" label="成交量" width="100" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleView(row)">详情</el-button>
            <el-button link type="warning" size="small" @click="handleChangeStatus(row)">
              {{ row.status === 0 ? '上架' : '下架' }}
            </el-button>
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
        @current-change="fetchAssetList"
        style="margin-top: 20px; justify-content: flex-end"
      />
    </el-card>
    <el-dialog v-model="detailVisible" title="资产及区块链信息" width="680px">
      <el-descriptions v-if="currentAsset" :column="1" border>
        <el-descriptions-item label="资产名称">{{ currentAsset.asset_name }}</el-descriptions-item>
        <el-descriptions-item label="资产哈希">{{ currentAsset.file_hash || '—' }}</el-descriptions-item>
        <el-descriptions-item label="Token ID">{{ currentAsset.token_id || '—' }}</el-descriptions-item>
        <el-descriptions-item label="链上所有者地址">{{ currentAsset.owner_address || '—' }}</el-descriptions-item>
        <el-descriptions-item label="上链交易哈希">{{ currentAsset.chain_tx_hash || '—' }}</el-descriptions-item>
        <el-descriptions-item label="链上状态">{{ chainStatusText(currentAsset.chain_status) }}</el-descriptions-item>
        <el-descriptions-item label="上链时间">{{ currentAsset.chain_time || '—' }}</el-descriptions-item>
        <el-descriptions-item label="同步时间">{{ currentAsset.last_sync_time || '—' }}</el-descriptions-item>
        <el-descriptions-item label="失败原因">{{ currentAsset.fail_reason || '—' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
import { getAdminAssets, updateAssetStatus } from '@/api/admin'
import { formatPrice } from '@/utils/price'

const detailVisible = ref(false)
const currentAsset = ref(null)
const chainStatusText = (value) => ({ 0: '待上链', 1: '已上链', 2: '失败' })[value] || '暂无链上记录'
const loading = ref(false)
const assetList = ref([])
const searchQuery = ref('')
const statusFilter = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const stats = ref({
  total: 0,
  active: 0,
  soldOut: 0,
  offline: 0
})

const fetchAssetList = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      page_size: pageSize.value,
    }
    if (searchQuery.value) {
      params.keyword = searchQuery.value
    }
    if (statusFilter.value !== null) {
      params.status = statusFilter.value
    }

    const res = await getAdminAssets(params)
    if (res.data.status === 0) {
      assetList.value = res.data.data.list || []
      total.value = res.data.data.total || 0

      // 更新统计数据
      stats.value.total = res.data.data.stats?.total || 0
      stats.value.active = res.data.data.stats?.active || 0
      stats.value.soldOut = res.data.data.stats?.soldOut || 0
      stats.value.offline = res.data.data.stats?.offline || 0
    }
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '获取资产列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchAssetList()
}

const handleReset = () => {
  searchQuery.value = ''
  statusFilter.value = null
  currentPage.value = 1
  fetchAssetList()
}

const handleView = (row) => {
  currentAsset.value = row
  detailVisible.value = true
}

const handleChangeStatus = async (row) => {
  const newStatus = row.status === 0 ? 1 : 0
  const action = newStatus === 1 ? '上架' : '下架'

  try {
    await ElMessageBox.confirm(
      `确定要${action}该资产吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    const res = await updateAssetStatus(row.id, newStatus)
    if (res.data.status === 0) {
      ElMessage.success(`${action}成功`)
      fetchAssetList()
    } else {
      ElMessage.error(res.data.message || `${action}失败`)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`${action}失败`)
    }
  }
}

onMounted(() => {
  fetchAssetList()
})
</script>

<style lang="scss" scoped>
.asset-management {
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
