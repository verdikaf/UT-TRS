<template>
  <div class="card">
    <h2>Login</h2>
    <div class="row">
      <input v-model="phone" placeholder="Phone e.g. 628123456789" />
      <input type="password" v-model="password" placeholder="Password" />
      <button @click="login">Login</button>
    </div>
    <p v-if="error" style="color:red">{{ error }}</p>
  </div>
</template>

<script setup>
import axios from 'axios'
import { ref } from 'vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const phone = ref('')
const password = ref('')
const error = ref('')

async function login() {
  error.value = ''
  try {
    const { data } = await axios.post(`${API}/api/auth/login`, { phone: phone.value, password: password.value })
    localStorage.setItem('token', data.token)
    window.location.href = '/tasks'
  } catch (e) {
    error.value = e?.response?.data?.error || 'Login failed'
  }
}
</script>
