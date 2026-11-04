<template>
  <div class="common-wrapped">
    <div class="market-page">
      <!-- 顶部搜索 -->
      <section class="search-section">
        <div class="search-row">
          <div class="search-title"><span>自动驾驶数字资产</span></div>
          <el-input
            v-model="query.keyword"
            class="search-input"
            placeholder="请输入你要搜索的内容"
            clearable
            @keyup.enter="onSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" class="search-btn" @click="onSearch">搜索</el-button>
        </div>
      </section>

      <!-- 中部筛选 -->
      <section class="filter-section">
        <div class="filter-row">
          <div class="filter-label">地区：</div>
          <div class="filter-options">
            <span
              v-for="item in regionOptions"
              :key="item.id"
              class="option-chip"
              :class="{ active: query.region_id === item.id }"
              @click="selectRegion(item.id)"
            >
              {{ item.name }}
            </span>
          </div>
        </div>

        <div class="filter-row">
          <div class="filter-label">数据产品类型：</div>
          <div class="filter-options">
            <span
              v-for="item in categoryOptions"
              :key="item.id"
              class="option-chip"
              :class="{ active: query.category_id === item.id }"
              @click="selectCategory(item.id)"
            >
              {{ item.name }}
            </span>
          </div>
        </div>

        <div class="filter-row">
          <div class="filter-label">数据分级：</div>
          <div class="filter-options">
            <span
              v-for="item in assetGradeOptions"
              :key="item.value"
              class="option-chip"
              :class="{ active: query.classification_data_level === item.value }"
              @click="selectAssetGrade(item.value)"
            >
              {{ item.name }}
            </span>
          </div>
        </div>

      </section>

      <!-- 底部资产展示 -->
      <section class="result-section" v-loading="loading">
        <div class="result-top">
          <span class="result-count">共 {{ pagination.total }} 个数据资产</span>
        </div>
        <el-alert v-if="listError" :title="listError" type="error" :closable="false">
          <template #default>
            <el-button type="primary" link @click="fetchList()">重试加载</el-button>
          </template>
        </el-alert>

        <div v-if="list.length" class="asset-list">
          <el-card v-for="item in list" :key="item.id" class="asset-card" shadow="hover">
            <div class="asset-content">
              <img
                class="asset-cover"
                :src="resolveCover(item)"
                alt="asset"
                @click="goDetail(item.id)"
              />
              <div class="asset-main">
                <div class="asset-title-row">
                  <h3 class="asset-title" @click="goDetail(item.id)">{{ item.asset_name }}</h3>
                  <div class="asset-tags">
                    <el-tag size="small" type="info">{{ item.category_name || '未分类' }}</el-tag>
                    <el-tag size="small">{{ item.sub_category_name || '未分类' }}</el-tag>
                    <el-tag size="small" type="danger">
                      {{ item.classification_data_level || '一般数据' }}
                    </el-tag>
                    <el-tag size="small" type="warning">{{
                      item.region_name || '未知地区'
                    }}</el-tag>
                  </div>
                </div>
                <p class="asset-brief">{{ item.brief || '暂无摘要' }}</p>
                <div class="permission-row">
                  <span class="permission-label">可交易权益：</span>
                  <div class="permission-tags">
                    <el-tag
                      v-if="item.can_sell_ownership === 1"
                      size="small"
                      type="danger"
                      effect="plain"
                    >
                      所有权
                    </el-tag>
                    <el-tag
                      v-if="item.can_sell_view_right === 1"
                      size="small"
                      type="success"
                      effect="plain"
                    >
                      查阅权
                    </el-tag>
                    <el-tag
                      v-if="item.can_sell_process_right === 1"
                      size="small"
                      type="warning"
                      effect="plain"
                    >
                      加工使用权
                    </el-tag>
                    <span
                      v-if="
                        item.can_sell_ownership !== 1 &&
                        item.can_sell_view_right !== 1 &&
                        item.can_sell_process_right !== 1
                      "
                      class="permission-empty"
                    >
                      暂无可售权益
                    </span>
                  </div>
                </div>
                <div class="asset-meta">
                  <span>创建时间：{{ formatDateTime(item.created_at) }}</span>
                  <span>浏览：{{ item.view_count || 0 }}</span>
                  <span>成交：{{ item.trade_count || 0 }}</span>
                </div>
              </div>
              <div class="asset-side">
                <div class="price">
                  {{ formatPrice(displayPrice(item)) }}<span>{{ item.price_unit || '人民币' }}</span>
                </div>
                <div v-if="item.pricing_mode === 'auction'" class="auction-meta">
                  <span>{{ auctionStatusText(item) }}</span>
                  <span>出价 {{ item.auction_bid_count || 0 }} 次</span>
                </div>
                <el-tag
                  v-if="item.pricing_mode !== 'auction' && (Number(item.publish_status) === 2 || Number(item.remaining_qty || 0) <= 0)"
                  type="info"
                  effect="plain"
                >
                  已售罄
                </el-tag>
                <el-button
                  v-else-if="item.pricing_mode === 'auction' && isAuctionOpen(item) && canBuyAsset"
                  type="warning"
                  link
                  @click="openBidDialog(item)"
                >
                  参与竞拍
                </el-button>
                <el-button
                  v-else-if="canBuyAsset"
                  type="success"
                  link
                  @click="openBuyDialog(item)"
                >
                  立即购买
                </el-button>
                <el-button type="primary" link @click="goDetail(item.id)">查看详情</el-button>
              </div>
            </div>
          </el-card>
        </div>

        <el-empty v-else-if="!loading && !listError" description="暂无符合条件的资产" />

        <div class="pager">
          <el-pagination
            background
            layout="total, prev, pager, next, sizes"
            :total="pagination.total"
            :current-page="pagination.page"
            :page-size="pagination.page_size"
            :page-sizes="[10, 20, 50]"
            @current-change="onPageChange"
            @size-change="onSizeChange"
          />
        </div>
      </section>
    </div>
  </div>

  <el-dialog v-model="buyVisible" title="购买资产" width="420px">
    <el-form :model="buyForm" label-width="90px">
      <el-form-item label="可选权限">
        <div class="dialog-permission-tags">
          <el-tag
            v-if="selectedAsset?.can_sell_ownership === 1"
            size="small"
            type="danger"
            effect="plain"
          >
            所有权
          </el-tag>
          <el-tag
            v-if="selectedAsset?.can_sell_view_right === 1"
            size="small"
            type="success"
            effect="plain"
          >
            查阅权
          </el-tag>
          <el-tag
            v-if="selectedAsset?.can_sell_process_right === 1"
            size="small"
            type="warning"
            effect="plain"
          >
            加工使用权
          </el-tag>
        </div>
      </el-form-item>
      <el-form-item label="资产ID">
        <el-input :model-value="buyForm.asset_id || '-'" disabled />
      </el-form-item>
      <el-form-item label="交易类型">
        <el-select v-model="buyForm.trade_mode" style="width: 100%">
          <el-option
            label="购买所有权"
            value="ownership"
            :disabled="selectedAsset?.can_sell_ownership !== 1"
          />
          <el-option
            label="购买查阅权"
            value="view"
            :disabled="selectedAsset?.can_sell_view_right !== 1"
          />
          <el-option
            label="购买加工权"
            value="process"
            :disabled="selectedAsset?.can_sell_process_right !== 1"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="showExpirationInput" label="过期时间">
        <el-date-picker
          v-model="buyForm.expiration_time"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm"
          format="YYYY-MM-DD HH:mm"
          :disabled-date="disablePastDate"
          placeholder="请选择权限过期时间"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="购买数量">
        <el-input-number v-model="buyForm.buy_qty" :min="1" :max="1" style="width: 100%" disabled />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="buyVisible = false">取消</el-button>
      <el-button type="primary" :loading="buyLoading" @click="submitBuy">确认购买</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="bidVisible" title="参与竞拍" width="420px">
    <el-form label-width="90px">
      <el-form-item label="资产">
        <el-input :model-value="selectedAuctionAsset?.asset_name || '-'" disabled />
      </el-form-item>
      <el-form-item label="当前价格">
        <el-input :model-value="String(displayPrice(selectedAuctionAsset))" disabled />
      </el-form-item>
      <el-form-item label="截止时间">
        <el-input :model-value="formatDateTime(selectedAuctionAsset?.auction_end_time)" disabled />
      </el-form-item>
      <el-form-item label="我的出价">
        <el-input-number v-model="bidPrice" :min="minimumBid" :precision="0" :step="1" style="width: 100%" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="bidVisible = false">取消</el-button>
      <el-button type="primary" :loading="bidLoading" @click="submitBid">确认出价</el-button>
    </template>
  </el-dialog>

  <AlipayPaymentDialog v-model="paymentVisible" :order-no="paymentOrderNo" @paid="onPaymentPaid" />
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import {
  createOrderByAsset,
  getAssetList,
  getAssetMeta,
  placeAuctionBid,
} from '@/api/asset'
import AlipayPaymentDialog from '@/components/AlipayPaymentDialog.vue'
import { startOrderPayment } from '@/utils/orderPayment'
import { getFirstAvailableTradeMode } from '@/utils/assetPermission'
import { formatPrice } from '@/utils/price'
import { formatDateTime } from '@/utils/dateTime'
import { getRoleKey, parseTokenPayload } from '@/utils/auth'
import defaultCover from '@/assets/logo.svg'

