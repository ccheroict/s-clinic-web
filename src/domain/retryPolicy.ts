/**
 * Retry policy utilities for S-Clinic frontend
 * Provides retry functionality with configurable attempt limits
 */

import type { ApiResult } from './types';

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  result: ApiResult<T>;
  attempts: number;
}

/**
 * Executes an operation with retry logic
 * 
 * @param operation - The async operation to execute
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @returns Object containing the result and number of attempts made
 * 
 * @example
 * const { result, attempts } = await runWithRetry(async () => {
 *   const response = await fetch('/api/patients');
 *   return handleResponse(response);
 * });
 */
export async function runWithRetry<T>(
  operation: () => Promise<ApiResult<T>>,
  maxAttempts: number = 3
): Promise<RetryResult<T>> {
  let lastResult: ApiResult<T>;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    lastResult = await operation();

    // If operation succeeded, return immediately
    if (lastResult.ok) {
      return { result: lastResult, attempts };
    }
  }

  // All attempts failed, return last result with attempts count
  return { 
    result: lastResult!, 
    attempts 
  };
}