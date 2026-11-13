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
              <el-tabs v-model="activeName" class="demo-tabs" :stretch="true">
                <el-tab-pane label="登陆" name="first">
                  <!-- 登录表单 -->
                  <form class="login-form" @submit.prevent="Login">
                    <el-form-item label="账号">
                      <el-autocomplete
                        v-model="loginData.account"
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
                    <el-form-item>
                      <el-checkbox v-model="rememberAccount">记住账号</el-checkbox>
                      <el-checkbox v-model="savePassword">记住密码</el-checkbox>
                    </el-form-item>

                  <div class="login-foot-wrapped">
                    <!-- 忘记密码 -->
                    <div class="forget-password">
                      <span class="forget-password-button" @click="openForget">忘记密码</span>
                    </div>
                    <!-- 登陆按钮 -->
                    <el-button type="primary" class="login-button" native-type="submit" plain
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
                  <el-button type="primary" class="register-button" plain @click="Register"
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
            <span>基于区块链的自动驾驶数字资产交易系统</span>|
            <span>基于区块链的自动驾驶数字资产交易系统</span>|
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
.header-wrapped {
  padding: 0;
  height: 40px;
  display: flex;
  align-items: center;

  .header-content {
    width: min(100%, 1280px);
    margin: 0 auto;
    padding: 0 18px;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;

    h3 {
      margin: 0;
      flex: 1 1 auto;
      min-width: 0;
      font-size: 20px;
      line-height: 1.25;
    }

    .welcome {
      flex: 0 0 auto;
      font-size: 14px;
      white-space: nowrap;
    }
  }
}

.el-main {
  padding: 0;
  height: 90vh;

  .login-wrapped {
    position: relative;
    width: 100%;
    margin: 0 auto;

    .bg {
      width: 100%; /* ✅ 宽铺满 */
      height: 90vh; /* ✅ 高度按比例自动 */
      display: block; /* 去掉 img 默认空隙 */
      opacity: 65%;
      object-fit: cover;
    }

    .content {
      position: absolute;
      inset: 0;
      /* 这里随便你布局 */
      .box-card {
        width: 350px;
        min-height: 430px;
        float: right;
        position: relative;
        top: 15%;
        right: 10%;
        padding-bottom: 10px;

        .el-form {
          margin-top: 30px;
        }
        .login-foot-wrapped {
          display: flex;
          flex-direction: column;

          .forget-password {
            display: flex;
            justify-content: flex-end;
            margin: 10px 0;
            .forget-password-button {
              font-size: 12px;
              color: #409eff;
              cursor: pointer; //鼠标移动效果
            }
          }

          .go-register {
            font-size: 12px;
            margin: 12px 0;
            display: flex;
            justify-content: center;

            .go-registet-button {
              font-size: 12px;
              color: #409eff;
              cursor: pointer;
            }
          }
        }

        .login-button .register-button {
          width: 100%;
          display: flex;
          justify-content: center;
        }
        //登陆注册按钮
        :deep(.el-button) {
          width: 300px;
          height: 45px;
          font-size: 16px;
        }
      }
    }
  }
}

.footer-wrapped {
  margin-top: 0;
  .foot-content {
    width: min(100%, 1280px);
    margin: 0 auto;
    padding: 0 18px;
    box-sizing: border-box;
    display: flex;
    justify-content: center;

    .title {
      font-size: 12px;
      color: #999;
    }

    span {
      margin: 0px 12px;
      color: #666;
      font-size: 12px;
    }
  }
}
//样式穿透？
:deep(.el-tabs__item) {
  color: #333;
  font-size: 18px;
}
//输入框高度
:deep(.el-input__inner) {
  height: 40px;
}
//输入框标签字体
:deep(.el-form-item__label) {
  font-size: 14px;
  line-height: 40px;
}

@media (max-width: 768px) {
  .header-wrapped {
    height: 36px;

    .header-content {
      padding: 0 12px;
      gap: 12px;

      h3 {
        font-size: 20px;
      }
    }
  }

  .footer-wrapped .foot-content {
    padding: 0 12px;
  }
}
</style>
