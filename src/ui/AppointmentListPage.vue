<template>
  <v-container fluid>
    <!-- Page header -->
    <v-row class="mb-4" align="center">
      <v-col>
        <h1 :class="mobile ? 'text-h6' : 'text-h5'">Lịch hẹn</h1>
      </v-col>
      <v-col cols="auto">
        <v-btn
          color="primary"
          variant="elevated"
          prepend-icon="mdi-plus"
          @click="openCreateDialog"
        >
          Tạo lịch hẹn
        </v-btn>
      </v-col>
    </v-row>

    <!-- Filters section -->
    <v-row class="mb-4" :dense="mobile">
      <!-- Date filter -->
      <v-col cols="12" sm="4" md="3">
        <v-text-field
          v-model="filters.date"
          type="date"
          label="Ngày"
          variant="outlined"
          :density="mobile ? 'comfortable' : 'compact'"
          clearable
          @click:clear="handleDateClear"
        />
      </v-col>

      <!-- Doctor filter -->
      <v-col cols="12" sm="4" md="3">
        <v-select
          v-model="filters.doctorId"
          :items="doctorOptions"
          item-title="title"
          item-value="value"
          label="Bác sĩ"
          variant="outlined"
          :density="mobile ? 'comfortable' : 'compact'"
          clearable
          :disabled="currentRole === 'DOCTOR'"
        />
      </v-col>

      <!-- Status filter chips -->
      <v-col cols="12" sm="12" md="6">
        <v-chip-group
          v-model="selectedStatusIndex"
          selected-class="text-primary"
          @update:model-value="handleStatusChange"
        >
          <v-chip
            v-for="(config, status) in STATUS_DISPLAY"
            :key="status"
            :color="config.color"
            variant="outlined"
            filter
          >
            {{ config.label }}
          </v-chip>
        </v-chip-group>
      </v-col>
    </v-row>

    <!-- Error alert -->
    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      @click:close="errorMessage = ''"
    >
      {{ errorMessage }}
      <template #append>
        <v-btn
          variant="text"
          size="small"
          @click="refetch"
        >
          Thử lại
        </v-btn>
      </template>
    </v-alert>

    <!-- Data table -->
    <v-data-table-server
      :headers="visibleHeaders"
      :items="appointments"
      :items-length="totalElements"
      :loading="isFetching"
      :page="currentPage"
      :items-per-page="pageSize"
      :no-data-text="emptyStateText"
      :density="mobile ? 'comfortable' : 'default'"
      @update:page="handlePageChange"
      @update:items-per-page="handlePageSizeChange"
    >
      <!-- Empty state -->
      <template #no-data>
        <v-alert
          type="info"
          variant="tonal"
          class="ma-4"
        >
          {{ emptyStateText }}
        </v-alert>
      </template>

      <!-- Scheduled time formatting -->
      <template #item.scheduledAt="{ item }">
        {{ formatDateTime(item.scheduledAt) }}
      </template>

      <!-- Duration formatting -->
      <template #item.durationMin="{ item }">
        {{ item.durationMin }} phút
      </template>

      <!-- Status chip -->
      <template #item.status="{ item }">
        <v-chip
          :color="getStatusColor(item.status)"
          size="small"
          variant="flat"
        >
          {{ getStatusLabel(item.status) }}
        </v-chip>
      </template>

      <!-- Actions column -->
      <template #item.actions="{ item }">
        <v-btn
          icon="mdi-pencil"
          size="small"
          variant="text"
          :disabled="isTerminalStatus(item.status) || pendingStatusId === item.id"
          @click="openEditDialog(item)"
        />
        <v-menu v-if="getAllowedTransitions(item.status).length > 0">
          <template #activator="{ props: menuProps }">
            <v-btn
              icon="mdi-swap-horizontal"
              size="small"
              variant="text"
              :disabled="pendingStatusId === item.id"
              v-bind="menuProps"
            />
          </template>
          <v-list density="compact">
            <v-list-item
              v-for="targetStatus in getAllowedTransitions(item.status)"
              :key="targetStatus"
              :disabled="pendingStatusId === item.id"
              @click="handleStatusTransition(item, targetStatus)"
            >
              <v-list-item-title>
                <v-chip
                  :color="getStatusColor(targetStatus)"
                  size="small"
                  variant="flat"
                >
                  {{ getStatusLabel(targetStatus) }}
                </v-chip>
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </v-data-table-server>

    <!-- Appointment Form Dialog -->
    <AppointmentFormDialog
      v-model="formDialogVisible"
      :appointment="editingAppointment"
      @saved="handleFormSaved"
    />

    <!-- Cancel Confirmation Dialog (R9.2, R9.3) -->
    <v-dialog v-model="cancelDialogVisible" max-width="480" persistent>
      <v-card>
        <v-card-title class="text-h6">
          Xác nhận hủy lịch hẹn
        </v-card-title>
        <v-card-text>
          <p class="mb-4">Bạn có chắc chắn muốn hủy lịch hẹn này?</p>
          <v-textarea
            v-model="cancelReason"
            label="Lý do hủy *"
            :maxlength="500"
            counter
            rows="3"
            :error-messages="cancelReasonError ? [cancelReasonError] : []"
            @update:model-value="cancelReasonError = ''"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeCancelDialog">
            Đóng
          </v-btn>
          <v-btn
            color="error"
            variant="elevated"
            :loading="statusMutation.isPending.value"
            @click="confirmCancel"
          >
            Xác nhận hủy
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- No-Show Confirmation Dialog (R9.6) -->
    <v-dialog v-model="noShowDialogVisible" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-h6">
          Xác nhận vắng mặt
        </v-card-title>
        <v-card-text>
          Bạn có chắc chắn muốn đánh dấu bệnh nhân vắng mặt cho lịch hẹn này?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="noShowDialogVisible = false">
            Đóng
          </v-btn>
          <v-btn
            color="warning"
            variant="elevated"
            :loading="statusMutation.isPending.value"
            @click="confirmNoShow"
          >
            Xác nhận
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Success/Error Snackbar (R9.4, R9.5) -->
    <v-snackbar
      v-model="snackbarVisible"
      :color="snackbarColor"
      :timeout="3000"
      location="bottom end"
    >
      {{ snackbarMessage }}
      <template #actions>
        <v-btn variant="text" @click="snackbarVisible = false">
          Đóng
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
/**
 * AppointmentListPage.vue - Appointment list with filters, pagination, and status management
 *
 * Responsibilities:
 * - Display appointment list using v-data-table-server (R7.1, R7.2)
 * - Filters: date picker, doctor dropdown, status chips (R7.3)
 * - Pagination with max page size 20 (R7.1, R7.8)
 * - Empty state when no records (R7.4)
 * - Error display with retry (R7.7)
 * - Action buttons: create, edit, status change (R9.1)
 * - Status transition with confirmation dialogs (R9.2, R9.3, R9.5, R9.6)
 * - Role-based: DOCTOR sees own appointments only (R10.3)
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.6, 9.1, 9.5, 9.6, 7.3
 */

