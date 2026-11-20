<template>
  <div class="common-wrapped">
    <div class="delivery-page">
      <section class="toolbar-section app-workbench-panel">
        <div class="toolbar-row app-search-layout">
          <div class="list-title page-title">资产交付</div>
          <div class="app-search-bar">
            <el-input v-model="searchInput" class="delivery-search app-search-input" placeholder="搜索订单号或资产名称"
              clearable @keyup.enter="onSearch" @clear="onSearch">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button class="app-search-button" @click="onSearch">搜索</el-button>
          </div>
        </div>
      </section>

      <section class="table-section app-workbench-panel" v-loading="loading">
        <div class="delivery-filter-row">
          <span class="delivery-filter-label">交付状态</span>
          <div class="delivery-filter-options" role="group" aria-label="交付状态筛选">
            <button v-for="option in deliveryFilterOptions" :key="option.value" type="button"
              class="delivery-filter-option" :class="{ active: selectedDeliveryState === option.value }"
              :aria-pressed="selectedDeliveryState === option.value" @click="onDeliveryFilterChange(option.value)">
              {{ option.label }}
            </button>
          </div>
          <span class="delivery-filter-count">共 {{ pagination.total }} 笔订单</span>
        </div>
        <div class="table-wrap">
          <table v-if="buyerRows.length" class="styled-table table-hover-row buyer-table">
            <thead>
              <tr>
                <th>资产信息</th>
                <th class="col-contract">数字合约</th>
                <th class="col-status">交付状态</th>
                <th class="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in buyerRows" :key="`buyer-${item.order_no}`">
                <td>
                  <div class="asset-info-cell">
                    <button v-if="item.asset_name" type="button" class="asset-name-link" :title="item.asset_name"
                      @click="openAssetPreview(item)">{{ item.asset_name }}</button>
                    <span v-else class="asset-name-placeholder" aria-hidden="true"></span>
                    <span class="asset-transaction-id" :title="item.transaction?.transaction_id || ''">
                      交易 ID：{{ item.transaction?.transaction_id || '' }}
                    </span>
                  </div>
                </td>
                <td>
                  <div class="single-action-cell">
                    <el-button type="primary" link @click="openContractPreview(item)">查看合约</el-button>
                  </div>
                </td>
                <td>
                  <span class="delivery-status-text">{{ getBuyerDeliveryStatusText(item) }}</span>
                </td>
                <td class="buyer-action-col">
                  <div class="buyer-actions buyer-actions--inline">
                    <el-button
                      type="primary"
                      class="delivery-action-button"
                      @click="openDeliveryDetail(item)"
                    >查看详情</el-button>
                    <el-button
                      v-if="isHeOrder(item)"
                      type="primary"
                      class="delivery-action-button app-primary-action"
                      :loading="actionLoadingNo === `buyer-he-${item.order_no}`"
                      :disabled="isDeliveryExpired(item) || Boolean(item.he_record?.public_keys_ready) || actionLoadingNo === `buyer-he-${item.order_no}`"
                      @click="submitHeBuyerRequest(item)"
                    >{{ item.he_record?.public_keys_ready ? '已请求' : '请求交付' }}</el-button>
                    <el-button
                      v-if="isHeOrder(item)"
                      type="primary"
                      class="delivery-action-button app-primary-action"
                      :loading="actionLoadingNo === `download-${item.order_no}`"
                      :disabled="!canDownloadHeResult(item) || actionLoadingNo === `download-${item.order_no}`"
                      @click="downloadBuyerResult(item)"
                    >下载结果</el-button>
                    <el-button
                      v-if="isFlOrder(item)"
                      type="primary"
                      class="delivery-action-button app-primary-action"
                      :loading="flBuyerDialog.submitting && flBuyerDialog.order?.order_no === item.order_no"
                      :disabled="isDeliveryExpired(item) || Boolean(item.fl_record?.pcp_contract_id)"
                      @click="openBuyerDelivery(item)"
                    >{{ getBuyerFlActionLabel(item) }}</el-button>
                    <el-button
                      v-if="isFlOrder(item)"
                      type="primary"
                      class="delivery-action-button app-primary-action"
                      :loading="actionLoadingNo === `download-${item.order_no}`"
                      :disabled="!canDownloadFlBuyerResult(item) || actionLoadingNo === `download-${item.order_no}`"
                      @click="downloadBuyerResult(item)"
                    >下载结果</el-button>
                    <el-button
                      v-if="isPreOrder(item)"
                      type="primary"
                      class="delivery-action-button app-primary-action"
                      :loading="actionLoadingNo === `buyer-pre-${item.order_no}`"
                      :disabled="isDeliveryExpired(item) || Boolean(item.pre_record?.buyer_public_key_ready) || actionLoadingNo === `buyer-pre-${item.order_no}`"
                      @click="submitPreBuyerRequest(item)"
                    >{{ item.pre_record?.buyer_public_key_ready ? '已请求' : '请求交付' }}</el-button>
                    <el-button
                      v-if="isPreOrder(item)"
                      type="primary"
                      class="delivery-action-button app-primary-action"
                      :loading="actionLoadingNo === `download-${item.order_no}`"
                      :disabled="!canDownloadPreResult(item) || actionLoadingNo === `download-${item.order_no}`"
                      @click="downloadBuyerResult(item)"
                    >下载结果</el-button>
                    <el-button
                      v-if="isMpcOrder(item)"
                      type="primary"
                      class="delivery-action-button app-primary-action"
                      :loading="mpcBuyerDialog.submitting && mpcBuyerDialog.order?.order_no === item.order_no"
                      :disabled="!canTriggerMpcBuyerAction(item)"
                      @click="openBuyerDelivery(item)"
                    >{{ getBuyerMpcActionLabel(item) }}</el-button>
                    <el-button
                      v-if="isMpcOrder(item)"
                      type="primary"
                      class="delivery-action-button app-primary-action"
                      :loading="actionLoadingNo === `download-${item.order_no}`"
                      :disabled="!canDownloadMpcResult(item) || actionLoadingNo === `download-${item.order_no}`"
                      @click="downloadBuyerResult(item)"
                    >查看结果</el-button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <el-empty v-else description="暂无可用下载资源" />
        </div>
      </section>
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
    </div>
  </div>

  <el-dialog v-model="assetPreviewVisible" title="资产信息" width="min(640px, 92vw)">
    <div v-loading="assetPreviewLoading" class="asset-preview">
      <el-alert v-if="assetPreviewError" :title="assetPreviewError" type="error" :closable="false" />
      <template v-else-if="assetPreviewDetail">
        <img class="asset-preview-cover" :src="assetPreviewCover" :alt="assetPreviewDetail.asset_name || '资产图片'"
          @error="assetPreviewCover = defaultCover" />
        <h3 class="asset-preview-name">{{ assetPreviewDetail.asset_name || '未命名资产' }}</h3>
        <p class="asset-preview-meta">
          {{ assetPreviewDetail.category_name || '未分类' }}
          <span aria-hidden="true">/</span>
          {{ assetPreviewDetail.classification_data_level || '一般数据' }}
        </p>
        <div class="asset-preview-description">
          <div class="asset-preview-label">详细描述</div>
          <p>{{ assetPreviewDetail.description || '暂无详细描述' }}</p>
        </div>
      </template>
    </div>
    <template #footer><el-button @click="assetPreviewVisible = false">关闭</el-button></template>
  </el-dialog>

  <el-dialog v-model="contractPreviewVisible" title="数字合约信息" width="720px">
    <DigitalContractPreview v-if="selectedOrder && contractPreviewVisible" :key="selectedOrder.order_no" :order-no="selectedOrder.order_no" role="buyer" />
    <div v-if="selectedOrder" class="dialog-block">
      <div class="dialog-grid">
        <div class="dialog-item"><span>订单号</span><strong>{{ selectedOrder.order_no }}</strong></div>
        <div class="dialog-item"><span>合约名称</span><strong>{{ selectedOrder.digital_contract?.contract_name || '-' }}</strong></div>
        <div class="dialog-item"><span>产品名称</span><strong>{{ selectedOrder.digital_contract?.product_name || selectedOrder.asset_name || '-' }}</strong></div>
        <div class="dialog-item"><span>交付方式</span><strong>{{ pcTypeText(selectedOrder.digital_contract?.pc_type) }}</strong></div>
        <div class="dialog-item"><span>处理类型</span><strong>{{ selectedOrder.digital_contract?.processing_type || tradeModeText(selectedOrder.trade_mode) }}</strong></div>
        <div class="dialog-item"><span>可执行操作</span><strong>{{ selectedOrder.digital_contract?.operations || operationText(selectedOrder.trade_mode) }}</strong></div>
        <div class="dialog-item"><span>数量限制</span><strong>{{ selectedOrder.digital_contract?.quantity_limit || selectedOrder.buy_qty || '-' }}</strong></div>
        <div class="dialog-item"><span>交付次数</span><strong>{{ selectedOrder.transaction?.delivery_limit ?? 1 }}</strong></div>
        <div class="dialog-item full"><span>到期时间</span><strong>{{ selectedOrder.digital_contract?.expiration_time || '-' }}</strong></div>
        <div class="dialog-item full"><span>合约描述</span><strong>{{ selectedOrder.digital_contract?.contract_description || '暂无说明' }}</strong></div>
      </div>
    </div>
    <template #footer>
      <el-button @click="contractPreviewVisible = false">关闭</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="genericDetailVisible" title="交付详情" width="min(560px, 92vw)">
    <div v-if="genericDetail" class="dialog-body">
      <div class="dialog-row"><span class="dialog-label">订单号</span><span class="dialog-value">{{ genericDetail.orderNo }}</span></div>
      <div class="dialog-row"><span class="dialog-label">资产名称</span><span class="dialog-value">{{ genericDetail.assetName }}</span></div>
      <div class="dialog-row"><span class="dialog-label">交易ID</span><span class="dialog-value">{{ genericDetail.transactionId }}</span></div>
      <div class="dialog-row"><span class="dialog-label">交付方式</span><span>{{ genericDetail.method }}</span></div>
      <div class="dialog-row"><span class="dialog-label">当前状态</span><span>{{ genericDetail.status }}</span></div>
      <div class="dialog-row"><span class="dialog-label">交付记录</span><span class="dialog-value">{{ genericDetail.reference || '暂无交付记录' }}</span></div>
      <div v-if="genericDetail.error" class="dialog-row"><span class="dialog-label">异常说明</span><span class="dialog-value">{{ genericDetail.error }}</span></div>
    </div>
    <template #footer><el-button @click="genericDetailVisible = false">关闭</el-button></template>
  </el-dialog>

  <el-dialog v-model="historyDialogVisible" title="交付详情" width="700px">
    <div v-if="selectedOrder" class="dialog-block">
      <div class="dialog-grid">
        <div class="dialog-item"><span>订单号</span><strong>{{ selectedOrder.order_no }}</strong></div>
        <div class="dialog-item"><span>交易ID</span><strong>{{ selectedOrder.transaction?.transaction_id || '-' }}</strong></div>
        <div class="dialog-item"><span>交付状态</span><strong>{{ deliveryProgressText(selectedOrder) }}</strong></div>
        <div class="dialog-item"><span>隐私状态</span><strong>{{ privacyStatusText(selectedOrder) }}</strong></div>
      </div>

      <div class="history-box">
        <div class="history-title">交付记录</div>
        <div v-if="selectedOrder.delivery_history?.length" class="history-list">
          <div v-for="history in selectedOrder.delivery_history" :key="history.id || history.delivery_index" class="history-row">
            <div class="history-index">#{{ history.delivery_index || '-' }}</div>
            <div class="history-content">
              <div class="history-main">
                <strong>{{ history.delivery_type || '-' }}</strong>
                <span>{{ history.result_status || '-' }}</span>
                <span>{{ history.delivered_at || '-' }}</span>
              </div>
              <div class="history-note">{{ history.delivery_message || '无附加说明' }}</div>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无交付记录" />
      </div>
    </div>
    <template #footer>
      <el-button @click="historyDialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="flBuyerDialog.visible" title="请求交付" width="620px">
    <el-form label-width="130px">
      <el-form-item label="交易ID"><el-input :model-value="flBuyerDialog.order?.transaction?.transaction_id || ''" disabled /></el-form-item>
      <el-form-item label="顶层模型初始包">
        <input ref="flTopInput" type="file" accept=".zip,application/zip" @change="onFlBuyerFileChange('topModelFile', $event)" />
        <div v-if="flBuyerDialog.topModelFile" class="selected-file-name">{{ flBuyerDialog.topModelFile.name }}</div>
      </el-form-item>
      <el-form-item label="底层模型初始包">
        <input ref="flBottomInput" type="file" accept=".zip,application/zip" @change="onFlBuyerFileChange('bottomModelFile', $event)" />
        <div v-if="flBuyerDialog.bottomModelFile" class="selected-file-name">{{ flBuyerDialog.bottomModelFile.name }}</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="flBuyerDialog.visible = false">取消</el-button>
      <el-button type="primary" class="app-primary-action" :loading="flBuyerDialog.submitting" :disabled="!flBuyerDialog.order || isDeliveryExpired(flBuyerDialog.order)" @click="submitFlBuyerRequest">请求交付</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="mpcBuyerDialog.visible" title="请求交付" width="520px">
    <el-form label-width="110px">
      <el-form-item label="交易ID"><el-input :model-value="mpcBuyerDialog.order?.transaction?.transaction_id || ''" disabled /></el-form-item>
      <el-form-item label="目标阈值"><el-input-number v-model="mpcBuyerDialog.threshold" :min="0" style="width: 100%" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="mpcBuyerDialog.visible = false">取消</el-button>
      <el-button type="primary" class="app-primary-action" :loading="mpcBuyerDialog.submitting" :disabled="!mpcBuyerDialog.order || isDeliveryExpired(mpcBuyerDialog.order)" @click="submitMpcBuyerRequest">请求交付</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="heDecryptDialog.visible" title="下载交付结果" width="560px">
    <el-form label-width="110px">
      <el-form-item label="交易ID"><el-input :model-value="heDecryptDialog.order?.transaction?.transaction_id || ''" disabled /></el-form-item>
      <el-form-item label="交付算法">
        <div class="he-key-hint">
          <span>{{ heDecryptAlgorithmText }}</span>
          <span class="he-key-hint__file">{{ heDecryptKeyHint }}</span>
        </div>
      </el-form-item>
      <el-form-item label="解密文件">
        <input ref="hePrivateKeyInput" type="file" accept=".json" @change="onHePrivateKeyChange" />
        <div v-if="heDecryptDialog.privateKeyFile" class="selected-file-name">
          {{ heDecryptDialog.privateKeyFile.name }}
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="heDecryptDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="heDecryptDialog.processing" :disabled="!heDecryptDialog.order || isDeliveryExpired(heDecryptDialog.order)" @click="confirmHeDecryptResult">解密并下载</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="preDecryptDialog.visible" title="下载交付结果" width="560px">
    <el-form label-width="110px">
      <el-form-item label="交易ID"><el-input :model-value="preDecryptDialog.order?.transaction?.transaction_id || ''" disabled /></el-form-item>
      <el-form-item label="PRE私钥">
        <input ref="prePrivateKeyInput" type="file" accept=".json" @change="onPrePrivateKeyChange" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="preDecryptDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="preDecryptDialog.processing" :disabled="!preDecryptDialog.order || isDeliveryExpired(preDecryptDialog.order)" @click="confirmPreDecryptResult">解密并下载</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="flDecryptDialog.visible" title="下载交付结果" width="560px">
    <el-form label-width="110px">
      <el-form-item label="交易ID"><el-input :model-value="flDecryptDialog.order?.transaction?.transaction_id || ''" disabled /></el-form-item>
      <el-form-item label="FL私钥">
        <input ref="flPrivateKeyInput" type="file" accept=".json" @change="onFlPrivateKeyChange" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="flDecryptDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="flDecryptDialog.processing" :disabled="!flDecryptDialog.order || isDeliveryExpired(flDecryptDialog.order)" @click="confirmFlDecryptResult">解密并下载</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="mpcResultDialog.visible" title="计算结果" width="720px">
    <div v-if="mpcResultDialog.order && mpcResultDialog.result" class="dialog-body">
      <div class="dialog-row">
        <span class="dialog-label">目标阈值</span>
        <span>{{ formatMpcThreshold(mpcResultDialog.order) }}</span>
      </div>
      <div class="dialog-row">
        <span class="dialog-label">统计摘要</span>
        <span>{{ formatMpcQualifiedCount(mpcResultDialog.result) }}</span>
      </div>
      <div class="dialog-row" v-if="mpcResultDialog.order.mpc_record?.audit_mode === 'MPC_COMPOSITE'">
        <span class="dialog-label">多节点审计</span>
        <span>{{ mpcResultDialog.order.mpc_record?.consensus_result || '等待共识' }}（{{ mpcResultDialog.order.mpc_record?.passed_nodes || 0 }} / {{ mpcResultDialog.order.mpc_record?.responded_nodes || 0 }} 节点通过）</span>
      </div>
      <el-table
        v-if="Array.isArray(mpcResultDialog.result.user_results)"
        :data="mpcResultDialog.result.user_results"
        border
        size="small"
        style="width: 100%"
      >
        <el-table-column prop="user_id" label="用户ID" min-width="220" />
        <el-table-column :prop="mpcResultDialog.order?.mpc_record?.audit_mode === 'MPC_COMPOSITE' ? 'y' : 'total_assets'" :label="mpcResultDialog.order?.mpc_record?.audit_mode === 'MPC_COMPOSITE' ? '计算结果 y' : '汇总资产'" min-width="140" />
        <el-table-column label="是否达标" min-width="120">
          <template #default="{ row }">
            {{ getMpcResultText(row.is_qualified) }}
          </template>
        </el-table-column>
      </el-table>
      <div class="dialog-hint compact-hint">
        <span>按原型计算 y = (a + b) × c，审计通过后可查看结果。</span>
      </div>
    </div>
    <template #footer>
      <el-button @click="mpcResultDialog.visible = false">关闭</el-button>
    </template>
  </el-dialog>

