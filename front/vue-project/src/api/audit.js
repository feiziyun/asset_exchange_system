import request from '@/http/index.js'

// Set VITE_AUDIT_LAUNCH_ORIGIN to the public trading-backend HTTP origin when
// the audit node is HTTP. The entry cookie and the launch page then share a host.
const auditRequestConfig = () => ({
  ...(import.meta.env.VITE_AUDIT_LAUNCH_ORIGIN ? { baseURL: import.meta.env.VITE_AUDIT_LAUNCH_ORIGIN } : {}),
  withCredentials: true,
})

export const startPamEntry = (pccContractId = '') => {
  return request.post('/api/pam/entry-start',
    pccContractId ? { pcc_contract_id: pccContractId } : {},
    auditRequestConfig(),
  )
}

export const createPamNodeTicket = (nodeId = '') => request.post('/api/pam/node-ticket',
  nodeId ? { node_id: nodeId } : {}, auditRequestConfig())
