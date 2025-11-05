<template>
  <div class="container">
    <header class="header">
      <h1>Aplikasi Pengingat</h1>
      <nav>
        <a v-if="!token" href="/login">Masuk</a>
        <a v-if="!token" href="/register">Daftar</a>
        <a v-if="token" href="/tasks">Tugas</a>
        <a v-if="token" href="/profile">Profil</a>
        <button v-if="token" @click="logout">Keluar</button>
      </nav>
    </header>
    <router-view />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const token = ref(null)

onMounted(() => {
  token.value = localStorage.getItem('token')
})

async function logout() {
  try {
    const token = localStorage.getItem('token')
    if (token) {
      await fetch((import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  } catch {}
  localStorage.removeItem('token')
  window.location.href = '/login'
}
</script>

<style>
body { font-family: system-ui, sans-serif; margin: 0; }
.container { max-width: 900px; margin: 0 auto; padding: 1rem; }
.header { display: flex; align-items: center; justify-content: space-between; }
.header nav a, .header nav button { margin-left: 8px; }
.card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
input, select, button { padding: 8px; }
button { cursor: pointer; }
</style>
