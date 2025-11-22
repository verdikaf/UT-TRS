<script setup>
import { ref } from "vue";
import axios from "axios";
import { encryptPassword } from "../utils/encryption.js";
import { useRouter } from "vue-router";

const router = useRouter();
const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

const phoneNumber = ref("");
const password = ref("");
const showPassword = ref(false);
const error = ref("");
const loading = ref(false);

// Forgot password modal state
const showForgot = ref(false);
const forgotPhone = ref("");
const forgotLoading = ref(false);
const forgotError = ref("");
const forgotSuccess = ref("");

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
};

const handleLogin = async () => {
  error.value = "";
  if (!phoneNumber.value || !password.value) {
    error.value = "Phone number and password are required";
    return;
  }
  try {
    loading.value = true;
    const cleaned = phoneNumber.value.trim().replace(/[\s-]/g, "");
    let passwordEncrypted;
    try {
      passwordEncrypted = await encryptPassword(password.value);
    } catch (encErr) {
      // More specific message for missing / bad key
      if (encErr?.message?.includes('Missing RSA public key')) {
        error.value = 'Encryption key missing. Set VITE_RSA_PUBLIC_KEY in client .env and restart dev server.';
      } else {
        error.value = encErr.message || 'Password encryption failed';
      }
      return;
    }
    const { data } = await axios.post(`${API}/api/auth/login`, {
      phone: cleaned,
      passwordEncrypted,
    });
    localStorage.setItem("token", data.token);
    router.push("/tasks");
  } catch (e) {
    // If server complains about encrypted password, surface message
    error.value = e?.response?.data?.error || "Failed to login";
  } finally {
    loading.value = false;
  }
};

const handleSignUp = () => {
  router.push("/register");
};

const handleForgotPassword = () => {
  showForgot.value = true;
  forgotPhone.value = "";
  forgotError.value = "";
  forgotSuccess.value = "";
};

const closeForgot = () => {
  if (forgotLoading.value) return;
  showForgot.value = false;
};

const submitForgot = async () => {
  forgotError.value = "";
  forgotSuccess.value = "";
  const phone = forgotPhone.value.trim().replace(/[\s-]/g, "");
  if (!phone) {
    forgotError.value = "Phone number is required";
    return;
  }
  try {
    forgotLoading.value = true;
    const { data } = await axios.post(`${API}/api/auth/forgot-password`, {
      phone,
    });
    forgotSuccess.value = data?.message || "Success. Check your WhatsApp.";
  } catch (e) {
    forgotError.value = e?.response?.data?.error || "Failed to process request";
  } finally {
    forgotLoading.value = false;
  }
};
</script>

