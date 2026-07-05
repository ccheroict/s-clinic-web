/**
 * AuthStore - Pinia store for authentication state
 * 
 * Responsibilities:
 * - Store credentials, role, and authentication status (in-memory only)
 * - Handle login via GET /api/me
 * - Handle logout and session clearing
 * - Auto-logout on 401 event from apiClient
 * 
 * Validates: Requirements 4.3, 4.4, 4.7, 4.7a, 4.8, 5.1, 5.2
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserRole, AuthSession } from '../domain/types';
import { parseRole } from '../domain/roles';
import { getApiClient, AUTH_EXPIRED_EVENT, type ApiCredentials } from '../infra/apiClient';
import { clearSensitive } from '../infra/sessionScrubber';

/**
 * Response from GET /api/me endpoint
 */
interface MeResponse {
  username: string;
  role: string;
}

/**
 * AuthStore - Pinia store for authentication
 */
export const useAuthStore = defineStore('auth', () => {
  // State
  const credentials = ref<ApiCredentials | null>(null);
  const username = ref<string>('');
  const role = ref<UserRole | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const isAuthenticated = computed(() => !!credentials.value && !!role.value);
  
  const authSession = computed<AuthSession | null>(() => {
    if (!credentials.value || !role.value) {
      return null;
    }
    const encoded = btoa(`${credentials.value.username}:${credentials.value.password}`);
    return {
      authHeader: `Basic ${encoded}`,
      username: username.value,
      role: role.value,
    };
  });

  const currentRole = computed(() => role.value);

  // Actions

  /**
   * Set credentials without logging in
   * @param username - Username for authentication
   * @param password - Password for authentication
   */
  function setCredentials(newUsername: string, password: string): void {
    credentials.value = { username: newUsername, password };
    username.value = newUsername;
    error.value = null;
    
    // Set credentials in apiClient
    const apiClient = getApiClient();
    apiClient.setCredentials(credentials.value);
  }

  /**
   * Login by calling GET /api/me to verify credentials and get role
   * @returns Promise<boolean> - true if login successful
   */
  async function login(): Promise<boolean> {
    if (!credentials.value) {
      error.value = 'No credentials set';
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const apiClient = getApiClient();
      const result = await apiClient.login<MeResponse>('/me');

      if (result.ok) {
        // Parse role from response
        const roleResult = parseRole(result.data.role);
        
        if (roleResult.authorized) {
          role.value = roleResult.role;
          username.value = result.data.username;
          return true;
        } else {
          // Role invalid - R5.2: clear session
          clearSession();
          error.value = 'Invalid role from server. Please contact administrator.';
          return false;
        }
      } else {
        // Handle error cases
        if (result.status === 'unauthorized') {
          // R4.4: Invalid credentials - keep username, clear password
          error.value = 'Invalid username or password';
          // Clear password but keep username
          if (credentials.value) {
            credentials.value = { ...credentials.value, password: '' };
            apiClient.setCredentials(credentials.value);
          }
        } else if (result.status === 'network') {
          // R4.5: Network error
          error.value = 'Connection error. Please check your network.';
        } else {
          error.value = 'Login failed. Please try again.';
        }
        
        return false;
      }
    } catch (err) {
      error.value = 'An unexpected error occurred';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Logout - clears session and sensitive data
   * R4.7: Logout clears session and navigates to login
   */
  function logout(): void {
    clearSensitive();
    clearSession();
  }

  /**
   * Clear session without clearing sensitive data
   * Used for internal session management
   */
  function clearSession(): void {
    // Clear state
    credentials.value = null;
    username.value = '';
    role.value = null;
    error.value = null;

    // Clear apiClient credentials
    const apiClient = getApiClient();
    apiClient.clearCredentials();
  }

  /**
   * Setup 401 event listener for auto-logout
   * Called when setting up the application
   */
  function setupAuthExpiredListener(): () => void {
    const handleAuthExpired = () => {
      // R4.8: Auto logout on 401 after having session
      if (credentials.value) {
        clearSensitive();
        clearSession();
      }
    };

    document.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    // Return cleanup function
    return () => {
      document.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }

  return {
    // State
    credentials,
    username,
    role,
    isLoading,
    error,
    // Computed
    isAuthenticated,
    authSession,
    currentRole,
    // Actions
    setCredentials,
    login,
    logout,
    clearSession,
    setupAuthExpiredListener,
  };
});