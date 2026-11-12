<template>
  <div class="common-wrapped">
    <div class="register-page">
      <el-card v-if="currentRole === 'seller'" shadow="never" class="register-card">
        <template #header>
          <div class="header">资产登记</div>
        </template>

        <el-form :model="form" label-width="132px" class="register-form">
          <section class="form-section">
            <div class="section-title">基础信息</div>
            <div class="register-main">
              <div class="cover-panel">
                <div class="cover-box" @click="triggerPictureSelect">
                  <img
                    v-if="form.picture_preview"
                    :src="form.picture_preview"
                    alt="asset-cover-preview"
                    class="picture-preview"
                  />
                  <span v-else class="cover-empty">上传封面</span>
                </div>
                <input
                  ref="pictureInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden-file-input"
                  @change="onPictureSelected"
                />
                <el-button size="small" class="cover-button register-action-button" @click="triggerPictureSelect">
                  选择封面
                </el-button>
              </div>

              <div class="form-panel">
                <el-form-item label="资产名称" class="row-item">
                  <el-input v-model="form.asset_name" placeholder="请输入资产名称" />
                </el-form-item>

                <el-form-item label="资产介绍" class="row-item">
                  <el-input
                    v-model="form.description"
                    type="textarea"
                    :rows="5"
                    placeholder="请输入资产详细说明"
                  />
                </el-form-item>

                <el-form-item label="选择资产" class="row-item">
                  <div class="asset-file-row">
	                    <input
	                      ref="sourceFileInputRef"
	                      type="file"
	                      class="native-file-input native-file-input--compact"
	                      @click="resetSourceFileInput"
	                      @change="onSourceFileSelected"
	                    />
	                    <span v-if="fileSizeText" class="field-inline-tip field-inline-tip--inline file-size-inline">
	                      文件大小：{{ fileSizeText }}
	                    </span>
                  </div>
                </el-form-item>

                <el-form-item label="存证方法选择" class="row-item identifier-item">
                  <el-radio-group v-model="form.algorithm" class="identifier-group">
                    <el-radio value="FINGERPRINT">数字指纹</el-radio>
                  </el-radio-group>
                  <span v-if="form.file_hash" class="field-inline-tip field-inline-tip--inline identifier-tip">
                    数字指纹已生成
                  </span>
                  <el-button
                    class="register-action-button"
                    plain
                    :loading="similarityChecking"
                    @click="runOmniPrintSimilarityCheck"
                  >
                    相似度检测
                  </el-button>
                </el-form-item>

                <el-form-item label="分类分级" class="row-item classification-item">
                  <el-select v-model="form.classification_method_name" placeholder="请选择分类分级方法" style="width: 145px">
                    <el-option
                      v-for="item in classificationMethodOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                  <el-button
                    class="register-action-button"
                    type="primary"
                    plain
                    :loading="classifying"
                    :disabled="!canClassify"
                    @click="runClassification"
                  >
                    {{ classifying ? '分类中...' : '分类分级' }}
                  </el-button>
                  <div class="classification-result">
                    <span v-if="form.classification_category_name" class="result-chip">
                      数据产品类型：{{ form.classification_category_name }}
                    </span>
                    <span v-if="form.classification_category_name" class="result-chip result-chip--warn">
                      分级：{{ form.classification_data_level }}
                    </span>
                    <span v-else class="field-inline-tip field-inline-tip--inline">
                      点击按钮后自动生成
                    </span>
                  </div>
                </el-form-item>

                <el-form-item label="证书" class="row-item">
                  <div v-if="defaultRegisterCertificate?.cert" class="field-inline-tip">
                    当前证书：{{ defaultRegisterCertificate.cert }}
                  </div>
                  <div
                    v-else-if="certLoading"
                    class="field-inline-tip"
                  >
                    正在加载证书信息...
                  </div>
                  <div v-else-if="certLoadError" class="field-inline-tip field-inline-tip--danger">
                    {{ certLoadError }} <el-button type="primary" link @click="initUserAndCertificates">重试</el-button>
                  </div>
                  <div v-else-if="certificates.length === 0" class="field-inline-tip field-inline-tip--danger">
                    暂无证书，请前往<router-link to="/profile">个人中心</router-link>申请证书
                  </div>
                  <div v-else class="field-inline-tip field-inline-tip--danger">
                    证书信息不完整，请重试加载
                  </div>
                </el-form-item>

                <el-form-item label="数据产品方向" class="row-item">
                  <el-select
                    v-model="form.sub_category_name_input"
                    filterable
                    allow-create
                    default-first-option
                    clearable
                    placeholder="选填，可选择已有方向或直接输入"
                    @focus="refreshSubCategoryOptions"
                    @change="persistCustomSubCategory"
                  >
                    <el-option
                      v-for="item in filteredSubCategories"
                      :key="item.id"
                      :label="item.sub_category_name"
                      :value="item.sub_category_name"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item label="地区" class="row-item">
                  <el-select v-model="form.region_id" placeholder="请选择地区">
                    <el-option
                      v-for="item in regions"
                      :key="item.id"
                      :label="item.region_name"
                      :value="item.id"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item label="联系邮箱" class="row-item">
                  <el-input v-model="form.email" placeholder="选填" />
                </el-form-item>

                <el-form-item label="联系地址" class="row-item">
                  <el-input v-model="form.address" placeholder="选填" />
                </el-form-item>
              </div>
            </div>
          </section>

          <section class="form-section">
            <div class="section-title">交易设置</div>
            <div class="trade-panel">
              <el-form-item :label="form.pricing_mode === 'auction' ? '起拍价' : '资产价格'" class="row-item trade-single-item">
                <div class="price-row">
                  <el-input-number
                    v-model="form.price"
                    :min="form.pricing_mode === 'auction' ? 1 : 0"
                    :precision="form.pricing_mode === 'auction' ? 0 : 2"
                    :step="form.pricing_mode === 'auction' ? 1 : 0.01"
                    style="width: 220px"
                    @change="normalizeRegisterAuctionPrice"
                  />
                  <el-button class="register-action-button" plain @click="openValuationDialog">资产估值</el-button>
                  <span v-if="form.pricing_mode === 'auction'" class="field-inline-tip field-inline-tip--inline">
                    资产估值将作为起拍价
                  </span>
                </div>
              </el-form-item>

              <el-form-item label="交易模式" class="row-item trade-single-item">
                <el-radio-group v-model="form.pricing_mode" @change="normalizeRegisterAuctionPrice">
                  <el-radio value="fixed">固定价格</el-radio>
                  <el-radio value="auction">拍卖</el-radio>
                </el-radio-group>
              </el-form-item>

              <el-form-item v-if="form.pricing_mode === 'auction'" label="拍卖截止时间" class="row-item trade-single-item">
                <el-date-picker
                  v-model="form.auction_end_time"
                  type="datetime"
                  value-format="YYYY-MM-DDTHH:mm:ss"
                  format="YYYY-MM-DD HH:mm:ss"
                  :disabled-date="disablePastDate"
                  placeholder="请选择拍卖截止时间"
                  style="width: 220px"
                />
              </el-form-item>

              <el-form-item label="登记后上架" class="row-item trade-single-item trade-switch-item">
                <el-switch
                  v-model="form.publish_on_register"
                  inline-prompt
                  active-text="是"
                  inactive-text="否"
                />
              </el-form-item>

              <el-form-item label="资产总份数" class="row-item trade-single-item">
                <el-input-number v-model="form.total_qty" :min="1" :max="1000000" :precision="0" style="width: 220px" />
              </el-form-item>

              <el-form-item label="交付方式" class="row-item trade-single-item">
                <el-select v-model="form.pc_type" placeholder="请选择交付方式" style="width: 220px">
                  <el-option
                    v-for="item in deliveryMethodOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="售卖权限" class="row-item trade-single-item trade-permission-item">
                <div class="permission-block">
                  <div class="permission-checkboxes">
                    <el-checkbox v-model="form.isSellBody">允许出售持有权</el-checkbox>
                    <el-checkbox v-model="form.isSellReadRight">允许出售经营权</el-checkbox>
                    <el-checkbox v-model="form.isSellProcessRight">允许出售加工使用权</el-checkbox>
                  </div>
                </div>
              </el-form-item>
            </div>
          </section>
        </el-form>

        <div class="actions">
          <el-button @click="resetForm">重置</el-button>
          <el-button v-if="uploadingSource" type="info" disabled>源文件哈希生成中</el-button>
          <el-button type="primary" :loading="submitting" @click="submitForm">提交登记</el-button>
        </div>
      </el-card>

      <el-card v-else shadow="never" class="register-card">
        <el-empty description="当前账号为买家，仅卖家可进行资产上链登记" />
      </el-card>
    </div>

    <AssetValuationDialog
      v-model:visible="valuationVisible"
      :asset="valuationAsset"
      :username="form.username"
      :user-id="form.user_id"
      @price-updated="handleValuationPriceUpdated"
    />

    <el-dialog v-model="registerStatusVisible" title="上链状态" width="560px" class="chain-status-dialog">
      <div class="status-section">
        <div class="status-icon status-icon--success">✓</div>
        <div class="status-content">
          <div class="status-title">存证状态</div>
          <div class="status-text success-text">
            {{ registerStatus.hashText || '数字指纹已生成' }}
          </div>
        </div>
      </div>

      <div class="status-section">
        <div
          class="status-icon"
          :class="{
            'status-icon--pending': registerStatus.chainStatus === 'pending',
            'status-icon--success': registerStatus.chainStatus === 'success',
            'status-icon--error': registerStatus.chainStatus === 'error',
          }"
        >
          {{ statusIconText(registerStatus.chainStatus) }}
        </div>
        <div class="status-content">
          <div class="status-title">长安链存证状态</div>
          <div :class="statusTextClass(registerStatus.chainStatus)">
            {{ registerStatus.chainText }}
          </div>
        </div>
      </div>

      <div class="status-section">
        <div
          class="status-icon"
          :class="{
            'status-icon--pending': registerStatus.databaseStatus === 'pending',
            'status-icon--success': registerStatus.databaseStatus === 'success',
            'status-icon--error': registerStatus.databaseStatus === 'error',
          }"
        >
          {{ statusIconText(registerStatus.databaseStatus) }}
        </div>
        <div class="status-content">
          <div class="status-title">本地数据库状态</div>
          <div :class="statusTextClass(registerStatus.databaseStatus)">
            {{ registerStatus.databaseText }}
          </div>
        </div>
      </div>

      <div v-if="registerStatus.assetId || registerStatus.txHash || registerStatus.tokenId" class="status-detail">
        <div v-if="registerStatus.assetId" class="status-detail-row">
          <span>资产ID</span>
          <strong>{{ registerStatus.assetId }}</strong>
        </div>
        <div v-if="registerStatus.txHash" class="status-detail-row">
          <span>交易哈希</span>
          <strong>{{ registerStatus.txHash }}</strong>
        </div>
        <div v-if="registerStatus.tokenId" class="status-detail-row">
          <span>链上标识</span>
          <strong>{{ registerStatus.tokenId }}</strong>
        </div>
      </div>

      <template #footer>
        <el-button @click="registerStatusVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AssetValuationDialog from '@/components/AssetValuationDialog.vue'
