<script setup>
import { ref, onMounted } from "vue";
import axios from "axios";
import { encryptPassword } from "../utils/encryption.js";
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

const me = ref(null);
const loading = ref(true);
const name = ref("");
const phone = ref("");
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const infoMsg = ref("");
const infoMsgType = ref("");
const pwdMsg = ref("");
const pwdMsgType = ref("");

const showCurrent = ref(false);
const showNew = ref(false);
const showConfirm = ref(false);

const togglePasswordVisibility = (field) => {
  if (field === "current") showCurrent.value = !showCurrent.value;
  else if (field === "new") showNew.value = !showNew.value;
  else if (field === "confirm") showConfirm.value = !showConfirm.value;
};

const loadMe = async () => {
  try {
    loading.value = true;
    const { data } = await http.get("/api/profile/me");
    me.value = data;
    name.value = data.name || "";
    phone.value = data.phone || "";
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const updateInfo = async () => {
  infoMsg.value = "";
  try {
    // validate phone only when changing phone
    const payload = { name: name.value };
    if (phone.value !== me.value.phone) {
      await http.post("/api/phone/validate", {
        phone: phone.value,
        name: name.value,
      });
      payload.phone = phone.value;
    }
    const { data } = await http.put("/api/profile/info", payload);
    me.value = data.user;
    if (data.token) localStorage.setItem("token", data.token);
    infoMsg.value = "Information updated successfully";
    infoMsgType.value = "success";
  } catch (e) {
    infoMsg.value = e?.response?.data?.error || "Failed to update information";
    infoMsgType.value = "error";
  }
};

const changePassword = async () => {
  pwdMsg.value = "";
  if (newPassword.value !== confirmPassword.value) {
    pwdMsg.value = "New passwords do not match";
    pwdMsgType.value = "error";
    return;
  }
  if (!currentPassword.value || !newPassword.value) {
    pwdMsg.value = "Current and new password required";
    pwdMsgType.value = "error";
    return;
  }
  let currentPasswordEncrypted, newPasswordEncrypted;
  try {
    currentPasswordEncrypted = await encryptPassword(currentPassword.value);
    newPasswordEncrypted = await encryptPassword(newPassword.value);
  } catch (e) {
    pwdMsg.value =
      "Encryption error: " +
      (e?.message || "Failed to encrypt password. Please try again later.");
    pwdMsgType.value = "error";
    return;
  }
  try {
    const { data } = await http.put("/api/profile/password", {
      currentPasswordEncrypted,
      newPasswordEncrypted,
    });
    if (data.token) localStorage.setItem("token", data.token);
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    pwdMsg.value = "Password changed successfully";
    pwdMsgType.value = "success";
  } catch (e) {
    pwdMsg.value = e?.response?.data?.error || "Failed to change password";
    pwdMsgType.value = "error";
  }
};

const goToTasks = () => {
  router.push("/tasks");
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

onMounted(loadMe);
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
        <button
          @click="goToTasks"
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
              d="M7.1489 11.0833V9.13889H20.76V11.0833H7.1489ZM7.1489 14.9722V13.0278H20.76V14.9722H7.1489ZM7.1489 18.8611V16.9167H20.76V18.8611H7.1489ZM4.23223 11.0833C3.95677 11.0833 3.72587 10.9902 3.53952 10.8038C3.35318 10.6175 3.26001 10.3866 3.26001 10.1111C3.26001 9.83565 3.35318 9.60475 3.53952 9.41841C3.72587 9.23206 3.95677 9.13889 4.23223 9.13889C4.50769 9.13889 4.7386 9.23206 4.92494 9.41841C5.11128 9.60475 5.20445 9.83565 5.20445 10.1111C5.20445 10.3866 5.11128 10.6175 4.92494 10.8038C4.7386 10.9902 4.50769 11.0833 4.23223 11.0833ZM4.23223 14.9722C3.95677 14.9722 3.72587 14.8791 3.53952 14.6927C3.35318 14.5064 3.26001 14.2755 3.26001 14C3.26001 13.7245 3.35318 13.4936 3.53952 13.3073C3.72587 13.121 3.95677 13.0278 4.23223 13.0278C4.50769 13.0278 4.7386 13.121 4.92494 13.3073C5.11128 13.4936 5.20445 13.7245 5.20445 14C5.20445 14.2755 5.11128 14.5064 4.92494 14.6927C4.7386 14.8791 4.50769 14.9722 4.23223 14.9722ZM4.23223 18.8611C3.95677 18.8611 3.72587 18.7679 3.53952 18.5816C3.35318 18.3953 3.26001 18.1644 3.26001 17.8889C3.26001 17.6134 3.35318 17.3825 3.53952 17.1962C3.72587 17.0098 3.95677 16.9167 4.23223 16.9167C4.50769 16.9167 4.7386 17.0098 4.92494 17.1962C5.11128 17.3825 5.20445 17.6134 5.20445 17.8889C5.20445 18.1644 5.11128 18.3953 4.92494 18.5816C4.7386 18.7679 4.50769 18.8611 4.23223 18.8611Z"
              fill="#111418"
            />
          </svg>
          <span class="text-[#111418] text-sm font-medium leading-[21px]"
            >All Tasks</span
          >
        </button>
        <a
          href="/profile"
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
              d="M12.01 14C10.9406 14 10.0251 13.6192 9.26349 12.8576C8.50191 12.0961 8.12113 11.1806 8.12113 10.1111C8.12113 9.04172 8.50191 8.12621 9.26349 7.36464C10.0251 6.60306 10.9406 6.22228 12.01 6.22228C13.0795 6.22228 13.995 6.60306 14.7565 7.36464C15.5181 8.12621 15.8989 9.04172 15.8989 10.1111C15.8989 11.1806 15.5181 12.0961 14.7565 12.8576C13.995 13.6192 13.0795 14 12.01 14ZM4.23224 21.7778V19.0556C4.23224 18.5047 4.37402 17.9983 4.65759 17.5365C4.94115 17.0747 5.31789 16.7223 5.78779 16.4792C6.79242 15.9769 7.81326 15.6002 8.85029 15.349C9.88733 15.0979 10.9406 14.9723 12.01 14.9723C13.0795 14.9723 14.1327 15.0979 15.1697 15.349C16.2068 15.6002 17.2276 15.9769 18.2322 16.4792C18.7021 16.7223 19.0789 17.0747 19.3624 17.5365C19.646 17.9983 19.7878 18.5047 19.7878 19.0556V21.7778H4.23224Z"
              fill="#137FEC"
            />
          </svg>
          <span class="text-primary-dark text-sm font-medium leading-[21px]"
            >Profile</span
          >
        </a>
      </nav>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-y-auto">
      <!-- Main -->
      <main class="p-8 flex-1">
        <div class="max-w-4xl flex flex-col">
          <!-- Header -->
          <div class="flex items-start pb-4">
            <h2
              class="text-[#111418] text-4xl font-black leading-10 tracking-[-1.188px]"
            >
              My Profile
            </h2>
          </div>

          <!-- Content -->
          <div class="p-8">
            <div class="bg-white rounded-xl shadow-sm p-8 flex flex-col gap-8">
              <!-- Personal Information -->
              <div class="flex flex-col gap-4">
                <h3 class="text-[#111418] text-lg font-semibold leading-7">
                  Personal Information
                </h3>

                <div class="flex gap-6">
                  <!-- Full Name -->
                  <div class="flex-1 flex flex-col">
                    <label
                      class="text-[#111418] text-base font-medium leading-6 pb-2"
                      >Full Name</label
                    >
                    <div class="flex items-stretch rounded-lg">
                      <input
                        v-model="name"
                        type="text"
                        class="flex-1 h-14 px-4 rounded-l-lg bg-bg-gray text-[#111418] text-base focus:outline-none focus:ring-2 focus:ring-primary-dark"
                      />
                      <div
                        class="flex items-center justify-center pr-4 rounded-r-lg bg-bg-gray"
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
                            d="M12.01 14.0001C10.9405 14.0001 10.025 13.6193 9.26346 12.8577C8.50188 12.0961 8.1211 11.1806 8.1211 10.1112C8.1211 9.04172 8.50188 8.12621 9.26346 7.36464C10.025 6.60306 10.9405 6.22228 12.01 6.22228C13.0794 6.22228 13.9949 6.60306 14.7565 7.36464C15.5181 8.12621 15.8989 9.04172 15.8989 10.1112C15.8989 11.1806 15.5181 12.0961 14.7565 12.8577C13.9949 13.6193 13.0794 14.0001 12.01 14.0001ZM4.23221 21.7778V19.0556C4.23221 18.5047 4.37399 17.9983 4.65756 17.5365C4.94112 17.0747 5.31786 16.7223 5.78776 16.4792C6.79239 15.9769 7.81323 15.6002 8.85026 15.349C9.8873 15.0979 10.9405 14.9723 12.01 14.9723C13.0794 14.9723 14.1327 15.0979 15.1697 15.349C16.2067 15.6002 17.2276 15.9769 18.2322 16.4792C18.7021 16.7223 19.0789 17.0747 19.3624 17.5365C19.646 17.9983 19.7878 18.5047 19.7878 19.0556V21.7778H4.23221Z"
                            fill="#617589"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <!-- Phone Number -->
                  <div class="flex-1 flex flex-col">
                    <label
                      class="text-[#111418] text-base font-medium leading-6 pb-2"
                      >Phone Number</label
                    >
                    <div class="flex items-stretch rounded-lg">
                      <input
                        v-model="phone"
                        type="tel"
                        class="flex-1 h-14 px-4 rounded-l-lg bg-bg-gray text-[#111418] text-base focus:outline-none focus:ring-2 focus:ring-primary-dark"
                      />
                      <div
                        class="flex items-center justify-center pr-4 rounded-r-lg bg-bg-gray"
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
                            d="M19.7392 22.75C17.7137 22.75 15.7125 22.3084 13.7357 21.4253C11.7588 20.5422 9.96023 19.2905 8.33986 17.6701C6.71949 16.0498 5.46776 14.2512 4.58465 12.2743C3.70155 10.2975 3.26 8.2963 3.26 6.27083C3.26 5.97917 3.35722 5.73611 3.55167 5.54167C3.74611 5.34722 3.98917 5.25 4.28084 5.25H8.21834C8.44519 5.25 8.64773 5.32697 8.82597 5.4809C9.00422 5.63484 9.10954 5.81713 9.14195 6.02778L9.77389 9.43056C9.8063 9.68981 9.7982 9.90856 9.74959 10.0868C9.70097 10.265 9.61185 10.419 9.48222 10.5486L7.12459 12.9306C7.44866 13.5301 7.8335 14.1094 8.2791 14.6684C8.7247 15.2274 9.21486 15.7662 9.74959 16.2847C10.2519 16.787 10.7785 17.2529 11.3294 17.6823C11.8804 18.1117 12.4637 18.5046 13.0794 18.8611L15.3642 16.5764C15.51 16.4306 15.7004 16.3212 15.9353 16.2483C16.1703 16.1753 16.4012 16.1551 16.6281 16.1875L19.9822 16.8681C20.2091 16.9329 20.3954 17.0503 20.5413 17.2205C20.6871 17.3906 20.76 17.581 20.76 17.7917V21.7292C20.76 22.0208 20.6628 22.2639 20.4683 22.4583C20.2739 22.6528 20.0308 22.75 19.7392 22.75Z"
                            fill="#617589"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Success/Error Message -->
                <p
                  v-if="infoMsg"
                  :class="
                    infoMsgType === 'success'
                      ? 'text-green-600'
                      : 'text-red-600'
                  "
                  class="text-sm"
                >
                  {{ infoMsg }}
                </p>

                <!-- Buttons -->
                <div class="flex justify-end gap-3 pt-2">
                  <button
                    class="h-10 px-4 bg-[#F0F2F4] text-[#111418] text-sm font-bold leading-[21px] tracking-[0.21px] rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    @click="updateInfo"
                    class="h-10 px-4 bg-primary-dark text-white text-sm font-bold leading-[21px] tracking-[0.21px] rounded-lg hover:bg-opacity-90"
                  >
                    Save Changes
                  </button>
                </div>
              </div>

              <!-- Change Password -->
              <div
                class="flex flex-col gap-4 pt-6 border-t border-border-light"
              >
                <h3 class="text-[#111418] text-lg font-semibold leading-7">
                  Change Password
                </h3>

                <div class="flex flex-col gap-6">
                  <!-- Current Password -->
                  <div class="flex flex-col">
                    <label
                      class="text-[#111418] text-base font-medium leading-6 pb-2"
                      >Current Password</label
                    >
                    <div class="flex items-stretch rounded-lg">
                      <input
                        v-model="currentPassword"
                        :type="showCurrent ? 'text' : 'password'"
                        placeholder="Enter your current password"
                        class="flex-1 h-14 px-4 rounded-l-lg bg-bg-gray text-[#111418] text-base placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-dark"
                      />
                      <button
                        type="button"
                        @click="togglePasswordVisibility('current')"
                        :aria-label="
                          showCurrent ? 'Hide password' : 'Show password'
                        "
                        class="flex items-center justify-center px-4 rounded-r-lg bg-bg-gray hover:bg-gray-200"
                      >
                        <svg
                          v-if="!showCurrent"
                          class="w-6 h-7"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"
                            stroke="#617589"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="3"
                            stroke="#617589"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                        <svg
                          v-else
                          class="w-6 h-7"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a20.3 20.3 0 0 1-3.22 3.88M1 1l22 22"
                            stroke="#617589"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- New Password -->
                  <div class="flex flex-col">
                    <label
                      class="text-[#111418] text-base font-medium leading-6 pb-2"
                      >New Password</label
                    >
                    <div class="flex items-stretch rounded-lg">
                      <input
                        v-model="newPassword"
                        :type="showNew ? 'text' : 'password'"
                        placeholder="Enter a new password"
                        class="flex-1 h-14 px-4 rounded-l-lg bg-bg-gray text-[#111418] text-base placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-dark"
                      />
                      <button
                        type="button"
                        @click="togglePasswordVisibility('new')"
                        :aria-label="
                          showNew ? 'Hide password' : 'Show password'
                        "
                        class="flex items-center justify-center px-4 rounded-r-lg bg-bg-gray hover:bg-gray-200"
                      >
                        <svg
                          v-if="!showNew"
                          class="w-6 h-7"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"
                            stroke="#617589"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="3"
                            stroke="#617589"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                        <svg
                          v-else
                          class="w-6 h-7"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a20.3 20.3 0 0 1-3.22 3.88M1 1l22 22"
                            stroke="#617589"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- Confirm New Password -->
                  <div class="flex flex-col">
                    <label
                      class="text-[#111418] text-base font-medium leading-6 pb-2"
                      >Confirm New Password</label
                    >
                    <div class="flex items-stretch rounded-lg">
                      <input
                        v-model="confirmPassword"
                        :type="showConfirm ? 'text' : 'password'"
                        placeholder="Confirm your new password"
                        class="flex-1 h-14 px-4 rounded-l-lg bg-bg-gray text-[#111418] text-base placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-dark"
                      />
                      <button
                        type="button"
                        @click="togglePasswordVisibility('confirm')"
                        :aria-label="
                          showConfirm ? 'Hide password' : 'Show password'
                        "
                        class="flex items-center justify-center px-4 rounded-r-lg bg-bg-gray hover:bg-gray-200"
                      >
                        <svg
                          v-if="!showConfirm"
                          class="w-6 h-7"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"
                            stroke="#617589"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="3"
                            stroke="#617589"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                        <svg
                          v-else
                          class="w-6 h-7"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a20.3 20.3 0 0 1-3.22 3.88M1 1l22 22"
                            stroke="#617589"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Success/Error Message -->
                <p
                  v-if="pwdMsg"
                  :class="
                    pwdMsgType === 'success' ? 'text-green-600' : 'text-red-600'
                  "
                  class="text-sm"
                >
                  {{ pwdMsg }}
                </p>

                <!-- Button -->
                <div class="flex justify-end pt-2">
                  <button
                    @click="changePassword"
                    class="h-10 px-4 bg-primary-dark text-white text-sm font-bold leading-[21px] tracking-[0.21px] rounded-lg hover:bg-opacity-90"
                  >
                    Change Password
                  </button>
                </div>
              </div>

              <!-- Account Actions -->
              <div
                class="flex flex-col gap-4 pt-6 border-t border-border-light"
              >
                <h3 class="text-danger text-lg font-semibold leading-7">
                  Account Actions
                </h3>
                <button
                  @click="logout"
                  class="h-10 px-4 flex items-center justify-center gap-2 bg-[#DC26261A] text-danger text-sm font-bold leading-[21px] tracking-[0.21px] rounded-lg hover:bg-red-200 self-start"
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
                      d="M5.20445 22.75C4.66973 22.75 4.21198 22.5596 3.83119 22.1788C3.4504 21.798 3.26001 21.3403 3.26001 20.8056V7.19444C3.26001 6.65972 3.4504 6.20197 3.83119 5.82118C4.21198 5.44039 4.66973 5.25 5.20445 5.25H12.01V7.19444H5.20445V20.8056H12.01V22.75H5.20445ZM15.8989 18.8611L14.5621 17.4514L17.0413 14.9722H9.09334V13.0278H17.0413L14.5621 10.5486L15.8989 9.13889L20.76 14L15.8989 18.8611Z"
                      fill="#DC2626"
                    />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

  </div>
</template>

<style scoped></style>
