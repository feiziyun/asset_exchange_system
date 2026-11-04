<template>
  <el-dialog v-model="dialogVisible" title="价值评估" width="min(760px, 92vw)" class="asset-valuation-dialog valuation-modal">
    <div class="valuation-control-row">
      <div class="valuation-method-select">
        <label for="valuation-method">估值方法</label>
        <el-select id="valuation-method" v-model="selectedValuationMethod">
          <el-option
            v-for="option in valuationMethodOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
      <div class="valuation-toolbar-actions">
        <el-button @click="resetValuationToDefaults">重置为默认参数</el-button>
        <el-button type="primary" plain @click="useValuationExample">使用示例参数</el-button>
      </div>
    </div>

    <div class="valuation-form">
      <details v-if="selectedValuationSection" class="valuation-method-box" open>
        <summary>{{ selectedValuationSection.title }}</summary>
        <div class="valuation-method-body">
          <div
            v-for="field in selectedValuationSection.fields"
            :key="field.key"
            class="valuation-field"
            :class="{ 'span-2': field.span === 2 }"
          >
            <label :for="field.key">{{ field.label }}</label>
            <el-input
              v-if="field.type === 'textarea'"
              :id="field.key"
              v-model="params[field.key]"
              type="textarea"
              :rows="3"
              :placeholder="field.placeholder || ''"
            />
            <el-input
              v-else-if="field.type === 'text'"
              :id="field.key"
              v-model="params[field.key]"
              :placeholder="field.placeholder || ''"
            />
            <el-input-number
              v-else
              :id="field.key"
              v-model="params[field.key]"
              :step="field.step || 0.01"
              :min="field.min"
              :max="field.max"
              class="valuation-number-input"
            />
            <div v-if="field.hint" class="valuation-hint">{{ field.hint }}</div>
          </div>
          <div v-if="selectedValuationSection.note" class="valuation-field span-2">
            <label>{{ selectedValuationSection.noteLabel || '说明' }}</label>
            <div class="valuation-hint">{{ selectedValuationSection.note }}</div>
          </div>
        </div>
      </details>
    </div>

    <div class="button-container">
      <el-button type="primary" :loading="valuationCalculating" @click="submitValuation">提交计算</el-button>
      <el-button @click="dialogVisible = false">关闭</el-button>
    </div>
  </el-dialog>

  <el-dialog
    v-model="resultDialogVisible"
    title="计算结果"
    width="min(760px, 92vw)"
    class="asset-valuation-dialog asset-valuation-result-dialog valuation-result-modal"
  >
    <div class="valuation-result-panel">
      <div class="valuation-result-status" :class="{ 'has-errors': valuationHasErrors }">
        {{ valuationResultStatus }}
      </div>
      <div class="valuation-result-wrap">
        <table class="valuation-result-table">
          <thead>
            <tr>
              <th>方法</th>
              <th v-if="!isMlQwenResult">公式</th>
              <th v-if="!isMlQwenResult">关键中间项</th>
              <th>{{ isMlQwenResult ? '估值等级/范围' : '估值结果/范围（万元）' }}</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in valuationMethodResults" :key="item.methodName">
              <tr>
                <td>{{ item.methodName }}</td>
                <td v-if="!isMlQwenResult" class="mono-cell">{{ item.formulaText }}</td>
                <td v-if="!isMlQwenResult">
                  <ul class="valuation-intermediate-list">
                    <li v-for="(line, idx) in item.intermediates" :key="idx" class="mono-cell">{{ line }}</li>
                  </ul>
                </td>
                <td>
                  <span v-if="item.valuation === null && valuationResultDetail?.valuationLevel" class="mono-cell">
                    {{ valuationResultDetail.valuationRange || valuationResultDetail.valuationLevelName }}
                  </span>
                  <span v-else-if="item.valuation === null" class="warn-text">不可计算</span>
                  <span v-else class="mono-cell">{{ formatNum(item.valuation) }}</span>
                </td>
                <td>{{ item.valuation === null && valuationResultDetail?.valuationLevel ? '估值成功' : (item.valuation === null ? '请修正输入' : '计算成功') }}</td>
              </tr>
              <tr class="valuation-note-row">
                <td :colspan="isMlQwenResult ? 3 : 5"><strong>{{ isMlQwenResult ? '备注' : '公式备注' }}：</strong>{{ item.notes }}</td>
              </tr>
              <tr v-if="valuationResultDetail?.valuationLevel" class="valuation-note-row">
                <td :colspan="isMlQwenResult ? 3 : 5">
                  <strong>估值等级：</strong>
                  {{ valuationResultDetail.valuationLevelName }} / {{ valuationResultDetail.valuationCategory }}
                  <span v-if="valuationResultDetail.valuationRange"> / 估值范围：{{ valuationResultDetail.valuationRange }}</span>
                  <span v-if="valuationResultDetail.modelVersion">（模型版本：{{ valuationResultDetail.modelVersion }}）</span>
                  <ul v-if="valuationResultDetail.basis?.length" class="valuation-intermediate-list">
                    <li v-for="(line, idx) in valuationResultDetail.basis" :key="idx">{{ line }}</li>
                  </ul>
                </td>
              </tr>
            </template>
            <tr v-if="valuationMethodResults.length === 0">
              <td :colspan="isMlQwenResult ? 3 : 5">暂无结果</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="button-container">
        <el-button
          type="primary"
          :disabled="valuationSaving || !valuationMethodResults.length || valuationMethodResults[0].valuation === null"
          :loading="valuationSaving"
          @click="saveCurrentValuationRecord"
        >
          保存估值记录
        </el-button>
        <el-button type="primary" @click="resultDialogVisible = false">确认</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import axios from 'axios'
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { saveAssetValuationRecord } from '@/api/asset'

type AssetLike = {
  id?: number
  asset_name?: string
  description?: string
  file_hash?: string
  price?: number
}

const props = defineProps<{
  visible: boolean
  asset?: AssetLike | null
  username?: string
  userId?: number | string | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'price-updated', value: number): void
  (e: 'saved', payload: { record_no: string }): void
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const valuationMethodOptions = [
  { value: 'ml_qwen_opensea', label: 'Qwen增强机器学习估值' },
  { value: 'cost', label: '成本法' },
  { value: 'income', label: '收益法' },
  { value: 'market', label: '市场法' },
  { value: 'hybrid', label: '综合法' },
  { value: 'comparison', label: '比较法' },
  { value: 'technical', label: '技术分析法' },
  { value: 'dcf', label: 'DCF估值法' },
  { value: 'ahp', label: '层次分析法(AHP)' },
]

