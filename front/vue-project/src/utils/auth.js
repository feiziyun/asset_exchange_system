const TOKEN_KEY = 'token'

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY) || ''

export const clearAuthData = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('identity')
  localStorage.removeItem('login_role')
  localStorage.removeItem('user_role')
}

// 解析 token payload
export const parseTokenPayload = () => {
  const token = getStoredToken()
  if (!token) return null

  const pureToken = token.startsWith('Bearer ') ? token.slice(7) : token
  const parts = pureToken.split('.')
  if (parts.length < 2) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    )
    return JSON.parse(json)
  } catch (e) {
    return null
  }
}

export const isTokenValid = () => {
  const token = getStoredToken()
  if (!token) return false

  const payload = parseTokenPayload()
  if (!payload) return false

  if (!payload.exp) return true

  const now = Math.floor(Date.now() / 1000)
  return Number(payload.exp) > now
}

// 获取角色标识（admin/seller/buyer/regulator/auditor）
export const getRoleKey = (identity = '') => {
  const value = String(identity || '').toLowerCase()
  if (value === 'admin') return 'admin'
  if (value === 'seller') return 'seller'
  if (value === 'buyer') return 'buyer'
  if (value === 'regulator') return 'regulator'
  if (value === 'auditor') return 'auditor'
  return 'buyer'  // 默认为 buyer
}

// 获取角色显示名称
export const getRoleLabel = (identity = '') => {
  const key = getRoleKey(identity)
  if (key === 'admin') return '管理员'
  if (key === 'seller') return '卖家'
  if (key === 'buyer') return '买家'
  if (key === 'regulator') return '监管'
  if (key === 'auditor') return '审计'
  return '用户'
}
