<template>
  <div class="common-wrapped">
    <div class="delivery-page">
      <section class="toolbar-section">
        <div class="toolbar-row app-search-layout">
          <div class="list-title page-title">交付工作台</div>
          <div class="app-search-bar">
            <el-input v-model="searchInput" class="delivery-search app-search-input" placeholder="搜索订单号或资产名称"
              clearable @keyup.enter="onSearch" @clear="onSearch">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button class="app-search-button" @click="onSearch">搜索</el-button>
          </div>
        </div>
      </section>

      <section class="table-section" v-loading="loading">
        <div class="table-wrap">
          <table class="styled-table table-hover-row seller-delivery-table">
            <thead>
              <tr>
                <th>交易ID</th>
                <th>资产名称</th>
                <th>数字合约</th>
                <th>交付状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in sellerRows" :key="`seller-${item.order_no}`">
                <td>
                  <div class="truncate-cell" :title="item.transaction?.transaction_id || '-'">
                    {{ item.transaction?.transaction_id || '-' }}
                  </div>
                </td>
                <td>
                  <div class="truncate-cell" :title="item.asset_name || '-'">
                    {{ item.asset_name || '-' }}
                  </div>
                </td>
                <td>
                  <div class="single-action-cell">
                    <el-button type="primary" link @click="openContractPreview(item)">查看</el-button>
                  </div>
                </td>
                <td>
                  <button class="delivery-status-btn" @click="openHistoryDialog(item)">
                    {{ deliveryProgressText(item) }}
                  </button>
                </td>
                <td>
                  <div class="upload-section">
                    <el-button v-if="item.order_status === 1 && item.wallet_payment_status === 'PAID' && item.transaction_status !== '已确认'"
                      type="danger" link :loading="actionLoadingNo === item.order_no" @click="rejectPaidOrder(item)">拒绝并退款</el-button>
                    <button
                      v-if="isHeOrder(item) || isPreOrder(item) || isFlOrder(item) || isMpcOrder(item)"
                      class="upload-btn"
                      :disabled="isSellerDeliveryDisabled(item) || actionLoadingNo === item.order_no"
                      @click="openSellerDelivery(item)"
                    >
                      {{ actionLoadingNo === item.order_no ? '处理中...' : getSellerDeliveryActionText(item) }}
                    </button>
                    <button
                      v-if="isFlOrder(item) && getLatestSellerGradientPackage(item)"
                      class="upload-btn secondary"
                      :disabled="isDeliveryExpired(item) || !getLatestSellerGradientPackage(item) || actionLoadingNo === `fl-download-${item.order_no}`"
                      @click="downloadFlSellerGradient(item)"
                    >
                      {{ actionLoadingNo === `fl-download-${item.order_no}` ? '下载中...' : '下载结果' }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="sellerRows.length === 0 && !loading">
                <td colspan="5" class="empty-cell">暂无交易记录</td>
              </tr>
            </tbody>
          </table>
        </div>

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

  <el-dialog v-model="contractPreviewVisible" title="数字合约信息" width="720px">
    <DigitalContractPreview v-if="selectedOrder && contractPreviewVisible" :key="selectedOrder.order_no" :order-no="selectedOrder.order_no" role="seller" />
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

  <el-dialog v-model="contractDialogVisible" title="配置数字合约" width="640px">
    <el-form :model="contractForm" label-width="110px">
      <el-form-item label="订单号"><el-input v-model="contractForm.order_no" disabled /></el-form-item>
      <el-form-item label="合约名称"><el-input v-model="contractForm.contract_name" /></el-form-item>
      <el-form-item label="产品名称"><el-input v-model="contractForm.product_name" /></el-form-item>
      <el-form-item label="交付方式">
        <el-input :model-value="pcTypeText(contractForm.pc_type)" disabled />
      </el-form-item>
      <el-form-item label="处理类型"><el-input v-model="contractForm.processing_type" /></el-form-item>
      <el-form-item label="可执行操作"><el-input v-model="contractForm.operations" /></el-form-item>
      <el-form-item label="数量限制"><el-input-number v-model="contractForm.quantity_limit" :min="1" :max="9999" /></el-form-item>
      <el-form-item label="交付次数"><el-input-number v-model="contractForm.delivery_limit" :min="1" :max="100" /></el-form-item>
      <el-form-item label="到期时间">
        <el-date-picker
          v-model="contractForm.expiration_time"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          placeholder="请选择到期时间"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="合约描述"><el-input v-model="contractForm.contract_description" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="contractDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="contractSubmitting" @click="submitContract">保存配置</el-button>
    </template>
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

  <el-dialog v-model="heSellerDialog.visible" title="执行交付 - 同态加密" width="620px">
    <el-form label-width="110px">
      <el-form-item label="交易ID"><el-input :model-value="heSellerDialog.order?.transaction?.transaction_id || ''" disabled /></el-form-item>
      <el-form-item label="交付算法">
        <el-select v-model="heSellerDialog.operation" style="width: 100%">
          <el-option label="加法" value="ADD" />
          <el-option label="乘法" value="MUL" />
        </el-select>
      </el-form-item>
      <el-form-item label="文件1">
        <input ref="heFile1Input" type="file" accept=".csv" @change="onHeSellerFileChange('file1', $event)" />
        <div v-if="heSellerDialog.file1" class="selected-file-name">{{ heSellerDialog.file1.name }}</div>
      </el-form-item>
      <el-form-item label="文件2">
        <input ref="heFile2Input" type="file" accept=".csv" @change="onHeSellerFileChange('file2', $event)" />
        <div v-if="heSellerDialog.file2" class="selected-file-name">{{ heSellerDialog.file2.name }}</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="heSellerDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="heSellerDialog.submitting" :disabled="!heSellerDialog.order || isDeliveryExpired(heSellerDialog.order)" @click="submitHeSellerDelivery">执行交付</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="preSellerDialog.visible" title="执行交付" width="560px">
    <el-form label-width="110px">
      <el-form-item label="交易ID"><el-input :model-value="preSellerDialog.order?.transaction?.transaction_id || ''" disabled /></el-form-item>
      <el-form-item label="原始压缩包">
        <input ref="preArchiveInput" type="file" accept=".zip,.tar,.tar.gz,.tgz,application/zip,application/x-tar,application/gzip" @change="onPreSellerFileChange" />
        <div v-if="preSellerDialog.file" class="selected-file-name">{{ preSellerDialog.file.name }}</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="preSellerDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="preSellerDialog.submitting" :disabled="!preSellerDialog.order || isDeliveryExpired(preSellerDialog.order)" @click="submitPreSellerDelivery">执行交付</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="flSellerDialog.visible" title="执行交付" width="560px">
    <el-form label-width="120px">
      <el-form-item label="交易ID"><el-input :model-value="flSellerDialog.order?.transaction?.transaction_id || ''" disabled /></el-form-item>
      <el-form-item label="训练结果压缩包">
        <input ref="flBatchInput" type="file" accept=".zip,application/zip" @change="onFlSellerFileChange" />
        <div v-if="flSellerDialog.file" class="selected-file-name">{{ flSellerDialog.file.name }}</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="flSellerDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="flSellerDialog.submitting" :disabled="!flSellerDialog.order || isDeliveryExpired(flSellerDialog.order)" @click="submitFlSellerDelivery">执行交付</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="mpcSellerDialog.visible" title="执行交付" width="560px">
    <el-form label-width="110px">
      <el-form-item label="交易ID"><el-input :model-value="mpcSellerDialog.order?.transaction?.transaction_id || ''" disabled /></el-form-item>
      <el-form-item label="资产数据文件">
        <input ref="mpcSellerFileInput" type="file" accept=".csv,text/csv" multiple @change="onMpcSellerFileChange" />
        <div v-if="mpcSellerDialog.files.length" class="selected-file-name">{{ mpcSellerDialog.files.map((file) => file.name).join('，') }}</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="mpcSellerDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="mpcSellerDialog.submitting" :disabled="!mpcSellerDialog.order || isDeliveryExpired(mpcSellerDialog.order)" @click="submitMpcSellerDelivery">执行交付</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="mpcNoticeDialog.visible" title="提示" width="460px" :close-on-click-modal="false">
    <div class="dialog-body">
      <div class="dialog-hint compact-hint">
        <span>{{ mpcNoticeDialog.message }}</span>
      </div>
    </div>
    <template #footer>
      <el-button type="primary" @click="mpcNoticeDialog.visible = false">我知道了</el-button>
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
      <el-button type="primary" :loading="flDecryptDialog.processing" @click="confirmFlDecryptResult">解密并下载</el-button>
    </template>
  </el-dialog>

</template>

<script lang="ts" setup>
import DigitalContractPreview from '@/components/DigitalContractPreview.vue'
// 卖家交付页：对应原始系统 frontend/src/views/DeliverySeller2.vue。
// index.vue 只做角色分发，本文件只保留卖家“数字资产上传/执行交付”视角。
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import {
  createFlPrivacyContract,
  createMpcPrivacyTask,
  decryptPrePrivacyResult,
  downloadDeliveryResult,
  downloadFlPrivacyResult,
  downloadHePrivacyResult,
  downloadPrePrivacyResult,
  getDeliveryExportEligible,
  getFlStatus,
  getHePublicKeyStatus,
  getHeStatus,
  getMpcStatus,
  getMpcPrivacyResult,
  getOrderList,
  rejectOrder,
  getPreStatus,
  joinFlPrivacyContract,
  requestSecureDelivery,
  saveOrderContract,
  sellerDeliver,
  submitFlPrivacyBatch,
  submitHePrivacyDelivery,
  submitMpcSellerData,
  submitPrePrivacyDelivery,
  uploadHePublicKeys,
  uploadPreBuyerPublicKey,
} from '@/api/asset'
import { getRoleKey, parseTokenPayload } from '@/utils/auth'
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
  asset_name?: string
  buyer_account?: string
  buyer_address?: string
  pc_type?: string
  expiration_time?: string
  buy_qty?: number
  trade_mode?: string
  order_status: number
  wallet_payment_status?: string | null
  transaction_status?: string | null
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
const roleKey = 'seller'
const currentOrderNo = ref(String(route.query.order_no || ''))
const searchInput = ref('')
const activeKeyword = ref('')
const activeTab = ref('assetUpload')

const loading = ref(false)
const orders = ref<OrderItem[]>([])
const actionLoadingNo = ref('')
const statusPolling = ref(false)
const pagination = reactive({ page: 1, page_size: 10, total: 0 })
const query = reactive({ page: 1, page_size: 10 })
const STATUS_POLL_INTERVAL_MS = 5000
let statusPollTimer: ReturnType<typeof window.setInterval> | null = null

const selectedOrder = ref<OrderItem | null>(null)
const contractPreviewVisible = ref(false)
const contractDialogVisible = ref(false)
const contractSubmitting = ref(false)
const historyDialogVisible = ref(false)
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
const mpcNoticeDialog = reactive({
  visible: false,
  message: '',
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

const showSellerPanel = computed(() => true)
const showBuyerPanel = computed(() => false)
const showRoleTabs = computed(() => false)

const isConfirmedTransaction = (order: OrderItem) => {
  const txStatus = String(order.transaction?.status || '').trim()
  return txStatus === '已确认' || Number(order.order_status) >= 2
}

const sellerRows = computed(() => orders.value.filter((item) => isConfirmedTransaction(item)))
const buyerRows = computed(() => orders.value.filter((item) => isConfirmedTransaction(item)))

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

  if (['FAILED', 'AUDIT_FAILED', 'PAM_FAILED', 'REJECTED'].includes(status)) return '失败'
  if (['PAMING'].includes(status)) return '审计中'
  if (['QUEUED', 'RUNNING', 'COMPUTED', 'READY', 'COMPUTING'].includes(status)) return '计算中'
  if (['COMPLETED', 'PAM_PASSED', 'DONE', 'SUCCESS'].includes(status) || Number(order.order_status) === 3) return '已完成'
  if (['CREATED', 'WAITING_INPUT', 'WAITING_EPOCH_INPUT', 'JOINED', 'PENDING', 'BUYER_REQUESTED'].includes(status)) return '待卖方交付'
  if (Number(order.order_status) === 0) return '待买方操作'
  if (Number(order.order_status) === 1) return '待卖方交付'
  if (Number(order.order_status) === 2) return '待买方操作'
  return '待买方操作'
}

const deliveryProgressText = (order: OrderItem) => {
  return normalizedDeliveryStatusText(order)
}

const getBuyerDeliveryStatusText = (order: OrderItem) => {
  return normalizedDeliveryStatusText(order)
}

const buyerRequestStatusText = (order: OrderItem) => {
  const status = String(order.latest_delivery_request?.status || '').toUpperCase()
  if (!status) return '待买方操作'
  if (status === 'PENDING' || status === 'BUYER_REQUESTED') return '待卖方交付'
  if (status === 'APPROVED') return '待卖方交付'
  if (status === 'REJECTED' || status === 'FAILED') return '失败'
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

const sellerActionText = (order: OrderItem) => (isPrivacyPc(order) ? '执行交付' : '卖家交付')
const isHeOrder = (order: OrderItem) => getPcType(order) === 'HE'
const isPreOrder = (order: OrderItem) => getPcType(order) === 'PRE'
const isFlOrder = (order: OrderItem) => getPcType(order) === 'FL'
const isMpcOrder = (order: OrderItem) => getPcType(order) === 'MPC'
const getMpcTaskStatus = (order: OrderItem) => String(order.mpc_record?.task_status || '').toLowerCase()
const isSellerDeliveryDisabled = (order: OrderItem) => {
  if (isDeliveryExpired(order)) return true
  if (isMpcOrder(order)) {
    const status = getMpcTaskStatus(order)
    return !getTransactionId(order) ||
      !order.mpc_record?.remote_task_id ||
      ['ready', 'computing', 'done'].includes(status)
  }
  if (!canSellerDeliver(order)) return true
  if (isHeOrder(order)) return Boolean(order.he_record?.result_ready)
  if (isPreOrder(order)) return Boolean(order.pre_record?.result_ready)
  if (isFlOrder(order)) return String(order.fl_record?.pcp_status || '').toUpperCase() === 'COMPLETED'
  return true
}
const getSellerDeliveryActionText = (order: OrderItem) => {
  if (isDeliveryExpired(order)) return '已过期'
  if (isMpcOrder(order)) {
    const status = getMpcTaskStatus(order)
    if (!order.mpc_record?.remote_task_id) return '等待买方申请'
    if (['ready', 'computing'].includes(status)) return '计算中'
    if (status === 'done') return '已完成'
    return '执行交付'
  }
  if (!canSellerDeliver(order)) return '不可交付'
  if (isHeOrder(order) && !order.he_record?.public_keys_ready) return '等待买方申请'
  if (isPreOrder(order) && !order.pre_record?.buyer_public_key_ready) return '等待买方申请'
  if (isFlOrder(order) && !order.fl_record?.pcp_contract_id) return '等待买方申请'
  return '执行交付'
}

const isCompletedPcpStatus = (status?: string) => ['PAM_PASSED', 'COMPLETED'].includes(String(status || '').toUpperCase())
const canDownloadBuyerPrivacyResult = (order: OrderItem) => {
  const pcType = getPcType(order)
  if (pcType === 'HE') return Boolean(order.he_record?.result_ready || isCompletedPcpStatus(order.he_record?.pcp_status))
  if (pcType === 'PRE') return Boolean(order.pre_record?.result_ready || isCompletedPcpStatus(order.pre_record?.pcp_status))
  if (pcType === 'FL') return Boolean(
    order.fl_record?.buyer_result_ready ||
    order.fl_record?.buyer_download_token ||
    order.fl_record?.buyer_result_storage_path
  )
  if (pcType === 'MPC') return String(order.mpc_record?.task_status || '').toLowerCase() === 'done'
  return Boolean(order.transaction?.can_download)
}

const getFlSellerId = (order: OrderItem) => String(order.transaction?.seller_address || order.buyer_address || '').trim()
const getFlSellerJoinPackage = (order: OrderItem) => {
  const sellerId = getFlSellerId(order)
  return sellerId ? order.fl_record?.seller_join_packages?.[sellerId] || null : null
}
const getLatestSellerGradientPackage = (order: OrderItem) => {
  const sellerId = getFlSellerId(order)
  if (!sellerId) return null
  const sellerPackage = getFlSellerJoinPackage(order)
  const legacyPackages = Array.isArray(sellerPackage?.gradient_packages) ? sellerPackage.gradient_packages : []
  const resultPackages = Object.values(order.fl_record?.seller_result_packages || {})
    .filter((item: any) => (
      item?.seller_id === sellerId &&
      ['fl_gradient', 'fl_gradient_epoch_bundle'].includes(item?.result_role) &&
      item?.download_token
    ))
    .sort((a: any, b: any) => Number(b?.epoch_id ?? b?.batch_index ?? -1) - Number(a?.epoch_id ?? a?.batch_index ?? -1))
  return resultPackages[0] || (legacyPackages.length ? legacyPackages[legacyPackages.length - 1] : null)
}
const getFlBottomModelDownloadKey = (order: OrderItem) => (
  `flBottomDownloaded:${getTransactionId(order)}:${getFlSellerId(order)}`
)
const markFlBottomModelDownloaded = (order: OrderItem) => {
  const transactionId = getTransactionId(order)
  const sellerId = getFlSellerId(order)
  if (!transactionId || !sellerId) return
  localStorage.setItem(getFlBottomModelDownloadKey(order), '1')
}
const autoDownloadFlSellerBottomModel = async (order: OrderItem, privateKeyText: string) => {
  const transactionId = getTransactionId(order)
  const sellerId = getFlSellerId(order)
  const joinPackage = getFlSellerJoinPackage(order)
  if (!transactionId || !sellerId) return
  if (!joinPackage?.download_token) {
    throw new Error('底层模型暂未就绪，请稍后刷新后重试')
  }

  const response: any = await downloadFlPrivacyResult({
    transactionId,
    receiverRole: 'seller',
    sellerId,
    resultRole: 'fl_bottom_model',
  })
  await flCrypto.downloadDecryptedFlResult({
    encryptedTarBuffer: await response.data.arrayBuffer(),
    privateKeyText,
    filename: '',
    resultRole: 'fl_bottom_model',
    transactionId,
    batchIndex: null,
  })
  markFlBottomModelDownloaded(order)
}

const getHiddenHePrivateKeyStorageKey = (transactionId: string) => `mpcHiddenHePrivateKey:${String(transactionId || '')}`

const loadHiddenHePrivateKeyText = (transactionId: string) => {
  return localStorage.getItem(getHiddenHePrivateKeyStorageKey(transactionId)) || ''
}

const saveHiddenHePrivateKeyText = (transactionId: string, privateKeyText: string) => {
  localStorage.setItem(getHiddenHePrivateKeyStorageKey(transactionId), String(privateKeyText || ''))
}

const parseMpcAssetCsvText = (csvText: string, filename = '') => {
  const lines = String(csvText || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    throw new Error(`${filename || 'CSV 文件'} 至少需要表头和一行数据`)
  }

  const headers = lines[0].split(',').map((item) => item.trim())
  const userIdIndex = headers.indexOf('user_id')
  const valueField = ['total_assets', 'asset_value', 'amount', 'balance', 'value']
    .find((field) => headers.includes(field))
  const valueIndex = valueField ? headers.indexOf(valueField) : -1

  if (userIdIndex < 0 || valueIndex < 0) {
    throw new Error(`${filename || 'CSV 文件'} 必须包含 user_id 和 total_assets/asset_value/amount/balance/value 之一`)
  }

  const totalsByUser = new Map<string, number>()
  const userOrder: string[] = []

  for (let i = 1; i < lines.length; i += 1) {
    const columns = lines[i].split(',').map((item) => item.trim())
    const userId = columns[userIdIndex]
    const value = Number(columns[valueIndex])

    if (!userId) {
      throw new Error(`${filename || 'CSV 文件'} 第 ${i + 1} 行缺少 user_id`)
    }

    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${filename || 'CSV 文件'} 第 ${i + 1} 行资产值不是合法非负数字`)
    }

    if (!totalsByUser.has(userId)) {
      userOrder.push(userId)
      totalsByUser.set(userId, 0)
    }

    totalsByUser.set(userId, Number(totalsByUser.get(userId) || 0) + value)
  }

  return { userOrder, totalsByUser }
}

const buildHiddenHeBatchPayload = async (files: File[]) => {
  const parsedFiles = await Promise.all(files.map(async (file) => ({
    file,
    parsed: parseMpcAssetCsvText(await file.text(), file.name),
  })))

  const userIds: string[] = []
  const seenUsers = new Set<string>()

  parsedFiles.forEach(({ parsed }) => {
    parsed.userOrder.forEach((userId) => {
      if (!seenUsers.has(userId)) {
        seenUsers.add(userId)
        userIds.push(userId)
      }
    })
  })

  if (!userIds.length) {
    throw new Error('没有可用于聚合的用户资产数据')
  }

  const heFiles = parsedFiles.map(({ file, parsed }, fileIndex) => {
    const rows = ['value']
    userIds.forEach((userId) => {
      const value = parsed.totalsByUser.get(userId) ?? 0
      rows.push(String(Math.round(value)))
    })

    return new File(
      [rows.join('\n')],
      `he-hidden-${fileIndex + 1}-${file.name.replace(/\.csv$/i, '')}.csv`,
      { type: 'text/csv' },
    )
  })

  return { userIds, heFiles }
}

const ensureHiddenHeContext = async (transactionId: string) => {
  const statusResponse: any = await getHePublicKeyStatus(transactionId)
  const heRecord = statusResponse.data?.item || null
  let privateKeyText = loadHiddenHePrivateKeyText(transactionId)

  if (heRecord?.public_keys_ready && privateKeyText) {
    return { heRecord, privateKeyText }
  }

  if (heRecord?.pcp_contract_id && !privateKeyText) {
    throw new Error('当前交易已存在旧的 HE 公钥，但浏览器没有对应私钥，无法继续隐藏聚合。请使用新的交易重新发起。')
  }

  const keyPairs = await heCrypto.generateHeKeyPairs()
  privateKeyText = heCrypto.serializeHeKeyMaterial({
    algorithm: 'Paillier',
    transactionId,
    keyType: heCrypto.HE_PRIVATE_KEY_TYPE,
    keyMaterial: keyPairs.paillier.privateKey,
  })

  await uploadHePublicKeys({
    transactionId,
    ...heCrypto.buildHePublicKeyPayload(keyPairs),
  })

  saveHiddenHePrivateKeyText(transactionId, privateKeyText)

  const refreshedStatus: any = await getHePublicKeyStatus(transactionId)
  return {
    heRecord: refreshedStatus.data?.item || heRecord,
    privateKeyText,
  }
}

const pollHiddenHeUntilReady = async (transactionId: string, timeoutMs = 180000, intervalMs = 3000) => {
  const startAt = Date.now()

  while (Date.now() - startAt < timeoutMs) {
    const response: any = await getHeStatus(transactionId)
    const item = response.data?.item || null
    const status = String(item?.pcp_status || '').toUpperCase()

    if (status === 'PAM_PASSED' || status === 'COMPLETED') {
      return item
    }

    if (['FAILED', 'PAM_FAILED', 'AUDIT_FAILED'].includes(status)) {
      throw new Error(item?.last_error || `HE 聚合失败，当前状态 ${status}`)
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
  }

  throw new Error('HE 聚合超时，请稍后刷新状态重试')
}

const runHiddenHeAggregation = async (transactionId: string, files: File[]) => {
  const { userIds, heFiles } = await buildHiddenHeBatchPayload(files)
  const { heRecord, privateKeyText } = await ensureHiddenHeContext(transactionId)
  const publicKey = heCrypto.selectHePublicKey(heRecord, 'Paillier')

  if (!publicKey) {
    throw new Error('隐藏 HE 聚合缺少 Paillier 公钥')
  }

  const encryptedFiles = await Promise.all(heFiles.map(async (file) => {
    const encryptedCsvText = await heCrypto.encryptHeCsv({
      algorithm: 'Paillier',
      csvText: await file.text(),
      publicKey,
    })
    return new File([encryptedCsvText], file.name, { type: 'text/csv' })
  }))

  const formData = new FormData()
  formData.append('transactionId', transactionId)
  formData.append('encType', 'Paillier')
  formData.append('operation', 'ADD')
  encryptedFiles.forEach((file, index) => {
    formData.append(`file${index + 1}`, file, file.name)
  })

  await submitHePrivacyDelivery(formData)
  await pollHiddenHeUntilReady(transactionId)

  const resultResponse: any = await downloadHePrivacyResult(transactionId)
  const decryptedCsvText = await heCrypto.decryptHeResultCsv({
    algorithm: 'Paillier',
    encryptedCsvText: await heCsv.blobToText(resultResponse.data),
    privateKeyText,
  })
  const resultLines = String(decryptedCsvText || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (resultLines.length !== userIds.length + 1) {
    throw new Error('HE 聚合结果行数与用户列表不一致')
  }

  const rows = ['user_id,total_assets']
  userIds.forEach((userId, index) => {
    const value = Number(resultLines[index + 1])
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`HE 聚合结果第 ${index + 1} 行不是合法非负数字`)
    }
    rows.push(`${userId},${Math.round(value)}`)
  })

  return new File(
    [rows.join('\n')],
    `asset-threshold-aggregated-${transactionId}.csv`,
    { type: 'text/csv' },
  )
}

const downloadFlSellerGradient = async (order: OrderItem) => {
  if (!ensureDeliveryActive(order)) return
  const transactionId = getTransactionId(order)
  const sellerId = getFlSellerId(order)
  if (!transactionId || !sellerId) return ElMessage.warning('缺少交易ID或卖方地址')
  if (!getLatestSellerGradientPackage(order)) return ElMessage.warning('暂无可下载结果')
  actionLoadingNo.value = `fl-download-${order.order_no}`
  try {
    const response: any = await downloadFlPrivacyResult({
      transactionId,
      receiverRole: 'seller',
      sellerId,
      resultRole: 'fl_gradient',
    })
    flDecryptDialog.visible = true
    flDecryptDialog.order = order
    flDecryptDialog.encryptedBlob = response.data
    flDecryptDialog.privateKeyFile = null
    flDecryptDialog.resultRole = 'fl_gradient'
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || 'FL 结果下载失败')
  } finally {
    actionLoadingNo.value = ''
  }
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
      const res: any = await getFlStatus(transactionId, { entityId: order.transaction?.seller_address || order.buyer_address || '' })
      order.fl_record = res?.data?.item || res?.data?.data?.item || order.fl_record || null
    } else if (pcType === 'MPC') {
      const res: any = await getMpcStatus(transactionId)
      order.mpc_record = extractPrivacyRecord(res) || order.mpc_record || null
    }
  } catch (error: any) {
    if (!silent) ElMessage.error(error?.response?.data?.message || error?.message || '状态同步失败')
  }
}

const openBuyerDelivery = async (order: OrderItem) => {
  const pcType = getPcType(order)
  if (pcType === 'HE') return submitHeBuyerRequest(order)
  if (pcType === 'PRE') return submitPreBuyerRequest(order)
  if (pcType === 'FL') {
    flBuyerDialog.visible = true
    flBuyerDialog.order = order
    flBuyerDialog.topModelFile = null
    flBuyerDialog.bottomModelFile = null
    return
  }
  if (pcType === 'MPC') {
    mpcBuyerDialog.visible = true
    mpcBuyerDialog.order = order
    mpcBuyerDialog.threshold = Number(order.mpc_record?.compute_params?.threshold || 100000)
    return
  }
  openRequestDialog(order)
}

const openSellerDelivery = async (order: OrderItem) => {
  if (!ensureDeliveryActive(order)) return
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
  actionLoadingNo.value = `buyer-he-${order.order_no}`
  try {
    const keyPairs = await heCrypto.generateHeKeyPairs()
    await uploadHePublicKeys({
      transactionId,
      ...heCrypto.buildHePublicKeyPayload(keyPairs),
    })
    heCrypto.downloadPrivateKeyFile({
      algorithm: 'Paillier',
      transactionId,
      keyMaterial: keyPairs.paillier.privateKey,
    })
    heCrypto.downloadPrivateKeyFile({
      algorithm: 'ElGamal',
      transactionId,
      keyMaterial: keyPairs.elgamal.privateKey,
    })
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
  actionLoadingNo.value = `buyer-pre-${order.order_no}`
  try {
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
  if (!flBuyerDialog.topModelFile || !flBuyerDialog.bottomModelFile) {
    ElMessage.warning('请先选择顶层模型和底层模型初始包')
    return
  }
  flBuyerDialog.submitting = true
  try {
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
  mpcBuyerDialog.submitting = true
  try {
    const formData = new FormData()
    formData.append('transaction_id', transactionId)
    formData.append('threshold', String(mpcBuyerDialog.threshold || 0))
    formData.append('compute_mode', 'asset_threshold_batch')
    const res: any = await createMpcPrivacyTask(formData)
    order.mpc_record = extractPrivacyRecord(res) || order.mpc_record
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
  if (!ensureDeliveryActive(order)) return
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
  if (!ensureDeliveryActive(order)) return
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
  if (!ensureDeliveryActive(order)) return
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
  if (!ensureDeliveryActive(order)) return
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
  if (!ensureDeliveryActive(order)) return
  await syncOrderPrivacyStatus(order, true)
  if (!order.fl_record?.pcp_contract_id) return ElMessage.warning('请等待买方先请求交付')
  const transactionId = getTransactionId(order)
  const sellerId = getFlSellerId(order)
  const sellerPackage = getFlSellerJoinPackage(order)
  if (!sellerPackage?.seller_public_key) {
    const keyMaterial = await flCrypto.generateFlKeyPair()
    await joinFlPrivacyContract({
      transactionId,
      sellerId,
      sellerPublicKey: keyMaterial.publicKeyHex,
    })
    const privateKeyText = flCrypto.serializeFlPrivateKeyMaterial({
      role: 'seller',
      transactionId,
      privateKeyPem: keyMaterial.privateKeyPem,
    })
    flCrypto.downloadFlPrivateKeyFile({ role: 'seller', transactionId, privateKeyPem: keyMaterial.privateKeyPem })
    await syncOrderPrivacyStatus(order, true)
    await autoDownloadFlSellerBottomModel(order, privateKeyText)
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
  if (!ensureDeliveryActive(order)) return
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
  if (!ensureDeliveryActive(order)) return
  if (!mpcSellerDialog.files.length) return ElMessage.warning('请先选择资产数据文件')
  mpcSellerDialog.submitting = true
  actionLoadingNo.value = order.order_no
  mpcNoticeDialog.message = '资产交付正在进行中，请勿退出账户或关闭浏览器。'
  mpcNoticeDialog.visible = true
  try {
    if (mpcSellerDialog.files.some((file) => !String(file.name || '').toLowerCase().endsWith('.csv'))) {
      ElMessage.warning('仅支持上传 CSV 文件')
      return
    }
    const aggregatedFile = await runHiddenHeAggregation(transactionId, [...mpcSellerDialog.files])
    const formData = new FormData()
    formData.append('transaction_id', transactionId)
    formData.append('files', aggregatedFile, aggregatedFile.name)
    const res: any = await submitMpcSellerData(formData)
    order.mpc_record = extractPrivacyRecord(res) || order.mpc_record
    await syncOrderPrivacyStatus(order, true)
    mpcSellerDialog.visible = false
    mpcNoticeDialog.message = '交付材料已提交，后续计算将在后台继续，现在可以关闭浏览器或退出账户。'
    mpcNoticeDialog.visible = true
    ElMessage.success(res?.data?.message || 'MPC 交付已提交')
  } catch (error: any) {
    mpcNoticeDialog.visible = false
    ElMessage.error(error?.response?.data?.message || error?.message || 'MPC 执行交付失败')
  } finally {
    mpcSellerDialog.submitting = false
    actionLoadingNo.value = ''
  }
}

const rejectPaidOrder = async (order: OrderItem) => {
  try { await ElMessageBox.confirm('拒绝后将关闭订单、恢复库存并退回买家余额。', '拒绝订单', { type: 'warning' }) }
  catch { return }
  actionLoadingNo.value = order.order_no
  try {
    const result = await rejectOrder(order.order_no)
    if (result.data.status !== 0) throw new Error(result.data.message || '拒绝订单失败')
    ElMessage.success('订单已关闭，余额已退回')
    await fetchOrders()
  } catch (error: any) { ElMessage.error(error?.response?.data?.message || error?.message || '拒绝订单失败') }
  finally { actionLoadingNo.value = '' }
}

const fetchOrders = async () => {
  loading.value = true
  try {
    const order_role = roleKey === 'seller' ? 'seller' : roleKey === 'buyer' ? 'buyer' : 'both'
    const res = await getOrderList({
      ...query,
      order_role,
      keyword: currentOrderNo.value || activeKeyword.value,
    })
    if (res.data.status === 0) {
      const list = res.data.data?.list || []
      const filteredList = currentOrderNo.value ? list.filter((item: OrderItem) => item.order_no === currentOrderNo.value) : list
      const hydrated = await Promise.all(filteredList.map(async (item: OrderItem) => {
        await syncOrderPrivacyStatus(item, true)
        if (roleKey === 'seller') return item
        try {
          const eligibleRes: any = await getDeliveryExportEligible(item.order_no)
          return {
            ...item,
            transaction: {
              ...(item.transaction || {}),
              can_download: Boolean(eligibleRes?.data?.data?.can_download),
              export_payload: eligibleRes?.data?.data?.item || null,
            },
          }
        } catch (_error) {
          return {
            ...item,
            transaction: {
              ...(item.transaction || {}),
              can_download: false,
              export_payload: null,
            },
          }
        }
      }))
      orders.value = hydrated
      const p = res.data.data?.pagination || {}
      pagination.page = p.page || 1
      pagination.page_size = p.page_size || query.page_size
      pagination.total = currentOrderNo.value ? hydrated.length : p.total || 0
    } else {
      ElMessage.error(res.data.message || '获取订单失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '获取订单失败')
  } finally {
    loading.value = false
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
      const res: any = await getMpcPrivacyResult(transactionId)
      mpcResultDialog.order = order
      mpcResultDialog.result = res?.data?.data?.result || res?.data?.result || {}
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
    ElMessage.error(error?.response?.data?.message || '下载结果失败')
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
  if (!heDecryptDialog.privateKeyFile || !heDecryptDialog.order) return ElMessage.warning('请先选择解密文件')
  heDecryptDialog.processing = true
  try {
    const privateKeyText = await heDecryptDialog.privateKeyFile.text()
    const csvText = await heCrypto.decryptHeResultCsv({
      algorithm: heDecryptDialog.algorithm,
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
    ElMessage.error(error?.message || 'HE 结果解密失败')
  } finally {
    heDecryptDialog.processing = false
  }
}

const onPrePrivateKeyChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  preDecryptDialog.privateKeyFile = target.files?.[0] || null
  target.value = ''
}

const confirmPreDecryptResult = async () => {
  if (!preDecryptDialog.privateKeyFile || !preDecryptDialog.order || !preDecryptDialog.encryptedBlob) {
    return ElMessage.warning('请先选择 PRE 私钥文件')
  }
  preDecryptDialog.processing = true
  try {
    const privateKeyText = await preDecryptDialog.privateKeyFile.text()
    const encryptedBuffer = await preDecryptDialog.encryptedBlob.arrayBuffer()
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
    ElMessage.error(error?.response?.data?.message || error?.message || 'PRE 结果解密失败')
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
  width: min(100%, 1240px);
  min-height: calc(100vh - 112px);
  padding: 24px 24px 48px;
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

.toolbar-section,
.table-section {
  border: 1px solid #e4e8f0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(18, 41, 79, 0.06);
}

.toolbar-section {
  padding: 10px 12px;
  margin-bottom: 10px;
}

.table-section {
  padding: 10px 12px 12px;
}

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

.seller-delivery-table th:nth-child(3),
.seller-delivery-table td:nth-child(3) {
  width: 10%;
}

.seller-delivery-table th:last-child,
.seller-delivery-table td:last-child {
  width: 27%;
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

.styled-table th {
  background: #f8fafc;
  color: #1f2328;
  font-size: 12px;
  font-weight: 700;
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
  font-size: 12px;
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
