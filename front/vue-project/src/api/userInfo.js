import instance from '@/http/index.js'

export const getUserInfo = (id) => {
  return instance.get('/userInfo/getUserInfo', {
    params: id ? { id } : {},
  })
}

export const uploadAvatar = (formData) => {
  return instance.post('/userInfo/uploadAvatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const updateUserName = (data) => {
  const { id, name } = data
  return instance.post('/userInfo/updateUserName', { id, name })
}

export const updateUserGender = (data) => {
  const { id, gender } = data
  return instance.post('/userInfo/updateUserGender', { id, gender })
}

export const updateUserEmail = (data) => {
  const { id, email } = data
  return instance.post('/userInfo/updateUserEmail', { id, email })
}

export const updatePassword = (data) => {
  const { id, oldPassword, newPassword } = data
  return instance.post('/userInfo/updatePassword', { id, oldPassword, newPassword })
}
