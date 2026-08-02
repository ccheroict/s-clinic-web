/**
 * Domain types for Appointment module
 * TypeScript types matching Spring Boot backend AppointmentResponse/Request DTOs
 *
 * Validates: Requirements 5.1, 5.2, 9.1
 */

/**
 * Appointment lifecycle statuses matching backend AppointmentStatus enum
 */
export type AppointmentStatus =
  | 'BOOKED'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELLED'
  | 'NO_SHOW';

/**
 * Appointment data from backend (AppointmentResponse)
 */
export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  doctorId: string | null;
  doctorName: string | null;
  scheduledAt: string; // ISO datetime
  durationMin: number;
  status: AppointmentStatus;
  reason: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Input for creating a new appointment (maps to AppointmentCreateRequest)
 */
export interface AppointmentCreateInput {
  patientId: string;
  doctorId?: string | null;
  scheduledAt: string;
  durationMin?: number;
  reason?: string;
  note?: string;
}

/**
 * Input for updating an existing appointment (maps to AppointmentUpdateRequest)
 */
export interface AppointmentUpdateInput {
  scheduledAt?: string;
  durationMin?: number;
  doctorId?: string | null;
  reason?: string;
  note?: string;
}

/**
 * Filters for listing appointments (query params)
 */
export interface AppointmentFilters {
  date?: string; // YYYY-MM-DD
  doctorId?: string;
  status?: AppointmentStatus;
  page: number;
  size: number;
}

/**
 * Status transition map for frontend validation.
 * Each key maps to the set of valid next statuses.
 * Terminal states (DONE, CANCELLED, NO_SHOW) have empty arrays.
 *
 * Validates: Requirements 5.1, 5.2
 */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  BOOKED: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DONE'],
  DONE: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  current: AppointmentStatus,
  target: AppointmentStatus,
): boolean {
  return STATUS_TRANSITIONS[current].includes(target);
}

/**
 * Get allowed next statuses from a given status
 */
export function getAllowedTransitions(status: AppointmentStatus): AppointmentStatus[] {
  return STATUS_TRANSITIONS[status];
}

/**
 * Check if a status is terminal (no further transitions possible)
 */
export function isTerminalStatus(status: AppointmentStatus): boolean {
  return STATUS_TRANSITIONS[status].length === 0;
}

/**
 * Display configuration for appointment statuses.
 * Used with Vuetify v-chip component (color prop).
 *
 * Validates: Requirements 9.1
 */
export interface StatusDisplayConfig {
  label: string;
  color: string;
}

export const STATUS_DISPLAY: Record<AppointmentStatus, StatusDisplayConfig> = {
  BOOKED: { label: 'Đã đặt', color: 'blue' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'teal' },
  ARRIVED: { label: 'Đã đến', color: 'green' },
  IN_PROGRESS: { label: 'Đang khám', color: 'orange' },
  DONE: { label: 'Hoàn thành', color: 'success' },
  CANCELLED: { label: 'Đã hủy', color: 'error' },
  NO_SHOW: { label: 'Vắng mặt', color: 'grey' },
};

/**
 * Get the display label for a status
 */
export function getStatusLabel(status: AppointmentStatus): string {
  return STATUS_DISPLAY[status].label;
}

/**
 * Get the Vuetify color for a status
 */
export function getStatusColor(status: AppointmentStatus): string {
  return STATUS_DISPLAY[status].color;
}