interface AssetItem {
  id: number
  asset_name: string
  picture?: string | null
  picture_mime_type?: string
  category_name?: string
  sub_category_name?: string
  region_name?: string
  classification_category_name?: string
  classification_data_level?: string
  brief?: string
  created_at?: string
  view_count?: number
  trade_count?: number
  price?: number
  price_unit?: string
  can_sell_ownership?: number
  can_sell_view_right?: number
  can_sell_process_right?: number
  publish_status?: number
  remaining_qty?: number
  publish_qty?: number
  pricing_mode?: 'fixed' | 'auction'
  auction_start_price?: number
  auction_current_price?: number
  auction_end_time?: string
  auction_bid_count?: number
  auction_status?: string
}

interface QueryParams {
  page: number
  page_size: number
  keyword: string
  category_id?: number
  region_id?: number
  classification_data_level?: string
}

interface CategoryOption {
  id: number
  category_name: string
  category_key: string
  sub_categories?: SubCategoryOption[]
}

interface SubCategoryOption {
  id: number
  category_id: number
  sub_category_name: string
  sub_category_key: string
}

interface RegionOption {
  id: number
  region_name: string
  region_key: string
}

const presetAssetCategories: CategoryOption[] = [
  { id: -1, category_key: 'crypto_stablecoin', category_name: '加密货币与稳定币' },
  { id: -2, category_key: 'cbdc', category_name: '央行数字货币' },
  { id: -3, category_key: 'digital_content_ip', category_name: '数字内容和知识产权' },
  { id: -4, category_key: 'account_identity_asset', category_name: '账户与身份型虚拟资产' },
  { id: -5, category_key: 'data_asset', category_name: '数据资产' },
  { id: -6, category_key: 'digital_certificate', category_name: '数字化凭证' },
  { id: -7, category_key: 'digital_security_asset', category_name: '数字证券资产' },
]

