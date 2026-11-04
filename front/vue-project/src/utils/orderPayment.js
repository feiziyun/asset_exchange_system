import { getPaymentMode, payOrder } from '@/api/asset'

export const startOrderPayment = async (orderNo) => {
  const modeResponse = await getPaymentMode()
  if (modeResponse.data.status !== 0) {
    throw new Error(modeResponse.data.message || '获取支付配置失败')
  }
  if (modeResponse.data.data?.skip_payment !== true) return 'alipay'

  const payResponse = await payOrder(orderNo)
  if (payResponse.data.status !== 0) {
    throw new Error(payResponse.data.message || '确认订单失败')
  }
  return 'skipped'
}
