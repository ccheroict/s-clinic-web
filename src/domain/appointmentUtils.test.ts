/**
 * Tests for appointmentUtils.ts
 *
 * Validates: Requirements 9.4, 10.3
 */

import { describe, it, expect } from 'vitest';
import { computeAvailableSlots, isUpcoming } from './appointmentUtils';
import type { Appointment } from './appointmentTypes';

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: '1',
    patientId: 'p1',
    patientName: 'Test Patient',
    patientPhone: null,
    doctorId: 'd1',
    doctorName: 'Dr. Test',
    scheduledAt: '2024-06-10T09:00:00',
    durationMin: 30,
    status: 'BOOKED',
    reason: null,
    note: null,
    createdAt: '2024-06-01T00:00:00',
    updatedAt: null,
    ...overrides,
  };
}

describe('computeAvailableSlots', () => {
  const testDate = '2024-06-10';

  it('returns all 18 slots (08:00-16:30) when no appointments exist', () => {
    const result = computeAvailableSlots([], testDate);
    expect(result).toHaveLength(18);
    expect(result[0]).toBe('08:00');
    expect(result[result.length - 1]).toBe('16:30');
  });

  it('excludes slot that overlaps with a booked appointment', () => {
    const appointments = [
      makeAppointment({ scheduledAt: '2024-06-10T09:00:00', durationMin: 30 }),
    ];

    const result = computeAvailableSlots(appointments, testDate);
    expect(result).not.toContain('09:00');
    // 08:30 should also be excluded since a 30min slot starting at 08:30 overlaps with 09:00-09:30
    // Actually no: slot 08:30 ends at 09:00, appointment starts at 09:00. Adjacent = no overlap.
    expect(result).toContain('08:30');
    expect(result).toContain('09:30');
  });

  it('excludes multiple slots for longer appointments', () => {
    // 60-minute appointment from 10:00 to 11:00
    const appointments = [
      makeAppointment({ scheduledAt: '2024-06-10T10:00:00', durationMin: 60 }),
    ];

    const result = computeAvailableSlots(appointments, testDate);
    // 10:00 slot (10:00-10:30) overlaps with 10:00-11:00 → excluded
    expect(result).not.toContain('10:00');
    // 10:30 slot (10:30-11:00) overlaps with 10:00-11:00 → excluded
    expect(result).not.toContain('10:30');
    // 09:30 slot (09:30-10:00) adjacent, not overlapping → included
    expect(result).toContain('09:30');
    // 11:00 slot (11:00-11:30) adjacent, not overlapping → included
    expect(result).toContain('11:00');
  });

  it('ignores CANCELLED appointments', () => {
    const appointments = [
      makeAppointment({ scheduledAt: '2024-06-10T09:00:00', durationMin: 30, status: 'CANCELLED' }),
    ];

    const result = computeAvailableSlots(appointments, testDate);
    expect(result).toContain('09:00');
  });

  it('ignores NO_SHOW appointments', () => {
    const appointments = [
      makeAppointment({ scheduledAt: '2024-06-10T09:00:00', durationMin: 30, status: 'NO_SHOW' }),
    ];

    const result = computeAvailableSlots(appointments, testDate);
    expect(result).toContain('09:00');
  });

  it('handles appointments on different dates (ignores them)', () => {
    const appointments = [
      makeAppointment({ scheduledAt: '2024-06-11T09:00:00', durationMin: 30 }),
    ];

    const result = computeAvailableSlots(appointments, testDate);
    // Should not affect today's slots
    expect(result).toContain('09:00');
    expect(result).toHaveLength(18);
  });

  it('handles multiple booked appointments correctly', () => {
    const appointments = [
      makeAppointment({ id: '1', scheduledAt: '2024-06-10T08:00:00', durationMin: 30 }),
      makeAppointment({ id: '2', scheduledAt: '2024-06-10T10:00:00', durationMin: 30 }),
      makeAppointment({ id: '3', scheduledAt: '2024-06-10T14:00:00', durationMin: 60 }),
    ];

    const result = computeAvailableSlots(appointments, testDate);
    expect(result).not.toContain('08:00');
    expect(result).not.toContain('10:00');
    expect(result).not.toContain('14:00');
    expect(result).not.toContain('14:30');
    expect(result).toContain('08:30');
    expect(result).toContain('10:30');
    expect(result).toContain('15:00');
  });

  it('returns empty array when all slots are booked', () => {
    // Fill every 30-min slot from 08:00 to 17:00
    const appointments = [];
    for (let hour = 8; hour < 17; hour++) {
      appointments.push(
        makeAppointment({ id: `${hour}a`, scheduledAt: `2024-06-10T${String(hour).padStart(2, '0')}:00:00`, durationMin: 30 }),
        makeAppointment({ id: `${hour}b`, scheduledAt: `2024-06-10T${String(hour).padStart(2, '0')}:30:00`, durationMin: 30 }),
      );
    }

    const result = computeAvailableSlots(appointments, testDate);
    expect(result).toHaveLength(0);
  });
});

describe('isUpcoming', () => {
  it('returns true when appointment is within 30 minutes', () => {
    const now = new Date('2024-06-10T09:00:00');
    expect(isUpcoming('2024-06-10T09:15:00', now)).toBe(true);
    expect(isUpcoming('2024-06-10T09:30:00', now)).toBe(true);
  });

  it('returns false when appointment is more than 30 minutes away', () => {
    const now = new Date('2024-06-10T09:00:00');
    expect(isUpcoming('2024-06-10T09:31:00', now)).toBe(false);
  });

  it('returns false when appointment is in the past', () => {
    const now = new Date('2024-06-10T09:00:00');
    expect(isUpcoming('2024-06-10T08:59:00', now)).toBe(false);
  });

  it('returns true when appointment is exactly now', () => {
    const now = new Date('2024-06-10T09:00:00');
    expect(isUpcoming('2024-06-10T09:00:00', now)).toBe(true);
  });

  it('returns false for invalid date string', () => {
    expect(isUpcoming('not-a-date')).toBe(false);
  });
});
