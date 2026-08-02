<template>
  <v-dialog
    v-model="dialogVisible"
    max-width="600"
    persistent
  >
    <v-card>
      <v-card-title class="text-h6">
        {{ isEditMode ? 'Chỉnh sửa lịch hẹn' : 'Tạo lịch hẹn mới' }}
      </v-card-title>

      <v-card-text>
        <!-- Conflict alert (409 response) -->
        <v-alert
          v-if="conflictMessage"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ conflictMessage }}
        </v-alert>

        <!-- General server/network error alert -->
        <v-alert
          v-if="serverError"
          type="error"
          variant="tonal"
          density="compact"
          closable
          class="mb-4"
          @click:close="serverError = ''"
        >
          {{ serverError }}
        </v-alert>

        <!-- Patient autocomplete (R8.1, R8.2) -->
        <v-autocomplete
          v-model="form.patientId"
          :items="patientOptions"
          item-title="label"
          item-value="id"
          label="Bệnh nhân *"
          :loading="isSearchingPatients"
          :error-messages="fieldErrors.patientId ? [fieldErrors.patientId] : []"
          :disabled="isPending || isEditMode"
          no-data-text="Không tìm thấy bệnh nhân"
          clearable
          class="mb-2"
          @update:search="handlePatientSearch"
          @update:model-value="clearFieldError('patientId')"
        />

        <!-- Doctor dropdown (R11.2) -->
        <v-select
          v-model="form.doctorId"
          :items="doctorOptions"
          item-title="fullName"
          item-value="id"
          label="Bác sĩ *"
          :loading="isDoctorsLoading"
          :error-messages="fieldErrors.doctorId ? [fieldErrors.doctorId] : []"
          :disabled="isPending"
          :no-data-text="doctorsError ? 'Không thể tải danh sách bác sĩ' : 'Không có bác sĩ khả dụng'"
          clearable
          class="mb-2"
          @update:model-value="clearFieldError('doctorId')"
        />

        <!-- Doctor list error -->
        <v-alert
          v-if="doctorsError"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          Không thể tải danh sách bác sĩ. Vui lòng thử lại.
        </v-alert>

        <!-- Date-time picker (R8.1) -->
        <v-text-field
          v-model="form.scheduledAt"
          label="Ngày giờ hẹn *"
          type="datetime-local"
          :error-messages="fieldErrors.scheduledAt ? [fieldErrors.scheduledAt] : []"
          :disabled="isPending"
          class="mb-2"
          @update:model-value="clearFieldError('scheduledAt')"
        />

        <!-- Available slots display (R9.4) -->
        <div v-if="showAvailableSlots" class="mb-4">
          <p class="text-caption mb-2">Khung giờ còn trống:</p>
          <v-progress-linear
            v-if="isSlotsLoading"
            indeterminate
            color="primary"
            class="mb-2"
          />
          <v-chip-group v-else-if="availableSlots.length > 0">
            <v-chip
              v-for="slot in availableSlots"
              :key="slot"
              size="small"
              variant="outlined"
              color="primary"
              @click="selectSlot(slot)"
            >
              {{ slot }}
            </v-chip>
          </v-chip-group>
          <p v-else class="text-caption text-medium-emphasis">
            Không có khung giờ trống trong ngày này.
          </p>
        </div>

        <!-- Duration (R8.1, R8.10) -->
        <v-text-field
          v-model.number="form.durationMin"
          label="Thời lượng (phút)"
          type="number"
          :min="5"
          :max="480"
          :error-messages="fieldErrors.durationMin ? [fieldErrors.durationMin] : []"
          :disabled="isPending"
          class="mb-2"
          @update:model-value="clearFieldError('durationMin')"
        />

        <!-- Reason (R1.10) -->
        <v-text-field
          v-model="form.reason"
          label="Lý do khám"
          :maxlength="500"
          counter
          :error-messages="fieldErrors.reason ? [fieldErrors.reason] : []"
          :disabled="isPending"
          class="mb-2"
          @update:model-value="clearFieldError('reason')"
        />

        <!-- Note (R1.10) -->
        <v-textarea
          v-model="form.note"
          label="Ghi chú"
          :maxlength="1000"
          counter
          rows="3"
          :error-messages="fieldErrors.note ? [fieldErrors.note] : []"
          :disabled="isPending"
          class="mb-2"
          @update:model-value="clearFieldError('note')"
        />
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
          color="primary"
          variant="elevated"
          :loading="isPending"
          :disabled="isPending || isSubmitDisabled"
          @click="handleSubmit"
        >
          {{ isEditMode ? 'Cập nhật' : 'Tạo lịch hẹn' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * AppointmentFormDialog.vue - Dialog for creating and editing appointments
 *
 * Responsibilities:
 * - Create/edit appointment via v-dialog (R8.1, R8.9)
 * - Patient autocomplete with debounced search (R8.2)
 * - Doctor dropdown from active doctors list (R11.2)
 * - Client-side validation: required fields, future date, duration range (R8.3, R8.4, R8.10)
 * - Loading state + disable submit while pending (R8.7)
 * - Backend validation error mapping to form fields (R8.8)
 * - Conflict (409) details display, keep form open (R8.5)
 * - Keep form data on error (R8.8)
 *
 * Validates: Requirements 9.2, 9.3, 9.5, 9.6, 9.7, 1.3
 */

import { ref, reactive, computed, watch } from 'vue';
import type { Appointment, AppointmentCreateInput, AppointmentUpdateInput } from '../domain/appointmentTypes';
import { useCreateAppointment, useUpdateAppointment, useAppointments } from '../app/appointmentQueries';
import { useDoctors } from '../app/doctorQueries';
import { computeAvailableSlots } from '../domain/appointmentUtils';
import { getApiClient } from '../infra/apiClient';
import type { Patient, Page } from '../domain/types';

const props = defineProps<{
  /** Controls dialog visibility (v-model) */
  modelValue: boolean;
  /** If provided, pre-fill form for editing; null/undefined = create mode */
  appointment?: Appointment | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

// --- Mutations ---
const createMutation = useCreateAppointment();
const updateMutation = useUpdateAppointment();

// --- Doctors list ---
const { data: doctorsData, isLoading: isDoctorsLoading, error: doctorsQueryError } = useDoctors();

const doctorOptions = computed(() => doctorsData.value ?? []);
const doctorsError = computed(() => !!doctorsQueryError.value);

// --- Dialog visibility ---
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

// --- Mode detection ---
const isEditMode = computed(() => !!props.appointment);

// --- Form state ---
interface FormData {
  patientId: string;
  doctorId: string | null;
  scheduledAt: string;
  durationMin: number;
  reason: string;
  note: string;
}

const form = reactive<FormData>({
  patientId: '',
  doctorId: null,
  scheduledAt: '',
  durationMin: 30,
  reason: '',
  note: '',
});

// --- Patient autocomplete state ---
const patientOptions = ref<{ id: string; label: string }[]>([]);
const isSearchingPatients = ref(false);
let patientSearchTimeout: ReturnType<typeof setTimeout> | null = null;

// --- Available slots state (R9.4) ---
const selectedDate = computed(() => {
  if (!form.scheduledAt) return '';
  // Extract date portion from datetime-local value (YYYY-MM-DD)
  return form.scheduledAt.split('T')[0] ?? '';
});

const showAvailableSlots = computed(() => !!form.doctorId && !!selectedDate.value);

const { data: slotsData, isLoading: isSlotsLoading } = useAppointments(
  computed(() => ({
    date: selectedDate.value || undefined,
    doctorId: form.doctorId || undefined,
    page: 0,
    size: 50,
  })),
);

const availableSlots = computed(() => {
  if (!showAvailableSlots.value) return [];
  const appointments = slotsData.value?.content ?? [];
  return computeAvailableSlots(appointments, selectedDate.value);
});

function selectSlot(slot: string): void {
  if (selectedDate.value) {
    form.scheduledAt = `${selectedDate.value}T${slot}`;
  }
}

// --- Error state ---
const fieldErrors = reactive<Record<string, string>>({});
const serverError = ref('');
const conflictMessage = ref('');

// --- Combined pending state (R8.7) ---
const isPending = computed(() => createMutation.isPending.value || updateMutation.isPending.value);

// --- Submit disabled when doctors can't load or list is empty ---
const isSubmitDisabled = computed(() => {
  return doctorsError.value || (doctorOptions.value.length === 0 && !isDoctorsLoading.value);
});

// --- Reset form when dialog opens ---
watch(dialogVisible, (visible) => {
  if (visible) {
    clearAllErrors();

    if (props.appointment) {
      // Edit mode: pre-fill form with existing data (R8.9)
      form.patientId = props.appointment.patientId;
      form.doctorId = props.appointment.doctorId;
      form.scheduledAt = toDatetimeLocalValue(props.appointment.scheduledAt);
      form.durationMin = props.appointment.durationMin;
      form.reason = props.appointment.reason ?? '';
      form.note = props.appointment.note ?? '';

      // Pre-fill patient autocomplete display
      patientOptions.value = [{
        id: props.appointment.patientId,
        label: `${props.appointment.patientName}${props.appointment.patientPhone ? ' - ' + props.appointment.patientPhone : ''}`,
      }];
    } else {
      // Create mode: reset form
      form.patientId = '';
      form.doctorId = null;
      form.scheduledAt = '';
      form.durationMin = 30;
      form.reason = '';
      form.note = '';
      patientOptions.value = [];
    }
  }
});

// --- Patient search with debounce 300ms (R8.2) ---
function handlePatientSearch(searchText: string | null): void {
  if (patientSearchTimeout) {
    clearTimeout(patientSearchTimeout);
  }

  const query = (searchText ?? '').trim();
  if (query.length < 1) {
    return;
  }

  patientSearchTimeout = setTimeout(async () => {
    isSearchingPatients.value = true;
    try {
      const apiClient = getApiClient();
      const result = await apiClient.get<Page<Patient>>('/patients', {
        q: query,
        page: 0,
        size: 10,
      });

      if (result.ok) {
        patientOptions.value = result.data.content.map((p) => ({
          id: p.id,
          label: `${p.fullName}${p.phone ? ' - ' + p.phone : ''}`,
        }));
      }
    } catch {
      // Silently fail - patient search is best effort
    } finally {
      isSearchingPatients.value = false;
    }
  }, 300);
}

// --- Client-side validation (R8.3, R8.4, R8.10) ---
function validateForm(): boolean {
  clearAllErrors();
  let valid = true;

  if (!form.patientId) {
    fieldErrors.patientId = 'Vui lòng chọn bệnh nhân';
    valid = false;
  }

  if (!form.doctorId) {
    fieldErrors.doctorId = 'Vui lòng chọn bác sĩ';
    valid = false;
  }

  if (!form.scheduledAt) {
    fieldErrors.scheduledAt = 'Vui lòng chọn ngày giờ hẹn';
    valid = false;
  } else {
    // R8.4: Must be future
    const scheduledDate = new Date(form.scheduledAt);
    if (scheduledDate <= new Date()) {
      fieldErrors.scheduledAt = 'Thời gian hẹn phải ở trong tương lai';
      valid = false;
    }
  }

  // R8.10: Duration 5-480
  if (form.durationMin < 5 || form.durationMin > 480) {
    fieldErrors.durationMin = 'Thời lượng phải từ 5 đến 480 phút';
    valid = false;
  }

  return valid;
}

// --- Submit handler ---
async function handleSubmit(): Promise<void> {
  if (!validateForm()) {
    return;
  }

  // Clear conflict/server errors from previous attempt
  conflictMessage.value = '';
  serverError.value = '';

  try {
    if (isEditMode.value && props.appointment) {
      // Update mode
      const input: AppointmentUpdateInput = {
        scheduledAt: toISOString(form.scheduledAt),
        durationMin: form.durationMin,
        doctorId: form.doctorId,
        reason: form.reason || undefined,
        note: form.note || undefined,
      };

      await updateMutation.mutateAsync({ id: props.appointment.id, input });
    } else {
      // Create mode
      const input: AppointmentCreateInput = {
        patientId: form.patientId,
        doctorId: form.doctorId,
        scheduledAt: toISOString(form.scheduledAt),
        durationMin: form.durationMin,
        reason: form.reason || undefined,
        note: form.note || undefined,
      };

      await createMutation.mutateAsync(input);
    }

    // Success: emit saved and close dialog (R8.6)
    emit('saved');
    dialogVisible.value = false;
  } catch (err: unknown) {
    // Handle mutation error - keep form open and data (R8.8)
    handleMutationError(err);
  }
}

// --- Error handling ---
function handleMutationError(err: unknown): void {
  if (!err || typeof err !== 'object') {
    serverError.value = 'Đã xảy ra lỗi. Vui lòng thử lại.';
    return;
  }

  const errorResult = err as {
    ok?: boolean;
    status?: string;
    errors?: Record<string, string[]>;
    message?: string;
    code?: string;
  };

  if (errorResult.ok === false) {
    switch (errorResult.status) {
      case 'validation':
        // R8.8: Map backend field errors to form (R9.6)
        if (errorResult.errors) {
          Object.entries(errorResult.errors).forEach(([field, messages]) => {
            fieldErrors[field] = Array.isArray(messages) ? messages[0] : String(messages);
          });
        }
        break;

      case 'server':
        // Check if this is actually a 409 conflict wrapped as server error
        // The classifyResponse maps 409 → server type, but the message may contain conflict info
        if (errorResult.message && errorResult.message.includes('trùng')) {
          // R8.5: Show conflict message
          conflictMessage.value = errorResult.message;
        } else if (errorResult.code === 'CONFLICT') {
          conflictMessage.value = errorResult.message || 'Bác sĩ đã có lịch hẹn trùng thời gian. Vui lòng chọn thời gian khác.';
        } else {
          serverError.value = errorResult.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
        }
        break;

      case 'network':
        serverError.value = errorResult.message || 'Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.';
        break;

      case 'forbidden':
        serverError.value = 'Bạn không đủ quyền thực hiện thao tác này.';
        break;

      default:
        serverError.value = 'Đã xảy ra lỗi. Vui lòng thử lại.';
    }
  } else {
    serverError.value = 'Đã xảy ra lỗi. Vui lòng thử lại.';
  }
}

// --- Helpers ---
function clearFieldError(field: string): void {
  if (fieldErrors[field]) {
    delete fieldErrors[field];
  }
}

function clearAllErrors(): void {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]);
  serverError.value = '';
  conflictMessage.value = '';
}

function handleCancel(): void {
  dialogVisible.value = false;
}

/**
 * Convert ISO string to datetime-local input value (YYYY-MM-DDTHH:mm)
 */
function toDatetimeLocalValue(isoString: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    // Format as local datetime for the input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/**
 * Convert datetime-local value to ISO string for API
 */
function toISOString(datetimeLocal: string): string {
  if (!datetimeLocal) return '';
  try {
    return new Date(datetimeLocal).toISOString();
  } catch {
    return '';
  }
}
</script>