const valuationSections = [
  {
    method: 'ml_qwen_opensea',
    title: 'OpenSea 产品信息（Qwen增强机器学习估值）',
    fields: [
      { key: 'openseaAssetName', label: '物品名称', type: 'text', span: 2, placeholder: '请输入 qwen_features_with_names.csv 中的物品名称', hint: '服务器将使用已提取的 OpenSea/Twitter/Qwen 特征。' },
      { key: 'openseaCollectionName', label: '集合名称', type: 'text', span: 2, placeholder: '可选，用于估值记录展示' },
      { key: 'openseaDescription', label: '产品描述', type: 'textarea', span: 2, placeholder: '可选；机器学习估值使用服务器端已提取的 Qwen 特征。' },
    ],
    noteLabel: '模型估值说明',
    note: '该方法使用服务器端已提取的 Qwen 特征及 OpenSea/Twitter 结构化特征，输出五档估值等级。',
  },
  {
    method: 'cost',
    title: '成本法参数',
    fields: [
      { key: 'cOneoff', label: '一次性投入成本（万元）', min: 0, step: 0.01 },
      { key: 'cOngoing', label: '持续性投入成本（万元）', min: 0, step: 0.01 },
      { key: 'cQualityEval', label: '质量评估成本（万元）', min: 0, step: 0.01 },
      { key: 'cQualityImprove', label: '质量提升成本（万元）', min: 0, step: 0.01 },
      { key: 'cProduct', label: '数据产品化成本（万元）', min: 0, step: 0.01 },
      { key: 'completenessPct', label: '完整性（%）', min: 0, max: 100, step: 0.01 },
      { key: 'accuracyPct', label: '准确性（%）', min: 0, max: 100, step: 0.01 },
      { key: 'consistencyPct', label: '一致性（%）', min: 0, max: 100, step: 0.01 },
      { key: 'coveragePct', label: '覆盖度（%）', min: 0, max: 100, step: 0.01 },
    ],
  },
  {
    method: 'income',
    title: '收益法参数（多期折现 NPV）',
    fields: [
      { key: 'rfPct', label: '无风险收益率 rf（%）', min: 0, step: 0.01 },
      { key: 'rmPct', label: '市场平均收益率 rm（%）', min: 0, step: 0.01 },
      { key: 'beta', label: '市场风险暴露系数 beta', min: 0, max: 3, step: 0.01 },
      { key: 'growthPct', label: '经济增长率 g（%）', min: 0, step: 0.01 },
      { key: 'scope', label: '应用范围 scope（1~5）', min: 1, max: 5, step: 1 },
      { key: 'horizonN', label: '预测年限 N（1~10）', min: 1, max: 10, step: 1 },
      { key: 'cashFlows', label: '未来现金流 CF（按年逗号分隔，单位万元）', type: 'textarea', span: 2, placeholder: '例如：120, 135, 150', hint: '条目数量建议与 N 相同' },
    ],
  },
  {
    method: 'market',
    title: '市场法参数（可比均价乘调整系数）',
    fields: [
      { key: 'comparableTotalPrice', label: '可比样本总成交价（万元）', min: 0, step: 0.01 },
      { key: 'comparableCount', label: '可比样本数量（个）', min: 1, step: 1 },
      { key: 'targetSize', label: '评估对象规模（GB）', min: 0.01, step: 0.01 },
      { key: 'comparableSize', label: '可比对象规模（GB）', min: 0.01, step: 0.01 },
      { key: 'kQuality', label: '质量系数 K_quality（>0）', min: 0.01, step: 0.01 },
      { key: 'kCoverage', label: '覆盖系数 K_coverage（>0）', min: 0.01, step: 0.01 },
      { key: 'kTimeliness', label: '时效系数 K_timeliness（>0）', min: 0.01, step: 0.01 },
    ],
  },
  {
    method: 'hybrid',
    title: '综合法参数（成本基准乘双因子）',
    fields: [
      { key: 'hybridGrowthPct', label: '经济增长率 g（%）', min: 0, step: 0.01 },
      { key: 'hybridScope', label: '应用范围 scope（1~5）', min: 1, max: 5, step: 1 },
      { key: 'hybridN', label: '预测年限 N（1~10）', min: 1, max: 10, step: 1 },
      { key: 'alpha', label: '社会价值调节系数 alpha（>0）', min: 0.01, step: 0.01 },
      { key: 'downloads', label: '下载量（次，>=0）', min: 0, step: 1 },
    ],
  },
  {
    method: 'comparison',
    title: '比较法参数（可比样本加权均价修正）',
    fields: [
      { key: 'compPrices', label: '可比样本成交价 P_i（万元，逗号分隔）', type: 'textarea', span: 2, placeholder: '例如：820, 860, 910' },
      { key: 'compWeights', label: '相似度权重 w_i（逗号分隔，需与价格一一对应）', type: 'textarea', span: 2, placeholder: '例如：0.9, 0.8, 0.95', hint: '样本数量需与 P_i 一致，且每个权重 > 0' },
      { key: 'targetFeatureIndex', label: '目标对象特征指数 I_target（>0）', min: 0.01, step: 0.01 },
      { key: 'comparableFeatureIndex', label: '可比对象特征指数 I_comp（>0）', min: 0.01, step: 0.01 },
    ],
  },
  {
    method: 'technical',
    title: '技术分析法参数（趋势/动量/波动/流动性）',
    fields: [
      { key: 'taCurrentPrice', label: '当前市场价格（万元）', min: 0.01, step: 0.01 },
      { key: 'taMa20', label: '20期均价 MA20（万元）', min: 0.01, step: 0.01 },
      { key: 'taMa60', label: '60期均价 MA60（万元）', min: 0.01, step: 0.01 },
      { key: 'taMomentumPct', label: '动量因子（%，-100~200）', min: -100, max: 200, step: 0.01 },
      { key: 'taVolatilityPct', label: '波动率（%，0~200）', min: 0, max: 200, step: 0.01 },
      { key: 'taLiquidityScore', label: '流动性评分（1~10）', min: 1, max: 10, step: 1 },
    ],
  },
  {
    method: 'dcf',
    title: 'DCF估值法参数（分期现金流+终值）',
    fields: [
      { key: 'dcfDiscountRatePct', label: '折现率 r（%，>0）', min: 0.01, step: 0.01 },
      { key: 'dcfTerminalGrowthPct', label: '永续增长率 g（%，>=0）', min: 0, step: 0.01 },
      { key: 'dcfHorizonN', label: '预测年限 N（1~10）', min: 1, max: 10, step: 1 },
      { key: 'dcfCashFlows', label: '未来自由现金流 FCF（逗号分隔，单位万元）', type: 'textarea', span: 2, placeholder: '例如：180, 210, 245, 275, 310', hint: '条目数量需与 N 一致，且 r 必须大于 g' },
    ],
  },
  {
    method: 'ahp',
    title: '层次分析法（AHP）参数',
    fields: [
      { key: 'ahpRelCost', label: '方法可靠度 r1（成本法，1~9）', min: 1, max: 9, step: 0.01 },
      { key: 'ahpRelIncome', label: '方法可靠度 r2（收益法，1~9）', min: 1, max: 9, step: 0.01 },
      { key: 'ahpRelMarket', label: '方法可靠度 r3（市场法，1~9）', min: 1, max: 9, step: 0.01 },
      { key: 'ahpRelHybrid', label: '方法可靠度 r4（综合法，1~9）', min: 1, max: 9, step: 0.01 },
      { key: 'ahpRelComparison', label: '方法可靠度 r5（比较法，1~9）', min: 1, max: 9, step: 0.01 },
    ],
    noteLabel: 'AHP 综合说明',
    note: 'AHP 方法按 a_ij=r_i/r_j 构造方法层判断矩阵，并基于前5法（成本/收益/市场/综合/比较）做加权融合。',
  },
]

