<template>
  <div class="profile-page common-wrapped" v-loading="loading">
    <el-card class="profile-header" shadow="never">
      <div class="header-content">
        <div class="avatar-block">
          <el-avatar :size="72" :src="avatarUrl" />
          <input
            ref="avatarInputRef"
            type="file"
            accept="image/*"
            style="display: none"
            @change="handleAvatarSelected"
          />
          <el-button size="small" type="primary" plain @click="openAvatarPicker"
            >更换头像</el-button
          >
        </div>
        <div class="base">
          <div class="title-row">
            <span class="name">{{ displayName }}</span>
            <el-tag type="success">{{ roleLabel }}</el-tag>
          </div>
          <div class="desc">
            <span>账号：{{ user.account || '-' }}</span>
            <span>用户ID：{{ user.id || '-' }}</span>
            <span>注册时间：{{ formatDateTime(user.create_time) }}</span>
          </div>
        </div>
      </div>
    </el-card>

    <el-row :gutter="12" class="main-row">
      <el-col :span="16">
        <el-card shadow="never" class="certificate-card">
          <template #header>
            <div class="section-title">证书管理</div>
          </template>
          <div class="certificate-section">
            <div class="certificate-info">
              <el-input
                v-model="certificateSearchQuery"
                placeholder="请输入证书名称搜索"
                style="max-width: 300px"
              />
              <el-button type="primary" @click="openCertificateDialog">申请新证书</el-button>
            </div>
            <div class="default-cert-row">
              <el-form inline label-width="108px" class="default-cert-form">
                <el-form-item label="默认登记证书">
                  <el-select
                    v-model="defaultCertForm.defaultRegisterCert"
                    clearable
                    placeholder="未设置"
                    class="default-register-cert-select"
                  >
                    <el-option
                      v-for="item in defaultCertOptions"
                      :key="`register-${item.cert_name}`"
                      :label="item.cert_name"
                      :value="item.cert_name"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="默认交易证书">
                  <el-select
                    v-model="defaultCertForm.defaultTradeCert"
                    clearable
                    placeholder="未设置"
                    class="default-cert-select"
                  >
                    <el-option
                      v-for="item in defaultCertOptions"
                      :key="`trade-${item.cert_name}`"
                      :label="item.cert_name"
                      :value="item.cert_name"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-button
                    type="primary"
                    plain
                    :loading="defaultCertSaving"
                    @click="saveDefaultCertSetting"
                  >
                    保存默认证书
                  </el-button>
                </el-form-item>
              </el-form>
            </div>
            <el-table
              class="certificate-table"
              :data="filteredCertificates"
              border
              style="width: 100%"
              v-loading="certLoading"
              empty-text="暂无证书"
            >
              <el-table-column prop="cert_name" label="证书名称" />
              <el-table-column prop="org_code" label="所属组织" />
              <el-table-column label="默认用途" min-width="150">
                <template #default="scope">
                  <div class="default-tags">
                    <el-tag
                      v-if="scope.row.cert_name === defaultCertForm.defaultRegisterCert"
                      size="small"
                      type="success"
                      effect="plain"
                      >登记</el-tag
                    >
                    <el-tag
                      v-if="scope.row.cert_name === defaultCertForm.defaultTradeCert"
                      size="small"
                      type="warning"
                      effect="plain"
                      >交易</el-tag
                    >
                    <span
                      v-if="
                        scope.row.cert_name !== defaultCertForm.defaultRegisterCert &&
                        scope.row.cert_name !== defaultCertForm.defaultTradeCert
                      "
                    >
                      -
                    </span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态">
                <template #default="scope">
                  <el-tag :type="scope.row.status === 1 ? 'success' : 'info'">
                    {{ scope.row.status === 1 ? '正常' : '未激活' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>

        <el-card shadow="never" class="profile-card">
          <template #header>
            <div class="section-title">个人资料管理</div>
          </template>
          <el-form :model="profileForm" label-width="88px" class="profile-form">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="账号">
                  <el-input v-model="profileForm.account" disabled />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="角色">
                  <el-input :model-value="roleLabel" disabled />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="姓名">
                  <el-input v-model="profileForm.name" placeholder="请输入姓名" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="邮箱">
                  <el-input v-model="profileForm.email" placeholder="请输入邮箱" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="性别">
                  <el-select v-model="profileForm.gender" style="width: 100%">
                    <el-option label="未知" value="未知" />
                    <el-option label="男" value="男" />
                    <el-option label="女" value="女" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item>
              <el-button type="primary" @click="saveProfile">保存资料</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="password-card" shadow="never" style="margin-top: 12px">
          <template #header>
            <div class="section-title">密码管理</div>
          </template>
          <el-form :model="passwordForm" label-width="88px" class="profile-form">
            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="旧密码">
                  <el-input v-model="passwordForm.oldPassword" show-password />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="新密码">
                  <el-input v-model="passwordForm.newPassword" show-password />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="确认密码">
                  <el-input v-model="passwordForm.confirmPassword" show-password />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item>
              <el-button type="warning" @click="savePassword">修改密码</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never">
          <template #header>
            <div class="section-title">角色工作台</div>
          </template>
          <div class="role-tip">当前角色：{{ roleLabel }}</div>
          <div class="work-list">
            <div v-for="item in roleModules" :key="item.title" class="work-item">
              <div class="work-title">{{ item.title }}</div>
              <div class="work-desc">{{ item.desc }}</div>
              <el-button type="primary" link @click="goPath(item.path)">进入</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 申请证书对话框 -->
    <el-dialog v-model="certificateDialogVisible" title="申请证书" width="500px">
      <el-form :model="certificateForm" label-width="100px">
        <el-form-item label="证书名称" required>
          <el-input
            v-model="certificateForm.certificateName"
            placeholder="输入不超过10位的字母和数字组合"
            maxlength="10"
          />
        </el-form-item>
        <el-form-item label="所属组织">
          <el-input model-value="wx-org1.chainmaker.org" disabled />
        </el-form-item>
        <el-alert title="证书有效期暂定为6个月，到期后可联系官方续期。" type="info" show-icon />
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="certificateDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="certSubmitting" @click="submitCertificateApplication">
            确认
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { clearAuthData, parseTokenPayload, getRoleKey, getRoleLabel } from '@/utils/auth'
import { formatDateTime } from '@/utils/dateTime'
import {
  getUserInfo,
  uploadAvatar,
  updateUserName,
  updateUserGender,
  updateUserEmail,
  updatePassword,
} from '@/api/userInfo'
import { getDefaultCertificates, getCertificates, saveDefaultCertificates } from '@/api/asset'
import instance from '@/http/index.js'

const router = useRouter()
const loading = ref(false)
const certLoading = ref(false)
const certSubmitting = ref(false)
const avatarUrl = ref('https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png')
const avatarInputRef = ref<HTMLInputElement | null>(null)
const tokenPayload = parseTokenPayload() || {}

const user = reactive({
  id: tokenPayload.id || '',
  account: tokenPayload.account || '',
  name: tokenPayload.name || '',
  identity: tokenPayload.identity || '',
  email: tokenPayload.email || '',
  sex: tokenPayload.sex || '未知',
  create_time: '',
  avatarUrl: '',
  avatar: '',
  avatarMimeType: '',
})

const profileForm = reactive({
  account: '',
  name: '',
  email: '',
  gender: '未知',
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const certificateDialogVisible = ref(false)
const certificateSearchQuery = ref('')
const userCertificates = ref<any[]>([])
const defaultCertSaving = ref(false)
const certificateForm = reactive({
  certificateName: '',
})
const defaultCertForm = reactive({
  defaultRegisterCert: '',
  defaultTradeCert: '',
})

const roleLabel = computed(() => getRoleLabel(user.identity || tokenPayload.identity || ''))
const roleKey = computed(() => getRoleKey(user.identity || tokenPayload.identity || ''))
const displayName = computed(() => user.name || user.account || '未命名用户')
const filteredCertificates = computed(() => {
  const keyword = String(certificateSearchQuery.value || '')
    .trim()
    .toLowerCase()
  if (!keyword) return userCertificates.value
  return userCertificates.value.filter((item) => {
    const certName = String(item.cert_name || '').toLowerCase()
    const orgCode = String(item.org_code || '').toLowerCase()
    return certName.includes(keyword) || orgCode.includes(keyword)
  })
})
const defaultCertOptions = computed(() =>
  userCertificates.value.filter((item) => item.org_code === 'wx-org1'),
)

const roleModuleMap: Record<string, Array<{ title: string; desc: string; path: string }>> = {
  seller: [
    { title: '上链登记', desc: '登记并铸造自动驾驶数字资产', path: '/chainRegister' },
    { title: '资产管理', desc: '维护我的资产信息与交易状态', path: '/assetManagement' },
    { title: '订单中心', desc: '查看订单状态与收款后续流程', path: '/assetOrders' },
    { title: '交付工作台', desc: '配置合约并执行交付流程', path: '/assetDelivery' },
  ],
  buyer: [
    { title: '交易市场', desc: '浏览并购买市场中的数字资产', path: '/assetMarket' },
    { title: '我的资产', desc: '查看已购资产与购买记录', path: '/assetManagement' },
    { title: '交付工作台', desc: '发起交付申请并下载交付结果', path: '/assetDelivery' },
  ],
  admin: [
    { title: '控制面板', desc: '查看平台统计面板与交易概览', path: '/admin/dashboard' },
    { title: '资产总览', desc: '审查平台全部资产及其上链状态', path: '/admin/assets' },
    { title: '链上信息', desc: '查看链上登记与同步结果', path: '/admin/chain-info' },
    { title: '订单管理', desc: '监管订单状态与交易流程', path: '/admin/orders' },
    { title: '用户管理', desc: '统一维护五类角色与账号状态', path: '/admin/users' },
  ],
  regulator: [
    { title: '监管工作台', desc: '进入穿透式账户监管与风险监测平台', path: '/regulation' },
    { title: '交易监管', desc: '查看交易监管数据与风险情况', path: '/transaction-supervision' },
    { title: '服务管理', desc: '管理监管侧配套服务能力', path: '/services' },
  ],
  auditor: [
    { title: '我的资产', desc: '查看已购资产与资产信息列表', path: '/assetManagement' },
    { title: '审计入口', desc: '进入外部 PAM 审计平台', path: '/audit-entry' },
    { title: '个人中心', desc: '维护审计账号资料与默认设置', path: '/profile' },
  ],
}

const roleModules = computed(() => roleModuleMap[roleKey.value] || roleModuleMap.buyer)

const syncFormFromUser = () => {
  profileForm.account = user.account || ''
  profileForm.name = user.name || ''
  profileForm.email = user.email || ''
  profileForm.gender = user.sex || '未知'
  if (user.avatar) {
    avatarUrl.value = `data:${user.avatarMimeType || 'image/jpeg'};base64,${user.avatar}`
  }
}

const openAvatarPicker = () => {
  avatarInputRef.value?.click()
}

const handleAvatarSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!user.account) {
    ElMessage.error('当前账号信息缺失，请重新登录')
    return
  }

  const formData = new FormData()
  formData.append('avatar_file', file)

  try {
    const uploadRes = await uploadAvatar(formData)
    if (uploadRes.data.status !== 0) {
      ElMessage.error(uploadRes.data.message || '头像上传失败')
      return
    }

    ElMessage.success('头像更新成功')
    await fetchUserInfo()
    window.dispatchEvent(new Event('user-avatar-updated'))
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '头像更新失败')
  } finally {
    input.value = ''
  }
}

const fetchUserInfo = async () => {
  loading.value = true
  try {
    const res = await getUserInfo(user.id || undefined)
    if (res.data.status === 0 && res.data.data) {
      Object.assign(user, res.data.data)
      syncFormFromUser()
    } else {
      syncFormFromUser()
    }
  } catch (e) {
    syncFormFromUser()
  } finally {
    loading.value = false
  }
}

const saveProfile = async () => {
  if (!user.id) {
    ElMessage.error('用户信息缺失，请重新登录')
    return
  }

  try {
    const reqs = []
    if (profileForm.name !== (user.name || ''))
      reqs.push(updateUserName({ id: user.id, name: profileForm.name }))
    if (profileForm.email !== (user.email || ''))
      reqs.push(updateUserEmail({ id: user.id, email: profileForm.email }))
    if (profileForm.gender !== (user.sex || '未知'))
      reqs.push(updateUserGender({ id: user.id, gender: profileForm.gender }))

    if (!reqs.length) {
      ElMessage.info('资料未变更')
      return
    }

    const results = await Promise.all(reqs)
    const hasError = results.some((item) => item.data.status !== 0)
    if (hasError) {
      ElMessage.error('部分资料保存失败，请重试')
      return
    }
    ElMessage.success('资料保存成功')
    await fetchUserInfo()
  } catch (e) {
    ElMessage.error('保存资料失败')
  }
}

const savePassword = async () => {
  if (!user.id) {
    ElMessage.error('用户信息缺失，请重新登录')
    return
  }
  if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    ElMessage.warning('请完整填写密码信息')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.error('两次输入的新密码不一致')
    return
  }

  try {
    const res = await updatePassword({
      id: user.id,
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    })
    if (res.data.status === 0) {
      ElMessage.success('密码修改成功，请重新登录')
      clearAuthData()
      router.push('/login')
      return
    }
    ElMessage.error(res.data.message || '密码修改失败')
  } catch (e) {
    ElMessage.error('密码修改失败')
  }
}