</template>

<script lang="ts" setup>
import DigitalContractPreview from '@/components/DigitalContractPreview.vue'
import { mapMpcAuditJob } from '@/utils/mpcAudit'
// 买家交付页：对应原始系统 frontend/src/views/DeliveryBuyer2.vue。
// index.vue 只做角色分发，本文件只保留买家“数字资产下载/请求交付”视角。
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import {
  createFlPrivacyContract,
  createMpcAudit,
  getMpcAuditStatus,
  getMpcAuditResult,
  getMpcPrivacyResult,
  uploadMpcAuditData,
  submitMpcAudit,
  decryptPrePrivacyResult,
  downloadDeliveryResult,
  downloadFlPrivacyResult,
  downloadHePrivacyResult,
  downloadPrePrivacyResult,
  getAssetDetail,
  getDeliveryExportEligible,
  getFlStatus,
  getHePublicKeyStatus,
  getHeStatus,
  getMpcStatus,
  getOrderList,
  getPreStatus,
  joinFlPrivacyContract,
  requestSecureDelivery,
  saveOrderContract,
  sellerDeliver,
  submitFlPrivacyBatch,
  submitHePrivacyDelivery,
  submitPrePrivacyDelivery,
  uploadHePublicKeys,
  uploadPreBuyerPublicKey,
} from '@/api/asset'
import { getRoleKey, parseTokenPayload } from '@/utils/auth'
import defaultCover from '@/assets/logo.svg'
import * as heCryptoModule from '@/utils/heCrypto.js'
import * as flCryptoModule from '@/utils/flCrypto.js'
import * as preCryptoModule from '@/utils/preCrypto.js'
import * as heCsvModule from '@/utils/heCsv.js'

const heCrypto = (heCryptoModule as any)['default'] || (heCryptoModule as any)
const flCrypto = (flCryptoModule as any)['default'] || (flCryptoModule as any)
const preCrypto = (preCryptoModule as any)['default'] || (preCryptoModule as any)
const heCsv = (heCsvModule as any)['default'] || (heCsvModule as any)

