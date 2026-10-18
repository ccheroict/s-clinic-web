/**
 * Vue Query composables for Patient CRUD operations
 *
 * Composables built on @tanstack/vue-query that handle:
 * - List/search patients with pagination (size ≤ 20)
 * - Create, update, and delete patients
 * - Loading states (isPending) for disabling controls (R6.8)
 * - Cache invalidation after mutations
 * - Timeout via apiClient (30s default per R9.4)
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.7, 6.8, 9.1, 9.2
 */

import { computed, type Ref } from 'vue';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/vue-query';
import type { Patient, PatientFormInput, Page } from '../domain/types';
import { getApiClient } from '../infra/apiClient';

/** Maximum page size per R6.1, R6.2 */
const MAX_PAGE_SIZE = 20;

/** Query key factory for patients */
export const patientKeys = {
  all: ['patients'] as const,
  lists: () => [...patientKeys.all, 'list'] as const,
  list: (q: string, page: number) => [...patientKeys.lists(), { q, page }] as const,
  details: () => [...patientKeys.all, 'detail'] as const,
  detail: (id: string) => [...patientKeys.details(), id] as const,
};

/**
 * usePatients - Fetch paginated patient list with optional search
 *
 * @param q - Reactive ref for search keyword (empty string = no filter)
 * @param page - Reactive ref for page number (0-based)
 * @returns vue-query query result with Page<Patient> data
 *
 * Requirements: 6.1, 6.2, 9.1, 9.2
 */
export function usePatients(q: Ref<string>, page: Ref<number>) {
  return useQuery<Page<Patient>>({
    queryKey: computed(() => patientKeys.list(q.value, page.value)),
    queryFn: async () => {
      const apiClient = getApiClient();

      const query: Record<string, string | number> = {
        page: page.value,
        size: MAX_PAGE_SIZE,
      };

      // Only add search param if non-empty (R6.2)
      const trimmed = q.value.trim();
      if (trimmed.length > 0) {
        query.q = trimmed;
      }

      const result = await apiClient.get<Page<Patient>>('/patients', query);

      if (result.ok) {
        return result.data;
      }

      // Throw to let vue-query handle error state
      throw result;
    },
  });
}

/**
 * useCreatePatient - Mutation for creating a new patient
 *
 * Exposes `isPending` to disable submit button while waiting (R6.8).
 * Invalidates patient list cache on success.
 *
 * Requirements: 6.3, 6.8
 */
export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation<Patient, unknown, PatientFormInput>({
    mutationFn: async (input: PatientFormInput) => {
      const apiClient = getApiClient();
      const result = await apiClient.post<Patient>('/patients', input);

      if (result.ok) {
        return result.data;
      }

      // Throw error result so vue-query exposes it via `error`
      throw result;
    },
    onSuccess: () => {
      // Invalidate patient list to refetch fresh data
      queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
    },
  });
}

/**
 * useUpdatePatient - Mutation for updating an existing patient
 *
 * Exposes `isPending` to disable submit button while waiting (R6.8).
 * Invalidates patient list and detail cache on success.
 *
 * Requirements: 6.4, 6.8
 */
export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation<Patient, unknown, { id: string; input: PatientFormInput }>({
    mutationFn: async ({ id, input }) => {
      const apiClient = getApiClient();
      const result = await apiClient.put<Patient>(`/patients/${id}`, input);

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
    onSuccess: (_data, variables) => {
      // Invalidate both list and specific detail
      queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: patientKeys.detail(variables.id) });
    },
  });
}

/** A request for temporary access to a patient the doctor does not treat. */
export interface BreakGlassAccess {
  patientId: string;
  /** Required; the server rejects anything shorter than ten characters. */
  reason: string;
}

/**
 * useBreakGlass - Mutation for requesting temporary access to one patient
 *
 * A doctor sees only the patients they treat. When they need a record they have
 * no treating relationship with, this grants time-limited access in exchange for
 * a stated reason. The grant is recorded under its own audit action and the
 * administrators are notified, so it is deliberately easy to do and impossible
 * to do quietly.
 *
 * Invalidates the patient's detail and the list, because both change: the record
 * becomes readable and the patient joins the doctor's list.
 */
export function useBreakGlass() {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, BreakGlassAccess>({
    mutationFn: async ({ patientId, reason }: BreakGlassAccess) => {
      const apiClient = getApiClient();
      const result = await apiClient.post<void>(
        `/patients/${patientId}/break-glass`,
        { reason }
      );

      if (result.ok) {
        return;
      }

      throw result;
    },
    onSuccess: (_data, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: patientKeys.detail(patientId) });
      queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
    },
  });
}

/** What the server needs to withdraw a patient record. */
export interface PatientWithdrawal {
  id: string;
  /** Required; the server rejects a blank reason. */
  reason: string;
}

/**
 * useDeletePatient - Mutation for withdrawing a patient record (ADMIN only)
 *
 * This does not delete anything. The clinic has a statutory duty to keep
 * medical records, so the server marks the record withdrawn and it disappears
 * from the API while the row and its history remain. A reason is mandatory
 * because the decision has to be reviewable afterwards.
 *
 * Exposes `isPending` to disable delete button while waiting (R6.8).
 * Invalidates patient list cache on success.
 *
 * Requirements: 6.7, 6.8
 */
export function useDeletePatient() {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, PatientWithdrawal>({
    mutationFn: async ({ id, reason }: PatientWithdrawal) => {
      const apiClient = getApiClient();
      const result = await apiClient.delete<void>(`/patients/${id}`, { reason });

      if (result.ok) {
        return;
      }

      throw result;
    },
    onSuccess: () => {
      // Invalidate patient list after deletion
      queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
    },
  });
}
