<template>
  <div>
    <div class="card" style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;">Profil</h2>
      <button @click="goTasks">Kembali ke Tugas</button>
    </div>
    <div class="card">
      <h2>Profil Saya</h2>
      <div v-if="loading">Loading...</div>
      <div v-else>
        <div style="margin-bottom:8px;">Nama: <strong>{{ me?.name }}</strong></div>
        <div style="margin-bottom:8px;">Nomor Telepon: <strong>{{ me?.phone }}</strong></div>
      </div>
    </div>

    <div class="card">
      <h3>Perbarui Nomor Telepon</h3>
      <div class="row">
        <input v-model="phone" placeholder="Nomor telepon baru" />
        <button @click="updatePhone">Simpan Nomor</button>
      </div>
      <p v-if="phoneMsg" :style="{color: phoneMsgColor}">{{ phoneMsg }}</p>
    </div>

    <div class="card">
      <h3>Ubah Kata Sandi</h3>
      <div class="row">
        <input type="password" v-model="currentPassword" placeholder="Kata sandi saat ini" />
        <input type="password" v-model="newPassword" placeholder="Kata sandi baru" />
        <input type="password" v-model="confirmPassword" placeholder="Konfirmasi kata sandi baru" />
        <button @click="changePassword">Ubah Kata Sandi</button>
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
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status
    if (status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      return
    }
    return Promise.reject(err)
  }
)

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
    // 1) Validate phone via WhatsApp deliverability
    await http.post('/api/phone/validate', { phone: phone.value, name: me.value?.name })
    // 2) Proceed to update phone
    const { data } = await http.put('/api/profile/phone', { phone: phone.value })
    me.value = data.user
    if (data.token) localStorage.setItem('token', data.token)
    phoneMsg.value = 'Nomor telepon berhasil diperbarui'
    phoneMsgColor.value = 'green'
  }catch(e){
    phoneMsg.value = e?.response?.data?.error || 'Gagal memperbarui nomor telepon'
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
    pwdMsg.value = 'Kata sandi berhasil diubah'
    pwdMsgColor.value = 'green'
  }catch(e){
    pwdMsg.value = e?.response?.data?.error || 'Gagal mengubah kata sandi'
    pwdMsgColor.value = 'red'
  }
}

onMounted(loadMe)
</script>
