import axios from 'axios'
import router from '@/router'
import { clearAuthData, getStoredToken } from '@/utils/auth'

const instance = axios.create({
  // 默认走当前访问域名，部署到 HTTPS/Nginx 后由反向代理转发到后端。
  // 本地开发如需直连后端，可设置 VITE_API_BASE_URL=http://127.0.0.1:3007。
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// 添加请求拦截器
instance.interceptors.request.use(
  function (config) {
    // 在发送请求之前做些什么，比如添加token
    const token = getStoredToken()
    if (token) {
      config.headers['Authorization'] = token // 将token添加到请求头中
    }
    return config
  },
  function (error) {
    // 对请求错误做些什么
    return Promise.reject(error)
  },
)

// 添加响应拦截器
instance.interceptors.response.use(
  function (response) {
    const data = response?.data || {}
    const authFailed =
      response?.status === 401 ||
      data?.status === 1 && typeof data?.message === 'string' && data.message.includes('身份认证失败')

    if (authFailed) {
      clearAuthData()
      if (router.currentRoute.value.path !== '/login') {
        router.replace('/login')
      }
      return Promise.reject(new Error(data?.message || '身份认证失败，请重新登录'))
    }

    return response
  },
  function (error) {
    const status = error?.response?.status
    const message = error?.response?.data?.message || error?.message || ''
    const authFailed = status === 401 || String(message).includes('身份认证失败')

    if (authFailed) {
      clearAuthData()
      if (router.currentRoute.value.path !== '/login') {
        router.replace('/login')
      }
    }

    return Promise.reject(error)
  },
)

export default instance
