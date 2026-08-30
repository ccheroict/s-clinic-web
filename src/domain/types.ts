/**
 * Domain types for S-Clinic frontend
 * Framework-agnostic TypeScript types matching Spring Boot backend
 */

/**
 * User roles in the system
 */
export type UserRole = 'DOCTOR' | 'RECEPTIONIST' | 'ADMIN';

/**
 * What a session token is allowed to do.
 *
 * Only FULL reaches business endpoints. The others are half-finished logins:
 * the account has proved something but not everything, and the token is only
 * accepted by the auth endpoint that clears the remaining step.
 */
export type TokenScope = 'FULL' | 'CHANGE_PASSWORD' | 'MFA_PENDING' | 'ENROLL_MFA';

/**
 * Authentication session information
 */
export interface AuthSession {
  authHeader: string;
  username: string;
  role: UserRole;
}

/** What the client needs to set up an authenticator app. */
export interface MfaEnrolment {
  secret: string;
  provisioningUri: string;
}

/**
 * Patient data from backend (PatientResponse)
 */
export interface Patient {
  id: string;
  code: string;
  fullName: string;
  dob: string | null;
  sex: string | null;
  phone: string | null;
  address: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  note: string | null;
  nationalId: string | null;
  insuranceNo: string | null;
  taxCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Patient form input for create/update (PatientRequest)
 */
export interface PatientFormInput {
  code?: string;
  fullName: string;
  dob: string | null;
  sex: 'M' | 'F' | 'U' | null;
  phone: string | null;
  address: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  note: string | null;
  nationalId: string | null;
  insuranceNo: string | null;
  taxCode: string | null;
}

/**
 * Spring Page<T> response structure
 */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/**
 * Module configuration for navigation
 */
export interface ModuleConfig {
  id: string;
  title: string;
  icon?: string;
  path?: string;
  requiredRoles?: UserRole[];
  children?: ModuleConfig[];
}

/**
 * Generic API request configuration
 */
export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
}

/**
 * Success result with data
 */
export interface ApiOk<T> {
  ok: true;
  data: T;
}

/**
 * Validation error result
 */
export interface ApiValidation {
  ok: false;
  status: 'validation';
  errors: Record<string, string[]>;
}

/**
 * Unauthorized error result
 */
export interface ApiUnauthorized {
  ok: false;
  status: 'unauthorized';
  message: string;
}

/**
 * Forbidden error result
 */
export interface ApiForbidden {
  ok: false;
  status: 'forbidden';
  message: string;
}

/**
 * Server error result
 */
export interface ApiServerError {
  ok: false;
  status: 'server';
  message: string;
  code?: string;
}

/**
 * Network error result
 */
export interface ApiNetworkError {
  ok: false;
  status: 'network';
  message: string;
}



/**
 * Union type for all API result variants
 */
export type ApiResult<T> =
  | ApiOk<T>
  | ApiValidation
  | ApiUnauthorized
  | ApiForbidden
  | ApiServerError
  | ApiNetworkError;

/**
 * Type guard to check if ApiResult is successful
 */
export function isApiOk<T>(result: ApiResult<T>): result is ApiOk<T> {
  return result.ok === true;
}

/**
 * Type guard to check if ApiResult is a validation error
 */
export function isApiValidation<T>(result: ApiResult<T>): result is ApiValidation {
  return !result.ok && result.status === 'validation';
}

/**
 * Type guard to check if ApiResult is an authentication error
 */
export function isApiAuthError(result: ApiResult<unknown>): result is ApiUnauthorized | ApiForbidden {
  return !result.ok && (result.status === 'unauthorized' || result.status === 'forbidden');
}

/**
 * Type guard to check if ApiResult is a network error
 */
export function isApiNetworkError(result: ApiResult<unknown>): result is ApiNetworkError {
  return !result.ok && result.status === 'network';
}

/**
 * Extract data from ApiResult, throwing if error
 */
export function unwrapApiResult<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new Error(`API Error [${result.status}]: ${'message' in result ? result.message : 'Unknown error'}`);
  }
  return result.data;
}