<template>
  <v-container fluid>
    <!-- Page header -->
    <v-row class="mb-4">
      <v-col>
        <h1 :class="mobile ? 'text-h6' : 'text-h5'">Danh sách bệnh nhân</h1>
      </v-col>
    </v-row>

    <!-- Search bar (R6.2, R6.2a) - responsive column widths -->
    <v-row class="mb-4" :dense="mobile">
      <v-col cols="12" :sm="mobile ? 12 : 8" :md="6">
        <v-text-field
          v-model="searchInput"
          label="Tìm kiếm bệnh nhân"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          :density="mobile ? 'comfortable' : 'compact'"
          clearable
          :error-messages="searchError ? [searchError] : []"
          @keyup.enter="handleSearch"
          @click:clear="handleClearSearch"
        />
      </v-col>
      <v-col cols="12" :sm="mobile ? 12 : 4" :md="2">
        <v-btn
          color="primary"
          variant="elevated"
          :disabled="isSearching"
          :block="mobile"
          class="search-btn"
          @click="handleSearch"
        >
          Tìm kiếm
        </v-btn>
      </v-col>
    </v-row>

    <!-- Non-validation error alert (R6.10) -->
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

    <!-- Data table (R6.1) - responsive density -->
    <v-data-table-server
      :headers="visibleHeaders"
      :items="patients"
      :items-length="totalElements"
      :loading="isFetching"
      :page="currentPage"
      :items-per-page="pageSize"
      :no-data-text="emptyStateText"
      :density="mobile ? 'comfortable' : 'default'"
      @update:page="handlePageChange"
      @update:items-per-page="handlePageSizeChange"
    >
      <!-- Empty state (R6.9) -->
      <template #no-data>
        <v-alert
          type="info"
          variant="tonal"
          class="ma-4"
        >
          {{ emptyStateText }}
        </v-alert>
      </template>

      <!-- Sex column formatting -->
      <template #item.sex="{ item }">
        {{ formatSex(item.sex) }}
      </template>

      <!-- Created date formatting -->
      <template #item.createdAt="{ item }">
        {{ formatDate(item.createdAt) }}
      </template>
    </v-data-table-server>
  </v-container>
</template>

<script setup lang="ts">
/**
 * PatientListPage.vue - Patient list with search and pagination
 *
 * Responsibilities:
 * - Display patient list using v-data-table-server (R6.1)
 * - Search with keyword validation (R6.2, R6.2a)
 * - Pagination with max page size 20 (R6.1, R6.2)
 * - Empty state when no records (R6.9)
 * - Non-validation error display with retry (R6.10)
 *
 * Validates: Requirements 6.1, 6.2, 6.2a, 6.9, 6.10
 */

import { ref, computed, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { usePatients } from '../app/patientQueries';
import { validateSearchKeyword } from '../domain/validators';
import type { Patient } from '../domain/types';

const { mobile, mdAndUp } = useDisplay();

/** Full table headers */
const headers = [
  { title: 'Mã', key: 'code', sortable: false },
  { title: 'Họ tên', key: 'fullName', sortable: false },
  { title: 'Giới tính', key: 'sex', sortable: false },
  { title: 'Điện thoại', key: 'phone', sortable: false },
  { title: 'Ngày tạo', key: 'createdAt', sortable: false },
];

/**
 * Responsive headers (R3.1, R3.4):
 * - Mobile: show only essential columns (name, sex) to prevent horizontal scroll
 * - Tablet: show most columns
 * - Desktop: show all columns
 */
const visibleHeaders = computed(() => {
  if (mobile.value) {
    return headers.filter(h => ['fullName', 'sex', 'phone'].includes(h.key));
  }
  if (!mdAndUp.value) {
    return headers.filter(h => h.key !== 'createdAt');
  }
  return headers;
});

/** Page size - max 20 per R6.1 */
const pageSize = ref(20);

/** Search input (user-facing) */
const searchInput = ref('');

/** Active search query (sent to API) */
const activeQuery = ref('');

/** Current page (1-based for Vuetify, converted to 0-based for API) */
const currentPage = ref(1);

/** Search validation error (R6.2a) */
const searchError = ref('');

/** Non-validation error message (R6.10) */
const errorMessage = ref('');

/** Loading flag for search button */
const isSearching = ref(false);

/** Use patients composable (0-based page for API) */
const apiPage = computed(() => currentPage.value - 1);
const { data, isFetching, error, refetch } = usePatients(activeQuery, apiPage);

/** Computed patient list */
const patients = computed<Patient[]>(() => data.value?.content ?? []);

/** Total elements for pagination */
const totalElements = computed(() => data.value?.totalElements ?? 0);

/** Empty state text (R6.9) */
const emptyStateText = computed(() => {
  if (activeQuery.value) {
    return 'Không có bản ghi phù hợp với từ khóa tìm kiếm';
  }
  return 'Không có bản ghi bệnh nhân nào';
});

/**
 * Watch for query errors and set error message (R6.10)
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
 * Handle search submission (R6.2, R6.2a)
 */
function handleSearch(): void {
  // Clear previous search error
  searchError.value = '';

  // Validate search keyword (R6.2a)
  const validation = validateSearchKeyword(searchInput.value);

  if (!validation.ok) {
    // R6.2a: Show validation error, do NOT send request
    searchError.value = validation.error;
    return;
  }

  // Set active query and reset to first page
  activeQuery.value = validation.value;
  currentPage.value = 1;
  isSearching.value = true;

  // Reset searching state after fetch completes
  watch(isFetching, (fetching) => {
    if (!fetching) {
      isSearching.value = false;
    }
  }, { once: true });
}

/**
 * Handle clearing search
 */
function handleClearSearch(): void {
  searchInput.value = '';
  searchError.value = '';
  activeQuery.value = '';
  currentPage.value = 1;
}

/**
 * Handle page change from data table
 */
function handlePageChange(page: number): void {
  currentPage.value = page;
}

/**
 * Handle page size change (capped at 20)
 */
function handlePageSizeChange(size: number): void {
  pageSize.value = Math.min(size, 20);
  currentPage.value = 1;
}

/**
 * Format sex value for display
 */
function formatSex(sex: string | null): string {
  switch (sex) {
    case 'M': return 'Nam';
    case 'F': return 'Nữ';
    case 'U': return 'Không xác định';
    default: return '';
  }
}

/**
 * Format ISO date for display
 */
function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  try {
    return new Date(isoDate).toLocaleDateString('vi-VN');
  } catch {
    return isoDate;
  }
}
</script>


<style scoped>
/**
 * Ensure search button meets touch target on mobile (R3.5).
 */
.search-btn {
  min-height: 44px;
  min-width: 44px;
}
</style>
