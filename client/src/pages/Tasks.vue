<script setup>
import { ref, onMounted, computed } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";

const router = useRouter();
const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const http = axios.create({ baseURL: API });

http.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      localStorage.removeItem("token");
      router.push("/login");
      return;
    }
    return Promise.reject(err);
  }
);

const tasks = ref([]);
const loading = ref(true);
const statusFilter = ref("all");
const showCreateModal = ref(false);
const showEditModal = ref(false);
const editingTask = ref(null);

// All UI time uses Asia/Jakarta (WIB)
const JAKARTA_TZ = "Asia/Jakarta";
const form = ref({
  name: "",
  // use separate date & time fields for broad browser support
  deadlineDatePart: "",
  deadlineTimePart: "",
  reminderType: "once",
  reminderOffset: "3d",
  endDate: "",
});
const error = ref("");

const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleString("en-US", {
    timeZone: JAKARTA_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateShort = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleString("en-US", {
    timeZone: JAKARTA_TZ,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isOverdue = (deadline) => {
  return new Date(deadline) < new Date();
};

const getJakartaDateString = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));

const isToday = (deadline) => {
  if (!deadline) return false;
  const todayJakarta = getJakartaDateString(new Date());
  const dueJakarta = getJakartaDateString(deadline);
  return todayJakarta === dueJakarta;
};

const loadTasks = async () => {
  try {
    loading.value = true;
    const { data } = await http.get(`/api/tasks?includeCompleted=true`);
    tasks.value = data;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const filteredTasks = computed(() => {
  const sf = statusFilter.value;
  if (sf === "pending") {
    return tasks.value.filter((t) => t.status?.toLowerCase() === "pending");
  }
  if (sf === "complete") {
    return tasks.value.filter((t) => t.status?.toLowerCase() === "completed");
  }
  return tasks.value;
});

const buildIsoFromParts = (datePart, timePart) => {
  if (!datePart || !timePart) return "";
  // Interpret the provided date/time as Asia/Jakarta local time (UTC+7),
  // and convert to a UTC ISO string for storage/transmission.
  const [y, m, d] = datePart.split("-").map((x) => parseInt(x, 10));
  const [hh, mm] = timePart.split(":").map((x) => parseInt(x, 10));
  const utcMs = Date.UTC(y, (m || 1) - 1, d || 1, (hh || 0) - 7, mm || 0, 0, 0);
  return new Date(utcMs).toISOString();
};

const createTask = async () => {
  error.value = "";
  if (
    !form.value.name ||
    !form.value.deadlineDatePart ||
    !form.value.deadlineTimePart
  ) {
    error.value = "Task name and deadline are required";
    return;
  }
  try {
    const payload = {
      name: form.value.name,
      deadline: buildIsoFromParts(
        form.value.deadlineDatePart,
        form.value.deadlineTimePart
      ),
      reminderType: form.value.reminderType,
      reminderOffset: form.value.reminderOffset,
      endDate: form.value.endDate
        ? new Date(form.value.endDate).toISOString()
        : undefined,
    };
    if (!payload.deadline) {
      error.value = "Please select a valid date and time";
      return;
    }
    await http.post("/api/tasks", payload);
    form.value = {
      name: "",
      deadlineDatePart: "",
      deadlineTimePart: "",
      reminderType: "once",
      reminderOffset: "3d",
      endDate: "",
    };
    showCreateModal.value = false;
    await loadTasks();
  } catch (e) {
    error.value = e?.response?.data?.error || "Failed to create task";
  }
};

const openEdit = (task) => {
  error.value = "";
  editingTask.value = task;
  const d = task.deadline ? new Date(task.deadline) : null;
  // Prefill date/time fields in Asia/Jakarta
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const datePart = d ? dateFmt.format(d) : "";
  const timePart = d ? timeFmt.format(d) : "";
  // Format endDate as date (YYYY-MM-DD) in Asia/Jakarta as well (if present)
  const endDatePart = task.endDate
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: JAKARTA_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(task.endDate))
    : "";
  form.value = {
    name: task.name,
    deadlineDatePart: datePart,
    deadlineTimePart: timePart,
    reminderType: task.reminderType || "once",
    reminderOffset: task.reminderOffset || "3d",
    endDate: endDatePart,
  };
  showEditModal.value = true;
};

const updateTask = async () => {
  if (!editingTask.value) return;
  error.value = "";
  if (
    !form.value.name ||
    !form.value.deadlineDatePart ||
    !form.value.deadlineTimePart
  ) {
    error.value = "Task name and deadline are required";
    return;
  }
  try {
    const payload = {
      name: form.value.name,
      deadline: buildIsoFromParts(
        form.value.deadlineDatePart,
        form.value.deadlineTimePart
      ),
      reminderType: form.value.reminderType,
      reminderOffset: form.value.reminderOffset,
      endDate: form.value.endDate
        ? new Date(form.value.endDate).toISOString()
        : undefined,
    };
    if (!payload.deadline) {
      error.value = "Please select a valid date and time";
      return;
    }
    await http.put(`/api/tasks/${editingTask.value._id}`, payload);
    showEditModal.value = false;
    editingTask.value = null;
    form.value = {
      name: "",
      deadlineDatePart: "",
      deadlineTimePart: "",
      reminderType: "once",
      reminderOffset: "3d",
      endDate: "",
    };
    await loadTasks();
  } catch (e) {
    error.value = e?.response?.data?.error || "Failed to update task";
  }
};

const stopTask = async (taskId) => {
  if (!confirm("Stop this task? This cannot be undone.")) return;
  try {
    await http.post(`/api/tasks/${taskId}/stop`);
    await loadTasks();
  } catch (e) {
    alert(e?.response?.data?.error || "Failed to stop task");
  }
};

const deleteTask = async (taskId) => {
  if (!confirm("Are you sure you want to delete this task?")) return;
  try {
    await http.delete(`/api/tasks/${taskId}`);
    await loadTasks();
  } catch (e) {
    alert("Failed to delete task");
  }
};

const goToProfile = () => {
  router.push("/profile");
};

const logout = async () => {
  try {
    const token = localStorage.getItem("token");
    if (token) {
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {}
  localStorage.removeItem("token");
  router.push("/login");
};

onMounted(loadTasks);
</script>

<template>
  <div class="min-h-screen flex bg-bg-gray">
    <!-- Sidebar -->
    <aside
      class="w-64 flex flex-col bg-white border-r border-border-light p-4 gap-6"
    >
      <!-- App Header -->
      <div class="flex items-center gap-3 px-3">
        <svg
          class="w-[60px] h-[72px]"
          width="60"
          height="72"
          viewBox="0 0 60 72"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M30 61C26.5417 61 23.2917 60.3438 20.25 59.0312C17.2083 57.7188 14.5625 55.9375 12.3125 53.6875C10.0625 51.4375 8.28125 48.7917 6.96875 45.75C5.65625 42.7083 5 39.4583 5 36C5 32.5417 5.65625 29.2917 6.96875 26.25C8.28125 23.2083 10.0625 20.5625 12.3125 18.3125C14.5625 16.0625 17.2083 14.2812 20.25 12.9688C23.2917 11.6562 26.5417 11 30 11C32.7083 11 35.2708 11.3958 37.6875 12.1875C40.1042 12.9792 42.3333 14.0833 44.375 15.5L40.75 19.1875C39.1667 18.1875 37.4792 17.4062 35.6875 16.8438C33.8958 16.2812 32 16 30 16C24.4583 16 19.7396 17.9479 15.8438 21.8438C11.9479 25.7396 10 30.4583 10 36C10 41.5417 11.9479 46.2604 15.8438 50.1562C19.7396 54.0521 24.4583 56 30 56C35.5417 56 40.2604 54.0521 44.1562 50.1562C48.0521 46.2604 50 41.5417 50 36C50 35.25 49.9583 34.5 49.875 33.75C49.7917 33 49.6667 32.2708 49.5 31.5625L53.5625 27.5C54.0208 28.8333 54.375 30.2083 54.625 31.625C54.875 33.0417 55 34.5 55 36C55 39.4583 54.3438 42.7083 53.0312 45.75C51.7188 48.7917 49.9375 51.4375 47.6875 53.6875C45.4375 55.9375 42.7917 57.7188 39.75 59.0312C36.7083 60.3438 33.4583 61 30 61ZM26.5 47.5L15.875 36.875L19.375 33.375L26.5 40.5L51.5 15.4375L55 18.9375L26.5 47.5Z"
            fill="#4A90E2"
          />
        </svg>
        <div class="flex flex-col">
          <h1 class="text-[#111418] text-base font-medium leading-6">
            Reminder App
          </h1>
          <p class="text-text-secondary text-sm leading-[21px]">
            Manage your tasks
          </p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex flex-col gap-2">
        <a
          href="/tasks"
          class="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#137FEC1A]"
        >
          <svg
            class="w-6 h-7"
            width="25"
            height="28"
            viewBox="0 0 25 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7.1489 11.0833V9.13888H20.76V11.0833H7.1489ZM7.1489 14.9722V13.0278H20.76V14.9722H7.1489ZM7.1489 18.8611V16.9167H20.76V18.8611H7.1489ZM4.23223 11.0833C3.95677 11.0833 3.72587 10.9902 3.53952 10.8038C3.35318 10.6175 3.26001 10.3866 3.26001 10.1111C3.26001 9.83565 3.35318 9.60475 3.53952 9.41841C3.72587 9.23206 3.95677 9.13889 4.23223 9.13889C4.50769 9.13889 4.7386 9.23206 4.92494 9.41841C5.11128 9.60475 5.20445 9.83565 5.20445 10.1111C5.20445 10.3866 5.11128 10.6175 4.92494 10.8038C4.7386 10.9902 4.50769 11.0833 4.23223 11.0833ZM4.23223 14.9722C3.95677 14.9722 3.72587 14.8791 3.53952 14.6927C3.35318 14.5064 3.26001 14.2755 3.26001 14C3.26001 13.7245 3.35318 13.4936 3.53952 13.3073C3.72587 13.121 3.95677 13.0278 4.23223 13.0278C4.50769 13.0278 4.7386 13.121 4.92494 13.3073C5.11128 13.4936 5.20445 13.7245 5.20445 14C5.20445 14.2755 5.11128 14.5064 4.92494 14.6927C4.7386 14.8791 4.50769 14.9722 4.23223 14.9722ZM4.23223 18.8611C3.95677 18.8611 3.72587 18.7679 3.53952 18.5816C3.35318 18.3953 3.26001 18.1644 3.26001 17.8889C3.26001 17.6134 3.35318 17.3825 3.53952 17.1962C3.72587 17.0098 3.95677 16.9167 4.23223 16.9167C4.50769 16.9167 4.7386 17.0098 4.92494 17.1962C5.11128 17.3825 5.20445 17.6134 5.20445 17.8889C5.20445 18.1644 5.11128 18.3953 4.92494 18.5816C4.7386 18.7679 4.50769 18.8611 4.23223 18.8611Z"
              fill="#137FEC"
            />
          </svg>
          <span class="text-primary-dark text-sm font-medium leading-[21px]"
            >All Tasks</span
          >
        </a>
        <button
          @click="goToProfile"
          class="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-gray-50"
        >
          <svg
            class="w-6 h-7"
            width="25"
            height="28"
            viewBox="0 0 25 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.01 14C10.9406 14 10.0251 13.6192 9.26349 12.8576C8.50191 12.0961 8.12113 11.1806 8.12113 10.1111C8.12113 9.04172 8.50191 8.12621 9.26349 7.36464C10.0251 6.60306 10.9406 6.22228 12.01 6.22228C13.0795 6.22228 13.995 6.60306 14.7565 7.36464C15.5181 8.12621 15.8989 9.04172 15.8989 10.1111C15.8989 11.1806 15.5181 12.0961 14.7565 12.8576C13.995 13.6192 13.0795 14 12.01 14ZM4.23224 21.7778V19.0556C4.23224 18.5047 4.37402 17.9983 4.65759 17.5365C4.94115 17.0747 5.31789 16.7223 5.78779 16.4792C6.79242 15.9769 7.81326 15.6002 8.85029 15.349C9.88733 15.0979 10.9406 14.9723 12.01 14.9723C13.0795 14.9723 14.1327 15.0979 15.1697 15.349C16.2068 15.6002 17.2276 15.9769 18.2322 16.4792C18.7021 16.7223 19.0789 17.0747 19.3624 17.5365C19.646 17.9983 19.7878 18.5047 19.7878 19.0556V21.7778H4.23224Z"
              fill="#111418"
            />
          </svg>
          <span class="text-[#111418] text-sm font-medium leading-[21px]"
            >Profile</span
          >
        </button>
      </nav>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col">
      <!-- Main -->
      <main class="p-8 flex-1">
        <div class="max-w-7xl flex flex-col">
          <!-- Header -->
          <div class="flex justify-between items-center pb-8">
            <h2
              class="text-[#111418] text-4xl font-black leading-[45px] tracking-[-1.188px]"
            >
              My Reminders
            </h2>
            <button
              @click="showCreateModal = true"
              class="h-12 px-6 flex items-center justify-center bg-primary-dark text-white text-sm font-bold leading-[21px] tracking-[0.21px] rounded-lg shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-dark focus:ring-offset-2"
            >
              Create New Task
            </button>
          </div>

          <!-- Status Filter (always visible) -->
          <div class="flex items-center gap-3 mb-6">
            <span class="text-sm text-text-secondary">Filter:</span>
            <div class="flex gap-2">
              <button
                type="button"
                @click="statusFilter = 'all'"
                :class="
                  statusFilter === 'all'
                    ? 'bg-primary-dark text-white'
                    : 'bg-[#E5E7EB] text-[#333]'
                "
                class="px-4 py-2 rounded-lg text-sm font-medium leading-5 hover:bg-opacity-90 focus:outline-none"
              >
                All
              </button>
              <button
                type="button"
                @click="statusFilter = 'pending'"
                :class="
                  statusFilter === 'pending'
                    ? 'bg-primary-dark text-white'
                    : 'bg-[#E5E7EB] text-[#333]'
                "
                class="px-4 py-2 rounded-lg text-sm font-medium leading-5 hover:bg-opacity-90 focus:outline-none"
              >
                Pending
              </button>
              <button
                type="button"
                @click="statusFilter = 'complete'"
                :class="
                  statusFilter === 'complete'
                    ? 'bg-primary-dark text-white'
                    : 'bg-[#E5E7EB] text-[#333]'
                "
                class="px-4 py-2 rounded-lg text-sm font-medium leading-5 hover:bg-opacity-90 focus:outline-none"
              >
                Completed
              </button>
            </div>
          </div>

          <!-- Tasks List -->
          <div v-if="loading" class="text-center py-12">
            <p class="text-text-secondary">Loading tasks...</p>
          </div>

          <div
            v-else-if="filteredTasks.length === 0"
            class="flex flex-col gap-4"
          >
            <div
              class="flex flex-col items-center justify-center py-12 px-12 border-2 border-dashed border-[#D1D5DB] rounded-xl"
            >
              <svg
                class="w-12 h-14 mb-3"
                width="48"
                height="58"
                viewBox="0 0 48 58"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M24 49C21.2333 49 18.6333 48.475 16.2 47.425C13.7667 46.375 11.65 44.95 9.85 43.15C8.05 41.35 6.625 39.2333 5.575 36.8C4.525 34.3667 4 31.7667 4 29C4 26.2333 4.525 23.6333 5.575 21.2C6.625 18.7667 8.05 16.65 9.85 14.85C11.65 13.05 13.7667 11.625 16.2 10.575C18.6333 9.525 21.2333 9 24 9C26.1667 9 28.2167 9.31667 30.15 9.95C32.0833 10.5833 33.8667 11.4667 35.5 12.6L32.6 15.55C31.3333 14.75 29.9833 14.125 28.55 13.675C27.1167 13.225 25.6 13 24 13C19.5667 13 15.7917 14.5583 12.675 17.675C9.55833 20.7917 8 24.5667 8 29C8 33.4333 9.55833 37.2083 12.675 40.325C15.7917 43.4417 19.5667 45 24 45C28.4333 45 32.2083 43.4417 35.325 40.325C38.4417 37.2083 40 33.4333 40 29C40 28.4 39.9667 27.8 39.9 27.2C39.8333 26.6 39.7333 26.0167 39.6 25.45L42.85 22.2C43.2167 23.2667 43.5 24.3667 43.7 25.5C43.9 26.6333 44 27.8 44 29C44 31.7667 43.475 34.3667 42.425 36.8C41.375 39.2333 39.95 41.35 38.15 43.15C36.35 44.95 34.2333 46.375 31.8 47.425C29.3667 48.475 26.7667 49 24 49ZM21.2 38.2L12.7 29.7L15.5 26.9L21.2 32.6L41.2 12.55L44 15.35L21.2 38.2Z"
                  fill="#9CA3AF"
                />
              </svg>
              <h3 class="text-[#111418] text-xl font-semibold leading-7 mb-2">
                You have no pending tasks!
              </h3>
              <p class="text-text-secondary text-base leading-6 mb-6">
                Click the button below to add a new one.
              </p>
              <button
                @click="showCreateModal = true"
                class="h-12 px-6 flex items-center justify-center bg-primary-dark text-white text-sm font-bold leading-[21px] tracking-[0.21px] rounded-lg shadow-sm hover:bg-opacity-90"
              >
                Create New Task
              </button>
            </div>
          </div>

          <div v-else class="flex flex-col gap-6">
            <div
              v-for="task in filteredTasks"
              :key="task._id"
              class="min-h-[72px] p-3.5 flex justify-between items-center bg-white rounded-lg shadow-sm"
            >
              <div class="flex flex-col flex-1">
                <h3 class="text-[#111418] text-base font-medium leading-6">
                  {{ task.name }}
                </h3>
                <p
                  class="text-sm leading-[21px]"
                  :class="
                    isToday(task.deadline) || isOverdue(task.deadline)
                      ? 'text-warning'
                      : 'text-text-secondary'
                  "
                >
                  Due: {{ formatDateShort(task.deadline) }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="stopTask(task._id)"
                  v-if="task.status === 'pending'"
                  class="p-1.5 rounded-full hover:bg-gray-100"
                  title="Cancel Reminder"
                >
                  <svg
                    class="w-6 h-7"
                    width="25"
                    height="28"
                    viewBox="0 0 25 28"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.23224 20.8056V18.8611H6.17668V12.0556C6.17668 10.7107 6.58178 9.51563 7.39196 8.47049C8.20215 7.42535 9.25539 6.74075 10.5517 6.41667V5.73612C10.5517 5.33102 10.6935 4.9867 10.977 4.70313C11.2606 4.41957 11.6049 4.27778 12.01 4.27778C12.4151 4.27778 12.7594 4.41957 13.043 4.70313C13.3266 4.9867 13.4684 5.33102 13.4684 5.73612V6.41667C14.7646 6.74075 15.8179 7.42535 16.6281 8.47049C17.4383 9.51563 17.8434 10.7107 17.8434 12.0556V18.8611H19.7878V20.8056H4.23224ZM12.01 23.7222C11.4753 23.7222 11.0175 23.5318 10.6368 23.151C10.256 22.7703 10.0656 22.3125 10.0656 21.7778H13.9545C13.9545 22.3125 13.7641 22.7703 13.3833 23.151C13.0025 23.5318 12.5447 23.7222 12.01 23.7222Z"
                      fill="#617589"
                    />
                  </svg>
                </button>
                <button
                  @click="openEdit(task)"
                  v-if="task.status === 'pending'"
                  class="p-1.5 rounded-full hover:bg-gray-100"
                  :disabled="task.status !== 'pending'"
                  title="Edit Task"
                >
                  <svg
                    class="w-6 h-7"
                    width="25"
                    height="28"
                    viewBox="0 0 25 28"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5.2023 20.7969H6.58714L16.0867 11.2974L14.7018 9.91255L5.2023 19.4121V20.7969ZM3.25867 22.7405V18.6103L16.0867 5.80662C16.281 5.62845 16.4956 5.49078 16.7305 5.3936C16.9653 5.29642 17.2123 5.24783 17.4715 5.24783C17.7306 5.24783 17.9817 5.29642 18.2247 5.3936C18.4676 5.49078 18.6782 5.63655 18.8563 5.83092L20.1926 7.19146C20.3869 7.36963 20.5287 7.58019 20.6178 7.82314C20.7068 8.0661 20.7514 8.30905 20.7514 8.552C20.7514 8.81116 20.7068 9.05816 20.6178 9.29302C20.5287 9.52787 20.3869 9.74248 20.1926 9.93684L7.38889 22.7405H3.25867Z"
                      fill="#617589"
                    />
                  </svg>
                </button>
                <button
                  @click="deleteTask(task._id)"
                  class="p-1.5 rounded-full hover:bg-gray-100"
                  title="Delete Task"
                >
                  <svg
                    class="w-6 h-7"
                    width="25"
                    height="28"
                    viewBox="0 0 25 28"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7.14891 22.75C6.61418 22.75 6.15643 22.5596 5.77564 22.1788C5.39485 21.798 5.20446 21.3403 5.20446 20.8056V8.16667H4.23224V6.22222H9.09335V5.25H14.9267V6.22222H19.7878V8.16667H18.8156V20.8056C18.8156 21.3403 18.6252 21.798 18.2444 22.1788C17.8636 22.5596 17.4059 22.75 16.8711 22.75H7.14891Z"
                      fill="#617589"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Create Task Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="showCreateModal = false"
    >
      <div
        class="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <h3
          class="text-[#333] text-4xl font-black leading-[45px] tracking-[-1.188px] mb-6"
        >
          Create New Task
        </h3>

        <div class="flex flex-col gap-6">
          <!-- Task Title -->
          <div class="flex flex-col">
            <label class="text-[#333] text-base font-medium leading-6 pb-2"
              >Task Title</label
            >
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g., Course discussion schedule"
              class="h-[54px] px-4 py-4 rounded-lg border border-text-gray bg-white text-base placeholder:text-text-light focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <!-- Due Date -->
          <div class="flex flex-col">
            <label class="text-[#333] text-base font-medium leading-6 pb-2"
              >Due Date</label
            >
            <div class="grid grid-cols-2 gap-3">
              <input
                v-model="form.deadlineDatePart"
                type="date"
                class="h-[54px] px-4 py-4 rounded-lg border border-text-gray bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <input
                v-model="form.deadlineTimePart"
                type="time"
                step="60"
                class="h-[54px] px-4 py-4 rounded-lg border border-text-gray bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <p class="text-xs text-text-secondary mt-2">
              All times are shown and scheduled in WIB (Asia/Jakarta, UTC+7).
              Reminders are delivered according to WIB, regardless of your
              device timezone.
            </p>
          </div>

          <!-- Remind me -->
          <div class="flex flex-col gap-4">
            <label class="text-[#333] text-base font-medium leading-6"
              >Remind me</label
            >
            <div class="flex gap-4">
              <label
                class="flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer"
                :class="
                  form.reminderOffset === '3d'
                    ? 'border-primary bg-blue-50'
                    : 'border-[#DBE0E6]'
                "
              >
                <input
                  type="radio"
                  v-model="form.reminderOffset"
                  value="3d"
                  class="w-5 h-5"
                />
                <span class="text-[#333] text-sm font-medium leading-5"
                  >3 days before</span
                >
              </label>
              <label
                class="flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer"
                :class="
                  form.reminderOffset === '1d'
                    ? 'border-primary bg-blue-50'
                    : 'border-[#DBE0E6]'
                "
              >
                <input
                  type="radio"
                  v-model="form.reminderOffset"
                  value="1d"
                  class="w-5 h-5"
                />
                <span class="text-[#333] text-sm font-medium leading-5"
                  >1 day before</span
                >
              </label>
              <label
                class="flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer"
                :class="
                  form.reminderOffset === '3h'
                    ? 'border-primary bg-blue-50'
                    : 'border-[#DBE0E6]'
                "
              >
                <input
                  type="radio"
                  v-model="form.reminderOffset"
                  value="3h"
                  class="w-5 h-5"
                />
                <span class="text-[#333] text-sm font-medium leading-5"
                  >3 hours before</span
                >
              </label>
            </div>
          </div>

          <!-- Recurring -->
          <div class="flex flex-col gap-4">
            <label class="text-[#333] text-base font-medium leading-6"
              >Recurring</label
            >
            <div class="flex gap-4">
              <label
                class="flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer"
                :class="
                  form.reminderType === 'once'
                    ? 'border-primary bg-blue-50'
                    : 'border-[#DBE0E6]'
                "
              >
                <input
                  type="radio"
                  v-model="form.reminderType"
                  value="once"
                  class="w-5 h-5"
                />
                <span class="text-[#333] text-sm font-medium leading-5"
                  >Once</span
                >
              </label>
              <label
                class="flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer"
                :class="
                  form.reminderType === 'weekly'
                    ? 'border-primary bg-blue-50'
                    : 'border-[#DBE0E6]'
                "
              >
                <input
                  type="radio"
                  v-model="form.reminderType"
                  value="weekly"
                  class="w-5 h-5"
                />
                <span class="text-[#333] text-sm font-medium leading-5"
                  >Weekly</span
                >
              </label>
            </div>
          </div>

          <!-- End Date (if weekly) -->
          <div v-if="form.reminderType === 'weekly'" class="flex flex-col">
            <label class="text-[#333] text-base font-medium leading-6 pb-2"
              >End Date</label
            >
            <input
              v-model="form.endDate"
              type="date"
              class="h-[54px] px-4 py-4 rounded-lg border border-text-gray bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <!-- Error Message -->
          <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

          <!-- Actions -->
          <div class="flex justify-end gap-4 pt-4">
            <button
              @click="showCreateModal = false"
              class="px-6 py-3 bg-[#E5E7EB] text-[#333] text-base font-medium leading-6 rounded-lg hover:bg-gray-300 focus:outline-none"
            >
              Cancel
            </button>
            <button
              @click="createTask"
              class="px-6 py-3 bg-primary text-white text-base font-medium leading-6 rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Save Task
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Task Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="showEditModal = false"
    >
      <div
        class="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <h3
          class="text-[#333] text-4xl font-black leading-[45px] tracking-[-1.188px] mb-6"
        >
          Edit Task
        </h3>
        <div class="flex flex-col gap-6">
          <div class="flex flex-col">
            <label class="text-[#333] text-base font-medium leading-6 pb-2"
              >Task Title</label
            >
            <input
              v-model="form.name"
              type="text"
              class="h-[54px] px-4 py-4 rounded-lg border border-text-gray bg-white text-base placeholder:text-text-light focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div class="flex flex-col">
            <label class="text-[#333] text-base font-medium leading-6 pb-2"
              >Due Date</label
            >
            <div class="grid grid-cols-2 gap-3">
              <input
                v-model="form.deadlineDatePart"
                type="date"
                class="h-[54px] px-4 py-4 rounded-lg border border-text-gray bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <input
                v-model="form.deadlineTimePart"
                type="time"
                step="60"
                class="h-[54px] px-4 py-4 rounded-lg border border-text-gray bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <p class="text-xs text-text-secondary mt-2">
              All times are shown and scheduled in WIB (Asia/Jakarta, UTC+7).
              Reminders are delivered according to WIB, regardless of your
              device timezone.
            </p>
          </div>
          <div class="flex flex-col gap-4">
            <label class="text-[#333] text-base font-medium leading-6"
              >Remind me</label
            >
            <div class="flex gap-4">
              <label
                class="flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer"
                :class="
                  form.reminderOffset === '3d'
                    ? 'border-primary bg-blue-50'
                    : 'border-[#DBE0E6]'
                "
              >
                <input
                  type="radio"
                  v-model="form.reminderOffset"
                  value="3d"
                  class="w-5 h-5"
                />
                <span class="text-[#333] text-sm font-medium leading-5"
                  >3 days before</span
                >
              </label>
              <label
                class="flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer"
                :class="
                  form.reminderOffset === '1d'
                    ? 'border-primary bg-blue-50'
                    : 'border-[#DBE0E6]'
                "
              >
                <input
                  type="radio"
                  v-model="form.reminderOffset"
                  value="1d"
                  class="w-5 h-5"
                />
                <span class="text-[#333] text-sm font-medium leading-5"
                  >1 day before</span
                >
              </label>
              <label
                class="flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer"
                :class="
                  form.reminderOffset === '3h'
                    ? 'border-primary bg-blue-50'
                    : 'border-[#DBE0E6]'
                "
              >
                <input
                  type="radio"
                  v-model="form.reminderOffset"
                  value="3h"
                  class="w-5 h-5"
                />
                <span class="text-[#333] text-sm font-medium leading-5"
                  >3 hours before</span
                >
              </label>
            </div>
          </div>
          <div class="flex flex-col gap-4">
            <label class="text-[#333] text-base font-medium leading-6"
              >Recurring</label
            >
            <div class="flex gap-4">
              <label
                class="flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer"
                :class="
                  form.reminderType === 'once'
                    ? 'border-primary bg-blue-50'
                    : 'border-[#DBE0E6]'
                "
              >
                <input
                  type="radio"
                  v-model="form.reminderType"
                  value="once"
                  class="w-5 h-5"
                />
                <span class="text-[#333] text-sm font-medium leading-5"
                  >Once</span
                >
              </label>
              <label
                class="flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer"
                :class="
                  form.reminderType === 'weekly'
                    ? 'border-primary bg-blue-50'
                    : 'border-[#DBE0E6]'
                "
              >
                <input
                  type="radio"
                  v-model="form.reminderType"
                  value="weekly"
                  class="w-5 h-5"
                />
                <span class="text-[#333] text-sm font-medium leading-5"
                  >Weekly</span
                >
              </label>
            </div>
          </div>
          <div v-if="form.reminderType === 'weekly'" class="flex flex-col">
            <label class="text-[#333] text-base font-medium leading-6 pb-2"
              >End Date</label
            >
            <input
              v-model="form.endDate"
              type="date"
              class="h-[54px] px-4 py-4 rounded-lg border border-text-gray bg-white text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
          <div class="flex justify-end gap-4 pt-4">
            <button
              @click="showEditModal = false"
              class="px-6 py-3 bg-[#E5E7EB] text-[#333] text-base font-medium leading-6 rounded-lg hover:bg-gray-300 focus:outline-none"
            >
              Cancel
            </button>
            <button
              @click="updateTask"
              class="px-6 py-3 bg-primary text-white text-base font-medium leading-6 rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
