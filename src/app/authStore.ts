/**
 * AuthStore - Pinia store for authentication state
 *
 * Responsibilities:
 * - Hold the session token, its scope, role and username (in-memory only)
 * - Log in via POST /api/auth/login
 * - Clear the second-factor gate via POST /api/auth/mfa/{enroll,confirm,verify}
 * - Complete a forced password rotation via POST /api/auth/change-password
 * - Log out via POST /api/auth/logout so the server revokes the token
 * - Auto-logout on the 401 event raised by apiClient
 *
 * A login can end on any of four scopes. Only FULL is a usable session; the
 * others mean a gate is still open and the token held is good for nothing but
 * clearing it. The store exposes which gate that is so the router can send the
 * user to the right screen instead of treating it as a failure.
 *
 * The username/password pair is no longer retained. The backend issues an opaque
 * session token which it can revoke immediately; keeping the password around
 * would defeat that. The token is still memory-only, so a reload ends the
 * session (R8.4).
 *
 * Validates: Requirements 4.3, 4.4, 4.7, 4.7a, 4.8, 5.1, 5.2
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserRole, AuthSession, TokenScope, MfaEnrolment } from '../domain/types';
import { parseRole } from '../domain/roles';
import { getApiClient, AUTH_EXPIRED_EVENT } from '../infra/apiClient';
import { clearSensitive } from '../infra/sessionScrubber';

/** Response from the login, MFA and change-password endpoints */
interface LoginResponse {
  token: string;
  scope: TokenScope;
  expiresAt: string;
  username: string;
  role: string;
  passwordChangeRequired: boolean;
}

/** Response from POST /api/auth/mfa/confirm */
interface MfaConfirmResponse {
  session: LoginResponse;
  backupCodes: string[];
}

/**
 * Turns the field-keyed validation errors into one readable line.
 * Password policy failures arrive without a field prefix, so they land under
 * the general key.
 */
