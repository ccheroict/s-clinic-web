<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="10" md="6">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Thiết lập xác thực hai bước</v-toolbar-title>
          </v-toolbar>

          <!-- Step 2: recovery codes, shown once and only once -->
          <v-card-text v-if="showBackupCodes">
            <v-alert type="warning" variant="tonal" class="mb-4">
              Hãy lưu lại các mã dự phòng dưới đây ngay bây giờ. Mỗi mã dùng được
              một lần và sẽ không thể xem lại.
            </v-alert>

            <div class="backup-grid mb-4">
              <code v-for="backupCode in authStore.backupCodes" :key="backupCode" class="backup-code">
                {{ backupCode }}
              </code>
            </div>

            <v-btn
              variant="outlined"
              size="small"
              prepend-icon="mdi-download"
              class="mb-2"
              @click="downloadBackupCodes"
            >
              Tải về tệp văn bản
            </v-btn>

            <v-checkbox
              v-model="codesSaved"
              label="Tôi đã lưu các mã dự phòng ở nơi an toàn"
              density="compact"
              hide-details
            />
          </v-card-text>

          <!-- Step 1: scan and confirm -->
          <v-card-text v-else>
            <p class="mb-4">
              Quét mã QR bằng ứng dụng xác thực (Google Authenticator, Microsoft
              Authenticator, Authy...), sau đó nhập mã 6 số để hoàn tất.
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

            <div v-if="enrolment" class="text-center mb-4">
              <img
                v-if="qrDataUrl"
                :src="qrDataUrl"
                alt="Mã QR thiết lập xác thực hai bước"
                class="qr-image"
              >
              <p class="text-caption mt-2 mb-1">
                Không quét được? Nhập khoá này vào ứng dụng:
              </p>
              <code class="secret">{{ enrolment.secret }}</code>
            </div>

            <v-progress-linear v-else-if="isLoading" indeterminate class="mb-4" />

            <v-form v-if="enrolment" @submit.prevent="handleConfirm">
              <v-text-field
                v-model="code"
                label="Mã 6 số"
                prepend-icon="mdi-shield-key-outline"
                maxlength="6"
                inputmode="numeric"
                :error-messages="codeError ? [codeError] : []"
                :disabled="isLoading"
                autocomplete="one-time-code"
                class="code-field"
                @input="codeError = ''"
              />
            </v-form>
          </v-card-text>

          <v-card-actions>
            <v-btn variant="text" :disabled="isLoading" @click="backToLogin">
              Đăng nhập lại
            </v-btn>
            <v-spacer />
            <v-btn
              v-if="showBackupCodes"
              color="primary"
              variant="elevated"
              :disabled="!codesSaved"
              :block="mobile"
              class="submit-btn"
              @click="finish"
            >
              Tiếp tục
            </v-btn>
            <v-btn
              v-else
              color="primary"
              variant="elevated"
              :loading="isLoading"
              :disabled="isLoading || !enrolment"
              :block="mobile"
              class="submit-btn"
              @click="handleConfirm"
            >
              Hoàn tất
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
/**
 * MfaEnrollPage.vue - first-time setup of a TOTP second factor.
 *
 * Two steps in one screen:
 * 1. Show the QR code and take a first valid code. The server only marks the
 *    factor as enabled once a code verifies, so a bad scan cannot lock the
 *    account out of itself.
 * 2. Show the recovery codes. The server returns them exactly once and stores
 *    only their hashes, so the user is held here behind an explicit
 *    confirmation before the app moves on.
 */

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import QRCode from 'qrcode';
import { useAuthStore } from '../app/authStore';
import type { MfaEnrolment } from '../domain/types';

const router = useRouter();
const authStore = useAuthStore();
const { mobile } = useDisplay();

const enrolment = ref<MfaEnrolment | null>(null);
const qrDataUrl = ref('');
const code = ref('');
const codeError = ref('');
const serverError = ref('');
const codesSaved = ref(false);

const isLoading = computed(() => authStore.isLoading);
const showBackupCodes = computed(() => authStore.backupCodes.length > 0);

onMounted(async () => {
  if (!authStore.mfaEnrolmentRequired) {
    await router.replace('/login');
    return;
  }

  enrolment.value = await authStore.beginMfaEnrolment();

  if (!enrolment.value) {
    serverError.value = authStore.error ?? 'Không thể bắt đầu thiết lập';
    return;
  }

  try {
    qrDataUrl.value = await QRCode.toDataURL(enrolment.value.provisioningUri, {
      width: 220,
      margin: 1,
    });
  } catch {
    // No canvas available: the secret is shown as text right below, which is
    // enough to finish setup by hand.
    qrDataUrl.value = '';
  }
});

function validate(): boolean {
  const entered = code.value.trim();

  if (!entered) {
    codeError.value = 'Không được để trống';
    return false;
  }
  if (!/^\d{6}$/.test(entered)) {
    codeError.value = 'Mã gồm đúng 6 chữ số';
    return false;
  }
  return true;
}

async function handleConfirm(): Promise<void> {
  codeError.value = '';
  serverError.value = '';

  if (!validate()) {
    return;
  }

  const confirmed = await authStore.confirmMfaEnrolment(code.value.trim());
  code.value = '';

  if (!confirmed) {
    serverError.value = authStore.error ?? 'Mã không đúng';
  }
  // On success the recovery codes are in the store, which flips this screen to
  // step 2; routing waits for the user to confirm they saved them.
}

/** Offers the codes as a file so they are not only on screen. */
function downloadBackupCodes(): void {
  const content = [
    'S-Clinic - Mã dự phòng xác thực hai bước',
    `Tài khoản: ${authStore.username}`,
    '',
    ...authStore.backupCodes,
    '',
    'Mỗi mã chỉ dùng được một lần.',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 's-clinic-ma-du-phong.txt';
  link.click();
  URL.revokeObjectURL(url);
}

/** Leaves step 2 once the codes are saved, and drops them from memory. */
async function finish(): Promise<void> {
  authStore.acknowledgeBackupCodes();

  const nextStep = authStore.pendingStepPath();
  await router.push(nextStep ?? '/');
}

async function backToLogin(): Promise<void> {
  await authStore.logout();
  await router.push('/login');
}
</script>

<style scoped>
.qr-image {
  width: 220px;
  height: 220px;
  image-rendering: pixelated;
}

.secret {
  font-family: monospace;
  letter-spacing: 0.15em;
  word-break: break-all;
}

.backup-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.backup-code {
  font-family: monospace;
  letter-spacing: 0.1em;
  padding: 6px 8px;
  border: 1px solid rgb(var(--v-border-color), 0.4);
  border-radius: 4px;
  text-align: center;
}

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
