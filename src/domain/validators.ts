/**
 * Form validation functions using Zod schemas
 * Validates: Requirements 4.1, 6.2a, 6.6
 */

import { z } from 'zod';
import type { PatientFormInput } from './types';

/**
 * Validation result for login form
 */
interface LoginValidationSuccess {
  ok: true;
}

interface LoginValidationFailure {
  ok: false;
  errors: {
    username?: string;
    password?: string;
  };
}

export type LoginValidationResult = LoginValidationSuccess | LoginValidationFailure;

/**
 * Validation result for patient form
 */
interface PatientValidationSuccess {
  ok: true;
}

interface PatientValidationFailure {
  ok: false;
  errors: Record<string, string>;
}

export type PatientValidationResult = PatientValidationSuccess | PatientValidationFailure;

/**
 * Validation result for search keyword
 */
interface SearchValidationSuccess {
  ok: true;
  value: string;
}

interface SearchValidationFailure {
  ok: false;
  error: string;
}

export type SearchValidationResult = SearchValidationSuccess | SearchValidationFailure;

/**
 * Non-empty string (not empty or whitespace-only)
 */
const nonEmptyString = z.string().min(1).refine(
  (val) => val.trim().length > 0,
  { message: 'Không được để trống hoặc chỉ chứa khoảng trắng' }
);

/**
 * Login form validation schema
 */
const loginSchema = z.object({
  username: nonEmptyString,
  password: nonEmptyString,
});

/**
 * Patient form validation schema
 * fullName: not empty
 * sex: must be M, F, or U
 */
const patientSchema = z.object({
  code: z.string().optional(),
  fullName: nonEmptyString,
  dob: z.string().nullable().optional(),
  sex: z.enum(['M', 'F', 'U']).nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  medicalHistory: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  nationalId: z.string().nullable().optional(),
  insuranceNo: z.string().nullable().optional(),
  taxCode: z.string().nullable().optional(),
});

/**
 * Validate login form
 * @param username - Username input
 * @param password - Password input
 * @returns Validation result with errors or success
 * 
 * Validation rules (Requirement 4.1):
 * - Username không được rỗng hoặc chỉ chứa khoảng trắng
 * - Password không được rỗng hoặc chỉ chứa khoảng trắng
 */
export function validateLoginForm(username: string, password: string): LoginValidationResult {
  const result = loginSchema.safeParse({ username, password });

  if (result.success) {
    return { ok: true };
  }

  // Must reference the failure branch: LoginValidationResult is a union and the
  // success branch has no `errors`.
  const errors: LoginValidationFailure['errors'] = {};

  for (const issue of result.error.issues) {
    const path = issue.path[0];
    if (path === 'username') {
      errors.username = issue.message;
    } else if (path === 'password') {
      errors.password = issue.message;
    }
  }

  return { ok: false, errors };
}

/**
 * Validate patient form input
 * @param input - Patient form data
 * @returns Validation result with errors or success
 * 
 * Validation rules (Requirements 6.2a, 6.6):
 * - fullName không được rỗng
 * - sex ∈ {M, F, U}
 */
export function validatePatientForm(input: PatientFormInput): PatientValidationResult {
  const result = patientSchema.safeParse(input);

  if (result.success) {
    return { ok: true };
  }

  const errors: Record<string, string> = {};

  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }

  return { ok: false, errors };
}

/**
 * Validate search keyword
 * @param q - Search query string
 * @returns Validation result with trimmed value or error
 * 
 * Validation rules (Requirement 6.2a):
 * - Độ dài 1-100 ký tự sau khi trim
 * - Không rỗng
 */
export function validateSearchKeyword(q: string): SearchValidationResult {
  // Trim the input first
  const trimmed = q.trim();

  // Check if empty after trim
  if (trimmed.length === 0) {
    return { ok: false, error: 'Từ khóa tìm kiếm không được để trống' };
  }

  // Check length constraint (1-100)
  if (trimmed.length > 100) {
    return { ok: false, error: 'Từ khóa tìm kiếm không được quá 100 ký tự' };
  }

  return { ok: true, value: trimmed };
}