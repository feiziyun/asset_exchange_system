<template>
  <div class="delivery-method-field">
    <el-select :model-value="modelValue" placeholder="请选择交付方式" @update:model-value="emit('update:modelValue', $event)">
      <template #label="{ value }">
        <span v-if="methodByValue(value)" class="method-row">
          <span>{{ methodByValue(value)?.label }}</span>
          <span class="method-code">{{ value }}</span>
        </span>
        <span v-else>{{ value }}</span>
      </template>
      <el-option v-for="method in methods" :key="method.value" :label="method.label" :value="method.value">
        <span class="method-row">
          <span>{{ method.label }}</span>
          <span class="method-code">{{ method.value }}</span>
        </span>
      </el-option>
    </el-select>
    <el-popover placement="right" trigger="hover" :width="380">
      <div class="method-help">
        <div v-for="method in methods" :key="method.value" class="method-help-item">
          <strong>{{ method.label }}（{{ method.value }}）</strong>
          <p>{{ method.description }}</p>
        </div>
      </div>
      <template #reference>
        <button type="button" class="method-help-button" aria-label="查看交付方式说明">?</button>
      </template>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// 说明文字与原型系统 ChainRegistrationView.vue 的 deliveryMethods 保持一致。
const methods = [
  { value: 'HE', label: '同态加密', description: '数据在加密状态下完成计算，无需解密原始数据，适用于需要保护数据内容同时进行计算处理的场景' },
  { value: 'PRE', label: '代理重加密', description: '通过代理重加密机制将密文的访问权限安全转换给指定买方，代理无法获得明文数据' },
  { value: 'FL', label: '联邦学习', description: '数据保留在本地，各参与方通过交换模型参数或梯度完成联合训练，避免原始数据直接流通' },
  { value: 'MPC', label: '多方安全计算', description: '多个参与方在不泄露各自原始数据的情况下共同完成计算，并获得约定的计算结果' },
]

const methodByValue = (value: string) => methods.find((method) => method.value === value)
</script>

<style scoped>
.delivery-method-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.delivery-method-field :deep(.el-select) {
  flex: 1;
  min-width: 0;
}

.method-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.method-code {
  color: #6e7781;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.method-help-button {
  flex: none;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #aeb7c2;
  border-radius: 50%;
  background: #fff;
  color: #57606a;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  cursor: pointer;
}

.method-help-button:hover,
.method-help-button:focus-visible {
  border-color: #2b75c7;
  color: #2b75c7;
}

.method-help-item + .method-help-item { margin-top: 12px; }
.method-help-item strong { color: #1f2328; font-size: 13px; }
.method-help-item p { margin: 4px 0 0; color: #57606a; font-size: 12px; line-height: 1.5; }
</style>
