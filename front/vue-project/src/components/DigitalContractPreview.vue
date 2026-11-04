<template>
  <el-card>
    <template #header>数字合约验证预览 · {{ orderNo }}</template>
    <el-alert v-if="contract.enabled === false" :title="contract.message" type="info" :closable="false" />
    <div v-if="contract.enabled === true">
    <p>验证状态：{{ contract.verification_status || 'UNVERIFIED' }}；策略版本：{{ contract.policy_version || '-' }}</p>
    <p>模型 SHA-256：{{ contract.model_hash_verified ? contract.model_file_hash : '尚未绑定真实模型' }}</p>
    <template v-if="role === 'buyer'">
      <el-select v-model="kind">
        <el-option v-for="item in modelKinds" :key="item" :label="item" :value="item" />
      </el-select>
      <input type="file" :disabled="busy" @change="selectModel" />
      <el-button :loading="busy" :disabled="!modelFile" @click="uploadModel">上传并计算模型哈希</el-button>
      <p>FL订单须分别绑定Top和Bottom模型，最终哈希为固定字段顺序清单的SHA-256。</p>
    </template>
    <template v-if="role === 'seller'">
      <p>扩展策略 JSON（有效期、交付次数仍在原合约配置窗口设置）：</p>
      <el-input v-model="policyText" type="textarea" :rows="5" />
      <el-button :loading="busy" @click="savePolicy">保存策略</el-button>
    </template>
    <el-button :loading="busy" @click="verify">远程验证</el-button>
    <el-button :disabled="busy" @click="refresh">刷新</el-button>
    <pre v-if="result">{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </el-card>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import http from '@/http/index.js'
const props = defineProps({ orderNo: { type: String, required: true }, role: { type: String, required: true } })
const contract = ref({})
const result = ref(null)
const busy = ref(false)
const policyText = ref('{}')
const modelFile = ref(null)
const kind = ref('primary')
const modelKinds = computed(() => contract.value.pc_type === 'FL' ? ['top', 'bottom'] : ['primary'])
const base = computed(() => `/asset/order/${encodeURIComponent(props.orderNo)}/digital-contract`)
async function run(work) {
  busy.value = true
  try { await work() } catch (error) { ElMessage.error(error.response?.data?.message || error.message) }
  finally { busy.value = false }
}
async function refresh() {
  await run(async () => {
    const { data } = await http.get(base.value)
    contract.value = data.data
    policyText.value = JSON.stringify(typeof data.data.policy_json === 'string' ? JSON.parse(data.data.policy_json) : data.data.policy_json || {}, null, 2)
    if (!modelKinds.value.includes(kind.value)) kind.value = modelKinds.value[0]
  })
}
function selectModel(event) { modelFile.value = event.target.files?.[0] || null }
async function uploadModel() {
  await run(async () => {
    const body = new FormData()
    body.append('kind', kind.value)
    body.append('model', modelFile.value)
    result.value = (await http.post(`${base.value}/model`, body, {
      headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000,
    })).data.data
  })
  await refresh()
}
async function savePolicy() {
  await run(async () => { result.value = (await http.put(`${base.value}/policy`, { policy: JSON.parse(policyText.value) })).data.data })
  await refresh()
}
async function verify() {
  await run(async () => { result.value = (await http.post(`${base.value}/verify`, {}, { timeout: 130000 })).data.data })
  await refresh()
}
watch(() => props.orderNo, refresh)
onMounted(refresh)
</script>

<style scoped>
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
input, .el-button, .el-select { margin: 6px; }
p { overflow-wrap: anywhere; }
</style>
