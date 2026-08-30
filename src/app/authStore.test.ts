/**
 * Tests for AuthStore (session-token model)
 * - Property 5: Đăng xuất có tính lũy đẳng (idempotent)
 * - Unit tests: Login success (R4.3), auth error (R4.4), network error (R4.5),
 *   logout (R4.7), forced password rotation, second factor
 *
 * jsdom because the 401 auto-logout listener is registered on `document`.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from './authStore';

const mockClient = {
  setSession: vi.fn(),
  clearSession: vi.fn(),
  login: vi.fn(),
  post: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
};

vi.mock('../infra/apiClient', () => {
  return {
    getApiClient: () => mockClient,
    resetApiClient: vi.fn(),
    AUTH_EXPIRED_EVENT: 's-clinic:auth-expired',
  };
});

vi.mock('../infra/sessionScrubber', () => ({
  clearSensitive: vi.fn(),
}));

/** A successful login payload from the backend. */
function loginPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ok: true as const,
    data: {
      token: 'opaque-token',
      scope: 'FULL',
      expiresAt: '2026-08-30T00:00:00Z',
      username: 'doctor1',
      role: 'DOCTOR',
      passwordChangeRequired: false,
      ...overrides,
    },
  };
}

// **Validates: Requirements 4.7a**
describe('Property 5: Đăng xuất có tính lũy đẳng (idempotent)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockClient.post.mockResolvedValue({ ok: true, data: undefined });
  });

  const authStateArb = fc.oneof(
    fc.constant({ hasSession: false as const }),
    fc.record({
      hasSession: fc.constant(true as const),
      token: fc.string({ minLength: 1, maxLength: 50 }),
      username: fc.string({ minLength: 1, maxLength: 50 }),
      role: fc.constantFrom('DOCTOR' as const, 'RECEPTIONIST' as const, 'ADMIN' as const),
    })
  );

  /** Seeds a session without going through the network. */
  function seed(store: ReturnType<typeof useAuthStore>, state: { token: string; username: string; role: 'DOCTOR' | 'RECEPTIONIST' | 'ADMIN' }) {
    store.token = state.token;
    store.username = state.username;
    store.role = state.role;
  }

  it('logout from any state always ends with no session and does not throw', async () => {
    await fc.assert(
      fc.asyncProperty(authStateArb, async (state) => {
        setActivePinia(createPinia());
        const store = useAuthStore();

        if (state.hasSession) {
          seed(store, state);
        }

        await expect(store.logout()).resolves.toBeUndefined();

        expect(store.token).toBeNull();
        expect(store.username).toBe('');
        expect(store.role).toBeNull();
        expect(store.isAuthenticated).toBe(false);
        expect(store.authSession).toBeNull();
      }),
      { numRuns: 50 }
    );
  });

  it('calling logout multiple times is idempotent (same result)', async () => {
    await fc.assert(
      fc.asyncProperty(
        authStateArb,
        fc.integer({ min: 2, max: 5 }),
        async (state, logoutCount) => {
          setActivePinia(createPinia());
          const store = useAuthStore();

          if (state.hasSession) {
            seed(store, state);
          }

          for (let i = 0; i < logoutCount; i++) {
            await expect(store.logout()).resolves.toBeUndefined();
          }

          expect(store.token).toBeNull();
          expect(store.username).toBe('');
          expect(store.role).toBeNull();
          expect(store.isAuthenticated).toBe(false);
          expect(store.authSession).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('logout followed by logout yields same state as single logout', async () => {
    await fc.assert(
      fc.asyncProperty(authStateArb, async (state) => {
        setActivePinia(createPinia());
        const store1 = useAuthStore();
        if (state.hasSession) {
          seed(store1, state);
        }
        await store1.logout();
        const stateAfterOne = {
          token: store1.token,
          username: store1.username,
          role: store1.role,
          isAuthenticated: store1.isAuthenticated,
        };

        setActivePinia(createPinia());
        const store2 = useAuthStore();
        if (state.hasSession) {
          seed(store2, state);
        }
        await store2.logout();
        await store2.logout();
        const stateAfterTwo = {
          token: store2.token,
          username: store2.username,
          role: store2.role,
          isAuthenticated: store2.isAuthenticated,
        };

        expect(stateAfterTwo).toEqual(stateAfterOne);
      }),
      { numRuns: 50 }
    );
  });
});

describe('AuthStore - Login success (R4.3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockClient.post.mockResolvedValue({ ok: true, data: undefined });
  });

  it('should establish Auth_Session with role after successful login', async () => {
    mockClient.login.mockResolvedValueOnce(loginPayload());

    const store = useAuthStore();
    const result = await store.login('doctor1', 'ChungKham2026!');

    expect(result).toBe(true);
    expect(store.isAuthenticated).toBe(true);
    expect(store.role).toBe('DOCTOR');
    expect(store.username).toBe('doctor1');
    expect(store.authSession).not.toBeNull();
    expect(store.authSession!.role).toBe('DOCTOR');
  });

  it('should post credentials to the login endpoint', async () => {
    mockClient.login.mockResolvedValueOnce(loginPayload({ username: 'receptionist1', role: 'RECEPTIONIST' }));

    const store = useAuthStore();
    await store.login('receptionist1', 'LeTanKham2026!');

    expect(mockClient.login).toHaveBeenCalledWith('/auth/login', {
      username: 'receptionist1',
      password: 'LeTanKham2026!',
    });
  });

  it('should hand the token to apiClient for subsequent requests', async () => {
    mockClient.login.mockResolvedValueOnce(loginPayload());

    const store = useAuthStore();
    await store.login('doctor1', 'ChungKham2026!');

    expect(mockClient.setSession).toHaveBeenCalledWith({
      token: 'opaque-token',
      expiresAt: '2026-08-30T00:00:00Z',
    });
  });

  it('should never retain the password', async () => {
    mockClient.login.mockResolvedValueOnce(loginPayload());

    const store = useAuthStore();
    await store.login('doctor1', 'ChungKham2026!');

    // The whole store must not contain the secret anywhere.
    expect(JSON.stringify(store.$state)).not.toContain('ChungKham2026!');
  });

  it('should build a Bearer authorization header, not Basic', async () => {
    mockClient.login.mockResolvedValueOnce(loginPayload());

    const store = useAuthStore();
    await store.login('doctor1', 'ChungKham2026!');

    expect(store.authSession!.authHeader).toBe('Bearer opaque-token');
  });

  it('should support all valid roles: DOCTOR, RECEPTIONIST, ADMIN', async () => {
    const roles = ['DOCTOR', 'RECEPTIONIST', 'ADMIN'] as const;

    for (const expectedRole of roles) {
      setActivePinia(createPinia());
      vi.clearAllMocks();

      mockClient.login.mockResolvedValueOnce(loginPayload({ role: expectedRole }));

      const store = useAuthStore();
      const result = await store.login('user', 'MatKhauManh2026!');

      expect(result).toBe(true);
      expect(store.role).toBe(expectedRole);
    }
  });

  it('should reject an unrecognised role and clear the session (R5.2)', async () => {
    mockClient.login.mockResolvedValueOnce(loginPayload({ role: 'SOMETHING_ELSE' }));

    const store = useAuthStore();
    const result = await store.login('user', 'MatKhauManh2026!');

    expect(result).toBe(false);
    expect(store.isAuthenticated).toBe(false);
    expect(store.token).toBeNull();
    expect(store.error).toContain('Invalid role');
  });
});

