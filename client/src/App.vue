<template>
  <div class="container">
    <header class="header">
      <h1>Reminder App</h1>
      <nav>
        <a v-if="!token" href="/login">Login</a>
        <a v-if="!token" href="/register">Register</a>
        <button v-if="token" @click="logout">Logout</button>
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

function logout() {
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
