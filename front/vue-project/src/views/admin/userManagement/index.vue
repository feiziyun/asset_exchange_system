<template>
  <div class="user-management">
    <el-card class="stats-card">
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-label">总用户数</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">管理员</div>
          <div class="stat-value">{{ stats.admin }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">卖家</div>
          <div class="stat-value">{{ stats.seller }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">买家</div>
          <div class="stat-value">{{ stats.buyer }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">监管</div>
          <div class="stat-value">{{ stats.regulator }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">审计</div>
          <div class="stat-value">{{ stats.auditor }}</div>
        </div>
      </div>
    </el-card>

    <el-card class="table-card">
      <div class="toolbar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索账号或姓名"
          style="width: 300px"
          clearable
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="identityFilter" placeholder="身份筛选" style="width: 150px" @change="handleSearch">
          <el-option label="全部" :value="null" />
          <el-option label="管理员" value="admin" />
          <el-option label="卖家" value="seller" />
          <el-option label="买家" value="buyer" />
          <el-option label="监管" value="regulator" />
          <el-option label="审计" value="auditor" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态筛选" style="width: 150px" @change="handleSearch">
          <el-option label="全部" :value="null" />
          <el-option label="正常" :value="0" />
          <el-option label="冻结" :value="1" />
        </el-select>
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>查询
        </el-button>
        <el-button @click="handleReset">
          <el-icon><RefreshLeft /></el-icon>重置
        </el-button>
        <el-button type="primary" @click="openCreateDialog">
          新增用户
        </el-button>
      </div>

      <el-table :data="userList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="account" label="账号" width="150" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="identity" label="身份" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.identity === 'admin'" type="danger">管理员</el-tag>
            <el-tag v-else-if="row.identity === 'seller'" type="warning">卖家</el-tag>
            <el-tag v-else-if="row.identity === 'regulator'" type="primary">监管</el-tag>
            <el-tag v-else-if="row.identity === 'auditor'" type="info">审计</el-tag>
            <el-tag v-else type="success">买家</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="department" label="部门" min-width="150" />
        <el-table-column label="审计入口" min-width="160">
          <template #default="{ row }">{{ targetLabel(row.auditor_target) }}</template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 0" type="success">正常</el-tag>
            <el-tag v-else type="danger">冻结</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="角色调整" width="170">
          <template #default="{ row }">
            <el-select
              :model-value="row.identity"
              size="small"
              style="width: 140px"
              :disabled="row.identity === 'admin' || updatingRoleId === row.id"
              @change="(val) => handleIdentityChange(row, val)"
            >
              <el-option
                v-for="option in roleOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="创建时间" width="180" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleViewDetail(row)">详情</el-button>
            <el-button v-if="row.identity === 'auditor'" link type="primary" size="small" @click="openAuditorRole(row)">审计入口</el-button>
            <el-button
              link
              :type="row.status === 0 ? 'danger' : 'success'"
              size="small"
              @click="handleToggleStatus(row)"
              :disabled="row.identity === 'admin'"
            >
              {{ row.status === 0 ? '冻结' : '解冻' }}
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
        @current-change="handleSearch"
        style="margin-top: 20px; justify-content: flex-end"
      />
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="用户详情" width="600px">
      <el-descriptions :column="1" border v-if="currentDetail">
        <el-descriptions-item label="用户ID">{{ currentDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="账号">{{ currentDetail.account }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ currentDetail.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="身份">
          <el-tag v-if="currentDetail.identity === 'admin'" type="danger">管理员</el-tag>
          <el-tag v-else-if="currentDetail.identity === 'seller'" type="warning">卖家</el-tag>
          <el-tag v-else-if="currentDetail.identity === 'regulator'" type="primary">监管</el-tag>
          <el-tag v-else-if="currentDetail.identity === 'auditor'" type="info">审计</el-tag>
          <el-tag v-else type="success">买家</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="部门">{{ currentDetail.department || '-' }}</el-descriptions-item>
        <el-descriptions-item label="审计入口">{{ targetLabel(currentDetail.auditor_target) }}</el-descriptions-item>
        <el-descriptions-item label="性别">
          {{ currentDetail.sex === 'M' ? '男' : currentDetail.sex === 'F' ? '女' : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ currentDetail.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="currentDetail.status === 0" type="success">正常</el-tag>
          <el-tag v-else type="danger">冻结</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ currentDetail.create_time }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ currentDetail.update_time }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="createDialogVisible" title="新增用户" width="460px" @closed="resetCreateForm">
      <el-form :model="createForm" label-width="86px">
        <el-form-item label="身份">
          <el-select v-model="createForm.identity" style="width: 100%">
            <el-option
              v-for="option in createRoleOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="createForm.identity === 'auditor'" label="审计入口">
          <el-select v-model="createForm.auditor_target" placeholder="请选择审计入口" style="width: 100%">
            <el-option label="全局审计总览（Hub）" value="HUB" />
            <el-option v-for="node in auditNodes" :key="node.node_id" :label="nodeLabel(node)" :value="`NODE:${node.node_id}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="账号">
          <el-input v-model.trim="createForm.account" placeholder="6-12位字母或数字" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="createForm.password" placeholder="6-12位小写字母或数字，不能为纯数字" show-password />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model.trim="createForm.name" placeholder="选填" />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model.trim="createForm.department" placeholder="选填" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model.trim="createForm.email" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreateUser">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="roleDialogVisible" title="分配审计入口" width="460px">
      <el-form label-width="90px">
        <el-form-item label="账号"><el-input :model-value="roleEdit.account" disabled /></el-form-item>
        <el-form-item label="审计入口">
          <el-select v-model="roleEdit.auditor_target" placeholder="请选择审计入口" style="width: 100%">
            <el-option label="全局审计总览（Hub）" value="HUB" />
            <el-option v-for="node in auditNodes" :key="node.node_id" :label="nodeLabel(node)" :value="`NODE:${node.node_id}`" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="Boolean(updatingRoleId)" @click="saveAuditorRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
import { createUser, getUserList, updateUserStatus, updateUserIdentity, getAuditNodes } from '@/api/admin'

const loading = ref(false)
const userList = ref([])
const searchQuery = ref('')
const identityFilter = ref(null)
const statusFilter = ref(null)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const detailDialogVisible = ref(false)
const currentDetail = ref(null)
const createDialogVisible = ref(false)
const creating = ref(false)
const createForm = ref({
  account: '',
  password: '',
  identity: 'regulator',
  auditor_target: '',
  name: '',
  department: '',
  email: '',
})

const stats = ref({
  total: 0,
  admin: 0,
  seller: 0,
  buyer: 0,
  regulator: 0,
  auditor: 0,
})
const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '卖家', value: 'seller' },
  { label: '买家', value: 'buyer' },
  { label: '监管', value: 'regulator' },
  { label: '审计', value: 'auditor' },
]
const createRoleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '监管', value: 'regulator' },
  { label: '审计', value: 'auditor' },
  { label: '卖家', value: 'seller' },
  { label: '买家', value: 'buyer' },
]
const updatingRoleId = ref('')
const auditNodes = ref([])
const roleDialogVisible = ref(false)
const roleEdit = ref({ id: 0, account: '', auditor_target: '' })
const nodeLabel = (node) => `${node.node_name || node.node_id}${node.online ? '' : '（离线）'}`
const targetLabel = (target) => {
  if (target === 'HUB') return '全局审计总览（Hub）'
  if (String(target || '').startsWith('NODE:')) {
    const id = String(target).slice(5)
    const node = auditNodes.value.find((item) => item.node_id === id)
    return node ? nodeLabel(node) : id
  }
  return '未分配'
}
const fetchAuditNodes = async () => {
  try {
    const res = await getAuditNodes()
    auditNodes.value = res.data?.data?.nodes || []
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '获取审计节点失败')
  }
}

const resetCreateForm = () => {
  createForm.value = {
    account: '',
    password: '',
    identity: 'regulator',
    auditor_target: '',
    name: '',
    department: '',
    email: '',
  }
}

const openCreateDialog = () => {
  createDialogVisible.value = true
}

const handleCreateUser = async () => {
  if (!createForm.value.account || !createForm.value.password) {
    ElMessage.warning('请填写账号和密码')
    return
  }
  if (createForm.value.identity === 'auditor' && !createForm.value.auditor_target) {
    ElMessage.warning('审计方必须选择审计入口')
    return
  }
  creating.value = true
  try {
    const res = await createUser(createForm.value)
    if (res.data.status === 0) {
      ElMessage.success('创建成功')
      createDialogVisible.value = false
      fetchUserList()
    } else {
      ElMessage.error(res.data.message || '创建失败')
    }
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '创建失败')
  } finally {
    creating.value = false
  }
}

const fetchUserList = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value
    }
    if (searchQuery.value) {
      params.keyword = searchQuery.value
    }
    if (identityFilter.value) {
      params.identity = identityFilter.value
    }
    if (statusFilter.value !== null) {
      params.status = statusFilter.value
    }

    const res = await getUserList(params)
    if (res.data.status === 0) {
      userList.value = res.data.data.list || []
      total.value = res.data.data.total || 0

      // 更新统计数据
      if (res.data.data.stats) {
        stats.value.total = res.data.data.stats.total || 0
        stats.value.admin = res.data.data.stats.admin || 0
        stats.value.seller = res.data.data.stats.seller || 0
        stats.value.buyer = res.data.data.stats.buyer || 0
        stats.value.regulator = res.data.data.stats.regulator || 0
        stats.value.auditor = res.data.data.stats.auditor || 0
      }
    }
  } catch (error) {
    ElMessage.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchUserList()
}

