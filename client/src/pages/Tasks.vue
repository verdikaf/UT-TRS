<template>
  <div>
    <div class="card">
      <h2>Create Task</h2>
      <div class="row">
        <input v-model="form.name" placeholder="Task name" />
        <input type="datetime-local" v-model="form.deadline" />
        <select v-model="form.reminderType">
          <option value="once">One-time</option>
          <option value="weekly">Weekly recurring</option>
        </select>
        <input v-if="form.reminderType==='weekly'" type="date" v-model="form.endDate" placeholder="Recurring end date" />
        <select v-model="form.reminderOffset">
          <option value="3d">3 days before</option>
          <option value="1d">1 day before</option>
          <option value="3h">3 hours before</option>
        </select>
        <button @click="createTask">Add</button>
      </div>
      <p v-if="error" style="color:red">{{ error }}</p>
    </div>

    <div class="card">
      <h2>My Tasks</h2>
      <div v-for="t in tasks" :key="t._id" class="row" style="align-items:center; border-bottom:1px solid #eee; padding:8px 0;">
        <div style="flex:1">
          <div><strong>{{ t.name }}</strong></div>
          <div>Deadline: {{ formatDate(t.deadline) }}</div>
          <div>Type: {{ t.reminderType }} | Offset: {{ t.reminderOffset }} | Status: {{ t.status }}</div>
          <div v-if="t.reminderType==='weekly'">End: {{ t.endDate ? formatDate(t.endDate) : '-' }}</div>
        </div>
        <button @click="editTask(t)">Edit</button>
        <button @click="removeTask(t)">Delete</button>
      </div>
    </div>

    <div v-if="editing" class="card">
      <h2>Edit Task</h2>
      <div class="row">
        <input v-model="editForm.name" />
        <input type="datetime-local" v-model="editForm.deadline" />
        <select v-model="editForm.reminderType">
          <option value="once">One-time</option>
          <option value="weekly">Weekly recurring</option>
        </select>
        <input v-if="editForm.reminderType==='weekly'" type="date" v-model="editForm.endDate" placeholder="Recurring end date" />
        <select v-model="editForm.reminderOffset">
          <option value="3d">3 days before</option>
          <option value="1d">1 day before</option>
          <option value="3h">3 hours before</option>
        </select>
        <select v-model="editForm.status">
          <option value="pending">pending</option>
          <option value="completed">completed</option>
        </select>
        <button @click="updateTask">Save</button>
        <button @click="cancelEdit">Cancel</button>
      </div>
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
  config.headers.Authorization = `Bearer ${token}`
  return config
})

const form = ref({ name: '', deadline: '', reminderType: 'once', reminderOffset: '3d', endDate: '' })
const error = ref('')
const tasks = ref([])

const editing = ref(false)
const editForm = ref({ _id: '', name: '', deadline: '', reminderType: 'once', reminderOffset: '3d', status: 'pending', endDate: '' })

function formatDate(d){ return new Date(d).toLocaleString() }

async function load(){
  const { data } = await http.get('/api/tasks')
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
  }catch(e){ alert(e?.response?.data?.error || 'Failed to update') }
}

function cancelEdit(){ editing.value = false }

async function removeTask(t){
  if(!confirm('Delete this task?')) return
  await http.delete(`/api/tasks/${t._id}`)
  await load()
}

onMounted(load)
</script>