describe('AuthStore - Forced password rotation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockClient.post.mockResolvedValue({ ok: true, data: undefined });
  });

  it('should not count as authenticated while a rotation is pending', async () => {
    mockClient.login.mockResolvedValueOnce(
      loginPayload({ scope: 'CHANGE_PASSWORD', passwordChangeRequired: true })
    );

    const store = useAuthStore();
    const result = await store.login('admin', 'MatKhauTam2026!');

    expect(result).toBe(false);
    expect(store.passwordChangeRequired).toBe(true);
    // Holds a token, but it must not be treated as a usable session.
    expect(store.token).toBe('opaque-token');
    expect(store.isAuthenticated).toBe(false);
    expect(store.authSession).toBeNull();
    // Not an error: the credentials were correct.
    expect(store.error).toBeNull();
  });

  it('should become authenticated after changing the password', async () => {
    mockClient.login.mockResolvedValueOnce(
      loginPayload({ scope: 'CHANGE_PASSWORD', passwordChangeRequired: true })
    );
    const store = useAuthStore();
    await store.login('admin', 'MatKhauTam2026!');

    mockClient.post.mockResolvedValueOnce(
      loginPayload({ token: 'fresh-token', username: 'admin', role: 'ADMIN' })
    );

    const changed = await store.changePassword('MatKhauTam2026!', 'MatKhauMoi2027!');

    expect(changed).toBe(true);
    expect(store.passwordChangeRequired).toBe(false);
    expect(store.isAuthenticated).toBe(true);
    expect(store.token).toBe('fresh-token');
  });

  it('should surface the policy message when the new password is rejected', async () => {
    const store = useAuthStore();
    mockClient.post.mockResolvedValueOnce({
      ok: false,
      status: 'validation',
      errors: { _general: ['Password must be at least 12 characters'] },
    });

    const changed = await store.changePassword('MatKhauTam2026!', 'yeu');

    expect(changed).toBe(false);
    expect(store.error).toContain('at least 12 characters');
  });

  it('should report an incorrect current password', async () => {
    const store = useAuthStore();
    mockClient.post.mockResolvedValueOnce({
      ok: false,
      status: 'unauthorized',
      message: 'Current password is incorrect',
    });

    const changed = await store.changePassword('sai-mat-khau', 'MatKhauMoi2027!');

    expect(changed).toBe(false);
    expect(store.error).toContain('Current password');
  });
});

