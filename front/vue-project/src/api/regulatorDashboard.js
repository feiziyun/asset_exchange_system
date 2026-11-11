import instance from '@/http/index.js'

// 与原型主页相同的统计接口；由本系统的兼容路由提供同名响应。
export const getTodayTransactionStats = () => instance.get('/api/get-today-transaction-stats')
export const getTotalTransactionStats = () => instance.get('/api/get-total-transaction-stats')
export const getTransactionHistory = () => instance.get('/api/get-transaction-history')
export const getIndustryTransactionStats = () => instance.get('/api/industry-transaction-stats')
