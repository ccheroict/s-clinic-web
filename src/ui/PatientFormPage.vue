<template>
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" :sm="mobile ? 12 : 10" :md="8" :lg="6">
        <v-card>
          <v-toolbar color="primary" dark flat>
            <v-btn icon class="touch-target" @click="goBack">
              <v-icon>mdi-arrow-left</v-icon>
            </v-btn>
            <v-toolbar-title>{{ isEditMode ? 'Cập nhật bệnh nhân' : 'Tạo bệnh nhân mới' }}</v-toolbar-title>
          </v-toolbar>

          <v-card-text :class="mobile ? 'pa-3' : 'pa-4'">
            <!-- Server error alert (R6.10: non-validation error) -->
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

            <!-- Network error alert -->
            <v-alert
              v-if="networkErrorMsg"
              type="warning"
              variant="tonal"
              closable
              class="mb-4"
              @click:close="networkErrorMsg = ''"
            >
              {{ networkErrorMsg }}
            </v-alert>

            <!-- Forbidden error alert (R5.4) -->
            <v-alert
              v-if="forbiddenError"
              type="warning"
              variant="tonal"
              closable
              class="mb-4"
              @click:close="forbiddenError = ''"
            >
              {{ forbiddenError }}
            </v-alert>

            <v-form ref="formRef" @submit.prevent="handleSubmit">
              <!-- Mã bệnh nhân (optional) -->
              <v-text-field
                v-model="form.code"
                label="Mã bệnh nhân"
                :disabled="isPending"
                class="mb-2"
              />

              <!-- Họ tên (required) - R6.6: fullName non-blank -->
              <v-text-field
                v-model="form.fullName"
                label="Họ tên *"
                :error-messages="fieldErrors.fullName ? [fieldErrors.fullName] : []"
                :disabled="isPending"
                class="mb-2"
                @input="clearFieldError('fullName')"
              />

              <!-- Ngày sinh -->
              <v-text-field
                v-model="form.dob"
                label="Ngày sinh"
                type="date"
                :disabled="isPending"
                class="mb-2"
              />

              <!-- Giới tính - R6.6: sex ∈ {M, F, U} -->
              <v-select
                v-model="form.sex"
                label="Giới tính"
                :items="sexOptions"
                item-title="label"
                item-value="value"
                :error-messages="fieldErrors.sex ? [fieldErrors.sex] : []"
                :disabled="isPending"
                clearable
                class="mb-2"
                @update:model-value="clearFieldError('sex')"
              />

              <!-- Số điện thoại -->
              <v-text-field
                v-model="form.phone"
                label="Số điện thoại"
                :error-messages="fieldErrors.phone ? [fieldErrors.phone] : []"
                :disabled="isPending"
                class="mb-2"
                @input="clearFieldError('phone')"
              />

              <!-- Địa chỉ -->
              <v-text-field
                v-model="form.address"
                label="Địa chỉ"
                :error-messages="fieldErrors.address ? [fieldErrors.address] : []"
                :disabled="isPending"
                class="mb-2"
                @input="clearFieldError('address')"
              />

              <!-- CMND/CCCD -->
              <v-text-field
                v-model="form.nationalId"
                label="CMND/CCCD"
                :error-messages="fieldErrors.nationalId ? [fieldErrors.nationalId] : []"
                :disabled="isPending"
                class="mb-2"
                @input="clearFieldError('nationalId')"
              />

              <!-- Số BHYT -->
              <v-text-field
                v-model="form.insuranceNo"
                label="Số BHYT"
                :error-messages="fieldErrors.insuranceNo ? [fieldErrors.insuranceNo] : []"
                :disabled="isPending"
                class="mb-2"
                @input="clearFieldError('insuranceNo')"
              />

              <!-- Mã số thuế -->
              <v-text-field
                v-model="form.taxCode"
                label="Mã số thuế"
                :error-messages="fieldErrors.taxCode ? [fieldErrors.taxCode] : []"
                :disabled="isPending"
                class="mb-2"
                @input="clearFieldError('taxCode')"
              />

              <!-- Tiền sử bệnh -->
              <v-textarea
                v-model="form.medicalHistory"
                label="Tiền sử bệnh"
                :error-messages="fieldErrors.medicalHistory ? [fieldErrors.medicalHistory] : []"
                :disabled="isPending"
                rows="3"
                class="mb-2"
                @input="clearFieldError('medicalHistory')"
              />

              <!-- Dị ứng -->
              <v-textarea
                v-model="form.allergies"
                label="Dị ứng"
                :error-messages="fieldErrors.allergies ? [fieldErrors.allergies] : []"
                :disabled="isPending"
                rows="2"
                class="mb-2"
                @input="clearFieldError('allergies')"
              />

              <!-- Ghi chú -->
              <v-textarea
                v-model="form.note"
                label="Ghi chú"
                :error-messages="fieldErrors.note ? [fieldErrors.note] : []"
                :disabled="isPending"
                rows="2"
                class="mb-2"
                @input="clearFieldError('note')"
              />
            </v-form>
          </v-card-text>

          <v-card-actions :class="mobile ? 'flex-column pa-3' : ''">
            <v-spacer v-if="!mobile" />
            <v-btn
              variant="text"
              :disabled="isPending"
              :block="mobile"
              class="touch-target"
              @click="goBack"
            >
              Hủy
            </v-btn>
            <v-btn
              color="primary"
              variant="elevated"
              :loading="isPending"
              :disabled="isPending"
              :block="mobile"
              class="touch-target"
              @click="handleSubmit"
            >
              {{ isEditMode ? 'Cập nhật' : 'Tạo mới' }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
/**
 * PatientFormPage.vue - Create/Update patient form
 *
 * Responsibilities:
 * - v-form with vee-validate + Zod validation (validatePatientForm)
 * - Create new patient (R6.3) via useCreatePatient
 * - Update existing patient (R6.4) via useUpdatePatient
 * - Display field-level errors from backend validation (R6.5)
 * - Client-side validation: fullName non-blank, sex ∈ {M,F,U} (R6.6)
 * - Disable submit button while pending (R6.8)
 *
 * Validates: Requirements 6.3, 6.4, 6.5, 6.6, 6.8
 */

import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import type { PatientFormInput, Patient } from '../domain/types';
import { validatePatientForm } from '../domain/validators';
import { useCreatePatient, useUpdatePatient } from '../app/patientQueries';
import { getApiClient } from '../infra/apiClient';

const route = useRoute();
const router = useRouter();
const { mobile } = useDisplay();

// Determine if this is edit mode based on route param
const patientId = computed(() => route.params.id as string | undefined);
const isEditMode = computed(() => !!patientId.value);

// Mutation composables
const createMutation = useCreatePatient();
const updateMutation = useUpdatePatient();

// Combined pending state (R6.8: disable controls while waiting)
const isPending = computed(() => createMutation.isPending.value || updateMutation.isPending.value);

// Form state
const form = reactive<PatientFormInput>({
  code: '',
  fullName: '',
  dob: null,
  sex: null,
  phone: null,
  address: null,
  medicalHistory: null,
  allergies: null,
  note: null,
  nationalId: null,
  insuranceNo: null,
  taxCode: null,
});

// Field-level error messages (R6.5, R6.6)
const fieldErrors = reactive<Record<string, string>>({});

// Server/network error messages
const serverError = ref('');
const networkErrorMsg = ref('');
const forbiddenError = ref('');

// Form ref
const formRef = ref<InstanceType<typeof import('vuetify/components').VForm> | null>(null);

// Sex options for select
const sexOptions = [
  { label: 'Nam', value: 'M' },
  { label: 'Nữ', value: 'F' },
  { label: 'Không xác định', value: 'U' },
];

/**
 * Clear a specific field error when user modifies input
 */
function clearFieldError(field: string): void {
  if (fieldErrors[field]) {
    delete fieldErrors[field];
  }
  // Also clear server errors
  serverError.value = '';
  networkErrorMsg.value = '';
  forbiddenError.value = '';
}

/**
 * Clear all field errors
 */
function clearAllErrors(): void {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]);
  serverError.value = '';
  networkErrorMsg.value = '';
  forbiddenError.value = '';
}

