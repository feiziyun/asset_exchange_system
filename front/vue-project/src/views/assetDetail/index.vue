<template>
  <div class="common-wrapped">
    <div class="detail-page">
      <div class="page-inner">
        <div class="crumb-row">
          <el-breadcrumb separator=">">
            <el-breadcrumb-item>
              <a href="javascript:;" @click="goUpper">资产市场</a>
            </el-breadcrumb-item>
            <el-breadcrumb-item>资产详情</el-breadcrumb-item>
          </el-breadcrumb>
          <el-button size="small" @click="goUpper">返回上级</el-button>
        </div>

        <el-card shadow="never" class="hero-card" v-loading="loading">
          <div class="hero-top">
            <div>
              资产编号：<span class="asset-no">{{ detail.id || '-' }}</span>
            </div>
            <div>最近更新：{{ formatDateTime(detail.updated_at) }}</div>
          </div>

          <div class="hero-main">
            <div class="cover-wrap">
              <img class="asset-cover" :src="coverImage" alt="asset-cover" />
            </div>
            <div class="main-left">
              <div class="title-row">
                <h2>{{ detail.asset_name || '未命名资产' }}</h2>
                <el-tag type="primary" effect="plain">{{
                  detail.sub_category_name || '未分类'
                }}</el-tag>
              </div>

              <p class="desc">{{ detail.description || detail.brief || '暂无详细描述' }}</p>

              <div class="meta-row">
                <span>登记主体：{{ detail.user_id || '-' }}</span>
                <span>登记时间：{{ formatDateTime(detail.created_at) }}</span>
                <span>登记地区：{{ detail.region_name || '-' }}</span>
              </div>

              <div class="action-row">
                <el-button type="primary" @click="fetchDetail">刷新详情</el-button>
                <el-button v-if="canBidAuction" type="warning" @click="openBidDialog"
                  >参与竞拍</el-button
                >
                <el-button v-else-if="canBuyAsset && detail.pricing_mode !== 'auction'" type="success" @click="openBuyDialog"
                  >立即购买</el-button
                >
                <el-button type="warning" plain>收藏</el-button>
              </div>
            </div>

            <div class="main-right">
              <div class="price">
                {{ formatPrice(displayPrice) }}<span>{{ detail.price_unit || '人民币' }}</span>
              </div>
              <div v-if="detail.pricing_mode === 'auction'" class="side-item">
                拍卖状态：{{ auctionStatusText }}
              </div>
              <div class="side-item">
                库存：{{ detail.available_qty || 0 }}/{{ detail.total_qty || 0 }}
              </div>
              <div class="side-item">
                链上状态：
                <el-tag size="small" :type="chainTag(detail.chain_status)">
                  {{ chainText(detail.chain_status) }}
                </el-tag>
              </div>
              <div class="side-item">浏览量：{{ detail.view_count || 0 }}</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="tabs-card">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="资产信息" name="asset">
              <div class="info-grid">
                <div class="info-block">
                  <h3>基本信息</h3>
                  <ul>
                    <li>
                      <label>资产名称：</label><span>{{ detail.asset_name || '-' }}</span>
                    </li>
                    <li>
                      <label>数据产品类型/方向：</label
                      ><span
                        >{{ detail.category_name || '-' }} /
                        {{ detail.sub_category_name || '-' }}</span
                      >
                    </li>
                    <li>
                      <label>地区：</label><span>{{ detail.region_name || '-' }}</span>
                    </li>
                    <li>
                      <label>数据产品类型：</label
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
                  <h3>文件与交易</h3>
                  <ul>
                    <li>
                      <label>文件哈希：</label><span>{{ detail.file_hash || '-' }}</span>
                    </li>
                    <li>
                      <label>文件格式：</label><span>{{ detail.file_format || '-' }}</span>
                    </li>
                    <li>
                      <label>文件大小：</label><span>{{ detail.file_size || 0 }} bytes</span>
                    </li>
                    <li>
                      <label>价格：</label
                      ><span>{{ formatPrice(detail.price) }} {{ detail.price_unit || '人民币' }}</span>
                    </li>
                    <li>
                      <label>交易次数：</label><span>{{ detail.trade_count || 0 }}</span>
                    </li>
                    <li v-if="detail.pricing_mode === 'auction'">
                      <label>拍卖：</label><span>起拍 {{ detail.auction_start_price || '-' }}，出价 {{ detail.auction_bid_count || 0 }} 次</span>
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
                      <el-tag
                        :type="detail.can_sell_ownership === 1 ? 'success' : 'info'"
                        size="small"
                      >
                        {{ detail.can_sell_ownership === 1 ? '是' : '否' }}
                      </el-tag>
                    </li>
                    <li>
                      <label>可售查阅权：</label>
                      <el-tag
                        :type="detail.can_sell_view_right === 1 ? 'success' : 'info'"
                        size="small"
                      >
                        {{ detail.can_sell_view_right === 1 ? '是' : '否' }}
                      </el-tag>
                    </li>
                    <li>
                      <label>可售加工权：</label>
                      <el-tag
                        :type="detail.can_sell_process_right === 1 ? 'success' : 'info'"
                        size="small"
                      >
                        {{ detail.can_sell_process_right === 1 ? '是' : '否' }}
                      </el-tag>
                    </li>
                  </ul>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="链上信息" name="chain">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="Token ID">{{
                  detail.token_id || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="Owner Address">{{
                  detail.owner_address || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="Chain Tx Hash">{{
                  detail.chain_tx_hash || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="上链时间">{{
                  formatDateTime(detail.chain_time)
                }}</el-descriptions-item>
                <el-descriptions-item label="同步时间">{{
                  formatDateTime(detail.last_sync_time)
                }}</el-descriptions-item>
                <el-descriptions-item label="失败原因">{{
                  detail.fail_reason || '-'
                }}</el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>
          </el-tabs>
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
            <el-form-item label="购买数量">
              <el-input-number
                v-model="buyForm.buy_qty"
                :min="1"
                :max="1"
                style="width: 100%"
                disabled
              />
              <span style="margin-left: 10px; color: #909399; font-size: 12px">
                自动驾驶资产统一不可分割，仅支持购买 1 份
              </span>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="buyVisible = false">取消</el-button>
            <el-button type="primary" :loading="buyLoading" @click="submitBuy">下单</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="bidVisible" title="参与竞拍" width="420px">
          <el-form label-width="90px">
            <el-form-item label="当前价格">
              <el-input :model-value="String(displayPrice)" disabled />
            </el-form-item>
            <el-form-item label="截止时间">
              <el-input :model-value="formatDateTime(detail.auction_end_time)" disabled />
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
      </div>
    </div>
    <AlipayPaymentDialog v-model="paymentVisible" :order-no="paymentOrderNo" @paid="onPaymentPaid" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createOrderByAsset, getAssetDetail, placeAuctionBid } from '@/api/asset'
import AlipayPaymentDialog from '@/components/AlipayPaymentDialog.vue'
import { startOrderPayment } from '@/utils/orderPayment'
import { getFirstAvailableTradeMode } from '@/utils/assetPermission'
import { formatPrice } from '@/utils/price'
import { formatDateTime } from '@/utils/dateTime'
import { getRoleKey, parseTokenPayload } from '@/utils/auth'
import defaultCover from '@/assets/logo.svg'

interface AssetDetail {
  id?: number
  asset_name?: string
  brief?: string
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
  file_format?: string
  file_size?: number
  price?: number
  price_unit?: string
  total_qty?: number
  available_qty?: number
  is_divisible?: number
  can_sell_ownership?: number
  can_sell_view_right?: number
  can_sell_process_right?: number
  view_count?: number
  trade_count?: number
  chain_status?: number
  token_id?: string
  owner_address?: string
  chain_tx_hash?: string
  chain_time?: string
  last_sync_time?: string
  fail_reason?: string
  pricing_mode?: 'fixed' | 'auction'
  publish_status?: number
  publish_price?: number
  auction_start_price?: number
  auction_current_price?: number
  auction_end_time?: string
  auction_bid_count?: number
  auction_status?: string
}

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const activeTab = ref('asset')
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

const chainText = (status?: number) => {
  if (status === 0) return '待上链'
  if (status === 1) return '已上链'
  if (status === 2) return '上链失败'
  return '未知'
}

const chainTag = (status?: number) => {
  if (status === 0) return 'info'
  if (status === 1) return 'success'
  if (status === 2) return 'danger'
  return ''
}

const fetchDetail = async () => {
  const id = route.params.id
  if (!id) {
    ElMessage.error('缺少资产ID')
    return
  }
  loading.value = true
  try {
    const res = await getAssetDetail(String(id))
    if (res.data.status === 0) {
      detail.value = res.data.data || {}
      if (detail.value.picture) {
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
  if (detail.value.is_divisible === 0 && buyForm.value.buy_qty !== 1) {
    ElMessage.error('不可分割资产仅支持购买 1 份')
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
    const orderRes = await createOrderByAsset({
      asset_id: detail.value.id,
      buy_qty: buyForm.value.buy_qty,
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
  max-width: 1400px;
  margin: 0 auto;
}

.crumb-row {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 10px;
  padding: 10px 14px;
  box-shadow: 0 2px 12px rgba(12, 46, 117, 0.06);
}

.hero-card,
.tabs-card {
  border-radius: 10px;
  border: none;
  box-shadow: 0 2px 12px rgba(12, 46, 117, 0.06);
}

.buy-permission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  color: #5f6c91;
  margin-bottom: 16px;
  font-size: 15px;
}

.asset-no {
  color: #1f3f96;
  font-weight: 700;
}

.hero-main {
  display: grid;
  grid-template-columns: 200px 1fr 280px;
  gap: 24px;
}

.cover-wrap {
  width: 200px;
}

.asset-cover {
  width: 200px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e8ecf5;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;

  h2 {
    margin: 0;
    color: #233f8f;
    font-size: 32px;
    font-weight: 700;
  }
}

.desc {
  margin: 16px 0;
  color: #5f6f99;
  line-height: 1.8;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  color: #4f6296;
}

.action-row {
  margin-top: 18px;
  display: flex;
  gap: 10px;
}

.main-right {
  border-left: 1px solid #e8ecf5;
  padding-left: 20px;
}

.price {
  color: #1f3f96;
  font-size: 40px;
  font-weight: 700;
  margin-bottom: 14px;

  span {
    margin-left: 6px;
    font-size: 18px;
    font-weight: 500;
  }
}

.side-item {
  margin-bottom: 12px;
  color: #4f6296;
}

.tabs-card {
  margin-top: 10px;

  :deep(.el-card__body) {
    padding-top: 8px;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.info-block {
  border: 1px solid #edf1f8;
  border-radius: 8px;
  padding: 16px;

  h3 {
    margin: 0 0 12px;
    color: #233f8f;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: flex;
    margin-bottom: 10px;
    color: #314a89;
    line-height: 1.5;
  }

  label {
    min-width: 90px;
    color: #7c89ad;
  }

  span {
    word-break: break-all;
  }
}

@media (max-width: 1100px) {
  .hero-main {
    grid-template-columns: 1fr;
  }

  .main-right {
    border-left: none;
    border-top: 1px solid #e8ecf5;
    padding-left: 0;
    padding-top: 14px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
