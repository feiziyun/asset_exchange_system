import request from '@/http/index.js'

// The Hub handoff and node launch navigate to the public backend origin.
// API requests stay on the configured API origin so HTTPS pages can use a proxy.
const auditRequestConfig = () => ({ withCredentials: true })

export const startPamEntry = (pccContractId = '') => {
  return request.post('/api/pam/entry-start',
    pccContractId ? { pcc_contract_id: pccContractId } : {},
    auditRequestConfig(),
  )
}

export const createPamNodeTicket = (nodeId = '') => request.post('/api/pam/node-ticket',
  nodeId ? { node_id: nodeId } : {}, auditRequestConfig())
