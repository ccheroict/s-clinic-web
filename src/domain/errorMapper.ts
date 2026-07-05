/**
 * Error mapping and ProblemDetail parsing utilities
 * Maps HTTP status codes to ApiResult variants and parses RFC 7807 ProblemDetail
 */

import type { ApiResult, ApiNetworkError } from './types';
import { ApiValidation, ApiUnauthorized, ApiForbidden, ApiServerError } from './types';

/**
 * Maps HTTP status code to appropriate ApiResult variant
 * @param status - HTTP status code
 * @param body - Optional response body (used for 400 validation errors)
 * @returns ApiResult variant based on status code
 * 
 * Rules:
 * - 401 → unauthorized
 * - 403 → forbidden  
 * - 400 → validation (parse ProblemDetail detail)
 * - 500-599 → server (don't leak details)
 * - 2xx → ok (handled elsewhere, this is for error cases)
 */
export function classifyResponse(status: number, body?: unknown): ApiResult<unknown> {
  // 401 Unauthorized
  if (status === 401) {
    return {
      ok: false,
      status: 'unauthorized',
      message: 'Unauthorized: Please log in again',
    };
  }

  // 403 Forbidden
  if (status === 403) {
    return {
      ok: false,
      status: 'forbidden',
      message: 'You do not have permission to perform this action',
    };
  }

  // 400 Bad Request - Validation errors
  if (status === 400) {
    const fieldErrors = parseProblemDetailFromBody(body);
    return {
      ok: false,
      status: 'validation',
      errors: fieldErrors,
    };
  }

  // 500-599 Server errors - don't leak technical details
  if (status >= 500 && status <= 599) {
    return {
      ok: false,
      status: 'server',
      message: serverErrorMessage(),
      code: 'SERVER_ERROR',
    };
  }

  // Other error codes not explicitly handled
  return {
    ok: false,
    status: 'server',
    message: serverErrorMessage(),
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Parses ProblemDetail.detail string into a record of field errors
 * Format: "field: message; field2: message2"
 * @param detail - The detail string from ProblemDetail
 * @returns Record mapping field names to error messages
 * 
 * @example
 * parseProblemDetail("fullName: Required; age: Must be positive")
 * // Returns: { fullName: "Required", age: "Must be positive" }
 */
export function parseProblemDetail(detail: string): Record<string, string> {
  if (!detail || typeof detail !== 'string') {
    return {};
  }

  const result: Record<string, string> = {};
  
  // Split by semicolon to get individual field:message pairs
  const pairs = detail.split(';');
  
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    
    // Find the colon separator
    const colonIndex = trimmed.indexOf(':');
    
    if (colonIndex === -1) {
      // No colon found, treat entire string as a general error
      result['_general'] = trimmed;
    } else {
      const field = trimmed.slice(0, colonIndex).trim();
      const message = trimmed.slice(colonIndex + 1).trim();
      
      if (field && message) {
        result[field] = message;
      } else if (field) {
        result[field] = '';
      }
    }
  }
  
  return result;
}

/**
 * Helper to extract field errors from response body (ProblemDetail format)
 * @param body - Response body object
 * @returns Record of field errors
 */
function parseProblemDetailFromBody(body?: unknown): Record<string, string[]> {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const bodyObj = body as Record<string, unknown>;
  
  // Check for RFC 7807 ProblemDetail format
  if (typeof bodyObj.detail === 'string') {
    const parsed = parseProblemDetail(bodyObj.detail);
    
    // Convert to Record<string, string[]> format for ApiValidation
    const result: Record<string, string[]> = {};
    for (const [field, message] of Object.entries(parsed)) {
      result[field] = [message];
    }
    return result;
  }

  return {};
}

/**
 * Returns a generic server error message that doesn't leak technical details
 * Required by Requirement 9.6: 5xx errors should not expose status/body/stack
 * @returns Generic error message string
 */
export function serverErrorMessage(): string {
  return 'An error occurred. Please try again later.';
}

/**
 * Network error factory function
 * Creates a network error ApiResult
 * Used when network failures occur (timeout, offline, etc.)
 * Note: Network errors should be prioritized over 401 in apiClient layer
 * @param reason - The type of network error
 * @returns ApiNetworkError result
 */
export function networkError(reason: 'timeout' | 'offline' | 'error'): ApiNetworkError {
  const messages = {
    timeout: 'Request timed out. Please check your connection and try again.',
    offline: 'You are offline. Please check your internet connection.',
    error: 'A network error occurred. Please try again.',
  };
  
  return {
    ok: false,
    status: 'network',
    message: messages[reason],
  };
}