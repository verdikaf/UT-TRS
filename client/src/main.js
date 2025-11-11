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

createApp(App).use(router).mount('#app')