const valuationDefaults = {
  openseaAssetName: '', openseaCollectionName: '', openseaDescription: '',
  cOneoff: 180, cOngoing: 85, cQualityEval: 22, cQualityImprove: 28, cProduct: 62,
  completenessPct: 92, accuracyPct: 88, consistencyPct: 90, coveragePct: 84,
  rfPct: 2.1, rmPct: 8.3, beta: 1.2, growthPct: 5.5, scope: 4, horizonN: 3, cashFlows: '120, 138, 156',
  comparableTotalPrice: 940, comparableCount: 8, targetSize: 2.4, comparableSize: 2.1, kQuality: 1.08, kCoverage: 1.04, kTimeliness: 0.97,
  hybridGrowthPct: 6.2, hybridScope: 4, hybridN: 3, alpha: 0.36, downloads: 22000,
  compPrices: '820, 860, 910', compWeights: '0.9, 0.8, 0.95', targetFeatureIndex: 1.06, comparableFeatureIndex: 1,
  taCurrentPrice: 980, taMa20: 960, taMa60: 920, taMomentumPct: 6, taVolatilityPct: 18, taLiquidityScore: 7,
  dcfDiscountRatePct: 12, dcfTerminalGrowthPct: 3, dcfHorizonN: 5, dcfCashFlows: '180, 210, 245, 275, 310',
  ahpRelCost: 7.5, ahpRelIncome: 8, ahpRelMarket: 6.5, ahpRelHybrid: 7, ahpRelComparison: 6,
}

const valuationExample = {
  openseaAssetName: 'More Rips #1/1', openseaCollectionName: '示例集合', openseaDescription: '使用服务器端已提取 Qwen full feature 的机器学习估值示例。',
  cOneoff: 220, cOngoing: 98, cQualityEval: 27, cQualityImprove: 33, cProduct: 75,
  completenessPct: 95, accuracyPct: 91, consistencyPct: 89, coveragePct: 87,
  rfPct: 1.9, rmPct: 9.1, beta: 1.35, growthPct: 6.1, scope: 5, horizonN: 4, cashFlows: '136, 152, 170, 194',
  comparableTotalPrice: 1260, comparableCount: 9, targetSize: 2.9, comparableSize: 2.3, kQuality: 1.1, kCoverage: 1.12, kTimeliness: 1.03,
  hybridGrowthPct: 6.6, hybridScope: 5, hybridN: 4, alpha: 0.42, downloads: 46000,
  compPrices: '980, 1050, 1120, 1080', compWeights: '0.82, 0.9, 0.88, 0.93', targetFeatureIndex: 1.1, comparableFeatureIndex: 1.02,
  taCurrentPrice: 1120, taMa20: 1080, taMa60: 1005, taMomentumPct: 9, taVolatilityPct: 22, taLiquidityScore: 8,
  dcfDiscountRatePct: 11.5, dcfTerminalGrowthPct: 3.2, dcfHorizonN: 5, dcfCashFlows: '220, 255, 295, 338, 380',
  ahpRelCost: 8, ahpRelIncome: 8.6, ahpRelMarket: 7.2, ahpRelHybrid: 7.8, ahpRelComparison: 6.8,
}

const selectedValuationMethod = ref('cost')
const params = reactive<any>({ ...valuationDefaults })
const valuationMethodResults = ref<any[]>([])
const valuationResultStatus = ref('输入有效，结果已更新')
const valuationHasErrors = ref(false)
const valuationSaving = ref(false)
const valuationCalculating = ref(false)
const resultDialogVisible = ref(false)
const valuationResultDetail = ref<any>(null)
const lastValuationInputSnapshot = ref<Record<string, any> | null>(null)
const valuationModelApiUrl =
  import.meta.env.VITE_VALUATION_MODEL_API_URL ||
  (typeof window !== 'undefined' && (window as any).__VALUATION_MODEL_API_URL__) ||
  'http://127.0.0.1:8039/predict'

const selectedValuationSection = computed(() => valuationSections.find((item) => item.method === selectedValuationMethod.value) || null)
const isMlQwenResult = computed(() => selectedValuationMethod.value === 'ml_qwen_opensea')
const formatNum = (value: number, digits = 2) => Number(value).toFixed(digits)
const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

const resetValuationToDefaults = () => {
  Object.assign(params, valuationDefaults)
}

const useValuationExample = () => {
  Object.assign(params, valuationExample)
}

const getMethodLabel = (key: string) => {
  const hit = valuationMethodOptions.find((item) => item.value === key)
  return hit?.label || key
}

const buildErrorResult = (methodName: string, errors: string[]) => ({
  methodName,
  formulaText: '-',
  intermediates: errors,
  valuation: null,
  notes: '该方法输入存在错误，请根据提示修正后重算。',
})

