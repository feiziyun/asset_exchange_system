<template>
  <div class="audit-nodes-page">
    <el-card>
      <div class="panel-head">
        <div>
          <h2 class="page-title">审计节点目录</h2>
          <p>节点查看账号由各节点运维台创建，用户进入节点时自行输入账号和密码。</p>
        </div>
        <el-button :loading="loading" @click="fetchNodes">刷新节点</el-button>
      </div>
      <el-table :data="nodes" v-loading="loading" style="width: 100%">
        <el-table-column prop="node_name" label="节点" min-width="160" />
        <el-table-column prop="node_id" label="节点 ID" min-width="160" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ row.online ? '在线' : '离线' }}</template>
        </el-table-column>
        <el-table-column prop="web_origin" label="访问地址" min-width="220" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAuditNodes } from '@/api/admin'

const nodes = ref([])
const loading = ref(false)
const fetchNodes = async () => {
  loading.value = true
  try {
    const res = await getAuditNodes()
    if (!Array.isArray(res.data?.nodes)) throw new Error(res.data?.message || '加载节点失败')
    nodes.value = res.data.nodes
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || '加载节点失败')
  } finally { loading.value = false }
}
onMounted(fetchNodes)
</script>

<style scoped>
.audit-nodes-page { padding: 20px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.panel-head h2 { margin: 0 0 6px; color: #1f2328; }
.panel-head p { margin: 0; color: #667085; }
</style>
