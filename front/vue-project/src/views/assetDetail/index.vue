<template>
  <div class="common-wrapped">
    <div class="detail-page">
      <div class="page-inner">
        <div class="crumb-row">
          <el-breadcrumb separator=">">
            <el-breadcrumb-item>
              <button type="button" class="breadcrumb-link" @click="goUpper">资产市场</button>
            </el-breadcrumb-item>
            <el-breadcrumb-item>资产详情</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <el-card shadow="never" class="hero-card" v-loading="loading">
          <div class="hero-main">
            <div class="cover-wrap">
              <img class="asset-cover" :src="coverImage" :alt="detail.asset_name || '资产预览图'" @error="onCoverError" />
            </div>
            <div class="main-left">
              <div class="title-row">
                <h2 class="page-title">{{ detail.asset_name || '未命名资产' }}</h2>
              </div>
              <div class="asset-categories">
                <span v-if="detail.delegation_id">代理</span>
                <span>{{ detail.category_name || '未分类' }}</span>
                <span>{{ detail.sub_category_name || '未分类' }}</span>
                <span>{{ detail.classification_data_level || '一般数据' }}</span>
              </div>
              <p class="desc">{{ detail.description || '暂无详细描述' }}</p>
              <div class="meta-row">
                <div><span class="meta-label">登记主体</span><span>{{ detail.owner_account || detail.user_id || '-' }}</span></div>
                <div><span class="meta-label">卖家</span><span>{{ detail.seller_account || detail.owner_account || '-' }}</span></div>
                <div v-if="detail.proxy_agent_account || detail.proxy_agent_address"><span class="meta-label">代理人</span><span>{{ detail.proxy_agent_account || detail.proxy_agent_address }}</span></div>
                <div><span class="meta-label">登记时间</span><span>{{ formatDateTime(detail.created_at) }}</span></div>
                <div><span class="meta-label">登记地区</span><span>{{ detail.region_name || '-' }}</span></div>
              </div>
            </div>

            <div class="main-right">
              <div class="price-label">{{ detail.pricing_mode === 'auction' ? '当前价格' : '资产价格' }}</div>
              <div class="price">
                {{ formatPrice(displayPrice) }}<span>{{ detail.price_unit || '人民币' }}</span>
              </div>
              <div class="purchase-details">
                <div v-if="detail.pricing_mode === 'auction'" class="side-item"><span>拍卖状态</span><strong>{{ auctionStatusText }}</strong></div>
                <div class="side-item"><span>可售数量</span><strong>{{ detail.available_qty || 0 }} / {{ detail.total_qty || 0 }}</strong></div>
                <div class="side-item"><span>浏览量</span><strong>{{ detail.view_count || 0 }}</strong></div>
              </div>
              <el-button v-if="canBidAuction" class="purchase-button" @click="openBidDialog">参与竞拍</el-button>
              <el-button v-else-if="canBuyAsset && detail.pricing_mode !== 'auction'" class="purchase-button" @click="openBuyDialog">立即购买</el-button>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="asset-info-card">
          <div class="info-grid">
            <div class="info-block">
              <h3>基本信息</h3>
              <ul>
                <li>
                  <label>数据产品类型/方向：</label
                  ><span
                    >{{ detail.category_name || '-' }} /
                    {{ detail.sub_category_name || '-' }}</span
                  >
                </li>
                <li>
                  <label>数据分类：</label
                  ><span>{{ detail.classification_category_name || '-' }}</span>
                </li>
                <li>
                  <label>数据分级：</label
                  ><span>{{ detail.classification_data_level || '-' }}</span>
                </li>
                <li>
                  <label>状态：</label><span>{{ statusText(detail.status) }}</span>
                </li>
              </ul>
            </div>

            <div class="info-block">
              <h3>交易权限</h3>
              <ul>
                <li>
                  <label>资产类型：</label>
                  <span>自动驾驶资产统一不可分割</span>
                </li>
                <li>
                  <label>可售所有权：</label>
                  <span>{{ detail.can_sell_ownership === 1 ? '是' : '否' }}</span>
                </li>
                <li>
                  <label>可售查阅权：</label>
                  <span>{{ detail.can_sell_view_right === 1 ? '是' : '否' }}</span>
                </li>
                <li>
                  <label>可售加工权：</label>
                  <span>{{ detail.can_sell_process_right === 1 ? '是' : '否' }}</span>
                </li>
              </ul>
            </div>
          </div>
        </el-card>

        <el-dialog v-model="buyVisible" title="购买资产" width="420px">
          <el-form :model="buyForm" label-width="90px">
            <el-form-item label="可选权限">
              <div class="buy-permission-tags">
                <el-tag
                  v-if="detail.can_sell_ownership === 1"
                  size="small"
                  type="danger"
                  effect="plain"
                >
                  所有权
                </el-tag>
                <el-tag
                  v-if="detail.can_sell_view_right === 1"
                  size="small"
                  type="success"
                  effect="plain"
                >
                  查阅权
                </el-tag>
                <el-tag
                  v-if="detail.can_sell_process_right === 1"
                  size="small"
                  type="warning"
                  effect="plain"
                >
                  加工使用权
                </el-tag>
              </div>
            </el-form-item>
            <el-form-item label="资产ID">
              <el-input :model-value="detail.id || '-'" disabled />
            </el-form-item>
            <el-form-item label="交易类型">
              <el-select v-model="buyForm.trade_mode" style="width: 100%">
                <el-option
                  label="购买所有权"
                  value="ownership"
                  :disabled="detail.can_sell_ownership !== 1"
                />
                <el-option
                  label="购买查阅权"
                  value="view"
                  :disabled="detail.can_sell_view_right !== 1"
                />
                <el-option
                  label="购买加工权"
                  value="process"
                  :disabled="detail.can_sell_process_right !== 1"
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
          </el-form>
          <template #footer>
            <el-button @click="buyVisible = false">取消</el-button>
            <el-button type="primary" :loading="buyLoading" @click="submitBuy">下单</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="bidVisible" title="参与竞拍" width="420px">
          <el-form label-width="90px">
            <el-form-item label="当前单价">
              <el-input :model-value="String(displayPrice)" disabled />
            </el-form-item>
            <el-form-item label="竞拍份数">
              <el-input :model-value="String(detail.remaining_qty || 0)" disabled />
            </el-form-item>
            <el-form-item label="截止时间">
              <el-input :model-value="formatDateTime(detail.auction_end_time)" disabled />
            </el-form-item>
            <el-form-item label="我的单价">
              <el-input-number v-model="bidPrice" :min="minimumBid" :precision="0" :step="1" style="width: 100%" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="bidVisible = false">取消</el-button>
            <el-button type="primary" :loading="bidLoading" @click="submitBid">确认出价</el-button>
          </template>
        </el-dialog>
      </div>
    </div>
    <AlipayPaymentDialog v-model="paymentVisible" :order-no="paymentOrderNo" @paid="onPaymentPaid" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createOrder, getAssetDetail, placeAuctionBid } from '@/api/asset'
