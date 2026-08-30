/**
 * Property test for route guard
 * Feature: clinic-frontend-pwa, Property 4: Màn hình cần xác thực yêu cầu phiên đăng nhập
 * 
 * Validates: Requirements 4.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from './authStore';
import { createRouteGuard, MODULE_CONFIGS } from './routeGuard';
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';

// Mock dependencies
vi.mock('../infra/apiClient', () => ({
  getApiClient: () => ({
    setSession: vi.fn(),
    clearSession: vi.fn(),
    get: vi.fn(),
    login: vi.fn(),
  }),
  resetApiClient: vi.fn(),
  AUTH_EXPIRED_EVENT: 'auth-expired',
  createApiClient: vi.fn(),
}));

vi.mock('../infra/sessionScrubber', () => ({
  clearSensitive: vi.fn(),
}));

/**
 * Public paths that don't require authentication (from routeGuard.ts)
 */
const PUBLIC_PATHS = ['/login', '/'];

/**
 * Generator for paths that require authentication:
 * - Not in PUBLIC_PATHS
 * - Start with '/' (valid URL paths)
 * - Non-empty path segment
 */
const authenticatedPathArb = fc.oneof(
  // Paths from MODULE_CONFIGS (known protected paths)
  fc.constantFrom(...MODULE_CONFIGS.map(m => m.path).filter((p): p is string => !!p)),
  // Random paths that start with '/' and are not public
  fc.stringOf(fc.char().filter(c => c !== '/' && c !== '\0' && c.trim() === c), { minLength: 1, maxLength: 30 })
    .map(s => '/' + s)
    .filter(path => !PUBLIC_PATHS.includes(path)),
  // Common protected path patterns
  fc.constantFrom(
    '/patients',
    '/patients/new',
    '/patients/123',
    '/dashboard',
    '/settings',
    '/admin',
    '/reports',
    '/appointments',
    '/prescriptions'
  )
);

describe('Property 4: Màn hình cần xác thực yêu cầu phiên đăng nhập', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  /**
   * Property: For any path that requires authentication, when no Auth_Session exists,
   * the route guard MUST redirect to the login page.
   * 
   * **Validates: Requirements 4.6**
   */
  it('should redirect to /login when no Auth_Session and path requires authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        authenticatedPathArb,
        async (targetPath) => {
          // Setup: fresh Pinia store with NO authentication
          setActivePinia(createPinia());
          const authStore = useAuthStore();

          // Ensure no auth session
          expect(authStore.isAuthenticated).toBe(false);

          // Create route guard
          const routeGuard = createRouteGuard();

          // Create mock route objects
          const to = {
            path: targetPath,
            fullPath: targetPath,
            query: {},
            params: {},
            hash: '',
            matched: [],
            name: undefined,
            redirectedFrom: undefined,
            meta: {},
          } as unknown as RouteLocationNormalized;

          const from = {
            path: '/',
            fullPath: '/',
            query: {},
            params: {},
            hash: '',
            matched: [],
            name: undefined,
            redirectedFrom: undefined,
            meta: {},
          } as unknown as RouteLocationNormalized;

          // Track what next() is called with
          let nextCalledWith: unknown = undefined;
          const next: NavigationGuardNext = ((arg?: unknown) => {
            nextCalledWith = arg;
          }) as NavigationGuardNext;

          // Execute guard
          await routeGuard(to, from, next);

          // Property assertion: must redirect to /login
          expect(nextCalledWith).toBeDefined();
          expect(nextCalledWith).toHaveProperty('path', '/login');

          // Also verify it passes the original path as redirect query param
          if (typeof nextCalledWith === 'object' && nextCalledWith !== null && 'query' in nextCalledWith) {
            const query = (nextCalledWith as { query: Record<string, string> }).query;
            expect(query.redirect).toBe(targetPath);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Public paths should NOT redirect to login (inverse property)
   * This ensures the guard correctly identifies public vs protected paths.
   */
  it('should NOT redirect to login for public paths even without Auth_Session', async () => {
    await fc.assert(
      fc.asyncProperty(
        // '/' is the only non-login public path
        fc.constantFrom('/'),
        async (publicPath) => {
          setActivePinia(createPinia());
          const authStore = useAuthStore();

          expect(authStore.isAuthenticated).toBe(false);

          const routeGuard = createRouteGuard();

          const to = {
            path: publicPath,
            fullPath: publicPath,
            query: {},
            params: {},
            hash: '',
            matched: [],
            name: undefined,
            redirectedFrom: undefined,
            meta: {},
          } as unknown as RouteLocationNormalized;

          const from = {
            path: '/login',
            fullPath: '/login',
            query: {},
            params: {},
            hash: '',
            matched: [],
            name: undefined,
            redirectedFrom: undefined,
            meta: {},
          } as unknown as RouteLocationNormalized;

          let nextCalledWith: unknown = '__not_called__';
          const next: NavigationGuardNext = ((arg?: unknown) => {
            nextCalledWith = arg;
          }) as NavigationGuardNext;

          await routeGuard(to, from, next);

          // Property: public paths should NOT redirect to /login
          if (typeof nextCalledWith === 'object' && nextCalledWith !== null && 'path' in nextCalledWith) {
            expect((nextCalledWith as { path: string }).path).not.toBe('/login');
          }
          // next() called without arguments means allow through - that's valid
        }
      ),
      { numRuns: 100 }
    );
  });
});
