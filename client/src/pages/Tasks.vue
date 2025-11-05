<template>
  <div>
    <div class="card">
      <h2>Buat Tugas</h2>
      <div class="row">
        <input v-model="form.name" placeholder="Nama tugas" />
        <input type="datetime-local" v-model="form.deadline" />
        <select v-model="form.reminderType">
          <option value="once">Sekali</option>
          <option value="weekly">Mingguan berulang</option>
        </select>
        <input v-if="form.reminderType==='weekly'" type="date" v-model="form.endDate" placeholder="Tanggal akhir pengulangan" />
        <select v-model="form.reminderOffset">
          <option value="3d">3 hari sebelum</option>
          <option value="1d">1 hari sebelum</option>
          <option value="3h">3 jam sebelum</option>
        </select>
        <button @click="createTask">Tambah</button>
      </div>
      <p v-if="error" style="color:red">{{ error }}</p>
    </div>

    <div class="card">
      <h2>Daftar Tugas</h2>
      <div v-for="t in tasks" :key="t._id" class="row" style="align-items:center; border-bottom:1px solid #eee; padding:8px 0;">
        <div style="flex:1">
          <div><strong>{{ t.name }}</strong></div>
          <div>Tenggat: {{ formatDate(t.deadline) }}</div>
          <div>Tipe: {{ t.reminderType }} | Offset: {{ t.reminderOffset }} | Status: {{ t.status }}</div>
          <div v-if="t.reminderType==='weekly'">Akhir: {{ t.endDate ? formatDate(t.endDate) : '-' }}</div>
        </div>
        <button v-if="t.status==='pending'" @click="editTask(t)">Ubah</button>
        <button v-if="t.status==='pending'" @click="stopTask(t)">Hentikan</button>
        <button @click="removeTask(t)">Hapus</button>
      </div>
    </div>

    <div v-if="editing" class="card">
      <h2>Ubah Tugas</h2>
      <div class="row">
        <input v-model="editForm.name" />
        <input type="datetime-local" v-model="editForm.deadline" />
        <select v-model="editForm.reminderType">
          <option value="once">Sekali</option>
          <option value="weekly">Mingguan berulang</option>
        </select>
        <input v-if="editForm.reminderType==='weekly'" type="date" v-model="editForm.endDate" placeholder="Tanggal akhir pengulangan" />
        <select v-model="editForm.reminderOffset">
          <option value="3d">3 hari sebelum</option>
          <option value="1d">1 hari sebelum</option>
          <option value="3h">3 jam sebelum</option>
        </select>
        <button @click="updateTask">Simpan</button>
        <button @click="cancelEdit">Batal</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import axios from 'axios'
import { ref, onMounted } from 'vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
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

const form = ref({ name: '', deadline: '', reminderType: 'once', reminderOffset: '3d', endDate: '' })
const error = ref('')
const tasks = ref([])
 

const editing = ref(false)
const editForm = ref({ _id: '', name: '', deadline: '', reminderType: 'once', reminderOffset: '3d', endDate: '' })

function formatDate(d){ return new Date(d).toLocaleString() }

async function load(){
  const { data } = await http.get(`/api/tasks?includeCompleted=true`)
  tasks.value = data
}

async function createTask(){
  error.value = ''
  try{
    const payload = { ...form.value, deadline: new Date(form.value.deadline).toISOString(), endDate: form.value.endDate ? new Date(form.value.endDate).toISOString() : undefined }
    await http.post('/api/tasks', payload)
    form.value = { name: '', deadline: '', reminderType: 'once', reminderOffset: '3d', endDate: '' }
    await load()
  }catch(e){ error.value = e?.response?.data?.error || 'Failed to create' }
}

function editTask(t){
  editing.value = true
  editForm.value = { ...t, deadline: new Date(t.deadline).toISOString().slice(0,16), endDate: t.endDate ? new Date(t.endDate).toISOString().slice(0,10) : '' }
}

async function updateTask(){
  try{
    const id = editForm.value._id
    const payload = { ...editForm.value, deadline: new Date(editForm.value.deadline).toISOString(), endDate: editForm.value.endDate ? new Date(editForm.value.endDate).toISOString() : null }
    await http.put(`/api/tasks/${id}`, payload)
    editing.value = false
    await load()
  }catch(e){ alert(e?.response?.data?.error || 'Gagal memperbarui') }
}

function cancelEdit(){ editing.value = false }

async function removeTask(t){
  if(!confirm('Hapus tugas ini?')) return
  await http.delete(`/api/tasks/${t._id}`)
  await load()
}

async function stopTask(t){
  if(!confirm('Hentikan tugas ini? Tindakan ini tidak dapat dibatalkan.')) return
  await http.post(`/api/tasks/${t._id}/stop`)
  await load()
}

onMounted(load)
</script>
