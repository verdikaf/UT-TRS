<template>
  <div>
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;">Profile</h2>
      <button @click="goTasks">Back to Tasks</button>
    </div>
    <div class="card">
      <h2>My Profile</h2>
      <div v-if="loading">Loading...</div>
      <div v-else>
        <div style="margin-bottom:8px;">Name: <strong>{{ me?.name }}</strong></div>
        <div style="margin-bottom:8px;">Current Phone: <strong>{{ me?.phone }}</strong></div>
      </div>
    </div>

    <div class="card">
      <h3>Update Phone Number</h3>
      <div class="row">
        <input v-model="phone" placeholder="New phone number" />
        <button @click="updatePhone">Save Phone</button>
      </div>
      <p v-if="phoneMsg" :style="{color: phoneMsgColor}">{{ phoneMsg }}</p>
    </div>

    <div class="card">
      <h3>Change Password</h3>
      <div class="row">
        <input type="password" v-model="currentPassword" placeholder="Current password" />
        <input type="password" v-model="newPassword" placeholder="New password" />
        <input type="password" v-model="confirmPassword" placeholder="Confirm new password" />
        <button @click="changePassword">Change Password</button>
      </div>
      <p v-if="pwdMsg" :style="{color: pwdMsgColor}">{{ pwdMsg }}</p>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import { ref, onMounted } from 'vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const token = localStorage.getItem('token')
const http = axios.create({ baseURL: API })
http.interceptors.request.use(config => {
  const t = localStorage.getItem('token')
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

const me = ref(null)
const loading = ref(true)
const phone = ref('')
const phoneMsg = ref('')
const phoneMsgColor = ref('green')

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const pwdMsg = ref('')
const pwdMsgColor = ref('green')

function goTasks(){
  window.location.href = '/tasks'
}

async function loadMe(){
  try{
    const { data } = await http.get('/api/profile/me')
    me.value = data
    phone.value = data.phone || ''
  }catch(e){
    // ignore
  }finally{
    loading.value = false
  }
}

async function updatePhone(){
  phoneMsg.value = ''
  try{
    const { data } = await http.put('/api/profile/phone', { phone: phone.value })
    me.value = data.user
    if (data.token) localStorage.setItem('token', data.token)
    phoneMsg.value = 'Phone updated successfully'
    phoneMsgColor.value = 'green'
  }catch(e){
    phoneMsg.value = e?.response?.data?.error || 'Failed to update phone'
    phoneMsgColor.value = 'red'
  }
}

async function changePassword(){
  pwdMsg.value = ''
  if (newPassword.value !== confirmPassword.value){
    pwdMsg.value = 'New passwords do not match'
    pwdMsgColor.value = 'red'
    return
  }
  try{
    const { data } = await http.put('/api/profile/password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    if (data.token) localStorage.setItem('token', data.token)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    pwdMsg.value = 'Password changed successfully'
    pwdMsgColor.value = 'green'
  }catch(e){
    pwdMsg.value = e?.response?.data?.error || 'Failed to change password'
    pwdMsgColor.value = 'red'
  }
}

onMounted(loadMe)
</script>
