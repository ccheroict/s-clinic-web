/**
 * Unit tests for Appointment vue-query composables
 *
 * Tests:
 * - useAppointments calls API with correct filters
 * - useAppointments returns page data correctly
 * - useCreateAppointment calls POST /appointments with input
 * - useCreateAppointment invalidates list queries on success
 * - useUpdateAppointment calls PUT /appointments/{id} with input
 * - useUpdateAppointmentStatus calls PATCH /appointments/{id}/status
 * - useUpdateAppointmentStatus invalidates list queries on success
 * - useTodayAppointments uses today's date and doctorId
 * - Error cases: mutations throw when API returns error
 *
 * Validates: Requirements 9.5, 9.6
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp, defineComponent } from 'vue';
import {
  useAppointments,
  useCreateAppointment,
  useUpdateAppointment,
  useUpdateAppointmentStatus,
  useTodayAppointments,
  appointmentKeys,
} from './appointmentQueries';
import * as apiClientModule from '../infra/apiClient';
import type { Page } from '../domain/types';
import type { Appointment, AppointmentFilters } from '../domain/appointmentTypes';

// Mock apiClient module
vi.mock('../infra/apiClient', () => {
  const mockApiClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
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
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

const mockAppointment: Appointment = {
  id: 'apt-001',
  patientId: 'patient-001',
  patientName: 'Nguyễn Văn A',
  patientPhone: '0901234567',
  doctorId: 'doctor-001',
  doctorName: 'BS. Trần Văn B',
  scheduledAt: '2024-06-15T09:00:00Z',
  durationMin: 30,
  status: 'BOOKED',
  reason: 'Khám tổng quát',
  note: null,
  createdAt: '2024-06-10T08:00:00Z',
  updatedAt: null,
};

const mockPage: Page<Appointment> = {
  content: [mockAppointment],
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

describe('appointmentKeys', () => {
  it('generates correct query keys', () => {
    expect(appointmentKeys.all).toEqual(['appointments']);
    expect(appointmentKeys.lists()).toEqual(['appointments', 'list']);
    expect(appointmentKeys.list({ page: 0, size: 20 })).toEqual([
      'appointments', 'list', { page: 0, size: 20 },
    ]);
    expect(appointmentKeys.today('doctor-001')).toEqual(['appointments', 'today', 'doctor-001']);
  });
});

describe('useAppointments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls API with correct filters', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const filters = ref<AppointmentFilters>({
      date: '2024-06-15',
      doctorId: 'doctor-001',
      status: 'BOOKED',
      page: 0,
      size: 20,
    });

    withSetup(() => useAppointments(filters));

    await vi.waitFor(() => {
      expect(mock.get).toHaveBeenCalled();
    });

    expect(mock.get).toHaveBeenCalledWith('/appointments', {
      page: 0,
      size: 20,
      date: '2024-06-15',
      doctorId: 'doctor-001',
      status: 'BOOKED',
    });
  });

  it('returns page data correctly', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const filters = ref<AppointmentFilters>({ page: 0, size: 20 });

    const { result } = withSetup(() => useAppointments(filters));

    await vi.waitFor(() => {
      expect(result.data.value).toBeDefined();
    });

    expect(result.data.value).toEqual(mockPage);
    expect(result.data.value!.content).toHaveLength(1);
    expect(result.data.value!.content[0].id).toBe('apt-001');
  });

  it('omits optional filters when not provided', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const filters = ref<AppointmentFilters>({ page: 1, size: 10 });

    withSetup(() => useAppointments(filters));

    await vi.waitFor(() => {
      expect(mock.get).toHaveBeenCalled();
    });

    expect(mock.get).toHaveBeenCalledWith('/appointments', {
      page: 1,
      size: 10,
    });
  });

  it('caps size at 20', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const filters = ref<AppointmentFilters>({ page: 0, size: 50 });

    withSetup(() => useAppointments(filters));

    await vi.waitFor(() => {
      expect(mock.get).toHaveBeenCalled();
    });

    expect(mock.get).toHaveBeenCalledWith('/appointments', {
      page: 0,
      size: 20,
    });
  });
});

describe('useCreateAppointment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /appointments with input', async () => {
    const mock = getMockApiClient();
    mock.post.mockResolvedValue({ ok: true, data: mockAppointment });

    const { result } = withSetup(() => useCreateAppointment());

    result.mutate({
      patientId: 'patient-001',
      doctorId: 'doctor-001',
      scheduledAt: '2024-06-15T09:00:00Z',
      durationMin: 30,
      reason: 'Khám tổng quát',
    });

    await vi.waitFor(() => {
      expect(mock.post).toHaveBeenCalled();
    });

    expect(mock.post).toHaveBeenCalledWith('/appointments', {
      patientId: 'patient-001',
      doctorId: 'doctor-001',
      scheduledAt: '2024-06-15T09:00:00Z',
      durationMin: 30,
      reason: 'Khám tổng quát',
    });
  });

  it('invalidates list queries on success', async () => {
    const mock = getMockApiClient();
    mock.post.mockResolvedValue({ ok: true, data: mockAppointment });

    const { result, queryClient } = withSetup(() => useCreateAppointment());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.mutate({
      patientId: 'patient-001',
      doctorId: 'doctor-001',
      scheduledAt: '2024-06-15T09:00:00Z',
      durationMin: 30,
    });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: appointmentKeys.lists() })
      );
    });
  });

  it('throws error when API returns error', async () => {
    const mock = getMockApiClient();
    const errorResult = { ok: false, status: 'validation', errors: { patientId: ['required'] } };
    mock.post.mockResolvedValue(errorResult);

    const { result } = withSetup(() => useCreateAppointment());

    result.mutate({
      patientId: '',
      scheduledAt: '2024-06-15T09:00:00Z',
      durationMin: 30,
    });

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true);
    });

    expect(result.error.value).toEqual(errorResult);
  });
});

describe('useUpdateAppointment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PUT /appointments/{id} with input', async () => {
    const mock = getMockApiClient();
    const updatedAppointment = { ...mockAppointment, durationMin: 45 };
    mock.put.mockResolvedValue({ ok: true, data: updatedAppointment });

    const { result } = withSetup(() => useUpdateAppointment());

    result.mutate({
      id: 'apt-001',
      input: {
        durationMin: 45,
        note: 'Updated note',
      },
    });

    await vi.waitFor(() => {
      expect(mock.put).toHaveBeenCalled();
    });

    expect(mock.put).toHaveBeenCalledWith('/appointments/apt-001', {
      durationMin: 45,
      note: 'Updated note',
    });
  });

  it('invalidates list queries on success', async () => {
    const mock = getMockApiClient();
    mock.put.mockResolvedValue({ ok: true, data: mockAppointment });

    const { result, queryClient } = withSetup(() => useUpdateAppointment());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.mutate({
      id: 'apt-001',
      input: { note: 'test' },
    });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: appointmentKeys.lists() })
      );
    });
  });

  it('throws error when API returns error', async () => {
    const mock = getMockApiClient();
    const errorResult = { ok: false, status: 'conflict', message: 'Time slot conflict' };
    mock.put.mockResolvedValue(errorResult);

    const { result } = withSetup(() => useUpdateAppointment());

    result.mutate({
      id: 'apt-001',
      input: { scheduledAt: '2024-06-15T10:00:00Z' },
    });

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true);
    });

    expect(result.error.value).toEqual(errorResult);
  });
});

describe('useUpdateAppointmentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PATCH /appointments/{id}/status with status', async () => {
    const mock = getMockApiClient();
    const confirmedAppointment = { ...mockAppointment, status: 'CONFIRMED' };
    mock.patch.mockResolvedValue({ ok: true, data: confirmedAppointment });

    const { result } = withSetup(() => useUpdateAppointmentStatus());

    result.mutate({ id: 'apt-001', status: 'CONFIRMED' });

    await vi.waitFor(() => {
      expect(mock.patch).toHaveBeenCalled();
    });

    expect(mock.patch).toHaveBeenCalledWith('/appointments/apt-001/status', {
      status: 'CONFIRMED',
    });
  });

  it('invalidates list queries on success', async () => {
    const mock = getMockApiClient();
    mock.patch.mockResolvedValue({ ok: true, data: { ...mockAppointment, status: 'CONFIRMED' } });

    const { result, queryClient } = withSetup(() => useUpdateAppointmentStatus());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.mutate({ id: 'apt-001', status: 'CONFIRMED' });

    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: appointmentKeys.lists() })
      );
    });
  });

  it('throws error when API returns invalid transition', async () => {
    const mock = getMockApiClient();
    const errorResult = { ok: false, status: 'validation', message: 'Invalid status transition' };
    mock.patch.mockResolvedValue(errorResult);

    const { result } = withSetup(() => useUpdateAppointmentStatus());

    result.mutate({ id: 'apt-001', status: 'DONE' });

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true);
    });

    expect(result.error.value).toEqual(errorResult);
  });
});

describe('useTodayAppointments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses today\'s date and doctorId', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const doctorId = ref('doctor-001');

    withSetup(() => useTodayAppointments(doctorId));

    const today = new Date().toISOString().split('T')[0];

    await vi.waitFor(() => {
      expect(mock.get).toHaveBeenCalled();
    });

    expect(mock.get).toHaveBeenCalledWith('/appointments', {
      date: today,
      doctorId: 'doctor-001',
      page: 0,
      size: 20,
    });
  });

  it('returns content array from page data', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const doctorId = ref('doctor-001');

    const { result } = withSetup(() => useTodayAppointments(doctorId));

    await vi.waitFor(() => {
      expect(result.data.value).toBeDefined();
    });

    // useTodayAppointments returns page.content (Appointment[])
    expect(result.data.value).toEqual([mockAppointment]);
  });

  it('does not fetch when doctorId is empty', async () => {
    const mock = getMockApiClient();
    mock.get.mockResolvedValue({ ok: true, data: mockPage });

    const doctorId = ref('');

    withSetup(() => useTodayAppointments(doctorId));

    // Give it a tick for any possible async operations
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mock.get).not.toHaveBeenCalled();
  });
});
