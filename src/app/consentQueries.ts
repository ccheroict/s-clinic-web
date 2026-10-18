/**
 * Vue Query composables for consent.
 *
 * Requirements 11.1–11.7
 */

import { computed, type Ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';

import type {
  ConsentCollectionMethod,
  ConsentRecordView,
  ConsentStatus,
  ConsentTypeCode,
  ConsentVersion,
} from '../domain/types';
import { getApiClient } from '../infra/apiClient';

export const consentKeys = {
  all: ['consents'] as const,
  forPatient: (patientId: string) => [...consentKeys.all, patientId] as const,
  historyFor: (patientId: string) =>
    [...consentKeys.all, patientId, 'history'] as const,
  wording: (type: ConsentTypeCode) => [...consentKeys.all, 'wording', type] as const,
};

export interface ConsentGrantInput {
  type: ConsentTypeCode;
  collectionMethod: ConsentCollectionMethod;
  evidence: string | null;
}

/** Every consent type with this patient's standing on it, missing ones included. */
export function useConsentStatus(patientId: Ref<string | null>) {
  return useQuery<ConsentStatus[]>({
    queryKey: computed(() => consentKeys.forPatient(patientId.value ?? 'none')),
    enabled: computed(() => patientId.value !== null),
    queryFn: async () => {
      const apiClient = getApiClient();
      const result = await apiClient.get<ConsentStatus[]>(
        `/patients/${patientId.value}/consents`,
      );

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
  });
}

/** Everything ever recorded, for proving consent after the fact. */
export function useConsentHistory(patientId: Ref<string | null>, enabled: Ref<boolean>) {
  return useQuery<ConsentRecordView[]>({
    queryKey: computed(() => consentKeys.historyFor(patientId.value ?? 'none')),
    enabled: computed(() => patientId.value !== null && enabled.value),
    queryFn: async () => {
      const apiClient = getApiClient();
      const result = await apiClient.get<ConsentRecordView[]>(
        `/patients/${patientId.value}/consents/history`,
      );

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
  });
}

/**
 * The wording in force for a type, to show the patient before they agree.
 *
 * Fetched per type and only when a form is opened: loading all seven documents
 * to render a checklist would download a great deal of legal text nobody is
 * reading yet.
 */
export function useConsentWording(type: Ref<ConsentTypeCode | null>) {
  return useQuery<ConsentVersion>({
    queryKey: computed(() => consentKeys.wording(type.value ?? 'TREATMENT')),
    enabled: computed(() => type.value !== null),
    queryFn: async () => {
      const apiClient = getApiClient();
      const result = await apiClient.get<ConsentVersion>(
        `/consent-types/${type.value}/current-version`,
      );

      if (result.ok) {
        return result.data;
      }

      throw result;
    },
  });
}

/**
 * Records consent against whatever wording is in force.
 *
 * The caller does not send a version. Letting it would let the client record
 * consent against wording the patient was never shown, which is the thing the
 * whole module exists to prevent.
 */
export function useGrantConsent(patientId: Ref<string | null>) {
  const queryClient = useQueryClient();

  return useMutation<ConsentRecordView, unknown, ConsentGrantInput>({
    mutationFn: async (input: ConsentGrantInput) => {
      const apiClient = getApiClient();
      const result = await apiClient.post<ConsentRecordView>(
        `/patients/${patientId.value}/consents`,
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
    // Also on failure, which is unusual and deliberate. The refusals here are
    // about the patient's standing — no live consent, or no published wording —
    // and both are reported per type by the status endpoint. Re-reading it turns
    // a generic error into the screen explaining what is actually wrong, which
    // matters most for the 503 case, where the server's own explanation is
    // deliberately withheld by the error mapper.
    onError: () => {
      invalidate(queryClient, patientId.value);
    },
  });
}

/** Records a withdrawal. Effective from the moment it is recorded. */
export function useWithdrawConsent(patientId: Ref<string | null>) {
  const queryClient = useQueryClient();

  return useMutation<
    ConsentRecordView,
    unknown,
    { type: ConsentTypeCode; note: string | null }
  >({
    mutationFn: async ({ type, note }) => {
      const apiClient = getApiClient();
      const result = await apiClient.post<ConsentRecordView>(
        `/patients/${patientId.value}/consents/${type}/withdraw`,
        { note },
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

function invalidate(
  queryClient: ReturnType<typeof useQueryClient>,
  patientId: string | null,
): void {
  if (patientId === null) {
    return;
  }

  queryClient.invalidateQueries({ queryKey: consentKeys.forPatient(patientId) });
  queryClient.invalidateQueries({ queryKey: consentKeys.historyFor(patientId) });
}
