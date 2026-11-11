<template>
  <div class="common-layout">
    <el-container>
      <el-header height="auto" style="padding: 0">
        <div class="header-wrapped">
          <!-- logo + 登陆信息 -->
          <div class="header-top">
            <div class="header-top-left">
              <img src="@/assets/logo.svg" alt="Logo" style="height: 50px" />
            </div>
            <!-- 搜索框 -->
            <div class="header-top-middle">
              <el-input
                v-model="searchBox"
                class="search-input"
                placeholder="搜索资产、交易、用户…"
                clearable
              >
                <template #prefix>
                  <el-icon class="search-icon"><Search /></el-icon>
                </template>
              </el-input>
            </div>
            <!-- 右侧：通知 + 用户 -->
            <div class="header-top-right">
              <!-- 消息通知 -->
              <!-- <el-badge :value="3" class="notice-badge">
                <el-button :icon="Bell" circle text class="icon-btn" />
              </el-badge> -->

              <el-divider direction="vertical" class="divider" />

              <!-- 用户头像 + 下拉 -->
              <el-dropdown trigger="click" popper-class="user-dropdown-popper" @command="handleUserCommand">
                <div class="user-info">
                  <el-avatar :size="34" :src="circleUrl" class="user-avatar" />
                  <div class="user-text">
                    <span class="user-name">{{ currentUserName }}</span>
                    <span class="user-role">{{ currentUserRole }}</span>
                  </div>
                  <el-icon class="arrow-icon"><ArrowDown /></el-icon>
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="currentRoleKey !== 'regulator'" command="profile" :icon="User">设置账号</el-dropdown-item>
                    <el-dropdown-item v-if="currentRoleKey !== 'regulator'" command="avatar" :icon="Picture">更改头像</el-dropdown-item>
                    <el-dropdown-item divided command="logout" :icon="SwitchButton">
                      退出登录
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- 下半部分：目录（内容居中） -->
          <div class="header-bottom">
            <el-menu
              router
              :default-active="activeMenuPath"
              mode="horizontal"
              class="nav-menu"
              :ellipsis="false"
            >
              <el-menu-item v-if="currentRoleKey === 'regulator'" index="/home" class="nav-item">
                <el-icon><DataBoard /></el-icon>主页数据面板
              </el-menu-item>
              <el-menu-item v-if="currentRoleKey === 'regulator'" index="/assetMarket" class="nav-item">
                <el-icon><TrendCharts /></el-icon>交易市场
              </el-menu-item>
              <el-menu-item
                v-if="currentRoleKey === 'buyer' || currentRoleKey === 'seller'"
                index="/assetMarket"
                class="nav-item"
              >
                <el-icon><TrendCharts /></el-icon>交易市场
              </el-menu-item>
              <el-menu-item v-if="currentRoleKey === 'regulator'" index="/regulation" class="nav-item">
                <el-icon><TrendCharts /></el-icon>监管平台
              </el-menu-item>
              <el-menu-item v-if="currentRoleKey === 'regulator'" index="/transaction-supervision" class="nav-item">
                <el-icon><TrendCharts /></el-icon>交易穿透监管
              </el-menu-item>
              <el-menu-item v-if="currentRoleKey === 'auditor'" index="/audit-entry" class="nav-item">
                <el-icon><Wallet /></el-icon>审计入口
              </el-menu-item>
              <el-menu-item
                v-if="currentRoleKey === 'seller'"
                index="/chainRegister"
                class="nav-item"
              >
                <el-icon><Connection /></el-icon>上链登记
              </el-menu-item>
              <el-menu-item
                v-if="currentRoleKey === 'buyer' || currentRoleKey === 'seller' || currentRoleKey === 'auditor'"
                index="/assetManagement"
                class="nav-item"
              >
                <el-icon><Wallet /></el-icon>{{ assetManageMenuText }}
              </el-menu-item>
              <el-menu-item
                v-if="currentRoleKey === 'seller'"
                index="/assetOrders"
                class="nav-item"
              >
                <el-icon><Wallet /></el-icon>{{ orderMenuText }}
              </el-menu-item>
              <el-menu-item
                v-if="currentRoleKey === 'buyer' || currentRoleKey === 'seller'"
                index="/assetDelivery"
                class="nav-item"
              >
                <el-icon><Van /></el-icon>交付工作台
              </el-menu-item>
              <el-menu-item v-if="currentRoleKey !== 'regulator'" index="/profile" class="nav-item">
                <el-icon><UserFilled /></el-icon>个人中心
              </el-menu-item>

              <!-- 右侧填充 + 实时时间 -->
              <div class="menu-spacer" />
              <div class="nav-clock">{{ currentTime }}</div>
            </el-menu>
          </div>
        </div>
      </el-header>

      <el-main style="padding: 0"> <router-view></router-view> </el-main>

      <el-footer class="app-footer" height="48px">
        <span>© 2025 链资产平台 · 区块链数字资产管理系统</span>
        <span class="footer-links">
          <a href="#">隐私政策</a>
          <el-divider direction="vertical" />
          <a href="#">服务条款</a>
          <el-divider direction="vertical" />
          <a href="#">帮助中心</a>
        </span>
      </el-footer>
    </el-container>
  </div>