import { ref, computed, watch, onMounted } from 'vue';
import { useDisplay } from 'vuetify';
import { useAppointments, useUpdateAppointmentStatus } from '../app/appointmentQueries';
import { useAuthStore } from '../app/authStore';
import {
  STATUS_DISPLAY,
  getStatusLabel,
  getStatusColor,
  getAllowedTransitions,
  isTerminalStatus,
} from '../domain/appointmentTypes';
import type { Appointment, AppointmentFilters, AppointmentStatus } from '../domain/appointmentTypes';
import AppointmentFormDialog from './AppointmentFormDialog.vue';

const { mobile, mdAndUp } = useDisplay();
const authStore = useAuthStore();

const currentRole = computed(() => authStore.currentRole);

/** Status keys for chip group indexing */
const statusKeys = Object.keys(STATUS_DISPLAY) as AppointmentStatus[];

/** Get today's date in YYYY-MM-DD format */
function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Filters state */
const filters = ref<AppointmentFilters>({
  date: getTodayDate(),
  doctorId: undefined,
  status: undefined,
  page: 0,
  size: 20,
});

/** Current page (1-based for Vuetify) */
const currentPage = ref(1);

/** Page size */
const pageSize = ref(20);

/** Selected status chip index */
const selectedStatusIndex = ref<number | undefined>(undefined);

/** Error message for display */
const errorMessage = ref('');

