// Feature: appointment-booking, Property 14: Upcoming appointment highlight rule
/**
 * Property-based tests for the isUpcoming highlight rule.
 *
 * **Validates: Requirements 10.3**
 *
 * Property 14: For any appointment and a given current time T, the appointment
 * SHALL be highlighted if and only if its scheduledAt falls within the interval
 * [T, T + 30 minutes]. Appointments outside this window SHALL never be highlighted.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { isUpcoming } from './appointmentUtils';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/**
 * Arbitrary that generates a valid Date object within a reasonable range.
 */
const arbDate = fc.date({
  min: new Date('2020-01-01T00:00:00Z'),
  max: new Date('2030-12-31T23:59:59Z'),
});

describe('Property 14: Upcoming appointment highlight rule', () => {
  it('returns true for any scheduledAt within [now, now + 30min]', () => {
    fc.assert(
      fc.property(
        arbDate,
        fc.integer({ min: 0, max: THIRTY_MINUTES_MS }),
        (now, offsetMs) => {
          const scheduledAt = new Date(now.getTime() + offsetMs).toISOString();
          expect(isUpcoming(scheduledAt, now)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns false for any scheduledAt before now', () => {
    fc.assert(
      fc.property(
        arbDate,
        fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }),
        (now, offsetMs) => {
          const scheduledAt = new Date(now.getTime() - offsetMs).toISOString();
          expect(isUpcoming(scheduledAt, now)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns false for any scheduledAt more than 30 min after now', () => {
    fc.assert(
      fc.property(
        arbDate,
        fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }),
        (now, offsetMs) => {
          const scheduledAt = new Date(
            now.getTime() + THIRTY_MINUTES_MS + offsetMs,
          ).toISOString();
          expect(isUpcoming(scheduledAt, now)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns true at exact boundaries: now and now + 30min (inclusive)', () => {
    fc.assert(
      fc.property(arbDate, (now) => {
        const atNow = now.toISOString();
        const atThirty = new Date(
          now.getTime() + THIRTY_MINUTES_MS,
        ).toISOString();

        expect(isUpcoming(atNow, now)).toBe(true);
        expect(isUpcoming(atThirty, now)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
