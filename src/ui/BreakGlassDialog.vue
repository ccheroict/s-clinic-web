<template>
  <v-dialog
    v-model="dialogVisible"
    max-width="520"
    persistent
  >
    <v-card>
      <v-toolbar color="warning" density="comfortable" flat>
        <v-icon class="ms-4" icon="mdi-shield-alert-outline" />
        <v-toolbar-title>Truy cập ngoài phạm vi điều trị</v-toolbar-title>
      </v-toolbar>

      <v-card-text>
        <p>
          Bạn không phải bác sĩ điều trị của
          <strong v-if="patientName">{{ patientName }}</strong>
          <span v-else>bệnh nhân này</span>, nên hồ sơ không mở theo quyền thường.
        </p>

        <v-alert type="warning" variant="tonal" density="comfortable" class="mt-3">
          Bạn vẫn có thể mở hồ sơ khi cần thiết về mặt chuyên môn. Lần truy cập này
          sẽ được <strong>ghi lại kèm tên bạn và lý do</strong>, và
          <strong>quản trị viên được thông báo</strong>. Quyền truy cập có thời hạn
          và sẽ tự hết.
        </v-alert>

        <v-textarea
          v-model="reason"
          label="Lý do cần truy cập"
          :error-messages="reasonError ? [reasonError] : []"
          :disabled="isPending"
          rows="3"
          auto-grow
          counter="500"
          maxlength="500"
          class="mt-4"
          hint="Tối thiểu 10 ký tự. Ví dụ: bệnh nhân cấp cứu, bác sĩ điều trị không có mặt."
          persistent-hint
          autofocus
          @input="reasonError = ''"
        />

        <v-alert
          v-if="serverError"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ serverError }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="isPending" @click="handleCancel">
          Không mở
        </v-btn>
        <v-btn
          color="warning"
          variant="elevated"
          :loading="isPending"
          :disabled="isPending"
          class="confirm-btn"
          @click="handleConfirm"
        >
          Mở hồ sơ và ghi nhận
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * BreakGlassDialog.vue - requesting access to a patient outside one's care
 *
 * Shown when the server refuses a patient record and offers break-glass as the
 * way through. The wording is the substance of this screen: it has to make the
 * consequence unmistakable without making the action feel forbidden. A clinician
 * who believes the door is simply shut will find another way in, and the other
 * ways are all worse than an opened door with a name against it.
 *
 * So it says plainly that the access is allowed, that it is recorded by name,
 * that administrators are told, and that it expires. Nothing is hidden and
 * nothing is scolded.
 */

import { computed, ref, watch } from 'vue';
import { useBreakGlass } from '../app/patientQueries';

const props = defineProps<{
  /** Controls dialog visibility (v-model) */
  modelValue: boolean;
  /** Patient the access is being requested for */
  patientId: string | null;
  /** Patient's name, when it is already known */
  patientName?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  /** Access was granted; the caller should retry whatever it was doing. */
  (e: 'granted'): void;
}>();

const { mutateAsync: requestAccess, isPending } = useBreakGlass();

const reason = ref('');
const reasonError = ref('');
const serverError = ref('');

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

watch(dialogVisible, (visible) => {
  if (visible) {
    reason.value = '';
    reasonError.value = '';
    serverError.value = '';
  }
});

/**
 * Mirrors the server's rule rather than guessing at it: ten characters is the
 * minimum it accepts, so checking here saves a round trip without inventing a
 * different standard.
 */
function validate(): boolean {
  const entered = reason.value.trim();

  if (!entered) {
    reasonError.value = 'Vui lòng nhập lý do';
    return false;
  }
  if (entered.length < 10) {
    reasonError.value = 'Lý do cần ít nhất 10 ký tự';
    return false;
  }
  return true;
}

async function handleConfirm(): Promise<void> {
  serverError.value = '';

  if (!props.patientId) {
    serverError.value = 'Không xác định được bệnh nhân.';
    return;
  }
  if (!validate()) {
    return;
  }

  try {
    await requestAccess({ patientId: props.patientId, reason: reason.value.trim() });
    dialogVisible.value = false;
    emit('granted');
  } catch (err: any) {
    if (err?.status === 'validation') {
      reasonError.value = 'Lý do chưa đạt yêu cầu. Vui lòng mô tả rõ hơn.';
    } else if (err?.status === 'forbidden') {
      // Only doctors can request this. A receptionist already reaches every
      // administrative record and has no clinical access to escalate to.
      serverError.value = 'Vai trò của bạn không dùng được chức năng này.';
    } else if (err?.status === 'network') {
      serverError.value = 'Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.';
    } else {
      serverError.value = 'Không cấp được quyền truy cập. Vui lòng thử lại.';
    }
  }
}

function handleCancel(): void {
  dialogVisible.value = false;
}
</script>

<style scoped>
/** Touch target (R3.5). */
.confirm-btn {
  min-height: 44px;
  min-width: 44px;
}
</style>
