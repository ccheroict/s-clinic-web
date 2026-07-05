/**
 * Navigation configuration utilities
 * Pure functions for building and filtering navigation config
 */

import type { ModuleConfig, UserRole } from './types';

/**
 * Maximum number of modules allowed in navigation
 * Requirement 7.2, 7.2a
 */
export const MAX_MODULES = 20;

/**
 * Check if a module config has all required fields
 * Requirement 7.3
 */
function isValidModuleConfig(config: ModuleConfig): boolean {
  return !!(config.id && config.path && config.title);
}

/**
 * Check if a role is allowed to access a module
 */
function isRoleAllowed(config: ModuleConfig, role: UserRole): boolean {
  if (!config.requiredRoles || config.requiredRoles.length === 0) {
    return true; // No role restriction = all authenticated roles allowed
  }
  return config.requiredRoles.includes(role);
}

/**
 * Build navigation model from configs
 * - Filters out items missing id/path/title
 * - Limits to MAX_MODULES elements
 * 
 * @param configs - Array of module configurations
 * @returns Filtered and limited navigation model
 * 
 * **Validates: Requirements 7.1, 7.2, 7.2a, 7.3**
 */
export function buildNavModel(configs: ModuleConfig[]): ModuleConfig[] {
  if (!Array.isArray(configs)) {
    return [];
  }

  const validConfigs = configs.filter(isValidModuleConfig);
  return validConfigs.slice(0, MAX_MODULES);
}

/**
 * Filter modules that are visible for a given role
 * 
 * @param configs - Array of module configurations
 * @param role - User role to filter by
 * @returns Modules accessible by the given role
 * 
 * **Validates: Requirements 5.5, 7.5**
 */
export function visibleNavItems(configs: ModuleConfig[], role: UserRole): ModuleConfig[] {
  if (!Array.isArray(configs)) {
    return [];
  }

  return configs.filter(config => isRoleAllowed(config, role));
}

/**
 * Check if a path is accessible for a given role
 * 
 * @param configs - Array of module configurations
 * @param path - Path to check access for
 * @param role - User role to check against
 * @returns Access result with allowed flag and reason if not allowed
 * 
 * **Validates: Requirements 2.5, 7.4, 7.6**
 */
export function canAccessPath(
  configs: ModuleConfig[],
  path: string,
  role: UserRole
): { allowed: true } | { allowed: false; reason: 'not-found' | 'forbidden' } {
  if (!Array.isArray(configs) || !path) {
    return { allowed: false, reason: 'not-found' };
  }

  // Find the exact matching config (parent or child)
  let matchingConfig: ModuleConfig | undefined;
  
  for (const config of configs) {
    // Check exact match on parent
    if (config.path === path) {
      matchingConfig = config;
      break;
    }
    // Check children
    if (config.children) {
      const childMatch = config.children.find(child => child.path === path);
      if (childMatch) {
        matchingConfig = childMatch;
        break;
      }
    }
  }

  if (!matchingConfig) {
    return { allowed: false, reason: 'not-found' };
  }

  if (!isRoleAllowed(matchingConfig, role)) {
    return { allowed: false, reason: 'forbidden' };
  }

  return { allowed: true };
}