<template>
  <div class="common-layout">
    <el-container>
      <el-header class="header-wrapped">
        <div class="header-content">
          <h3>基于区块链的自动驾驶数字资产流通平台</h3>
          <span class="welcome">欢迎登陆</span>
        </div>
      </el-header>

      <el-main>
        <div class="login-wrapped">
          <img class="bg" src="@/assets/login-bg.jpg" alt="" />
          <div class="content">
            <el-card class="box-card">
              <el-tabs v-model="activeName" class="login-tabs" :stretch="true">
                <el-tab-pane label="登陆" name="first">
                  <!-- 登录表单 -->
                  <form class="login-form" @submit.prevent="Login">
                    <el-form-item label="账号">
                      <el-autocomplete
                        v-model="loginData.account"
                        class="account-input"
                        name="username"
                        autocomplete="off"
                        placeholder="请输入账号"
                        :fetch-suggestions="suggestSavedAccounts"
                        :trigger-on-focus="true"
                        @input="onAccountInput"
                        @select="selectSavedAccount"
                      />
                    </el-form-item>
                    <el-form-item label="密码">
                      <el-input
                        v-model="loginData.password"
                        name="password"
                        type="password"
                        autocomplete="current-password"
                        placeholder="请输入密码"
                        show-password
                      />
                    </el-form-item>
                    <el-form-item class="remember-row">
                      <el-checkbox v-model="rememberAccount">记住账号</el-checkbox>
                      <el-checkbox v-model="savePassword">记住密码</el-checkbox>
                    </el-form-item>

                    <div class="login-foot-wrapped">
                    <!-- 忘记密码 -->
                    <div class="forget-password">
                      <span class="forget-password-button" @click="openForget">忘记密码</span>
                    </div>
                    <!-- 登陆按钮 -->
                    <el-button type="success" class="login-button" native-type="submit"
                      >登 录</el-button
                    >
                    <!-- 转去注册 -->
                    <div class="go-register">
                      <span>还没有账号？</span>
                      <span class="go-registet-button" @click="goRegister">马上注册</span>
                    </div>
                    </div>
                  </form>
                </el-tab-pane>

                <el-tab-pane label="注册" name="second">
                  <!-- 注册表单 -->
                  <el-form class="register-form">
                    <el-form-item label="身份">
                      <el-radio-group v-model="registerData.identity">
                        <el-radio value="seller">卖家</el-radio>
                        <el-radio value="buyer">买家</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <el-form-item label="账号">
                      <el-input v-model="registerData.account" placeholder="账号为字符" />
                    </el-form-item>
                    <el-form-item label="密码">
                      <el-input v-model="registerData.password" placeholder="请输入密码" />
                    </el-form-item>
                    <el-form-item label="确认密码">
                      <el-input v-model="registerData.confirmPassword" placeholder="请输入密码" />
                    </el-form-item>
                  </el-form>
                  <!-- 注册按钮 -->
                  <el-button type="success" class="register-button" @click="Register"
                    >注 册</el-button
                  >
                </el-tab-pane>
              </el-tabs>
            </el-card>
          </div>
        </div>
      </el-main>

      <el-footer class="footer-wrapped">
        <div class="foot-content">
          <div class="title">
            <span>基于区块链的自动驾驶数字资产交易系统</span>
          </div>
        </div>
      </el-footer>
    </el-container>
    <!-- forget-password  ref 拿到这个元素 -->
    <forgetPassword ref="forgetPasswordRef"></forgetPassword>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue'
import forgetPassword from './components/forget_password.vue'
import { ElMessage } from 'element-plus'
import { login, register } from '@/api/login'
import { useRouter } from 'vue-router'
import { getRoleKey } from '@/utils/auth'
import { loadSavedPassword, removeSavedPassword, saveLoginPassword } from '@/utils/savedPasswords'

const router = useRouter()
const activeName = ref('first') // 默认登录表单
const rememberAccount = ref(false) // 是否记住账号
const savePassword = ref(false)
const savedAccounts = ref<string[]>([])
const SAVED_ACCOUNTS_KEY = 'savedLoginAccounts'

interface formData {
  account: string
  password: string
  confirmPassword?: string
  identity?: 'seller' | 'buyer'
}

const loginData: formData = reactive({
  account: '',
  password: '',
})

const registerData: formData = reactive({
  identity: 'seller',
  account: '',
  password: '',
  confirmPassword: '',
})

