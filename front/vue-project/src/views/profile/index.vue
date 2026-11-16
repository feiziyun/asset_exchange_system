<template>
  <div class="profile-page common-wrapped" v-loading="loading">
    <el-card class="profile-header app-workbench-panel" shadow="never">
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
        </div>
        <div class="base">
          <div class="title-row">
            <span class="name">{{ displayName }}</span>
            <span class="profile-role">{{ roleLabel }}</span>
            <el-button class="avatar-action" size="small" @click="openAvatarPicker">更换头像</el-button>
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
      <el-col :xs="24" :sm="24" :md="16">
        <el-card shadow="never" class="wallet-card app-workbench-panel">
          <template #header>
            <div class="section-title">账户余额</div>
          </template>
          <div class="wallet-content">
            <div class="wallet-balance-row">
              <div class="wallet-amount">¥ {{ walletBalance }}</div>
              <el-button class="wallet-detail-button" link @click="openLedgerDetails">查看详情</el-button>
            </div>
            <el-button class="recharge-entry-button" @click="rechargeVisible = true">
              <img :src="alipaySquareLogo" alt="" />支付宝充值
            </el-button>
          </div>
        </el-card>
        <el-card shadow="never" class="certificate-card app-workbench-panel">
          <template #header>
            <div class="certificate-heading">
              <span class="section-title">我的证书</span>
              <el-button v-if="activeCertificate" size="small" plain @click="openCertificateDialog('renew')">续期证书</el-button>
              <el-button v-else size="small" type="primary" plain :disabled="certLoading || Boolean(certLoadError)" @click="openCertificateDialog('apply')">申请证书</el-button>
            </div>
          </template>
          <div class="certificate-section" v-loading="certLoading">
            <div v-if="activeCertificate" class="cert-surface">
              <div class="cert-main">
                <div>
                  <div class="cert-name">{{ activeCertificate.cert_name }}</div>
                  <div class="cert-org">{{ activeCertificate.org_code }}</div>
                </div>
                <span class="cert-badge" :class="{ expired: certificateExpired }">
                  {{ certificateExpired ? '已过期' : '有效' }}
                </span>
              </div>
              <div class="cert-grid">
                <div class="cert-item span-2">
                  <span>证书地址</span>
                  <strong class="mono">{{ activeCertificate.chain_address || '-' }}</strong>
                </div>
                <div class="cert-item">
                  <span>创建时间</span>
                  <strong>{{ activeCertificate.created_at ? formatDateTime(activeCertificate.created_at) : '未知' }}</strong>
                </div>
                <div class="cert-item">
                  <span>过期时间</span>
                  <strong>{{ activeCertificate.expires_at ? formatDateTime(activeCertificate.expires_at) : '未知' }}</strong>
                </div>
              </div>
            </div>
            <el-alert v-else-if="certLoadError" :title="certLoadError" type="error" :closable="false" />
            <el-empty v-else-if="!certLoading" description="暂无证书" />
          </div>
        </el-card>

        <el-card shadow="never" class="profile-card app-workbench-panel">
          <template #header>
            <div class="section-title">个人资料管理</div>
          </template>
          <el-form :model="profileForm" label-width="88px" class="profile-form account-fields">
            <el-form-item label="账号">
              <el-input v-model="profileForm.account" disabled />
            </el-form-item>
            <el-form-item label="角色">
              <el-input :model-value="roleLabel" disabled />
            </el-form-item>
            <el-form-item label="姓名">
              <el-input v-model="profileForm.name" placeholder="请输入姓名" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="profileForm.email" placeholder="请输入邮箱" />
            </el-form-item>
            <el-form-item label="性别">
              <el-select v-model="profileForm.gender" style="width: 100%">
                <el-option label="未知" value="未知" />
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
              </el-select>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="saveProfile">保存资料</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card class="password-card app-workbench-panel" shadow="never" style="margin-top: 12px">
          <template #header>
            <div class="section-title">密码管理</div>
          </template>
          <el-form :model="passwordForm" label-width="88px" class="profile-form account-fields">
            <el-form-item label="旧密码">
              <el-input v-model="passwordForm.oldPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="新密码">
              <el-input v-model="passwordForm.newPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="warning" @click="savePassword">修改密码</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="8">
        <el-card class="role-card app-workbench-panel" shadow="never">
          <template #header>
            <div class="section-title">角色工作台</div>
          </template>
          <template v-if="roleKey === 'buyer' || roleKey === 'seller'">
            <div class="role-tip">{{ roleKey === 'buyer' ? '已支付订单与交付概览' : '交易订单与交付概览' }}</div>
            <div v-if="summaryLoading" class="summary-message">正在加载订单数据…</div>
            <div v-else-if="summaryError" class="summary-message">{{ summaryError }}</div>
            <div v-else class="summary-grid">
              <div class="summary-item">
                <span>{{ roleKey === 'buyer' ? '购买次数' : '交易订单' }}</span>
                <strong>{{ roleKey === 'buyer' ? orderSummary.paid_orders : orderSummary.total_orders }}</strong>
              </div>
              <div class="summary-item"><span>已完成订单</span><strong>{{ orderSummary.completed_orders }}</strong></div>
              <div class="summary-item"><span>待交付</span><strong>{{ orderSummary.awaiting_delivery }}</strong></div>
              <div class="summary-item"><span>待买方确认</span><strong>{{ orderSummary.awaiting_confirmation }}</strong></div>
            </div>
          </template>
          <div v-else class="role-tip">当前角色：{{ roleLabel }}</div>
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

    <el-dialog v-model="ledgerVisible" title="余额明细" width="min(700px, 92vw)">
      <div v-loading="ledgerLoading">
        <el-table :data="walletLedger" size="small" empty-text="暂无流水">
          <el-table-column label="时间" min-width="145">
            <template #default="scope">{{ formatDateTime(scope.row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="类型" min-width="85">
            <template #default="scope">{{ ({ RECHARGE: '充值', PAY: '支付', REFUND: '退款' } as Record<string, string>)[scope.row.event_type] || scope.row.event_type }}</template>
          </el-table-column>
          <el-table-column prop="amount" label="金额（元）" min-width="90" />
          <el-table-column prop="balance_after" label="余额（元）" min-width="90" />
        </el-table>
        <div class="ledger-pages">
          <el-button :disabled="ledgerLoading || ledgerPage === 1" @click="changeLedgerPage(-1)">上一页</el-button>
          <span>第 {{ ledgerPage }} 页</span>
          <el-button :disabled="ledgerLoading || walletLedger.length < 20" @click="changeLedgerPage(1)">下一页</el-button>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="rechargeVisible" width="360px" @closed="stopRechargePolling">
      <template #header>
        <div class="recharge-title"><img :src="alipaySquareLogo" alt="" />支付宝扫码充值</div>
      </template>
      <el-form-item v-if="!rechargeQr" label="充值金额">
        <el-input v-model="rechargeAmount" type="number" min="0.01" max="1000000" placeholder="请输入金额（元）" />
      </el-form-item>
      <div v-if="rechargeQr" class="recharge-content">
        <strong>¥ {{ rechargeAmount }}</strong>
        <img :src="rechargeQr" alt="支付宝充值二维码" width="220" height="220" />
        <span>请使用支付宝扫码付款</span>
      </div>
      <template #footer>
        <el-button @click="rechargeVisible = false">关闭</el-button>
        <el-button v-if="!rechargeQr" type="primary" :loading="rechargeLoading" @click="startRecharge">支付宝支付</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="certificateDialogVisible" :title="certificateDialogMode === 'renew' ? '续期证书' : '申请证书'" width="500px">
      <template v-if="certificateDialogMode === 'renew'">
        <el-descriptions :column="1">
          <el-descriptions-item label="证书名称">{{ activeCertificate?.cert_name }}</el-descriptions-item>
          <el-descriptions-item label="所属组织">{{ activeCertificate?.org_code }}</el-descriptions-item>
          <el-descriptions-item label="当前有效期">{{ activeCertificate?.expires_at ? formatDateTime(activeCertificate.expires_at) : '未知' }}</el-descriptions-item>
        </el-descriptions>
        <el-alert title="证书名称和链上地址保持不变，续期后有效期延长。" type="info" show-icon :closable="false" style="margin-top: 12px" />
      </template>
      <el-form v-else :model="certificateForm" label-width="100px">
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
        <el-alert title="证书有效期暂定为6个月，到期后可续期。" type="info" show-icon />
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="certificateDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="certSubmitting" @click="certificateDialogMode === 'renew' ? renewActiveCertificate() : submitCertificateApplication()">
            {{ certificateDialogMode === 'renew' ? '确认续期' : '确认申请' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import QRCode from 'qrcode'
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
import { getDefaultCertificates, getCertificates, checkCertificateNameAvailable, generateCertificate, addCertificate, renewCertificate, getOrderSummary } from '@/api/asset'
import { getWallet, getWalletLedger, createRecharge, getRechargeStatus } from '@/api/wallet'
import alipaySquareLogo from '@/assets/img/支付宝logo-方形.png'

const walletBalance = ref('0.00')
const walletLedger = ref<any[]>([])
const ledgerPage = ref(1)
const ledgerVisible = ref(false)
const ledgerLoading = ref(false)
const rechargeVisible = ref(false)
const rechargeAmount = ref('')
const rechargeQr = ref('')
const rechargeLoading = ref(false)
let rechargeTimer: ReturnType<typeof setInterval> | undefined
const stopRechargePolling = () => { if (rechargeTimer) clearInterval(rechargeTimer); rechargeTimer = undefined }
const refreshWallet = async () => {
  try {
    const balance = await getWallet()
    if (balance.data.status === 0) walletBalance.value = balance.data.data.balance
  } catch (error: any) { ElMessage.error(error?.response?.data?.message || '余额加载失败') }
}
const loadLedger = async () => {
  ledgerLoading.value = true
  try {
    const response = await getWalletLedger(ledgerPage.value)
    if (response.data.status !== 0) throw new Error(response.data.message || '余额明细加载失败')
    walletLedger.value = response.data.data || []
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '余额明细加载失败')
  } finally {
    ledgerLoading.value = false
  }
}
const openLedgerDetails = () => {
  ledgerPage.value = 1
  ledgerVisible.value = true
  void loadLedger()
}
const changeLedgerPage = (offset: number) => {
  ledgerPage.value = Math.max(1, ledgerPage.value + offset)
  void loadLedger()
}
const startRecharge = async () => {
  rechargeLoading.value = true
  try {
    const response = await createRecharge(rechargeAmount.value)
    if (response.data.status !== 0) throw new Error(response.data.message || '创建充值单失败')
    const recharge = response.data.data
    rechargeQr.value = await QRCode.toDataURL(recharge.qr_code, { width: 220, margin: 1 })
    stopRechargePolling()
    rechargeTimer = setInterval(async () => {
      try {
        const result = await getRechargeStatus(recharge.out_trade_no)
        if (result.data.data?.status === 'PAID') {
          stopRechargePolling()
          rechargeVisible.value = false
          ElMessage.success('充值成功')
          void refreshWallet()
        } else if (result.data.data?.status === 'EXPIRED') {
          stopRechargePolling()
          ElMessage.warning('充值二维码已过期')
          rechargeQr.value = ''
        }
      } catch (error: any) { stopRechargePolling(); ElMessage.error(error?.response?.data?.message || '充值状态查询失败') }
    }, 3000)
  } catch (error: any) { ElMessage.error(error?.response?.data?.message || error?.message || '充值失败') }
  finally { rechargeLoading.value = false }
}
watch(rechargeVisible, (visible) => { if (!visible) { stopRechargePolling(); rechargeQr.value = ''; rechargeAmount.value = '' } })
onBeforeUnmount(stopRechargePolling)

const router = useRouter()
const loading = ref(false)
const certLoading = ref(true)
const certSubmitting = ref(false)
const certLoadError = ref('')
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
const certificateDialogMode = ref<'apply' | 'renew'>('apply')
const userCertificates = ref<any[]>([])
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
const orderSummary = reactive({
  total_orders: 0,
  paid_orders: 0,
  awaiting_delivery: 0,
  awaiting_confirmation: 0,
  completed_orders: 0,
})
const summaryLoading = ref(false)
const summaryError = ref('')
const fetchOrderSummary = async () => {
  if (roleKey.value !== 'buyer' && roleKey.value !== 'seller') return
  summaryLoading.value = true
  summaryError.value = ''
  try {
    const response = await getOrderSummary()
    if (response.data.status !== 0) throw new Error(response.data.message || '订单概览加载失败')
    for (const key of Object.keys(orderSummary) as Array<keyof typeof orderSummary>) {
      orderSummary[key] = Number(response.data.data?.[key] || 0)
    }
  } catch (error: any) {
    summaryError.value = error?.response?.data?.message || error?.message || '订单概览加载失败'
  } finally {
    summaryLoading.value = false
  }
}
const activeCertificate = computed(() => {
  const preferred = defaultCertForm.defaultRegisterCert || defaultCertForm.defaultTradeCert
  return userCertificates.value.find((item) => item.cert_name === preferred) || userCertificates.value[0] || null
})
const certificateExpired = computed(() => {
  if (!activeCertificate.value?.expires_at) return false
  const expiresAt = new Date(activeCertificate.value.expires_at).getTime()
  return Number.isFinite(expiresAt) && expiresAt <= Date.now()
})

const roleModuleMap: Record<string, Array<{ title: string; desc: string; path: string }>> = {
  seller: [
    { title: '上链登记', desc: '登记并铸造自动驾驶数字资产', path: '/chainRegister' },
    { title: '资产管理', desc: '维护我的资产信息与交易状态', path: '/assetManagement' },
    { title: '订单中心', desc: '查看订单状态与收款后续流程', path: '/assetOrders' },
    { title: '交付工作台', desc: '配置合约并执行交付流程', path: '/assetDelivery' },
  ],
  buyer: [
    { title: '交易市场', desc: '浏览并购买市场中的数字资产', path: '/assetMarket' },
    { title: '我的购买', desc: '查看已购资产与购买记录', path: '/assetManagement' },
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

const openCertificateDialog = (mode: 'apply' | 'renew') => {
  certificateDialogMode.value = mode
  certificateForm.certificateName = ''
  certificateDialogVisible.value = true
}

const fetchUserCertificates = async () => {
  if (!user.id) {
    certLoadError.value = '用户身份缺失，请重新登录'
    certLoading.value = false
    return
  }

  certLoading.value = true
  certLoadError.value = ''
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

    if (org1Res.status === 'fulfilled' && org1Res.value.data?.status === 0) {
      pushRows(org1Res.value.data?.certificates || [], 'wx-org1')
    } else {
      throw new Error('证书加载失败，请稍后重试')
    }
    userCertificates.value = merged
    if (defaultRes.status === 'fulfilled') {
      const defaults = defaultRes.value.data?.data || {}
      defaultCertForm.defaultRegisterCert = defaults.default_register_cert || ''
      defaultCertForm.defaultTradeCert = defaults.default_trade_cert || ''
    }
  } catch (error) {
    console.error('获取证书列表失败:', error)
    certLoadError.value = '证书加载失败，请稍后重试'
  } finally {
    certLoading.value = false
  }
}

const submitCertificateApplication = async () => {
  if (activeCertificate.value) {
    ElMessage.warning('当前账户已有证书，请使用续期功能')
    return
  }
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
    const nameCheck = await checkCertificateNameAvailable(certificateForm.certificateName)
    if (!nameCheck.data?.available) {
      ElMessage.error('证书名称已被使用，请更换')
      return
    }
    // 第一步：调用后端 /asset/certificate/generate 接口生成证书
    const generateResponse = await generateCertificate(certificateForm.certificateName)

    if (generateResponse.status === 200 && generateResponse.data.status === 'success') {
      // 第二步：调用 /asset/certificate/add-certificate 接口添加证书
      const addCertResponse = await addCertificate(certificateForm.certificateName)

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

const renewActiveCertificate = async () => {
  if (!activeCertificate.value) return
  certSubmitting.value = true
  try {
    const result = await renewCertificate(activeCertificate.value.cert_name)
    if (result.data?.status !== 0 || !result.data?.success) {
      throw new Error(result.data?.message || '证书续期失败')
    }
    ElMessage.success(result.data.message || '证书续期成功')
    certificateDialogVisible.value = false
    await fetchUserCertificates()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '证书续期失败')
  } finally {
    certSubmitting.value = false
  }
}

onMounted(() => {
  fetchUserInfo()
  fetchUserCertificates()
  refreshWallet()
  fetchOrderSummary()
})
</script>

<style lang="scss" scoped>
.profile-page {
  width: 85%;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 16px 20px;
  margin: 0 auto;
  color: #1f2328;
}

.profile-page :deep(.el-card__header) {
  border-bottom-color: #d8dee4;
}

.wallet-card { margin-bottom: 12px; }
.account-fields { width: 100%; max-width: 420px; }
.account-fields :deep(.el-form-item__content) { min-width: 0; }
.wallet-content { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
.wallet-balance-row { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.wallet-amount { color: #1f2328; font-size: 28px; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; }
.wallet-content :deep(.el-button.wallet-detail-button) {
  --el-button-text-color: #0969da;
  --el-button-hover-text-color: #0550ae;
  font-size: 13px;
}
.recharge-content { display: flex; align-items: center; flex-direction: column; gap: 10px; }
.ledger-pages { display: flex; justify-content: center; align-items: center; gap: 10px; margin: 16px 0 0; }
.wallet-content :deep(.el-button.recharge-entry-button) {
  --el-button-bg-color: #f6f8fa;
  --el-button-border-color: #d0d7de;
  --el-button-text-color: #1f2328;
  --el-button-hover-bg-color: #eef6ff;
  --el-button-hover-border-color: #8cbaec;
  --el-button-hover-text-color: #0969da;
  height: 36px;
  padding: 0 14px;
  font-weight: 600;
}
.recharge-entry-button img { width: 18px; height: 18px; margin-right: 6px; border-radius: 4px; object-fit: contain; }
.recharge-title { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.recharge-title img { width: 24px; height: 24px; border-radius: 5px; object-fit: contain; }

.profile-header {
  margin-bottom: 12px;

  :deep(.el-card__body) { padding: 24px 28px; }

  .header-content {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .avatar-block {
    flex: none;
  }

  .base { flex: 1; min-width: 0; }

  .title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;

    .name {
      font-size: 22px;
      color: #1f2328;
      font-weight: 600;
    }
  }

  .desc {
    color: #57606a;
    font-size: 13px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px 20px;
  }

  .desc span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
}

.avatar-action { margin-left: auto; }

.profile-role {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #f6f8fa;
  color: #57606a;
  font-size: 12px;
  padding: 3px 8px;
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
    color: #1f2328;
    font-size: 16px;
    font-weight: 600;
  }
}

.certificate-section {
  min-height: 120px;
}

.certificate-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cert-surface {
  background: transparent;
}

.cert-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.cert-name {
  color: #1f2328;
  font-size: 16px;
  font-weight: 600;
}

.cert-org {
  margin-top: 4px;
  color: #57606a;
  font-size: 12px;
}

.cert-badge {
  flex: none;
  color: #1a7f37;
  background: #dafbe1;
  border: 1px solid #b7e4c7;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
}

.cert-badge.expired {
  color: #cf222e;
  background: #ffebe9;
  border-color: #ffcecb;
}

.cert-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 24px;
}

.cert-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.cert-item.span-2 {
  grid-column: 1 / -1;
}

.cert-item span {
  color: #57606a;
  font-size: 12px;
}

.cert-item strong {
  color: #1f2328;
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.mono {
  font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 600px) {
  .cert-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .cert-item.span-2 {
    grid-column: auto;
  }

}

@media (max-width: 900px) {
  .profile-header .desc { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 600px) {
  .profile-header :deep(.el-card__body) { padding: 20px; }
  .profile-header .header-content { align-items: flex-start; gap: 16px; }
  .profile-header .desc { grid-template-columns: minmax(0, 1fr); }
  .avatar-action { margin-left: 0; }
}

.role-tip {
  color: #57606a;
  font-size: 13px;
  margin-bottom: 12px;
}

.summary-message {
  color: #57606a;
  font-size: 13px;
  padding: 12px 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 18px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  padding: 12px;
  border: 1px solid #d8dee4;
  border-radius: 6px;
  background: #f6f8fa;
}

.summary-item span { color: #57606a; font-size: 12px; }
.summary-item strong { color: #1f2328; font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }

.work-list {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .work-item {
    border: 1px solid #d8dee4;
    border-radius: 6px;
    background: #fff;
    padding: 12px;

    .work-title {
      color: #1f2328;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .work-desc {
      color: #57606a;
      font-size: 12px;
      margin-bottom: 4px;
    }
  }
}

.role-card :deep(.el-button.is-link) { color: #57606a; }
.role-card :deep(.el-button.is-link:hover) { color: #0969da; }
</style>
