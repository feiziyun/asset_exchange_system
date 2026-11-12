<template>
  <div class="user-management">
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" class="page-alert" />
    <el-alert v-if="!auditorTargetReady" title="审计入口数据库字段尚未创建，请先执行 back/sql/2026-11-11-auditor-entry.sql；用户列表仍可查看。" type="warning" show-icon :closable="false" class="page-alert" />
    <el-card class="users-panel">
      <el-tabs v-model="selectedType" class="user-type-tabs" @tab-change="selectType">
        <el-tab-pane v-for="type in userTypes" :key="type.value" :name="type.value" :label="`${type.label}（${type.count}）`" />
      </el-tabs>
      <div class="panel-heading">
        <el-button type="primary" @click="openCreateDialog">新增用户</el-button>
      </div>

      <el-table :data="userList" style="width: 100%" v-loading="loading" empty-text="暂无用户">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="account" label="账号" width="180" show-overflow-tooltip />
        <el-table-column label="身份" width="100">
          <template #default="{ row }">{{ identityLabel(row.identity) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 0 ? 'success' : 'danger'">{{ row.status === 0 ? '正常' : '冻结' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="200">
          <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="330" fixed="right" class-name="actions-column">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleViewDetail(row)">查看详情</el-button>
            <el-button link type="primary" size="small" :disabled="row.identity === 'admin' || updatingRoleId === row.id" @click="openRoleEditor(row)">更改用户身份</el-button>
            <el-button link :type="row.status === 0 ? 'danger' : 'success'" size="small" :disabled="row.identity === 'admin'" @click="handleToggleStatus(row)">{{ row.status === 0 ? '冻结' : '解冻' }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handlePageSizeChange"
        @current-change="fetchUserList"
        style="margin-top: 20px; justify-content: flex-end"
      />
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="用户详情" width="600px">
      <el-descriptions :column="1" border v-if="currentDetail">
        <el-descriptions-item label="用户ID">{{ currentDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="账号">{{ currentDetail.account }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ currentDetail.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="身份">{{ identityLabel(currentDetail.identity) }}</el-descriptions-item>
        <el-descriptions-item label="部门">{{ currentDetail.department || '-' }}</el-descriptions-item>
        <el-descriptions-item label="性别">
          {{ currentDetail.sex === 'M' ? '男' : currentDetail.sex === 'F' ? '女' : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ currentDetail.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="currentDetail.status === 0" type="success">正常</el-tag>
          <el-tag v-else type="danger">冻结</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(currentDetail.create_time) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDateTime(currentDetail.update_time) }}</el-descriptions-item>
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

    <el-dialog v-model="roleDialogVisible" title="更改用户身份" width="min(1100px, 95vw)" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="账号"><el-input :model-value="roleEdit.account" disabled /></el-form-item>
        <el-form-item label="身份">
          <el-select v-model="roleEdit.identity" style="width: 100%">
            <el-option v-for="option in roleOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="roleEdit.identity === 'auditor'" label="审计入口">
          <el-select v-model="roleEdit.auditor_target" placeholder="请选择审计入口" style="width: 100%">
            <el-option label="全局审计总览（Hub）" value="HUB" />
            <el-option v-for="node in auditNodes" :key="node.node_id" :label="nodeLabel(node)" :value="`NODE:${node.node_id}`" />
          </el-select>
        </el-form-item>
      </el-form>
      <template v-if="roleEdit.identity === 'auditor'">
        <el-divider content-position="left">审计节点配置</el-divider>
        <p class="audit-node-hint">先配置节点查看凭据，再将审计用户分配到指定节点；选择 Hub 时无需节点凭据。</p>
        <AdminAuditNodes />
      </template>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="Boolean(updatingRoleId)" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createUser, getUserList, updateUserStatus, updateUserIdentity, getAuditNodes } from '@/api/admin'
import AdminAuditNodes from '@/views/admin/auditNodes/index.vue'
import { formatDateTime } from '@/utils/dateTime'

const loading = ref(false)
const loadError = ref('')
const auditorTargetReady = ref(true)
const userList = ref([])
const selectedType = ref('all')
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
const userTypes = computed(() => [
  { value: 'all', label: '全部用户', count: Number(stats.value.total) },
  { value: 'ordinary', label: '普通用户', count: Number(stats.value.buyer) + Number(stats.value.seller) },
  { value: 'admin', label: '管理员', count: Number(stats.value.admin) },
  { value: 'regulator', label: '监管用户', count: Number(stats.value.regulator) },
  { value: 'auditor', label: '审计用户', count: Number(stats.value.auditor) },
])
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
const identityLabel = (identity) => roleOptions.find((option) => option.value === identity)?.label || identity || '-'
const updatingRoleId = ref('')
const auditNodes = ref([])
const roleDialogVisible = ref(false)
const roleEdit = ref({ id: 0, account: '', identity: '', auditor_target: '' })
let userListRequestId = 0
const nodeLabel = (node) => `${node.node_name || node.node_id}${node.online ? '' : '（离线）'}`
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
  if (createForm.value.identity === 'auditor' && !auditorTargetReady.value) {
    ElMessage.warning('请先执行审计入口数据库迁移')
    return
  }
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
  const requestId = ++userListRequestId
  loading.value = true
  loadError.value = ''
  userList.value = []
  total.value = 0
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value
    }
    if (selectedType.value !== 'all') params.identity = selectedType.value

    const res = await getUserList(params)
    if (requestId !== userListRequestId) return
    if (res.data.status === 0) {
      auditorTargetReady.value = res.data.data.auditorTargetReady !== false
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
    } else {
      throw new Error(res.data.message || '获取用户列表失败')
    }
  } catch (error) {
    if (requestId !== userListRequestId) return
    loadError.value = error?.response?.data?.message || error?.message || '获取用户列表失败'
    ElMessage.error(loadError.value)
  } finally {
    if (requestId === userListRequestId) loading.value = false
  }
}

