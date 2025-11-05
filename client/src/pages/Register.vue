<template>
  <div class="card">
    <h2>Daftar</h2>
    <div class="row">
      <input v-model="name" placeholder="Nama lengkap" />
      <input v-model="phone" placeholder="Nomor telepon, contoh 628123456789" />
      <input type="password" v-model="password" placeholder="Kata sandi" />
      <button @click="register">Buat Akun</button>
    </div>
    <p v-if="error" style="color:red">{{ error }}</p>
  </div>
</template>

<script setup>
import axios from 'axios'
import { ref } from 'vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const name = ref('')
const phone = ref('')
const password = ref('')
const error = ref('')

async function register() {
  error.value = ''
  try {
    // 1) Validate phone can receive WhatsApp
    await axios.post(`${API}/api/phone/validate`, { phone: phone.value, name: name.value })
    // 2) Proceed with registration
    const { data } = await axios.post(`${API}/api/auth/register`, { name: name.value, phone: phone.value, password: password.value })
    localStorage.setItem('token', data.token)
    window.location.href = '/tasks'
  } catch (e) {
    error.value = e?.response?.data?.error || 'Gagal mendaftar'
  }
}
</script>
