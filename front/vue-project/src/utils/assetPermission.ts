export interface AssetPermissionRule {
  can_sell_ownership: number
  can_sell_view_right: number
  can_sell_process_right: number
}

export const getFirstAvailableTradeMode = (rule?: Partial<AssetPermissionRule>): string => {
  if (Number(rule?.can_sell_ownership) === 1) return 'ownership'
  if (Number(rule?.can_sell_view_right) === 1) return 'view'
  if (Number(rule?.can_sell_process_right) === 1) return 'process'
  return ''
}

export const getTradePermissionLabels = (rule?: Partial<AssetPermissionRule>) => {
  const labels: string[] = []
  if (Number(rule?.can_sell_ownership) === 1) labels.push('所有权')
  if (Number(rule?.can_sell_view_right) === 1) labels.push('查阅权')
  if (Number(rule?.can_sell_process_right) === 1) labels.push('加工使用权')
  return labels
}
