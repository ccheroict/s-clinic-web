<script setup lang="ts">
/**
 * Replacing the recovery codes for the signed-in account.
 *
 * The codes are shown exactly once, at the end of enrolment, and the server
 * stores only their hashes. Reloading that screen therefore lost them for good,
 * and the only way back was an administrator clearing the whole second factor —
 * heavier than the problem called for, and it leaves the account with no second
 * factor at all for a while. This is the lighter path.
 *
 * A current authentication code is required. The codes outlive the session that
 * made them and each one bypasses the second factor, so a session alone must not
 * be able to mint them: otherwise a stolen session becomes permanent bypass.
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';

import { useAuthStore } from '../app/authStore';

const router = useRouter();
const authStore = useAuthStore();
const { mobile } = useDisplay();

const code = ref('');
const codeError = ref('');
const serverError = ref('');
const codesSaved = ref(false);

const isLoading = computed(() => authStore.isLoading);
const showCodes = computed(() => authStore.backupCodes.length > 0);

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

async function handleSubmit(): Promise<void> {
  codeError.value = '';
  serverError.value = '';

  if (!validate()) {
    return;
  }

  const issued = await authStore.regenerateBackupCodes(code.value.trim());
  code.value = '';

  if (!issued) {
    serverError.value = authStore.error ?? 'Không cấp lại được mã dự phòng.';
  }
}

/** Offers the codes as a file so they are not only on screen. */
function downloadCodes(): void {
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

function finish(): void {
  authStore.acknowledgeBackupCodes();
  router.push('/');
}

function cancel(): void {
  router.push('/');
}
</script>

<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="10" md="6">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title class="text-wrap">Mã dự phòng</v-toolbar-title>
          </v-toolbar>

          <!-- After reissue: the new codes, shown once like at enrolment. -->
          <v-card-text v-if="showCodes">
            <v-alert type="warning" variant="tonal" class="mb-4">
              Hãy lưu lại các mã dưới đây ngay bây giờ. Mỗi mã dùng được một lần
              và sẽ không thể xem lại.
            </v-alert>

            <v-alert type="info" variant="tonal" density="compact" class="mb-4">
              Các mã dự phòng cũ đã hết hiệu lực.
            </v-alert>

            <div class="backup-grid mb-4">
              <code
                v-for="backupCode in authStore.backupCodes"
                :key="backupCode"
                class="backup-code"
              >
                {{ backupCode }}
              </code>
            </div>

            <v-btn
              variant="outlined"
              size="small"
              prepend-icon="mdi-download"
              class="mb-2"
              data-testid="recovery-download"
              @click="downloadCodes"
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

          <!-- Before reissue: take a current code. -->
          <v-card-text v-else>
            <p class="mb-4">
              Cấp lại mã dự phòng sẽ <strong>vô hiệu hoá toàn bộ mã cũ</strong>.
              Hãy dùng việc này khi bạn đã mất danh sách mã dự phòng.
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

            <!--
              The code is asked for here rather than relying on the session,
              because the codes it produces outlast the session and each one is a
              way past the second factor.
            -->
            <v-form @submit.prevent="handleSubmit">
              <v-text-field
                v-model="code"
                label="Mã 6 số từ ứng dụng xác thực"
                prepend-icon="mdi-shield-key-outline"
                maxlength="6"
                inputmode="numeric"
                autocomplete="one-time-code"
                :error-messages="codeError ? [codeError] : []"
                :disabled="isLoading"
                class="code-field"
                data-testid="recovery-code-input"
                @input="codeError = ''"
              />
            </v-form>
          </v-card-text>

          <v-card-actions>
            <v-btn v-if="!showCodes" variant="text" :disabled="isLoading" @click="cancel">
              Huỷ
            </v-btn>
            <v-spacer />
            <v-btn
              v-if="showCodes"
              color="primary"
              variant="elevated"
              :disabled="!codesSaved"
              :block="mobile"
              class="submit-btn"
              data-testid="recovery-finish"
              @click="finish"
            >
              Xong
            </v-btn>
            <v-btn
              v-else
              color="primary"
              variant="elevated"
              :loading="isLoading"
              :disabled="isLoading"
              :block="mobile"
              class="submit-btn"
              data-testid="recovery-submit"
              @click="handleSubmit"
            >
              Cấp lại mã dự phòng
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
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