import AlipayPaymentDialog from '@/components/AlipayPaymentDialog.vue'
import { startOrderPayment } from '@/utils/orderPayment'
import { getFirstAvailableTradeMode } from '@/utils/assetPermission'
import { formatPrice } from '@/utils/price'
import { formatDateTime } from '@/utils/dateTime'
import { getRoleKey, parseTokenPayload } from '@/utils/auth'
import defaultCover from '@/assets/logo.svg'

interface AssetDetail {
  id?: number
  publish_id?: number
  remaining_qty?: number
  asset_name?: string
  description?: string
  picture?: string | null
  picture_mime_type?: string
  updated_at?: string
  created_at?: string
  user_id?: number
  category_id?: number
  category_name?: string
  sub_category_name?: string
  region_name?: string
  classification_category_name?: string
  classification_data_level?: string
  status?: number
  file_hash?: string
  owner_account?: string
  seller_account?: string
  proxy_agent_account?: string
  proxy_agent_address?: string
  price?: number
  price_unit?: string
  total_qty?: number
  available_qty?: number
  is_divisible?: number
  can_sell_ownership?: number
  can_sell_view_right?: number
  can_sell_process_right?: number
  view_count?: number
  pricing_mode?: 'fixed' | 'auction'
  publish_status?: number
  publish_price?: number
  auction_start_price?: number
  auction_current_price?: number
  auction_end_time?: string
  auction_bid_count?: number
  auction_status?: string
  delegation_id?: number | null
}

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const detail = ref<AssetDetail>({})
const buyVisible = ref(false)
const buyLoading = ref(false)
const paymentVisible = ref(false)
const paymentOrderNo = ref('')
const bidVisible = ref(false)
const bidLoading = ref(false)
const bidPrice = ref(1)
const buyForm = ref({
  trade_mode: 'ownership',
  buy_qty: 1,
  expiration_time: '',
})
const coverImage = ref(defaultCover)
const onCoverError = () => { coverImage.value = defaultCover }
const roleKey = getRoleKey(parseTokenPayload()?.identity || '')
const canBuyAsset = roleKey === 'buyer' || roleKey === 'admin'
const showExpirationInput = computed(() => buyForm.value.trade_mode !== 'ownership')
const displayPrice = computed(() => detail.value.pricing_mode === 'auction'
  ? Number(detail.value.auction_current_price ?? detail.value.auction_start_price ?? detail.value.price ?? 0)
  : Number(detail.value.price || 0))
