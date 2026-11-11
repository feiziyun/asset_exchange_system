<template>
  <div class="admin-layout">
    <el-container>
      <el-aside width="200px" class="admin-aside">
        <div class="admin-logo">
          <h2>管理后台</h2>
        </div>
        <el-menu
          router
          :default-active="$route.path"
          class="admin-menu"
          background-color="transparent"
          text-color="rgba(255, 255, 255, 0.75)"
          active-text-color="#ffffff"
        >
          <el-menu-item index="/admin/dashboard">
            <el-icon><DataBoard /></el-icon>
            <span>控制面板</span>
          </el-menu-item>
          <el-menu-item index="/admin/assets">
            <el-icon><Box /></el-icon>
            <span>管理资产</span>
          </el-menu-item>
          <el-menu-item index="/admin/chain-info">
            <el-icon><Link /></el-icon>
            <span>链上信息</span>
          </el-menu-item>
          <el-menu-item index="/admin/orders">
            <el-icon><Document /></el-icon>
            <span>管理订单</span>
          </el-menu-item>
          <el-menu-item index="/admin/users">
            <el-icon><User /></el-icon>
            <span>管理用户</span>
          </el-menu-item>
          <el-menu-item index="/admin/audit-nodes">
            <el-icon><Document /></el-icon>
            <span>审计节点配置</span>
          </el-menu-item>
          <el-menu-item @click="logout">
            <el-icon><SwitchButton /></el-icon>
            <span>退出登录</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <el-main class="admin-main">
          <router-view></router-view>
        </el-main>

        <el-footer class="admin-footer" height="48px">
          <span>© 2025 链资产平台 · 区块链数字资产管理系统</span>
        </el-footer>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { clearAuthData } from '@/utils/auth'
import { Box, Link, Document, User, SwitchButton, DataBoard } from '@element-plus/icons-vue'

const router = useRouter()

const logout = () => {
  clearAuthData()
  router.push('/login')
}
</script>

<style lang="scss" scoped>
$nav-bg: #0f2744;
$nav-hover: #1a3a5c;
$nav-active: #1677ff;
$accent: #1677ff;

.admin-layout {
  height: 100vh;
  overflow: hidden;

  .el-container {
    height: 100%;
  }

  .admin-aside {
    background-color: $nav-bg;
    height: 100vh;
    overflow-y: auto;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);

    .admin-logo {
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f2744 0%, #1a3a5c 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);

      h2 {
        color: #fff;
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        letter-spacing: 1px;
      }
    }

    .admin-menu {
      border-right: none;

      :deep(.el-menu-item) {
        height: 56px;
        line-height: 56px;
        color: rgba(255, 255, 255, 0.75) !important;
        margin: 4px 8px;
        border-radius: 6px;
        transition: all 0.3s;

        .el-icon {
          font-size: 18px;
          margin-right: 8px;
        }

        span {
          font-size: 14px;
          font-weight: 500;
        }

        &:hover {
          background-color: $nav-hover !important;
          color: #fff !important;
        }

        &.is-active {
          background-color: rgba(22, 119, 255, 0.15) !important;
          color: #fff !important;
          border-left: 3px solid $accent;
          padding-left: 17px;
        }
      }
    }
  }

  .admin-main {
    background-color: #f5f7fb;
    padding: 24px;
    overflow-y: auto;
    height: calc(100vh - 48px);
  }

  .admin-footer {
    background: #fff;
    border-top: 1px solid #eef0f5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #aaa;
  }
}
</style>
