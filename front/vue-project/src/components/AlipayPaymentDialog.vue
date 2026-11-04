<template>
  <el-dialog :model-value="modelValue" title="" width="360px" destroy-on-close
    @update:model-value="emit('update:modelValue', $event)">
    <template #header>
      <div class="alipay-scan-title">
        <template v-if="method === 'alipay'">
          <img :src="alipayLogo" alt="" />
          <span>支付宝扫码支付</span>
        </template>
        <template v-else>
          <span class="balance-logo">¥</span>
          <span>余额支付</span>
        </template>
      </div>
    </template>
    <div class="payment-body" v-loading="loading">
      <div v-if="status === 'PENDING' && !qrImage" class="payment-methods" role="radiogroup" aria-label="支付方式">
        <button type="button" class="payment-method" :class="{ active: method === 'alipay' }" @click="method = 'alipay'">
          <img :src="alipayLogo" alt="" class="alipay-logo" />
          <span>支付宝</span>
        </button>
        <button type="button" class="payment-method" :class="{ active: method === 'balance' }" @click="method = 'balance'">
          <span class="balance-logo">¥</span>
          <span>余额支付</span>
        </button>
      </div>
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
import alipayLogo from '@/assets/img/支付宝logo.png'

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
.payment-methods { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
.payment-method { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border: 1px solid #dcdfe6; border-radius: 6px; background: #fff; color: #303133; cursor: pointer; font-size: 14px; transition: border-color .2s, background-color .2s; }
.payment-method.active { border-color: #1677ff; background: #f0f7ff; color: #1677ff; box-shadow: 0 0 0 1px #1677ff inset; }
.alipay-logo { width: 22px; height: 22px; object-fit: contain; }
.balance-logo { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: #eef2f7; color: #5f6b7a; font-weight: 700; }
.alipay-scan-title { display: flex; align-items: center; gap: 7px; color: #1677ff; font-size: 15px; font-weight: 600; }
.alipay-scan-title img { width: 22px; height: 22px; object-fit: contain; }
</style>
