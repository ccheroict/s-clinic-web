<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>S-Clinic - Đăng nhập</v-toolbar-title>
          </v-toolbar>

          <v-card-text>
            <!-- Network/connection error alert (R4.5) -->
            <v-alert
              v-if="networkError"
              type="error"
              variant="tonal"
              closable
              class="mb-4"
              @click:close="networkError = ''"
            >
              {{ networkError }}
            </v-alert>

            <!-- Authentication error alert (R4.4) -->
            <v-alert
              v-if="authError"
              type="warning"
              variant="tonal"
              closable
              class="mb-4"
              @click:close="authError = ''"
            >
              {{ authError }}
            </v-alert>

            <v-form ref="formRef" @submit.prevent="handleSubmit">
              <v-text-field
                v-model="username"
                label="Tên đăng nhập"
                prepend-icon="mdi-account"
                :error-messages="usernameError ? [usernameError] : []"
                :disabled="isLoading"
                autocomplete="username"
                @input="clearFieldError('username')"
              />

              <v-text-field
                v-model="password"
                label="Mật khẩu"
                prepend-icon="mdi-lock"
                :type="showPassword ? 'text' : 'password'"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                :error-messages="passwordError ? [passwordError] : []"
                :disabled="isLoading"
                autocomplete="current-password"
                @click:append-inner="showPassword = !showPassword"
                @input="clearFieldError('password')"
              />
            </v-form>
          </v-card-text>

          <v-card-actions>
            <v-spacer />
            <v-btn
              color="primary"
              variant="elevated"
              :loading="isLoading"
              :disabled="isLoading"
              :block="mobile"
              class="login-btn"
              @click="handleSubmit"
            >
              Đăng nhập
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
/**
 * LoginPage.vue - Login page using Vuetify + vee-validate + Zod
 *
 * Responsibilities:
 * - v-form + v-text-field for username/password
 * - Validate via validateLoginForm (Zod schema) - R4.1
 * - Call useAuthStore.login() on submit - R4.3
 * - Display authentication errors (R4.4) and connection errors (R4.5)
 *
 * Validates: Requirements 4.1, 4.3, 4.4, 4.5
 */

import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useAuthStore } from '../app/authStore';
import { validateLoginForm } from '../domain/validators';

const router = useRouter();
const authStore = useAuthStore();
const { mobile } = useDisplay();

// Form state
const username = ref('');
const password = ref('');
const showPassword = ref(false);

// Validation error state
const usernameError = ref('');
const passwordError = ref('');

// Server error state
const networkError = ref('');
const authError = ref('');

// Loading state
const isLoading = ref(false);

// Form ref
const formRef = ref<InstanceType<typeof import('vuetify/components').VForm> | null>(null);

/**
 * Clear field-specific validation error when user starts typing
 */
function clearFieldError(field: 'username' | 'password'): void {
  if (field === 'username') {
    usernameError.value = '';
  } else {
    passwordError.value = '';
  }
  // Also clear server errors when user modifies input
  authError.value = '';
}

/**
 * Handle form submission
 * 1. Validate with Zod schema (R4.1)
 * 2. Call authStore.login() (R4.3)
 * 3. Handle errors (R4.4, R4.5)
 */
async function handleSubmit(): Promise<void> {
  // Clear previous errors
  usernameError.value = '';
  passwordError.value = '';
  networkError.value = '';
  authError.value = '';

  // R4.1: Validate with Zod schema - reject empty/whitespace
  const validation = validateLoginForm(username.value, password.value);

  if (!validation.ok) {
    // Display field-specific validation errors
    if (validation.errors.username) {
      usernameError.value = validation.errors.username;
    }
    if (validation.errors.password) {
      passwordError.value = validation.errors.password;
    }
    // Do NOT call API (R4.1)
    return;
  }

  // Set loading state
  isLoading.value = true;

  try {
    // Set credentials in auth store
    authStore.setCredentials(username.value, password.value);

    // R4.3: Call login - GET /api/me with Basic auth
    const success = await authStore.login();

    if (success) {
      // R4.3: Navigate to main screen on success
      await router.push('/');
    } else {
      // Handle error from authStore
      const storeError = authStore.error;

      if (storeError) {
        if (storeError.includes('Connection') || storeError.includes('network') || storeError.includes('connection')) {
          // R4.5: Network/timeout error - keep all input
          networkError.value = storeError;
        } else if (storeError.includes('Invalid username') || storeError.includes('password')) {
          // R4.4: Authentication error - keep username, clear password
          authError.value = storeError;
          password.value = '';
        } else {
          // Other errors (role invalid, etc.)
          authError.value = storeError;
        }
      }
    }
  } finally {
    isLoading.value = false;
  }
}
</script>


<style scoped>
/**
 * Login button touch target (R3.5).
 */
.login-btn {
  min-height: 44px;
  min-width: 44px;
}
</style>
