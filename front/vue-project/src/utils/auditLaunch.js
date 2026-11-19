import { createPamNodeTicket, startPamEntry } from '@/api/audit'

export const launchAssignedAudit = async target => {
  const assigned = String(target || '')
  if (!assigned) throw new Error('管理员尚未分配审计入口，请联系管理员')
  let url = ''
  if (assigned === 'HUB') {
    const res = await startPamEntry()
    url = res.data?.url || ''
    if (!url) throw new Error(res.data?.error || res.data?.message || '审计平台未返回跳转地址')
  } else if (assigned.startsWith('NODE:')) {
    const res = await createPamNodeTicket(assigned.slice(5))
    url = res.data?.url || ''
    if (!url) throw new Error(res.data?.message || '生成审计节点入口失败')
  } else {
    throw new Error('管理员分配的审计入口无效，请联系管理员')
  }
  window.location.href = url
}