const calculateCost = (input: any) => {
  const sourceCost = input.cOneoff + input.cOngoing
  const devCost = sourceCost + input.cQualityEval + input.cQualityImprove + input.cProduct
  const qualityFactor = (input.completeness + input.accuracy + input.consistency + input.coverage) / 400
  const valuation = devCost * qualityFactor
  return { methodName: '成本法', formulaText: 'V_cost=(C_source+C_quality_eval+C_quality_improve+C_product)*Q_factor', intermediates: [`C_source=${formatNum(sourceCost)}`, `开发成本合计=${formatNum(devCost)}`, `Q_factor=${formatNum(qualityFactor, 4)}`, `V_cost=${formatNum(valuation)}`], valuation, notes: 'Q_factor=(完整性+准确性+一致性+覆盖度)/400。' }
}
const calculateIncome = (input: any) => {
  const discountRate = input.rf + input.beta * (input.rm - input.rf)
  const npv = input.cashFlows.reduce((sum: number, cashFlow: number, index: number) => sum + cashFlow / Math.pow(1 + discountRate, index + 1), 0)
  const economicFactor = Math.pow(1 + input.g, input.n) * (input.scope / 5)
  const valuation = npv * economicFactor
  return { methodName: '收益法', formulaText: 'r=rf+beta(rm-rf), NPV=Σ(CF_t/(1+r)^t), V_income=NPV*E_factor', intermediates: [`折现率r=${formatPercent(discountRate)}`, `NPV=${formatNum(npv)}`, `E_factor=${formatNum(economicFactor, 4)}`, `V_income=${formatNum(valuation)}`], valuation, notes: 'E_factor=(1+g)^N*(scope/5)，scope 依据应用场景覆盖广度。' }
}
const calculateMarket = (input: any) => {
  const averagePrice = input.comparableTotalPrice / input.comparableCount
  const scaleFactor = input.targetSize / input.comparableSize
  const adjustFactor = input.kQuality * input.kCoverage * input.kTimeliness
  const valuation = averagePrice * scaleFactor * adjustFactor
  return { methodName: '市场法', formulaText: 'V_market=P_avg*Scale*K_quality*K_coverage*K_timeliness', intermediates: [`P_avg=${formatNum(averagePrice)}`, `Scale=${formatNum(scaleFactor, 4)}`, `调整系数乘积=${formatNum(adjustFactor, 4)}`, `V_market=${formatNum(valuation)}`], valuation, notes: '可比均价基于交易样本，质量/覆盖/时效系数用于差异修正。' }
}
const calculateHybrid = (input: any, shared: any) => {
  const devBase = shared.cOneoff + shared.cOngoing + shared.cQualityEval + shared.cQualityImprove + shared.cProduct
  const economicFactor = Math.pow(1 + input.g, input.n) * (input.scope / 5)
  const socialFactor = 1 + input.alpha * Math.log(1 + input.downloads / 1000)
  const valuation = devBase * economicFactor * socialFactor
  return { methodName: '综合法', formulaText: 'V_hybrid=V_dev_base*E_factor*S_factor', intermediates: [`V_dev_base=${formatNum(devBase)}`, `E_factor=${formatNum(economicFactor, 4)}`, `S_factor=${formatNum(socialFactor, 4)}`, `V_hybrid=${formatNum(valuation)}`], valuation, notes: 'S_factor=1+alpha*ln(1+downloads/1000)，体现下载量边际递减。' }
}
const calculateComparison = (input: any) => {
  const weightedPriceSum = input.prices.reduce((sum: number, price: number, index: number) => sum + price * input.weights[index], 0)
  const weightSum = input.weights.reduce((sum: number, weight: number) => sum + weight, 0)
  const weightedAveragePrice = weightedPriceSum / weightSum
  const featureFactor = input.targetFeatureIndex / input.comparableFeatureIndex
  const valuation = weightedAveragePrice * featureFactor
  return { methodName: '比较法', formulaText: 'V_compare=(Σ(P_i*w_i)/Σw_i)*(I_target/I_comp)', intermediates: [`样本数量n=${input.prices.length}`, `加权均价=${formatNum(weightedAveragePrice)}`, `特征修正系数=${formatNum(featureFactor, 4)}`, `V_compare=${formatNum(valuation)}`], valuation, notes: '比较法采用可比样本加权均价，并按目标/可比特征指数进行修正。' }
}
const calculateTechnical = (input: any) => {
  const trendFactor = input.ma20 / input.ma60
  const momentumFactor = 1 + input.momentum
  const volatilityPenalty = 1 / (1 + input.volatility)
  const liquidityFactor = 0.8 + (input.liquidityScore / 10) * 0.4
  const valuation = input.currentPrice * trendFactor * momentumFactor * volatilityPenalty * liquidityFactor
  return { methodName: '技术分析法', formulaText: 'V_tech=P_now*(MA20/MA60)*(1+M)*1/(1+σ)*L_factor', intermediates: [`趋势因子(MA20/MA60)=${formatNum(trendFactor, 4)}`, `动量因子(1+M)=${formatNum(momentumFactor, 4)}`, `波动惩罚因子=${formatNum(volatilityPenalty, 4)}`, `流动性因子=${formatNum(liquidityFactor, 4)}`, `V_tech=${formatNum(valuation)}`], valuation, notes: '技术分析法结合趋势、动量、波动率和流动性进行价格修正，适用于有市场行为数据的资产。' }
}
const calculateDcf = (input: any) => {
  const pvStage = input.cashFlows.reduce((sum: number, cashFlow: number, index: number) => sum + cashFlow / Math.pow(1 + input.discountRate, index + 1), 0)
  const lastCashFlow = input.cashFlows[input.cashFlows.length - 1]
  const terminalValue = (lastCashFlow * (1 + input.terminalGrowth)) / (input.discountRate - input.terminalGrowth)
  const pvTerminal = terminalValue / Math.pow(1 + input.discountRate, input.n)
  const valuation = pvStage + pvTerminal
  return { methodName: 'DCF估值法', formulaText: 'V_dcf=Σ(FCF_t/(1+r)^t)+[FCF_N*(1+g)/(r-g)]/(1+r)^N', intermediates: [`阶段现值PV_stage=${formatNum(pvStage)}`, `终值TV=${formatNum(terminalValue)}`, `终值现值PV_terminal=${formatNum(pvTerminal)}`, `V_dcf=${formatNum(valuation)}`], valuation, notes: 'DCF法基于现金流折现与永续增长终值；为保证模型稳定性，要求 r > g。' }
}
const calculateAHP = (input: any, baseResults: any[]) => {
  const methodValues = baseResults.map((item) => item.valuation)
  const reliability = [input.relCost, input.relIncome, input.relMarket, input.relHybrid, input.relComparison]
  const n = reliability.length
  const matrix = reliability.map((ri: number) => reliability.map((rj: number) => ri / rj))
  const geoMeans = matrix.map((row: number[]) => Math.pow(row.reduce((product, value) => product * value, 1), 1 / n))
  const totalGeoMean = geoMeans.reduce((sum: number, value: number) => sum + value, 0)
  const weights = geoMeans.map((value: number) => value / totalGeoMean)
  const valuation = methodValues.reduce((sum: number, value: number, index: number) => sum + weights[index] * value, 0)
  const aw = matrix.map((row: number[], rowIndex: number) => row.reduce((sum, value, colIndex) => sum + value * weights[colIndex], 0))
  const lambdaMax = aw.reduce((sum: number, value: number, index: number) => sum + value / weights[index], 0) / n
  const ci = (lambdaMax - n) / (n - 1)
  const ri = 1.12
  const cr = ci / ri
  const consistencyNote = cr <= 0.1 ? 'CR<=0.10，一致性可接受' : 'CR>0.10，建议调整方法可靠度参数'
  return { methodName: '层次分析法(AHP)', formulaText: 'a_ij=r_i/r_j, w_i=(Πa_ij)^(1/n)/Σ((Πa_ij)^(1/n)), V_ahp=Σ(w_i*V_i)', intermediates: [`前5法估值=(${baseResults.map((item) => `${item.methodName}:${formatNum(item.valuation)}`).join('、')})`, `方法权重w=(${weights.map((item: number) => formatNum(item, 4)).join(', ')})`, `λ_max=${formatNum(lambdaMax, 4)}, CI=${formatNum(ci, 4)}, CR=${formatNum(cr, 4)}`, `V_ahp=${formatNum(valuation)}`], valuation, notes: `AHP基于前5种方法估值结果赋权融合。${consistencyNote}` }
}