const mergePresetCategories = (items: CategoryOption[] = []) => {
  const merged = [...items]
  const existed = new Set(items.map((item) => String(item.category_name || '').trim()))
  presetAssetCategories.forEach((item) => {
    if (!existed.has(item.category_name)) merged.push(item)
  })
  return merged
}

const router = useRouter()
const loading = ref(false)
const listError = ref('')
let listRequestId = 0
const list = ref<AssetItem[]>([])
const selectedAsset = ref<AssetItem | null>(null)
const buyVisible = ref(false)
const buyLoading = ref(false)
const paymentVisible = ref(false)
const paymentOrderNo = ref('')
const bidVisible = ref(false)
const bidLoading = ref(false)
const bidPrice = ref(1)
const selectedAuctionAsset = ref<AssetItem | null>(null)
const buyForm = reactive({
  asset_id: 0,
  buy_qty: 1,
  trade_mode: 'ownership',
  expiration_time: '',
})
const roleKey = getRoleKey(parseTokenPayload()?.identity || '')
const canBuyAsset = roleKey === 'buyer' || roleKey === 'admin'
const categories = ref<CategoryOption[]>([])
const regions = ref<RegionOption[]>([])
const classificationDataLevels = ref<string[]>([])
const resolveCover = (item: AssetItem) => {
  if (item.picture) {
    return `data:${item.picture_mime_type || 'image/jpeg'};base64,${item.picture}`
  }
  return defaultCover
}

const regionOptions = computed(() => [
  { id: undefined, name: '全部' },
  ...regions.value.map((item) => ({ id: item.id, name: item.region_name })),
])

const categoryOptions = computed(() => [
  { id: undefined, name: '全部' },
  ...categories.value.map((item) => ({ id: item.id, name: item.category_name })),
])

const defaultClassificationDataLevels = [
  '核心数据',
  '重要数据',
  '一般数据',
  '高风险数据',
  '中风险数据',
  '低风险数据',
  '敏感数据',
  '非敏感数据',
]

