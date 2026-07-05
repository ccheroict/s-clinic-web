/**
 * Role parsing utilities
 * Pure functions for parsing and validating user roles from backend data
 */

import type { UserRole } from './types';

/**
 * Valid roles that can be authorized
 */
const VALID_ROLES: UserRole[] = ['DOCTOR', 'RECEPTIONIST', 'ADMIN'];

/**
 * Result of role parsing
 */
export interface ParseRoleResult {
  authorized: true;
  role: UserRole;
}

export interface UnauthorizedResult {
  authorized: false;
}

/**
 * Parses role data from backend and determines authorization status.
 * Returns authorized result with the role if valid, otherwise returns unauthorized.
 * 
 * @param role - The role value from backend (unknown type)
 * @returns ParseRoleResult if role is valid (DOCTOR, RECEPTIONIST, or ADMIN), UnauthorizedResult otherwise
 * 
 * @example
 * parseRole('DOCTOR') // { authorized: true, role: 'DOCTOR' }
 * parseRole('ADMIN')  // { authorized: true, role: 'ADMIN' }
 * parseRole('INVALID') // { authorized: false }
 * parseRole(null)      // { authorized: false }
 * parseRole(undefined) // { authorized: false }
 */
export function parseRole(role: unknown): ParseRoleResult | UnauthorizedResult {
  if (typeof role !== 'string') {
    return { authorized: false };
  }

  const normalizedRole = role.toUpperCase() as UserRole;

  if (VALID_ROLES.includes(normalizedRole)) {
    return { authorized: true, role: normalizedRole };
  }

  return { authorized: false };
}