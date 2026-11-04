<template>
  <div class="audit-entry-page">
    <div class="audit-entry-card">
      <div class="title">审计入口</div>
      <div class="desc">
        {{ loading ? '正在进入外部审计平台，请稍候…' : errorMessage || '点击下方按钮进入审计平台' }}
      </div>
      <div class="actions">
        <el-button v-if="errorMessage" type="primary" @click="openAuditPlatform">重试</el-button>
        <el-button v-else-if="!loading" type="primary" @click="openAuditPlatform">进入审计平台</el-button>
        <el-button @click="goProfile">个人中心</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { startPamEntry } from '@/api/audit'

const router = useRouter()
const loading = ref(false)
const errorMessage = ref('')

const openAuditPlatform = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await startPamEntry()
    const url = res.data?.entry_url || ''
    if (!url) {
      throw new Error(res.data?.error || res.data?.message || '未获取到审计平台地址')
    }
    window.location.href = url
  } catch (error) {
    const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || '进入审计平台失败'
    errorMessage.value = message
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}

const goProfile = () => {
  router.push('/profile')
}

onMounted(() => {
  openAuditPlatform()
})
</script>

<style scoped>
.audit-entry-page {
  min-height: calc(100vh - 160px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  background: #f4f6fb;
}

.audit-entry-card {
  width: min(100%, 520px);
  padding: 36px 32px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 39, 68, 0.08);
  text-align: center;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #0f2744;
}

.desc {
  margin-top: 14px;
  color: #5c6883;
  line-height: 1.8;
}

.actions {
  margin-top: 24px;
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