const goPath = (path: string) => {
  router.push(path)
}

const openCertificateDialog = () => {
  certificateForm.certificateName = ''
  certificateDialogVisible.value = true
}

const fetchUserCertificates = async () => {
  if (!user.id) return

  certLoading.value = true
  try {
    const [org1Res, defaultRes] = await Promise.allSettled([
      getCertificates(),
      getDefaultCertificates(),
    ])

    const merged = []
    const seen = new Set<string>()

    const pushRows = (rows: any[] = [], fallbackOrg = '') => {
      rows.forEach((item: any) => {
        const certName = item.cert || item.cert_name || item.certificate_name || ''
        const orgCode =
          item.organization || item.org || item.org_code || fallbackOrg || item.data?.org_code || ''
        if (!certName || !orgCode) return
        const key = `${orgCode}::${certName}`
        if (seen.has(key)) return
        seen.add(key)
        merged.push({
          cert_name: certName,
          org_code: orgCode,
          chain_address: item.address || item.chain_address || item.data?.chain_address || '',
          sign_cert_path: item.sign_cert_path || item.data?.cert_path || '',
          tls_cert_path: item.tls_cert_path || '',
          pem_path: item.pem_path || '',
          created_at: item.created_at || item.registry_created_at || '',
          expires_at: item.expires_at || '',
          status: 1,
        })
      })
    }

    if (org1Res.status === 'fulfilled') {
      pushRows(org1Res.value.data?.certificates || [], 'wx-org1')
    }
    userCertificates.value = merged
    if (defaultRes.status === 'fulfilled') {
      const defaults = defaultRes.value.data?.data || {}
      defaultCertForm.defaultRegisterCert = defaults.default_register_cert || ''
      defaultCertForm.defaultTradeCert = defaults.default_trade_cert || ''
    }
  } catch (error) {
    console.error('获取证书列表失败:', error)
  } finally {
    certLoading.value = false
  }
}

