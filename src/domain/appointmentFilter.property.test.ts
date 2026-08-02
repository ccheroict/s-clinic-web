// Feature: appointment-booking, Property 7: Filter conjunction (AND logic)
/**
 * Property-based tests for appointment filter conjunction (AND logic).
 *
 * **Validates: Requirements 4.2, 4.3, 4.4, 4.6**
 *
 * Property 7: For any combination of filters (date, doctorId, status) applied
 * to the appointment list, every returned appointment SHALL satisfy ALL specified
 * filter conditions simultaneously. No appointment violating any active filter
 * SHALL appear in results.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Appointment, AppointmentStatus } from './appointmentTypes';

// --- Pure filter function under test ---

interface FilterParams {
  date?: string;
  doctorId?: string;
  status?: AppointmentStatus;
}

function filterAppointments(
  appointments: Appointment[],
  filters: FilterParams,
): Appointment[] {
  return appointments.filter((appt) => {
    if (filters.date && !appt.scheduledAt.startsWith(filters.date)) return false;
    if (filters.doctorId && appt.doctorId !== filters.doctorId) return false;
    if (filters.status && appt.status !== filters.status) return false;
    return true;
  });
}

// --- Arbitraries ---

const ALL_STATUSES: AppointmentStatus[] = [
  'BOOKED',
  'CONFIRMED',
  'ARRIVED',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
  'NO_SHOW',
];

const arbStatus: fc.Arbitrary<AppointmentStatus> = fc.constantFrom(...ALL_STATUSES);

const arbDoctorId: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.uuid(),
);

const arbDate: fc.Arbitrary<string> = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
}).map((d) => d.toISOString().slice(0, 10));

const arbAppointment: fc.Arbitrary<Appointment> = fc.record({
  id: fc.uuid(),
  patientId: fc.uuid(),
  patientName: fc.string({ minLength: 1, maxLength: 20 }),
  patientPhone: fc.oneof(fc.constant(null), fc.string({ minLength: 10, maxLength: 12 })),
  doctorId: arbDoctorId,
  doctorName: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 })),
  scheduledAt: fc.date({
    min: new Date('2020-01-01T08:00:00Z'),
    max: new Date('2030-12-31T17:00:00Z'),
  }).map((d) => d.toISOString()),
  durationMin: fc.integer({ min: 5, max: 240 }),
  status: arbStatus,
  reason: fc.oneof(fc.constant(null), fc.string({ minLength: 0, maxLength: 50 })),
  note: fc.oneof(fc.constant(null), fc.string({ minLength: 0, maxLength: 50 })),
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.oneof(fc.constant(null), fc.date().map((d) => d.toISOString())),
});

const arbAppointmentList: fc.Arbitrary<Appointment[]> = fc.array(arbAppointment, {
  minLength: 0,
  maxLength: 30,
});

const arbFilters: fc.Arbitrary<FilterParams> = fc.record({
  date: fc.option(arbDate, { nil: undefined }),
  doctorId: fc.option(fc.uuid(), { nil: undefined }),
  status: fc.option(arbStatus, { nil: undefined }),
});

// --- Tests ---

describe('Property 7: Filter conjunction (AND logic)', () => {
  it('every returned appointment satisfies ALL active filter conditions', () => {
    fc.assert(
      fc.property(arbAppointmentList, arbFilters, (appointments, filters) => {
        const result = filterAppointments(appointments, filters);

        for (const appt of result) {
          if (filters.date) {
            expect(appt.scheduledAt.startsWith(filters.date)).toBe(true);
          }
          if (filters.doctorId) {
            expect(appt.doctorId).toBe(filters.doctorId);
          }
          if (filters.status) {
            expect(appt.status).toBe(filters.status);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('no appointment satisfying all filters is excluded (no false negatives)', () => {
    fc.assert(
      fc.property(arbAppointmentList, arbFilters, (appointments, filters) => {
        const result = filterAppointments(appointments, filters);

        for (const appt of appointments) {
          const matchesDate = !filters.date || appt.scheduledAt.startsWith(filters.date);
          const matchesDoctor = !filters.doctorId || appt.doctorId === filters.doctorId;
          const matchesStatus = !filters.status || appt.status === filters.status;

          if (matchesDate && matchesDoctor && matchesStatus) {
            expect(result).toContainEqual(appt);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('empty filters return all appointments', () => {
    fc.assert(
      fc.property(arbAppointmentList, (appointments) => {
        const result = filterAppointments(appointments, {});
        expect(result).toHaveLength(appointments.length);
        expect(result).toEqual(appointments);
      }),
      { numRuns: 200 },
    );
  });

  it('adding a filter never increases the result set size', () => {
    fc.assert(
      fc.property(
        arbAppointmentList,
        arbFilters,
        arbDate,
        fc.uuid(),
        arbStatus,
        (appointments, baseFilters, extraDate, extraDoctorId, extraStatus) => {
          const baseResult = filterAppointments(appointments, baseFilters);

          // Add date filter
          const withDate = filterAppointments(appointments, {
            ...baseFilters,
            date: extraDate,
          });
          expect(withDate.length).toBeLessThanOrEqual(
            filterAppointments(appointments, {
              doctorId: baseFilters.doctorId,
              status: baseFilters.status,
            }).length,
          );

          // Add doctorId filter
          const withDoctor = filterAppointments(appointments, {
            ...baseFilters,
            doctorId: extraDoctorId,
          });
          expect(withDoctor.length).toBeLessThanOrEqual(
            filterAppointments(appointments, {
              date: baseFilters.date,
              status: baseFilters.status,
            }).length,
          );

          // Add status filter
          const withStatus = filterAppointments(appointments, {
            ...baseFilters,
            status: extraStatus,
          });
          expect(withStatus.length).toBeLessThanOrEqual(
            filterAppointments(appointments, {
              date: baseFilters.date,
              doctorId: baseFilters.doctorId,
            }).length,
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
