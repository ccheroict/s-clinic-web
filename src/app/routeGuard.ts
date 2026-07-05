/**
 * Route Guard - Vue Router Navigation Guard
 * 
 * Responsibilities:
 * - Check Auth_Session before allowing access to protected routes
 * - Redirect to /login when no session exists
 * - Check path-based permissions using canAccessPath
 * - Handle 404 and forbidden cases
 * 
 * Validates: Requirements 4.6, 2.5, 7.4, 7.6
 */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from './authStore';
import { canAccessPath, type ModuleConfig } from '../domain/navConfig';
import type { UserRole } from '../domain/types';

/**
 * Configuration for module navigation
 * This is the source of truth for all navigation items
 */
export const MODULE_CONFIGS: ModuleConfig[] = [
  { 
    id: 'patients', 
    title: 'Bệnh nhân', 
    path: '/patients',
    icon: 'mdi-account-group'
    // No requiredRoles = all authenticated roles allowed
  },
  // Future modules can be added here:
  // { id: 'appointments', title: 'Lịch hẹn', path: '/appointments', requiredRoles: ['DOCTOR', 'RECEPTIONIST', 'ADMIN'] },
  // { id: 'prescriptions', title: 'Đơn thuốc', path: '/prescriptions', requiredRoles: ['DOCTOR', 'ADMIN'] },
  // { id: 'invoices', title: 'Hóa đơn', path: '/invoices', requiredRoles: ['RECEPTIONIST', 'ADMIN'] },
];

/**
 * Paths that require authentication
 * Add any public paths that shouldn't require login here
 */
const PUBLIC_PATHS = ['/login', '/'];

/**
 * Check if a path is public (doesn't require authentication)
 */
function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.includes(path);
}

/**
 * Create the beforeEach navigation guard
 * This guard runs before every navigation and checks:
 * 1. If the user is authenticated (has Auth_Session)
 * 2. If the user has permission to access the target path
 * 
 * @returns Navigation guard function for vue-router
 */
export function createRouteGuard() {
  return async function routeGuard(
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
  ): Promise<void> {
    const authStore = useAuthStore();
    const targetPath = to.path;
    
    // Check if the target path is public
    if (isPublicPath(targetPath)) {
      // If already authenticated and trying to access login, redirect to main
      if (targetPath === '/login' && authStore.isAuthenticated) {
        next({ path: '/patients' });
        return;
      }
      next();
      return;
    }

    // R4.6: If no Auth_Session exists, redirect to login
    if (!authStore.isAuthenticated) {
      // Save the attempted URL for redirecting after login
      next({ 
        path: '/login', 
        query: { redirect: targetPath }
      });
      return;
    }

    // Get the user's role
    const userRole = authStore.currentRole;
    
    // If role is not yet determined but we have credentials, allow navigation
    // The role check will happen when the page loads
    if (!userRole) {
      next();
      return;
    }

    // R7.6: Check if user has permission to access the path
    const accessResult = canAccessPath(MODULE_CONFIGS, targetPath, userRole);
    
    if (!accessResult.allowed) {
      if (accessResult.reason === 'forbidden') {
        // R7.4: Path exists but user doesn't have permission
        // Redirect to a safe page or show forbidden
        next({ path: '/patients' });
        return;
      }
      
      // R2.5, R7.4: Path not found - show 404 page
      next({ path: '/not-found' });
      return;
    }

    // User is authenticated and has permission
    next();
  };
}

/**
 * Check if user can access a specific path (for use in components)
 * This is a helper function for checking permissions programmatically
 * 
 * @param path - Path to check access for
 * @param role - User's role
 * @returns true if access is allowed
 */
export function hasPathAccess(path: string, role: UserRole | null): boolean {
  if (!role) {
    return false;
  }
  const result = canAccessPath(MODULE_CONFIGS, path, role);
  return result.allowed;
}