/**
 * Navigate back to patient list
 */
function goBack(): void {
  router.push('/patients');
}

/**
 * Load existing patient data for edit mode
 */
async function loadPatient(): Promise<void> {
  if (!patientId.value) return;

  try {
    const apiClient = getApiClient();
    const result = await apiClient.get<Patient>(`/patients/${patientId.value}`);

    if (result.ok) {
      const patient = result.data;
      form.code = patient.code || '';
      form.fullName = patient.fullName;
      form.dob = patient.dob || null;
      form.sex = (patient.sex as 'M' | 'F' | 'U' | null) || null;
      form.phone = patient.phone || null;
      form.address = patient.address || null;
      form.medicalHistory = patient.medicalHistory || null;
      form.allergies = patient.allergies || null;
      form.note = patient.note || null;
      form.nationalId = patient.nationalId || null;
      form.insuranceNo = patient.insuranceNo || null;
      form.taxCode = patient.taxCode || null;
    } else if (result.status === 'network') {
      networkErrorMsg.value = result.message;
    } else if (result.status === 'forbidden') {
      forbiddenError.value = result.message;
    } else {
      serverError.value = 'Không thể tải thông tin bệnh nhân.';
    }
  } catch {
    serverError.value = 'Không thể tải thông tin bệnh nhân.';
  }
}

