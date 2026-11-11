import request from '@/http/index.js'

// 获取所有用户列表
export const getUserList = (params) => {
  return request.get('/admin/users', { params })
}
export const getAdminAssets = (params) => request.get('/admin/assets', { params })
export const getAdminOrders = (params) => request.get('/admin/orders', { params })

// 管理员创建用户
export const createUser = (data) => {
  return request.post('/admin/users', data)
}

// 冻结/解冻用户
export const updateUserStatus = (id, status) => {
  return request.patch(`/admin/users/${id}/status`, { status })
}

// 修改用户角色
export const updateUserIdentity = (id, identity, auditorTarget = '') => {
  return request.patch(`/admin/users/${id}/identity`, { identity, auditor_target: auditorTarget })
}

export const getAuditNodes = () => request.get('/admin/audit-nodes')
export const getAuditNodeCredentials = () => request.get('/admin/audit-nodes/credentials')
export const saveAuditNodeCredentials = (nodeId, data) => request.post(`/admin/audit-nodes/${encodeURIComponent(nodeId)}/credentials`, data)

// 获取链上信息
export const getChainInfo = (params) => {
  return request.get('/admin/chain-info', { params })
}

// 管理员修改资产状态
export const updateAssetStatus = (id, status) => {
  return request.patch(`/admin/asset/${id}/status`, { status })
}
