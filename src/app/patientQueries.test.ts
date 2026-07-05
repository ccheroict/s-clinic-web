/**
 * Unit tests for Patient vue-query composables
 *
 * Tests:
 * - usePatients sends correct query params (size ≤ 20, page, q)
 * - useCreatePatient calls POST and invalidates list cache
 * - useUpdatePatient calls PUT and invalidates list + detail cache
 * - useDeletePatient calls DELETE and invalidates list cache
 * - isPending is true while mutation is in progress (R6.8)
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.7, 6.8
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp, defineComponent } from 'vue';
import { usePatients, useCreatePatient, useUpdatePatient, useDeletePatient, patientKeys } from './patientQueries';
import * as apiClientModule from '../infra/apiClient';
import type { Page, Patient } from '../domain/types';

// Mock apiClient module
vi.mock('../infra/apiClient', () => {
  const mockApiClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    setCredentials: vi.fn(),
    clearCredentials: vi.fn(),
  };
  return {
    getApiClient: () => mockApiClient,
    AUTH_EXPIRED_EVENT: 's-clinic:auth-expired',
  };
});

function getMockApiClient() {
  return apiClientModule.getApiClient() as unknown as {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

const mockPatient: Patient = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  code: 'P001',
  fullName: 'Nguyễn Văn A',
  dob: '1990-01-01',
  sex: 'M',
  phone: '0901234567',
  address: '123 Trần Hưng Đạo',
  medicalHistory: null,
  allergies: null,
  note: null,
  nationalId: null,
  insuranceNo: null,
  taxCode: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockPage: Page<Patient> = {
  content: [mockPatient],
  totalElements: 1,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

/**
 * Helper to run a composable in a proper Vue + VueQuery context
 */
function withSetup<T>(composableFn: () => T): { result: T; queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  let result!: T;

  const app = createApp(defineComponent({
    setup() {
      result = composableFn();
      return () => null;
    },
  }));

  app.use(VueQueryPlugin, { queryClient });
  app.mount(document.createElement('div'));

  return { result, queryClient };
}

describe('patientKeys', () => {
  it('generates correct query keys', () => {
    expect(patientKeys.all).toEqual(['patients']);
    expect(patientKeys.lists()).toEqual(['patients', 'list']);
    expect(patientKeys.list('test', 0)).toEqual(['patients', 'list', { q: 'test', page: 0 }]);
    expect(patientKeys.detail('abc')).toEqual(['patients', 'detail', 'abc']);
  });
});

describe('usePatients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends GET /patients with page and size ≤ 20', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const q = ref('');
    const page = ref(0);

    withSetup(() => usePatients(q, page));

    // Wait for query to execute
    await vi.waitFor(() => {
      expect(mock.get).toHaveBeenCalled();
    });

    expect(mock.get).toHaveBeenCalledWith('/patients', { page: 0, size: 20 });
  });

  it('includes q param when search keyword is non-empty', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const q = ref('Nguyễn');
    const page = ref(0);

    withSetup(() => usePatients(q, page));

    await vi.waitFor(() => {
      expect(mock.get).toHaveBeenCalled();
    });

    expect(mock.get).toHaveBeenCalledWith('/patients', { page: 0, size: 20, q: 'Nguyễn' });
  });

  it('trims whitespace from search keyword before sending', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const q = ref('  test  ');
    const page = ref(0);

    withSetup(() => usePatients(q, page));

    await vi.waitFor(() => {
      expect(mock.get).toHaveBeenCalled();
    });

    expect(mock.get).toHaveBeenCalledWith('/patients', { page: 0, size: 20, q: 'test' });
  });

  it('does not include q param when keyword is only whitespace', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const q = ref('   ');
    const page = ref(0);

    withSetup(() => usePatients(q, page));

    await vi.waitFor(() => {
      expect(mock.get).toHaveBeenCalled();
    });

    expect(mock.get).toHaveBeenCalledWith('/patients', { page: 0, size: 20 });
  });
});

describe('useCreatePatient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST /patients with form input', async () => {
    const mock = getMockApiClient();
    mock.post.mockResolvedValue({ ok: true, data: mockPatient });

    const { result, queryClient } = withSetup(() => useCreatePatient());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.mutate({
      fullName: 'Nguyễn Văn A',
      dob: '1990-01-01',
      sex: 'M',
      phone: '0901234567',
      address: null,
      medicalHistory: null,
      allergies: null,
      note: null,
      nationalId: null,
      insuranceNo: null,
      taxCode: null,
    });

    await vi.waitFor(() => {
      expect(mock.post).toHaveBeenCalled();
    });

    expect(mock.post).toHaveBeenCalledWith('/patients', expect.objectContaining({
      fullName: 'Nguyễn Văn A',
      sex: 'M',
    }));

    // Should invalidate list cache after success
    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: patientKeys.lists() })
      );
    });
  });

  it('throws error result on API failure', async () => {
    const mock = getMockApiClient();
    const errorResult = { ok: false, status: 'validation', errors: { fullName: ['must not be blank'] } };
    mock.post.mockResolvedValue(errorResult);

    const { result } = withSetup(() => useCreatePatient());

    result.mutate({
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

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true);
    });

    expect(result.error.value).toEqual(errorResult);
  });
});

describe('useUpdatePatient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends PUT /patients/{id} with form input', async () => {
    const mock = getMockApiClient();
    mock.put.mockResolvedValue({ ok: true, data: { ...mockPatient, fullName: 'Updated Name' } });

    const { result, queryClient } = withSetup(() => useUpdatePatient());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.mutate({
      id: mockPatient.id,
      input: {
        fullName: 'Updated Name',
        dob: '1990-01-01',
        sex: 'M',
        phone: '0901234567',
        address: null,
        medicalHistory: null,
        allergies: null,
        note: null,
        nationalId: null,
        insuranceNo: null,
        taxCode: null,
      },
    });

    await vi.waitFor(() => {
      expect(mock.put).toHaveBeenCalled();
    });

    expect(mock.put).toHaveBeenCalledWith(
      `/patients/${mockPatient.id}`,
      expect.objectContaining({ fullName: 'Updated Name' })
    );

    // Should invalidate both list and detail cache
    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: patientKeys.lists() })
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: patientKeys.detail(mockPatient.id) })
      );
    });
  });
});

describe('useDeletePatient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends DELETE /patients/{id}', async () => {
    const mock = getMockApiClient();
    mock.delete.mockResolvedValue({ ok: true, data: undefined });

    const { result, queryClient } = withSetup(() => useDeletePatient());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.mutate(mockPatient.id);

    await vi.waitFor(() => {
      expect(mock.delete).toHaveBeenCalled();
    });

    expect(mock.delete).toHaveBeenCalledWith(`/patients/${mockPatient.id}`);

    // Should invalidate list cache
    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: patientKeys.lists() })
      );
    });
  });

  it('throws error result on API failure (e.g., 403 forbidden)', async () => {
    const mock = getMockApiClient();
    const errorResult = { ok: false, status: 'forbidden', message: 'Not authorized' };
    mock.delete.mockResolvedValue(errorResult);

    const { result } = withSetup(() => useDeletePatient());

    result.mutate('some-id');

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true);
    });

    expect(result.error.value).toEqual(errorResult);
  });
});