interface NestedRecord { [key: string]: any }
interface OrderItem {
  id: number
  order_no: string
  asset_id?: number
  asset_name?: string
  buyer_account?: string
  buyer_address?: string
  pc_type?: string
  expiration_time?: string
  buy_qty?: number
  trade_mode?: string
  order_status: number
  transaction?: NestedRecord | null
  digital_contract?: NestedRecord | null
  latest_delivery_request?: NestedRecord | null
  delivery_history?: NestedRecord[]
  he_record?: NestedRecord | null
  pre_record?: NestedRecord | null
  fl_record?: NestedRecord | null
  mpc_record?: NestedRecord | null
}

const route = useRoute()
const tokenPayload = parseTokenPayload() || {}
const roleKey = 'buyer'
const currentOrderNo = ref(String(route.query.order_no || ''))
const assetPreviewVisible = ref(false)
const assetPreviewLoading = ref(false)
const assetPreviewError = ref('')
const assetPreviewDetail = ref<NestedRecord | null>(null)
const assetPreviewCover = ref(defaultCover)
let assetPreviewRequestId = 0

const openAssetPreview = async (order: OrderItem) => {
  const requestId = ++assetPreviewRequestId
  assetPreviewVisible.value = true
  assetPreviewLoading.value = true
  assetPreviewError.value = ''
  assetPreviewDetail.value = null
  assetPreviewCover.value = defaultCover
  try {
    if (!order.asset_id) throw new Error('订单缺少资产 ID')
    const res = await getAssetDetail(order.asset_id)
    if (res.data.status !== 0 || !res.data.data) {
      throw new Error(res.data.message || '获取资产信息失败')
    }
    if (requestId !== assetPreviewRequestId || !assetPreviewVisible.value) return
    const detail = res.data.data
    assetPreviewDetail.value = detail
    if (detail.file_hash && /^[A-Za-z0-9._~-]{1,255}$/.test(detail.file_hash)) {
      assetPreviewCover.value = `/api/asset-picture/${encodeURIComponent(detail.file_hash)}`
    } else if (detail.picture) {
      assetPreviewCover.value = `data:${detail.picture_mime_type || 'image/jpeg'};base64,${detail.picture}`
    }
  } catch (error: any) {
    if (requestId === assetPreviewRequestId && assetPreviewVisible.value) {
      assetPreviewError.value = error?.response?.data?.message || error?.message || '获取资产信息失败'
    }
  } finally {
    if (requestId === assetPreviewRequestId) assetPreviewLoading.value = false
  }
}
const searchInput = ref('')
const activeKeyword = ref('')
const activeTab = ref('assetDownload')

const loading = ref(false)
const orders = ref<OrderItem[]>([])
const actionLoadingNo = ref('')
const statusPolling = ref(false)
const pagination = reactive({ page: 1, page_size: 10, total: 0 })
const query = reactive({ page: 1, page_size: 10 })
const deliveryFilterOptions = [
  { label: '全部', value: 'all' },
  { label: '待申请交付', value: 'buyer_request' },
  { label: '等待卖家交付', value: 'buyer_waiting' },
  { label: '结果可下载', value: 'buyer_download' },
]
const selectedDeliveryState = ref('all')
const onDeliveryFilterChange = (state: string) => {
  if (selectedDeliveryState.value === state) return
  selectedDeliveryState.value = state
  query.page = 1
  fetchOrders()
}
const STATUS_POLL_INTERVAL_MS = 30000
let statusPollTimer: ReturnType<typeof window.setInterval> | null = null

const selectedOrder = ref<OrderItem | null>(null)
const contractPreviewVisible = ref(false)
const contractDialogVisible = ref(false)
const contractSubmitting = ref(false)
const historyDialogVisible = ref(false)
const genericDetailVisible = ref(false)
const genericDetail = ref<{
  orderNo: string
  assetName: string
  transactionId: string
  method: string
  status: string
  reference: string
  error: string
} | null>(null)
const requestDialogVisible = ref(false)
const requestSubmitting = ref(false)
const requestTargetOrder = ref<OrderItem | null>(null)

const contractForm = reactive({
  order_no: '',
  contract_name: '',
  product_name: '',
  contract_description: '',
  operations: '',
  expiration_time: '',
  quantity_limit: 1,
  processing_type: '',
  pc_type: '',
  delivery_limit: 1,
})
const requestForm = reactive({
  order_no: '',
  transaction_id: '',
  vm_name: '',
  vm_cpu: 2,
  vm_memory_mb: 2048,
})

const heSellerDialog = reactive({
  visible: false,
  submitting: false,
  order: null as OrderItem | null,
  operation: 'ADD',
  file1: null as File | null,
  file2: null as File | null,
})
const preSellerDialog = reactive({
  visible: false,
  submitting: false,
  order: null as OrderItem | null,
  file: null as File | null,
})
const flBuyerDialog = reactive({
  visible: false,
  submitting: false,
  order: null as OrderItem | null,
  topModelFile: null as File | null,
  bottomModelFile: null as File | null,
})
const flSellerDialog = reactive({
  visible: false,
  submitting: false,
  order: null as OrderItem | null,
  file: null as File | null,
})
const mpcBuyerDialog = reactive({
  visible: false,
  submitting: false,
  order: null as OrderItem | null,
  threshold: 100000,
})
const mpcSellerDialog = reactive({
  visible: false,
  submitting: false,
  order: null as OrderItem | null,
  files: [] as File[],
})
const heDecryptDialog = reactive({
  visible: false,
  processing: false,
  order: null as OrderItem | null,
  encryptedText: '',
  algorithm: '',
  privateKeyFile: null as File | null,
})
const preDecryptDialog = reactive({
  visible: false,
  processing: false,
  order: null as OrderItem | null,
  encryptedBlob: null as Blob | null,
  privateKeyFile: null as File | null,
})
const flDecryptDialog = reactive({
  visible: false,
  processing: false,
  order: null as OrderItem | null,
  encryptedBlob: null as Blob | null,
  privateKeyFile: null as File | null,
  resultRole: 'fl_top_model',
})
const mpcResultDialog = reactive({
  visible: false,
  order: null as OrderItem | null,
  result: null as NestedRecord | null,
})

const showSellerPanel = computed(() => false)
const showBuyerPanel = computed(() => true)
const showRoleTabs = computed(() => false)

const sellerRows = computed(() => orders.value)
const buyerRows = computed(() => orders.value)

const tradeModeText = (mode?: string) => ({ ownership: '所有权', view: '查阅权', process: '加工权' }[mode || ''] || mode || '-')
const operationText = (mode?: string) => ({ ownership: '所有', view: '查阅权', process: '加工权' }[mode || ''] || mode || '-')
const pcTypeText = (pcType?: string) => {
  const value = String(pcType || '').toUpperCase()
  const labelMap: Record<string, string> = {
    HE: '同态加密 HE',
    PRE: '代理重加密 PRE',
    FL: '联邦学习 FL',
    MPC: '多方安全计算 MPC',
    TEE: '可信执行环境 TEE',
  }
  return labelMap[value] || value || '-'
}
const normalizeHeAlgorithm = (algorithm?: string) => {
  const value = String(algorithm || '').trim().toLowerCase()
  if (value === 'elgamal' || value === 'el-gamal') return 'ElGamal'
  if (value === 'paillier') return 'Paillier'
  return ''
}
const heDecryptAlgorithmText = computed(() => {
  const algorithm = normalizeHeAlgorithm(heDecryptDialog.algorithm || heDecryptDialog.order?.he_record?.selected_enc_type)
  if (algorithm === 'ElGamal') return '乘法（ElGamal）'
  if (algorithm === 'Paillier') return '加法（Paillier）'
  const operation = String(heDecryptDialog.order?.he_record?.selected_operation || '').toUpperCase()
  if (operation === 'MUL') return '乘法（ElGamal）'
  if (operation === 'ADD') return '加法（Paillier）'
  return '待确认'
})
const heDecryptKeyHint = computed(() => {
  const text = heDecryptAlgorithmText.value
  if (text.includes('乘法')) return '请选择当前交易的加法乘法解密文件，或旧版乘法私钥文件'
  if (text.includes('加法')) return '请选择当前交易的加法乘法解密文件，或旧版加法私钥文件'
  return '请根据交付算法选择对应解密文件'
})
const privacyStatusText = (order: OrderItem) => {
  const pcType = String(order.digital_contract?.pc_type || '').toUpperCase()
  if (!pcType) return '-'
  if (pcType === 'HE') return order.he_record?.pcp_status || '未发起'
  if (pcType === 'PRE') return order.pre_record?.pcp_status || '未发起'
  if (pcType === 'FL') return order.fl_record?.pcp_status || '未发起'
  if (pcType === 'MPC') return order.mpc_record?.task_status || '未发起'
  if (pcType === 'TEE') return order.latest_delivery_request?.status || '未发起'
  return '未知'
}

const normalizedDeliveryStatusText = (order: OrderItem) => {
  const pcType = getPcType(order)
  const status = String(
    pcType === 'HE' ? order.he_record?.pcp_status
      : pcType === 'PRE' ? order.pre_record?.pcp_status
        : pcType === 'FL' ? order.fl_record?.pcp_status
          : pcType === 'MPC' ? order.mpc_record?.task_status
            : order.latest_delivery_request?.status
  || '').toUpperCase()

  if (pcType === 'MPC' && order.mpc_record?.audit_mode === 'MPC_COMPOSITE') {
    const audit = String(order.mpc_record.audit_status || '').toUpperCase()
    if (['AUDIT_FAILED', 'AUDIT_TIMEOUT', 'FAILED'].includes(audit)) return '交付失败'
    if (audit === 'AUDIT_PENDING' || audit === 'SUBMITTING') return '审计中'
    if (audit === 'AUDIT_PASSED') return '已完成'
    if (audit === 'DATA_READY') return '待提交审计'
    if (audit === 'CREATED') return '待卖方交付'
  }
  if (['FAILED', 'AUDIT_FAILED', 'PAM_FAILED', 'REJECTED'].includes(status)) return '交付失败'
  if (pcType === 'FL' && status === 'WAITING_EPOCH_INPUT' && order.fl_record?.last_error) return '提交失败'
  if (['PAMING'].includes(status)) return '审计中'
  if (status === 'PAM_PASSED' && !(
    pcType === 'HE' ? order.he_record?.result_ready :
      pcType === 'PRE' ? order.pre_record?.result_ready :
        pcType === 'FL' ? order.fl_record?.buyer_result_ready : true
  )) return '结果准备中'
  if (['QUEUED', 'RUNNING', 'COMPUTED', 'READY', 'COMPUTING'].includes(status)) return '计算中'
  if (['COMPLETED', 'PAM_PASSED', 'DONE', 'SUCCESS'].includes(status) || Number(order.order_status) === 3) return '已完成'
  if (['CREATED', 'WAITING_INPUT', 'WAITING_EPOCH_INPUT', 'JOINED', 'PENDING', 'BUYER_REQUESTED'].includes(status)) return '待卖方交付'
  if (Number(order.order_status) === 0) return '待买方申请'
  if (Number(order.order_status) === 1) return '待买方申请'
  if (Number(order.order_status) === 2) return '待买方申请'
  return '待买方申请'
}