const assetGradeOptions = computed(() => [
  { value: undefined, name: '全部' },
  ...(classificationDataLevels.value.length ? classificationDataLevels.value : defaultClassificationDataLevels).map((item) => ({
    value: item,
    name: item,
  })),
])

const showExpirationInput = computed(() => buyForm.trade_mode !== 'ownership')
const minimumBid = computed(() => Math.floor(Number(displayPrice(selectedAuctionAsset.value) || 0)) + 1)

const displayPrice = (item?: AssetItem | null) => {
  if (!item) return 0
  if (item.pricing_mode === 'auction') {
    return Number(item.auction_current_price ?? item.auction_start_price ?? item.price ?? 0)
  }
  return Number(item.price || 0)
}

const isAuctionOpen = (item: AssetItem) => {
  return item.pricing_mode === 'auction' &&
    item.auction_status === 'OPEN' &&
    !!item.auction_end_time &&
    new Date(item.auction_end_time).getTime() > Date.now()
}

const auctionStatusText = (item: AssetItem) => {
  if (isAuctionOpen(item)) return `截止：${formatDateTime(item.auction_end_time)}`
  if (item.auction_status === 'CLOSED') return '竞拍已成交'
  if (item.auction_status === 'UNSOLD') return '竞拍已流拍'
  return '竞拍已结束'
}

const disablePastDate = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

const validateExpirationTime = () => {
  if (!showExpirationInput.value) {
    buyForm.expiration_time = ''
    return true
  }
  if (!buyForm.expiration_time) {
    ElMessage.error('请选择权限过期时间')
    return false
  }
  const expirationTimestamp = new Date(buyForm.expiration_time).getTime()
  if (!Number.isFinite(expirationTimestamp) || expirationTimestamp <= Date.now()) {
    ElMessage.error('权限过期时间必须晚于当前时间')
    return false
  }
  return true
}

const query = reactive<QueryParams>({
  page: 1,
  page_size: 10,
  keyword: '',
  category_id: undefined,
  region_id: undefined,
  classification_data_level: undefined,
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0,
})

const selectRegion = (id?: number) => {
  query.region_id = id
  query.page = 1
  fetchList()
}

const selectCategory = (id?: number) => {
  query.category_id = id
  query.page = 1
  fetchList()
}

const selectAssetGrade = (value?: string) => {
  query.classification_data_level = value
  query.page = 1
  fetchList()
}

const fetchMeta = async () => {
  const res = await getAssetMeta()
  const data = res.data?.data || {}
  categories.value = mergePresetCategories(data.categories || [])
  regions.value = data.regions || []
  classificationDataLevels.value = Array.isArray(data.classification_data_levels)
    ? data.classification_data_levels.filter(Boolean)
    : []
}

const fetchList = async (retries = 0) => {
  const requestId = ++listRequestId
  const params = { ...query }
  loading.value = true
  listError.value = ''
  list.value = []
  pagination.total = 0
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await getAssetList(params)
      if (requestId !== listRequestId) return
      if (res.data.status !== 0) throw new Error(res.data.message || '查询失败')
      list.value = res.data.data?.list || []
      const p = res.data.data?.pagination || {}
      pagination.page = p.page || 1
      pagination.page_size = p.page_size || params.page_size
      pagination.total = p.total || 0
      loading.value = false
      return
    } catch (error: any) {
      if (requestId !== listRequestId) return
      if (attempt < retries) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500 * (attempt + 1)))
        continue
      }
      listError.value = error?.response?.data?.message || '资产加载失败，请检查后端服务'
      loading.value = false
    }
  }
}

const onSearch = () => {
  query.page = 1
  fetchList()
}

const onReset = () => {
  query.page = 1
  query.page_size = 10
  query.keyword = ''
  query.category_id = undefined
  query.region_id = undefined
  query.classification_data_level = undefined
  fetchList()
}

const onPageChange = (page: number) => {
  query.page = page
  fetchList()
}

const onSizeChange = (size: number) => {
  query.page_size = size
  query.page = 1
  fetchList()
}

const goDetail = (id: number) => {
  router.push({ path: `/assetDetail/${id}`, query: { from: '/assetMarket' } })
}

const openBuyDialog = (item: AssetItem) => {
  if (!canBuyAsset) {
    ElMessage.warning('卖家账号不可购买资产')
    return
  }

  if (Number(item.publish_status) === 2 || Number(item.remaining_qty || 0) <= 0) {
    ElMessage.warning('该资产当前已售罄')
    return
  }

  const defaultTradeMode = getFirstAvailableTradeMode(item)
  if (!defaultTradeMode) {
    ElMessage.warning('该资产当前没有可购买的交易权益')
    return
  }

  selectedAsset.value = item
  buyForm.asset_id = Number(item.id || 0)
  buyForm.buy_qty = 1
  buyForm.trade_mode = defaultTradeMode
  buyForm.expiration_time = ''
  buyVisible.value = true
}