const validateValuationInputs = (raw: any) => {
  const state: any = { fieldErrors: {}, methodErrors: { cost: [], income: [], market: [], hybrid: [], comparison: [], technical: [], dcf: [], ahp: [] }, values: {}, errorCount: 0 }
  const addError = (field: string, message: string, methods: string[]) => {
    if (!state.fieldErrors[field]) state.fieldErrors[field] = message
    methods.forEach((name) => state.methodErrors[name].push(message))
    state.errorCount += 1
  }
  const asNumber = (value: any) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : NaN
  }
  const asNumberList = (value: any) => String(value || '').split(/[,\s]+/).map((item) => item.trim()).filter(Boolean).map((item) => Number(item))

  ;[
    ['cOneoff', '一次性投入成本', ['cost', 'hybrid']], ['cOngoing', '持续性投入成本', ['cost', 'hybrid']], ['cQualityEval', '质量评估成本', ['cost', 'hybrid']], ['cQualityImprove', '质量提升成本', ['cost', 'hybrid']], ['cProduct', '数据产品化成本', ['cost', 'hybrid']], ['comparableTotalPrice', '可比样本总成交价', ['market']], ['downloads', '下载量', ['hybrid']],
  ].forEach(([field, label, methods]: any) => {
    const value = asNumber(raw[field]); if (Number.isNaN(value)) return addError(field, `${label}必须为数字`, methods); if (value < 0) addError(field, `${label}不能小于0`, methods)
  })
  ;[
    ['completenessPct', '完整性', ['cost']], ['accuracyPct', '准确性', ['cost']], ['consistencyPct', '一致性', ['cost']], ['coveragePct', '覆盖度', ['cost']], ['rfPct', '无风险收益率', ['income']], ['rmPct', '市场平均收益率', ['income']], ['growthPct', '经济增长率', ['income']], ['hybridGrowthPct', '综合法经济增长率', ['hybrid']],
  ].forEach(([field, label, methods]: any) => {
    const value = asNumber(raw[field]); if (Number.isNaN(value)) return addError(field, `${label}必须为数字`, methods); if (value < 0 || value > 100) addError(field, `${label}应在0~100之间`, methods)
  })
  const taMomentum = asNumber(raw.taMomentumPct); if (Number.isNaN(taMomentum)) addError('taMomentumPct', '动量因子必须为数字', ['technical']); else if (taMomentum < -100 || taMomentum > 200) addError('taMomentumPct', '动量因子应在-100~200之间', ['technical'])
  const taVolatility = asNumber(raw.taVolatilityPct); if (Number.isNaN(taVolatility)) addError('taVolatilityPct', '波动率必须为数字', ['technical']); else if (taVolatility < 0 || taVolatility > 200) addError('taVolatilityPct', '波动率应在0~200之间', ['technical'])
  const dcfDiscountRate = asNumber(raw.dcfDiscountRatePct); if (Number.isNaN(dcfDiscountRate)) addError('dcfDiscountRatePct', 'DCF折现率必须为数字', ['dcf']); else if (dcfDiscountRate <= 0 || dcfDiscountRate > 100) addError('dcfDiscountRatePct', 'DCF折现率应在0~100之间且大于0', ['dcf'])
  const dcfTerminalGrowth = asNumber(raw.dcfTerminalGrowthPct); if (Number.isNaN(dcfTerminalGrowth)) addError('dcfTerminalGrowthPct', 'DCF永续增长率必须为数字', ['dcf']); else if (dcfTerminalGrowth < 0 || dcfTerminalGrowth >= 100) addError('dcfTerminalGrowthPct', 'DCF永续增长率应在0~100之间', ['dcf'])
  ;[
    ['scope', '应用范围 scope', 1, 5, ['income']], ['hybridScope', '综合法应用范围 scope', 1, 5, ['hybrid']], ['horizonN', '预测年限 N', 1, 10, ['income']], ['hybridN', '综合法预测年限 N', 1, 10, ['hybrid']], ['taLiquidityScore', '流动性评分', 1, 10, ['technical']], ['dcfHorizonN', 'DCF预测年限 N', 1, 10, ['dcf']],
  ].forEach(([field, label, min, max, methods]: any) => {
    const value = asNumber(raw[field]); if (!Number.isInteger(value)) return addError(field, `${label}必须为整数`, methods); if (value < min || value > max) addError(field, `${label}必须在${min}~${max}之间`, methods)
  })
  const beta = asNumber(raw.beta); if (Number.isNaN(beta)) addError('beta', 'beta必须为数字', ['income']); else if (beta < 0 || beta > 3) addError('beta', 'beta必须在0~3之间', ['income'])
  ;[
    ['comparableCount', '可比样本数量', ['market']], ['targetSize', '评估对象规模', ['market']], ['comparableSize', '可比对象规模', ['market']], ['kQuality', '质量系数', ['market']], ['kCoverage', '覆盖系数', ['market']], ['kTimeliness', '时效系数', ['market']], ['alpha', '社会价值调节系数 alpha', ['hybrid']], ['targetFeatureIndex', '目标对象特征指数', ['comparison']], ['comparableFeatureIndex', '可比对象特征指数', ['comparison']], ['taCurrentPrice', '当前市场价格', ['technical']], ['taMa20', 'MA20', ['technical']], ['taMa60', 'MA60', ['technical']],
  ].forEach(([field, label, methods]: any) => {
    const value = asNumber(raw[field]); if (Number.isNaN(value)) return addError(field, `${label}必须为数字`, methods); if (value <= 0) addError(field, `${label}必须大于0`, methods)
  })
  ;[
    ['ahpRelCost', 'AHP 方法可靠度 r1', ['ahp']], ['ahpRelIncome', 'AHP 方法可靠度 r2', ['ahp']], ['ahpRelMarket', 'AHP 方法可靠度 r3', ['ahp']], ['ahpRelHybrid', 'AHP 方法可靠度 r4', ['ahp']], ['ahpRelComparison', 'AHP 方法可靠度 r5', ['ahp']],
  ].forEach(([field, label, methods]: any) => {
    const value = asNumber(raw[field]); if (Number.isNaN(value)) return addError(field, `${label}必须为数字`, methods); if (value < 1 || value > 9) addError(field, `${label}应在1~9区间`, methods)
  })

  const cashFlows = asNumberList(raw.cashFlows)
  if (!cashFlows.length) addError('cashFlows', '现金流不能为空', ['income'])
  if (cashFlows.some((item) => !Number.isFinite(item))) addError('cashFlows', '现金流列表中存在非数字', ['income'])
  const horizon = asNumber(raw.horizonN)
  if (Number.isInteger(horizon) && cashFlows.length > 0 && cashFlows.length !== horizon) addError('cashFlows', '现金流条目数量应与N一致', ['income'])

  const compPrices = asNumberList(raw.compPrices)
  const compWeights = asNumberList(raw.compWeights)
  if (!compPrices.length) addError('compPrices', '比较法可比成交价列表不能为空', ['comparison'])
  if (!compWeights.length) addError('compWeights', '比较法权重列表不能为空', ['comparison'])
  if (compPrices.some((item) => !Number.isFinite(item) || item <= 0)) addError('compPrices', '比较法成交价列表需为大于0的数字', ['comparison'])
  if (compWeights.some((item) => !Number.isFinite(item) || item <= 0)) addError('compWeights', '比较法权重列表需为大于0的数字', ['comparison'])
  if (compPrices.length > 0 && compWeights.length > 0 && compPrices.length !== compWeights.length) addError('compWeights', '比较法中价格与权重数量必须一致', ['comparison'])

  const dcfCashFlows = asNumberList(raw.dcfCashFlows)
  if (!dcfCashFlows.length) addError('dcfCashFlows', 'DCF现金流不能为空', ['dcf'])
  if (dcfCashFlows.some((item) => !Number.isFinite(item))) addError('dcfCashFlows', 'DCF现金流列表中存在非数字', ['dcf'])
  const dcfHorizon = asNumber(raw.dcfHorizonN)
  if (Number.isInteger(dcfHorizon) && dcfCashFlows.length > 0 && dcfCashFlows.length !== dcfHorizon) addError('dcfCashFlows', 'DCF现金流条目数量应与N一致', ['dcf'])
  if (Number.isFinite(dcfDiscountRate) && Number.isFinite(dcfTerminalGrowth) && dcfDiscountRate <= dcfTerminalGrowth) addError('dcfTerminalGrowthPct', 'DCF要求折现率 r 必须大于永续增长率 g', ['dcf'])

  state.values.cost = { cOneoff: asNumber(raw.cOneoff), cOngoing: asNumber(raw.cOngoing), cQualityEval: asNumber(raw.cQualityEval), cQualityImprove: asNumber(raw.cQualityImprove), cProduct: asNumber(raw.cProduct), completeness: asNumber(raw.completenessPct), accuracy: asNumber(raw.accuracyPct), consistency: asNumber(raw.consistencyPct), coverage: asNumber(raw.coveragePct) }
  state.values.income = { rf: asNumber(raw.rfPct) / 100, rm: asNumber(raw.rmPct) / 100, beta: asNumber(raw.beta), g: asNumber(raw.growthPct) / 100, scope: asNumber(raw.scope), n: asNumber(raw.horizonN), cashFlows }
  state.values.market = { comparableTotalPrice: asNumber(raw.comparableTotalPrice), comparableCount: asNumber(raw.comparableCount), targetSize: asNumber(raw.targetSize), comparableSize: asNumber(raw.comparableSize), kQuality: asNumber(raw.kQuality), kCoverage: asNumber(raw.kCoverage), kTimeliness: asNumber(raw.kTimeliness) }
  state.values.hybrid = { g: asNumber(raw.hybridGrowthPct) / 100, scope: asNumber(raw.hybridScope), n: asNumber(raw.hybridN), alpha: asNumber(raw.alpha), downloads: asNumber(raw.downloads) }
  state.values.comparison = { prices: compPrices, weights: compWeights, targetFeatureIndex: asNumber(raw.targetFeatureIndex), comparableFeatureIndex: asNumber(raw.comparableFeatureIndex) }
  state.values.technical = { currentPrice: asNumber(raw.taCurrentPrice), ma20: asNumber(raw.taMa20), ma60: asNumber(raw.taMa60), momentum: asNumber(raw.taMomentumPct) / 100, volatility: asNumber(raw.taVolatilityPct) / 100, liquidityScore: asNumber(raw.taLiquidityScore) }
  state.values.dcf = { discountRate: asNumber(raw.dcfDiscountRatePct) / 100, terminalGrowth: asNumber(raw.dcfTerminalGrowthPct) / 100, n: asNumber(raw.dcfHorizonN), cashFlows: dcfCashFlows }
  state.values.ahp = { relCost: asNumber(raw.ahpRelCost), relIncome: asNumber(raw.ahpRelIncome), relMarket: asNumber(raw.ahpRelMarket), relHybrid: asNumber(raw.ahpRelHybrid), relComparison: asNumber(raw.ahpRelComparison) }
  state.values.sharedCost = { cOneoff: asNumber(raw.cOneoff), cOngoing: asNumber(raw.cOngoing), cQualityEval: asNumber(raw.cQualityEval), cQualityImprove: asNumber(raw.cQualityImprove), cProduct: asNumber(raw.cProduct) }
  return state
}