const saveDefaultCertSetting = async () => {
  if (!user.id) {
    ElMessage.error('用户信息缺失，请重新登录')
    return
  }

  defaultCertSaving.value = true
  try {
    const res = await saveDefaultCertificates({
      defaultRegisterCert: defaultCertForm.defaultRegisterCert,
      defaultTradeCert: defaultCertForm.defaultTradeCert,
    })
    if (res.data.status === 0) {
      ElMessage.success('默认证书保存成功')
      await fetchUserCertificates()
    } else {
      ElMessage.error(res.data.message || '默认证书保存失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '默认证书保存失败')
  } finally {
    defaultCertSaving.value = false
  }
}

const submitCertificateApplication = async () => {
  if (!certificateForm.certificateName) {
    ElMessage.warning('请输入证书名称')
    return
  }

  const certNamePattern = /^[a-zA-Z0-9]{1,10}$/
  if (!certNamePattern.test(certificateForm.certificateName)) {
    ElMessage.error('证书名称格式不正确，必须是1-10个字母或数字')
    return
  }

  certSubmitting.value = true
  try {
    // 第一步：调用后端 /asset/certificate/generate 接口生成证书
    const generateResponse = await instance.post('/asset/certificate/generate', {
      client_number: certificateForm.certificateName,
      org: 'wx-org1.chainmaker.org',
    })

    if (generateResponse.status === 200 && generateResponse.data.status === 'success') {
      // 第二步：调用 /asset/certificate/add-certificate 接口添加证书
      const addCertResponse = await instance.post('/asset/certificate/add-certificate', {
        certificateName: certificateForm.certificateName,
      })

      if (addCertResponse.status === 200 && addCertResponse.data.status === 0) {
        ElMessage.success('证书申请成功')
        certificateDialogVisible.value = false
        await fetchUserCertificates()
      } else {
        ElMessage.error(addCertResponse.data.message || '证书申请失败')
      }
    } else {
      ElMessage.error(generateResponse.data.msg || generateResponse.data.message || '证书生成失败')
    }
  } catch (error: any) {
    console.error('申请证书时发生错误:', error)
    ElMessage.error(
      error?.response?.data?.message || error?.message || '申请证书失败，服务器不可用',
    )
  } finally {
    certSubmitting.value = false
  }
}

onMounted(() => {
  fetchUserInfo()
  fetchUserCertificates()
})
</script>

<style lang="scss" scoped>
.profile-page {
  width: 85%;
  margin: 14px auto;
}

.profile-header {
  margin-bottom: 12px;
  border-radius: 10px;

  .header-content {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .avatar-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;

    .name {
      font-size: 22px;
      color: #233f97;
      font-weight: 700;
    }
  }

  .desc {
    color: #6f7aa3;
    font-size: 13px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
}

.main-row {
  .certificate-card {
    margin-bottom: 12px;
  }

  .profile-card {
    margin-bottom: 12px;
  }

  .password-card {
    margin-top: 12px;
  }

  .section-title {
    color: #223e95;
    font-weight: 700;
  }
}

.certificate-section {
  .certificate-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .default-cert-row {
    margin-top: 16px;
  }

  .default-cert-form :deep(.el-form-item) {
    margin-right: 12px;
    margin-bottom: 0;
  }

  .default-register-cert-select,
  .default-cert-select {
    width: 150px;
  }

  .certificate-table {
    margin-top: 16px;
  }
}

.default-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.role-tip {
  color: #5e6d95;
  margin-bottom: 10px;
}

.work-list {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .work-item {
    border: 1px solid #edf0f8;
    border-radius: 8px;
    padding: 10px;

    .work-title {
      color: #29459c;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .work-desc {
      color: #7a86aa;
      font-size: 12px;
      margin-bottom: 4px;
    }
  }
}
</style>
