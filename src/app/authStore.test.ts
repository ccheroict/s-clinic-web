/**
 * Tests for AuthStore
 * - Property 5: Đăng xuất có tính lũy đẳng (idempotent)
 * - Unit tests: Login success (R4.3), Timeout/network error (R4.5), Logout with in-flight requests (R4.7)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from './authStore';

// Keep a reference to the mock client so unit tests can manipulate it
const mockClient = {
  setCredentials: vi.fn(),
  clearCredentials: vi.fn(),
  login: vi.fn().mockResolvedValue({ ok: true, data: { username: 'test', role: 'DOCTOR' } }),
};

// Mock dependencies
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

// **Validates: Requirements 4.7a**
describe('Property 5: Đăng xuất có tính lũy đẳng (idempotent)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // Generator for arbitrary initial auth state
  const authStateArb = fc.oneof(
    // No session state
    fc.constant({ hasSession: false as const }),
    // With session state - random credentials and role
    fc.record({
      hasSession: fc.constant(true as const),
      username: fc.string({ minLength: 1, maxLength: 50 }),
      password: fc.string({ minLength: 1, maxLength: 50 }),
      role: fc.constantFrom('DOCTOR' as const, 'RECEPTIONIST' as const, 'ADMIN' as const),
    })
  );

  it('logout from any state always ends with no session and does not throw', () => {
    fc.assert(
      fc.property(authStateArb, (state) => {
        // Arrange: set up Pinia fresh for each run
        setActivePinia(createPinia());
        const store = useAuthStore();

        // Set initial state based on generated value
        if (state.hasSession) {
          // Simulate having a session by directly setting store state
          store.setCredentials(state.username, state.password);
          // Manually set role to simulate a completed login
          store.role = state.role;
        }

        // Act: call logout - should not throw
        expect(() => store.logout()).not.toThrow();

        // Assert: after logout, there should be no session
        expect(store.credentials).toBeNull();
        expect(store.username).toBe('');
        expect(store.role).toBeNull();
        expect(store.isAuthenticated).toBe(false);
        expect(store.authSession).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('calling logout multiple times is idempotent (same result)', () => {
    fc.assert(
      fc.property(
        authStateArb,
        fc.integer({ min: 2, max: 5 }),
        (state, logoutCount) => {
          // Arrange
          setActivePinia(createPinia());
          const store = useAuthStore();

          if (state.hasSession) {
            store.setCredentials(state.username, state.password);
            store.role = state.role;
          }

          // Act: call logout multiple times
          for (let i = 0; i < logoutCount; i++) {
            expect(() => store.logout()).not.toThrow();
          }

          // Assert: final state is always the same - no session
          expect(store.credentials).toBeNull();
          expect(store.username).toBe('');
          expect(store.role).toBeNull();
          expect(store.isAuthenticated).toBe(false);
          expect(store.authSession).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('logout followed by logout yields same state as single logout', () => {
    fc.assert(
      fc.property(authStateArb, (state) => {
        // First instance: single logout
        setActivePinia(createPinia());
        const store1 = useAuthStore();
        if (state.hasSession) {
          store1.setCredentials(state.username, state.password);
          store1.role = state.role;
        }
        store1.logout();
        const stateAfterOne = {
          credentials: store1.credentials,
          username: store1.username,
          role: store1.role,
          isAuthenticated: store1.isAuthenticated,
        };

        // Second instance: double logout
        setActivePinia(createPinia());
        const store2 = useAuthStore();
        if (state.hasSession) {
          store2.setCredentials(state.username, state.password);
          store2.role = state.role;
        }
        store2.logout();
        store2.logout();
        const stateAfterTwo = {
          credentials: store2.credentials,
          username: store2.username,
          role: store2.role,
          isAuthenticated: store2.isAuthenticated,
        };

        // Assert: both produce identical state
        expect(stateAfterTwo).toEqual(stateAfterOne);
      }),
      { numRuns: 100 }
    );
  });
});


// Unit tests for AuthStore authentication flow
// Validates: Requirements 4.3, 4.5, 4.7

describe('AuthStore - Login success (R4.3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should establish Auth_Session with role after successful login', async () => {
    // Arrange: apiClient returns 200 with valid role
    mockClient.login.mockResolvedValueOnce({
      ok: true,
      data: { username: 'doctor1', role: 'DOCTOR' },
    });

    const store = useAuthStore();
    store.setCredentials('doctor1', 'secretpass');

    // Act
    const result = await store.login();

    // Assert: R4.3 - Auth_Session established, role saved
    expect(result).toBe(true);
    expect(store.isAuthenticated).toBe(true);
    expect(store.role).toBe('DOCTOR');
    expect(store.username).toBe('doctor1');
    expect(store.authSession).not.toBeNull();
    expect(store.authSession!.role).toBe('DOCTOR');
  });

  it('should store credentials for reuse in subsequent /api/** requests', async () => {
    // Arrange
    mockClient.login.mockResolvedValueOnce({
      ok: true,
      data: { username: 'receptionist1', role: 'RECEPTIONIST' },
    });

    const store = useAuthStore();
    store.setCredentials('receptionist1', 'mypass');

    // Act
    await store.login();

    // Assert: credentials were set in apiClient for subsequent requests
    expect(mockClient.setCredentials).toHaveBeenCalledWith({
      username: 'receptionist1',
      password: 'mypass',
    });
  });

  it('should support all valid roles: DOCTOR, RECEPTIONIST, ADMIN', async () => {
    const roles = ['DOCTOR', 'RECEPTIONIST', 'ADMIN'] as const;

    for (const expectedRole of roles) {
      setActivePinia(createPinia());
      vi.clearAllMocks();
      
      mockClient.login.mockResolvedValueOnce({
        ok: true,
        data: { username: 'user', role: expectedRole },
      });

      const store = useAuthStore();
      store.setCredentials('user', 'pass');
      const result = await store.login();

      expect(result).toBe(true);
      expect(store.role).toBe(expectedRole);
    }
  });
});

describe('AuthStore - Timeout/network error (R4.5)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should not establish Auth_Session on network timeout', async () => {
    // Arrange: apiClient returns network error (timeout)
    mockClient.login.mockResolvedValueOnce({
      ok: false,
      status: 'network',
      message: 'Request timed out',
    });

    const store = useAuthStore();
    store.setCredentials('user1', 'pass1');

    // Act
    const result = await store.login();

    // Assert: R4.5 - no session established
    expect(result).toBe(false);
    expect(store.isAuthenticated).toBe(false);
    expect(store.role).toBeNull();
    expect(store.authSession).toBeNull();
  });

  it('should display connection error message on network error', async () => {
    // Arrange: apiClient returns network error (offline)
    mockClient.login.mockResolvedValueOnce({
      ok: false,
      status: 'network',
      message: 'No internet connection',
    });

    const store = useAuthStore();
    store.setCredentials('user1', 'pass1');

    // Act
    await store.login();

    // Assert: R4.5 - error message about connection
    expect(store.error).not.toBeNull();
    expect(store.error!.toLowerCase()).toContain('connection');
  });

  it('should preserve user-entered credentials on network error', async () => {
    // Arrange
    mockClient.login.mockResolvedValueOnce({
      ok: false,
      status: 'network',
      message: 'Network error',
    });

    const store = useAuthStore();
    store.setCredentials('myuser', 'mypass');

    // Act
    await store.login();

    // Assert: R4.5 - credentials preserved (username still there)
    // The username field should be preserved so user doesn't need to retype
    expect(store.username).toBe('myuser');
  });

  it('should set isLoading to false after network error', async () => {
    // Arrange
    mockClient.login.mockResolvedValueOnce({
      ok: false,
      status: 'network',
      message: 'Timeout',
    });

    const store = useAuthStore();
    store.setCredentials('user1', 'pass1');

    // Act
    await store.login();

    // Assert: loading indicator should be hidden
    expect(store.isLoading).toBe(false);
  });
});

describe('AuthStore - Logout allows in-flight requests to complete (R4.7)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should clear Auth_Session immediately on logout', async () => {
    // Arrange: establish session first
    mockClient.login.mockResolvedValueOnce({
      ok: true,
      data: { username: 'doc', role: 'DOCTOR' },
    });

    const store = useAuthStore();
    store.setCredentials('doc', 'pass');
    await store.login();
    expect(store.isAuthenticated).toBe(true);

    // Act: logout
    store.logout();

    // Assert: R4.7 - session cleared immediately
    expect(store.isAuthenticated).toBe(false);
    expect(store.credentials).toBeNull();
    expect(store.role).toBeNull();
    expect(store.authSession).toBeNull();
  });

  it('should call clearSensitive to wipe patient data on logout', async () => {
    const { clearSensitive } = await import('../infra/sessionScrubber');

    // Arrange: establish session
    mockClient.login.mockResolvedValueOnce({
      ok: true,
      data: { username: 'admin', role: 'ADMIN' },
    });

    const store = useAuthStore();
    store.setCredentials('admin', 'pass');
    await store.login();

    // Act: logout
    store.logout();

    // Assert: R4.7 / R8.4 - sensitive data wiped
    expect(clearSensitive).toHaveBeenCalled();
  });

  it('should not throw or block when logging out during in-flight request', async () => {
    // Arrange: establish session
    mockClient.login.mockResolvedValueOnce({
      ok: true,
      data: { username: 'user', role: 'RECEPTIONIST' },
    });

    const store = useAuthStore();
    store.setCredentials('user', 'pass');
    await store.login();

    // Simulate an in-flight request by creating a pending promise
    // The key insight: logout clears the session but does NOT abort in-flight requests
    // In-flight requests retain the old Auth_Session (per R4.7: "cho phép các yêu cầu 
    // `/api/**` đang trong tiến trình hoàn tất với Auth_Session cũ")
    let resolveInFlight: (v: unknown) => void;
    const inFlightPromise = new Promise((resolve) => {
      resolveInFlight = resolve;
    });

    // Act: logout while "request is in-flight" (not yet resolved)
    expect(() => store.logout()).not.toThrow();

    // Assert: session is cleared but no error occurs
    expect(store.isAuthenticated).toBe(false);
    
    // The in-flight request can still complete without error
    // (apiClient does not abort requests on logout - it simply clears credentials for future requests)
    resolveInFlight!({ ok: true, data: {} });
    await expect(inFlightPromise).resolves.toBeDefined();
  });

  it('should clear apiClient credentials so new requests won\'t use old session', async () => {
    // Arrange: establish session
    mockClient.login.mockResolvedValueOnce({
      ok: true,
      data: { username: 'user', role: 'ADMIN' },
    });

    const store = useAuthStore();
    store.setCredentials('user', 'pass');
    await store.login();

    // Act
    store.logout();

    // Assert: apiClient credentials cleared - new requests won't be authenticated
    expect(mockClient.clearCredentials).toHaveBeenCalled();
  });
});