/** Doctor options for dropdown (placeholder until doctor list API is available) */
const doctorOptions = ref<Array<{ title: string; value: string }>>([]);

/** Full table headers */
const headers = [
  { title: 'Bệnh nhân', key: 'patientName', sortable: false },
  { title: 'Bác sĩ', key: 'doctorName', sortable: false },
  { title: 'Thời gian', key: 'scheduledAt', sortable: false },
  { title: 'Thời lượng', key: 'durationMin', sortable: false },
  { title: 'Trạng thái', key: 'status', sortable: false },
  { title: 'Lý do', key: 'reason', sortable: false },
  { title: 'Thao tác', key: 'actions', sortable: false, align: 'center' as const },
];

/**
 * Responsive headers:
 * - Mobile: patient, status, actions
 * - Tablet: patient, doctor, time, status, actions
 * - Desktop: all columns
 */
const visibleHeaders = computed(() => {
  if (mobile.value) {
    return headers.filter(h => ['patientName', 'status', 'actions'].includes(h.key));
  }
  if (!mdAndUp.value) {
    return headers.filter(h => !['durationMin', 'reason'].includes(h.key));
  }
  return headers;
});

/** Use appointments composable with reactive filters */
const { data, isFetching, error, refetch } = useAppointments(filters);

/** Computed appointment list */
const appointments = computed<Appointment[]>(() => data.value?.content ?? []);

/** Total elements for pagination */
const totalElements = computed(() => data.value?.totalElements ?? 0);

/** Empty state text */
const emptyStateText = computed(() => {
  if (filters.value.date || filters.value.doctorId || filters.value.status) {
    return 'Không có lịch hẹn phù hợp với bộ lọc hiện tại';
  }
  return 'Không có lịch hẹn nào';
});

/**
 * Watch for query errors and set error message
 */
watch(error, (newError) => {
  if (newError) {
    const err = newError as any;
    if (err.status === 'network') {
      errorMessage.value = 'Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.';
    } else if (err.status === 'server') {
      errorMessage.value = 'Lỗi hệ thống. Vui lòng thử lại sau.';
    } else if (err.status === 'forbidden') {
      errorMessage.value = 'Bạn không đủ quyền thực hiện thao tác này.';
    } else {
      errorMessage.value = 'Thao tác thất bại. Vui lòng thử lại.';
    }
  } else {
    errorMessage.value = '';
  }
});

/**
 * On mount, apply role-based defaults
 * DOCTOR role: API automatically filters by their own doctorId
 */
onMounted(() => {
  // Default filter is already date=today. The API handles DOCTOR role filtering.
});

/**
 * Handle date filter clear
 */
function handleDateClear(): void {
  filters.value = { ...filters.value, date: undefined, page: 0 };
  currentPage.value = 1;
}

/**
 * Handle status chip selection
 */
function handleStatusChange(index: number | undefined): void {
  if (index === undefined || index === null) {
    filters.value = { ...filters.value, status: undefined, page: 0 };
  } else {
    filters.value = { ...filters.value, status: statusKeys[index], page: 0 };
  }
  currentPage.value = 1;
}

/**
 * Handle page change from data table
 */
function handlePageChange(page: number): void {
  currentPage.value = page;
  filters.value = { ...filters.value, page: page - 1 };
}

/**
 * Handle page size change (capped at 20)
 */
function handlePageSizeChange(size: number): void {
  const cappedSize = Math.min(size, 20);
  pageSize.value = cappedSize;
  currentPage.value = 1;
  filters.value = { ...filters.value, size: cappedSize, page: 0 };
}

/**
 * Watch filters.date and filters.doctorId for reactive updates
 */
watch(
  () => [filters.value.date, filters.value.doctorId],
  () => {
    filters.value = { ...filters.value, page: 0 };
    currentPage.value = 1;
  },
);

/**
 * Format ISO datetime for display
 */