const openBidDialog = (item: AssetItem) => {
  if (!canBuyAsset) {
    ElMessage.warning('卖家账号不可参与拍卖')
    return
  }
  if (!isAuctionOpen(item)) {
    ElMessage.warning('该拍卖已结束，请刷新页面查看结果')
    return
  }
  selectedAuctionAsset.value = item
  bidPrice.value = Math.floor(displayPrice(item)) + 1
  bidVisible.value = true
}

const submitBid = async () => {
  const item = selectedAuctionAsset.value
  if (!item?.id) return
  if (!Number.isInteger(Number(bidPrice.value)) || Number(bidPrice.value) < minimumBid.value) {
    ElMessage.error(`出价必须是不低于 ${minimumBid.value} 的正整数`)
    return
  }
  bidLoading.value = true
  try {
    const res = await placeAuctionBid(item.id, Number(bidPrice.value))
    if (res.data?.status !== 0) throw new Error(res.data?.message || '出价失败')
    ElMessage.success('出价成功')
    bidVisible.value = false
    await fetchList()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '出价失败')
  } finally {
    bidLoading.value = false
  }
}

const submitBuy = async () => {
  if (!canBuyAsset) {
    ElMessage.warning('卖家账号不可购买资产')
    return
  }

  if (!buyForm.asset_id) {
    ElMessage.error('缺少资产ID')
    return
  }

  if (
    buyForm.trade_mode === 'ownership' &&
    selectedAsset.value?.can_sell_ownership !== 1
  ) {
    ElMessage.error('该资产不支持购买所有权')
    return
  }

  if (buyForm.trade_mode === 'view' && selectedAsset.value?.can_sell_view_right !== 1) {
    ElMessage.error('该资产不支持购买查阅权')
    return
  }

  if (
    buyForm.trade_mode === 'process' &&
    selectedAsset.value?.can_sell_process_right !== 1
  ) {
    ElMessage.error('该资产不支持购买加工权')
    return
  }

  if (!validateExpirationTime()) return

  buyLoading.value = true
  let createdOrderNo = ''
  try {
    const orderRes = await createOrderByAsset({
      asset_id: buyForm.asset_id,
      buy_qty: 1,
      trade_mode: buyForm.trade_mode,
      expiration_time: showExpirationInput.value ? buyForm.expiration_time : null,
      processing_type:
        buyForm.trade_mode === 'view'
          ? '查阅权'
          : buyForm.trade_mode === 'process'
            ? '加工权'
            : '所有权',
    })

    if (orderRes.data.status !== 0) {
      ElMessage.error(orderRes.data.message || '下单失败')
      return
    }

    const orderNo = orderRes.data.data?.order_no || ''
    createdOrderNo = orderNo
    buyVisible.value = false
    const paymentMode = await startOrderPayment(orderNo)
    if (paymentMode === 'skipped') {
      ElMessage.success('订单已确认，等待卖家交付')
      router.push('/assetManagement')
      return
    }
    paymentOrderNo.value = orderNo
    paymentVisible.value = true
  } catch (error: any) {
    const msg = error?.response?.data?.message || error?.message || '购买失败'
    ElMessage.error(createdOrderNo ? `订单 ${createdOrderNo} 已创建，请到订单页继续购买：${msg}` : msg)
  } finally {
    buyLoading.value = false
  }
}

const onPaymentPaid = () => {
  ElMessage.success('支付成功，等待卖家交付')
  router.push('/assetManagement')
}

onMounted(async () => {
  Object.assign(query, {
    page: 1,
    page_size: 10,
    keyword: '',
    category_id: undefined,
    region_id: undefined,
    classification_data_level: undefined,
  })
  fetchList(2)
  try {
    await fetchMeta()
  } catch (_error) {
    ElMessage.error('加载筛选元数据失败')
  }
})
</script>

<style lang="scss" scoped>
.common-wrapped {
  width: 100%;
  display: flex;
  justify-content: center;
  background: #f5f7fb;

  .market-page {
    padding: 16px 20px;
    background: #f5f7fb;
    width: 85%;
    min-height: 100vh;
    box-sizing: border-box;
  }
}

