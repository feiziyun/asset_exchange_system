import { createRouter, createWebHashHistory } from 'vue-router'
import { clearAuthData, getStoredToken, parseTokenPayload, getRoleKey, isTokenValid } from '@/utils/auth'

const routes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    name: 'login',
    path: '/login',
    component: () => import('@/views/login/index.vue'),
  },
  {
    name: 'menu',
    path: '/menu',
    component: () => import('@/views/menu/index.vue'),
    children: [
      { path: '', redirect: '/menu/home' },
      {
        name: 'home',
        path: '/home',
        component: () => import('@/views/home/index.vue'),
      },
      {
        name: 'chainRegister',
        path: '/chainRegister',
        component: () => import('@/views/chainRegister/index.vue'),
      },
      {
        name: 'assetMarket',
        path: '/assetMarket',
        component: () => import('@/views/assetMarket/index.vue'),
      },
      {
        name: 'assetManagement',
        path: '/assetManagement',
        component: () => import('@/views/assetManagement/index.vue'),
      },
      {
        name: 'assetOrders',
        path: '/assetOrders',
        component: () => import('@/views/assetOrders/index.vue'),
      },
      {
        name: 'assetDelivery',
        path: '/assetDelivery',
        component: () => import('@/views/assetDelivery/index.vue'),
      },
      {
        name: 'assetDeliverySeller',
        path: '/assetDelivery/seller',
        component: () => import('@/views/assetDelivery/index1.vue'),
      },
      {
        name: 'assetDeliveryBuyer',
        path: '/assetDelivery/buyer',
        component: () => import('@/views/assetDelivery/index2.vue'),
      },
      {
        name: 'assetDetail',
        path: '/assetDetail/:id',
        component: () => import('@/views/assetDetail/index.vue'),
      },
      {
        name: 'profile',
        path: '/profile',
        component: () => import('@/views/profile/index.vue'),
      },
      {
        name: 'auditEntry',
        path: '/audit-entry',
        component: () => import('@/views/auditEntry/index.vue'),
      },
      {
        name: 'regulation',
        path: '/regulation',
        component: () => import('@/views/regulation/index.vue'),
      },
      {
        name: 'services',
        path: '/services',
        component: () => import('@/views/services/index.vue'),
      },
      {
        name: 'transactionSupervision',
        path: '/transaction-supervision',
        component: () => import('@/views/transactionSupervision/index.vue'),
      },
    ],
  },
  {
    name: 'admin',
    path: '/admin',
    component: () => import('@/views/admin/layout.vue'),
    children: [
      { path: '', redirect: '/admin/dashboard' },
      {
        name: 'adminDashboard',
        path: 'dashboard',
        component: () => import('@/views/home/index.vue'),
      },
      {
        name: 'adminAssets',
        path: 'assets',
        component: () => import('@/views/admin/assetManagement/index.vue'),
      },
      {
        name: 'adminChainInfo',
        path: 'chain-info',
        component: () => import('@/views/admin/chainInfo/index.vue'),
      },
      {
        name: 'adminOrders',
        path: 'orders',
        component: () => import('@/views/admin/orderManagement/index.vue'),
      },
      {
        name: 'adminUsers',
        path: 'users',
        component: () => import('@/views/admin/userManagement/index.vue'),
      },
      {
        name: 'adminAuditNodes',
        path: 'audit-nodes',
        component: () => import('@/views/admin/auditNodes/index.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const token = getStoredToken()
  const hasToken = Boolean(token)
  const validToken = hasToken && isTokenValid()

  if (hasToken && !validToken) {
    clearAuthData()
    next('/login')
    return
  }

  // 未登录用户访问非登录页，跳转到登录页
  if (to.path !== '/login' && !validToken) {
    next('/login')
    return
  }

  // 已登录用户访问登录页，跳转到对应首页
  if (to.path === '/login' && validToken) {
    const payload = parseTokenPayload() || {}
    const role = getRoleKey(payload.identity || '')
    if (role === 'admin') {
      next('/admin/dashboard')
    } else if (role === 'auditor') {
      next('/audit-entry')
    } else if (role === 'regulator') {
      next('/home')
    } else {
      next('/home')
    }
    return
  }

  // 权限检查
  if (validToken) {
    const payload = parseTokenPayload() || {}
    const role = getRoleKey(payload.identity || '')

    // 管理员访问普通页面，重定向到管理员页面
    if (role === 'admin' && !to.path.startsWith('/admin')) {
      next('/admin/dashboard')
      return
    }

    if (role === 'regulator') {
      const allowed =
        to.path === '/home' ||
        to.path === '/assetMarket' ||
        to.path === '/regulation' ||
        to.path === '/transaction-supervision' ||
        to.path.startsWith('/assetDetail/')

      if (!allowed) {
        next('/home')
        return
      }
    }

    if (role === 'auditor') {
      const allowed =
        to.path === '/assetManagement' ||
        to.path === '/audit-entry' ||
        to.path.startsWith('/profile')

      if (!allowed) {
        next('/audit-entry')
        return
      }
    }

    // 非管理员访问管理员页面，按角色跳回自己的入口
    if (to.path.startsWith('/admin') && role !== 'admin') {
      if (role === 'auditor') {
        next('/audit-entry')
      } else if (role === 'regulator') {
        next('/home')
      } else {
        next('/assetMarket')
      }
      return
    }

    if (to.path === '/home' && role !== 'admin' && role !== 'regulator') {
      if (role === 'auditor') {
        next('/audit-entry')
      } else {
        next('/assetMarket')
      }
      return
    }

    // 买家不能访问上链登记页面
    if (role === 'buyer' && to.path === '/chainRegister') {
      next('/assetManagement')
      return
    }

    if (role === 'buyer' && to.path === '/assetOrders') {
      next('/assetManagement')
      return
    }
  }

  next()
})

export default router
