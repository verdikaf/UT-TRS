import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'
import Login from './pages/Login.vue'
import Register from './pages/Register.vue'
import Tasks from './pages/Tasks.vue'
import Profile from './pages/Profile.vue'

const routes = [
  { path: '/', redirect: '/tasks' },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/tasks', component: Tasks },
  { path: '/profile', component: Profile },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if ((to.path === '/login' || to.path === '/register')) return next()
  if (!token) return next('/login')
  next()
})

const app = createApp(App)

// Global render/runtime error handler
app.config.errorHandler = (err, instance, info) => {
  try {
    console.error('[Render Error]', info, err)
    const payload = {
      type: 'vue-error',
      message: err?.message,
      stack: err?.stack,
      info,
      component: instance?.type?.name || instance?.type?.__file || null,
      time: new Date().toISOString(),
    }
    // Fire-and-forget to backend (ignore failures)
    fetch((import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  } catch (e) {
    console.error('Error in global errorHandler', e)
  }
}

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason)
  try {
    const payload = {
      type: 'unhandled-rejection',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      time: new Date().toISOString(),
    }
    fetch((import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  } catch {}
})

// Capture window errors
window.addEventListener('error', (event) => {
  console.error('[Window Error]', event.message, event.error)
  try {
    const payload = {
      type: 'window-error',
      message: event.message,
      stack: event.error?.stack,
      time: new Date().toISOString(),
    }
    fetch((import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  } catch {}
})

app.use(router).mount('#app')
