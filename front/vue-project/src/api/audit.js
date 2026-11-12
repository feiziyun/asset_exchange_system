import request from '@/http/index.js'

// Hub follows the reference flow: set the cookie on the public trading backend,
// whose host must also receive the Hub authorization callback.
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