const deliveryProgressText = (order: OrderItem) => {
  return normalizedDeliveryStatusText(order)
}

const getBuyerDeliveryStatusText = (order: OrderItem) => {
  return normalizedDeliveryStatusText(order)
}

const buyerRequestStatusText = (order: OrderItem) => {
  const status = String(order.latest_delivery_request?.status || '').toUpperCase()
  if (!status) return '待买方申请'
  if (status === 'PENDING' || status === 'BUYER_REQUESTED') return '待卖方交付'
  if (status === 'APPROVED') return '待卖方交付'
  if (status === 'REJECTED' || status === 'FAILED') return '交付失败'
  if (status === 'RUNNING') return '计算中'
  if (status === 'COMPLETED') return '已完成'
  return normalizedDeliveryStatusText(order)
}

const buyerRequestStatusClass = (order: OrderItem) => {
  const status = String(order.latest_delivery_request?.status || '').toUpperCase()
  if (!status) return 'is-none'
  if (status === 'PENDING' || status === 'BUYER_REQUESTED') return 'is-pending'
  if (status === 'APPROVED') return 'is-approved'
  if (status === 'REJECTED') return 'is-rejected'
  return 'is-pending'
}

const getRequestStatusCode = (order: OrderItem) => String(order.latest_delivery_request?.status || '').toUpperCase()
const getBuyerRequestButtonText = (order: OrderItem) => {
  const pcType = getPcType(order)
  if (pcType === 'HE') return order.he_record?.public_keys_ready ? '已请求' : '请求交付'
  if (pcType === 'PRE') return order.pre_record?.buyer_public_key_ready ? '已请求' : '请求交付'
  if (pcType === 'FL') return order.fl_record?.pcp_contract_id ? '已请求' : '请求交付'
  if (pcType === 'MPC') return order.mpc_record?.remote_task_id ? '已请求' : '请求交付'
  const status = getRequestStatusCode(order)
  if (status === 'PENDING') return '已申请'
  if (status === 'RUNNING') return '交付中'
  if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'APPROVED') return '已完成'
  return order.transaction?.can_download ? '再次申请交付' : '请求交付'
}
const isBuyerRequestDisabled = (order: OrderItem) => {
  const pcType = getPcType(order)
  if (pcType === 'HE') return Boolean(order.he_record?.public_keys_ready)
  if (pcType === 'PRE') return Boolean(order.pre_record?.buyer_public_key_ready)
  if (pcType === 'FL') return Boolean(order.fl_record?.pcp_contract_id)
  if (pcType === 'MPC') return Boolean(order.mpc_record?.remote_task_id)
  return getRequestStatusCode(order) === 'PENDING'
}

const hasPrivacyTask = (order: OrderItem) => Boolean(order.transaction?.transaction_id && order.digital_contract?.pc_type)
const canConfigureContract = (order: OrderItem) => roleKey !== 'buyer' && [1, 2].includes(Number(order.order_status))
const canSellerDeliver = (order: OrderItem) => roleKey !== 'buyer' && Number(order.order_status) === 1
const getPcType = (order: OrderItem) => String(order.digital_contract?.pc_type || order.transaction?.pc_type || order.pc_type || '').toUpperCase()
const getTransactionId = (order: OrderItem) => String(order.transaction?.transaction_id || '').trim()
const deliveryDetailRecord = (order: OrderItem) => {
  const pcType = getPcType(order)
  if (pcType === 'HE') return order.he_record
  if (pcType === 'FL') return order.fl_record
  if (pcType === 'PRE') return order.pre_record
  if (pcType === 'MPC') return order.mpc_record
  return null
}
const openDeliveryDetail = (order: OrderItem) => {
  if (getPcType(order) === 'TEE') return openHistoryDialog(order)
  const record = deliveryDetailRecord(order)
  genericDetail.value = {
    orderNo: order.order_no || '-',
    assetName: order.asset_name || '-',
    transactionId: getTransactionId(order) || '-',
    method: ({ HE: '同态加密', PRE: '代理重加密', FL: '联邦学习', MPC: '多方安全计算' } as Record<string, string>)[getPcType(order)] || pcTypeText(getPcType(order)),
    status: getBuyerDeliveryStatusText(order),
    reference: String(getPcType(order) === 'MPC' ? record?.remote_task_id || '' : record?.pcp_contract_id || record?.current_attempt_id || ''),
    error: String(record?.last_error || ''),
  }
  genericDetailVisible.value = true
}
const isDeliveryExpired = (order: OrderItem) => {
  const value = order.transaction?.expiration_time || order.digital_contract?.expiration_time || order.expiration_time
  if (!value) return false
  const timestamp = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isFinite(timestamp) && timestamp <= Date.now()
}
const ensureDeliveryActive = (order: OrderItem) => {
  if (!isDeliveryExpired(order)) return true
  ElMessage.warning('数字合约已过期，不能继续交付或下载结果')
  return false
}
const isPrivacyPc = (order: OrderItem) => ['HE', 'PRE', 'FL', 'MPC'].includes(getPcType(order))
const extractPrivacyRecord = (res: any) => res?.data?.item || res?.data?.data?.item || res?.data?.data || null
const isHeOrder = (order: OrderItem) => getPcType(order) === 'HE'
const isPreOrder = (order: OrderItem) => getPcType(order) === 'PRE'
const isFlOrder = (order: OrderItem) => getPcType(order) === 'FL'
const isMpcOrder = (order: OrderItem) => getPcType(order) === 'MPC'

const sellerActionText = (order: OrderItem) => (isPrivacyPc(order) ? '执行交付' : '卖家交付')

const isCompletedPcpStatus = (status?: string) => ['PAM_PASSED', 'COMPLETED'].includes(String(status || '').toUpperCase())
const canDownloadHeResult = (order: OrderItem) => !isDeliveryExpired(order) && isCompletedPcpStatus(order.he_record?.pcp_status) && Boolean(order.he_record?.result_ready)
const canDownloadPreResult = (order: OrderItem) => !isDeliveryExpired(order) && isCompletedPcpStatus(order.pre_record?.pcp_status) && Boolean(order.pre_record?.result_ready)
const canDownloadFlBuyerResult = (order: OrderItem) => Boolean(
  !isDeliveryExpired(order) && isCompletedPcpStatus(order.fl_record?.pcp_status) && order.fl_record?.buyer_result_ready
)
const canDownloadMpcResult = (order: OrderItem) => !isDeliveryExpired(order) && String(order.mpc_record?.task_status || '').toLowerCase() === 'done'
const getBuyerFlActionLabel = (order: OrderItem) => {
  if (order.fl_record?.pcp_contract_id) return '已请求'
  return '请求交付'
}
const getBuyerMpcActionLabel = (order: OrderItem) => {
  if (String(order.mpc_record?.task_status || '').toLowerCase() === 'failed') return '请求交付'
  if (order.mpc_record?.remote_task_id) return '已请求'
  return '请求交付'
}
const canTriggerMpcBuyerAction = (order: OrderItem) => {
  const status = String(order.mpc_record?.task_status || '').toLowerCase()
  if (order.mpc_record?.remote_task_id && status !== 'failed') return false
  return !isDeliveryExpired(order) && Boolean(getTransactionId(order))
}
const canDownloadBuyerPrivacyResult = (order: OrderItem) => {
  const pcType = getPcType(order)
  if (pcType === 'HE') return canDownloadHeResult(order)
  if (pcType === 'PRE') return canDownloadPreResult(order)
  if (pcType === 'FL') return canDownloadFlBuyerResult(order)
  if (pcType === 'MPC') return canDownloadMpcResult(order)
  return Boolean(order.transaction?.can_download)
}

const syncOrderPrivacyStatus = async (order: OrderItem, silent = true) => {
  const transactionId = getTransactionId(order)
  if (!transactionId || isDeliveryExpired(order)) return
  const pcType = getPcType(order)
  try {
    if (pcType === 'HE') {
      const res: any = await getHeStatus(transactionId)
      order.he_record = res?.data?.item || res?.data?.data?.item || order.he_record || null
    } else if (pcType === 'PRE') {
      const res: any = await getPreStatus(transactionId)
      order.pre_record = res?.data?.item || res?.data?.data?.item || order.pre_record || null
    } else if (pcType === 'FL') {
      const res: any = await getFlStatus(transactionId, { entityId: order.transaction?.buyer_address || order.buyer_address || '' })
      order.fl_record = res?.data?.item || res?.data?.data?.item || order.fl_record || null
    } else if (pcType === 'MPC') {
      try {
        const res: any = await getMpcAuditStatus(transactionId)
        order.mpc_record = mapMpcAuditJob(res?.data?.data) || order.mpc_record || null
      } catch (auditError: any) {
        if (auditError?.response?.status !== 404) throw auditError
        // 迁移前已经创建的 GC 任务仍按旧记录展示。
        const res: any = await getMpcStatus(transactionId)
        order.mpc_record = extractPrivacyRecord(res) || order.mpc_record || null
      }
    }
  } catch (error: any) {
    if (!silent) ElMessage.error(error?.response?.data?.message || error?.message || '状态同步失败')
  }
}

