<template>
  <span class="admin-status" :class="`admin-status--${tone}`">
    <span class="admin-status__dot" aria-hidden="true"></span>
    <span>{{ label }}</span>
  </span>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  tone: { type: String, default: 'neutral' },
})
</script>

<style scoped>
.admin-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #57606a;
  font-size: inherit;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.admin-status__dot {
  width: 9px;
  height: 9px;
  flex: 0 0 9px;
  border-radius: 50%;
  background: currentColor;
}

.admin-status--success { color: #1a7f37; }
.admin-status--warning { color: #9a6700; }
.admin-status--primary { color: #0969da; }
.admin-status--danger { color: #cf222e; }
.admin-status--neutral { color: #57606a; }
</style>