</template>
<script lang="ts" setup>
import { useRoute } from 'vue-router'
import { ref, reactive, toRefs, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { clearAuthData, parseTokenPayload, getRoleKey, getRoleLabel } from '@/utils/auth'
import { getUserInfo } from '@/api/userInfo'
import {
  Search,
  Bell,
  ArrowDown,
  User,
  Picture,
  SwitchButton,
  Connection,
  UserFilled,
  Van,
  TrendCharts,
  DataBoard,
  Wallet,
} from '@element-plus/icons-vue'

/* ── 实时时钟 ── */
const currentTime = ref('')
let timer: ReturnType<typeof setInterval>

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
  syncAvatar()
  window.addEventListener('user-avatar-updated', syncAvatar)
})
onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('user-avatar-updated', syncAvatar)
})

const router = useRouter()
const logout = () => {
  console.log('退出登录')
  clearAuthData()
  router.push('/login')
}

const handleUserCommand = (command: string) => {
  if (command === 'profile') {
    router.push('/profile')
    return
  }
  if (command === 'avatar') {
    router.push({ path: '/profile', query: { focus: 'avatar' } })
    return
  }
  if (command === 'logout') {
    logout()
  }
}

const state = reactive({
  circleUrl: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
})
const { circleUrl } = toRefs(state)
const route = useRoute()
const searchBox = ref('')

// 从 token 中解析用户信息
const tokenPayload = parseTokenPayload() || {}
const currentRoleKey = ref(getRoleKey(tokenPayload.identity || ''))
const currentUserName = ref(tokenPayload.account || tokenPayload.name || '未登录用户')
const currentUserRole = ref(getRoleLabel(tokenPayload.identity || ''))

// 根据角色动态计算菜单文本
const assetManageMenuText = computed(() => {
  if (currentRoleKey.value === 'seller') return '我的资产'
  if (currentRoleKey.value === 'buyer') return '我的资产'
  if (currentRoleKey.value === 'auditor') return '我的资产'
  if (currentRoleKey.value === 'regulator') return '监管工作台'
  return '资产监管'
})

const orderMenuText = computed(() => {
  if (currentRoleKey.value === 'buyer') return '我的购买'
  return '订单中心'
})

const activeMenuPath = computed(() => {
  if (route.path.startsWith('/assetDelivery')) return '/assetDelivery'
  if (route.path.startsWith('/transaction-supervision')) return '/transaction-supervision'
  if (route.path.startsWith('/audit-entry')) return '/audit-entry'
  return route.path
})

const syncAvatar = async () => {
  const userId = tokenPayload.id
  if (!userId) return
  try {
    const res = await getUserInfo(userId)
    const data = res.data?.data || {}
    if (data.avatar) {
      state.circleUrl = `data:${data.avatarMimeType || 'image/jpeg'};base64,${data.avatar}`
    }
  } catch (_error) {}
}
</script>

