import instance from '@/http/index.js'

// 注册接口
export const register = (data) => {
  const { account, password, identity } = data
  return instance.post('/api/register', { account, password, identity })
}

// 登录接口
export const login = (data) => {
  const { account, password } = data
  return instance.post('/api/login', { account, password })
}

// 找回密码：验证账号邮箱
export const verifyAccountEmail = (data) => {
  const { account, email } = data
  return instance.post('/api/verifyEmail', { account, email })
}

// 找回密码：重置密码
export const resetPassword = (data) => {
  const { account, password: newPassword } = data
  return instance.post('/api/resetPassword', { account, newPassword })
}