const buildMethodResults = (validation: any, selectedMethod: string) => {
  const parsed = validation.values
  const buildOne = (methodKey: string) => {
    if (methodKey === 'cost') return validation.methodErrors.cost.length > 0 ? buildErrorResult('成本法', validation.methodErrors.cost) : calculateCost(parsed.cost)
    if (methodKey === 'income') return validation.methodErrors.income.length > 0 ? buildErrorResult('收益法', validation.methodErrors.income) : calculateIncome(parsed.income)
    if (methodKey === 'market') return validation.methodErrors.market.length > 0 ? buildErrorResult('市场法', validation.methodErrors.market) : calculateMarket(parsed.market)
    if (methodKey === 'hybrid') return validation.methodErrors.hybrid.length > 0 ? buildErrorResult('综合法', validation.methodErrors.hybrid) : calculateHybrid(parsed.hybrid, parsed.sharedCost)
    if (methodKey === 'comparison') return validation.methodErrors.comparison.length > 0 ? buildErrorResult('比较法', validation.methodErrors.comparison) : calculateComparison(parsed.comparison)
    if (methodKey === 'technical') return validation.methodErrors.technical.length > 0 ? buildErrorResult('技术分析法', validation.methodErrors.technical) : calculateTechnical(parsed.technical)
    if (methodKey === 'dcf') return validation.methodErrors.dcf.length > 0 ? buildErrorResult('DCF估值法', validation.methodErrors.dcf) : calculateDcf(parsed.dcf)
    return buildErrorResult('未知方法', ['未识别的估值方法'])
  }
  if (selectedMethod !== 'ahp') return [buildOne(selectedMethod)]
  const baseResults = [buildOne('cost'), buildOne('income'), buildOne('market'), buildOne('hybrid'), buildOne('comparison')]
  if (validation.methodErrors.ahp.length > 0 || baseResults.some((item) => item.valuation === null)) {
    return [buildErrorResult('层次分析法(AHP)', [...validation.methodErrors.ahp, 'AHP依赖前5法的有效结果，请先修正当前参数'])]
  }
  return [calculateAHP(parsed.ahp, baseResults)]
}

