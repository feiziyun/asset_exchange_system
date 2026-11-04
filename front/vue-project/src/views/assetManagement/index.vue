<template>
  <div class="common-wrapped">
    <div class="manage-page">
      <section class="toolbar-section">
        <div class="toolbar-row">
          <div class="title-wrap">
            <div class="title">{{ pageTitle }}</div>
            <el-tag v-if="isAdmin" type="danger" effect="light">{{ roleText }}</el-tag>
          </div>
          <el-input
            v-model="keyword"
            class="search-input"
            placeholder="搜索资产名称/摘要/订单号"
            clearable
            @keyup.enter="onSearch"
          />
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onReset">重置</el-button>
          <el-button @click="refreshCurrent">刷新</el-button>
        </div>
      </section>

      <section class="table-section" v-loading="loading">
        <template v-if="!isAdmin">
          <template v-if="isSeller">
            <div v-if="ownedList.length" class="table-wrap">
              <table class="styled-table table-hover-row seller-table">
                <thead>
                  <tr>
                    <th>资产信息</th>
                    <th>资产哈希</th>
                    <th>安全等级</th>
                    <th>资产介绍</th>
                    <th>数量</th>
                    <th>性质</th>
                    <th>状态</th>
                    <th>可出售权益</th>
                    <th>编辑</th>
                    <th>代理托管</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in ownedList" :key="item.id">
                    <td class="asset-info-cell">
                      <div class="asset-info-card">
                        <div class="asset-cover-wrap">
                          <img class="table-cover" :src="resolveCover(item)" alt="asset-cover" />
                        </div>
                        <div class="asset-name-wrap">
                          <div class="cell-title">{{ item.asset_name || '-' }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="hash-cell">{{ shortenHash(item.file_hash) }}</td>
                    <td>{{ item.classification_data_level || '一般数据' }}</td>
                    <td>
                      <div class="brief-cell">
                        {{ item.brief || item.description || '暂无资产描述' }}
                      </div>
                    </td>
                    <td>{{ item.total_qty || 0 }}</td>
                    <td>不可分割</td>
                    <td>
                      <el-tag :type="statusTag(item.status)">{{ statusText(item.status) }}</el-tag>
                    </td>
                    <td>
                      <div class="permission-list">
                        <span v-if="Number(item.can_sell_ownership) === 1">持有</span>
                        <span v-if="Number(item.can_sell_view_right) === 1">经营</span>
                        <span v-if="Number(item.can_sell_process_right) === 1">加工</span>
                        <span
                          v-if="
                            Number(item.can_sell_ownership) !== 1 &&
                            Number(item.can_sell_view_right) !== 1 &&
                            Number(item.can_sell_process_right) !== 1
                          "
                        >
                          -
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="single-action-cell">
                        <el-button type="primary" link @click="openEdit(item)">编辑</el-button>
                      </div>
                    </td>
                    <td>
                      <div class="single-action-cell">
                        <el-button
                          type="info"
                          link
                          :disabled="Number(item.is_proxied || 0) !== 1"
                          @click="openProxyCustody(item)"
                        >代理托管</el-button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <el-empty v-else description="暂无资产" />

            <div class="pager">
              <el-pagination
                background
                layout="total, prev, pager, next, sizes"
                :total="ownedPagination.total"
                :current-page="ownedQuery.page"
                :page-size="ownedQuery.page_size"
                :page-sizes="[10, 20, 50]"
                @current-change="onOwnedPageChange"
                @size-change="onOwnedSizeChange"
              />
            </div>
          </template>

          <template v-else>
            <div class="buyer-section">
              <template v-if="purchasedList.length">
                <div class="table-wrap">
                  <table class="styled-table table-hover-row">
                    <thead>
                      <tr>
                        <th>资产名称</th>
                        <th>卖家</th>
                        <th>数量</th>
                        <th>金额</th>
                        <th>状态</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in purchasedList" :key="item.id">
                        <td class="name-cell">
                          <div class="cell-title">{{ item.asset_name || '-' }}</div>
                          <div class="cell-minor">订单：{{ item.order_no || '-' }}</div>
                        </td>
                        <td>{{ item.seller_account || '-' }}</td>
                        <td>{{ item.buy_qty || 1 }}</td>
                        <td>{{ formatPrice(item.deal_price) }} {{ item.price_unit || '人民币' }}</td>
                        <td>
                          <el-tag :type="orderStatusTag(item.order_status)">{{ orderStatusText(item.order_status) }}</el-tag>
                        </td>
                        <td>
                          <div class="row-actions">
                            <el-button type="primary" link @click="openOrderDetail(item)">查看订单详情</el-button>
                            <el-button
                              v-if="item.order_status === 0"
                              type="primary"
                              link
                              :loading="actionLoadingNo === item.order_no"
                              @click="payCurrentOrder(item.order_no)"
                            >
                              继续购买
                            </el-button>
                            <el-button
                              v-if="item.order_status === 0"
                              type="danger"
                              link
                              :loading="actionLoadingNo === item.order_no"
                              @click="cancelCurrentOrder(item.order_no)"
                            >取消订单</el-button>
                            <el-button
                              v-if="item.order_status === 4"
                              type="danger"
                              link
                              :loading="actionLoadingNo === item.order_no"
                              @click="deleteCurrentOrder(item.order_no)"
                            >删除订单</el-button>
                            <el-button
                              v-if="item.order_status >= 1 && item.order_status <= 3"
                              type="primary"
                              link
                              @click="goWorkbench(item.order_no)"
                            >
                              交付工作台
                            </el-button>
                            <el-button
                              v-if="item.order_status === 2"
                              type="success"
                              link
                              :loading="actionLoadingNo === item.order_no"
                              @click="openConfirmDialog(item.order_no)"
                            >
                              确认收货
                            </el-button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
              <el-empty v-else description="暂无购买记录" />

              <div class="pager">
                <el-pagination
                  background
                  layout="total, prev, pager, next, sizes"
                  :total="purchasedPagination.total"
                  :current-page="purchasedQuery.page"
                  :page-size="purchasedQuery.page_size"
                  :page-sizes="[10, 20, 50]"
                  @current-change="onPurchasedPageChange"
                  @size-change="onPurchasedSizeChange"
                />
              </div>
            </div>
          </template>
        </template>

        <template v-else>
          <el-alert
            title="管理员可查看并处理当前登记的全部资产"
            type="warning"
            :closable="false"
            class="admin-alert"
          />
          <el-table :data="ownedList" stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="asset_name" label="资产名称" min-width="180" />
            <el-table-column prop="owner_account" label="归属账号" min-width="120" />
            <el-table-column prop="owner_identity" label="归属身份" width="100" />
            <el-table-column prop="price" label="价格" width="140">
              <template #default="scope">{{ formatPrice(scope.row.price) }} {{ scope.row.price_unit || '人民币' }}</template>
            </el-table-column>
            <el-table-column label="库存" width="130">
              <template #default="scope">{{ scope.row.available_qty }}/{{ scope.row.total_qty }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="110">
              <template #default="scope">
                <el-tag :type="statusTag(scope.row.status)">{{ statusText(scope.row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" min-width="170">
              <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" min-width="320" fixed="right">
              <template #default="scope">
                <el-button type="primary" link @click="goDetail(scope.row.id)">查看</el-button>
                <el-button type="primary" link @click="openEdit(scope.row)">编辑</el-button>
                <el-button type="warning" link @click="openValuation(scope.row)">估值</el-button>
                <el-button type="success" link :disabled="!canPublish(scope.row)" @click="openPublish(scope.row)">上架</el-button>
                <el-button type="danger" link :disabled="!canDownShelf(scope.row)" @click="downShelf(scope.row)">下架</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager">
            <el-pagination
              background
              layout="total, prev, pager, next, sizes"
              :total="ownedPagination.total"
              :current-page="ownedQuery.page"
              :page-size="ownedQuery.page_size"
              :page-sizes="[10, 20, 50]"
              @current-change="onOwnedPageChange"
              @size-change="onOwnedSizeChange"
            />
          </div>
        </template>
      </section>
    </div>
  </div>

  <el-dialog v-model="editVisible" title="编辑资产" width="620px">
    <div class="legacy-edit-dialog">
      <el-form :model="editForm" label-width="88px" class="edit-form">
        <el-form-item label="哈希值">
          <el-input :model-value="editForm.file_hash" disabled />
        </el-form-item>
        <el-form-item label="安全等级">
          <el-select v-model="editForm.classification_data_level" style="width: 100%">
            <el-option label="一般数据" value="一般数据" />
            <el-option label="重要数据" value="重要数据" />
            <el-option label="核心数据" value="核心数据" />
          </el-select>
        </el-form-item>
        <el-form-item label="资产介绍">
          <el-input v-model="editForm.description" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="资产名称">
          <el-input v-model="editForm.asset_name" />
        </el-form-item>
        <el-form-item label="资产摘要">
          <el-input v-model="editForm.brief" />
        </el-form-item>
        <div class="edit-grid-row">
          <el-form-item :label="editForm.pricing_mode === 'auction' ? '起拍价' : '价格'">
            <el-input-number
              v-model="editForm.price"
              :min="editForm.pricing_mode === 'auction' ? 1 : 0"
              :precision="editForm.pricing_mode === 'auction' ? 0 : 2"
              :step="editForm.pricing_mode === 'auction' ? 1 : 0.01"
              style="width: 100%"
              @change="normalizeEditAuctionPrice"
            />
          </el-form-item>
          <el-form-item label="总数量">
            <el-input-number v-model="editForm.total_qty" :min="1" style="width: 100%" />
          </el-form-item>
        </div>
        <div class="edit-grid-row">
          <el-form-item label="交易模式">
            <el-radio-group v-model="editForm.pricing_mode" @change="normalizeEditAuctionPrice">
              <el-radio value="fixed">固定价格</el-radio>
              <el-radio value="auction">拍卖</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="editForm.pricing_mode === 'auction'" label="截止时间">
            <el-date-picker
              v-model="editForm.auction_end_time"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="拍卖截止时间"
              style="width: 100%"
            />
          </el-form-item>
        </div>
        <div class="edit-grid-row">
          <el-form-item label="可用数量">
            <el-input-number v-model="editForm.available_qty" :min="0" style="width: 100%" />
          </el-form-item>
          <el-form-item label="价格单位">
            <el-input v-model="editForm.price_unit" />
          </el-form-item>
        </div>
        <el-form-item label="交付方式">
          <el-select v-model="editForm.pc_type" style="width: 100%">
            <el-option
              v-for="item in deliveryMethodOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="出售权益">
          <div class="rights-group">
            <el-checkbox v-model="editForm.can_sell_ownership" :true-label="1" :false-label="0">持有权</el-checkbox>
            <el-checkbox v-model="editForm.can_sell_view_right" :true-label="1" :false-label="0">经营权</el-checkbox>
            <el-checkbox v-model="editForm.can_sell_process_right" :true-label="1" :false-label="0">加工权</el-checkbox>
          </div>
        </el-form-item>
        <el-form-item label="上架状态">
          <el-switch
            v-model="editForm.status"
            :active-value="1"
            :inactive-value="0"
            active-text="上架中"
            inactive-text="未上架"
          />
        </el-form-item>
        <el-form-item label="估值定价">
          <div class="edit-valuation-actions">
            <el-button type="warning" plain @click="openValuationFromEdit">资产估值</el-button>
            <el-button
              v-if="editAssetId && canPublish({ id: editAssetId, status: editForm.status, available_qty: editForm.available_qty, pricing_mode: editForm.pricing_mode, auction_status: editForm.auction_status } as any)"
              type="success"
              plain
              @click="openPublishFromEdit"
            >
              定价上架
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="editVisible = false">取消</el-button>
      <el-button type="primary" :loading="editLoading" @click="submitEdit">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="publishVisible" title="资产上架" width="460px">
    <el-form :model="publishForm" label-width="110px">
      <el-form-item label="资产ID">
        <el-input :model-value="publishForm.asset_id" disabled />
      </el-form-item>
      <el-form-item :label="publishForm.pricing_mode === 'auction' ? '起拍价' : '上架单价'">
        <el-input-number
          v-model="publishForm.publish_price"
          :min="publishForm.pricing_mode === 'auction' ? 1 : 0"
          :precision="publishForm.pricing_mode === 'auction' ? 0 : 2"
          :step="publishForm.pricing_mode === 'auction' ? 1 : 0.01"
          style="width: 100%"
          @change="normalizePublishAuctionPrice"
        />
      </el-form-item>
      <el-form-item label="上架数量">
        <el-input-number v-model="publishForm.publish_qty" :min="1" style="width: 100%" />
      </el-form-item>
      <el-form-item label="交易模式">
        <el-radio-group v-model="publishForm.pricing_mode" @change="normalizePublishAuctionPrice">
          <el-radio value="fixed">固定价格</el-radio>
          <el-radio value="auction">拍卖</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="publishForm.pricing_mode === 'auction'" label="拍卖截止时间">
        <el-date-picker
          v-model="publishForm.auction_end_time"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="拍卖截止时间"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="publishVisible = false">取消</el-button>
      <el-button type="primary" :loading="publishLoading" @click="submitPublish">确认上架</el-button>
    </template>
  </el-dialog>

  <AssetValuationDialog
    v-model:visible="valuationVisible"
    :asset="valuationAsset"
    :username="String(tokenPayload.account || tokenPayload.username || '')"
    :user-id="Number(tokenPayload.id || 0) || null"
    @price-updated="handleValuationPriceUpdated"
  />

  <el-dialog v-model="confirmDialogVisible" title="确认收货" width="420px">
    <template #footer>
      <el-button @click="confirmDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="actionLoadingNo === confirmOrderNo" @click="submitConfirm">
        确认收货
      </el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="orderDetailVisible" title="订单详情" width="520px">
    <el-descriptions :column="1" border>
      <el-descriptions-item label="订单号">{{ currentOrderDetail?.order_no || '-' }}</el-descriptions-item>
      <el-descriptions-item label="资产名称">{{ currentOrderDetail?.asset_name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="卖方账号">{{ currentOrderDetail?.seller_account || '-' }}</el-descriptions-item>
      <el-descriptions-item label="成交金额">
        {{ formatPrice(currentOrderDetail?.deal_price || 0) }} {{ currentOrderDetail?.price_unit || '人民币' }}
      </el-descriptions-item>
      <el-descriptions-item label="状态">{{ orderStatusText(currentOrderDetail?.order_status) }}</el-descriptions-item>
      <el-descriptions-item label="数量">{{ currentOrderDetail?.buy_qty || '-' }}</el-descriptions-item>
      <el-descriptions-item label="成交时间">{{ formatDateTime(currentOrderDetail?.created_at) }}</el-descriptions-item>
    </el-descriptions>
  </el-dialog>

  <el-dialog v-model="proxyCustodyVisible" title="代理托管" width="460px">
    <el-form label-width="90px">
      <el-form-item label="资产名称">
        <el-input :model-value="proxyCustodyAssetName" disabled />
      </el-form-item>
      <el-form-item label="托管码">
        <el-input v-model.trim="proxyCustodyForm.target_address" placeholder="请输入托管码" />
      </el-form-item>
      <el-form-item label="托管数量">
        <el-input-number v-model="proxyCustodyForm.quantity" :min="1" :max="1" disabled style="width: 100%" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="proxyCustodyVisible = false">取消</el-button>
      <el-button type="primary" :loading="proxyCustodyLoading" @click="submitProxyCustody">确认代理托管</el-button>
    </template>
  </el-dialog>
  <AlipayPaymentDialog v-model="paymentVisible" :order-no="paymentOrderNo" @paid="fetchPurchasedAssets" />
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AssetValuationDialog from '@/components/AssetValuationDialog.vue'
import AlipayPaymentDialog from '@/components/AlipayPaymentDialog.vue'
import { startOrderPayment } from '@/utils/orderPayment'
import {
  cancelOrder,
  confirmDelivery,
  deleteClosedOrder,
  getAssetDetail,
  getMyAssetList,
  getOrderList,
  publishAsset,
  proxyCustodyAsset,
  updateAsset,
  updateAssetStatus,
} from '@/api/asset'
import { formatPrice, roundPrice } from '@/utils/price'
import { formatDateTime } from '@/utils/dateTime'
import { getRoleKey, getRoleLabel, parseTokenPayload } from '@/utils/auth'
import defaultCover from '@/assets/logo.svg'

interface AssetItem {
  id: number
  asset_name: string
  brief?: string
  description?: string
  file_hash?: string
  picture?: string | null
  picture_mime_type?: string
  price?: number
  price_unit?: string
  total_qty?: number
  available_qty?: number
  status?: number
  created_at?: string
  category_name?: string
  classification_category_name?: string
  sub_category_name?: string
  region_name?: string
  view_count?: number
  trade_count?: number
  owner_account?: string
  owner_identity?: string
  is_proxied?: number
  can_sell_ownership?: number
  can_sell_view_right?: number
  can_sell_process_right?: number
  pc_type?: string
  pricing_mode?: 'fixed' | 'auction'
  auction_start_price?: number
  auction_current_price?: number
  auction_end_time?: string
  auction_bid_count?: number
  auction_status?: string
}

interface PurchasedItem {
  id: number
  order_no: string
  asset_id: number
  asset_name?: string
  seller_account?: string
  buy_qty?: number
  deal_price?: number
  price_unit?: string
  order_status?: number
  created_at?: string
}

const router = useRouter()
const loading = ref(false)
const keyword = ref('')
const ownedList = ref<AssetItem[]>([])
const purchasedList = ref<PurchasedItem[]>([])
const actionLoadingNo = ref('')
const confirmDialogVisible = ref(false)
const confirmOrderNo = ref('')
const orderDetailVisible = ref(false)
const currentOrderDetail = ref<PurchasedItem | null>(null)
const valuationVisible = ref(false)
const valuationAsset = ref<AssetItem | null>(null)

const tokenPayload = parseTokenPayload() || {}
const roleKey = ref(getRoleKey(tokenPayload.identity || ''))
const roleText = ref(getRoleLabel(tokenPayload.identity || ''))
const isAdmin = computed(() => roleKey.value === 'admin')
const isSeller = computed(() => roleKey.value === 'seller' || isAdmin.value)

const pageTitle = computed(() => {
  if (isAdmin.value) return '资产管理'
  if (isSeller.value) return '我的资产'
  return '我的购买'
})

const ownedQuery = reactive({
  page: 1,
  page_size: 10,
  keyword: '',
})

const ownedPagination = reactive({
  total: 0,
})

const purchasedQuery = reactive({
  page: 1,
  page_size: 10,
  keyword: '',
})

const purchasedPagination = reactive({
  total: 0,
})

const editVisible = ref(false)
const editLoading = ref(false)
const editAssetId = ref<number | null>(null)
const editForm = reactive({
  file_hash: '',
  classification_data_level: '一般数据',
  asset_name: '',
  brief: '',
  price: 0,
  price_unit: '人民币',
  total_qty: 1,
  available_qty: 1,
  description: '',
  can_sell_ownership: 0,
  can_sell_view_right: 0,
  can_sell_process_right: 0,
  pc_type: 'HE',
  pricing_mode: 'fixed' as 'fixed' | 'auction',
  auction_start_price: 0,
  auction_end_time: '',
  auction_status: '',
  status: 0,
})
const deliveryMethodOptions = [
  { label: '同态加密 HE', value: 'HE' },
  { label: '代理重加密 PRE', value: 'PRE' },
  { label: '联邦学习 FL', value: 'FL' },
  { label: '多方安全计算 MPC', value: 'MPC' },
]

const normalizeAuctionStartPrice = (value: number | string) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : 0
}

const normalizeEditAuctionPrice = () => {
  if (editForm.pricing_mode === 'auction') {
    editForm.price = normalizeAuctionStartPrice(editForm.price)
  }
}

const normalizePublishAuctionPrice = () => {
  if (publishForm.pricing_mode === 'auction') {
    publishForm.publish_price = normalizeAuctionStartPrice(publishForm.publish_price)
  }
}

const publishVisible = ref(false)
const publishLoading = ref(false)
const publishForm = reactive({
  asset_id: 0,
  publish_price: 0,
  publish_qty: 1,
  pricing_mode: 'fixed' as 'fixed' | 'auction',
  auction_end_time: '',
})
const proxyCustodyVisible = ref(false)
const proxyCustodyLoading = ref(false)
const proxyCustodyAssetId = ref<number | null>(null)
const proxyCustodyAssetName = ref('')
const proxyCustodyForm = reactive({
  target_address: '',
  quantity: 1,
})

const statusText = (status?: number) => {
  if (status === 0) return '未上架'
  if (status === 1) return '上架中'
  if (status === 2) return '已售罄'
  return '未知'
}

const statusTag = (status?: number) => {
  if (status === 0) return 'info'
  if (status === 1) return 'success'
  if (status === 2) return 'warning'
  return ''
}

const orderStatusText = (status?: number) => {
  if (status === 1) return '待卖家交付'
  if (status === 2) return '待买家确认'
  if (status === 3) return '已完成'
  if (status === 0) return '待支付'
  if (status === 4) return '已关闭'
  if (status === 5) return '退款中'
  if (status === 6) return '已退款'
  return '其他'
}

const orderStatusTag = (status?: number) => {
  if (status === 0) return 'warning'
  if (status === 1 || status === 2) return 'primary'
  if (status === 3) return 'success'
  return 'info'
}

const resolveCover = (item: AssetItem) => {
  if (item.picture) {
    return `data:${item.picture_mime_type || 'image/jpeg'};base64,${item.picture}`
  }
  return defaultCover
}

const shortenHash = (value?: string) => {
  const normalized = String(value || '').trim()
  if (!normalized) return '-'
  if (normalized.length <= 18) return normalized
  return `${normalized.slice(0, 8)}...${normalized.slice(-8)}`
}

const fetchOwnedAssets = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const res = await getMyAssetList({
      ...ownedQuery,
      scope: isAdmin.value ? 'all' : 'my',
    })
    if (res.data.status === 0) {
      ownedList.value = res.data.data?.list || []
      const pagination = res.data.data?.pagination || {}
      ownedQuery.page = pagination.page || 1
      ownedQuery.page_size = pagination.page_size || ownedQuery.page_size
      ownedPagination.total = pagination.total || 0
    } else {
      ElMessage.error(res.data.message || '获取资产失败')
    }
  } catch (_error) {
    ElMessage.error('获取资产失败')
  } finally {
    if (!silent) loading.value = false
  }
}

const fetchPurchasedAssets = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const res = await getOrderList({
      ...purchasedQuery,
      order_role: 'buyer',
    })
    if (res.data.status === 0) {
      purchasedList.value = res.data.data?.list || []
      const pagination = res.data.data?.pagination || {}
      purchasedQuery.page = pagination.page || 1
      purchasedQuery.page_size = pagination.page_size || purchasedQuery.page_size
      purchasedPagination.total = pagination.total || 0
    } else {
      ElMessage.error(res.data.message || '获取已购资产失败')
    }
  } catch (_error) {
    ElMessage.error('获取已购资产失败')
  } finally {
    if (!silent) loading.value = false
  }
}

const fetchCurrent = async () => {
  if (isSeller.value) {
    await fetchOwnedAssets()
    return
  }
  await fetchPurchasedAssets()
}

const goDetail = (id: number) => {
  router.push({ path: `/assetDetail/${id}`, query: { from: '/assetManagement' } })
}

const onSearch = () => {
  if (isSeller.value) {
    ownedQuery.page = 1
    ownedQuery.keyword = keyword.value
    fetchOwnedAssets()
    return
  }
  purchasedQuery.page = 1
  purchasedQuery.keyword = keyword.value
  fetchPurchasedAssets()
}

const onReset = () => {
  keyword.value = ''
  ownedQuery.page = 1
  ownedQuery.page_size = 10
  ownedQuery.keyword = ''
  purchasedQuery.page = 1
  purchasedQuery.page_size = 10
  purchasedQuery.keyword = ''
  fetchCurrent()
}

const refreshCurrent = () => {
  fetchCurrent()
}

const paymentVisible = ref(false)
const paymentOrderNo = ref('')

const payCurrentOrder = async (orderNo?: string) => {
  if (!orderNo) return
  actionLoadingNo.value = orderNo
  try {
    const paymentMode = await startOrderPayment(orderNo)
    if (paymentMode === 'skipped') {
      ElMessage.success('订单已确认，等待卖家交付')
      fetchPurchasedAssets()
      return
    }
    paymentOrderNo.value = orderNo
    paymentVisible.value = true
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '支付失败')
  } finally {
    actionLoadingNo.value = ''
  }
}

