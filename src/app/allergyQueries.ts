/**
 * Vue Query composables for a patient's allergies.
 *
 * Kept out of patientQueries because an allergy list is fetched on its own: the
 * prescribing screen reads it without loading the whole patient record, and
 * folding it into the patient query would make every chart open pay for it.
 *
 * Requirements 10.1, 10.2, 10.4
 */

import { computed, type Ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';

import type { Allergy, AllergyCertainty, AllergySeverity } from '../domain/types';
import { getApiClient } from '../infra/apiClient';
import { patientKeys } from './patientQueries';

export const allergyKeys = {
  all: ['allergies'] as const,
  forPatient: (patientId: string) => [...allergyKeys.all, patientId] as const,
};

/** What the form sends to record an allergy. */
export interface AllergyInput {
  allergenCode: string;
  reaction: string | null;
  severity: AllergySeverity;
  certainty: AllergyCertainty | null;
  recordedOn: string | null;
  note: string | null;
}

/**
 * The live allergies for one patient, worst first.
 *
 * Ordering comes from the backend rather than being redone here: the ranking of
 * severities is a clinical decision, and having it in two places is how the
 * banner and the list end up disagreeing about which allergy matters most.
 *
 * @param patientId null while the route has not resolved; the query waits
 */
export function usePatientAllergies(patientId: Ref<string | null>) {
  return useQuery<Allergy[]>({
    queryKey: computed(() => allergyKeys.forPatient(patientId.value ?? 'none')),
    enabled: computed(() => patientId.value !== null),
    queryFn: async () => {
      const apiClient = getApiClient();
      const result = await apiClient.get<Allergy[]>(
        `/patients/${patientId.value}/allergies`,
      );

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
  });
}

/** Records an allergy. Fails with 409 when the substance is already on file. */
export function useRecordAllergy(patientId: Ref<string | null>) {
  const queryClient = useQueryClient();

  return useMutation<Allergy, unknown, AllergyInput>({
    mutationFn: async (input: AllergyInput) => {
      const apiClient = getApiClient();
      const result = await apiClient.post<Allergy>(
        `/patients/${patientId.value}/allergies`,
        input,
      );

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
    onSuccess: () => {
      invalidate(queryClient, patientId.value);
    },
  });
}

/** Retires a record that turned out to be wrong. Not a delete. */
export function useRetireAllergy(patientId: Ref<string | null>) {
  const queryClient = useQueryClient();

  return useMutation<Allergy, unknown, { allergyId: string; reason: string }>({
    mutationFn: async ({ allergyId, reason }) => {
      const apiClient = getApiClient();
      const result = await apiClient.post<Allergy>(
        `/patients/${patientId.value}/allergies/${allergyId}/retire`,
        { reason },
      );

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
    onSuccess: () => {
      invalidate(queryClient, patientId.value);
    },
  });
}

/**
 * Confirms that the migrated free-text allergies have been read.
 *
 * Invalidates the patient as well as the allergy list, because the flag this
 * clears lives on the patient record and the banner reads it from there.
 */
export function useMarkAllergiesReviewed(patientId: Ref<string | null>) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, void>({
    mutationFn: async () => {
      const apiClient = getApiClient();
      const result = await apiClient.post<void>(
        `/patients/${patientId.value}/allergies/mark-reviewed`,
        {},
      );

      if (result.ok) {
        return;
      }

      throw result;
    },
    onSuccess: () => {
      invalidate(queryClient, patientId.value);
    },
  });
}

/**
 * Both caches, after any change.
 *
 * The allergy list is the obvious one; the patient detail matters because the
 * review flag is a field on it, and leaving it stale means the review banner
 * stays up after the review that cleared it.
 */
function invalidate(
  queryClient: ReturnType<typeof useQueryClient>,
  patientId: string | null,
): void {
  if (patientId === null) {
    return;
  }

  queryClient.invalidateQueries({ queryKey: allergyKeys.forPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: patientKeys.detail(patientId) });
}
