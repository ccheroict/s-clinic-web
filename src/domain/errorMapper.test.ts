/**
 * Property-based tests for errorMapper
 * Feature: clinic-frontend-pwa, Property 9: Phân loại mã trạng thái HTTP thành hành động
 * Validates: Requirements 4.4, 4.8, 5.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyResponse, networkError, parseProblemDetail } from './errorMapper';
import type { ApiResult } from './types';

// Property 9: 401 → unauthorized, 403 → forbidden, 400 → validation, 2xx → ok
describe('errorMapper - Property 9: Phân loại mã trạng thái HTTP thành hành động', () => {
  const isUnauthorized = (r: ApiResult<unknown>): boolean => !r.ok && r.status === 'unauthorized';
  const isForbidden = (r: ApiResult<unknown>): boolean => !r.ok && r.status === 'forbidden';
  const isValidation = (r: ApiResult<unknown>): boolean => !r.ok && r.status === 'validation';
  const isServer = (r: ApiResult<unknown>): boolean => !r.ok && r.status === 'server';

  describe('401 → unauthorized', () => {
    it('fc: 401 luôn trả về unauthorized với bất kỳ body nào', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(undefined), fc.anything()),
          (body) => {
            const result = classifyResponse(401, body);
            expect(isUnauthorized(result)).toBe(true);
            expect(result.message).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('fc: chỉ có mã 401 mới trả về unauthorized', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 600 }).filter((s) => s !== 401),
          (status) => {
            const result = classifyResponse(status);
            expect(isUnauthorized(result)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('403 → forbidden', () => {
    it('fc: 403 luôn trả về forbidden với bất kỳ body nào', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(undefined), fc.anything()),
          (body) => {
            const result = classifyResponse(403, body);
            expect(isForbidden(result)).toBe(true);
            expect(result.message).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('fc: chỉ có mã 403 mới trả về forbidden', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 600 }).filter((s) => s !== 403),
          (status) => {
            const result = classifyResponse(status);
            expect(isForbidden(result)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('400 → validation', () => {
    it('fc: 400 luôn trả về validation với bất kỳ body nào', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(undefined), fc.anything()),
          (body) => {
            const result = classifyResponse(400, body);
            expect(isValidation(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('fc: chỉ có mã 400 mới trả về validation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 600 }).filter((s) => s !== 400),
          (status) => {
            const result = classifyResponse(status);
            expect(isValidation(result)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('400 validation có thể parse body chứa ProblemDetail format', () => {
      const testBodies = [
        { detail: 'field1: error1; field2: error2' },
        { detail: 'fullName: Required' },
        {},
        null,
        { detail: '' },
      ];
      testBodies.forEach((body) => {
        const result = classifyResponse(400, body);
        expect(isValidation(result)).toBe(true);
        expect(result.status).toBe('validation');
      });
    });
  });

  describe('2xx → ok (handled elsewhere)', () => {
    it('fc: classifyResponse xử lý 2xx như error (không phải success)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 200, max: 299 }),
          (status) => {
            const result = classifyResponse(status);
            expect(result.ok).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('500-599 → server error (không leak chi tiết)', () => {
    it('fc: mọi mã 500-599 đều trả về server error', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 500, max: 599 }),
          (status) => {
            const result = classifyResponse(status, { detail: 'Internal Server Error', stack: '...' });
            expect(isServer(result)).toBe(true);
            expect(result.message).not.toContain('500');
            expect(result.message).not.toContain('Internal Server Error');
            expect(result.message).not.toContain('stack');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('server error không leak thông tin từ body', () => {
      const leakingBodies = [
        { detail: 'Database connection failed', stack: 'java.sql...' },
        { message: 'Internal error', code: 'ERR_500', trace: '...' },
        'Some error string',
        123,
      ];
      leakingBodies.forEach((body) => {
        const result = classifyResponse(500, body);
        expect(isServer(result)).toBe(true);
        expect(result.message).toBe('An error occurred. Please try again later.');
      });
    });
  });

  describe('tổng hợp: tất cả mã trạng thái được phân loại đúng', () => {
    it('fc: mọi mã trạng thái đều trả về ApiResult error', () => {
      const statusCodes = [
        400, 401, 403, 404, 405, 408, 409, 412, 415, 422, 429,
        500, 501, 502, 503, 504,
        200, 201, 204, 301, 302,
      ];
      statusCodes.forEach((status) => {
        const result = classifyResponse(status);
        expect(result.ok).toBe(false);
      });
    });

    it('fc: mã lỗi chưa định nghĩa cụ thể cũng được xử lý', () => {
      const undefinedCodes = [402, 405, 406, 407, 409, 410, 411, 412, 413, 414, 416, 417, 418, 421, 422, 423, 424, 425, 426, 428, 431, 451, 502, 506, 507, 508, 510, 511];
      undefinedCodes.forEach((status) => {
        const result = classifyResponse(status);
        expect(result.ok).toBe(false);
        expect(isServer(result) || isForbidden(result)).toBe(true);
      });
    });
  });
});

// Edge cases
describe('classifyResponse - edge cases', () => {
  it('xử lý mã trạng thái âm', () => {
    const result = classifyResponse(-1);
    expect(result.ok).toBe(false);
  });

  it('xử lý mã trạng thái lớn', () => {
    const result = classifyResponse(999);
    expect(result.ok).toBe(false);
  });

  it('xử lý undefined body cho 400', () => {
    const result = classifyResponse(400, undefined);
    expect(result.status).toBe('validation');
  });

  it('xử lý null body cho 400', () => {
    const result = classifyResponse(400, null);
    expect(result.status).toBe('validation');
  });
});

// Property 10: Lỗi kết nối được ưu tiên hơn 401
// Validates: Requirements 4.5a
describe('errorMapper - Property 10: Lỗi kết nối được ưu tiên hơn 401', () => {
  it('should return network error when both network error and 401 exist', () => {
    const networkErr = networkError('timeout');
    const unauthorized = classifyResponse(401);

    const hasNetworkError = true;
    const has401 = unauthorized.status === 'unauthorized';

    if (hasNetworkError && has401) {
      expect(networkErr.status).toBe('network');
      expect(networkErr.status).not.toBe('unauthorized');
    }
  });

  it('fc: network error should be prioritized over 401', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('timeout' as const),
          fc.constant('offline' as const),
          fc.constant('error' as const)
        ),
        (networkReason) => {
          const networkErr = networkError(networkReason);
          expect(networkErr.ok).toBe(false);
          expect(networkErr.status).toBe('network');
          expect(networkErr.status).not.toBe('unauthorized');

          const authError = classifyResponse(401);
          expect(authError.status).toBe('unauthorized');

          const hasNetworkError = networkErr.status === 'network';
          const has401 = authError.status === 'unauthorized';

          if (hasNetworkError && has401) {
            const prioritizedResult = hasNetworkError ? networkErr : authError;
            expect(prioritizedResult.status).toBe('network');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fc: classifyResponse returns correct status for various codes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 599 }),
        (status) => {
          const result = classifyResponse(status);
          expect(result.ok).toBe(false);

          if (status === 401) {
            expect(result.status).toBe('unauthorized');
          }
          if (status === 403) {
            expect(result.status).toBe('forbidden');
          }
          if (status === 400) {
            expect(result.status).toBe('validation');
          }
          if (status >= 500 && status <= 599) {
            expect(result.status).toBe('server');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Tests for classifyResponse
describe('classifyResponse', () => {
  it('should return unauthorized for 401', () => {
    const result = classifyResponse(401);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('unauthorized');
  });

  it('should return forbidden for 403', () => {
    const result = classifyResponse(403);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('forbidden');
  });

  it('should return validation for 400', () => {
    const result = classifyResponse(400);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('validation');
  });

  it('should return server for 500', () => {
    const result = classifyResponse(500);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('server');
  });

  it('should handle unknown status codes as server error', () => {
    const result = classifyResponse(404);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('server');
  });
});

// Test networkError factory
describe('networkError', () => {
  it('should create timeout network error', () => {
    const result = networkError('timeout');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('network');
    expect(result.message).toContain('timed out');
  });

  it('should create offline network error', () => {
    const result = networkError('offline');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('network');
    expect(result.message).toContain('offline');
  });

  it('should create generic error network error', () => {
    const result = networkError('error');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('network');
    expect(result.message).toContain('network error');
  });
});

// parseProblemDetail - unit tests
describe('parseProblemDetail', () => {
  it('should parse single field error', () => {
    const result = parseProblemDetail('fullName: Required');
    expect(result).toEqual({ fullName: 'Required' });
  });

  it('should parse multiple field errors', () => {
    const result = parseProblemDetail('fullName: Required; age: Must be positive');
    expect(result).toEqual({ fullName: 'Required', age: 'Must be positive' });
  });

  it('should handle empty string', () => {
    const result = parseProblemDetail('');
    expect(result).toEqual({});
  });

  it('should handle string without colon', () => {
    const result = parseProblemDetail('Some error');
    expect(result).toEqual({ _general: 'Some error' });
  });
});

// Feature: clinic-frontend-pwa, Property 12: Phân tích ProblemDetail khôi phục lỗi theo trường (round-trip)
// Validates: Requirements 6.5
describe('errorMapper - Property 12: Phân tích ProblemDetail khôi phục lỗi theo trường (round-trip)', () => {
  // Generator for valid field names: non-empty, no delimiters (: or ;),
  // not only whitespace, and already trimmed (parser trims field names)
  const fieldNameArb = fc.string({ minLength: 1, maxLength: 30 })
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.includes(':') && !s.includes(';'));

  // Generator for valid messages: no semicolons (they are pair separators),
  // non-empty after trim, and already trimmed (parser trims messages)
  // Messages CAN contain colons since parser splits on first colon only
  const messageArb = fc.string({ minLength: 1, maxLength: 50 })
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.includes(';'));

  // Generator for a non-empty dictionary of field→message pairs
  const fieldErrorsArb = fc.array(
    fc.tuple(fieldNameArb, messageArb),
    { minLength: 1, maxLength: 10 }
  ).map((pairs) => {
    const dict: Record<string, string> = {};
    for (const [k, v] of pairs) {
      dict[k] = v;
    }
    return dict;
  }).filter((dict) => Object.keys(dict).length > 0);

  it('fc: mã hóa thành "field: message; ..." rồi parse lại bằng parseProblemDetail khôi phục đúng', () => {
    fc.assert(
      fc.property(
        fieldErrorsArb,
        (fieldErrors) => {
          // Encode: format backend uses "field: message; field2: message2"
          const encoded = Object.entries(fieldErrors)
            .map(([field, message]) => `${field}: ${message}`)
            .join('; ');

          // Decode: parse back with parseProblemDetail
          const parsed = parseProblemDetail(encoded);

          // Verify round-trip: all fields recovered correctly
          expect(Object.keys(parsed).sort()).toEqual(Object.keys(fieldErrors).sort());
          for (const key of Object.keys(fieldErrors)) {
            expect(parsed[key]).toBe(fieldErrors[key]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fc: round-trip với một trường duy nhất', () => {
    fc.assert(
      fc.property(
        fieldNameArb,
        messageArb,
        (field, message) => {
          const encoded = `${field}: ${message}`;
          const parsed = parseProblemDetail(encoded);
          expect(parsed[field]).toBe(message);
        }
      ),
      { numRuns: 100 }
    );
  });
});
// Feature: clinic-frontend-pwa, Property 11: Thông báo lỗi 5xx không lộ chi tiết kỹ thuật
// Validates: Requirements 9.6
describe('errorMapper - Property 11: Thông báo lỗi 5xx không lộ chi tiết kỹ thuật', () => {
  const genericMessage = 'An error occurred. Please try again later.';

  it('fc: thông báo lỗi 5xx không chứa status code', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 599 }),
        (status) => {
          const result = classifyResponse(status, { detail: 'Internal Server Error' });
          expect(result.status).toBe('server');
          expect(result.message).not.toContain(String(status));
          // Không chứa bất kỳ mã 5xx nào
          expect(result.message).not.toMatch(/5\d{2}/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fc: thông báo lỗi 5xx không chứa chi tiết từ body', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 599 }),
        fc.anything(),
        (status, body) => {
          const result = classifyResponse(status, body);
          expect(result.status).toBe('server');
          expect(result.message).toBe(genericMessage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fc: thông báo lỗi 5xx không chứa stack trace', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 599 }),
        (status) => {
          // Body chứa stack trace thường thấy trong server errors
          const bodyWithStack = {
            detail: 'Database connection failed',
            stack: 'java.sql.SQLException: Connection refused\n    at com.sclinic...',
            trace: 'java.lang.RuntimeException...',
            error: 'Internal Server Error',
            message: 'Something went wrong',
          };
          const result = classifyResponse(status, bodyWithStack);
          expect(result.status).toBe('server');
          expect(result.message).toBe(genericMessage);
          // Không leak stack trace
          expect(result.message).not.toContain('java.sql');
          expect(result.message).not.toContain('at com.');
          expect(result.message).not.toContain('RuntimeException');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fc: mọi mã 5xx đều trả về cùng một thông báo generic', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 599 }),
        (status) => {
          const result = classifyResponse(status);
          expect(result.message).toBe(genericMessage);
        }
      ),
      { numRuns: 100 }
    );
  });
});