import {
  classifyAsset,
  checkOmniPrintSimilarity,
  getAssetMeta,
  getCertificates,
  generateAssetFingerprint,
  registerAsset,
} from '@/api/asset'
import { roundPrice } from '@/utils/price'
import { getRoleKey, parseTokenPayload } from '@/utils/auth'

interface CertificateItem {
  cert: string
  organization?: string
  address?: string
  sign_cert_path?: string | null
  tls_cert_path?: string | null
  pem_path?: string | null
  data?: {
    chain_address?: string
    org_code?: string
  }
}

interface AssetCategoryItem {
  id: number
  category_key: string
  category_name: string
  category_desc?: string
  sub_categories?: AssetSubCategoryItem[]
}

interface AssetSubCategoryItem {
  id: number
  category_id: number
  sub_category_key: string
  sub_category_name: string
  sub_category_desc?: string
}

interface RegionItem {
  id: number
  region_key: string
  region_name: string
}

const presetAssetCategories: AssetCategoryItem[] = [
  { id: -1, category_key: 'crypto_stablecoin', category_name: '加密货币与稳定币' },
  { id: -2, category_key: 'cbdc', category_name: '央行数字货币' },
  { id: -3, category_key: 'digital_content_ip', category_name: '数字内容和知识产权' },
  { id: -4, category_key: 'account_identity_asset', category_name: '账户与身份型虚拟资产' },
  { id: -5, category_key: 'data_asset', category_name: '数据资产' },
  { id: -6, category_key: 'digital_certificate', category_name: '数字化凭证' },
  { id: -7, category_key: 'digital_security_asset', category_name: '数字证券资产' },
]

const mergePresetCategories = (items: AssetCategoryItem[] = []) => {
  const merged = [...items]
  const existed = new Set(items.map((item) => String(item.category_name || '').trim()))
  presetAssetCategories.forEach((item) => {
    if (!existed.has(item.category_name)) merged.push(item)
  })
  return merged
}