describe('AuthStore - Authentication error (R4.4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should not establish a session on wrong credentials', async () => {
    mockClient.login.mockResolvedValueOnce({
      ok: false,
      status: 'unauthorized',
      message: 'Unauthorized: Please log in again',
    });

    const store = useAuthStore();
    const result = await store.login('user1', 'sai-mat-khau');

    expect(result).toBe(false);
    expect(store.isAuthenticated).toBe(false);
    expect(store.token).toBeNull();
    expect(store.error).toContain('Invalid username or password');
  });

  it('should keep the username so it does not have to be retyped', async () => {
    mockClient.login.mockResolvedValueOnce({
      ok: false,
      status: 'unauthorized',
      message: 'Unauthorized',
    });

    const store = useAuthStore();
    await store.login('myuser', 'sai-mat-khau');

    expect(store.username).toBe('myuser');
  });
});

describe('AuthStore - Timeout/network error (R4.5)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should not establish Auth_Session on network timeout', async () => {
    mockClient.login.mockResolvedValueOnce({
      ok: false,
      status: 'network',
      message: 'Request timed out',
    });

    const store = useAuthStore();
    const result = await store.login('user1', 'MatKhauManh2026!');

    expect(result).toBe(false);
    expect(store.isAuthenticated).toBe(false);
    expect(store.role).toBeNull();
    expect(store.authSession).toBeNull();
  });

  it('should display connection error message on network error', async () => {
    mockClient.login.mockResolvedValueOnce({
      ok: false,
      status: 'network',
      message: 'No internet connection',
    });

    const store = useAuthStore();
    await store.login('user1', 'MatKhauManh2026!');

    expect(store.error).not.toBeNull();
    expect(store.error!.toLowerCase()).toContain('connection');
  });

  it('should preserve the entered username on network error', async () => {
    mockClient.login.mockResolvedValueOnce({
      ok: false,
      status: 'network',
      message: 'Network error',
    });

    const store = useAuthStore();
    await store.login('myuser', 'MatKhauManh2026!');

    expect(store.username).toBe('myuser');
  });

  it('should set isLoading to false after network error', async () => {
    mockClient.login.mockResolvedValueOnce({
      ok: false,
      status: 'network',
      message: 'Timeout',
    });

    const store = useAuthStore();
    await store.login('user1', 'MatKhauManh2026!');

    expect(store.isLoading).toBe(false);
  });
});