.auction-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 6px 0;
  color: #8b5d14;
  font-size: 12px;
  line-height: 1.4;
  text-align: right;
}

/* ── 搜索区 ── */
.search-section {
  background: #fff;
  border-radius: 10px;
  padding: 14px 18px;
  box-shadow: 0 2px 12px rgba(12, 46, 117, 0.06);

  .search-row {
    display: flex;
    align-items: center;
    width: auto;
    gap: 10px;
    width: fit-content; /* ✅ 宽度收缩为内容实际宽度 */
    margin: 0 auto; /* ✅ 水平居中 */

    .search-title {
      flex-shrink: 0;
      font-size: 16px;
      font-weight: 600;
      color: #193a8d;
      white-space: nowrap;
      margin-right: 30px;
    }

    .search-input {
      width: 320px;
      flex-shrink: 0;
    }

    .search-btn {
      width: 80px;
      flex-shrink: 0;
    }

  }
}

/* ── 筛选区 ── */
.filter-section {
  margin-top: 10px;
  background: #fff;
  border-radius: 10px;
  padding: 10px 18px;
  box-shadow: 0 2px 12px rgba(12, 46, 117, 0.06);

  .filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;

    & + .filter-row {
      border-top: 1px solid #f0f2f8;
    }
  }

  .filter-label {
    flex-shrink: 0;
    width: 104px;
    font-size: 13px;
    color: #3a4b7a;
    font-weight: 600;
    white-space: nowrap;
  }

  .filter-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }

  .option-chip {
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 13px;
    color: #4a5a88;
    cursor: pointer;
    transition: all 0.15s;
    /* 未选中：无边框，背景透明 */
    border: 1px solid transparent;
    background: transparent;

    &:hover {
      color: #3f6cf6;
      background: #f0f4ff;
    }

    /* 选中：显示边框 + 浅蓝背景 */
    &.active {
      border-color: #3f6cf6;
      background: #eef3ff;
      color: #2a55da;
      font-weight: 600;
    }
  }
}

/* ── 结果区 ── */
.result-section {
  margin-top: 10px;
  background: #fff;
  border-radius: 10px;
  padding: 16px 18px;
  box-shadow: 0 2px 12px rgba(12, 46, 117, 0.06);
  /* 禁止水平滚动条 */
  overflow-x: hidden;
}

.result-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.result-count {
  color: #3559b6;
  font-weight: 700;
  font-size: 13px;
}

.asset-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.asset-card {
  border-radius: 10px;
  /* 卡片本身也不产生横向溢出 */
  overflow: hidden;

  :deep(.el-card__body) {
    overflow: hidden;
  }
}

.asset-content {
  display: grid;
  grid-template-columns: minmax(0, 200px) minmax(0, 1fr) minmax(0, 150px);
  gap: 14px;
  align-items: center;
  /* 内容区不超出卡片宽度 */
  width: 100%;
  min-width: 0;
}

.asset-cover {
  width: 200px;
  height: 120px;
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
  transition:
    transform 0.22s ease,
    filter 0.22s ease;
  will-change: transform;

  &:hover {
    transform: scale(1.04);
    filter: brightness(1.02);
  }
}

.asset-main {
  min-width: 0;
  overflow: hidden;
}

.asset-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.asset-title {
  margin: 0;
  color: #243d85;
  font-size: 17px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition:
    color 0.18s ease,
    transform 0.18s ease;

  &:hover {
    color: #3f6cf6;
    transform: translateX(2px);
  }
}

.asset-tags {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.asset-brief {
  margin: 7px 0;
  color: #5f6f99;
  font-size: 13px;
  line-height: 1.6;
  overflow: hidden;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.permission-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.permission-label {
  color: #51617f;
  font-size: 12px;
  white-space: nowrap;
}

.permission-tags,
.dialog-permission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.permission-empty {
  color: #909399;
  font-size: 12px;
}

.asset-meta {
  display: flex;
  gap: 14px;
  color: #8a95b8;
  font-size: 12px;
  flex-wrap: wrap;
}

.asset-side {
  text-align: right;
  min-width: 0;
}

.price {
  color: #1e3f96;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 8px;

  span {
    margin-left: 3px;
    font-size: 14px;
    font-weight: 500;
  }
}

.pager {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .asset-content {
    grid-template-columns: 1fr;
  }

  .asset-cover {
    width: 200px;
    height: 120px;
  }

  .asset-side {
    text-align: left;
  }

  .search-input {
    width: 100%;
    flex: 1;
  }
}
</style>
