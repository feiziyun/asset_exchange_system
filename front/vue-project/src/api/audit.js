import request from '@/http/index.js'

// Start on the same public host that receives the Hub callback, so the
// browser sends the handoff cookie on the return navigation.
const auditRequestConfig = () => ({
  baseURL: window.location.origin,
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
