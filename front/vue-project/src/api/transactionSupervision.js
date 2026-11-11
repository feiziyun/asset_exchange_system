import instance from '@/http/index.js'

// 后端在配置独立交易监管服务时原样转发；未配置时返回本系统业务记录。
const API_ROOT = '/api/transaction-supervision'

export const fetchTransactionOverview = (params = {}, signal) => {
  return instance.get(`${API_ROOT}/overview`, { params, signal, timeout: 15000 })
}

export const fetchTransactions = (params = {}, signal) => {
  return instance.get(`${API_ROOT}/transactions`, { params, signal, timeout: 20000 })
}

export const fetchTransactionDetail = (txHash, signal) => {
  return instance.get(`${API_ROOT}/transactions/${encodeURIComponent(txHash)}`, {
    signal,
    timeout: 15000,
  })
}

export const updateTransactionStatus = (txHash, data = {}, signal) => {
  return instance.patch(`${API_ROOT}/transactions/${encodeURIComponent(txHash)}/status`, data, {
    signal,
    timeout: 15000,
  })
}
