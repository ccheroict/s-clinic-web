/**
 * Property-based tests for retryPolicy
 * Feature: clinic-frontend-pwa, Property 17: Thử lại chạy tối đa 3 lần mỗi lần kích hoạt
 * Validates: Requirements 9.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { runWithRetry } from './retryPolicy';
import type { ApiResult } from './types';

// Helper: generate a failed ApiResult
function failedResult(message: string): ApiResult<unknown> {
  return { ok: false, status: 'network', message };
}

// Helper: generate a successful ApiResult
function okResult<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

// Feature: clinic-frontend-pwa, Property 17: Thử lại chạy tối đa 3 lần mỗi lần kích hoạt
describe('retryPolicy - Property 17: Thử lại chạy tối đa 3 lần mỗi lần kích hoạt', () => {
  it('fc: nếu cả 3 lần đều fail → attempts=3 và trả về lỗi cuối', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 3 distinct error messages to verify last error is returned
        fc.tuple(fc.string(), fc.string(), fc.string()),
        async ([msg1, msg2, msg3]) => {
          const errors = [msg1, msg2, msg3];
          let callCount = 0;

          const operation = async (): Promise<ApiResult<unknown>> => {
            const idx = callCount;
            callCount++;
            return failedResult(errors[idx]);
          };

          const { result, attempts } = await runWithRetry(operation, 3);

          // Must have called exactly 3 times
          expect(callCount).toBe(3);
          // attempts must be 3
          expect(attempts).toBe(3);
          // result must be the last error
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.message).toBe(msg3);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fc: runWithRetry gọi tối đa maxAttempts lần khi tất cả đều fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        // maxAttempts between 1 and 10
        fc.integer({ min: 1, max: 10 }),
        async (maxAttempts) => {
          let callCount = 0;

          const operation = async (): Promise<ApiResult<unknown>> => {
            callCount++;
            return failedResult(`error-${callCount}`);
          };

          const { result, attempts } = await runWithRetry(operation, maxAttempts);

          // Must have called exactly maxAttempts times
          expect(callCount).toBe(maxAttempts);
          // attempts must equal maxAttempts
          expect(attempts).toBe(maxAttempts);
          // result must be failure
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fc: nếu thành công ở lần thứ k (k <= 3), dừng ngay và attempts=k', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Success on attempt k (1-based), where k is in [1, 3]
        fc.integer({ min: 1, max: 3 }),
        fc.anything(),
        async (successAt, data) => {
          let callCount = 0;

          const operation = async (): Promise<ApiResult<unknown>> => {
            callCount++;
            if (callCount === successAt) {
              return okResult(data);
            }
            return failedResult(`fail-${callCount}`);
          };

          const { result, attempts } = await runWithRetry(operation, 3);

          // Should stop at successAt
          expect(callCount).toBe(successAt);
          expect(attempts).toBe(successAt);
          // Result should be success
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.data).toEqual(data);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fc: không bao giờ gọi quá 3 lần (mặc định maxAttempts=3)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random sequence of failures (more than 3)
        fc.array(fc.string(), { minLength: 5, maxLength: 20 }),
        async (messages) => {
          let callCount = 0;

          const operation = async (): Promise<ApiResult<unknown>> => {
            callCount++;
            return failedResult(messages[callCount - 1] ?? 'error');
          };

          await runWithRetry(operation, 3);

          // Never exceeds 3 calls
          expect(callCount).toBeLessThanOrEqual(3);
        }
      ),
      { numRuns: 100 }
    );
  });
});