function formatDateTime(isoDate: string): string {
  if (!isoDate) return '';
  try {
    return new Date(isoDate).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

// --- Form Dialog State ---

/** Form dialog visibility */
const formDialogVisible = ref(false);

/** Appointment being edited (null = create mode) */
const editingAppointment = ref<Appointment | null>(null);

/**
 * Open create appointment dialog
 */
function openCreateDialog(): void {
  editingAppointment.value = null;
  formDialogVisible.value = true;
}

/**
 * Open edit appointment dialog
 */
function openEditDialog(appointment: Appointment): void {
  editingAppointment.value = appointment;
  formDialogVisible.value = true;
}

/**
 * Handle form saved event - show success snackbar
 */
function handleFormSaved(): void {
  showSnackbar('Lịch hẹn đã được lưu thành công', 'success');
}

// --- Status Update State (R5.1, R5.6, R9.5, R9.6) ---

/** Status mutation composable */
const statusMutation = useUpdateAppointmentStatus();

/** ID of the appointment currently being updated (for disabling buttons - R9.6) */
const pendingStatusId = ref<string | null>(null);

/** Cancel dialog state */
const cancelDialogVisible = ref(false);
const cancelReason = ref('');
const cancelReasonError = ref('');
const cancelTargetAppointment = ref<Appointment | null>(null);

/** No-show dialog state */
const noShowDialogVisible = ref(false);
const noShowTargetAppointment = ref<Appointment | null>(null);

/** Snackbar state */
const snackbarVisible = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref<'success' | 'error'>('success');

/**
 * Show a snackbar notification
 */
function showSnackbar(message: string, color: 'success' | 'error'): void {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbarVisible.value = true;
}

/**
 * Handle status transition for an appointment (R5.1, R9.1)
 * - CANCELLED: show cancel dialog with reason input (R9.2)
 * - NO_SHOW: show confirmation dialog
 * - Others: call mutation directly
 */
function handleStatusTransition(appointment: Appointment, targetStatus: AppointmentStatus): void {
  if (targetStatus === 'CANCELLED') {
    cancelTargetAppointment.value = appointment;
    cancelReason.value = '';
    cancelReasonError.value = '';
    cancelDialogVisible.value = true;
  } else if (targetStatus === 'NO_SHOW') {
    noShowTargetAppointment.value = appointment;
    noShowDialogVisible.value = true;
  } else {
    executeStatusTransition(appointment.id, targetStatus);
  }
}

/**
 * Confirm cancel with reason validation (R9.3)
 */
function confirmCancel(): void {
  const trimmedReason = cancelReason.value.trim();
  if (!trimmedReason) {
    cancelReasonError.value = 'Vui lòng nhập lý do hủy';
    return;
  }

  if (cancelTargetAppointment.value) {
    executeStatusTransition(cancelTargetAppointment.value.id, 'CANCELLED');
    cancelDialogVisible.value = false;
  }
}

/**
 * Close the cancel dialog without action
 */
function closeCancelDialog(): void {
  cancelDialogVisible.value = false;
  cancelReason.value = '';
  cancelReasonError.value = '';
}

/**
 * Confirm no-show transition
 */
function confirmNoShow(): void {
  if (noShowTargetAppointment.value) {
    executeStatusTransition(noShowTargetAppointment.value.id, 'NO_SHOW');
    noShowDialogVisible.value = false;
  }
}

/**
 * Execute the status mutation (R9.5, R9.6)
 * - Sets pendingStatusId to disable buttons during request
 * - Shows success toast on completion
 * - Shows error toast on failure
 */
async function executeStatusTransition(appointmentId: string, targetStatus: AppointmentStatus): Promise<void> {
  pendingStatusId.value = appointmentId;

  try {
    await statusMutation.mutateAsync({ id: appointmentId, status: targetStatus });
    showSnackbar('Trạng thái đã được cập nhật', 'success');
  } catch (err: unknown) {
    // R9.5: Show error message describing the cause
    const errorResult = err as { message?: string; status?: string };
    let message = 'Cập nhật trạng thái thất bại. Vui lòng thử lại.';

    if (errorResult && typeof errorResult === 'object') {
      if (errorResult.status === 'network') {
        message = 'Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.';
      } else if (errorResult.message) {
        message = errorResult.message;
      }
    }

    showSnackbar(message, 'error');
  } finally {
    pendingStatusId.value = null;
  }
}
</script>

<style scoped>
/**
 * Ensure action buttons meet touch target on mobile.
 */
.v-btn--icon {
  min-height: 36px;
  min-width: 36px;
}
</style>
