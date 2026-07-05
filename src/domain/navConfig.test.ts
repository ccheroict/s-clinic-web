/**
 * Property tests for navigation configuration
 * Feature: clinic-frontend-pwa, Property 7: Điều hướng chỉ hiển thị mục phù hợp vai trò
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { visibleNavItems, canAccessPath, buildNavModel, MAX_MODULES } from './navConfig';
import type { ModuleConfig, UserRole } from './types';

describe('Property 7: Điều hướng chỉ hiển thị mục phù hợp vai trò', () => {
  const validRoles: UserRole[] = ['DOCTOR', 'RECEPTIONIST', 'ADMIN'];

  /**
   * Property: visibleNavItems chỉ trả về các module phù hợp với role
   * 
   * For any danh sách cấu hình module và bất kỳ UserRole nào, tập mục điều hướng 
   * do visibleNavItems trả về chỉ chứa các module cho phép vai trò đó, và loại bỏ 
   * hoàn toàn mọi module không cho phép vai trò đó.
   * 
   * Validates: Requirements 5.5, 7.5
   */
  it('should only return modules allowed for the given role - property-based', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            title: fc.string({ minLength: 1 }),
            route: fc.string({ minLength: 1 }),
            requiredRoles: fc.oneof(
              fc.constant(undefined as undefined),
              fc.constant([] as UserRole[]),
              fc.array(fc.oneof(
                fc.constant('DOCTOR'),
                fc.constant('RECEPTIONIST'),
                fc.constant('ADMIN')
              ), { minLength: 1, maxLength: 3 })
            ),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.oneof(
          fc.constant('DOCTOR' as UserRole),
          fc.constant('RECEPTIONIST' as UserRole),
          fc.constant('ADMIN' as UserRole)
        ),
        (configs, role) => {
          const visible = visibleNavItems(configs, role);
          
          // Property: every returned item must be allowed for this role
          for (const item of visible) {
            if (item.requiredRoles && item.requiredRoles.length > 0) {
              const isAllowed = item.requiredRoles.includes(role);
              if (!isAllowed) {
                throw new Error(`Item "${item.id}" with roles [${item.requiredRoles.join(', ')}] should NOT be visible for role ${role}`);
              }
            }
            // If requiredRoles is undefined or empty, all roles can access - this is OK
          }
          
          // Property: items NOT in the result must NOT allow this role
          const visibleIds = new Set(visible.map(item => item.id));
          for (const config of configs) {
            if (!visibleIds.has(config.id) && config.requiredRoles && config.requiredRoles.length > 0) {
              const isExcluded = !config.requiredRoles.includes(role);
              if (!isExcluded) {
                throw new Error(`Item "${config.id}" with roles [${config.requiredRoles.join(', ')}] should be visible for role ${role} but was not returned`);
              }
            }
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  /**
   * Property: All items without requiredRoles should be visible to all authenticated roles
   */
  it('should return all items without role restrictions to any authenticated role', () => {
    const configsWithoutRestrictions: ModuleConfig[] = [
      { id: 'dashboard', title: 'Dashboard', route: '/dashboard' },
      { id: 'patients', title: 'Patients', route: '/patients' },
      { id: 'reports', title: 'Reports', route: '/reports' },
    ];

    validRoles.forEach((role) => {
      const visible = visibleNavItems(configsWithoutRestrictions, role);
      expect(visible.length).toBe(3);
      expect(visible.map(i => i.id).sort()).toEqual(['dashboard', 'patients', 'reports']);
    });
  });

  /**
   * Property: Items with requiredRoles matching the role should be visible
   */
  it('should include items that explicitly allow the role', () => {
    const configs: ModuleConfig[] = [
      { id: 'doctor-only', title: 'Doctor Only', route: '/doctor', requiredRoles: ['DOCTOR'] },
      { id: 'admin-only', title: 'Admin Only', route: '/admin', requiredRoles: ['ADMIN'] },
      { id: 'both', title: 'Both', route: '/both', requiredRoles: ['DOCTOR', 'ADMIN'] },
      { id: 'none', title: 'None', route: '/none', requiredRoles: [] },
    ];

    const doctorVisible = visibleNavItems(configs, 'DOCTOR');
    expect(doctorVisible.find(i => i.id === 'doctor-only')).toBeDefined();
    expect(doctorVisible.find(i => i.id === 'both')).toBeDefined();
    expect(doctorVisible.find(i => i.id === 'admin-only')).toBeUndefined();
    expect(doctorVisible.find(i => i.id === 'none')).toBeDefined();

    const adminVisible = visibleNavItems(configs, 'ADMIN');
    expect(adminVisible.find(i => i.id === 'admin-only')).toBeDefined();
    expect(adminVisible.find(i => i.id === 'both')).toBeDefined();
    expect(adminVisible.find(i => i.id === 'doctor-only')).toBeUndefined();
    expect(adminVisible.find(i => i.id === 'none')).toBeDefined();

    const receptionistVisible = visibleNavItems(configs, 'RECEPTIONIST');
    expect(receptionistVisible.find(i => i.id === 'doctor-only')).toBeUndefined();
    expect(receptionistVisible.find(i => i.id === 'admin-only')).toBeUndefined();
    expect(receptionistVisible.find(i => i.id === 'both')).toBeUndefined();
    expect(receptionistVisible.find(i => i.id === 'none')).toBeDefined();
  });

  /**
   * Property: Empty or invalid configs should return empty array
   */
  it('should handle empty and invalid configs gracefully', () => {
    expect(visibleNavItems([], 'DOCTOR')).toEqual([]);
    expect(visibleNavItems(null as any, 'DOCTOR')).toEqual([]);
    expect(visibleNavItems(undefined as any, 'DOCTOR')).toEqual([]);
  });

  /**
   * Property: Role with no matching items should return empty array
   */
  it('should return empty array when no items match the role', () => {
    const configs: ModuleConfig[] = [
      { id: 'admin-stuff', title: 'Admin', route: '/admin', requiredRoles: ['ADMIN'] },
      { id: 'doctor-stuff', title: 'Doctor', route: '/doctor', requiredRoles: ['DOCTOR'] },
    ];

    // A role that doesn't match any
    const receptionistOnly = visibleNavItems(configs, 'RECEPTIONIST');
    expect(receptionistOnly).toEqual([]);
  });

  /**
   * Property: undefined requiredRoles means no restriction (all roles allowed)
   */
  it('should treat undefined requiredRoles as no restriction', () => {
    const configs: ModuleConfig[] = [
      { id: 'unrestricted', title: 'Unrestricted', route: '/unrestricted', requiredRoles: undefined },
      { id: 'doctor-only', title: 'Doctor Only', route: '/doctor-only', requiredRoles: ['DOCTOR'] },
    ];

    validRoles.forEach((role) => {
      const visible = visibleNavItems(configs, role);
      expect(visible.find(i => i.id === 'unrestricted')).toBeDefined();
    });
  });

  /**
   * Property: empty array requiredRoles means no restriction (all roles allowed)
   */
  it('should treat empty requiredRoles array as no restriction', () => {
    const configs: ModuleConfig[] = [
      { id: 'empty-roles', title: 'Empty Roles', route: '/empty-roles', requiredRoles: [] },
      { id: 'doctor-only', title: 'Doctor Only', route: '/doctor-only', requiredRoles: ['DOCTOR'] },
    ];

    validRoles.forEach((role) => {
      const visible = visibleNavItems(configs, role);
      expect(visible.find(i => i.id === 'empty-roles')).toBeDefined();
    });
  });

  /**
   * Property: multiple roles in requiredRoles - user with any of them should see the item
   */
  it('should show item if user role is one of multiple allowed roles', () => {
    const configs: ModuleConfig[] = [
      { id: 'doctor-admin', title: 'Doctor or Admin', route: '/doctor-admin', requiredRoles: ['DOCTOR', 'ADMIN'] },
    ];

    expect(visibleNavItems(configs, 'DOCTOR').length).toBe(1);
    expect(visibleNavItems(configs, 'ADMIN').length).toBe(1);
    expect(visibleNavItems(configs, 'RECEPTIONIST').length).toBe(0);
  });

  /**
   * Property: preserves original order of allowed items
   */
  it('should preserve original order of allowed items', () => {
    const configs: ModuleConfig[] = [
      { id: 'first', title: 'First', route: '/first', requiredRoles: ['ADMIN'] },
      { id: 'second', title: 'Second', route: '/second' },
      { id: 'third', title: 'Third', route: '/third', requiredRoles: ['DOCTOR'] },
      { id: 'fourth', title: 'Fourth', route: '/fourth' },
    ];

    const visible = visibleNavItems(configs, 'DOCTOR');
    // Should return: second (no restriction), third (DOCTOR allowed)
    expect(visible[0].id).toBe('second');
    expect(visible[1].id).toBe('third');
  });
});
// Property 14: Phân giải quyền truy cập theo đường dẫn
// Feature: clinic-frontend-pwa, Property 14: Phân giải quyền truy cập theo đường dẫn
// Validates: Requirements 2.5, 7.4, 7.6
describe('navConfig - Property 14: Phân giải quyền truy cập theo đường dẫn', () => {
  /**
   * Property: canAccessPath trả về not-found nếu đường dẫn không khớp module nào
   */
  it('returns not-found when path does not match any module', () => {
    fc.assert(
      fc.property(
        // Generator for configs with at least one valid module
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            title: fc.string({ minLength: 1 }),
            path: fc.string({ minLength: 1 }),
            requiredRoles: fc.oneof(
              fc.constant(undefined),
              fc.array(fc.oneof(
                fc.constant<UserRole>('DOCTOR'),
                fc.constant<UserRole>('RECEPTIONIST'),
                fc.constant<UserRole>('ADMIN')
              )).filter(arr => arr.length > 0)
            ),
            children: fc.oneof(
              fc.constant(undefined),
              fc.array(
                fc.record({
                  id: fc.string({ minLength: 1 }),
                  title: fc.string({ minLength: 1 }),
                  path: fc.string({ minLength: 1 }),
                })
              )
            ),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        // Generator for path that doesn't match any config
        fc.string({ minLength: 1 }).filter(path => path !== '/patients' && path !== '/appointments'),
        fc.oneof(
          fc.constant<UserRole>('DOCTOR'),
          fc.constant<UserRole>('RECEPTIONIST'),
          fc.constant<UserRole>('ADMIN')
        ),
        (configs, path, role) => {
          // Filter to only configs where path is different
          const filteredConfigs = configs.filter(c => c.path !== path);
          
          // Also check children
          const hasMatchingChild = configs.some(c => 
            c.children?.some(child => child.path === path)
          );
          
          if (filteredConfigs.length === 0 || hasMatchingChild) {
            return; // Skip if no configs or path matches
          }

          const result = canAccessPath(filteredConfigs, path, role);
          
          // Property: not-found when path doesn't match
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('not-found');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: canAccessPath trả về forbidden nếu khớp module giới hạn nhưng vai trò không nằm trong allowedRoles
   */
  it('returns forbidden when path matches restricted module but role not allowed', () => {
    fc.assert(
      fc.property(
        // Generator for configs with role restrictions
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            title: fc.string({ minLength: 1 }),
            path: fc.string({ minLength: 1 }),
            requiredRoles: fc.array(
              fc.oneof(
                fc.constant<UserRole>('DOCTOR'),
                fc.constant<UserRole>('RECEPTIONIST'),
                fc.constant<UserRole>('ADMIN')
              )
            ).filter(arr => arr.length > 0), // Must have restrictions
          }),
          { minLength: 1, maxLength: 20 }
        ),
        // Generator for role
        fc.oneof(
          fc.constant<UserRole>('DOCTOR'),
          fc.constant<UserRole>('RECEPTIONIST'),
          fc.constant<UserRole>('ADMIN')
        ),
        (configs, role) => {
          // Find a config where the role is NOT in requiredRoles
          const restrictedConfig = configs.find(c => 
            c.requiredRoles && !c.requiredRoles.includes(role)
          );
          
          if (!restrictedConfig || !restrictedConfig.path) {
            return; // Skip if no restricted config found
          }

          const result = canAccessPath(configs, restrictedConfig.path, role);
          
          // Property: forbidden when role not in allowedRoles
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('forbidden');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: canAccessPath trả về allowed nếu khớp và vai trò được phép
   */
  it('returns allowed when path matches and role is allowed', () => {
    fc.assert(
      fc.property(
        // Generator for configs
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            title: fc.string({ minLength: 1 }),
            path: fc.string({ minLength: 1 }),
            requiredRoles: fc.oneof(
              fc.constant(undefined),
              fc.array(
                fc.oneof(
                  fc.constant<UserRole>('DOCTOR'),
                  fc.constant<UserRole>('RECEPTIONIST'),
                  fc.constant<UserRole>('ADMIN')
                )
              )
            ),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        // Generator for role
        fc.oneof(
          fc.constant<UserRole>('DOCTOR'),
          fc.constant<UserRole>('RECEPTIONIST'),
          fc.constant<UserRole>('ADMIN')
        ),
        (configs, role) => {
          // Find a config where the role IS in allowedRoles (or no restrictions)
          const allowedConfig = configs.find(c => 
            !c.requiredRoles || c.requiredRoles.length === 0 || c.requiredRoles.includes(role)
          );
          
          if (!allowedConfig || !allowedConfig.path) {
            return; // Skip if no allowed config found
          }

          const result = canAccessPath(configs, allowedConfig.path, role);
          
          // Property: allowed when role is allowed
          expect(result.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: canAccessPath handles child routes correctly
   */
  it('returns correct result for child routes', () => {
    fc.assert(
      fc.property(
        // Generator for configs with children
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            title: fc.string({ minLength: 1 }),
            path: fc.string({ minLength: 1 }),
            requiredRoles: fc.oneof(
              fc.constant(undefined),
              fc.array(
                fc.oneof(
                  fc.constant<UserRole>('DOCTOR'),
                  fc.constant<UserRole>('RECEPTIONIST'),
                  fc.constant<UserRole>('ADMIN')
                )
              )
            ),
            children: fc.oneof(
              fc.constant(undefined),
              fc.array(
                fc.record({
                  id: fc.string({ minLength: 1 }),
                  title: fc.string({ minLength: 1 }),
                  path: fc.string({ minLength: 1 }),
                  requiredRoles: fc.oneof(
                    fc.constant(undefined),
                    fc.array(
                      fc.oneof(
                        fc.constant<UserRole>('DOCTOR'),
                        fc.constant<UserRole>('RECEPTIONIST'),
                        fc.constant<UserRole>('ADMIN')
                      )
                    )
                  ),
                })
              )
            ),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        // Generator for role
        fc.oneof(
          fc.constant<UserRole>('DOCTOR'),
          fc.constant<UserRole>('RECEPTIONIST'),
          fc.constant<UserRole>('ADMIN')
        ),
        (configs, role) => {
          // Find a config with children
          const parentWithChildren = configs.find(c => c.children && c.children.length > 0);
          
          if (!parentWithChildren || !parentWithChildren.children) {
            return; // Skip if no parent with children
          }

          // Get a child path
          const childPath = parentWithChildren.children[0]?.path;
          
          if (!childPath) {
            return;
          }

          // Check child role restrictions
          const childConfig = parentWithChildren.children[0];
          const isChildRoleAllowed = !childConfig.requiredRoles || 
            childConfig.requiredRoles.length === 0 || 
            childConfig.requiredRoles.includes(role);

          const result = canAccessPath(configs, childPath, role);

          if (isChildRoleAllowed) {
            expect(result.allowed).toBe(true);
          } else {
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('forbidden');
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// Edge case tests for canAccessPath
describe('canAccessPath - edge cases', () => {
  it('returns not-found for empty configs array', () => {
    const result = canAccessPath([], '/patients', 'DOCTOR');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not-found');
  });

  it('returns not-found for empty path', () => {
    const configs: ModuleConfig[] = [
      { id: 'patients', title: 'Bệnh nhân', path: '/patients' },
    ];
    const result = canAccessPath(configs, '', 'DOCTOR');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not-found');
  });

  it('returns not-found for undefined path', () => {
    const configs: ModuleConfig[] = [
      { id: 'patients', title: 'Bệnh nhân', path: '/patients' },
    ];
    const result = canAccessPath(configs, undefined as unknown as string, 'DOCTOR');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not-found');
  });

  it('returns allowed for path without role restrictions', () => {
    const configs: ModuleConfig[] = [
      { id: 'patients', title: 'Bệnh nhân', path: '/patients' },
    ];
    const result = canAccessPath(configs, '/patients', 'DOCTOR');
    expect(result.allowed).toBe(true);
  });

  it('returns allowed for ADMIN on restricted path', () => {
    const configs: ModuleConfig[] = [
      { 
        id: 'admin', 
        title: 'Admin', 
        path: '/admin', 
        requiredRoles: ['ADMIN'] 
      },
    ];
    const result = canAccessPath(configs, '/admin', 'ADMIN');
    expect(result.allowed).toBe(true);
  });

  it('returns forbidden for DOCTOR on ADMIN-restricted path', () => {
    const configs: ModuleConfig[] = [
      { 
        id: 'admin', 
        title: 'Admin', 
        path: '/admin', 
        requiredRoles: ['ADMIN'] 
      },
    ];
    const result = canAccessPath(configs, '/admin', 'DOCTOR');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('forbidden');
  });

  it('handles configs without path property', () => {
    const configs: ModuleConfig[] = [
      { id: 'patients', title: 'Bệnh nhân' }, // no path
      { id: 'admin', title: 'Admin', path: '/admin', requiredRoles: ['ADMIN'] },
    ];
    const result = canAccessPath(configs, '/admin', 'DOCTOR');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('forbidden');
  });

  it('handles undefined configs', () => {
    const result = canAccessPath(undefined as unknown as ModuleConfig[], '/patients', 'DOCTOR');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not-found');
  });
});