const categories = ref<AssetCategoryItem[]>([])
const subCategories = ref<AssetSubCategoryItem[]>([])
const localSubCategories = ref<AssetSubCategoryItem[]>([])
const regions = ref<RegionItem[]>([])

const initForm = () => ({
  username: '',
  user_id: '',
  asset_name: '',
  assetType: '',
  brief: '',
  description: '',
  category_id: undefined as number | undefined,
  region_id: 0,
  file_hash: '',
  hash_algorithm: 'FINGERPRINT',
  algorithm: 'FINGERPRINT',
  customAlgorithm: '',
  file_size: 0,
  file_format: '',
  price: 0,
  price_unit: '人民币',
  publish_on_register: false,
  total_qty: 1,
  available_qty: 1,
  is_divisible: 1,
  can_sell_ownership: 0,
  can_sell_view_right: 0,
  can_sell_process_right: 0,
  allow_resale: 0,
  is_proxied: 0,
  is_third_party: 0,
  trade_region: '',
  collect_location: '',
  sensor_type: '',
  data_volume: '',
  industry: 'WH',
  industry_raw: 'WH',
  industry_raw_name: '自动驾驶数字资产',
  selectedCertificate: '',
  certificate_name: '',
  owner_address: '',
  email: '',
  address: '',
  isProxied: false,
  isSellBody: true,
  isSellReadRight: true,
  isSellProcessRight: true,
  modelSelection: 'weighted_average',
  picture: null as File | null,
  picture_preview: '',
  classification_category_name: '',
  classification_data_level: '一般数据',
  classification_method_name: '',
  pc_type: 'HE',
  sub_category_name_input: '',
  fingerprint_bits: '',
  omniprint_fingerprint: '',
  omniprint_modality: '',
  pricing_mode: 'fixed',
  auction_end_time: '',
})

const form = reactive(initForm())
const submitting = ref(false)
const certLoading = ref(true)
const certLoadError = ref('')
const uploadingSource = ref(false)
const similarityChecking = ref(false)
const classifying = ref(false)
const certificates = ref<CertificateItem[]>([])
const defaultRegisterCertificate = ref<CertificateItem | null>(null)
const pictureInputRef = ref<HTMLInputElement | null>(null)
const sourceFileInputRef = ref<HTMLInputElement | null>(null)
const currentRole = getRoleKey(parseTokenPayload()?.identity || '')
const sourceFile = ref<File | null>(null)
const valuationVisible = ref(false)
const draftRestoring = ref(false)
let draftSaveTimer: ReturnType<typeof setTimeout> | null = null
type RegisterStepStatus = 'pending' | 'success' | 'error'
const registerStatusVisible = ref(false)
const registerStatus = reactive({
  hashText: '',
  databaseStatus: 'pending' as RegisterStepStatus,
  databaseText: '保存中',
  chainStatus: 'pending' as RegisterStepStatus,
  chainText: '上链中',
  assetId: '',
  txHash: '',
  tokenId: '',
})
const classificationMethodOptions = [
  { label: '类型划分法', value: '类型划分法' },
  { label: '收益法', value: '收益法' },
  { label: '流通性划分法', value: '流通性划分法' },
  { label: '价值稳定性法', value: '价值稳定性法' },
  { label: '数据危害性法', value: '数据危害性法' },
  { label: '安全法', value: '安全法' },
  { label: '数据敏感法', value: '数据敏感法' },
  { label: '数据脆弱性法', value: '数据脆弱性法' },
]
const deliveryMethodOptions = [
  { label: '同态加密 HE', value: 'HE' },
  { label: '代理重加密 PRE', value: 'PRE' },
  { label: '联邦学习 FL', value: 'FL' },
  { label: '多方安全计算 MPC', value: 'MPC' },
]

const DRAFT_STORAGE_PREFIX = 'chain-register-draft'
const CUSTOM_SUB_CATEGORY_STORAGE_KEY = 'chain-register-custom-sub-categories'
const DRAFT_PICTURE_MAX_BYTES = 2 * 1024 * 1024
const draftFieldKeys = [
  'asset_name',
  'brief',
  'description',
  'category_id',
  'region_id',
  'file_hash',
  'hash_algorithm',
  'algorithm',
  'customAlgorithm',
  'file_size',
  'file_format',
  'price',
  'price_unit',
  'publish_on_register',
  'classification_category_name',
  'classification_data_level',
  'classification_method_name',
  'pc_type',
  'sub_category_name_input',
  'fingerprint_bits',
  'omniprint_fingerprint',
  'omniprint_modality',
  'pricing_mode',
  'auction_end_time',
  'email',
  'address',
  'isSellBody',
  'isSellReadRight',
  'isSellProcessRight',
  'allow_resale',
  'isProxied',
  'trade_region',
  'collect_location',
  'sensor_type',
  'data_volume',
] as const

const getDraftStorageKey = () => {
  const userKey = String(form.user_id || form.username || parseTokenPayload()?.account || 'anonymous').trim()
  return `${DRAFT_STORAGE_PREFIX}:${userKey || 'anonymous'}`
}

const resetRegisterStatus = () => {
  registerStatus.hashText = '数字指纹已生成'
  registerStatus.databaseStatus = 'pending'
  registerStatus.databaseText = '等待链上存证完成'
  registerStatus.chainStatus = 'pending'
  registerStatus.chainText = '链上存证中'
  registerStatus.assetId = ''
  registerStatus.txHash = ''
  registerStatus.tokenId = ''
}

const statusIconText = (status: RegisterStepStatus) => {
  if (status === 'success') return '✓'
  if (status === 'error') return '×'
  return '...'
}

const statusTextClass = (status: RegisterStepStatus) => ({
  'success-text': status === 'success',
  'error-text': status === 'error',
  'pending-text': status === 'pending',
})

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
  reader.readAsDataURL(file)
})

const dataUrlToFile = (dataUrl: string, filename: string, mimeType = 'image/png') => {
  const [header, body = ''] = String(dataUrl || '').split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] || mimeType
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new File([bytes], filename || 'asset-cover.png', { type: mime })
}

const buildDraftPayload = () => {
  const data: Record<string, any> = {}
  draftFieldKeys.forEach((key) => {
    data[key] = form[key]
  })
  return {
    data,
    picture: form.picture_preview?.startsWith('data:')
      ? {
          dataUrl: form.picture_preview,
          name: form.picture?.name || 'asset-cover.png',
          mimeType: form.picture?.type || 'image/png',
        }
      : null,
    savedAt: Date.now(),
  }
}