describe('AuthStore - Logout (R4.7)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockClient.post.mockResolvedValue({ ok: true, data: undefined });
  });

  async function loggedInStore() {
    mockClient.login.mockResolvedValueOnce(loginPayload());
    const store = useAuthStore();
    await store.login('doc', 'ChungKham2026!');
    return store;
  }

  it('should clear Auth_Session on logout', async () => {
    const store = await loggedInStore();
    expect(store.isAuthenticated).toBe(true);

    await store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(store.token).toBeNull();
    expect(store.role).toBeNull();
    expect(store.authSession).toBeNull();
  });

  it('should ask the server to revoke the token', async () => {
    const store = await loggedInStore();

    await store.logout();

    expect(mockClient.post).toHaveBeenCalledWith('/auth/logout');
  });

  it('should not call the server when there was no session', async () => {
    const store = useAuthStore();

    await store.logout();

    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it('should still clear local state when revocation fails', async () => {
    const store = await loggedInStore();
    mockClient.post.mockRejectedValueOnce(new Error('offline'));

    await store.logout();

    expect(store.token).toBeNull();
    expect(store.isAuthenticated).toBe(false);
  });

  it('should call clearSensitive to wipe patient data on logout', async () => {
    const { clearSensitive } = await import('../infra/sessionScrubber');
    const store = await loggedInStore();

    await store.logout();

    expect(clearSensitive).toHaveBeenCalled();
  });

  it('should clear apiClient session so new requests are unauthenticated', async () => {
    const store = await loggedInStore();

    await store.logout();

    expect(mockClient.clearSession).toHaveBeenCalled();
  });
});