const selectType = () => {
  currentPage.value = 1
  fetchUserList()
}

const handlePageSizeChange = () => {
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

const openRoleEditor = (row) => {
  roleEdit.value = {
    id: row.id,
    account: row.account,
    identity: row.identity,
    auditor_target: row.auditor_target || '',
  }
  roleDialogVisible.value = true
}

const saveRole = async () => {
  if (roleEdit.value.identity === 'auditor') {
    if (!auditorTargetReady.value) return ElMessage.warning('请先执行审计入口数据库迁移')
    if (!roleEdit.value.auditor_target) return ElMessage.warning('请选择审计入口')
  }
  updatingRoleId.value = roleEdit.value.id
  try {
    const res = await updateUserIdentity(
      roleEdit.value.id,
      roleEdit.value.identity,
      roleEdit.value.identity === 'auditor' ? roleEdit.value.auditor_target : '',
    )
    if (res.data.status !== 0) throw new Error(res.data.message || '身份更新失败')
    ElMessage.success('用户身份已更新')
    roleDialogVisible.value = false
    await fetchUserList()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || '身份更新失败')
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
  .page-alert { margin-bottom: 16px; }
  .audit-node-hint { margin: -8px 0 14px; color: #667085; font-size: 13px; }
  .user-type-tabs {
    margin-bottom: 12px;
    :deep(.el-tabs__nav) { float: none; }
    :deep(.el-tabs__item) {
      position: relative;
      padding: 0 22px;
      font-size: 17px;
      font-weight: 500;
    }
    :deep(.el-tabs__item:first-child) { padding-left: 4px; }
    :deep(.el-tabs__item + .el-tabs__item::before) {
      content: '';
      position: absolute;
      left: 0;
      top: 12px;
      height: 16px;
      border-left: 1px solid #d6deea;
    }
  }
  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 16px;
  }
  :deep(.actions-column .cell) {
    white-space: nowrap;
  }
}
</style>
