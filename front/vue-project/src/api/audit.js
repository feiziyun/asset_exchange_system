import request from '@/http/index.js'

// Browser navigates to a short-lived handoff page after authorization.
const auditRequestConfig = () => ({
  baseURL: window.location.origin,
  withCredentials: true,
})

export const startPamEntry = () => request.post('/api/pam/entry-start', {}, auditRequestConfig())

export const createPamNodeTicket = (nodeId = '') => request.post('/api/pam/node-ticket',
  nodeId ? { node_id: nodeId } : {}, auditRequestConfig())
