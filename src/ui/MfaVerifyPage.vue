<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Xác thực hai bước</v-toolbar-title>
          </v-toolbar>

          <v-card-text>
            <p class="mb-4">
              Mở ứng dụng xác thực trên điện thoại và nhập mã 6 số đang hiển thị.
            </p>

            <v-alert
              v-if="serverError"
              type="warning"
              variant="tonal"
              closable
              class="mb-4"
              @click:close="serverError = ''"
            >
              {{ serverError }}
            </v-alert>

            <v-form @submit.prevent="handleSubmit">
              <v-text-field
                v-model="code"
                :label="useBackupCode ? 'Mã dự phòng' : 'Mã 6 số'"
                prepend-icon="mdi-shield-key-outline"
                :maxlength="useBackupCode ? 10 : 6"
                :inputmode="useBackupCode ? 'text' : 'numeric'"
                :error-messages="codeError ? [codeError] : []"
                :disabled="isLoading"
                autocomplete="one-time-code"
                autofocus
                class="code-field"
                @input="codeError = ''"
              />
            </v-form>

            <v-btn
              variant="text"
              size="small"
              class="mt-2"
              :disabled="isLoading"
              @click="toggleMode"
            >
              {{ useBackupCode ? 'Dùng mã từ ứng dụng' : 'Mất điện thoại? Dùng mã dự phòng' }}
            </v-btn>
          </v-card-text>

          <v-card-actions>
            <v-btn variant="text" :disabled="isLoading" @click="backToLogin">
              Đăng nhập lại
            </v-btn>
            <v-spacer />
            <v-btn
              color="primary"
              variant="elevated"
              :loading="isLoading"
              :disabled="isLoading"
              :block="mobile"
              class="submit-btn"
              @click="handleSubmit"
            >
              Xác nhận
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
/**
 * MfaVerifyPage.vue - the login-time second-factor challenge.
 *
 * Reached while holding an MFA_PENDING token, which reaches nothing but this
 * endpoint. A wrong code counts toward the account lockout, so the user is told
 * the code was wrong but not how many attempts remain.
 *
 * Recovery codes are accepted in the same field; the toggle only changes the
 * label and length hint, since the server decides which kind it received.
 */

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useAuthStore } from '../app/authStore';

const router = useRouter();
const authStore = useAuthStore();
const { mobile } = useDisplay();

const code = ref('');
const useBackupCode = ref(false);
const codeError = ref('');
const serverError = ref('');

const isLoading = computed(() => authStore.isLoading);

onMounted(() => {
  // Landing here without a pending challenge means the token is gone, so there
  // is nothing to answer.
  if (!authStore.mfaVerificationRequired) {
    void router.replace('/login');
  }
});

function toggleMode(): void {
  useBackupCode.value = !useBackupCode.value;
  code.value = '';
  codeError.value = '';
}

function validate(): boolean {
  const entered = code.value.trim();

  if (!entered) {
    codeError.value = 'Không được để trống';
    return false;
  }
  if (!useBackupCode.value && !/^\d{6}$/.test(entered)) {
    codeError.value = 'Mã gồm đúng 6 chữ số';
    return false;
  }
  return true;
}

async function handleSubmit(): Promise<void> {
  codeError.value = '';
  serverError.value = '';

  if (!validate()) {
    return;
  }

  const success = await authStore.verifyMfa(code.value.trim());
  code.value = '';

  if (success) {
    await router.push('/');
    return;
  }

  // The second factor is cleared but a password rotation may still be pending.
  const nextStep = authStore.pendingStepPath();
  if (nextStep && nextStep !== '/mfa-verify') {
    await router.push(nextStep);
    return;
  }

  serverError.value = authStore.error ?? 'Mã không đúng';
}

async function backToLogin(): Promise<void> {
  await authStore.logout();
  await router.push('/login');
}
</script>

<style scoped>
/** A one-time code is easier to read spaced out. */
.code-field :deep(input) {
  letter-spacing: 0.3em;
  font-size: 1.25rem;
}

/** Touch target (R3.5). */
.submit-btn {
  min-height: 44px;
  min-width: 44px;
}
</style>