<style lang="scss" scoped>
$nav-bg: #0f2744;
$nav-hover: #1a3a5c;
$nav-active: #1677ff;
$nav-text: rgba(255, 255, 255, 0.82);
$nav-text-act: #ffffff;
$header-bg: #ffffff;
$header-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
$brand-color: #0f2744;
$accent: #1677ff;
$main-bg: #f4f6fb;
$footer-bg: #fff;
$radius: 8px;

.header-wrapped {
  background: #fff;
  padding: 0;
  height: auto; /* 允许上下两行撑开 */
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: column;

  .header-top {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    box-sizing: border-box;
    padding: 5px 20px;

    .header-top-left {
      display: flex;
      align-items: center;
    }
    /* ── 中间搜索框 ── */
    .header-top-middle {
      flex: 1;
      display: flex;
      justify-content: center;

      .search-input {
        width: 100%;
        max-width: 420px;

        :deep(.el-input__wrapper) {
          border-radius: 20px !important;
          background: #f0f4fc !important;
          box-shadow: none !important;
          border: 1.5px solid transparent;
          transition: border-color 0.25s;

          &:hover,
          &.is-focus {
            border-color: $accent !important;
            background: #fff !important;
            box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12) !important;
          }
        }
      }

      .search-icon {
        color: #aab;
      }
    }
    /* ── 右侧用户区 ── */
    .header-top-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;

      .icon-btn {
        font-size: 18px !important;
        color: #666 !important;
      }

      :deep(.notice-badge .el-badge__content) {
        font-size: 10px;
      }

      .divider {
        height: 24px !important;
        margin: 0 8px !important;
      }

      .user-info {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        padding: 5px 10px;
        border-radius: $radius;
        transition: background 0.2s;

        &:hover {
          background: #f4f6fb;
        }

        .user-avatar {
          border: 2px solid #e0e8f8;
          flex-shrink: 0;
        }

        .user-text {
          display: flex;
          flex-direction: column;
          line-height: 1.3;
          .user-name {
            font-size: 14px;
            font-weight: 600;
            color: #222;
          }
          .user-role {
            font-size: 11px;
            color: #999;
          }
        }
        .arrow-icon {
          color: #bbb;
          font-size: 12px;
        }
      }
    }
  }

  .header-bottom {
    width: 100%;

    :deep(.nav-menu.el-menu--horizontal) {
      width: 100% !important;
      border-bottom: none !important;
      background: $nav-bg !important;
      display: flex;
      align-items: stretch;
      padding: 0 12px;
      height: 49px;
    }

    :deep(.nav-menu .nav-item.el-menu-item) {
      color: $nav-text !important;
      background: transparent !important;
      border-bottom: 3px solid transparent !important;
      height: 49px;
      line-height: 43px;
      font-size: 14px;
      font-weight: 500;
      padding: 0 20px;
      display: flex;
      align-items: center;
      gap: 5px;
      letter-spacing: 0.02em;
      transition:
        background 0.2s,
        color 0.2s,
        border-color 0.2s;

      &:hover {
        background: $nav-hover !important;
        color: $nav-text-act !important;
      }

      &.is-active {
        color: $nav-text-act !important;
        border-bottom-color: $nav-active !important;
        background: rgba(22, 119, 255, 0.18) !important;
      }
    }

    /* ── 菜单填充 & 时钟（flex 子项，直接在 nav-menu 内） ── */
    .menu-spacer {
      flex: 1;
    }

    .nav-clock {
      color: rgba(235, 226, 226, 0.55);
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      padding-right: 8px;
    }
  }
}

.el-main {
  min-height: calc(100vh - 48px - 108px);
  background: #f5f7fb;
}

.app-footer {
  background: $footer-bg;
  border-top: 1px solid #eef0f5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  font-size: 12px;
  color: #aaa;

  .footer-links {
    display: flex;
    align-items: center;
    gap: 4px;

    a {
      color: #aaa;
      text-decoration: none;
      transition: color 0.2s;

      &:hover {
        color: $accent;
      }
    }
  }
}
</style>
