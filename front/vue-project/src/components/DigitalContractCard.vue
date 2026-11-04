<template>
  <div class="contract-card">
    <div class="contract-head">
      <div>
        <div class="contract-title">{{ contract?.contract_name || '未配置数字合约' }}</div>
        <div class="contract-id">{{ contract?.contract_id || '暂无合约ID' }}</div>
      </div>
      <div class="contract-tags">
        <el-tag size="small" effect="plain">{{ pcTypeText }}</el-tag>
        <el-tag size="small" :type="statusTagType" effect="plain">{{ contract?.status || '草稿' }}</el-tag>
      </div>
    </div>

    <div class="contract-meta">
      <div class="meta-row">
        <span>处理类型</span>
        <strong>{{ contract?.processing_type || tradeModeText }}</strong>
      </div>
      <div class="meta-row">
        <span>可执行操作</span>
        <strong>{{ contract?.operations || tradeModeText }}</strong>
      </div>
      <div class="meta-row">
        <span>到期时间</span>
        <strong>{{ formatDateTime(contract?.expiration_time) }}</strong>
      </div>
    </div>

    <div class="contract-actions">
      <el-button size="small" type="primary" plain @click="dialogVisible = true">
        查看合约
      </el-button>
    </div>
  </div>

  <el-dialog v-model="dialogVisible" title="数字合约详情" width="620px">
    <el-descriptions :column="1" border>
      <el-descriptions-item label="合约ID">{{ contract?.contract_id || '-' }}</el-descriptions-item>
      <el-descriptions-item label="合约名称">{{ contract?.contract_name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="产品名称">{{ contract?.product_name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="交付方式">{{ pcTypeText }}</el-descriptions-item>
      <el-descriptions-item label="处理类型">{{ contract?.processing_type || tradeModeText }}</el-descriptions-item>
      <el-descriptions-item label="可执行操作">{{ contract?.operations || tradeModeText }}</el-descriptions-item>
      <el-descriptions-item label="数量限制">{{ contract?.quantity_limit || '-' }}</el-descriptions-item>
      <el-descriptions-item label="到期时间">{{ formatDateTime(contract?.expiration_time) }}</el-descriptions-item>
      <el-descriptions-item label="合约状态">{{ contract?.status || '-' }}</el-descriptions-item>
      <el-descriptions-item label="描述">{{ contract?.contract_description || '-' }}</el-descriptions-item>
    </el-descriptions>
    <template #footer>
      <el-button type="primary" @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { formatDateTime } from '@/utils/dateTime'

const props = defineProps<{
  contract?: Record<string, any> | null
  tradeModeText?: string
}>()

const dialogVisible = ref(false)

const pcTypeText = computed(() => {
  const value = String(props.contract?.pc_type || '').toUpperCase()
  if (!value) return '-'
  const labelMap: Record<string, string> = {
    HE: '同态加密 HE',
    PRE: '代理重加密 PRE',
    FL: '联邦学习 FL',
    MPC: '多方安全计算 MPC',
    TEE: '可信执行环境 TEE',
  }
  return labelMap[value] || value
})

const statusTagType = computed(() => {
  const value = String(props.contract?.status || '')
  if (value.includes('完成') || value.includes('生效')) return 'success'
  if (value.includes('草稿')) return 'info'
  return 'warning'
})
</script>

<style scoped lang="scss">
.contract-card {
  border: 1px solid #ebeff7;
  border-radius: 8px;
  background: #fbfcff;
  padding: 14px;
}

.contract-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.contract-title {
  color: #22304f;
  font-size: 14px;
  font-weight: 700;
}

.contract-id {
  margin-top: 4px;
  color: #6f7c98;
  font-size: 12px;
  word-break: break-all;
}

.contract-tags {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.contract-meta {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.meta-row span {
  color: #7a86a3;
  font-size: 12px;
}

.meta-row strong {
  color: #22304f;
  font-size: 13px;
  text-align: right;
}

.contract-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
