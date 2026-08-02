/**
 * Vue Query composables for Doctor list
 *
 * Provides doctor list for appointment form doctor dropdown.
 * Calls GET /api/staff/doctors endpoint.
 *
 * Validates: Requirements 11.1, 11.2
 */

import { useQuery } from '@tanstack/vue-query';
import { getApiClient } from '../infra/apiClient';

/**
 * Doctor summary for dropdown display
 */
export interface DoctorOption {
  id: string;
  fullName: string;
}

/** Query key factory for doctors */
export const doctorKeys = {
  all: ['doctors'] as const,
  list: () => [...doctorKeys.all, 'list'] as const,
};

/**
 * useDoctors - Fetch list of active doctors for form dropdowns
 *
 * @returns vue-query query result with DoctorOption[] data
 *
 * Requirements: 11.1, 11.2
 */
export function useDoctors() {
  return useQuery<DoctorOption[]>({
    queryKey: doctorKeys.list(),
    queryFn: async () => {
      const apiClient = getApiClient();
      const result = await apiClient.get<DoctorOption[]>('/staff/doctors');

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - doctor list rarely changes
  });
}
