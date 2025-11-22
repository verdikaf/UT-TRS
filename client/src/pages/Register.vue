<script setup>
import { ref } from "vue";
import axios from "axios";
import { encryptPassword } from "../utils/encryption.js";
import { useRouter } from "vue-router";

const router = useRouter();
const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

const name = ref("");
const phone = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

function validateInputs() {
  const errs = [];
  const normalized = String(phone.value || "").trim().replace(/[\s-]/g, "");
  if (!name.value) errs.push("Name is required");
  if (!normalized) errs.push("Phone is required");
  if (!password.value) errs.push("Password is required");

  const digits = normalized.replace(/^\+/, "");
  if (normalized && !/^\d+$/.test(digits)) errs.push("Phone must contain only digits");
  if (digits && digits.length < 10) errs.push("Phone number is too short");
  if (password.value && password.value.length < 8) errs.push("Password must be at least 8 characters");

  return { valid: errs.length === 0, errors: errs, normalizedPhone: normalized };
}

const handleRegister = async () => {
  error.value = "";
  const { valid, errors, normalizedPhone } = validateInputs();
  if (!valid) {
    error.value = errors.join("; ");
    return;
  }

  try {
    loading.value = true;
    // Check availability first (no WA message)
    const availResp = await axios.get(`${API}/api/auth/phone-available`, {
      params: { phone: normalizedPhone },
    });
    if (!availResp.data || availResp.data.available === false) {
      error.value = "Phone number already registered";
      return;
    }

    // Phone available — perform validation (sends WA)
    await axios.post(`${API}/api/phone/validate`, {
      phone: normalizedPhone,
      name: name.value,
    });

    let passwordEncrypted;
    try {
      passwordEncrypted = await encryptPassword(password.value);
    } catch (encErr) {
      if (encErr?.message?.includes('Missing RSA public key')) {
        error.value = 'Encryption key missing. Set VITE_RSA_PUBLIC_KEY in client .env and restart dev server.';
      } else {
        error.value = encErr.message || 'Password encryption failed';
      }
      return;
    }
    const { data } = await axios.post(`${API}/api/auth/register`, {
      name: name.value,
      phone: normalizedPhone,
      passwordEncrypted,
    });
    localStorage.setItem("token", data.token);
    router.push("/tasks");
  } catch (e) {
    error.value = e?.response?.data?.error || "Failed to register";
  } finally {
    loading.value = false;
  }
};

const handleLogin = () => {
  router.push("/login");
};
</script>

<template>
  <div
    class="min-h-screen flex flex-col justify-center items-center bg-bg-light px-4 py-5"
  >
    <div class="w-full max-w-md flex flex-col">
      <div class="flex flex-col items-center gap-2.5 px-4 pt-2.5 pb-4">
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
        <div class="flex flex-col items-center gap-1">
          <h1
            class="text-text-dark text-center font-black text-[36px] leading-[45px] tracking-[-1.188px]"
          >
            Create Your Account
          </h1>
          <p class="text-text-gray text-center text-base leading-6">
            Manage your tasks with ease
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-4 px-4">
        <div class="flex flex-col">
          <label class="text-text-dark text-base font-medium leading-6 pb-2"
            >Full Name</label
          >
          <input
            v-model="name"
            type="text"
            placeholder="Enter your full name"
            class="w-full h-[56px] px-4 py-4 rounded-lg border border-border-gray bg-white text-base text-text-dark placeholder:text-text-gray focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div class="flex flex-col">
          <label class="text-text-dark text-base font-medium leading-6 pb-2"
            >Phone Number</label
          >
          <input
            v-model="phone"
            type="tel"
            placeholder="Example: 6281234567890"
            class="w-full h-[56px] px-4 py-4 rounded-lg border border-border-gray bg-white text-base text-text-dark placeholder:text-text-gray focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            @blur="phone = phone.replace(/[\s-]/g, '')"
          />
        </div>
        <div class="flex flex-col">
          <label class="text-text-dark text-base font-medium leading-6 pb-2"
            >Password</label
          >
          <input
            v-model="password"
            type="password"
            placeholder="Enter your password"
            class="w-full h-[56px] px-4 py-4 rounded-lg border border-border-gray bg-white text-base text-text-dark placeholder:text-text-gray focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
        <button
          @click="handleRegister"
          :disabled="loading"
          class="w-full h-12 flex items-center justify-center bg-primary text-white text-base font-bold leading-6 tracking-[0.24px] rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all disabled:opacity-60"
        >
          {{ loading ? "Creating Account..." : "Create Account" }}
        </button>
      </div>

      <div class="flex justify-center items-center gap-0.5 px-4 py-4">
        <span class="text-text-gray text-sm leading-5"
          >Already have an account?
        </span>
        <button
          @click="handleLogin"
          class="text-primary text-sm font-medium leading-5 hover:underline focus:outline-none"
        >
          Log in
        </button>
      </div>
    </div>
    <div class="w-full px-4 py-4 mt-auto">
      <p class="text-text-gray text-center text-xs leading-4">
        © 2025 Reminder App. All Rights Reserved.
      </p>
    </div>
  </div>
</template>

<style scoped></style>
