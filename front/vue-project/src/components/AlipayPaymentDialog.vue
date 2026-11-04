<template>
  <el-dialog :model-value="modelValue" title="支付订单" width="360px" destroy-on-close
    @update:model-value="emit('update:modelValue', $event)">
    <div class="payment-body" v-loading="loading">
      <el-radio-group v-if="status === 'PENDING' && !qrImage" v-model="method" aria-label="支付方式">
        <el-radio-button value="alipay">支付宝</el-radio-button>
        <el-radio-button value="balance">余额支付</el-radio-button>
      </el-radio-group>
      <div v-if="method === 'balance' && !qrImage" class="wallet-balance">可用余额：¥ {{ balance }}</div>
      <div class="amount">¥ {{ amount }}</div>
      <div v-if="qrImage && status === 'PENDING'" class="countdown">
        剩余支付时间 <strong>{{ countdownText }}</strong>
      </div>
      <img v-if="qrImage && status === 'PENDING'" :src="qrImage" alt="支付宝付款二维码" class="qr" />
      <el-result v-else-if="status === 'PAID'" icon="success" title="支付成功" />
      <el-result v-else-if="status === 'EXPIRED'" icon="warning" title="支付时间已结束" />
      <el-result v-else-if="status === 'CANCELLED'" icon="warning" title="订单已关闭" />
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <div v-if="status === 'PENDING' && qrImage" class="order-no">订单：{{ orderNo }}</div>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
      <el-button v-if="status === 'PENDING' && !qrImage" type="primary" :loading="loading" @click="submitPayment">确认支付</el-button>
      <el-button v-if="error && status === 'PENDING' && qrImage" type="primary" :loading="loading" @click="loadPayment">重试</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { createAlipayPayment, getAlipayPaymentStatus } from '@/api/asset'
import { getWallet, getWalletOrderAmount, payWithBalance } from '@/api/wallet'

const props = defineProps<{ modelValue: boolean; orderNo: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'paid'): void }>()
const loading = ref(false)
const method = ref('alipay')
const balance = ref('0.00')
const qrImage = ref('')
const amount = ref('0.00')
const status = ref('PENDING')
const error = ref('')
const remainingSeconds = ref(0)
const countdownText = computed(() => {
  const minutes = Math.floor(remainingSeconds.value / 60)
  const seconds = remainingSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
let timer: ReturnType<typeof setInterval> | undefined
let countdownTimer: ReturnType<typeof setInterval> | undefined
let expiresAt = 0
let checking = false

const stopPolling = () => {
  if (timer) clearInterval(timer)
  timer = undefined
}

const stopCountdown = () => {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = undefined
}

const stopTimers = () => {
  stopPolling()
  stopCountdown()
}

const checkStatus = async () => {
  if (checking || !props.modelValue || !props.orderNo) return
  checking = true
  try {
    const response = await getAlipayPaymentStatus(props.orderNo)
    if (response.data.status !== 0) throw new Error(response.data.message || '查询支付状态失败')
    const nextStatus = response.data.data.status
    status.value = nextStatus === 'PENDING' && expiresAt && Date.now() >= expiresAt
      ? 'EXPIRED'
      : nextStatus
    if (status.value === 'PAID') {
      stopTimers()
      emit('paid')
      emit('update:modelValue', false)
    } else if (status.value === 'EXPIRED') {
      remainingSeconds.value = 0
      stopCountdown()
    } else if (status.value === 'CANCELLED') {
      stopTimers()
    }
  } catch (cause) {
    error.value = (cause as any)?.response?.data?.message || (cause as Error).message
    stopPolling()
  } finally {
    checking = false
  }
}

const updateCountdown = () => {
  remainingSeconds.value = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  if (remainingSeconds.value === 0) {
    status.value = 'EXPIRED'
    stopCountdown()
    void checkStatus()
  }
}

const loadPayment = async () => {
  if (!props.orderNo) return
  stopTimers()
  loading.value = true
  error.value = ''
  qrImage.value = ''
  expiresAt = 0
  remainingSeconds.value = 0
  status.value = 'PENDING'
  try {
    const response = await createAlipayPayment(props.orderNo)
    if (response.data.status !== 0) throw new Error(response.data.message || '创建支付订单失败')
    const data = response.data.data
    status.value = data.status
    if (data.status === 'PAID') {
      emit('paid')
      emit('update:modelValue', false)
      return
    }
    amount.value = data.amount
    expiresAt = new Date(data.expires_at).getTime()
    if (!Number.isFinite(expiresAt)) throw new Error('支付有效期无效')
    qrImage.value = await QRCode.toDataURL(data.qr_code, { width: 220, margin: 1 })
    updateCountdown()
    if (remainingSeconds.value > 0) countdownTimer = setInterval(updateCountdown, 1000)
    timer = setInterval(checkStatus, 3000)
  } catch (cause) {
    error.value = (cause as any)?.response?.data?.message || (cause as Error).message
  } finally {
    loading.value = false
  }
}

const submitPayment = async () => {
  if (method.value === 'alipay') return loadPayment()
  loading.value = true
  error.value = ''
  try {
    const response = await payWithBalance(props.orderNo)
    if (response.data.status !== 0) throw new Error(response.data.message || '余额支付失败')
    status.value = 'PAID'
    emit('paid')
    emit('update:modelValue', false)
  } catch (cause) {
    error.value = (cause as any)?.response?.data?.message || (cause as Error).message
  } finally { loading.value = false }
}

watch(() => [props.modelValue, props.orderNo], ([visible]) => {
  if (visible) {
    stopTimers()
    qrImage.value = ''
    error.value = ''
    status.value = 'PENDING'
    method.value = 'alipay'
    void getWallet().then((response) => {
      if (response.data.status === 0) balance.value = response.data.data.balance
    }).catch(() => {})
    void getWalletOrderAmount(props.orderNo).then((response) => {
      if (response.data.status === 0) amount.value = response.data.data.amount
    }).catch(() => {})
  }
  else stopTimers()
})
onBeforeUnmount(stopTimers)
</script>

<style scoped>
.payment-body { display: flex; min-height: 260px; align-items: center; flex-direction: column; gap: 12px; }
.amount { font-size: 24px; font-weight: 600; color: #d94841; }
.countdown { color: #606266; font-size: 14px; }
.countdown strong { color: #d94841; font-variant-numeric: tabular-nums; }
.qr { width: 220px; height: 220px; }
.order-no { color: #667085; font-size: 12px; overflow-wrap: anywhere; }
.wallet-balance { color: #606266; font-size: 14px; }
</style>