/**
 * Handle form submission
 * 1. Client-side validate with Zod (R6.6)
 * 2. Call create/update mutation (R6.3/R6.4)
 * 3. Handle backend validation errors (R6.5)
 * 4. Handle network/server errors (R6.10)
 */
async function handleSubmit(): Promise<void> {
  // Clear previous errors
  clearAllErrors();

  // R6.6: Client-side validation with Zod schema
  const validation = validatePatientForm(form);

  if (!validation.ok) {
    // Display field-specific validation errors (R6.6)
    Object.entries(validation.errors).forEach(([field, message]) => {
      fieldErrors[field] = message;
    });
    // Do NOT call API (R6.6)
    return;
  }

  // Prepare input (keep null values for optional fields)
  const input: PatientFormInput = {
    code: form.code || undefined,
    fullName: form.fullName,
    dob: form.dob || null,
    sex: form.sex || null,
    phone: form.phone || null,
    address: form.address || null,
    medicalHistory: form.medicalHistory || null,
    allergies: form.allergies || null,
    note: form.note || null,
    nationalId: form.nationalId || null,
    insuranceNo: form.insuranceNo || null,
    taxCode: form.taxCode || null,
  };

  try {
    if (isEditMode.value && patientId.value) {
      // R6.4: Update existing patient
      await updateMutation.mutateAsync({ id: patientId.value, input });
    } else {
      // R6.3: Create new patient
      await createMutation.mutateAsync(input);
    }

    // Success - navigate back to list
    router.push('/patients');
  } catch (err: unknown) {
    // Handle mutation error (thrown from composable)
    handleMutationError(err);
  }
}

/**
 * Handle errors thrown by create/update mutations
 * Processes the ApiResult error variants
 */
function handleMutationError(err: unknown): void {
  if (!err || typeof err !== 'object') {
    serverError.value = 'Đã xảy ra lỗi. Vui lòng thử lại.';
    return;
  }

  const errorResult = err as { ok?: boolean; status?: string; errors?: Record<string, string[]>; message?: string };

  if (errorResult.ok === false) {
    switch (errorResult.status) {
      case 'validation':
        // R6.5: Backend validation errors - display per field
        if (errorResult.errors) {
          Object.entries(errorResult.errors).forEach(([field, messages]) => {
            fieldErrors[field] = Array.isArray(messages) ? messages[0] : String(messages);
          });
        }
        break;

      case 'network':
        // Network/timeout error - keep input (R6.10)
        networkErrorMsg.value = errorResult.message || 'Lỗi kết nối. Vui lòng kiểm tra mạng.';
        break;

      case 'forbidden':
        // R5.4: Keep data and show permission error
        forbiddenError.value = errorResult.message || 'Bạn không đủ quyền thực hiện thao tác này.';
        break;

      case 'server':
        // R6.10, R9.6: Server error - generic message
        serverError.value = errorResult.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
        break;

      default:
        serverError.value = 'Đã xảy ra lỗi. Vui lòng thử lại.';
    }
  } else {
    serverError.value = 'Đã xảy ra lỗi. Vui lòng thử lại.';
  }
}

// Load patient data on mount if in edit mode
onMounted(() => {
  if (isEditMode.value) {
    loadPatient();
  }
});
</script>


<style scoped>
/**
 * Touch target enforcement for buttons (R3.5).
 */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}
</style>