const openBuyerDelivery = async (order: OrderItem) => {
  if (!ensureDeliveryActive(order)) return
  const pcType = getPcType(order)
  if (pcType === 'HE') return submitHeBuyerRequest(order)
  if (pcType === 'PRE') return submitPreBuyerRequest(order)
  if (pcType === 'FL') {
    await syncOrderPrivacyStatus(order, true)
    if (order.fl_record?.pcp_contract_id) return ElMessage.warning('当前交易已请求交付，请勿重复请求')
    flBuyerDialog.visible = true
    flBuyerDialog.order = order
    flBuyerDialog.topModelFile = null
    flBuyerDialog.bottomModelFile = null
    return
  }
  if (pcType === 'MPC') {
    await syncOrderPrivacyStatus(order, true)
    if (!canTriggerMpcBuyerAction(order)) return ElMessage.warning('当前交易已请求交付，请勿重复请求')
    mpcBuyerDialog.visible = true
    mpcBuyerDialog.order = order
    mpcBuyerDialog.threshold = Number(order.mpc_record?.compute_params?.threshold || 100000)
    return
  }
  openRequestDialog(order)
}

const openSellerDelivery = async (order: OrderItem) => {
  const pcType = getPcType(order)
  if (pcType === 'HE') return openHeSellerDelivery(order)
  if (pcType === 'PRE') return openPreSellerDelivery(order)
  if (pcType === 'FL') return openFlSellerDelivery(order)
  if (pcType === 'MPC') {
    mpcSellerDialog.visible = true
    mpcSellerDialog.order = order
    mpcSellerDialog.files = []
    return
  }
  submitSellerDeliver(order)
}

const submitHeBuyerRequest = async (order: OrderItem) => {
  const transactionId = getTransactionId(order)
  if (!transactionId) return ElMessage.warning('缺少交易ID')
  if (!ensureDeliveryActive(order)) return
  actionLoadingNo.value = `buyer-he-${order.order_no}`
  try {
    await syncOrderPrivacyStatus(order, true)
    if (order.he_record?.public_keys_ready) {
      ElMessage.warning('当前交易已请求交付，请勿重复请求')
      return
    }

    const keyPairs = await heCrypto.generateHeKeyPairs()
    const res: any = await uploadHePublicKeys({
      transactionId,
      ...heCrypto.buildHePublicKeyPayload(keyPairs),
    })
    const savedRecord = extractPrivacyRecord(res)
    if (savedRecord) {
      order.he_record = savedRecord
    } else {
      order.he_record = {
        ...(order.he_record || {}),
        transaction_id: transactionId,
        public_keys_ready: true,
        has_paillier_public_key: true,
        has_elgamal_public_key: true,
        pcp_status: order.he_record?.pcp_status || 'WAITING_INPUT',
      }
    }
    heCrypto.downloadHePrivateKeyBundle({ transactionId, keyPairs })
    await syncOrderPrivacyStatus(order, true)
    ElMessage.success('交付请求已提交，解密文件已下载')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'HE 请求交付失败')
  } finally {
    actionLoadingNo.value = ''
  }
}

const submitPreBuyerRequest = async (order: OrderItem) => {
  const transactionId = getTransactionId(order)
  if (!transactionId) return ElMessage.warning('缺少交易ID')
  if (!ensureDeliveryActive(order)) return
  actionLoadingNo.value = `buyer-pre-${order.order_no}`
  try {
    await syncOrderPrivacyStatus(order, true)
    if (order.pre_record?.buyer_public_key_ready) {
      ElMessage.warning('当前交易已请求交付，请勿重复请求')
      return
    }

    const keyMaterial = await preCrypto.generatePreBuyerKeyPair({ transactionId })
    await uploadPreBuyerPublicKey({
      transactionId,
      buyerPublicKey: keyMaterial.publicKey,
    })
    preCrypto.downloadPrePrivateKeyFile({
      transactionId,
      privateScalarHex: keyMaterial.privateScalarHex,
      publicKey: keyMaterial.publicKey,
    })
    await syncOrderPrivacyStatus(order, true)
    ElMessage.success('PRE 请求已提交，私钥已下载')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'PRE 请求交付失败')
  } finally {
    actionLoadingNo.value = ''
  }
}

const onFlBuyerFileChange = (field: 'topModelFile' | 'bottomModelFile', event: Event) => {
  const target = event.target as HTMLInputElement
  flBuyerDialog[field] = target.files?.[0] || null
  target.value = ''
}

const submitFlBuyerRequest = async () => {
  const order = flBuyerDialog.order
  const transactionId = order ? getTransactionId(order) : ''
  if (!order || !transactionId) return
  if (!ensureDeliveryActive(order)) return
  if (!flBuyerDialog.topModelFile || !flBuyerDialog.bottomModelFile) {
    ElMessage.warning('请先选择顶层模型和底层模型初始包')
    return
  }
  flBuyerDialog.submitting = true
  try {
    await syncOrderPrivacyStatus(order, true)
    if (order.fl_record?.pcp_contract_id) {
      ElMessage.warning('当前交易已请求交付，请勿重复请求')
      flBuyerDialog.visible = false
      return
    }

    const keyMaterial = await flCrypto.generateFlKeyPair()
    const formData = new FormData()
    formData.append('transactionId', transactionId)
    formData.append('sellerIds', String(order.transaction?.seller_address || order.buyer_address || ''))
    formData.append('buyerResultPublicKey', keyMaterial.publicKeyHex)
    formData.append('top_model_initial_package', flBuyerDialog.topModelFile, flBuyerDialog.topModelFile.name)
    formData.append('bottom_model_initial_package', flBuyerDialog.bottomModelFile, flBuyerDialog.bottomModelFile.name)
    const res: any = await createFlPrivacyContract(formData)
    flCrypto.downloadFlPrivateKeyFile({
      role: 'buyer',
      transactionId,
      privateKeyPem: keyMaterial.privateKeyPem,
    })
    order.fl_record = res?.data?.item || order.fl_record
    await syncOrderPrivacyStatus(order, true)
    flBuyerDialog.visible = false
    ElMessage.success(res?.data?.message || 'FL 请求已提交，私钥已下载')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'FL 请求交付失败')
  } finally {
    flBuyerDialog.submitting = false
  }
}

const submitMpcBuyerRequest = async () => {
  const order = mpcBuyerDialog.order
  const transactionId = order ? getTransactionId(order) : ''
  if (!order || !transactionId) return
  if (!ensureDeliveryActive(order)) return
  mpcBuyerDialog.submitting = true
  try {
    await syncOrderPrivacyStatus(order, true)
    if (!canTriggerMpcBuyerAction(order)) {
      ElMessage.warning('当前交易已请求交付，请勿重复请求')
      mpcBuyerDialog.visible = false
      return
    }

    const res: any = await createMpcAudit({
      transactionId,
      threshold: String(mpcBuyerDialog.threshold ?? 0),
    })
    order.mpc_record = mapMpcAuditJob(res?.data?.data) || order.mpc_record
    await syncOrderPrivacyStatus(order, true)
    mpcBuyerDialog.visible = false
    ElMessage.success('MPC 任务已创建，等待卖方提交材料')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'MPC 请求交付失败')
  } finally {
    mpcBuyerDialog.submitting = false
  }
}

const openHeSellerDelivery = async (order: OrderItem) => {
  const transactionId = getTransactionId(order)
  if (!transactionId) return
  try {
    const res: any = await getHePublicKeyStatus(transactionId)
    order.he_record = res?.data?.item || order.he_record || null
    if (!order.he_record?.public_keys_ready) {
      ElMessage.warning('需要买方先请求交付并上传 HE 公钥')
      return
    }
    heSellerDialog.visible = true
    heSellerDialog.order = order
    heSellerDialog.operation = order.he_record?.selected_operation || 'ADD'
    heSellerDialog.file1 = null
    heSellerDialog.file2 = null
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'HE 公钥状态查询失败')
  }
}

const onHeSellerFileChange = (field: 'file1' | 'file2', event: Event) => {
  const target = event.target as HTMLInputElement
  heSellerDialog[field] = target.files?.[0] || null
  target.value = ''
}

const submitHeSellerDelivery = async () => {
  const order = heSellerDialog.order
  const transactionId = order ? getTransactionId(order) : ''
  if (!order || !transactionId) return
  if (!heSellerDialog.file1 || !heSellerDialog.file2) return ElMessage.warning('请先选择两个 CSV 文件')
  heSellerDialog.submitting = true
  actionLoadingNo.value = order.order_no
  try {
    const encType = heSellerDialog.operation === 'MUL' ? 'ElGamal' : 'Paillier'
    const publicKey = heCrypto.selectHePublicKey(order.he_record, encType)
    if (!publicKey) throw new Error(`缺少 ${encType} 公钥`)
    const [file1Text, file2Text] = await Promise.all([heSellerDialog.file1.text(), heSellerDialog.file2.text()])
    const [encryptedFile1Text, encryptedFile2Text] = await Promise.all([
      heCrypto.encryptHeCsv({ algorithm: encType, csvText: file1Text, publicKey }),
      heCrypto.encryptHeCsv({ algorithm: encType, csvText: file2Text, publicKey }),
    ])
    const formData = new FormData()
    formData.append('transactionId', transactionId)
    formData.append('encType', encType)
    formData.append('operation', heSellerDialog.operation)
    formData.append('file1', new Blob([encryptedFile1Text], { type: 'text/csv' }), heSellerDialog.file1.name)
    formData.append('file2', new Blob([encryptedFile2Text], { type: 'text/csv' }), heSellerDialog.file2.name)
    const res: any = await submitHePrivacyDelivery(formData)
    order.he_record = res?.data?.item || order.he_record
    await submitSellerDeliver(order)
    heSellerDialog.visible = false
    ElMessage.success(res?.data?.message || 'HE 交付已提交')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'HE 执行交付失败')
  } finally {
    heSellerDialog.submitting = false
    actionLoadingNo.value = ''
  }
}

const openPreSellerDelivery = async (order: OrderItem) => {
  await syncOrderPrivacyStatus(order, true)
  if (!order.pre_record?.buyer_public_key_ready) return ElMessage.warning('买方尚未提交 PRE 公钥')
  preSellerDialog.visible = true
  preSellerDialog.order = order
  preSellerDialog.file = null
}

const onPreSellerFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  preSellerDialog.file = target.files?.[0] || null
  target.value = ''
}

const submitPreSellerDelivery = async () => {
  const order = preSellerDialog.order
  const transactionId = order ? getTransactionId(order) : ''
  if (!order || !transactionId) return
  if (!preSellerDialog.file) return ElMessage.warning('请先选择原始压缩包')
  preSellerDialog.submitting = true
  actionLoadingNo.value = order.order_no
  try {
    preCrypto.ensureAllowedPreSourceFile(preSellerDialog.file)
    const formData = new FormData()
    formData.append('transactionId', transactionId)
    formData.append('source_archive', preSellerDialog.file, preSellerDialog.file.name)
    const res: any = await submitPrePrivacyDelivery(formData)
    order.pre_record = res?.data?.item || order.pre_record
    await submitSellerDeliver(order)
    preSellerDialog.visible = false
    ElMessage.success(res?.data?.message || 'PRE 交付已提交')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'PRE 执行交付失败')
  } finally {
    preSellerDialog.submitting = false
    actionLoadingNo.value = ''
  }
}

const openFlSellerDelivery = async (order: OrderItem) => {
  await syncOrderPrivacyStatus(order, true)
  if (!order.fl_record?.pcp_contract_id) return ElMessage.warning('请等待买方先请求交付')
  const transactionId = getTransactionId(order)
  const sellerId = String(order.transaction?.seller_address || '')
  const sellerPackages = order.fl_record?.seller_join_packages || {}
  if (!sellerPackages[sellerId]?.seller_public_key) {
    const keyMaterial = await flCrypto.generateFlKeyPair()
    await joinFlPrivacyContract({
      transactionId,
      sellerId,
      sellerPublicKey: keyMaterial.publicKeyHex,
    })
    flCrypto.downloadFlPrivateKeyFile({ role: 'seller', transactionId, privateKeyPem: keyMaterial.privateKeyPem })
    await syncOrderPrivacyStatus(order, true)
  }
  flSellerDialog.visible = true
  flSellerDialog.order = order
  flSellerDialog.file = null
}

const onFlSellerFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  flSellerDialog.file = target.files?.[0] || null
  target.value = ''
}

const submitFlSellerDelivery = async () => {
  const order = flSellerDialog.order
  const transactionId = order ? getTransactionId(order) : ''
  if (!order || !transactionId) return
  if (!flSellerDialog.file) return ElMessage.warning('请先选择训练结果压缩包')
  flSellerDialog.submitting = true
  actionLoadingNo.value = order.order_no
  try {
    const formData = new FormData()
    formData.append('transactionId', transactionId)
    formData.append('sellerId', String(order.transaction?.seller_address || ''))
    formData.append('batch_zip', flSellerDialog.file, flSellerDialog.file.name)
    const res: any = await submitFlPrivacyBatch(formData)
    order.fl_record = res?.data?.item || order.fl_record
    await syncOrderPrivacyStatus(order, true)
    await submitSellerDeliver(order)
    flSellerDialog.visible = false
    ElMessage.success(res?.data?.message || 'FL 交付已提交')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'FL 执行交付失败')
  } finally {
    flSellerDialog.submitting = false
    actionLoadingNo.value = ''
  }
}

const onMpcSellerFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  mpcSellerDialog.files = Array.from(target.files || [])
  target.value = ''
}

const submitMpcSellerDelivery = async () => {
  const order = mpcSellerDialog.order
  const transactionId = order ? getTransactionId(order) : ''
  if (!order || !transactionId) return
  if (!mpcSellerDialog.files.length) return ElMessage.warning('请先选择资产数据文件')
  mpcSellerDialog.submitting = true
  actionLoadingNo.value = order.order_no
  try {
    const formData = new FormData()
    formData.append('transactionId', transactionId)
    mpcSellerDialog.files.forEach((file) => formData.append('files', file, file.name))
    await uploadMpcAuditData(formData)
    const res: any = await submitMpcAudit(transactionId)
    order.mpc_record = mapMpcAuditJob(res?.data?.data) || order.mpc_record
    await submitSellerDeliver(order)
    mpcSellerDialog.visible = false
    ElMessage.success(res?.data?.message || 'MPC 交付已提交')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'MPC 执行交付失败')
  } finally {
    mpcSellerDialog.submitting = false
    actionLoadingNo.value = ''
  }
}

let fetchRequestId = 0
const fetchOrders = async () => {
  const requestId = ++fetchRequestId
  loading.value = true
  try {
    const order_role = roleKey === 'seller' ? 'seller' : roleKey === 'buyer' ? 'buyer' : 'both'
    const res = await getOrderList({
      ...query,
      order_role,
      delivery_only: true,
      delivery_state: selectedDeliveryState.value === 'all' ? undefined : selectedDeliveryState.value,
      keyword: currentOrderNo.value || activeKeyword.value,
    })
    if (requestId !== fetchRequestId) return
    if (res.data.status === 0) {
      const list = res.data.data?.list || []
      const filteredList = currentOrderNo.value ? list.filter((item: OrderItem) => item.order_no === currentOrderNo.value) : list
      orders.value = filteredList
      const p = res.data.data?.pagination || {}
      pagination.page = p.page || 1
      pagination.page_size = p.page_size || query.page_size
      pagination.total = currentOrderNo.value ? filteredList.length : p.total || 0
      // 列表和分页先显示；外部隐私服务状态及下载资格随后更新当前行。
      void Promise.allSettled(filteredList.map(async (item: OrderItem) => {
        await syncOrderPrivacyStatus(item, true)
        if (isPrivacyPc(item)) return
        try {
          const eligibleRes: any = await getDeliveryExportEligible(item.order_no)
          item.transaction = {
            ...(item.transaction || {}),
            can_download: Boolean(eligibleRes?.data?.data?.can_download),
            export_payload: eligibleRes?.data?.data?.item || null,
          }
        } catch (_error) {
          item.transaction = { ...(item.transaction || {}), can_download: false, export_payload: null }
        }
      }))
    } else {
      ElMessage.error(res.data.message || '获取订单失败')
    }
  } catch (error: any) {
    if (requestId === fetchRequestId) ElMessage.error(error?.response?.data?.message || '获取订单失败')
  } finally {
    if (requestId === fetchRequestId) loading.value = false
  }
}

const getMpcResultText = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value ? '达到要求' : '未达到要求'
  }
  return '-'
}

const formatMpcQualifiedCount = (result?: NestedRecord | null) => {
  const userCount = Number(result?.user_count || 0)
  const qualifiedCount = Number(result?.qualified_count || 0)
  if (!userCount) return '-'
  return `${qualifiedCount} / ${userCount} 人达标`
}

const formatMpcThreshold = (order?: OrderItem | null) => {
  const threshold = order?.mpc_record?.compute_params?.threshold
  return threshold === undefined || threshold === null || threshold === '' ? '-' : String(threshold)
}

const onPageChange = (page: number) => { query.page = page; fetchOrders() }
const onSizeChange = (size: number) => { query.page_size = size; query.page = 1; fetchOrders() }
const onSearch = () => {
  currentOrderNo.value = ''
  activeKeyword.value = searchInput.value.trim()
  query.page = 1
  fetchOrders()
}

const openContractPreview = (order: OrderItem) => { selectedOrder.value = order; contractPreviewVisible.value = true }
const openHistoryDialog = (order: OrderItem) => { selectedOrder.value = order; historyDialogVisible.value = true }

const openContractDialog = (order: OrderItem) => {
  contractForm.order_no = order.order_no
  contractForm.contract_name = order.digital_contract?.contract_name || `${order.asset_name || '数字资产'}-数字合约`
  contractForm.product_name = order.digital_contract?.product_name || order.asset_name || ''
  contractForm.contract_description = order.digital_contract?.contract_description || ''
  contractForm.operations = order.digital_contract?.operations || operationText(order.trade_mode)
  contractForm.expiration_time = order.digital_contract?.expiration_time || ''
  contractForm.quantity_limit = Number(order.digital_contract?.quantity_limit || order.buy_qty || 1)
  contractForm.processing_type = order.digital_contract?.processing_type || tradeModeText(order.trade_mode)
  contractForm.pc_type = order.digital_contract?.pc_type || order.transaction?.pc_type || 'TEE'
  contractForm.delivery_limit = Number(order.transaction?.delivery_limit || 1)
  contractDialogVisible.value = true
}