const cancelCurrentOrder = async (orderNo?: string) => {
  if (!orderNo) return
  try {
    await ElMessageBox.confirm('取消后订单将关闭，预留库存会恢复。', '取消订单', {
      confirmButtonText: '确认取消',
      cancelButtonText: '返回',
      type: 'warning',
    })
  } catch { return }
  actionLoadingNo.value = orderNo
  try {
    const res = await cancelOrder(orderNo)
    if (res.data.status !== 0) throw new Error(res.data.message || '取消订单失败')
    ElMessage.success('订单已关闭')
    await fetchPurchasedAssets()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '取消订单失败')
    await fetchPurchasedAssets()
  } finally {
    actionLoadingNo.value = ''
  }
}

const deleteCurrentOrder = async (orderNo?: string) => {
  if (!orderNo) return
  try {
    await ElMessageBox.confirm('删除后该订单将不再出现在我的购买记录中。', '删除订单', {
      confirmButtonText: '删除',
      cancelButtonText: '返回',
      type: 'warning',
    })
  } catch { return }
  actionLoadingNo.value = orderNo
  try {
    const res = await deleteClosedOrder(orderNo)
    if (res.data.status !== 0) throw new Error(res.data.message || '删除订单失败')
    ElMessage.success('订单已删除')
    await fetchPurchasedAssets()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '删除订单失败')
  } finally {
    actionLoadingNo.value = ''
  }
}