// 页面加载时读取保存的账号
onMounted(async () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]')
    savedAccounts.value = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    savedAccounts.value = []
  }
  const savedAccount = localStorage.getItem('savedAccount')
  if (savedAccount) {
    loginData.account = savedAccount
    rememberAccount.value = true
    await fillSavedPassword(savedAccount)
  }
})

const suggestSavedAccounts = (_query: string, callback: (items: { value: string }[]) => void) => {
  callback(savedAccounts.value.map((value) => ({ value })))
}

const onAccountInput = () => {
  loginData.password = ''
  savePassword.value = false
}

const fillSavedPassword = async (account: string) => {
  try {
    const password = await loadSavedPassword(account)
    if (loginData.account !== account) return
    loginData.password = password || ''
    savePassword.value = Boolean(password)
  } catch (error) {
    console.warn('读取已保存的密码失败:', error)
  }
}

const selectSavedAccount = async (item: { value: string }) => {
  const account = item.value
  loginData.account = account
  loginData.password = ''
  rememberAccount.value = true
  await fillSavedPassword(account)
}

// 转去注册
const goRegister = () => {
  activeName.value = 'second'
}

// 忘记密码弹窗
const forgetPasswordRef = ref()
const openForget = () => {
  //调用子组件的方法，打开弹窗
  forgetPasswordRef.value?.open()
}

// 注册
const Register = async () => {
  if (registerData.password !== registerData.confirmPassword) {
    ElMessage.error('两次输入的密码不一致！')
    return
  }
  const res = await register(registerData)
  // console.log(res);
  if (res.data.status === 0) {
    ElMessage.success('注册成功！')
    activeName.value = 'first' // 注册成功后自动切换到登录页
  } else {
    ElMessage.error(res.data.message || '注册失败！')
  }
}

// 登录
const Login = async () => {
  try {
    const res = await login(loginData)
    if (res.data.status === 0) {
      ElMessage.success('登录成功！')
      const { token } = res.data
      const identity = res.data.identity || res.data.results?.identity || 'buyer'

      localStorage.setItem('token', token)
      localStorage.setItem('identity', identity)

      if (rememberAccount.value) {
        localStorage.setItem('savedAccount', loginData.account)
      } else {
        localStorage.removeItem('savedAccount')
      }
      if (savePassword.value) {
        try {
          await saveLoginPassword(loginData.account, loginData.password)
        } catch (error) {
          console.warn('保存登录密码失败:', error)
          savePassword.value = false
        }
      } else {
        try {
          await removeSavedPassword(loginData.account)
        } catch (error) {
          console.warn('清除已保存的密码失败:', error)
        }
      }

      if (rememberAccount.value || savePassword.value) {
        savedAccounts.value = [loginData.account, ...savedAccounts.value.filter((account) => account !== loginData.account)]
      } else {
        savedAccounts.value = savedAccounts.value.filter((account) => account !== loginData.account)
      }
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(savedAccounts.value))

      const role = getRoleKey(identity)
      if (role === 'admin') {
        router.push('/admin/dashboard')
      } else if (role === 'auditor') {
        router.push('/audit-entry')
      } else if (role === 'regulator') {
        router.push('/regulation')
      } else {
        router.push('/assetMarket')
      }
    } else {
      ElMessage.error(res.data.message || '登录失败！')
    }
  } catch (error: any) {
    const message =
      error?.name === 'QuotaExceededError'
        ? '浏览器本地存储空间已满，请清理后重试登录'
        : error?.response?.data?.message || error?.message || '登录失败'
    ElMessage.error(message)
  }
}
</script>

<style lang="scss" scoped>
.common-layout {
  min-height: 100vh;
  background: #f6f8fa;
  color: #24292f;
}

.common-layout > .el-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header-wrapped {
  padding: 0;
  height: 64px;
  display: flex;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #d8dee4;

  .header-content {
    width: min(100%, 1200px);
    margin: 0 auto;
    padding: 0 24px;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;

    h3 {
      margin: 0;
      flex: 1 1 auto;
      min-width: 0;
      font-size: 17px;
      line-height: 1.4;
      font-weight: 600;
    }

    .welcome {
      flex: 0 0 auto;
      font-size: 13px;
      color: #57606a;
      white-space: nowrap;
    }
  }
}