const submitContract = async () => {
  if (!contractForm.order_no) return
  contractSubmitting.value = true
  try {
    const res = await saveOrderContract(contractForm.order_no, {
      contract_name: contractForm.contract_name,
      product_name: contractForm.product_name,
      contract_description: contractForm.contract_description,
      operations: contractForm.operations,
      expiration_time: contractForm.expiration_time || null,
      quantity_limit: contractForm.quantity_limit,
      processing_type: contractForm.processing_type,
      delivery_limit: contractForm.delivery_limit,
    })
    if (res.data.status === 0) {
      ElMessage.success('数字合约保存成功')
      contractDialogVisible.value = false
      fetchOrders()
    } else {
      ElMessage.error(res.data.message || '数字合约保存失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '数字合约保存失败')
  } finally {
    contractSubmitting.value = false
  }
}

const submitSellerDeliver = async (order: OrderItem) => {
  actionLoadingNo.value = order.order_no
  try {
    const contract = order.digital_contract || {}
    const transaction = order.transaction || {}
    const pcType = String(contract.pc_type || '').toUpperCase()
    if (!pcType) {
      ElMessage.warning('请先配置交付方式')
      return
    }
    const res = await sellerDeliver(order.order_no, {
      contract_name: contract.contract_name || `${order.asset_name || '数字资产'}-数字合约`,
      product_name: contract.product_name || order.asset_name || '',
      contract_description: contract.contract_description || '',
      operations: contract.operations || operationText(order.trade_mode),
      expiration_time: contract.expiration_time || null,
      quantity_limit: contract.quantity_limit || order.buy_qty || 1,
      processing_type: contract.processing_type || tradeModeText(order.trade_mode),
      buyer_address: transaction.buyer_address || order.buyer_address || '',
      delivery_limit: transaction.delivery_limit || 1,
      note: `已发起 ${pcType} 交付流程`,
    })
    if (res.data.status === 0) {
      ElMessage.success('卖家交付成功')
      fetchOrders()
    } else {
      ElMessage.error(res.data.message || '卖家交付失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '卖家交付失败')
  } finally {
    actionLoadingNo.value = ''
  }
}

const openRequestDialog = (order: OrderItem) => {
  requestTargetOrder.value = order
  requestForm.order_no = order.order_no
  requestForm.transaction_id = String(order.transaction?.transaction_id || '')
  requestForm.vm_name = `tx-${order.transaction?.transaction_id || order.order_no}-vm`
  requestForm.vm_cpu = 2
  requestForm.vm_memory_mb = 2048
  requestDialogVisible.value = true
}

const submitRequestDelivery = async () => {
  if (!requestTargetOrder.value?.order_no) return
  requestSubmitting.value = true
  try {
    const res = await requestSecureDelivery(requestTargetOrder.value.order_no, {
      vm_name: requestForm.vm_name,
      vm_cpu: requestForm.vm_cpu,
      vm_memory_mb: requestForm.vm_memory_mb,
    })
    if (res.data.status === 0) {
      ElMessage.success('交付申请已提交，等待卖家确认')
      requestDialogVisible.value = false
      await fetchOrders()
    } else {
      ElMessage.error(res.data.message || '交付申请失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '交付申请失败')
  } finally {
    requestSubmitting.value = false
  }
}

const downloadBuyerResult = async (order: OrderItem) => {
  if (!ensureDeliveryActive(order)) return
  if (!canDownloadBuyerPrivacyResult(order)) {
    ElMessage.warning('交付未完成，暂不可下载')
    return
  }
  const pcType = getPcType(order)
  const transactionId = getTransactionId(order)
  actionLoadingNo.value = `download-${order.order_no}`
  try {
    if (pcType === 'HE') {
      const response: any = await downloadHePrivacyResult(transactionId)
      heDecryptDialog.visible = true
      heDecryptDialog.order = order
      heDecryptDialog.algorithm = response.headers?.['x-he-enc-type'] || order.he_record?.selected_enc_type || ''
      heDecryptDialog.encryptedText = await heCsv.blobToText(response.data)
      heDecryptDialog.privateKeyFile = null
      return
    }
    if (pcType === 'PRE') {
      const response: any = await downloadPrePrivacyResult(transactionId)
      preDecryptDialog.visible = true
      preDecryptDialog.order = order
      preDecryptDialog.encryptedBlob = response.data
      preDecryptDialog.privateKeyFile = null
      return
    }
    if (pcType === 'FL') {
      const response: any = await downloadFlPrivacyResult({
        transactionId,
        receiverRole: 'buyer',
        resultRole: 'fl_top_model',
      })
      flDecryptDialog.visible = true
      flDecryptDialog.order = order
      flDecryptDialog.encryptedBlob = response.data
      flDecryptDialog.privateKeyFile = null
      flDecryptDialog.resultRole = 'fl_top_model'
      return
    }
    if (pcType === 'MPC') {
      let result: any
      if (order.mpc_record?.audit_mode === 'MPC_COMPOSITE') {
        const res: any = await getMpcAuditResult(transactionId)
        result = res?.data?.data?.result || {}
      } else {
        const res: any = await getMpcPrivacyResult(transactionId)
        result = res?.data?.data?.result || res?.data?.result || {}
      }
      mpcResultDialog.order = order
      mpcResultDialog.result = result
      mpcResultDialog.visible = true
      return
    }
    const response = await downloadDeliveryResult(order.order_no, {
      filename: `encrypted_result_${order.transaction?.transaction_id || order.order_no}`,
    })
    const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `encrypted_result_${order.transaction?.transaction_id || order.order_no}.bin`
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (error: any) {
    const message = await resolveBlobErrorMessage(error, '下载结果失败')
    ElMessage.error(message)
  } finally {
    actionLoadingNo.value = ''
  }
}

const onHePrivateKeyChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  heDecryptDialog.privateKeyFile = target.files?.[0] || null
  target.value = ''
}

const confirmHeDecryptResult = async () => {
  if (heDecryptDialog.order && !ensureDeliveryActive(heDecryptDialog.order)) return
  if (!heDecryptDialog.privateKeyFile || !heDecryptDialog.order) return ElMessage.warning('请先选择解密文件')
  heDecryptDialog.processing = true
  try {
    const privateKeyText = await heDecryptDialog.privateKeyFile.text()
    const algorithm = normalizeHeAlgorithm(heDecryptDialog.algorithm || heDecryptDialog.order.he_record?.selected_enc_type)
    const parsedKey = heCrypto.parseHeKeyMaterial(privateKeyText, algorithm)
    heCrypto.assertHePrivateKeyMatchesRecord({
      parsedKey,
      algorithm,
      transactionId: getTransactionId(heDecryptDialog.order),
      record: heDecryptDialog.order.he_record,
    })
    const csvText = await heCrypto.decryptHeResultCsv({
      algorithm,
      encryptedCsvText: heDecryptDialog.encryptedText,
      privateKeyText,
    })
    heCsv.downloadCsvText({
      csvText,
      filename: `he-result-${getTransactionId(heDecryptDialog.order)}.csv`,
    })
    heDecryptDialog.visible = false
    ElMessage.success('HE 结果已解密并下载')
  } catch (error: any) {
    const rawMessage = error?.message || ''
    const message = /match|mismatch|private key|私钥|不匹配|不属于当前交易|algorithm|算法/i.test(rawMessage)
      ? '解密文件与当前交易或交付算法不匹配，请选择对应的 HE 私钥文件'
      : (rawMessage || 'HE 结果解密失败')
    ElMessage.error(message)
  } finally {
    heDecryptDialog.processing = false
  }
}

const onPrePrivateKeyChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  preDecryptDialog.privateKeyFile = target.files?.[0] || null
  target.value = ''
}

const resolveBlobErrorMessage = async (error: any, fallbackMessage: string) => {
  const blobPayload = error?.response?.data
  if (!blobPayload || typeof Blob === 'undefined' || !(blobPayload instanceof Blob)) {
    return error?.response?.data?.message || error?.message || fallbackMessage
  }

  try {
    const text = await heCsv.blobToText(blobPayload)
    if (!text) return fallbackMessage
    try {
      const parsed = JSON.parse(text)
      return parsed?.message || fallbackMessage
    } catch (_parseError) {
      return text
    }
  } catch (_blobError) {
    return fallbackMessage
  }
}

const confirmPreDecryptResult = async () => {
  if (preDecryptDialog.order && !ensureDeliveryActive(preDecryptDialog.order)) return
  if (!preDecryptDialog.privateKeyFile || !preDecryptDialog.order || !preDecryptDialog.encryptedBlob) {
    return ElMessage.warning('请先选择 PRE 私钥文件')
  }
  preDecryptDialog.processing = true
  try {
    const privateKeyText = await preDecryptDialog.privateKeyFile.text()
    const encryptedBuffer = await preDecryptDialog.encryptedBlob.arrayBuffer()
    const parsedKey = preCrypto.parsePrePrivateKeyMaterial(privateKeyText)
    preCrypto.assertPrePrivateKeyMatchesRecord({
      parsedKey,
      transactionId: getTransactionId(preDecryptDialog.order),
      record: preDecryptDialog.order.pre_record,
    })

    const formData = new FormData()
    formData.append('transactionId', getTransactionId(preDecryptDialog.order))
    formData.append('encrypted_result', new Blob([encryptedBuffer], { type: 'application/zip' }), `pre-result-${getTransactionId(preDecryptDialog.order)}.zip`)
    formData.append('private_key_file', new Blob([privateKeyText], { type: 'application/json' }), preDecryptDialog.privateKeyFile.name)
    const response: any = await decryptPrePrivacyResult(formData)
    heCsv.downloadBlobFile({
      blob: response.data,
      filename: `pre-result-${getTransactionId(preDecryptDialog.order)}.zip`,
    })
    preDecryptDialog.visible = false
    ElMessage.success('PRE 结果已解密并下载')
  } catch (error: any) {
    const message = await resolveBlobErrorMessage(error, 'PRE 结果解密失败')
    ElMessage.error(message)
  } finally {
    preDecryptDialog.processing = false
  }
}

const onFlPrivateKeyChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  flDecryptDialog.privateKeyFile = target.files?.[0] || null
  target.value = ''
}

const confirmFlDecryptResult = async () => {
  if (flDecryptDialog.order && !ensureDeliveryActive(flDecryptDialog.order)) return
  if (!flDecryptDialog.privateKeyFile || !flDecryptDialog.order || !flDecryptDialog.encryptedBlob) {
    return ElMessage.warning('请先选择 FL 私钥文件')
  }
  flDecryptDialog.processing = true
  try {
    await flCrypto.downloadDecryptedFlResult({
      encryptedTarBuffer: await flDecryptDialog.encryptedBlob.arrayBuffer(),
      privateKeyText: await flDecryptDialog.privateKeyFile.text(),
      filename: '',
      resultRole: flDecryptDialog.resultRole,
      transactionId: getTransactionId(flDecryptDialog.order),
      batchIndex: null,
    })
    flDecryptDialog.visible = false
    ElMessage.success('FL 结果已解密并下载')
  } catch (error: any) {
    ElMessage.error(error?.message || 'FL 结果解密失败')
  } finally {
    flDecryptDialog.processing = false
  }
}

const syncPrivacyStatus = async (order: OrderItem) => {
  const transactionId = getTransactionId(order)
  const pcType = getPcType(order)
  if (!transactionId || !pcType) return
  actionLoadingNo.value = `sync-${order.order_no}`
  try {
    await syncOrderPrivacyStatus(order, false)
    ElMessage.success('状态同步成功')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '状态同步失败')
  } finally {
    actionLoadingNo.value = ''
  }
}

const getCurrentPageRows = () => roleKey === 'seller' ? sellerRows.value : buyerRows.value

const hasSyncablePrivacyStatus = (order: OrderItem) => {
  return Boolean(!isDeliveryExpired(order) && getTransactionId(order) && ['HE', 'PRE', 'FL', 'MPC'].includes(getPcType(order)))
}

const pollCurrentPageStatus = async () => {
  if (loading.value || statusPolling.value) return
  const rows = getCurrentPageRows().filter(hasSyncablePrivacyStatus)
  if (!rows.length) return
  statusPolling.value = true
  try {
    await Promise.all(rows.map((order) => syncOrderPrivacyStatus(order, true).catch(() => undefined)))
  } finally {
    statusPolling.value = false
  }
}

const startStatusPolling = () => {
  stopStatusPolling()
  statusPollTimer = window.setInterval(() => {
    pollCurrentPageStatus()
  }, STATUS_POLL_INTERVAL_MS)
}

const stopStatusPolling = () => {
  if (!statusPollTimer) return
  window.clearInterval(statusPollTimer)
  statusPollTimer = null
}

onMounted(async () => {
  await fetchOrders()
  startStatusPolling()
})

onBeforeUnmount(() => {
  stopStatusPolling()
})
</script>

<style scoped>
.common-wrapped {
  width: 100%;
  display: flex;
  justify-content: center;
  background-color: #f5f7fb;
}

.delivery-page {
  width: 85%;
  min-height: 100vh;
  padding: 16px 20px;
  box-sizing: border-box;
}

.content {
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
}

.title {
  margin: 0 0 12px;
  font-size: 16px;
  color: #1f2328;
  font-weight: 700;
}

.toolbar-section {
  padding: 10px 12px;
  margin-bottom: 10px;
}

.table-section {
  padding: 10px 12px;
}

.delivery-filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  margin: -10px -12px 10px;
  padding: 8px 24px;
  border-bottom: 1px solid #d8dee4;
  box-sizing: border-box;
}

.delivery-filter-label { flex: none; margin-left: 8px; margin-right: 12px; color: #6e7781; font-size: 15px; font-weight: 600; }
.delivery-filter-options { display: flex; align-items: center; gap: 6px; min-width: 0; overflow-x: auto; }
.delivery-filter-option {
  flex: none;
  padding: 5px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #57606a;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.delivery-filter-option:hover { background: #f6f8fa; }
.delivery-filter-option.active {
  background: #f6f8fa;
  color: #2b75c7;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.delivery-filter-option:focus-visible { outline: 2px solid #0969da; outline-offset: 2px; }
.delivery-filter-count { margin-left: auto; color: #57606a; font-size: 12px; white-space: nowrap; }

.toolbar-row {
  min-width: 0;
}

.list-title {
  font-size: 16px;
  font-weight: 700;
  color: #1f2328;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid #d8dee4;
  border-radius: 8px;
}

.buyer-table th:first-child,
.buyer-table td:first-child {
  border-left: 0;
}

.buyer-table th:last-child,
.buyer-table td:last-child {
  border-right: 0;
}

.buyer-table thead th {
  border-top: 0;
}

.buyer-table tbody tr:last-child td {
  border-bottom: 0;
}

.current-order {
  margin: 0 0 10px;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.action-btn {
  min-width: 120px;
  height: 34px;
  border: 1px solid #d8e2f2;
  border-radius: 8px;
  background: #fff;
  color: #57606a;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.active {
  border-color: #2d63d8;
  background: #2d63d8;
  color: #fff;
}

.buyer-action-col {
  white-space: nowrap;
}

.buyer-actions--inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: nowrap;
}

.buyer-actions :deep(.el-button.delivery-action-button) {
  --el-button-bg-color: #f6f8fa;
  --el-button-border-color: #d0d7de;
  --el-button-text-color: #0969da;
  --el-button-hover-bg-color: #eef1f4;
  --el-button-hover-border-color: #b7c1ca;
  --el-button-hover-text-color: #0550ae;
  --el-button-active-bg-color: #e7ebef;
  --el-button-active-border-color: #aeb8c2;
  --el-button-active-text-color: #0550ae;
  width: 104px;
  min-width: 104px;
  max-width: 104px;
  flex: 0 0 104px;
  box-sizing: border-box;
  height: 30px;
  margin: 0;
  padding: 0 10px;
  font-size: 14px;
}

.buyer-actions :deep(.el-button.delivery-action-button.is-disabled) {
  --el-button-disabled-bg-color: #fafbfc;
  --el-button-disabled-border-color: #eef0f2;
  --el-button-disabled-text-color: #aeb5bd;
  box-shadow: none;
  opacity: 1;
}

.request-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1;
  border: 1px solid #d8e2f0;
  background: #f5f7fb;
  color: #57606a;
}

.request-status-pill.is-none {
  background: #f5f7fb;
  border-color: #d8e2f0;
  color: #57606a;
}

.request-status-pill.is-pending {
  background: #fff6e8;
  border-color: #f1d29a;
  color: #a86b00;
}

.request-status-pill.is-approved {
  background: #edf9f1;
  border-color: #b8e0c4;
  color: #247a42;
}

.request-status-pill.is-rejected {
  background: #fff1f1;
  border-color: #efc0c0;
  color: #b84747;
}

.table-container {
  overflow-x: auto;
}

.styled-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}

.buyer-table th:nth-child(2),
.buyer-table td:nth-child(2) {
  width: 16%;
}

.buyer-table th:first-child,
.buyer-table td:first-child {
  width: 30%;
}

.buyer-table th:nth-child(3),
.buyer-table td:nth-child(3) {
  width: 16%;
}

.buyer-table th:last-child,
.buyer-table td:last-child {
  width: 38%;
}

.styled-table th,
.styled-table td {
  border: 1px solid #e1e6ef;
  padding: 10px 8px;
  text-align: center;
  vertical-align: middle;
  line-height: 1.45;
  font-size: 12px;
  color: #1f2328;
}

.buyer-table td:nth-child(-n + 3) {
  font-size: 13px;
}

.buyer-table td:not(:first-child) {
  font-size: 14px;
}

.styled-table th {
  background: #f8fafc;
  color: #3d444d;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 1px solid #dde4ee;
}

.styled-table td {
  background: #fff;
}

.table-hover-row tbody tr:hover td {
  background: #eef3f8;
  transition: background-color 0.2s ease;
}

.upload-section,
.buyer-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.upload-btn,
.delivery-status-btn {
  border: 1px solid #d3def6;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 7px 12px;
  background: #fff;
  color: #3159b7;
  transition: all 0.2s ease;
}

.upload-btn:hover,
.delivery-status-btn:hover {
  border-color: #aac2ff;
  background: #f3f7ff;
}

.upload-btn:disabled,
.delivery-status-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.upload-btn.secondary {
  color: #57606a;
  border-color: #d9e1ee;
  background: #f8fafc;
}

.delivery-status-btn {
  background: #eaf2ff;
  color: #2f65d9;
  border: 1px solid #c9d9ff;
}

.truncate-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.asset-info-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 100%;
  min-width: 0;
  text-align: center;
}

.asset-name-link {
  display: block;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: #4b5563;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.asset-name-link:hover {
  color: #374151;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.asset-name-link:focus-visible {
  outline: 2px solid #0969da;
  outline-offset: 2px;
}

.asset-transaction-id {
  display: block;
  max-width: 100%;
  min-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.6;
  text-align: center;
}

.asset-name-placeholder {
  min-height: 20px;
}

.delivery-status-text {
  color: var(--app-text-primary);
  font-size: 14px;
}

.asset-preview {
  min-height: 120px;
}

.asset-preview-cover {
  display: block;
  width: 100%;
  max-height: 260px;
  border-radius: 8px;
  object-fit: contain;
  background: #f6f8fa;
}

.asset-preview-name {
  margin: 18px 0 4px;
  color: var(--app-text-primary);
  font-size: 18px;
  font-weight: 600;
}

.asset-preview-meta {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.asset-preview-meta span {
  margin: 0 6px;
  color: var(--app-text-muted);
}

.asset-preview-description {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #d8dee4;
}

.asset-preview-label {
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.asset-preview-description p {
  margin: 8px 0 0;
  color: var(--app-text-primary);
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.single-action-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  white-space: nowrap;
}

.single-action-cell :deep(.el-button) {
  margin-left: 0;
  padding: 0 4px;
  font-size: 14px;
}

.empty-cell {
  text-align: center;
  color: var(--app-text-muted);
  padding: 24px 0;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 14px;
}

.dialog-block {
  display: grid;
  gap: 16px;
}

.dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.dialog-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  border: 1px solid #e8edf7;
  border-radius: 8px;
  background: #fbfcff;
  padding: 10px 12px;
}

.dialog-item.full {
  grid-column: 1 / -1;
}

.dialog-item span {
  color: var(--app-text-secondary);
  font-size: 12px;
}

.dialog-item strong {
  color: #1f2328;
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}

.history-box {
  border: 1px solid #e8edf7;
  border-radius: 8px;
  background: #fbfcff;
  padding: 12px;
}

.history-title {
  margin-bottom: 12px;
  color: #1f2328;
  font-size: 14px;
  font-weight: 700;
}

.history-list {
  display: grid;
  gap: 12px;
}

.history-row {
  display: flex;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px dashed #d8dfef;
}

.history-row:first-child {
  padding-top: 0;
  border-top: none;
}

.history-index {
  min-width: 44px;
  color: #2f65d9;
  font-weight: 700;
}

.history-content {
  flex: 1;
}

.history-main {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #1f2328;
  font-size: 13px;
}

.history-note {
  margin-top: 6px;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.confirm-text {
  color: #57606a;
  line-height: 1.8;
}

.selected-file-name {
  margin-top: 6px;
  color: #57606a;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}

.he-key-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  color: #1f2328;
  font-size: 13px;
}

.he-key-hint__file {
  color: #6d7894;
  font-size: 12px;
}

@media (max-width: 768px) {
  .actions {
    flex-direction: column;
  }

  .dialog-grid {
    grid-template-columns: 1fr;
  }

  .styled-table {
    min-width: 760px;
  }

  .upload-section,
  .buyer-actions--inline {
    flex-wrap: wrap;
  }
}
</style>