const goWorkbench = (orderNo?: string) => {
  if (!orderNo) return
  router.push({
    path: '/assetDelivery',
    query: { order_no: orderNo },
  })
}

const openConfirmDialog = (orderNo?: string) => {
  if (!orderNo) return
  confirmOrderNo.value = orderNo
  confirmDialogVisible.value = true
}

const submitConfirm = async () => {
  if (!confirmOrderNo.value) return
  actionLoadingNo.value = confirmOrderNo.value
  try {
    const res = await confirmDelivery(confirmOrderNo.value, {})
    if (res.data.status === 0) {
      ElMessage.success('确认收货成功，订单已完成')
      confirmDialogVisible.value = false
      fetchPurchasedAssets()
    } else {
      ElMessage.error(res.data.message || '确认收货失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '确认收货失败')
  } finally {
    actionLoadingNo.value = ''
  }
}

const onPurchasedPageChange = (page: number) => {
  purchasedQuery.page = page
  fetchPurchasedAssets()
}

const onPurchasedSizeChange = (size: number) => {
  purchasedQuery.page_size = size
  purchasedQuery.page = 1
  fetchPurchasedAssets()
}

const onOwnedPageChange = (page: number) => {
  ownedQuery.page = page
  fetchOwnedAssets()
}

const onOwnedSizeChange = (size: number) => {
  ownedQuery.page_size = size
  ownedQuery.page = 1
  fetchOwnedAssets()
}

const canPublish = (row: AssetItem) => {
  if (
    row.pricing_mode === 'auction' &&
    ['CLOSED', 'APPLIED'].includes(String(row.auction_status || '').toUpperCase())
  ) {
    return false
  }
  const status = Number(row.status)
  const availableQty = Number(row.available_qty || 0)
  return status !== 1 && availableQty > 0
}

const canDownShelf = (row: AssetItem) => {
  return Number(row.status) === 1
}

const openOrderDetail = (row: PurchasedItem) => {
  currentOrderDetail.value = row
  orderDetailVisible.value = true
}

const openEdit = (row: AssetItem) => {
  editAssetId.value = row.id
  editForm.file_hash = row.file_hash || ''
  editForm.classification_data_level = row.classification_data_level || '一般数据'
  editForm.asset_name = row.asset_name || ''
  editForm.brief = row.brief || ''
  editForm.price = row.pricing_mode === 'auction'
    ? normalizeAuctionStartPrice(row.auction_start_price ?? row.price ?? 0)
    : roundPrice(row.price)
  editForm.price_unit = row.price_unit || '人民币'
  editForm.total_qty = Number(row.total_qty || 1)
  editForm.available_qty = Number(row.available_qty || 1)
  editForm.description = row.description || ''
  editForm.can_sell_ownership = Number(row.can_sell_ownership || 0)
  editForm.can_sell_view_right = Number(row.can_sell_view_right || 0)
  editForm.can_sell_process_right = Number(row.can_sell_process_right || 0)
  editForm.pc_type = row.pc_type || 'HE'
  editForm.pricing_mode = row.pricing_mode === 'auction' ? 'auction' : 'fixed'
  editForm.auction_start_price = normalizeAuctionStartPrice(row.auction_start_price ?? row.price ?? 0)
  editForm.auction_end_time = row.auction_end_time || ''
  editForm.auction_status = row.auction_status || ''
  editForm.status = Number(row.status || 0)
  editVisible.value = true
}

const openProxyCustody = (row: AssetItem) => {
  if (Number(row.is_proxied || 0) !== 1) {
    ElMessage.info('该资产未开启代理托管')
    return
  }
  proxyCustodyAssetId.value = Number(row.id)
  proxyCustodyAssetName.value = row.asset_name || '-'
  proxyCustodyForm.target_address = ''
  proxyCustodyForm.quantity = 1
  proxyCustodyVisible.value = true
}

const submitProxyCustody = async () => {
  if (!proxyCustodyAssetId.value) return
  if (!String(proxyCustodyForm.target_address || '').trim()) {
    ElMessage.error('请输入托管码')
    return
  }

  proxyCustodyLoading.value = true
  try {
    const res = await proxyCustodyAsset(proxyCustodyAssetId.value, {
      target_address: proxyCustodyForm.target_address,
      quantity: 1,
    })
    if (res.data.status === 0) {
      ElMessage.success('代理托管成功')
      proxyCustodyVisible.value = false
    } else {
      ElMessage.error(res.data.message || '代理托管失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '代理托管失败')
  } finally {
    proxyCustodyLoading.value = false
  }
}

const openValuationFromEdit = () => {
  if (!editAssetId.value) return
  valuationAsset.value = {
    id: editAssetId.value,
    asset_name: editForm.asset_name,
    description: editForm.description,
    file_hash: editForm.file_hash,
    price: editForm.price,
  }
  valuationVisible.value = true
}

const openPublishFromEdit = () => {
  if (!editAssetId.value) return
  publishForm.asset_id = editAssetId.value
  publishForm.publish_price = editForm.pricing_mode === 'auction'
    ? normalizeAuctionStartPrice(editForm.price)
    : roundPrice(editForm.price)
  publishForm.publish_qty = 1
  publishForm.pricing_mode = editForm.pricing_mode
  publishForm.auction_end_time = editForm.auction_end_time
  publishVisible.value = true
}

const submitEdit = async () => {
  if (!editAssetId.value) return
  if (editForm.available_qty > editForm.total_qty) {
    ElMessage.error('可用数量不能大于总数量')
    return
  }
  if (editForm.pricing_mode === 'auction') {
    normalizeEditAuctionPrice()
    if (!Number.isInteger(Number(editForm.price)) || Number(editForm.price) <= 0) {
      ElMessage.error('拍卖起拍价必须为正整数')
      return
    }
    const auctionEnd = new Date(editForm.auction_end_time).getTime()
    if (!editForm.auction_end_time || !Number.isFinite(auctionEnd) || auctionEnd <= Date.now() + 60 * 1000) {
      ElMessage.error('拍卖截止时间至少应晚于当前时间 1 分钟')
      return
    }
  }
  editLoading.value = true
  try {
    const targetStatus = Number(editForm.status)
    const normalizedPrice = roundPrice(editForm.price)
    const res = await updateAsset(editAssetId.value, {
      ...editForm,
      price: normalizedPrice,
      auction_start_price: editForm.pricing_mode === 'auction' ? normalizedPrice : null,
    })
    if (res.data.status === 0) {
      const statusRes = await updateAssetStatus(editAssetId.value, targetStatus)
      if (statusRes.data.status !== 0) {
        ElMessage.error(statusRes.data.message || '资产状态更新失败')
        return
      }
      ElMessage.success('资产更新成功')
      editVisible.value = false
      fetchOwnedAssets()
    } else {
      ElMessage.error(res.data.message || '资产更新失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '资产更新失败')
  } finally {
    editLoading.value = false
  }
}

const openPublish = (row: AssetItem) => {
  if (!canPublish(row)) {
    if (
      row.pricing_mode === 'auction' &&
      ['CLOSED', 'APPLIED'].includes(String(row.auction_status || '').toUpperCase())
    ) {
      ElMessage.warning('该资产拍卖已结束，不能重新上架拍卖')
    }
    return
  }
  publishForm.asset_id = row.id
  publishForm.publish_price = row.pricing_mode === 'auction'
    ? normalizeAuctionStartPrice(row.auction_start_price ?? row.price ?? 0)
    : roundPrice(row.price)
  publishForm.publish_qty = 1
  publishForm.pricing_mode = row.pricing_mode === 'auction' ? 'auction' : 'fixed'
  publishForm.auction_end_time = row.auction_end_time || ''
  publishVisible.value = true
}

const openValuation = async (row: AssetItem) => {
  valuationAsset.value = row
  valuationVisible.value = true

  if (String(row.description || '').trim()) return

  try {
    const res = await getAssetDetail(row.id)
    if (res.data.status === 0) {
      const description = String(res.data.data?.description || '').trim()
      if (description) {
        valuationAsset.value = {
          ...row,
          description,
        }
      }
    }
  } catch (_error) {
    // ignore
  }
}

const handleValuationPriceUpdated = (value: number) => {
  if (!valuationAsset.value) return
  const nextPrice = valuationAsset.value.pricing_mode === 'auction'
    ? normalizeAuctionStartPrice(value)
    : roundPrice(value)
  valuationAsset.value.price = nextPrice
  const hit = ownedList.value.find((item) => item.id === valuationAsset.value?.id)
  if (hit) {
    hit.price = nextPrice
    if (hit.pricing_mode === 'auction') {
      hit.auction_start_price = nextPrice
    }
  }
  if (editAssetId.value === valuationAsset.value.id) {
    editForm.price = editForm.pricing_mode === 'auction'
      ? normalizeAuctionStartPrice(value)
      : roundPrice(value)
  }
}

const changeStatus = async (assetId: number, status: number) => {
  try {
    const res = await updateAssetStatus(assetId, status)
    if (res.data.status === 0) {
      ElMessage.success('状态更新成功')
      fetchOwnedAssets()
    } else {
      ElMessage.error(res.data.message || '状态更新失败')
    }
  } catch (_error) {
    ElMessage.error('状态更新失败')
  }
}

const downShelf = async (row: AssetItem) => {
  if (!canDownShelf(row)) return
  try {
    await ElMessageBox.confirm(`确认下架资产「${row.asset_name || row.id}」？`, '下架确认', {
      confirmButtonText: '确认下架',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  changeStatus(row.id, 0)
}

const submitPublish = async () => {
  if (publishForm.pricing_mode === 'auction') {
    normalizePublishAuctionPrice()
    const endTime = new Date(publishForm.auction_end_time).getTime()
    if (!publishForm.auction_end_time || !Number.isFinite(endTime) || endTime <= Date.now() + 60 * 1000) {
      ElMessage.error('拍卖截止时间至少应晚于当前时间 1 分钟')
      return
    }
    if (!Number.isInteger(Number(publishForm.publish_price)) || Number(publishForm.publish_price) <= 0) {
      ElMessage.error('拍卖起拍价必须为正整数')
      return
    }
  }
  publishLoading.value = true
  try {
    const res = await publishAsset({
      ...publishForm,
      publish_price: roundPrice(publishForm.publish_price),
      auction_start_price: publishForm.pricing_mode === 'auction'
        ? roundPrice(publishForm.publish_price)
        : null,
    })
    if (res.data.status === 0) {
      ElMessage.success(`上架成功，记录ID：${res.data.data?.publish_id}`)
      publishVisible.value = false
      fetchOwnedAssets()
    } else {
      ElMessage.error(res.data.message || '上架失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '上架失败')
  } finally {
    publishLoading.value = false
  }
}

onMounted(fetchCurrent)
</script>

<style lang="scss" scoped>
.common-wrapped {
  width: 100%;
  display: flex;
  justify-content: center;
  background: #f5f7fb;

  .manage-page {
    padding: 8px 10px;
    width: 96%;
    min-height: 100vh;
    box-sizing: border-box;
  }
}

.toolbar-section,
.table-section {
  background: #fff;
  border: 1px solid #e4e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 2px 8px rgba(18, 41, 79, 0.06);
}

.table-section {
  margin-top: 8px;
}

.toolbar-row {
  display: flex;
  gap: 8px;
  align-items: center;

  .title-wrap {
    min-width: 180px;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .title {
    font-size: 15px;
    color: #1d3972;
    font-weight: 700;
  }

  .search-input {
    width: 220px;
  }
}

.admin-alert {
  margin-bottom: 12px;
}

.table-wrap {
  overflow-x: auto;
}

.styled-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}

.styled-table th,
.styled-table td {
  border: 1px solid #e1e6ef;
  padding: 5px 4px;
  text-align: center;
  vertical-align: middle;
  word-wrap: break-word;
  overflow: hidden;
  position: relative;
}

.styled-table th {
  background: #f8fafc;
  color: #3d4b66;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  border-bottom: 2px solid #dde4ee;
}

.styled-table td {
  background: #fff;
  color: #22304f;
  font-size: 12px;
  line-height: 1.3;
}

.seller-table th:nth-child(1) { width: 98px; }
.seller-table th:nth-child(2) { width: 104px; }
.seller-table th:nth-child(3) { width: 62px; }
.seller-table th:nth-child(4) { width: 156px; }
.seller-table th:nth-child(5) { width: 46px; }
.seller-table th:nth-child(6) { width: 58px; }
.seller-table th:nth-child(7) { width: 68px; }
.seller-table th:nth-child(8) { width: 84px; }
.seller-table th:nth-child(9),
.seller-table th:nth-child(10) { width: 48px; }

.styled-table tbody tr:nth-of-type(odd) td {
  background: #f9fbfd;
}

.styled-table tbody tr:nth-of-type(even) td {
  background: #ffffff;
}

.table-hover-row tbody tr:hover td {
  background: #eef3f8;
  transition: background-color 0.2s ease;
}

.asset-info-cell {
  text-align: center;
}

.asset-info-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.asset-cover-wrap,
.asset-name-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
}

.table-cover {
  width: 70px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
  background: #f4f7fd;
  display: block;
}

.name-cell,
.asset-name-wrap {
  word-break: break-word;
  min-width: 0;
}

.hash-cell {
  color: #50627f;
  word-break: break-all;
}

.brief-cell {
  width: 100%;
  box-sizing: border-box;
  color: #4b5974;
  word-break: break-word;
  text-align: left;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cell-title {
  font-size: 12px;
  font-weight: 700;
  color: #1d3b75;
  line-height: 1.25;
}

.permission-list,
.pricing-actions,
.single-action-cell,
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
}

.pricing-actions :deep(.el-button),
.single-action-cell :deep(.el-button),
.row-actions :deep(.el-button) {
  margin-left: 0;
  padding: 0 2px;
  font-size: 11px;
}

.pricing-actions {
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.single-action-cell {
  justify-content: center;
}

.legacy-edit-dialog :deep(.el-form-item) {
  margin-bottom: 14px;
}

.legacy-edit-dialog :deep(.el-form-item__label) {
  color: #384861;
  font-weight: 500;
}

.edit-grid-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.rights-group {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.edit-valuation-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pager {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.valuation-result-block {
  margin-top: 8px;
  border: 1px solid #e6ecf8;
  border-radius: 8px;
  background: #f8faff;
  padding: 12px;
}

.valuation-result-title {
  font-size: 14px;
  font-weight: 700;
  color: #1d3b75;
  margin-bottom: 10px;
}

.valuation-summary-row {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 10px;
}

.summary-label {
  color: #607089;
  font-size: 13px;
}

.summary-value {
  color: #0f5132;
  font-size: 14px;
}

.valuation-raw {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.6;
  color: #22304f;
}

.valuation-error {
  margin-top: 8px;
  color: #d03050;
  font-size: 13px;
  white-space: pre-wrap;
}

@media (max-width: 900px) {
  .toolbar-row {
    flex-wrap: wrap;
  }

  .toolbar-row .search-input {
    width: 100%;
  }

  .edit-grid-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
