import request from '@/http/index.js'

export const startPamEntry = (pccContractId = '') => {
  return request.post('/api/pam/entry-start',
    pccContractId ? { pcc_contract_id: pccContractId } : {},
    { withCredentials: true },
  )
}

export const createPamNodeTicket = (nodeId = '') => request.post('/api/pam/node-ticket', nodeId ? { node_id: nodeId } : {})