describe('AuthStore - Second factor (TOTP)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockClient.post.mockResolvedValue({ ok: true, data: undefined });
  });

  /** Logs in and lands on the given interim scope. */
  async function loginWithScope(scope: string) {
    mockClient.login.mockResolvedValueOnce(
      loginPayload({ scope, username: 'admin', role: 'ADMIN' })
    );
    const store = useAuthStore();
    const result = await store.login('admin', 'MatKhauManh2026!');
    return { store, result };
  }

  it('should not count as authenticated while enrolment is pending', async () => {
    const { store, result } = await loginWithScope('ENROLL_MFA');

    expect(result).toBe(false);
    expect(store.mfaEnrolmentRequired).toBe(true);
    expect(store.isAuthenticated).toBe(false);
    expect(store.authSession).toBeNull();
    // Correct credentials are not an error.
    expect(store.error).toBeNull();
  });

  it('should not count as authenticated while a challenge is pending', async () => {
    const { store, result } = await loginWithScope('MFA_PENDING');

    expect(result).toBe(false);
    expect(store.mfaVerificationRequired).toBe(true);
    expect(store.isAuthenticated).toBe(false);
    expect(store.error).toBeNull();
  });

  it('should point each interim scope at the screen that clears it', async () => {
    const cases = [
      ['ENROLL_MFA', '/mfa-enroll'],
      ['MFA_PENDING', '/mfa-verify'],
      ['CHANGE_PASSWORD', '/change-password'],
    ] as const;

    for (const [scope, expectedPath] of cases) {
      setActivePinia(createPinia());
      vi.clearAllMocks();

      const { store } = await loginWithScope(scope);

      expect(store.pendingStepPath()).toBe(expectedPath);
    }
  });

  it('should report no pending step once the session is full', async () => {
    mockClient.login.mockResolvedValueOnce(loginPayload());
    const store = useAuthStore();
    await store.login('doctor1', 'ChungKham2026!');

    expect(store.pendingStepPath()).toBeNull();
  });

  it('should request a secret from the enrolment endpoint', async () => {
    const { store } = await loginWithScope('ENROLL_MFA');
    mockClient.post.mockResolvedValueOnce({
      ok: true,
      data: { secret: 'JBSWY3DPEHPK3PXP', provisioningUri: 'otpauth://totp/S-Clinic:admin' },
    });

    const enrolment = await store.beginMfaEnrolment();

    expect(mockClient.post).toHaveBeenCalledWith('/auth/mfa/enroll');
    expect(enrolment!.secret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('should hold the recovery codes returned by a completed enrolment', async () => {
    const { store } = await loginWithScope('ENROLL_MFA');
    mockClient.post.mockResolvedValueOnce({
      ok: true,
      data: {
        session: loginPayload({ token: 'after-enrol', username: 'admin', role: 'ADMIN' }).data,
        backupCodes: ['ABCD234567', 'HJKLMNPQRS'],
      },
    });

    const confirmed = await store.confirmMfaEnrolment('123456');

    expect(confirmed).toBe(true);
    expect(store.backupCodes).toEqual(['ABCD234567', 'HJKLMNPQRS']);
    expect(store.token).toBe('after-enrol');
    expect(store.isAuthenticated).toBe(true);
  });

  it('should keep a password rotation pending after enrolment', async () => {
    const { store } = await loginWithScope('ENROLL_MFA');
    mockClient.post.mockResolvedValueOnce({
      ok: true,
      data: {
        session: loginPayload({
          token: 'after-enrol',
          username: 'admin',
          role: 'ADMIN',
          scope: 'CHANGE_PASSWORD',
          passwordChangeRequired: true,
        }).data,
        backupCodes: ['ABCD234567'],
      },
    });

    await store.confirmMfaEnrolment('123456');

    expect(store.isAuthenticated).toBe(false);
    expect(store.pendingStepPath()).toBe('/change-password');
  });

  it('should drop the recovery codes once acknowledged', async () => {
    const { store } = await loginWithScope('ENROLL_MFA');
    mockClient.post.mockResolvedValueOnce({
      ok: true,
      data: {
        session: loginPayload({ username: 'admin', role: 'ADMIN' }).data,
        backupCodes: ['ABCD234567'],
      },
    });
    await store.confirmMfaEnrolment('123456');

    store.acknowledgeBackupCodes();

    expect(store.backupCodes).toEqual([]);
  });

  it('should reject a wrong enrolment code without issuing codes', async () => {
    const { store } = await loginWithScope('ENROLL_MFA');
    mockClient.post.mockResolvedValueOnce({
      ok: false,
      status: 'unauthorized',
      message: 'Invalid authentication code',
    });

    const confirmed = await store.confirmMfaEnrolment('000000');

    expect(confirmed).toBe(false);
    expect(store.backupCodes).toEqual([]);
    expect(store.error).toContain('Invalid authentication code');
  });

  it('should become authenticated after answering the challenge', async () => {
    const { store } = await loginWithScope('MFA_PENDING');
    mockClient.post.mockResolvedValueOnce(
      loginPayload({ token: 'full-token', username: 'admin', role: 'ADMIN' })
    );

    const verified = await store.verifyMfa('123456');

    expect(mockClient.post).toHaveBeenCalledWith('/auth/mfa/verify', { code: '123456' });
    expect(verified).toBe(true);
    expect(store.isAuthenticated).toBe(true);
    expect(store.token).toBe('full-token');
  });

  it('should keep the pending token after a wrong code so it can be retried', async () => {
    const { store } = await loginWithScope('MFA_PENDING');
    mockClient.post.mockResolvedValueOnce({
      ok: false,
      status: 'unauthorized',
      message: 'Invalid authentication code',
    });

    const verified = await store.verifyMfa('000000');

    expect(verified).toBe(false);
    expect(store.token).toBe('opaque-token');
    expect(store.mfaVerificationRequired).toBe(true);
    expect(store.error).toContain('Invalid authentication code');
  });

  it('should not tear down a half-finished login on a 401', async () => {
    const { store } = await loginWithScope('MFA_PENDING');
    const cleanup = store.setupAuthExpiredListener();

    document.dispatchEvent(new CustomEvent('s-clinic:auth-expired'));

    // A mistyped code answers 401; being thrown back to the password screen for
    // it would be wrong.
    expect(store.token).toBe('opaque-token');
    expect(store.mfaVerificationRequired).toBe(true);
    cleanup();
  });

  it('should tear down a full session on a 401', async () => {
    mockClient.login.mockResolvedValueOnce(loginPayload());
    const store = useAuthStore();
    await store.login('doctor1', 'ChungKham2026!');
    const cleanup = store.setupAuthExpiredListener();

    document.dispatchEvent(new CustomEvent('s-clinic:auth-expired'));

    expect(store.token).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    cleanup();
  });

  it('should clear the scope on logout so no gate looks open', async () => {
    const { store } = await loginWithScope('MFA_PENDING');

    await store.logout();

    expect(store.scope).toBeNull();
    expect(store.mfaVerificationRequired).toBe(false);
    expect(store.mfaEnrolmentRequired).toBe(false);
    expect(store.pendingStepPath()).toBeNull();
  });
});
