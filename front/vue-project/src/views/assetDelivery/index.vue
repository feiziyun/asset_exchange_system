<template>
  <div class="delivery-redirect" v-loading="true">
    正在进入交付工作台...
  </div>
</template>

<script lang="ts" setup>
// 交付工作台入口：按原始系统思路拆成卖家页和买家页。
// 卖家进入 index1.vue，对应 frontend/src/views/DeliverySeller2.vue；
// 买家进入 index2.vue，对应 frontend/src/views/DeliveryBuyer2.vue。
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRoleKey, parseTokenPayload } from '@/utils/auth'

const router = useRouter()
const route = useRoute()

onMounted(() => {
  const payload = parseTokenPayload() || {}
  const role = getRoleKey(payload.identity || '')
  if (role === 'auditor') {
    router.replace({
      path: '/audit-entry',
      query: route.query,
    })
    return
  }
  const target = role === 'buyer' ? '/assetDelivery/buyer' : '/assetDelivery/seller'
  router.replace({
    path: target,
    query: route.query,
  })
})
</script>

<style scoped>
.delivery-redirect {
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #536073;
}
</style>
