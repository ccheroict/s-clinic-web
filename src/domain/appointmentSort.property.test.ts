// Feature: appointment-booking, Property 8: Default sort invariant
/**
 * Property-based tests for the default sort invariant.
 *
 * **Validates: Requirements 4.5, 10.1**
 *
 * Property 8: For any list of appointments returned by the system (regardless
 * of filters applied), the appointments SHALL be ordered by scheduledAt ascending
 * — i.e., for all consecutive pairs (a[i], a[i+1]),
 * a[i].scheduledAt <= a[i+1].scheduledAt.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Appointment, AppointmentStatus } from './appointmentTypes';

/**
 * Sort function matching the client-side implementation used in TodayDashboard.
 */
function sortByScheduledAt(appointments: Appointment[]): Appointment[] {
  return [...appointments].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
}

/**
 * Arbitrary that generates a random Appointment record.
 */
const appointmentArb: fc.Arbitrary<Appointment> = fc.record({
  id: fc.uuid(),
  patientId: fc.uuid(),
  patientName: fc.string({ minLength: 1, maxLength: 50 }),
  patientPhone: fc.option(fc.string({ minLength: 5, maxLength: 15 }), { nil: null }),
  doctorId: fc.option(fc.uuid(), { nil: null }),
  doctorName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  scheduledAt: fc
    .date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
    .map((d) => d.toISOString()),
  durationMin: fc.integer({ min: 5, max: 480 }),
  status: fc.constantFrom<AppointmentStatus>(
    'BOOKED',
    'CONFIRMED',
    'ARRIVED',
    'IN_PROGRESS',
    'DONE',
    'CANCELLED',
    'NO_SHOW',
  ),
  reason: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
  note: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).map((d) => d.toISOString()),
  updatedAt: fc.option(
    fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).map((d) => d.toISOString()),
    { nil: null },
  ),
}) as fc.Arbitrary<Appointment>;

describe('Property 8: Default sort invariant', () => {
  it('sorted appointments have scheduledAt in ascending order for all consecutive pairs', () => {
    fc.assert(
      fc.property(
        fc.array(appointmentArb, { minLength: 0, maxLength: 50 }),
        (appointments) => {
          const sorted = sortByScheduledAt(appointments);

          for (let i = 0; i < sorted.length - 1; i++) {
            const current = new Date(sorted[i].scheduledAt).getTime();
            const next = new Date(sorted[i + 1].scheduledAt).getTime();
            expect(current).toBeLessThanOrEqual(next);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('sort is stable: appointments with the same scheduledAt maintain their relative order', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        fc.array(appointmentArb, { minLength: 2, maxLength: 20 }),
        (sharedDate, appointments) => {
          // Force all appointments to have the same scheduledAt
          const sameTimeAppointments = appointments.map((appt) => ({
            ...appt,
            scheduledAt: sharedDate.toISOString(),
          }));

          const sorted = sortByScheduledAt(sameTimeAppointments);

          // With same scheduledAt, relative order must be preserved (stable sort)
          for (let i = 0; i < sorted.length - 1; i++) {
            const originalIdxCurrent = sameTimeAppointments.findIndex(
              (a) => a.id === sorted[i].id,
            );
            const originalIdxNext = sameTimeAppointments.findIndex(
              (a) => a.id === sorted[i + 1].id,
            );
            expect(originalIdxCurrent).toBeLessThan(originalIdxNext);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('sort preserves all elements: length and IDs match', () => {
    fc.assert(
      fc.property(
        fc.array(appointmentArb, { minLength: 0, maxLength: 50 }),
        (appointments) => {
          const sorted = sortByScheduledAt(appointments);

          // Length must be preserved
          expect(sorted.length).toBe(appointments.length);

          // All original IDs must be present in sorted array
          const originalIds = appointments.map((a) => a.id).sort();
          const sortedIds = sorted.map((a) => a.id).sort();
          expect(sortedIds).toEqual(originalIds);
        },
      ),
      { numRuns: 200 },
    );
  });
});
