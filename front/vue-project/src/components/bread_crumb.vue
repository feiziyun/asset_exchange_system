<template>
  <div class="bread-crumb">
    <SvgIcon class="bread-crumb-icon" icon-name="zuobiao"/>
    <el-breadcrumb :separator-icon="ArrowRight">
      <!-- <el-breadcrumb-item :to="{ path: '/' }">homepage</el-breadcrumb-item> -->
      <!-- <el-breadcrumb-item><a href="/">promotion management</a></el-breadcrumb-item> -->
      <el-breadcrumb-item>{{ props.item.first }}</el-breadcrumb-item>
      <el-breadcrumb-item v-if="props.item.second">{{ props.item.second }}</el-breadcrumb-item>
    </el-breadcrumb>
  </div>
</template>

<script setup lang="ts">
import { ArrowRight } from '@element-plus/icons-vue'
import SvgIcon from '@/components/SvgIcon.vue'
const props = defineProps(['item'])
</script>

<style lang="scss" scoped>
.bread-crumb {
  height: 30px;
  padding: 0 10px;
  display: flex;
  align-items: center;
}

.bread-crumb-icon {
  margin-right: 10px;
}
</style>
