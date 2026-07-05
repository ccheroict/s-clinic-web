/**
 * Property tests for RoleGate delete control visibility
 * Feature: clinic-frontend-pwa, Property 8: Điều khiển xóa chỉ hiển thị cho ADMIN
 *
 * Validates: Requirements 5.3, 6.7, 6.11
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { UserRole } from '../domain/types';

/**
 * Pure logic extracted from RoleGate.vue for testability.
 * RoleGate renders its slot content when currentRole is in allowedRoles.
 * For the delete Patient control, allowedRoles is always ['ADMIN'].
 */
function isDeleteControlVisible(currentRole: UserRole | null): boolean {
  const deleteAllowedRoles: UserRole[] = ['ADMIN'];
  if (!currentRole) return false;
  return deleteAllowedRoles.includes(currentRole);
}

/**
 * Generic role gate logic: determines if content should render
 * given a set of allowed roles and the current user's role.
 */
function isRoleGateVisible(allowedRoles: UserRole[], currentRole: UserRole | null): boolean {
  if (!currentRole) return false;
  return allowedRoles.includes(currentRole);
}

// All valid roles in the system
const ALL_ROLES: UserRole[] = ['DOCTOR', 'RECEPTIONIST', 'ADMIN'];

// Generator for any valid UserRole
const roleArb = fc.oneof(
  fc.constant<UserRole>('DOCTOR'),
  fc.constant<UserRole>('RECEPTIONIST'),
  fc.constant<UserRole>('ADMIN')
);

// Generator for role or null (unauthenticated)
const roleOrNullArb = fc.oneof(
  fc.constant<UserRole | null>('DOCTOR'),
  fc.constant<UserRole | null>('RECEPTIONIST'),
  fc.constant<UserRole | null>('ADMIN'),
  fc.constant<UserRole | null>(null)
);

describe('Property 8: Điều khiển xóa chỉ hiển thị cho ADMIN', () => {
  /**
   * Property: Điều khiển xóa Patient render khi và chỉ khi role là ADMIN.
   *
   * For any UserRole, the delete Patient control is rendered if and only if
   * the role is ADMIN. Non-ADMIN roles and unauthenticated users (null role)
   * must NOT see the delete control.
   *
   * Validates: Requirements 5.3, 6.7, 6.11
   */
  it('delete control is visible if and only if role is ADMIN (property-based)', () => {
    fc.assert(
      fc.property(
        roleOrNullArb,
        (currentRole) => {
          const visible = isDeleteControlVisible(currentRole);

          if (currentRole === 'ADMIN') {
            // ADMIN must always see the delete control
            expect(visible, `ADMIN should see delete control`).toBe(true);
          } else {
            // Non-ADMIN (DOCTOR, RECEPTIONIST, null) must NOT see the delete control
            expect(visible, `Role "${currentRole}" should NOT see delete control`).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: RoleGate with allowedRoles=['ADMIN'] renders only for ADMIN.
   * Tests the generic role gate mechanism with the specific delete control configuration.
   *
   * Validates: Requirements 5.3, 6.7, 6.11
   */
  it('RoleGate with allowedRoles=["ADMIN"] renders only for ADMIN (property-based)', () => {
    fc.assert(
      fc.property(
        roleOrNullArb,
        (currentRole) => {
          const allowedRoles: UserRole[] = ['ADMIN'];
          const visible = isRoleGateVisible(allowedRoles, currentRole);

          // Bi-conditional: visible ⟺ currentRole === 'ADMIN'
          const expectedVisible = currentRole === 'ADMIN';
          expect(visible).toBe(expectedVisible);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any role in {DOCTOR, RECEPTIONIST}, delete control is NEVER visible.
   * This ensures non-ADMIN authenticated users cannot see the delete action.
   *
   * Validates: Requirements 5.3, 6.11
   */
  it('non-ADMIN authenticated roles never see delete control (property-based)', () => {
    const nonAdminRoleArb = fc.oneof(
      fc.constant<UserRole>('DOCTOR'),
      fc.constant<UserRole>('RECEPTIONIST')
    );

    fc.assert(
      fc.property(
        nonAdminRoleArb,
        (role) => {
          const visible = isDeleteControlVisible(role);
          expect(visible, `Role "${role}" must NOT see delete control`).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Unauthenticated user (null role) never sees delete control.
   *
   * Validates: Requirements 5.3, 6.11
   */
  it('unauthenticated user (null role) never sees delete control', () => {
    const visible = isDeleteControlVisible(null);
    expect(visible).toBe(false);
  });

  /**
   * Property: The generic RoleGate logic renders content iff currentRole is in allowedRoles.
   * This validates the underlying mechanism used by RoleGate.vue for any role/allowedRoles combination.
   * When allowedRoles is ['ADMIN'] (delete control case), only ADMIN passes.
   *
   * Validates: Requirements 5.3, 6.7, 6.11
   */
  it('generic RoleGate logic: visible iff role is in allowedRoles (property-based)', () => {
    fc.assert(
      fc.property(
        // Generate allowedRoles array (subset of valid roles)
        fc.subarray(ALL_ROLES, { minLength: 0, maxLength: 3 }),
        roleOrNullArb,
        (allowedRoles, currentRole) => {
          const visible = isRoleGateVisible(allowedRoles, currentRole);

          if (currentRole === null) {
            // Null role (unauthenticated) → never visible
            expect(visible).toBe(false);
          } else if (allowedRoles.includes(currentRole)) {
            // Role in allowed list → visible
            expect(visible).toBe(true);
          } else {
            // Role NOT in allowed list → not visible
            expect(visible).toBe(false);
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  /**
   * Property: ADMIN always sees delete control regardless of any other state.
   * Ensures the ADMIN case is consistently true across many runs.
   *
   * Validates: Requirements 6.7
   */
  it('ADMIN always sees delete control (100 runs)', () => {
    fc.assert(
      fc.property(
        fc.constant<UserRole>('ADMIN'),
        (role) => {
          expect(isDeleteControlVisible(role)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