const minimumBid = computed(() => Math.floor(displayPrice.value) + 1)
const canBidAuction = computed(() => canBuyAsset &&
  detail.value.pricing_mode === 'auction' &&
  detail.value.auction_status === 'OPEN' &&
  !!detail.value.auction_end_time &&
  new Date(detail.value.auction_end_time).getTime() > Date.now())
const auctionStatusText = computed(() => {
  if (canBidAuction.value) return `竞拍中，截止 ${formatDateTime(detail.value.auction_end_time)}`
  if (detail.value.auction_status === 'CLOSED') return '竞拍已成交'
  if (detail.value.auction_status === 'UNSOLD') return '竞拍已流拍'
  return '竞拍已结束'
})

const disablePastDate = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

const validateExpirationTime = () => {
  if (!showExpirationInput.value) {
    buyForm.value.expiration_time = ''
    return true
  }
  if (!buyForm.value.expiration_time) {
    ElMessage.error('请选择权限过期时间')
    return false
  }
  const expirationTimestamp = new Date(buyForm.value.expiration_time).getTime()
  if (!Number.isFinite(expirationTimestamp) || expirationTimestamp <= Date.now()) {
    ElMessage.error('权限过期时间必须晚于当前时间')
    return false
  }
  return true
}

const statusText = (status?: number) => {
  if (status === 0) return '下架'
  if (status === 1) return '上架中'
  if (status === 2) return '已售罄'
  return '未知'
}

const fetchDetail = async () => {
  const id = route.params.id
  if (!id) {
    ElMessage.error('缺少资产ID')
    return
  }
  loading.value = true
  try {
    const res = await getAssetDetail(String(id), route.query.publish_id)
    if (res.data.status === 0) {
      detail.value = res.data.data || {}
      if (detail.value.file_hash && /^[A-Za-z0-9._~-]{1,255}$/.test(detail.value.file_hash)) {
        coverImage.value = `/api/asset-picture/${encodeURIComponent(detail.value.file_hash)}`
      } else if (detail.value.picture) {
        coverImage.value = `data:${detail.value.picture_mime_type || 'image/jpeg'};base64,${detail.value.picture}`
      } else {
        coverImage.value = defaultCover
      }
    } else {
      ElMessage.error(res.data.message || '获取资产详情失败')
    }
  } catch (error) {
    ElMessage.error('获取资产详情失败')
  } finally {
    loading.value = false
  }
}

const goUpper = () => {
  const from = route.query.from
  if (typeof from === 'string' && from) {
    router.push(from)
    return
  }
  router.push('/assetMarket')
}