function flattenValidationErrors(errors: Record<string, string[]>): string | null {
  const messages = Object.values(errors).flat().filter((m) => m.length > 0);
  return messages.length > 0 ? messages.join('; ') : null;
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const token = ref<string | null>(null);
  const scope = ref<TokenScope | null>(null);
  const expiresAt = ref<string | null>(null);
  const username = ref<string>('');
  const role = ref<UserRole | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * The account proved its password but must set a new one before it can reach
   * any business endpoint. The token held is only good for change-password.
   */
  const passwordChangeRequired = ref(false);

  /**
   * Recovery codes from a just-completed enrolment. The server returns them once
   * and cannot produce them again, so they are held here only long enough for
   * the user to write them down, then dropped.
   */
  const backupCodes = ref<string[]>([]);

  // Computed

  /** Fully authenticated: a token whose scope reaches business endpoints. */
  const isAuthenticated = computed(
    () => !!token.value && !!role.value && scope.value === 'FULL'
  );

  /** The account must answer a second-factor challenge to finish logging in. */
  const mfaVerificationRequired = computed(() => scope.value === 'MFA_PENDING');

  /** The role requires a second factor and the account has not set one up yet. */
  const mfaEnrolmentRequired = computed(() => scope.value === 'ENROLL_MFA');

  const authSession = computed<AuthSession | null>(() => {
    if (!token.value || !role.value || scope.value !== 'FULL') {
      return null;
    }
    return {
      authHeader: `Bearer ${token.value}`,
      username: username.value,
      role: role.value,
    };
  });

  const currentRole = computed(() => role.value);

  // Actions

  /**
   * Applies a login/change-password response to the store and the api client.
   * @returns true when the session is fully usable
   */
  function applyLoginResponse(data: LoginResponse): boolean {
    const roleResult = parseRole(data.role);

    if (!roleResult.authorized) {
      // R5.2: an unrecognised role must not yield a usable session.
      clearSession();
      error.value = 'Invalid role from server. Please contact administrator.';
      return false;
    }

    token.value = data.token;
    scope.value = data.scope;
    expiresAt.value = data.expiresAt;
    username.value = data.username;
    role.value = roleResult.role;
    passwordChangeRequired.value = data.passwordChangeRequired;

    getApiClient().setSession({ token: data.token, expiresAt: data.expiresAt });

    return data.scope === 'FULL';
  }

  /** The screen the current scope has to pass through next. */
  function pendingStepPath(): string | null {
    switch (scope.value) {
      case 'ENROLL_MFA':
        return '/mfa-enroll';
      case 'MFA_PENDING':
        return '/mfa-verify';
      case 'CHANGE_PASSWORD':
        return '/change-password';
      default:
        return null;
    }
  }

  /**
   * Exchange credentials for a session token.
   *
   * @returns true when fully logged in. Returns false when a password rotation
   *          is required; check `passwordChangeRequired` to route the user to
   *          the change-password screen rather than treating it as an error.
   */
  async function login(user: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await getApiClient().login<LoginResponse>('/auth/login', {
        username: user,
        password,
      });

      if (result.ok) {
        return applyLoginResponse(result.data);
      }

      if (result.status === 'unauthorized') {
        // R4.4: keep the username on screen, never hint at which part was wrong.
        error.value = 'Invalid username or password';
        username.value = user;
      } else if (result.status === 'network') {
        // R4.5
        error.value = 'Connection error. Please check your network.';
        username.value = user;
      } else {
        error.value = 'Login failed. Please try again.';
      }
      return false;
    } catch {
      error.value = 'An unexpected error occurred';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Ask the server for a TOTP secret to show as a QR code.
   *
   * Safe to call again: the server reissues a fresh secret while the enrolment
   * is unconfirmed, so a failed scan is recoverable.
   */
  async function beginMfaEnrolment(): Promise<MfaEnrolment | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await getApiClient().post<MfaEnrolment>('/auth/mfa/enroll');

      if (result.ok) {
        return result.data;
      }

      error.value = result.status === 'network'
        ? 'Connection error. Please check your network.'
        : 'Could not start two-factor setup. Please log in again.';
      return null;
    } catch {
      error.value = 'An unexpected error occurred';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Prove the authenticator app works and finish enrolment.
   *
   * On success the recovery codes land in `backupCodes` and the session moves on
   * to whatever gate remains, so the caller must show the codes before routing.
   */
  async function confirmMfaEnrolment(code: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await getApiClient().post<MfaConfirmResponse>('/auth/mfa/confirm', { code });

      if (result.ok) {
        backupCodes.value = result.data.backupCodes;
        applyLoginResponse(result.data.session);
        // True means "enrolment done", not "session usable": a password rotation
        // may still be pending.
        return true;
      }

      error.value = mfaErrorMessage(result.status);
      return false;
    } catch {
      error.value = 'An unexpected error occurred';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Answer the login-time challenge with a TOTP or a recovery code.
   *
   * @returns true when the session is now fully usable
   */
  async function verifyMfa(code: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await getApiClient().post<LoginResponse>('/auth/mfa/verify', { code });

      if (result.ok) {
        return applyLoginResponse(result.data);
      }

      error.value = mfaErrorMessage(result.status);
      return false;
    } catch {
      error.value = 'An unexpected error occurred';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * A wrong code and an expired interim token both come back 401, and the
   * message stays vague on purpose: a wrong code counts toward the lockout, so
   * it must not be distinguishable from a stale session.
   */
  function mfaErrorMessage(status: string): string {
    if (status === 'network') {
      return 'Connection error. Please check your network.';
    }
    if (status === 'unauthorized') {
      return 'Invalid authentication code';
    }
    return 'Could not verify the code. Please try again.';
  }

  /** Drop the recovery codes once the user confirms they have saved them. */
  function acknowledgeBackupCodes(): void {
    backupCodes.value = [];
  }

  /**
   * Complete a password change. On success the server revokes every other
   * session and issues a fresh full-scope token, which is applied here.
   */
  async function changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await getApiClient().post<LoginResponse>('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      if (result.ok) {
        return applyLoginResponse(result.data);
      }

      if (result.status === 'validation') {
        // The server names the policy rule that failed, as a ProblemDetail
        // without a field prefix, so it lands under the general key.
        error.value = flattenValidationErrors(result.errors)
          ?? 'Password does not meet the policy';
      } else if (result.status === 'unauthorized') {
        error.value = 'Current password is incorrect';
      } else if (result.status === 'network') {
        error.value = 'Connection error. Please check your network.';
      } else {
        error.value = 'Could not change password. Please try again.';
      }
      return false;
    } catch {
      error.value = 'An unexpected error occurred';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Log out. Tells the server to revoke the token, then clears local state.
   *
   * Local state is cleared even if the network call fails: the user asked to be
   * logged out of this device, and the token expires server-side anyway.
   * R4.7 / R4.7a: idempotent, never throws.
   */
  async function logout(): Promise<void> {
    const hadToken = !!token.value;

    clearSensitive();

    if (hadToken) {
      try {
        await getApiClient().post('/auth/logout');
      } catch {
        // Best effort; local state is cleared regardless.
      }
    }

    clearSession();
  }

  /** Clear local session state without calling the server. */
  function clearSession(): void {
    token.value = null;
    scope.value = null;
    expiresAt.value = null;
    username.value = '';
    role.value = null;
    passwordChangeRequired.value = false;
    backupCodes.value = [];
    error.value = null;

    getApiClient().clearSession();
  }

  /**
   * React to a 401 raised after a session existed (R4.8).
   *
   * Only a full session is torn down. During a half-finished login a 401 is the
   * normal answer to a mistyped code, and dropping the interim token would send
   * the user back to the password screen for a typo; those screens surface the
   * error themselves and let the user retry.
   *
   * @returns a cleanup function that removes the listener
   */
  function setupAuthExpiredListener(): () => void {
    const handleAuthExpired = () => {
      if (token.value && scope.value === 'FULL') {
        clearSensitive();
        clearSession();
      }
    };

    document.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    return () => {
      document.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }

  return {
    // State
    token,
    scope,
    expiresAt,
    username,
    role,
    isLoading,
    error,
    passwordChangeRequired,
    backupCodes,
    // Computed
    isAuthenticated,
    mfaVerificationRequired,
    mfaEnrolmentRequired,
    authSession,
    currentRole,
    // Actions
    login,
    beginMfaEnrolment,
    confirmMfaEnrolment,
    verifyMfa,
    acknowledgeBackupCodes,
    changePassword,
    logout,
    clearSession,
    pendingStepPath,
    setupAuthExpiredListener,
  };
});
