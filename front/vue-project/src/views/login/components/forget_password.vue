<template>
  <!-- ① 找回密码 -->
  <el-dialog v-model="state.forgetPasswordDialog" title="找回密码" width="400px">
    <el-form
      ref="forgetFormRef"
      class="login-form"
      :label-position="labelPosition"
      :model="forgetData"
      :rules="forgetRules"
    >
      <el-form-item label="请输入您的账户名称" prop="account">
        <el-input v-model="forgetData.account" placeholder="请输入账号" />
      </el-form-item>

      <el-form-item label="请输入您的注册邮箱" prop="email">
        <el-input v-model="forgetData.email" placeholder="请输入邮箱" />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button type="info" plain @click="state.forgetPasswordDialog = false">取消</el-button>
        <el-button type="primary" plain @click="verify">下一步</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- ② 修改密码 -->
  <el-dialog v-model="state.changePasswordDialog" title="修改密码" width="400px">
    <el-form
      ref="changeFormRef"
      class="login-form"
      :label-position="labelPosition"
      :model="pwdData"
      :rules="changeRules"
    >
      <el-form-item label="请输入新密码" prop="password">
        <el-input
          v-model="pwdData.password"
          type="password"
          show-password
          placeholder="请输入新密码"
        />
      </el-form-item>

      <el-form-item label="请再次输入新密码" prop="confirmPassword">
        <el-input
          v-model="pwdData.confirmPassword"
          type="password"
          show-password
          placeholder="请再次输入新密码"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button type="info" plain @click="state.changePasswordDialog = false">取消</el-button>
        <el-button type="primary" plain @click="reset">确认修改</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, reactive } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { verifyAccountEmail, resetPassword } from '@/api/login'
import { ElMessage } from 'element-plus'

//** 表单标签位置 -
const labelPosition = ref('top')

interface formData {
  account?: string
  email?: string
  password?: string
  confirmPassword?: string
}

/** 弹窗开关 */
const state = reactive({
  forgetPasswordDialog: false,
  changePasswordDialog: false,
})

//** ① 找回密码数据 */
const forgetData: formData = reactive({
  account: '',
  email: '',
})

const forgetFormRef = ref<FormInstance>()

const forgetRules = reactive<FormRules>({
  account: [
    { required: true, message: '请输入您的注册账号', trigger: 'blur' },
    { min: 3, max: 20, message: '账号长度应为 3-20 位', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入您的注册邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
})

/** ② 修改密码数据 */
const pwdData: formData = reactive({
  password: '',
  confirmPassword: '',
})

const changeFormRef = ref<FormInstance>()

const validateConfirm = (_rule: any, value: string, callback: any) => {
  if (!value) return callback(new Error('请再次输入新密码'))
  if (value !== pwdData.password) return callback(new Error('两次输入的密码不一致'))
  callback()
}

const changeRules = reactive<FormRules>({
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度应为 6-20 位', trigger: 'blur' },
  ],
  confirmPassword: [{ validator: validateConfirm, trigger: 'blur' }],
})

/** 对外暴露：打开“找回密码” */
const open = () => {
  state.forgetPasswordDialog = true
  // 重置表单与校验
  forgetFormRef.value?.resetFields()
  changeFormRef.value?.resetFields()
}

defineExpose({ open })

/** 下一步：先校验找回密码表单，通过后打开修改密码 */
const verify = async () => {
  try {
    // ① 等表单校验完成（不通过会抛错）
    await forgetFormRef.value?.validate()

    // ② 等接口返回
    const res = await verifyAccountEmail(forgetData)
    if (res.data.status !== 0) {
      console.log(res)
      ElMessage.error(res.data.message || '注册失败！')
      return
    }

    // ③ 通过后再切弹窗
    // 存token 
    const {token} = res.data; 
    localStorage.setItem('token', token);
     // 存在 sessionStorage 里，修改密码接口会用到
    // sessionStorage.setItem('reset_token', token);

    ElMessage.success('验证成功！请设置新密码')
    state.forgetPasswordDialog = false
    state.changePasswordDialog = true
  } catch (err) {
    // 校验失败：Element Plus 会自己标红，一般这里不用提示
    // 接口失败：你可以在这儿弹消息
    console.log(err)
  }
}

/** 确认修改：校验新密码表单 */
const reset = async () => {
  try {
    // ① 前端检验表单校验（不通过会抛错）
    await changeFormRef.value?.validate((valid) => {
      if (!valid) return
    })

    const res = await resetPassword({
      account: forgetData.account,
      password: pwdData.password,
    })
    if (res.data.status === 0) {
      // 清除重置密码token
      localStorage.removeItem('reset_token')
      ElMessage.success('密码修改成功！请重新登录')
      state.changePasswordDialog = false
    } else {
      console.log(res)
      ElMessage.error(res.data.message || '密码修改失败！')
      return
    }
  } catch (err) {
    console.log(err)
    return
  }
}
</script>

<style lang="scss" scoped></style>