.el-main {
  padding: 0;
  flex: 1;

  .login-wrapped {
    position: relative;
    width: 100%;
    min-height: calc(100vh - 128px);

    .bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.65;
    }

    .content {
      position: relative;
      display: flex;
      justify-content: flex-end;
      box-sizing: border-box;
      padding: clamp(48px, 10vh, 120px) 10% 64px;

      .box-card {
        width: min(100%, 370px);
        border: 1px solid #d8dee4;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 8px 24px rgb(27 31 36 / 6%);

        :deep(.el-card__body) {
          padding: 26px 28px 28px;
        }

        :deep(.el-tabs__header) {
          margin-bottom: 24px;
        }

        :deep(.el-tabs__item) {
          height: 42px;
          font-size: 16px;
          color: #57606a;
          font-weight: 500;
        }

        :deep(.el-tabs__item.is-active) {
          color: #24292f;
          font-weight: 600;
        }

        :deep(.el-tabs__active-bar) {
          height: 2px;
          background: #2da44e;
        }

        :deep(.el-form-item) {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          margin-bottom: 18px;
        }

        :deep(.el-form-item__label) {
          width: auto;
          height: auto;
          justify-content: flex-start;
          padding: 0 0 7px;
          line-height: 20px;
          color: #24292f;
          font-size: 13px;
          font-weight: 600;
        }

        :deep(.el-form-item__content) {
          display: flex;
          width: 100%;
          line-height: normal;
        }

        :deep(.el-input),
        :deep(.el-autocomplete) {
          width: 100%;
        }

        :deep(.el-input__wrapper) {
          min-height: 38px;
          border-radius: 6px;
          box-shadow: 0 0 0 1px #d0d7de inset;
        }

        :deep(.el-input__wrapper.is-focus) {
          box-shadow: 0 0 0 1px #0969da inset, 0 0 0 3px rgb(9 105 218 / 15%);
        }

        :deep(.account-input .el-input__wrapper.is-focus) {
          box-shadow: 0 0 0 1px #0969da inset;
        }

        :deep(.el-radio-group) {
          gap: 20px;
        }

        :deep(.remember-row) {
          margin: -2px 0 0;
        }

        :deep(.remember-row .el-form-item__content) {
          gap: 18px;
        }

        :deep(.remember-row .el-checkbox) {
          margin-right: 0;
        }

        :deep(.el-radio__label) {
          color: #57606a;
          font-size: 13px;
        }

        .login-foot-wrapped {
          display: flex;
          flex-direction: column;

          .forget-password {
            display: flex;
            justify-content: flex-end;
            margin: 4px 0 18px;

            .forget-password-button {
              font-size: 13px;
              color: #0969da;
              text-decoration: underline;
              text-underline-offset: 3px;
              cursor: pointer;
            }
          }

          .go-register {
            font-size: 13px;
            margin: 18px 0 0;
            display: flex;
            justify-content: center;
            gap: 4px;
            color: #57606a;

            .go-registet-button {
              color: #0969da;
              text-decoration: underline;
              text-underline-offset: 3px;
              cursor: pointer;
            }
          }
        }

        .login-button,
        .register-button {
          width: 100%;
          height: 40px;
          margin: 0;
          border: 1px solid #2a9145;
          border-radius: 6px;
          background: #2da44e;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
        }

        .login-button:hover,
        .register-button:hover {
          border-color: #248a3e;
          background: #2c974b;
        }
      }
    }
  }
}

.footer-wrapped {
  height: auto;
  padding: 20px 0 26px;
  background: #fff;

  .foot-content {
    width: min(100%, 1200px);
    margin: 0 auto;
    padding: 0 20px;
    box-sizing: border-box;
    display: flex;
    justify-content: center;

    .title {
      font-size: 12px;
      color: #8c959f;
    }

    span {
      color: inherit;
    }
  }
}

@media (max-width: 768px) {
  .header-wrapped {
    height: 60px;

    .header-content {
      padding: 0 16px;
      gap: 12px;

      h3 {
        font-size: 14px;
      }

      .welcome { display: none; }
    }
  }

  .el-main .login-wrapped {
    min-height: calc(100vh - 120px);
  }

  .el-main .login-wrapped .content {
    justify-content: center;
    padding: 32px 16px 48px;
  }

  .el-main .login-wrapped .content .box-card :deep(.el-card__body) {
    padding: 22px;
  }
}
</style>
