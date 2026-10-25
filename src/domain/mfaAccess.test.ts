import { describe, expect, it } from 'vitest';

import { classifyResponse } from './errorMapper';
import type { ApiConflict, ApiResult, ApiUnauthorized, TokenScope } from './types';

/**
 * Who may open the second-factor screens, and what the server's refusals mean.
 *
 * The rules themselves are one-liners; what they are worth testing for is the
 * two cases that were wrong. Setup was gated on holding an ENROLL_MFA token,
 * which locked out the one group that would ever choose it voluntarily. And a
 * 409 from the server came back as a generic error, so "this account already has
 * a second factor" reached the user as "an error occurred".
 */

/** Mirrors authStore.canSetUpMfa, which is a computed over the same inputs. */
function canSetUpMfa(scope: TokenScope | null, hasRole: boolean): boolean {
  const enrolmentRequired = scope === 'ENROLL_MFA';
  const fullyAuthenticated = scope === 'FULL' && hasRole;
  return enrolmentRequired || fullyAuthenticated;
}

function isConflict(result: ApiResult<unknown>): result is ApiConflict {
  return !result.ok && result.status === 'conflict';
}

function isUnauthorized(result: ApiResult<unknown>): result is ApiUnauthorized {
  return !result.ok && result.status === 'unauthorized';
}

describe('canSetUpMfa', () => {
  it('allows an account the login flow parked at enrolment', () => {
    expect(canSetUpMfa('ENROLL_MFA', true)).toBe(true);
  });

  it('allows someone already signed in to set a factor up voluntarily', () => {
    // The case that was blocked. The server accepted a full token all along, so
    // the only thing stopping a receptionist from turning on a second factor was
    // this screen redirecting them — and nothing in the login flow would ever
    // bring them here, because their role does not require one.
    expect(canSetUpMfa('FULL', true)).toBe(true);
  });

  it('refuses a half-finished login that is not at the enrolment step', () => {
    // A pending second factor or a forced password change means the account has
    // not finished proving itself; neither is a position to add a factor from.
    expect(canSetUpMfa('MFA_PENDING', true)).toBe(false);
    expect(canSetUpMfa('CHANGE_PASSWORD', true)).toBe(false);
  });

  it('refuses an unauthenticated visitor', () => {
    expect(canSetUpMfa(null, false)).toBe(false);
    // A full scope with no role is not a usable session, so it is not one to
    // enrol from either.
    expect(canSetUpMfa('FULL', false)).toBe(false);
  });
});

describe('409 from the second-factor endpoints', () => {
  it('keeps the server wording', () => {
    const result = classifyResponse(409, {
      detail: 'Tài khoản đã có yếu tố xác thực thứ hai.',
    });

    // It explains that the factor cannot be replaced, which is deliberate: if a
    // full session could swap it out, the factor would be worth nothing against
    // session theft. A generic error would send the user round a loop that
    // changes nothing.
    expect(isConflict(result)).toBe(true);
    expect(isConflict(result) && result.message).toContain('yếu tố xác thực');
  });

  it('falls back to a usable sentence when the server sent no detail', () => {
    const result = classifyResponse(409, {});

    expect(isConflict(result)).toBe(true);
    expect(isConflict(result) && result.message.length).toBeGreaterThan(0);
  });

  it('is no longer collapsed into a server error', () => {
    // Before this, 409 fell through to the catch-all and became
    // "An error occurred. Please try again later." — which is both wrong about
    // whose fault it is and useless about what to do.
    const result = classifyResponse(409, { detail: 'Đã có' });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.status).not.toBe('server');
  });
});

describe('401 from the recovery-code reissue', () => {
  it('does not distinguish a wrong code from having no second factor', () => {
    // Both come back 401 with no reason, and the screen answers both the same
    // way. Wrong codes here count toward the lockout, so this endpoint must not
    // become a place to tell a right code from a wrong one.
    const wrongCode = classifyResponse(401, { detail: 'Invalid authentication code' });
    const noFactor = classifyResponse(401, {
      detail: 'Two-factor authentication is not set up',
    });

    expect(isUnauthorized(wrongCode)).toBe(true);
    expect(isUnauthorized(noFactor)).toBe(true);
    expect(isUnauthorized(wrongCode) && wrongCode.message)
      .toEqual(isUnauthorized(noFactor) ? noFactor.message : null);
  });

  it('still carries an expired session apart from the rest', () => {
    const expired = classifyResponse(401, { reason: 'SESSION_EXPIRED' });

    // The one 401 distinction worth making: the token the caller holds has run
    // out, and the fix is to log in again rather than to re-read a code.
    expect(isUnauthorized(expired) && expired.reason).toBe('SESSION_EXPIRED');
  });
});
