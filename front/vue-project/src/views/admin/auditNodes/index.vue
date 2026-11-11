<template>
  <div class="audit-nodes-page">
    <el-card>
      <div class="panel-head">
        <div>
          <h2>审计节点配置</h2>
          <p>配置节点查看账号。密码加密保存，不会回显。</p>
        </div>
        <el-button :loading="loading" @click="fetchNodes">刷新节点</el-button>
      </div>
      <el-table :data="nodes" v-loading="loading" style="width: 100%">
        <el-table-column prop="node_name" label="节点" min-width="160" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }"><el-tag :type="row.online ? 'success' : 'info'">{{ row.online ? '在线' : '离线' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="节点账号" min-width="170">
          <template #default="{ row }"><el-input v-model="forms[row.node_id].username" placeholder="节点查看账号" /></template>
        </el-table-column>
        <el-table-column label="节点密码" min-width="200">
          <template #default="{ row }"><el-input v-model="forms[row.node_id].password" type="password" show-password :placeholder="row.has_credentials ? '不修改则留空' : '请输入节点密码'" /></template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button type="primary" :loading="Boolean(saving[row.node_id])" @click="save(row)">保存</el-button></template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAuditNodeCredentials, saveAuditNodeCredentials } from '@/api/admin'

const nodes = ref([])
const forms = reactive({})
const saving = reactive({})
const loading = ref(false)

const fetchNodes = async () => {
  loading.value = true
  try {
    const res = await getAuditNodeCredentials()
    if (res.data.status !== 0) throw new Error(res.data.message || '加载节点失败')
    nodes.value = res.data.data?.nodes || []
    for (const node of nodes.value) forms[node.node_id] = { username: node.username || '', password: '' }
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || '加载节点失败')
  } finally {
    loading.value = false
  }
}

const save = async (node) => {
  const form = forms[node.node_id] || {}
  if (!form.username) return ElMessage.warning('请填写节点账号')
  if (!node.has_credentials && !form.password) return ElMessage.warning('首次配置必须填写节点密码')
  saving[node.node_id] = true
  try {
    const res = await saveAuditNodeCredentials(node.node_id, form)
    if (res.data.status !== 0) throw new Error(res.data.message || '保存节点凭据失败')
    ElMessage.success('节点凭据已保存')
    await fetchNodes()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || '保存节点凭据失败')
  } finally {
    saving[node.node_id] = false
  }
}

onMounted(fetchNodes)
</script>

<style scoped>
.audit-nodes-page { padding: 20px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.panel-head h2 { margin: 0 0 6px; color: #0f2744; }
.panel-head p { margin: 0; color: #667085; }
</style>