const saveRegisterDraft = () => {
  if (draftRestoring.value || currentRole !== 'seller') return
  try {
    sessionStorage.setItem(getDraftStorageKey(), JSON.stringify(buildDraftPayload()))
  } catch (_error) {
    // 图片过大时不保存封面，保留其他填写项，避免整份草稿失败。
    const payload = buildDraftPayload()
    payload.picture = null
    try {
      sessionStorage.setItem(getDraftStorageKey(), JSON.stringify(payload))
    } catch {}
  }
}

const scheduleSaveRegisterDraft = () => {
  if (draftSaveTimer) clearTimeout(draftSaveTimer)
  draftSaveTimer = setTimeout(saveRegisterDraft, 250)
}

const clearRegisterDraft = () => {
  try {
    sessionStorage.removeItem(getDraftStorageKey())
  } catch {}
}

const loadLocalSubCategories = () => {
  try {
    const raw = localStorage.getItem(CUSTOM_SUB_CATEGORY_STORAGE_KEY)
    const names = raw ? JSON.parse(raw) : []
    if (!Array.isArray(names)) return
    localSubCategories.value = names
      .map((name) => String(name || '').trim())
      .filter(Boolean)
      .map((name, index) => ({
        id: -10000 - index,
        category_id: Number(form.category_id || 0),
        sub_category_key: `local_${index}`,
        sub_category_name: name,
      }))
  } catch {
    localSubCategories.value = []
  }
}

const persistCustomSubCategory = (value: string) => {
  const name = String(value || '').trim()
  if (!name) return
  const existedInDb = subCategories.value.some(
    (item) => String(item.sub_category_name || '').trim() === name,
  )
  if (existedInDb) return

  const names = [
    name,
    ...localSubCategories.value.map((item) => String(item.sub_category_name || '').trim()),
  ].filter(Boolean)
  const uniqueNames = Array.from(new Set(names)).slice(0, 30)
  localStorage.setItem(CUSTOM_SUB_CATEGORY_STORAGE_KEY, JSON.stringify(uniqueNames))
  loadLocalSubCategories()
}

const restoreRegisterDraft = () => {
  if (currentRole !== 'seller') return
  const raw = sessionStorage.getItem(getDraftStorageKey())
  if (!raw) return

  try {
    const draft = JSON.parse(raw)
    const data = draft?.data || {}
    draftRestoring.value = true
    draftFieldKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        ;(form as any)[key] = data[key]
      }
    })
    // 登记流程与原始系统一致，仅使用 OmniPrint 数字指纹存证。
    form.algorithm = 'FINGERPRINT'
    form.hash_algorithm = 'FINGERPRINT'
    if (draft?.picture?.dataUrl) {
      form.picture_preview = draft.picture.dataUrl
      form.picture = dataUrlToFile(draft.picture.dataUrl, draft.picture.name, draft.picture.mimeType)
    }
  } catch (_error) {
    clearRegisterDraft()
  } finally {
    draftRestoring.value = false
  }
}

const filteredSubCategories = computed(() => {
  const selectedCategoryId = Number(form.category_id || 0)
  const dbOptions = selectedCategoryId
    ? subCategories.value.filter((item) => Number(item.category_id) === selectedCategoryId)
    : subCategories.value
  const merged = [...dbOptions, ...localSubCategories.value]
  const existed = new Set<string>()
  return merged.filter((item) => {
    const name = String(item.sub_category_name || '').trim()
    if (!name || existed.has(name)) return false
    existed.add(name)
    return true
  })
})

const refreshSubCategoryOptions = async () => {
  loadLocalSubCategories()
  try {
    await loadAssetMeta()
  } catch {
    // 聚焦刷新失败时保留已有候选，用户仍可直接输入自定义方向。
  }
}