const submitValuation = async () => {
  const selectedMethodLabel = getMethodLabel(selectedValuationMethod.value)
  if (selectedValuationMethod.value === 'ml_qwen_opensea') {
    const inputSnapshot = getSelectedMethodInputSnapshot()
    const payload = {
      fileHash: props.asset?.file_hash || '',
      assetName: inputSnapshot.openseaAssetName || props.asset?.asset_name || '',
      assetType: '',
      description: inputSnapshot.openseaDescription || props.asset?.description || '',
      methodKey: selectedValuationMethod.value,
      inputSnapshot,
    }

    valuationCalculating.value = true
    valuationResultDetail.value = null
    try {
      const response = await axios.post(valuationModelApiUrl, payload)
      if (!response.data || response.data.code !== 0) {
        throw new Error(response.data?.message || '服务器模型服务返回异常')
      }

      const result = response.data.data || {}
      const valuation =
        result.valuationAmount === null || result.valuationAmount === undefined
          ? null
          : Number(result.valuationAmount)
      if (valuation !== null && !Number.isFinite(valuation)) {
        throw new Error('服务器模型服务返回的估值金额格式无效')
      }
      if (!result.valuationLevel) {
        throw new Error('服务器模型服务未返回有效五档估值等级')
      }

      lastValuationInputSnapshot.value = inputSnapshot
      valuationResultDetail.value = {
        valuationAmount: valuation,
        valuationUnit: result.valuationUnit || '万元',
        valuationLevel: result.valuationLevel,
        valuationLevelName: result.valuationLevelName || '',
        valuationCategory: result.valuationCategory || '',
        valuationRange: result.valuationRange || '',
        basis: Array.isArray(result.basis) ? result.basis : [],
        modelVersion: result.modelVersion || '',
      }
      valuationMethodResults.value = [{
        methodName: result.methodName || selectedMethodLabel,
        formulaText: result.formulaText || '-',
        intermediates: Array.isArray(result.intermediates) ? result.intermediates : [],
        valuation,
        notes: valuationResultDetail.value.basis.join('；') || '服务器模型服务已完成五档估值分级。',
      }]
      valuationHasErrors.value = false
      valuationResultStatus.value = `${selectedMethodLabel}完成，结果已更新`
      if (valuation !== null) emit('price-updated', valuation)
      ElMessage.success(`${selectedMethodLabel}完成`)
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || '服务器模型服务不可用或服务异常'
      lastValuationInputSnapshot.value = inputSnapshot
      valuationMethodResults.value = [buildErrorResult(selectedMethodLabel, [message, `请确认服务器模型服务已启动：${valuationModelApiUrl}`])]
      valuationMethodResults.value[0].notes = message
      valuationHasErrors.value = true
      valuationResultStatus.value = `${selectedMethodLabel}失败，请检查服务器模型服务`
      ElMessage.error('服务器模型估值失败，请检查模型服务')
    } finally {
      valuationCalculating.value = false
      dialogVisible.value = false
      resultDialogVisible.value = true
    }
    return
  }

  const validation = validateValuationInputs(params)
  valuationMethodResults.value = buildMethodResults(validation, selectedValuationMethod.value)
  const hasError = valuationMethodResults.value.length === 0 || valuationMethodResults.value.some((item) => item.valuation === null)
  valuationHasErrors.value = hasError
  valuationResultDetail.value = null
  lastValuationInputSnapshot.value = getSelectedMethodInputSnapshot()
  valuationResultStatus.value = hasError ? `${getMethodLabel(selectedValuationMethod.value)}输入存在错误，请按提示修正` : `${getMethodLabel(selectedValuationMethod.value)}计算完成，结果已更新`
  const firstValid = valuationMethodResults.value.find((item) => item.valuation !== null && item.valuation !== undefined)
  if (firstValid) emit('price-updated', Number(firstValid.valuation))
  dialogVisible.value = false
  resultDialogVisible.value = true
  if (hasError) ElMessage.warning(`${getMethodLabel(selectedValuationMethod.value)}参数存在问题，请查看结果明细`)
  else ElMessage.success(`${getMethodLabel(selectedValuationMethod.value)}估值计算完成，已写入资产估值`)
}