const handleReset = () => {
  searchQuery.value = ''
  identityFilter.value = null
  statusFilter.value = null
  currentPage.value = 1
  fetchUserList()
}

const handleViewDetail = (row) => {
  currentDetail.value = row
  detailDialogVisible.value = true
}

const handleToggleStatus = async (row) => {
  const newStatus = row.status === 0 ? 1 : 0
  const action = newStatus === 1 ? '冻结' : '解冻'

  try {
    await ElMessageBox.confirm(
      `确定要${action}用户 ${row.account} 吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    const res = await updateUserStatus(row.id, newStatus)
    if (res.data.status === 0) {
      ElMessage.success(`${action}成功`)
      fetchUserList()
    } else {
      ElMessage.error(res.data.message || `${action}失败`)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`${action}失败`)
    }
  }
}

const handleIdentityChange = async (row, identity) => {
  if (!identity || row.identity === identity) return
  if (identity === 'auditor') {
    openAuditorRole(row)
    return
  }
  updatingRoleId.value = row.id
  try {
    const res = await updateUserIdentity(row.id, identity)
    if (res.data.status === 0) {
      ElMessage.success('角色更新成功')
      fetchUserList()
    } else {
      ElMessage.error(res.data.message || '角色更新失败')
    }
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '角色更新失败')
  } finally {
    updatingRoleId.value = ''
  }
}

const openAuditorRole = (row) => {
  roleEdit.value = { id: row.id, account: row.account, auditor_target: row.auditor_target || '' }
  roleDialogVisible.value = true
}

const saveAuditorRole = async () => {
  if (!roleEdit.value.auditor_target) {
    ElMessage.warning('请选择审计入口')
    return
  }
  updatingRoleId.value = roleEdit.value.id
  try {
    const res = await updateUserIdentity(roleEdit.value.id, 'auditor', roleEdit.value.auditor_target)
    if (res.data.status !== 0) throw new Error(res.data.message || '角色更新失败')
    ElMessage.success('审计入口已分配')
    roleDialogVisible.value = false
    await fetchUserList()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || '审计入口分配失败')
  } finally {
    updatingRoleId.value = ''
  }
}

onMounted(() => {
  fetchUserList()
  fetchAuditNodes()
})
</script>

<style lang="scss" scoped>
.user-management {
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