const openBuyDialog = () => {
  if (!canBuyAsset) {
    ElMessage.warning('卖家账号不可购买资产')
    return
  }

  const defaultTradeMode = getFirstAvailableTradeMode(detail.value)
  if (!defaultTradeMode) {
    ElMessage.warning('该资产当前没有可购买的交易权益')
    return
  }
  buyForm.value.trade_mode = defaultTradeMode
  buyForm.value.buy_qty = 1
  buyForm.value.expiration_time = ''
  buyVisible.value = true
}

const openBidDialog = () => {
  if (!canBidAuction.value) {
    ElMessage.warning('当前拍卖不可参与')
    return
  }
  bidPrice.value = minimumBid.value
  bidVisible.value = true
}

const submitBid = async () => {
  if (!detail.value.id) return
  if (!Number.isInteger(Number(bidPrice.value)) || Number(bidPrice.value) < minimumBid.value) {
    ElMessage.error(`出价必须是不低于 ${minimumBid.value} 的正整数`)
    return
  }
  bidLoading.value = true
  try {
    const res = await placeAuctionBid(detail.value.id, Number(bidPrice.value))
    if (res.data?.status !== 0) throw new Error(res.data?.message || '出价失败')
    ElMessage.success('出价成功')
    bidVisible.value = false
    await fetchDetail()
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

  if (!detail.value.id) {
    ElMessage.error('缺少资产ID')
    return
  }

  // 前端验证
  if (Number(detail.value.remaining_qty || 0) < 1) {
    ElMessage.error('资产已售罄')
    return
  }

  if (
    buyForm.value.trade_mode === 'ownership' &&
    detail.value.can_sell_ownership !== 1
  ) {
    ElMessage.error('该资产不支持购买所有权，请选择其他交易类型')
    return
  }

  if (buyForm.value.trade_mode === 'view' && detail.value.can_sell_view_right !== 1) {
    ElMessage.error('该资产不支持购买查阅权，请选择其他交易类型')
    return
  }

  if (
    buyForm.value.trade_mode === 'process' &&
    detail.value.can_sell_process_right !== 1
  ) {
    ElMessage.error('该资产不支持购买加工权，请选择其他交易类型')
    return
  }

  if (!validateExpirationTime()) return

  buyLoading.value = true
  let createdOrderNo = ''
  try {
    const orderRes = await createOrder({
      publish_id: detail.value.publish_id,
      buy_qty: 1,
      trade_mode: buyForm.value.trade_mode,
      expiration_time: showExpirationInput.value ? buyForm.value.expiration_time : null,
      processing_type:
        buyForm.value.trade_mode === 'view'
          ? '查阅权'
          : buyForm.value.trade_mode === 'process'
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
    const reason = error?.response?.data?.message || error?.message || '操作失败'
    ElMessage.error(createdOrderNo ? `订单 ${createdOrderNo} 已创建，请到订单页继续购买：${reason}` : reason)
  } finally {
    buyLoading.value = false
  }
}

const onPaymentPaid = () => {
  ElMessage.success('支付成功，等待卖家交付')
  router.push('/assetManagement')
}

onMounted(fetchDetail)
</script>

<style scoped lang="scss">
.common-wrapped {
  width: 100%;
  flex: 1; /* 直接占满剩余高度 */
  display: flex;
  justify-content: center;
  background: #f5f7fb;

  .detail-page {
    background: #f5f7fb;
    padding: 16px 20px;
    width: 85%;
    min-height: 100vh;
    box-sizing: border-box;
  }
}

.page-inner {
  width: 100%;
}

.crumb-row {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  min-height: 28px;
  padding: 0 2px;
}

.crumb-row :deep(.el-breadcrumb__inner),
.crumb-row :deep(.el-breadcrumb__separator) { color: #57606a; }
.crumb-row :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) { color: #24292f; }

.breadcrumb-link {
  padding: 0;
  border: 0;
  background: none;
  color: #57606a;
  font: inherit;
  cursor: pointer;
}
.breadcrumb-link:hover { color: #24292f; text-decoration: underline; text-underline-offset: 3px; }
.breadcrumb-link:focus-visible { outline: 2px solid #57606a; outline-offset: 3px; }

.hero-card,
.asset-info-card {
  border-radius: 10px;
  border: 1px solid #e4e8f0;
  background: #fff;
  box-shadow: 0 2px 8px rgba(18, 41, 79, 0.06);
}

.hero-card :deep(.el-card__body) { padding: 28px; }
.asset-info-card :deep(.el-card__body) { padding: 26px 30px; }

.buy-permission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-main {
  display: grid;
  grid-template-columns: minmax(220px, 28%) minmax(0, 1fr) 250px;
  gap: 28px;
  align-items: start;
}

.cover-wrap {
  width: 100%;
  min-width: 0;
}

.asset-cover {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e4e8f0;
  background: #f6f8fa;
}

.main-left { min-width: 0; }

.title-row {
  display: flex;
  align-items: center;

  h2 {
    margin: 0;
    color: #1f2328;
    font-size: clamp(23px, 2vw, 29px);
    font-weight: 650;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
}

.asset-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-top: 9px;
  color: #6e7781;
  font-size: 13px;
}
.asset-categories span + span::before {
  content: '/';
  margin: 0 7px;
  color: #afb6bf;
}

.desc {
  margin: 22px 0;
  color: #3d444d;
  font-size: 15px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.meta-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 18px;
  row-gap: 12px;
  padding-top: 18px;
  border-top: 1px solid #d8dee4;
  color: #3d444d;
  font-size: 14px;
}
.meta-row > div { min-width: 0; display: flex; gap: 10px; }
.meta-row > div > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.meta-label { flex: 0 0 62px; color: #6e7781; }

.main-right {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  border-left: 1px solid #d8dee4;
  padding-left: 26px;
}

.price-label { color: #6e7781; font-size: 14px; }

.price {
  color: #3d444d;
  font-size: 34px;
  font-weight: 650;
  line-height: 1.25;
  margin: 7px 0 20px;
  white-space: nowrap;

  span {
    margin-left: 6px;
    color: #6e7781;
    font-size: 14px;
    font-weight: 400;
  }
}

.purchase-details { display: grid; gap: 10px; }
.side-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #6e7781;
  font-size: 14px;
}
.side-item strong { color: #3d444d; font-weight: 500; text-align: right; }
.purchase-button {
  width: 100%;
  height: 38px;
  margin: 24px 0 0;
  border: 1px solid #1f5fa8;
  border-radius: 7px;
  background: #1f5fa8;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
.purchase-button:hover, .purchase-button:focus { border-color: #174d8a; background: #174d8a; color: #fff; }

.asset-info-card {
  margin-top: 12px;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.info-block {
  h3 {
    margin: 0 0 10px;
    color: #1f2328;
    font-size: 17px;
    font-weight: 650;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr);
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #eaeef2;
    color: #3d444d;
    line-height: 1.55;
  }
  li:last-child { border-bottom: 0; }

  label {
    color: #6e7781;
  }

  span {
    overflow-wrap: anywhere;
  }
}

@media (max-width: 1100px) {
  .hero-main {
    grid-template-columns: minmax(200px, 32%) minmax(0, 1fr);
  }

  .main-right {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 22px;
    border-left: 0;
    border-top: 1px solid #d8dee4;
    padding-left: 0;
    padding-top: 18px;
  }
  .price { grid-column: 1; }
  .purchase-details { grid-column: 2; grid-row: 1 / 3; align-content: center; }
  .purchase-button { grid-column: 1 / -1; margin-top: 8px; }
}

@media (max-width: 700px) {
  .common-wrapped .detail-page { width: 100%; padding: 14px; }
  .hero-card :deep(.el-card__body), .asset-info-card :deep(.el-card__body) { padding: 18px; }
  .hero-main { grid-template-columns: 1fr; gap: 20px; }
  .asset-cover { aspect-ratio: 16 / 9; }
  .meta-row { grid-template-columns: 1fr; }
  .main-right { grid-column: 1; display: flex; }
  .info-block li { grid-template-columns: minmax(0, 1fr); gap: 2px; }
}
</style>
