/**
 * API Client - HTTP client wrapper using fetch
 * 
 * Responsibilities:
 * - Insert Authorization: Basic header
 * - Timeout via AbortController (30s default, 10s for login)
 * - Integrate httpsEnforcer for security
 * - Integrate classifyResponse, parseProblemDetail
 * - Emit 401 event to clear session
 * 
 * Validates: Requirements 4.5, 8.1, 8.2, 9.4, 4.8
 */

import type { ApiResult } from '../domain/types';
import { isApiOk } from '../domain/types';
import { assertHttps } from './httpsEnforcer';
import { classifyResponse, parseProblemDetail, networkError, serverErrorMessage } from '../domain/errorMapper';

// Default timeout: 30 seconds (R9.4)
const DEFAULT_TIMEOUT_MS = 30000;
// Login timeout: 10 seconds (R4.5)
const LOGIN_TIMEOUT_MS = 10000;
// Base URL for API requests
const API_BASE_URL = '/api';

/**
 * Event dispatched when 401 is received after having a session
 * This allows AuthStore to clear session and redirect to login
 */
export const AUTH_EXPIRED_EVENT = 's-clinic:auth-expired';

/**
 * An issued session token.
 *
 * Replaces the previous username/password pair: HTTP Basic put the password on
 * every request and could not be revoked, which is unacceptable for access to
 * health records. The backend now issues an opaque token that it can revoke
 * immediately.
 */
export interface ApiSession {
  token: string;
  expiresAt?: string;
}

/**
 * API request configuration
 */
export interface ApiClientRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean>;
  timeoutMs?: number;
  isLoginRequest?: boolean;
}

/**
 * ApiClient class - wraps fetch for API calls
 */
export class ApiClient {
  private session: ApiSession | null = null;

  /**
   * Set the session token used for subsequent requests.
   * Kept in memory only, never persisted (R8.4).
   */
  setSession(session: ApiSession | null): void {
    this.session = session;
  }

  /**
   * Get the current session
   */
  getSession(): ApiSession | null {
    return this.session;
  }

  /**
   * Clear the session so later requests are unauthenticated
   */
  clearSession(): void {
    this.session = null;
  }

  /**
   * Build the Authorization header value
   */
  private getAuthHeader(): string | undefined {
    if (!this.session) {
      return undefined;
    }
    return `Bearer ${this.session.token}`;
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(path: string, query?: Record<string, string | number | boolean>): string {
    // Ensure path is appended to API_BASE_URL correctly
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const fullPath = `${API_BASE_URL}${normalizedPath}`;
    const url = new URL(fullPath, window.location.origin);
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    
    return url.toString();
  }

  /**
   * Make an API request with timeout and error handling
   */
  async request<T>(request: ApiClientRequest): Promise<ApiResult<T>> {
    const { method, path, body, query, timeoutMs, isLoginRequest } = request;
    
    // Determine timeout: login = 10s, otherwise = 30s
    const timeout = timeoutMs ?? (isLoginRequest ? LOGIN_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
    
    // Build full URL
    const url = this.buildUrl(path, query);
    
    // Assert HTTPS (R8.1, R8.2)
    try {
      assertHttps(url);
    } catch {
      return {
        ok: false,
        status: 'network',
        message: 'Insecure connection. Please use HTTPS.',
      };
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add Authorization header if credentials exist
    const authHeader = this.getAuthHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        credentials: 'same-origin',
      });

      clearTimeout(timeoutId);

      // Handle 401 after having session (R4.8)
      if (response.status === 401 && this.session) {
        // Dispatch event for AuthStore to handle
        this.dispatchAuthExpiredEvent();
      }

      // Check if response is OK (2xx)
      if (response.ok) {
        // For 204 No Content, return empty success
        if (response.status === 204) {
          return { ok: true, data: undefined as T };
        }

        // Parse JSON response
        const data = await response.json();
        return { ok: true, data: data as T };
      }

      // Handle error responses
      // Try to parse response body for error details
      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = undefined;
      }

      return classifyResponse(response.status, responseBody) as ApiResult<T>;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort (timeout) vs other errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        // R4.5: Timeout handling
        return networkError('timeout');
      }

      // Check if offline
      if (!navigator.onLine) {
        return networkError('offline');
      }

      // R4.5: Network error
      return networkError('error');
    }
  }

  /**
   * Dispatch custom event when auth expires (401)
   * This allows other parts of the app (especially AuthStore) to react
   */
  private dispatchAuthExpiredEvent(): void {
    const event = new CustomEvent(AUTH_EXPIRED_EVENT, {
      bubbles: true,
      composed: true,
    });
    document.dispatchEvent(event);
  }

  /**
   * Convenience method for GET requests
   */
  async get<T>(path: string, query?: Record<string, string | number | boolean>): Promise<ApiResult<T>> {
    return this.request<T>({ method: 'GET', path, query });
  }

  /**
   * Convenience method for POST requests
   */
  async post<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>({ method: 'POST', path, body });
  }

  /**
   * Convenience method for PUT requests
   */
  async put<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>({ method: 'PUT', path, body });
  }

  /**
   * Convenience method for PATCH requests
   */
  async patch<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>({ method: 'PATCH', path, body });
  }

  /**
   * Convenience method for DELETE requests
   */
  async delete<T>(path: string): Promise<ApiResult<T>> {
    return this.request<T>({ method: 'DELETE', path });
  }

  /**
   * Login request - POST credentials, shorter timeout (10s per R4.5).
   *
   * Sent unauthenticated: the whole point is to obtain a token.
   */
  async login<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>({
      method: 'POST',
      path,
      body,
      isLoginRequest: true,
      timeoutMs: LOGIN_TIMEOUT_MS,
    });
  }
}

// Singleton instance
let apiClientInstance: ApiClient | null = null;

/**
 * Get or create the singleton ApiClient instance
 */
export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient();
  }
  return apiClientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetApiClient(): void {
  apiClientInstance = null;
}

/**
 * Create a new ApiClient instance (for testing or multiple instances)
 */
export function createApiClient(session?: ApiSession): ApiClient {
  const client = new ApiClient();
  if (session) {
    client.setSession(session);
  }
  return client;
}

export type { ApiResult };