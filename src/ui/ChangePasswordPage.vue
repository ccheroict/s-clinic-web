<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Đổi mật khẩu</v-toolbar-title>
          </v-toolbar>

          <v-card-text>
            <v-alert
              v-if="forced"
              type="info"
              variant="tonal"
              class="mb-4"
            >
              Bạn phải đổi mật khẩu trước khi truy cập dữ liệu bệnh nhân.
            </v-alert>

            <v-alert
              v-if="serverError"
              type="error"
              variant="tonal"
              closable
              class="mb-4"
              @click:close="serverError = ''"
            >
              {{ serverError }}
            </v-alert>

            <v-form @submit.prevent="handleSubmit">
              <v-text-field
                v-model="currentPassword"
                label="Mật khẩu hiện tại"
                prepend-icon="mdi-lock-outline"
                type="password"
                :error-messages="currentPasswordError ? [currentPasswordError] : []"
                :disabled="isLoading"
                autocomplete="current-password"
                @input="currentPasswordError = ''"
              />

              <v-text-field
                v-model="newPassword"
                label="Mật khẩu mới"
                prepend-icon="mdi-lock"
                :type="showNew ? 'text' : 'password'"
                :append-inner-icon="showNew ? 'mdi-eye-off' : 'mdi-eye'"
                :error-messages="newPasswordError ? [newPasswordError] : []"
                :disabled="isLoading"
                autocomplete="new-password"
                hint="Tối thiểu 12 ký tự, kết hợp ít nhất 3 trong 4 nhóm: chữ thường, chữ hoa, số, ký tự đặc biệt"
                persistent-hint
                @click:append-inner="showNew = !showNew"
                @input="newPasswordError = ''"
              />

              <v-text-field
                v-model="confirmPassword"
                label="Nhập lại mật khẩu mới"
                prepend-icon="mdi-lock-check"
                type="password"
                :error-messages="confirmPasswordError ? [confirmPasswordError] : []"
                :disabled="isLoading"
                autocomplete="new-password"
                class="mt-4"
                @input="confirmPasswordError = ''"
              />
            </v-form>
          </v-card-text>

          <v-card-actions>
            <v-btn
              v-if="!forced"
              variant="text"
              :disabled="isLoading"
              @click="router.back()"
            >
              Huỷ
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
              Đổi mật khẩu
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
/**
 * ChangePasswordPage.vue
 *
 * Two entry points:
 * - Forced: the account was flagged to rotate its password, so it holds a
 *   change-password-scope token that cannot reach business endpoints. There is
 *   no cancel button in this case.
 * - Voluntary: an already logged-in user changing their password.
 *
 * On success the server revokes every other session and issues a fresh
 * full-scope token, which the store applies.
 */

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useAuthStore } from '../app/authStore';

const router = useRouter();
const authStore = useAuthStore();
const { mobile } = useDisplay();

onMounted(() => {
  // The route is public so an interim token can reach it, which means it has to
  // check for itself that there is a session to change the password of. Without
  // this, a direct visit renders the form and answers a submit with "current
  // password is incorrect", which is a confusing way to say "you are not logged
  // in". The other two interim screens already do this.
  if (!authStore.token) {
    void router.replace('/login');
  }
});

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showNew = ref(false);

const currentPasswordError = ref('');
const newPasswordError = ref('');
const confirmPasswordError = ref('');
const serverError = ref('');

const isLoading = ref(false);

const forced = computed(() => authStore.passwordChangeRequired);

/**
 * Client-side checks only cover what the user can see. Strength is enforced by
 * the server, which owns the policy and the password history.
 */
function validate(): boolean {
  let valid = true;

  if (!currentPassword.value.trim()) {
    currentPasswordError.value = 'Không được để trống';
    valid = false;
  }
  if (!newPassword.value.trim()) {
    newPasswordError.value = 'Không được để trống';
    valid = false;
  }
  if (newPassword.value && confirmPassword.value !== newPassword.value) {
    confirmPasswordError.value = 'Mật khẩu nhập lại không khớp';
    valid = false;
  }
  if (newPassword.value && newPassword.value === currentPassword.value) {
    newPasswordError.value = 'Mật khẩu mới phải khác mật khẩu hiện tại';
    valid = false;
  }

  return valid;
}

async function handleSubmit(): Promise<void> {
  currentPasswordError.value = '';
  newPasswordError.value = '';
  confirmPasswordError.value = '';
  serverError.value = '';

  if (!validate()) {
    return;
  }

  isLoading.value = true;
  try {
    const success = await authStore.changePassword(currentPassword.value, newPassword.value);

    if (success) {
      await router.push('/');
    } else {
      serverError.value = authStore.error ?? 'Không đổi được mật khẩu';
      // The current password is the likely culprit; clear the new pair only.
      newPassword.value = '';
      confirmPassword.value = '';
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
/** Touch target (R3.5). */
.submit-btn {
  min-height: 44px;
  min-width: 44px;
}
</style>
