import instance from '@/http/index.js'

export const getWallet = () => instance.get('/asset/wallet')
export const getWalletLedger = (page = 1) => instance.get('/asset/wallet/ledger', { params: { page } })
export const getWalletOrderAmount = (orderNo: string) => instance.get(`/asset/wallet/order/${orderNo}`)
export const createRecharge = (amount: string) => instance.post('/asset/wallet/recharge', { amount })
export const getRechargeStatus = (outTradeNo: string) => instance.get(`/asset/wallet/recharge/${outTradeNo}`)
export const payWithBalance = (orderNo: string) => instance.post(`/asset/wallet/pay/${orderNo}`)
