/**
 * Vue Query composables for Appointment CRUD operations
 *
 * Composables built on @tanstack/vue-query that handle:
 * - List/search appointments with pagination and filters (date, doctorId, status)
 * - Create, update appointments
 * - Update appointment status (state machine transitions)
 * - Today's appointments for doctor dashboard
 * - Loading states (isPending) for disabling controls
 * - Cache invalidation after mutations
 * - Timeout via apiClient (30s default per R9.4)
 *
 * Validates: Requirements 4.1, 9.1, 9.5, 10.1
 */

import { computed, type Ref } from 'vue';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/vue-query';
import type {
  Appointment,
  AppointmentCreateInput,
  AppointmentUpdateInput,
  AppointmentFilters,
  AppointmentStatus,
} from '../domain/appointmentTypes';
import type { Page } from '../domain/types';
import { getApiClient } from '../infra/apiClient';

/** Maximum page size */
const MAX_PAGE_SIZE = 20;

/** Query key factory for appointments */
export const appointmentKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentKeys.all, 'list'] as const,
  list: (filters: AppointmentFilters) => [...appointmentKeys.lists(), filters] as const,
  today: (doctorId: string) => [...appointmentKeys.all, 'today', doctorId] as const,
  availableSlots: (doctorId: string, date: string) => [...appointmentKeys.all, 'slots', doctorId, date] as const,
};

/**
 * useAppointments - Fetch paginated appointment list with filters
 *
 * @param filters - Reactive ref for appointment filters (date, doctorId, status, page, size)
 * @returns vue-query query result with Page<Appointment> data
 *
 * Requirements: 4.1, 9.1, 10.1
 */
export function useAppointments(filters: Ref<AppointmentFilters>) {
  return useQuery<Page<Appointment>>({
    queryKey: computed(() => appointmentKeys.list(filters.value)),
    queryFn: async () => {
      const apiClient = getApiClient();

      const query: Record<string, string | number> = {
        page: filters.value.page,
        size: Math.min(filters.value.size, MAX_PAGE_SIZE),
      };

      // Add optional filters if provided
      if (filters.value.date) {
        query.date = filters.value.date;
      }
      if (filters.value.doctorId) {
        query.doctorId = filters.value.doctorId;
      }
      if (filters.value.status) {
        query.status = filters.value.status;
      }

      const result = await apiClient.get<Page<Appointment>>('/appointments', query);

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
  });
}

/**
 * useCreateAppointment - Mutation for creating a new appointment
 *
 * Exposes `isPending` to disable submit button while waiting (R9.5).
 * Invalidates appointment list cache on success.
 *
 * Requirements: 9.1, 9.5
 */
export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation<Appointment, unknown, AppointmentCreateInput>({
    mutationFn: async (input: AppointmentCreateInput) => {
      const apiClient = getApiClient();
      const result = await apiClient.post<Appointment>('/appointments', input);

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
    },
  });
}

/**
 * useUpdateAppointment - Mutation for updating an existing appointment
 *
 * Exposes `isPending` to disable submit button while waiting (R9.5).
 * Invalidates appointment list cache on success.
 *
 * Requirements: 9.1, 9.5
 */
export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation<Appointment, unknown, { id: string; input: AppointmentUpdateInput }>({
    mutationFn: async ({ id, input }) => {
      const apiClient = getApiClient();
      const result = await apiClient.put<Appointment>(`/appointments/${id}`, input);

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
    },
  });
}

/**
 * useUpdateAppointmentStatus - Mutation for changing appointment status
 *
 * Exposes `isPending` to disable status transition buttons while waiting (R9.5).
 * Invalidates appointment list cache on success.
 *
 * Requirements: 9.1, 9.5
 */
export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();

  return useMutation<Appointment, unknown, { id: string; status: AppointmentStatus }>({
    mutationFn: async ({ id, status }) => {
      const apiClient = getApiClient();
      const result = await apiClient.patch<Appointment>(`/appointments/${id}/status`, { status });

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
    },
  });
}

/**
 * useTodayAppointments - Fetch today's appointments for a specific doctor
 *
 * Used for the doctor's daily dashboard (TodayDashboard.vue).
 *
 * Requirements: 10.1
 */
export function useTodayAppointments(doctorId: Ref<string>) {
  return useQuery<Appointment[]>({
    queryKey: computed(() => appointmentKeys.today(doctorId.value)),
    queryFn: async () => {
      const apiClient = getApiClient();

      // Get today's date in YYYY-MM-DD format (local timezone)
      const today = new Date().toISOString().split('T')[0];

      const query: Record<string, string | number> = {
        date: today,
        doctorId: doctorId.value,
        page: 0,
        size: MAX_PAGE_SIZE,
      };

      const result = await apiClient.get<Page<Appointment>>('/appointments', query);

      if (result.ok) {
        return result.data.content;
      }

      throw result;
    },
    enabled: computed(() => !!doctorId.value),
  });
}
