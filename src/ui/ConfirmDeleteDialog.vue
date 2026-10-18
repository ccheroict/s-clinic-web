<template>
  <v-dialog
    v-model="dialogVisible"
    max-width="450"
    persistent
  >
    <v-card>
      <v-card-title class="text-h6">
        Ngừng sử dụng hồ sơ bệnh nhân
      </v-card-title>

      <v-card-text>
        <p v-if="patientName">
          Ngừng sử dụng hồ sơ của <strong>{{ patientName }}</strong>?
        </p>
        <p v-else>
          Ngừng sử dụng hồ sơ bệnh nhân này?
        </p>
        <p class="text-caption text-medium-emphasis mt-2">
          Hồ sơ sẽ không còn xuất hiện trong danh sách và tìm kiếm, nhưng
          <strong>không bị xóa khỏi hệ thống</strong> — phòng khám có nghĩa vụ lưu
          trữ hồ sơ bệnh án theo thời hạn luật định.
        </p>

        <v-textarea
          v-model="reason"
          label="Lý do"
          :error-messages="reasonError ? [reasonError] : []"
          :disabled="isPending"
          rows="2"
          auto-grow
          counter="500"
          maxlength="500"
          class="mt-3"
          hint="Bắt buộc. Lý do được lưu cùng hồ sơ để có thể soát lại về sau."
          persistent-hint
          @input="reasonError = ''"
        />

        <!-- Error message if delete fails -->
        <v-alert
          v-if="deleteErrorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ deleteErrorMessage }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="isPending"
          @click="handleCancel"
        >
          Hủy
        </v-btn>
        <v-btn
          color="error"
          variant="elevated"
          :loading="isPending"
          :disabled="isPending"
          @click="handleConfirmDelete"
        >
          Ngừng sử dụng
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * ConfirmDeleteDialog.vue - Confirmation dialog for deleting a patient
 *
 * Responsibilities:
 * - Display a v-dialog for confirming patient deletion
 * - Only accessible when user role is ADMIN (enforced by parent via RoleGate)
 * - Call delete mutation after user confirms
 * - Disable buttons while delete is pending (R6.8)
 * - Display error if delete fails
 *
 * Usage:
 * Parent component wraps the delete trigger with RoleGate (allowedRoles=['ADMIN'])
 * and controls this dialog's visibility via v-model.
 *
 * Validates: Requirements 6.7
 */

import { ref, computed, watch } from 'vue';
import { useDeletePatient } from '../app/patientQueries';
import { useAuthStore } from '../app/authStore';

const props = defineProps<{
  /** Controls dialog visibility (v-model) */
  modelValue: boolean;
  /** ID of the patient to delete */
  patientId: string | null;
  /** Name of the patient (for display) */
  patientName?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'deleted'): void;
}>();

const authStore = useAuthStore();
const { mutateAsync: deletePatient, isPending } = useDeletePatient();

/** Error message from delete attempt */
const deleteErrorMessage = ref('');

/** Why the record is being withdrawn. Mandatory; the server rejects a blank. */
const reason = ref('');
const reasonError = ref('');

/** Computed v-model for dialog visibility */
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

/** Clear error when dialog opens */
watch(dialogVisible, (visible) => {
  if (visible) {
    deleteErrorMessage.value = '';
    reason.value = '';
    reasonError.value = '';
  }
});

/**
 * Handle confirm delete action
 * Only proceeds if current role is ADMIN (double-check)
 */
async function handleConfirmDelete(): Promise<void> {
  // Double-check ADMIN role (defense in depth, R6.7)
  if (authStore.currentRole !== 'ADMIN') {
    deleteErrorMessage.value = 'Bạn không đủ quyền thực hiện thao tác này.';
    return;
  }

  if (!props.patientId) {
    deleteErrorMessage.value = 'Không xác định được bệnh nhân cần xóa.';
    return;
  }

  if (!reason.value.trim()) {
    reasonError.value = 'Vui lòng nhập lý do';
    return;
  }

  deleteErrorMessage.value = '';

  try {
    await deletePatient({ id: props.patientId, reason: reason.value.trim() });
    // Success: close dialog and emit deleted event
    dialogVisible.value = false;
    emit('deleted');
  } catch (err: any) {
    // Handle error cases
    if (err?.status === 'validation') {
      reasonError.value = 'Lý do không được để trống';
    } else if (err?.status === 'forbidden') {
      deleteErrorMessage.value = 'Bạn không đủ quyền thực hiện thao tác này.';
    } else if (err?.status === 'network') {
      deleteErrorMessage.value = 'Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.';
    } else if (err?.status === 'server') {
      deleteErrorMessage.value = 'Lỗi hệ thống. Vui lòng thử lại sau.';
    } else {
      deleteErrorMessage.value = 'Xóa bệnh nhân thất bại. Vui lòng thử lại.';
    }
  }
}

/**
 * Handle cancel - close dialog
 */
function handleCancel(): void {
  dialogVisible.value = false;
}
</script>