const canClassify = computed(() => Boolean(
  String(form.asset_name || '').trim() &&
  String(form.description || '').trim() &&
  String(form.classification_method_name || '').trim(),
))
const fileSizeText = computed(() => {
  const size = Number(form.file_size || 0)
  if (!size) return ''
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(2)} KB`
  return `${size} B`
})

const fillIdentifierResult = (data: any, fallbackFile?: File | null) => {
  const fingerprint = String(data.fingerprint || '').trim()
  const fingerprintBits = data.fingerprint_bits || ''
  const sanitizedFingerprint = fingerprint.replace(/[^A-Za-z0-9_.]/g, '')
  form.file_hash = sanitizedFingerprint
  form.hash_algorithm = 'FINGERPRINT'
  form.algorithm = 'FINGERPRINT'
  form.file_size = Number(data.file_size || fallbackFile?.size || 0)
  form.file_format = data.file_format || fallbackFile?.name.split('.').pop() || ''
  form.fingerprint_bits = fingerprintBits
  form.omniprint_fingerprint = fingerprint
  form.omniprint_modality = data.type || ''
}

const hasCompleteFingerprint = () => Boolean(
  String(form.file_hash || '').trim()
  && String(form.omniprint_fingerprint || '').trim()
  && String(form.fingerprint_bits || '').trim()
  && String(form.omniprint_modality || '').trim(),
)

const hasOmniPrintFingerprint = () => Boolean(String(form.omniprint_fingerprint || '').trim())

const disablePastDate = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

const applyDefaultMetaSelection = () => {
  const defaultRegion = regions.value.find((item) => item.region_key === 'all') || regions.value[0]
  if (defaultRegion) {
    form.region_id = Number(defaultRegion.id)
  }
}

const loadAssetMeta = async () => {
  const res: any = await getAssetMeta()
  const data = res?.data?.data || {}
  categories.value = mergePresetCategories(data.categories || [])
  subCategories.value = categories.value.flatMap((item) => item.sub_categories || [])
  regions.value = data.regions || []

  if (!regions.value.length) {
    throw new Error('地区元数据为空')
  }

  applyDefaultMetaSelection()
}

const triggerPictureSelect = () => {
  pictureInputRef.value?.click()
}

const onCertificateChange = (certName: string) => {
  const hit = certificates.value.find((item) => item.cert === certName)
  form.certificate_name = certName
  // 与原始系统一致：登记时直接使用 certificate_registry 已保存的地址。
  form.owner_address = hit?.address || hit?.data?.chain_address || ''
}

const applyResolvedCertificate = async (cert: CertificateItem | null, preferAsDefault = false) => {
  if (!cert?.cert) return
  if (preferAsDefault) {
    defaultRegisterCertificate.value = cert
  }
  form.selectedCertificate = cert.cert
  form.certificate_name = cert.cert
  onCertificateChange(cert.cert)
}

const resetForm = () => {
  const username = form.username
  const userId = form.user_id
  clearRegisterDraft()
  Object.assign(form, initForm())
  sourceFile.value = null
  if (sourceFileInputRef.value) {
    sourceFileInputRef.value.value = ''
  }
  form.username = username
  form.user_id = userId
  if (defaultRegisterCertificate.value?.cert) {
    form.selectedCertificate = defaultRegisterCertificate.value.cert
    form.certificate_name = defaultRegisterCertificate.value.cert
    form.owner_address = defaultRegisterCertificate.value.address || ''
  }
  if (regions.value.length) {
    applyDefaultMetaSelection()
  }
}

const clearIdentifierFields = () => {
  form.file_hash = ''
  form.file_size = 0
  form.file_format = ''
  form.fingerprint_bits = ''
  form.omniprint_fingerprint = ''
  form.omniprint_modality = ''
}

const clearSourceFile = () => {
  sourceFile.value = null
  clearIdentifierFields()
  if (sourceFileInputRef.value) {
    sourceFileInputRef.value.value = ''
  }
}

const generateIdentifierByCurrentAlgorithm = async (
  file: File,
  options: { clearOnError?: boolean; showSuccess?: boolean } = {},
): Promise<boolean> => {
  const { clearOnError = true, showSuccess = true } = options
  const uploadForm = new FormData()
  uploadForm.append('file', file)
  uploadForm.append('algorithm', 'FINGERPRINT')

  uploadingSource.value = true
  try {
    let res: any
    uploadForm.append('assetId', form.asset_name || `asset-${Date.now()}`)
    res = await generateAssetFingerprint(uploadForm)

    const data = res?.data || {}
    if (!data?.success || !data?.fingerprint) {
      throw new Error(data?.message || '数字指纹生成失败')
    }
    fillIdentifierResult(data, file)
    const generated = hasOmniPrintFingerprint()
    if (showSuccess && generated) {
      ElMessage.success('数字指纹生成成功')
    }
    return generated
  } catch (error) {
    const err: any = error
    if (clearOnError) {
      form.file_hash = ''
      form.fingerprint_bits = ''
      form.omniprint_fingerprint = ''
      form.omniprint_modality = ''
    }
    ElMessage.error(err?.response?.data?.message || err?.message || '数字指纹生成失败')
    return false
  } finally {
    uploadingSource.value = false
  }
}

const runOmniPrintSimilarityCheck = async () => {
  if (!hasOmniPrintFingerprint()) {
    if (!sourceFile.value) {
      ElMessage.warning('请先选择源文件')
      return
    }

    const generated = await generateIdentifierByCurrentAlgorithm(sourceFile.value, {
      clearOnError: false,
      showSuccess: false,
    })
    if (!generated || !hasOmniPrintFingerprint()) {
      ElMessage.error('未获取到原始 OmniPrint 指纹')
      return
    }
  }
  similarityChecking.value = true
  try {
    const res: any = await checkOmniPrintSimilarity({
      fingerprint: form.omniprint_fingerprint,
      fingerprint_bits: Number(form.fingerprint_bits),
      modality: form.omniprint_modality,
    })
    const data = res?.data || {}
    const matches = data.matches || []
    if (!matches.length) {
      await ElMessageBox.alert(`已比较 ${data.comparedCount || 0} 条同模态资产，未发现相似资产。`, '相似度检测结果')
      return
    }
    const content = matches.slice(0, 3).map((item: any) => {
      const percent = (Number(item.bit_similarity || 0) * 100).toFixed(2)
      return `${item.asset_name || item.file_hash}：${percent}%`
    }).join('<br>')
    await ElMessageBox.alert(
      `已比较 ${data.comparedCount || 0} 条同模态资产。<br>最高相似度：${(Number(matches[0].bit_similarity || 0) * 100).toFixed(2)}%<br><br>${content}`,
      '相似度检测结果',
      { dangerouslyUseHTMLString: true },
    )
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '相似度检测失败')
  } finally {
    similarityChecking.value = false
  }
}

const runClassification = async () => {
  if (!canClassify.value) {
    ElMessage.warning('请先选择分类分级方法，并填写资产名称和资产介绍')
    return
  }

  classifying.value = true
  try {
    const text = `${String(form.asset_name || '').trim()}。${String(form.description || '').trim()}`
    const res: any = await classifyAsset({
      method_name: form.classification_method_name,
      text,
    })
    const data = res?.data?.data || {}

    if (!res?.data || res.data.status !== 0) {
      throw new Error(res?.data?.message || '分类分级失败')
    }

    form.classification_data_level = data.data_level || form.classification_data_level
    form.classification_category_name = data.category_name || ''
    const matchedCategory = categories.value.find(
      (item) => String(item.category_name || '').trim() === String(form.classification_category_name || '').trim(),
    )
    form.category_id = matchedCategory ? Number(matchedCategory.id) : undefined
    form.sub_category_name_input = ''

    ElMessage.success(`分类分级完成：${form.classification_category_name} / ${form.classification_data_level}`)
  } catch (error) {
    const err: any = error
    ElMessage.error(err?.response?.data?.message || err?.message || '分类分级失败')
  } finally {
    classifying.value = false
  }
}

const onSourceFileSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    clearSourceFile()
    return
  }

  // 新文件不能沿用上一次选择文件生成的指纹；点击相似度检测或提交登记时再生成。
  clearIdentifierFields()
  sourceFile.value = file
}

const resetSourceFileInput = (event: MouseEvent) => {
  const target = event.target as HTMLInputElement
  // 允许重复选择同一个文件时仍触发 change。
  target.value = ''
}

const onPictureSelected = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  form.picture = file
  if (file.size > DRAFT_PICTURE_MAX_BYTES) {
    form.picture_preview = URL.createObjectURL(file)
    ElMessage.warning('封面图片较大，本次会话仅保存表单文字内容')
    return
  }

  fileToDataUrl(file)
    .then((dataUrl) => {
      form.picture_preview = dataUrl
    })
    .catch(() => {
      form.picture_preview = URL.createObjectURL(file)
    })
}

const initUserAndCertificates = async () => {
  certLoading.value = true
  certLoadError.value = ''
  const payload = parseTokenPayload()
  const username = payload?.account || payload?.username || ''
  form.username = username
  form.user_id = String(payload?.id || '')

  try {
    const certRes = await getCertificates()
    if (certRes.data?.status !== 0 || !Array.isArray(certRes.data?.certificates)) {
      throw new Error(certRes.data?.message || '证书查询失败')
    }
    certificates.value = certRes.data.certificates

    if (certificates.value.length === 0) {
      ElMessage.warning({
        message: '您还没有申请证书，请先前往个人中心申请证书后再进行资产登记',
        duration: 5000,
        showClose: true,
      })
      return
    }

    if (certificates.value.length !== 1) {
      throw new Error('当前账户存在多张证书，请先整理历史证书数据')
    }
    await applyResolvedCertificate(certificates.value[0], true)
  } catch (error: any) {
    certLoadError.value = error?.response?.data?.message || error?.message || '证书查询失败，请检查后端服务'
    ElMessage.warning(certLoadError.value)
  } finally {
    certLoading.value = false
  }
}

const openValuationDialog = () => {
  valuationVisible.value = true
}
const valuationAsset = computed(() => ({
  id: undefined,
  asset_name: form.asset_name,
  asset_type: form.classification_data_level,
  description: form.description,
  file_hash: form.file_hash,
  price: form.price,
}))

const normalizeAuctionStartPrice = (value: number | string) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : 0
}

const normalizeRegisterAuctionPrice = () => {
  if (form.pricing_mode === 'auction') {
    form.price = normalizeAuctionStartPrice(form.price)
  }
}

const handleValuationPriceUpdated = (value: number) => {
  form.price = form.pricing_mode === 'auction'
    ? normalizeAuctionStartPrice(value)
    : roundPrice(value)
}

const submitForm = async () => {
  if (currentRole !== 'seller') {
    ElMessage.error('买家不可登记资产')
    return
  }

  if (!String(form.asset_name || '').trim()) {
    ElMessage.error('请填写资产名称')
    return
  }
  if (!hasCompleteFingerprint() && sourceFile.value) {
    await generateIdentifierByCurrentAlgorithm(sourceFile.value, {
      clearOnError: false,
      showSuccess: false,
    })
  }
  if (!hasCompleteFingerprint()) {
    ElMessage.error(sourceFile.value ? '数字指纹生成失败，请重新选择源文件' : '请选择源文件生成数字指纹')
    return
  }
  if (!form.classification_category_name) {
    ElMessage.error('请先执行分类分级，确定数据产品类型')
    return
  }
  if (!form.picture) {
    ElMessage.error('请上传资产封面')
    return
  }
  if (!form.certificate_name) {
    ElMessage.error('请先前往个人中心申请并设置默认登记证书')
    return
  }
  if (certificates.value.length === 0) {
    ElMessage.warning({
      message: '您还没有申请证书，请先前往个人中心申请证书后再进行资产登记',
      duration: 5000,
      showClose: true,
    })
    return
  }
  if (Number(form.price) < 0) {
    ElMessage.error('资产价格不能小于 0')
    return
  }
  if (!Number.isSafeInteger(Number(form.total_qty)) || Number(form.total_qty) < 1) {
    ElMessage.error('资产总份数必须为正整数')
    return
  }
  if (form.publish_on_register && Number(form.price) <= 0) {
    ElMessage.error('立即上架时请设置大于 0 的资产价格')
    return
  }
  if (form.pricing_mode === 'auction') {
    normalizeRegisterAuctionPrice()
    if (!form.publish_on_register) {
      ElMessage.error('拍卖资产登记后必须立即上架')
      return
    }
    if (!Number.isInteger(Number(form.price)) || Number(form.price) <= 0) {
      ElMessage.error('拍卖起拍价必须为正整数')
      return
    }
    const auctionEnd = new Date(form.auction_end_time).getTime()
    if (!form.auction_end_time || !Number.isFinite(auctionEnd) || auctionEnd <= Date.now() + 60 * 1000) {
      ElMessage.error('拍卖截止时间至少应晚于当前时间 1 分钟')
      return
    }
  }
  if (!form.pc_type) {
    ElMessage.error('请选择交付方式')
    return
  }
  const shouldPublish = form.publish_on_register
  const normalizedPrice = roundPrice(form.price)
  const subCategoryName = String(form.sub_category_name_input || '').trim()

  const payload = new FormData()
  payload.append('asset_name', form.asset_name)
  payload.append('brief', form.brief || '')
  payload.append('description', form.description || '')
  payload.append('classification_category_name', form.classification_category_name || '')
  payload.append('classification_data_level', form.classification_data_level || '一般数据')
  // 分类结果可能来自动态接口，数据库重建或本地草稿恢复后 ID 不稳定。
  // 仅提交名称，由后端在同一事务中按名称复用或创建类型和方向。
  payload.append('sub_category_name', subCategoryName)
  payload.append('custom_sub_category_name', subCategoryName)
  payload.append('region_id', String(form.region_id))
  payload.append('file_hash', form.file_hash)
  payload.append('hash_algorithm', 'FINGERPRINT')
  payload.append('file_size', String(form.file_size || 0))
  payload.append('file_format', form.file_format || '')
  payload.append('price', String(normalizedPrice))
  payload.append('price_unit', form.price_unit || '人民币')
  payload.append('pc_type', form.pc_type || 'HE')
  payload.append('pricing_mode', form.pricing_mode)
  payload.append('auction_start_price', form.pricing_mode === 'auction' ? String(normalizedPrice) : '')
  payload.append('auction_end_time', form.pricing_mode === 'auction' ? form.auction_end_time : '')
  payload.append('omniprint_fingerprint', form.omniprint_fingerprint || '')
  payload.append('omniprint_fingerprint_bits', String(form.fingerprint_bits || ''))
  payload.append('omniprint_modality', form.omniprint_modality || '')
  payload.append('omniprint_source', 'file')
  payload.append('total_qty', String(form.total_qty))
  payload.append('available_qty', String(form.total_qty))
  payload.append('is_divisible', '1')
  payload.append('can_sell_ownership', String(form.isSellBody ? 1 : 0))
  payload.append('can_sell_view_right', String(form.isSellReadRight ? 1 : 0))
  payload.append('can_sell_process_right', String(form.isSellProcessRight ? 1 : 0))
  payload.append('allow_resale', String(form.allow_resale))
  payload.append('is_proxied', String(form.isProxied ? 1 : 0))
  payload.append('is_third_party', '0')
  payload.append('status', '0')
  payload.append('publish_on_register', String(shouldPublish ? 1 : 0))
  payload.append('trade_region', form.trade_region || '')
  payload.append('collect_location', form.collect_location || '')
  payload.append('sensor_type', form.sensor_type || '')
  payload.append('data_volume', form.data_volume || '')
  payload.append('certificate_name', form.certificate_name || form.selectedCertificate || '')
  payload.append('owner_address', form.owner_address || '')
  payload.append('assetName', form.asset_name)
  payload.append('assetType', form.classification_data_level)
  payload.append('asset_category', form.classification_category_name || '')
  payload.append('email', form.email || '')
  payload.append('address', form.address || '')
  payload.append('algorithm', 'FINGERPRINT')
  payload.append('customAlgorithm', form.customAlgorithm || '')
  payload.append('industry', 'WH')
  payload.append('industry_raw', 'WH')
  payload.append('industry_raw_name', '自动驾驶数字资产')
  payload.append('modelSelection', form.modelSelection || 'weighted_average')
  payload.append('selectedCertificate', form.certificate_name || form.selectedCertificate || '')
  payload.append('can_sell_asset', String(form.isSellBody ? 1 : 0))
  payload.append('can_sell_view', String(form.isSellReadRight ? 1 : 0))
  payload.append('can_sell_process', String(form.isSellProcessRight ? 1 : 0))
  payload.append('isProxied', String(form.isProxied))
  payload.append('user_id', form.user_id || '')
  payload.append('picture_file', form.picture)

  submitting.value = true
  resetRegisterStatus()
  registerStatusVisible.value = true
  try {
    const res = await registerAsset(payload)
    if (res.data.status === 0) {
      const assetId = Number(res.data.data?.asset_id || 0)
      const chainStatus = Number(res.data.data?.chain_status)
      const chainData = res.data.data?.chain || {}
      const tx = chainData.chain_tx_hash || ''

      registerStatus.assetId = assetId ? String(assetId) : ''
      registerStatus.txHash = tx || ''
      registerStatus.tokenId = chainData.token_id || ''
      registerStatus.databaseStatus = 'success'
      registerStatus.databaseText = '数据已成功保存'

      if (chainStatus === 1) {
        registerStatus.chainStatus = 'success'
        registerStatus.chainText = tx ? `上链成功，Tx：${tx}` : '上链成功'
        if (shouldPublish) {
          ElMessage.success(`登记、上链并上架成功，资产ID：${assetId}，Tx：${tx}`)
        } else {
          ElMessage.success(`登记并上链成功，资产ID：${assetId}，Tx：${tx}`)
        }
      } else if (chainStatus === 2) {
        registerStatus.chainStatus = 'error'
        registerStatus.chainText = chainData.error || '链上登记失败，请稍后重试'
        registerStatus.databaseStatus = 'pending'
        registerStatus.databaseText = '链上登记失败，本地数据库未入库'
        ElMessage.warning(`链上登记失败，本地未入库：${registerStatus.chainText}`)
      } else {
        registerStatus.chainStatus = 'pending'
        registerStatus.chainText = '已提交登记，请稍后查看链上状态'
        ElMessage.success(`登记成功，资产ID：${assetId}`)
      }

      await loadAssetMeta()
      clearRegisterDraft()
      resetForm()
      if (defaultRegisterCertificate.value?.cert) {
        await applyResolvedCertificate(defaultRegisterCertificate.value, true)
      } else if (certificates.value.length) {
        await applyResolvedCertificate(certificates.value[0], false)
      }
    } else {
      const message = res.data.message || '登记失败'
      const isChainError = message.includes('链上登记失败') || message.includes('链服务请求超时')
      registerStatus.databaseStatus = 'error'
      registerStatus.databaseText = isChainError ? '链上登记失败，本地数据库未入库' : message
      registerStatus.chainStatus = 'error'
      registerStatus.chainText = isChainError ? message : '未执行上链'
      ElMessage.error(message)
    }
  } catch (error: any) {
    const backendMsg = error?.response?.data?.message || error?.message || ''
    const isChainError = backendMsg.includes('链上登记失败') || backendMsg.includes('链服务请求超时')
    registerStatus.databaseStatus = isChainError ? 'pending' : 'error'
    registerStatus.databaseText = isChainError
      ? '链上登记失败，本地数据库未入库'
      : backendMsg || '登记失败，请检查网络或登录状态'
    registerStatus.chainStatus = 'error'
    registerStatus.chainText = isChainError ? backendMsg : '未完成上链'
    ElMessage.error(backendMsg ? `登记失败：${backendMsg}` : '登记失败，请检查网络或登录状态')
  } finally {
    submitting.value = false
  }
}

watch(
  form,
  () => {
    scheduleSaveRegisterDraft()
  },
  { deep: true },
)

onMounted(async () => {
  loadLocalSubCategories()
  await Promise.allSettled([
    loadAssetMeta().catch(() => ElMessage.error('加载资产分类失败，请检查后端分类元数据接口')),
    initUserAndCertificates(),
  ])
  restoreRegisterDraft()
  if (defaultRegisterCertificate.value?.cert) {
    await applyResolvedCertificate(defaultRegisterCertificate.value, true)
  }
})
</script>

<style lang="scss" scoped>
.common-wrapped {
  width: 100%;
  display: flex;
  justify-content: center;
  background: #fff;

  .register-page {
    padding: 16px 20px;
    width: 85%;
    min-height: 100vh;
    box-sizing: border-box;
  }
}

.register-card {
  border: 1px solid transparent;
  border-radius: 12px;
  background: linear-gradient(#fff, #fff) padding-box,
    linear-gradient(135deg, #d6dae1, #f2f3f5 55%, #d3d8e0) border-box;
  box-shadow: 0 8px 24px rgba(31, 41, 55, 0.04);

  :deep(.el-card__header) {
    padding: 14px 18px;
    border-bottom: 1px solid #eef2fb;
  }

  :deep(.el-card__body) {
    padding: 16px 18px;
  }
}

.header {
  font-size: 16px;
  font-weight: 600;
  color: #193a8d;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section {
  padding: 16px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: linear-gradient(#fff, #fff) padding-box,
    linear-gradient(120deg, #d8dde4, #f0f1f3 50%, #d8dde4) border-box;
}

.section-title {
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 600;
  color: #213b75;
}

.register-main {
  display: grid;
  grid-template-columns: 200px minmax(0, 760px);
  gap: 28px;
  align-items: start;
}

.cover-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.cover-box {
  width: 160px;
  height: 160px;
  border: 1px dashed #cbd0d8;
  border-radius: 8px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
}

.cover-button {
  width: 160px;
}

.register-action-button {
  min-width: 90px;
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

.register-action-button:deep(.el-icon) {
  margin-right: 4px;
}

.cover-empty {
  font-size: 13px;
  color: #7b89a8;
}

.hidden-file-input {
  display: none;
}

.picture-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.form-panel {
  width: 100%;
}

.form-panel :deep(.el-form-item) {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  align-items: start;
}

.row-item {
  width: 100%;
  margin-bottom: 14px;
}

.row-item :deep(.el-form-item__label) {
  width: 132px !important;
  justify-content: flex-start;
  text-align: left;
  line-height: 32px;
  padding-right: 16px;
  box-sizing: border-box;
}

.row-item :deep(.el-form-item__content) {
  width: 100%;
  min-width: 0;
}

.row-item :deep(.el-input),
.row-item :deep(.el-select),
.row-item :deep(.el-textarea) {
  width: 100%;
}

.native-file-input {
  width: 100%;
  font-size: 13px;
  color: #35507f;
}

.native-file-input::file-selector-button {
  height: 32px;
  padding: 0 14px;
  margin-right: 12px;
  border: 1px solid #7ea6d8;
  border-radius: 6px;
  background: #fff;
  color: #2f59d9;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.native-file-input:hover::file-selector-button {
  border-color: #5b8def;
  background: #fff;
}

.asset-file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
  flex-wrap: wrap;
}

.native-file-input--compact {
  flex: 0 1 360px;
  min-width: 0;
}

.file-size-inline {
  margin-top: 0;
  flex: 0 0 auto;
}

.classification-item :deep(.el-form-item__content) {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  min-width: 0;
}

.identifier-item :deep(.el-form-item__content) {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  min-width: 0;
}

.identifier-group {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px 10px;
  min-width: 0;
}

.identifier-tip {
  flex: 0 0 auto;
}

.price-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
}

.classification-result {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-height: 32px;
  min-width: 0;
  flex: 1 1 auto;
}

@media (max-width: 1200px) {
  .classification-item :deep(.el-form-item__content) {
    flex-wrap: wrap;
  }
}

.certificate-block {
  width: 100%;
}

.result-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid #e3e7ed;
  background: #fff;
  color: #2f59d9;
  font-size: 13px;
}

.result-chip--warn {
  border-color: #ece6dc;
  background: #fff;
  color: #c97a16;
}

.trade-panel {
  width: min(100%, 920px);
  margin: 0 auto;
}

.trade-switch-item :deep(.el-form-item__content) {
  min-height: 32px;
  display: flex;
  align-items: center;
}

.trade-single-item {
  width: 100%;
  margin-bottom: 14px;
}

:deep(.el-form-item) {
  margin-bottom: 14px;
}

.trade-single-item :deep(.el-form-item__content) {
  width: 100%;
  min-width: 0;
}

.trade-permission-item {
  width: 100%;
  min-width: 0;
}

.trade-permission-item {
  width: 100%;
  min-width: 0;
}

.permission-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.permission-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* 资产登记的单选、多选和二态选择统一使用黑白灰。 */
.register-form :deep(.el-radio),
.register-form :deep(.el-checkbox) {
  color: #303030;
}

.register-form :deep(.el-radio__inner),
.register-form :deep(.el-checkbox__inner) {
  background: #fff;
  border-color: #8b8b8b;
}

.register-form :deep(.el-radio:not(.is-disabled):hover .el-radio__inner),
.register-form :deep(.el-checkbox:not(.is-disabled):hover .el-checkbox__inner) {
  border-color: #111;
}

.register-form :deep(.el-radio__input.is-checked .el-radio__inner),
.register-form :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background: #111;
  border-color: #111;
}

.register-form :deep(.el-radio__input.is-checked + .el-radio__label),
.register-form :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #111;
}

.register-form :deep(.el-radio__input.is-disabled .el-radio__inner),
.register-form :deep(.el-checkbox__input.is-disabled .el-checkbox__inner) {
  background: #f3f3f3;
  border-color: #d1d1d1;
}

.register-form :deep(.el-switch) {
  --el-switch-on-color: #111;
  --el-switch-off-color: #b8b8b8;
}

.field-inline-tip {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: #61708f;
  word-break: break-all;
}

.field-inline-tip--inline {
  margin-top: 0;
}

.field-inline-tip--danger {
  color: #d24d57;

  :deep(a) {
    color: #409eff;
  }
}

.actions {
  margin-top: 10px;
  padding-top: 14px;
  border-top: 1px solid #eef2fb;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.valuation-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.valuation-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.valuation-field__label {
  font-size: 13px;
  font-weight: 600;
  color: #35507f;
}

.valuation-result-block {
  padding: 12px;
  border: 1px solid #e7edf8;
  border-radius: 8px;
  background: #fff;
}

.valuation-result-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #213b75;
}

.valuation-raw {
  margin: 0;
  padding: 12px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #e3e7ed;
  color: #334155;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.valuation-error {
  font-size: 13px;
  color: #d24d57;
}

.chain-status-dialog {
  :deep(.el-dialog) {
    border-radius: 8px;
  }

  :deep(.el-dialog__header) {
    margin-right: 0;
    padding: 16px 20px 12px;
    border-bottom: 1px solid #eef2fb;
  }

  :deep(.el-dialog__title) {
    font-size: 16px;
    font-weight: 600;
    color: #193a8d;
  }

  :deep(.el-dialog__body) {
    padding: 18px 22px;
  }

  :deep(.el-dialog__footer) {
    padding: 12px 20px 16px;
    border-top: 1px solid #eef2fb;
  }
}

.status-section {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e7edf8;
  border-radius: 8px;
  background: #fff;

  & + & {
    margin-top: 12px;
  }
}

.status-icon {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.status-icon--pending {
  background: #fff;
  border: 1px solid #dbe5f5;
  color: #2f59d9;
}

.status-icon--success {
  background: #fff;
  border: 1px solid #dcefe2;
  color: #1f9d55;
}

.status-icon--error {
  background: #fff;
  border: 1px solid #f3dfe2;
  color: #d24d57;
}

.status-content {
  min-width: 0;
  flex: 1;
}

.status-title {
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #213b75;
}

.success-text,
.error-text,
.pending-text {
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.success-text {
  color: #1f9d55;
}

.error-text {
  color: #d24d57;
}

.pending-text {
  color: #61708f;
}

.status-detail {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e7edf8;
}

.status-detail-row {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  font-size: 12px;
  line-height: 1.6;

  & + & {
    margin-top: 6px;
  }

  span {
    color: #61708f;
  }

  strong {
    color: #213b75;
    font-weight: 500;
    word-break: break-all;
  }
}

@media (max-width: 980px) {
  .register-main,
  .trade-grid {
    grid-template-columns: 1fr;
  }

  .cover-panel {
    align-items: stretch;
  }

  .cover-box,
  .cover-button {
    width: 100%;
  }
}
</style>