<template>
  <div
    class="min-h-screen flex flex-col justify-center items-center bg-bg-light px-4 py-5"
  >
    <div class="w-full max-w-md flex flex-col">
      <!-- Header Section -->
      <div class="flex flex-col items-center gap-2.5 px-4 pt-2.5 pb-4">
        <!-- Icon -->
        <div class="flex items-center justify-center">
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
        </div>

        <!-- Title and Subtitle -->
        <div class="flex flex-col items-center gap-1">
          <h1
            class="text-text-dark text-center font-black text-[36px] leading-[45px] tracking-[-1.188px]"
          >
            Welcome Back
          </h1>
          <p class="text-text-gray text-center text-base leading-6">
            Log in to your account
          </p>
        </div>
      </div>

      <!-- Form Section -->
      <div class="flex flex-col gap-4 px-4">
        <!-- Phone Number Field -->
        <div class="flex flex-col">
          <label class="text-text-dark text-base font-medium leading-6 pb-2">
            Phone Number
          </label>
          <input
            v-model="phoneNumber"
            type="tel"
            placeholder="Example: 6281234567890"
            class="w-full h-[56px] px-4 py-4 rounded-lg border border-border-gray bg-white text-base text-text-dark placeholder:text-text-gray focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            @blur="phoneNumber = phoneNumber.replace(/[\s-]/g, '')"
          />
        </div>

        <!-- Password Field -->
        <div class="flex flex-col">
          <div class="flex justify-between items-center pb-2">
            <label class="text-text-dark text-base font-medium leading-6"
              >Password</label
            >
            <button
              @click="handleForgotPassword"
              class="text-primary text-sm font-medium leading-5 hover:underline focus:outline-none"
            >
              Forgot Password?
            </button>
          </div>
          <div class="flex items-stretch rounded-lg">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter your password"
              class="flex-1 h-[56px] px-4 py-4 rounded-l-lg border border-border-gray border-r-0 bg-white text-base text-text-dark placeholder:text-text-gray focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              @click="togglePasswordVisibility"
              class="flex items-center justify-center px-4 rounded-r-lg border border-border-gray bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              aria-label="Toggle password visibility"
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
                  d="M15.9961 15.2639L14.5864 13.8542C14.7322 13.0926 14.5135 12.3796 13.9301 11.7153C13.3468 11.0509 12.5933 10.7917 11.6697 10.9375L10.26 9.52776C10.5355 9.39813 10.815 9.30091 11.0985 9.2361C11.3821 9.17128 11.6859 9.13888 12.01 9.13888C13.2253 9.13888 14.2583 9.56422 15.109 10.4149C15.9596 11.2656 16.385 12.2986 16.385 13.5139C16.385 13.8379 16.3526 14.1418 16.2878 14.4253C16.223 14.7089 16.1257 14.9884 15.9961 15.2639ZM19.1072 18.3264L17.6975 16.9653C18.3132 16.4954 18.8601 15.9809 19.3381 15.4219C19.8161 14.8628 20.2253 14.2268 20.5656 13.5139C19.7554 11.8773 18.5928 10.577 17.0777 9.61283C15.5627 8.64871 13.8734 8.16665 12.01 8.16665C11.5401 8.16665 11.0783 8.19906 10.6246 8.26388C10.1709 8.32869 9.72527 8.42591 9.28777 8.55554L7.78083 7.0486C8.44518 6.77313 9.12574 6.56654 9.8225 6.42881C10.5193 6.29107 11.2484 6.22221 12.01 6.22221C14.4568 6.22221 16.6362 6.89871 18.5482 8.25172C20.4602 9.60473 21.8456 11.3588 22.7044 13.5139C22.3318 14.4699 21.8416 15.357 21.234 16.1753C20.6263 16.9936 19.9174 17.7106 19.1072 18.3264ZM19.5933 24.3055L15.51 20.2708C14.9429 20.4491 14.3717 20.5827 13.7965 20.6719C13.2212 20.761 12.6257 20.8055 12.01 20.8055C9.56324 20.8055 7.38384 20.129 5.4718 18.776C3.55976 17.423 2.17435 15.669 1.31555 13.5139C1.65583 12.6551 2.08523 11.857 2.60375 11.1198C3.12226 10.3825 3.7137 9.72221 4.37805 9.13888L1.70444 6.41665L3.06555 5.05554L20.9544 22.9444L19.5933 24.3055ZM5.73916 10.5C5.26926 10.9213 4.83986 11.3831 4.45097 11.8854C4.06208 12.3877 3.7299 12.9305 3.45444 13.5139C4.26463 15.1504 5.42724 16.4508 6.94229 17.4149C8.45733 18.379 10.1466 18.8611 12.01 18.8611C12.3341 18.8611 12.65 18.8408 12.9579 18.8003C13.2658 18.7598 13.5818 18.7153 13.9058 18.6667L13.0308 17.743C12.8526 17.7917 12.6825 17.8281 12.5204 17.8524C12.3584 17.8767 12.1882 17.8889 12.01 17.8889C10.7947 17.8889 9.76173 17.4635 8.91104 16.6128C8.06034 15.7621 7.635 14.7292 7.635 13.5139C7.635 13.3356 7.64715 13.1655 7.67145 13.0035C7.69576 12.8414 7.73222 12.6713 7.78083 12.493L5.73916 10.5Z"
                  fill="#6B7280"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Error Message -->
        <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

        <!-- Login Button -->
        <button
          @click="handleLogin"
          :disabled="loading"
          class="w-full h-12 flex items-center justify-center bg-primary text-white text-base font-bold leading-6 tracking-[0.24px] rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all disabled:opacity-60"
        >
          {{ loading ? "Logging in..." : "Login" }}
        </button>
      </div>

      <!-- Sign Up Link -->
      <div class="flex justify-center items-center gap-0.5 px-4 py-4">
        <span class="text-text-gray text-sm leading-5"
          >Don't have an account?
        </span>
        <button
          @click="handleSignUp"
          class="text-primary text-sm font-medium leading-5 hover:underline focus:outline-none"
        >
          Sign Up
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div class="w-full px-4 py-4 mt-auto">
      <p class="text-text-gray text-center text-xs leading-4">
        © 2025 Reminder App. All Rights Reserved.
      </p>
    </div>
  </div>

  <!-- Forgot Password Modal -->
  <div
    v-if="showForgot"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
  >
    <div
      class="w-full max-w-md bg-white rounded-xl shadow-lg p-6 flex flex-col gap-4"
    >
      <h3 class="text-xl font-bold text-text-dark">Forgot Password</h3>
      <template v-if="!forgotSuccess">
        <p class="text-sm text-text-gray">Enter your registered phone number. We will send a temporary password to your WhatsApp.</p>
        <input
          v-model="forgotPhone"
          type="tel"
          placeholder="Example: 6281234567890"
          class="h-12 px-4 rounded-lg border border-border-gray bg-white text-base text-text-dark placeholder:text-text-gray focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          @blur="forgotPhone = forgotPhone.replace(/[\s-]/g, '')"
        />
      </template>
      <div class="min-h-[24px] flex items-start">
        <p v-if="forgotError" class="text-red-600 text-sm">{{ forgotError }}</p>
        <p v-else-if="forgotSuccess" class="text-green-600 text-sm whitespace-pre-line">{{ forgotSuccess }}</p>
      </div>
      <div class="flex justify-end gap-3 pt-2" v-if="!forgotSuccess">
        <button @click="closeForgot" :disabled="forgotLoading" class="h-10 px-4 bg-gray-200 text-text-dark text-sm font-medium rounded-lg hover:bg-gray-300 disabled:opacity-60">Cancel</button>
        <button @click="submitForgot" :disabled="forgotLoading" class="h-10 px-4 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-opacity-90 disabled:opacity-60">{{ forgotLoading ? 'Processing...' : 'Send New Password' }}</button>
      </div>
      <div class="flex justify-end pt-2" v-else>
        <button @click="closeForgot" class="h-10 px-6 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-opacity-90">Close</button>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