const getSelectedMethodInputSnapshot = () => {
  const method = selectedValuationMethod.value
  const keys = new Set<string>()
  const section = valuationSections.find((item) => item.method === method)
  section?.fields.forEach((item: any) => keys.add(item.key))
  if (method === 'hybrid') ['cOneoff', 'cOngoing', 'cQualityEval', 'cQualityImprove', 'cProduct'].forEach((key) => keys.add(key))
  if (method === 'ahp') ['cOneoff', 'cOngoing', 'cQualityEval', 'cQualityImprove', 'cProduct', 'completenessPct', 'accuracyPct', 'consistencyPct', 'coveragePct', 'rfPct', 'rmPct', 'beta', 'growthPct', 'scope', 'horizonN', 'cashFlows', 'comparableTotalPrice', 'comparableCount', 'targetSize', 'comparableSize', 'kQuality', 'kCoverage', 'kTimeliness', 'hybridGrowthPct', 'hybridScope', 'hybridN', 'alpha', 'downloads', 'compPrices', 'compWeights', 'targetFeatureIndex', 'comparableFeatureIndex'].forEach((key) => keys.add(key))
  const snapshot: Record<string, any> = {}
  keys.forEach((key) => { snapshot[key] = params[key] })
  return snapshot
}

const saveCurrentValuationRecord = async () => {
  const currentResult = valuationMethodResults.value[0]
  const detail = valuationResultDetail.value || {}
  if (!currentResult || (currentResult.valuation === null && !detail.valuationLevel)) {
    ElMessage.warning('当前结果不可保存，请先修正参数并重新计算')
    return
  }
  const fileHash = props.asset?.file_hash || ''
  const payload = {
    asset_id: props.asset?.id || null,
    fileHash,
    assetName: props.asset?.asset_name || '',
    methodKey: selectedValuationMethod.value,
    methodName: currentResult.methodName,
    finalValuation: currentResult.valuation,
    valuationUnit: detail.valuationUnit || '万元',
    calcStatus: 1,
    statusMessage: '计算成功',
    inputSnapshot: lastValuationInputSnapshot.value || getSelectedMethodInputSnapshot(),
    resultSnapshot: {
      formulaText: currentResult.formulaText,
      intermediates: currentResult.intermediates,
      notes: currentResult.notes,
      valuation: currentResult.valuation,
      valuationLevel: detail.valuationLevel,
      valuationLevelName: detail.valuationLevelName,
      valuationCategory: detail.valuationCategory,
      valuationRange: detail.valuationRange,
      basis: detail.basis || [],
      modelVersion: detail.modelVersion || '',
    },
    createdByUsername: props.username || '',
  }
  valuationSaving.value = true
  try {
    const response: any = await saveAssetValuationRecord(payload)
    if (response.data?.status === 0) {
      ElMessage.success(response.data?.data?.record_no ? `保存成功，记录号：${response.data.data.record_no}` : '保存成功')
      emit('saved', { record_no: response.data?.data?.record_no || '' })
    } else {
      ElMessage.error(response.data?.message || '保存失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '保存失败')
  } finally {
    valuationSaving.value = false
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    resultDialogVisible.value = false
    valuationMethodResults.value = []
    valuationResultStatus.value = '输入有效，结果已更新'
    valuationHasErrors.value = false
    valuationResultDetail.value = null
    lastValuationInputSnapshot.value = null
  },
)
</script>

<style lang="scss" scoped>
.valuation-modal :deep(.el-dialog__body) {
  max-height: 86vh;
  overflow-y: auto;
  text-align: left;
}

.valuation-result-modal :deep(.el-dialog__body) {
  text-align: left;
}

.valuation-control-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
  align-items: flex-end;
}

.valuation-method-select {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;
}

.valuation-method-select label {
  font-size: 13px;
  color: #4b5563;
}

.valuation-method-select :deep(.el-select__wrapper) {
  min-height: 38px;
  border: 1px solid #d4dde6;
  border-radius: 8px;
  background: #fff;
  color: #1f2a37;
}

.valuation-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.valuation-control-row :deep(.el-button),
.button-container :deep(.el-button) {
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 600;
}

.valuation-form {
  margin-bottom: 10px;
}

.valuation-method-box {
  border: 1px solid rgba(17, 94, 89, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  margin-bottom: 10px;
  overflow: hidden;
}

.valuation-method-box[open] {
  box-shadow: inset 0 0 0 1px rgba(15, 118, 110, 0.12);
}

.valuation-method-box summary {
  list-style: none;
  cursor: pointer;
  padding: 10px 12px;
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(90deg, rgba(15, 118, 110, 0.09), rgba(240, 140, 52, 0.08));
  border-bottom: 1px solid rgba(17, 94, 89, 0.15);
}

.valuation-method-box summary::-webkit-details-marker {
  display: none;
}

.valuation-method-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(200px, 1fr));
  gap: 8px;
  padding: 10px 10px 8px;
}

.valuation-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.valuation-field.span-2 {
  grid-column: span 2;
}

.valuation-field label {
  font-size: 13px;
  color: #4b5563;
}

.valuation-field :deep(.valuation-number-input),
.valuation-field :deep(.el-input-number),
.valuation-field :deep(.el-textarea),
.valuation-field :deep(.el-textarea__inner) {
  width: 100%;
}

.valuation-field :deep(.el-input-number .el-input__wrapper),
.valuation-field :deep(.el-textarea__inner) {
  border: 1px solid #d4dde6;
  border-radius: 8px;
  background: #fff;
  box-sizing: border-box;
}

.valuation-field :deep(.el-input-number .el-input__inner) {
  text-align: left;
}

.valuation-field :deep(.el-textarea__inner) {
  min-height: 68px;
  resize: vertical;
}

.valuation-hint {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.3;
}

.valuation-result-status {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  margin-bottom: 10px;
  font-size: 13px;
  border-radius: 999px;
  color: #166534;
  background: rgba(22, 101, 52, 0.1);
  border: 1px solid rgba(22, 101, 52, 0.2);
}

.valuation-result-status.has-errors {
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.24);
  background: rgba(185, 28, 28, 0.08);
}

.valuation-result-wrap {
  overflow-x: auto;
}

.valuation-result-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #dbe5ee;
  border-radius: 8px;
  overflow: hidden;
  font-size: 14px;
  table-layout: fixed;
}

.valuation-result-table th,
.valuation-result-table td {
  border-bottom: 1px solid #edf2f7;
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
}

.valuation-result-table thead th {
  background: #f3f7fb;
  color: #1b4d47;
}

.valuation-result-table tbody tr:last-child td {
  border-bottom: none;
}

.valuation-intermediate-list {
  margin: 0;
  padding-left: 18px;
}

.valuation-intermediate-list li {
  margin-bottom: 4px;
}

.mono-cell {
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}

.warn-text {
  color: #92400e;
  font-weight: 700;
}

.valuation-note-row td {
  background: #fcf7ef;
  color: #6c4f2d;
  font-size: 13px;
}

.button-container {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}

@media (max-width: 900px) {
  .valuation-method-body {
    grid-template-columns: 1fr;
  }

  .valuation-field.span-2 {
    grid-column: span 1;
  }
}
</style>
