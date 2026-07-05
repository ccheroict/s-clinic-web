/**
 * Property-based tests for validators
 * Feature: clinic-frontend-pwa, Property 2: Kiểm tra từ khóa tìm kiếm
 * Validates: Requirements 6.2a
 * Feature: clinic-frontend-pwa, Property 3: Kiểm tra biểu mẫu bệnh nhân
 * Validates: Requirements 6.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validatePatientForm, validateSearchKeyword } from './validators';
import type { PatientFormInput } from './types';

// Property 2: Kiểm tra từ khóa tìm kiếm
// For any chuỗi từ khóa: nếu chuỗi rỗng hoặc chỉ gồm khoảng trắng thì
// validateSearchKeyword phải bị từ chối (ok=false);
// nếu chuỗi (sau khi cắt khoảng trắng) có độ dài từ 1 đến 100 ký tự thì phải được chấp nhận.
describe('validators - Property 2: validateSearchKeyword', () => {
  it('Chuỗi rỗng hoặc chỉ khoảng trắng → ok=false', () => {
    // Generate 100+ test cases covering empty strings and whitespace-only strings
    // Including \t, \n, and non-breaking space
    const emptyAndWhitespaceCases: string[] = [
      '',
      '   ',
      '\t',
      '\n',
      ' \t \n ',
      '\u00A0', // non-breaking space
      ' \u00A0 ', // mix of regular space and non-breaking space
      '\t\n\t',
    ];

    // Generate more random whitespace combinations to reach 100+ test cases
    for (let i = 0; i < 100; i++) {
      const wsType = Math.floor(Math.random() * 4);
      const prefixLen = Math.floor(Math.random() * 5);
      const suffixLen = Math.floor(Math.random() * 5);
      let ws = '';
      for (let j = 0; j < prefixLen; j++) {
        ws += wsType === 0 ? ' ' : wsType === 1 ? '\t' : wsType === 2 ? '\n' : '\u00A0';
      }
      for (let j = 0; j < suffixLen; j++) {
        ws += Math.random() > 0.5 ? ' ' : '\t';
      }
      emptyAndWhitespaceCases.push(ws);
    }

    emptyAndWhitespaceCases.forEach((q) => {
      const result = validateSearchKeyword(q);
      // Property: empty or whitespace-only → ok=false
      expect(result.ok).toBe(false);
    });
  });

  it('Chuỗi sau trim có 1-100 ký tự → ok=true và value = trimmed', () => {
    // Generate 100+ test cases with valid keyword lengths (1-100 chars)
    const validKeywordCases: string[] = [];

    // Add simple cases
    validKeywordCases.push('a', 'ab', 'abc', 'test', 'keyword', 'search query');

    // Add Unicode cases
    validKeywordCases.push('Nguyễn Văn A', 'Tên bệnh nhân', 'Bệnh viện ABC');

    // Generate random valid keywords to reach 100+ test cases
    for (let i = 0; i < 150; i++) {
      const length = Math.floor(Math.random() * 100) + 1; // 1-100
      let keyword = '';
      for (let j = 0; j < length; j++) {
        const charCode = Math.floor(Math.random() * 26) + 97; // a-z
        keyword += String.fromCharCode(charCode);
      }
      validKeywordCases.push(keyword);
    }

    validKeywordCases.forEach((q) => {
      const trimmed = q.trim();
      // Only test cases where trimmed length is 1-100
      if (trimmed.length < 1 || trimmed.length > 100) return;

      const result = validateSearchKeyword(q);

      // Property: 1-100 chars after trim → ok=true
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(trimmed);
      }
    });
  });

  it('Chuỗi sau trim > 100 ký tự → ok=false', () => {
    // Generate test cases with keywords > 100 chars after trim
    const longKeywordCases: string[] = [];

    // Generate keywords that are > 100 chars after trim
    for (let i = 0; i < 120; i++) {
      const length = Math.floor(Math.random() * 50) + 101; // 101-150
      let keyword = '';
      for (let j = 0; j < length; j++) {
        const charCode = Math.floor(Math.random() * 26) + 97; // a-z
        keyword += String.fromCharCode(charCode);
      }
      // Add some leading/trailing whitespace
      keyword = '  ' + keyword + '  ';
      longKeywordCases.push(keyword);
    }

    longKeywordCases.forEach((q) => {
      const trimmed = q.trim();
      // Only test cases where trimmed length > 100
      if (trimmed.length <= 100) return;

      const result = validateSearchKeyword(q);

      // Property: > 100 chars after trim → ok=false
      expect(result.ok).toBe(false);
    });
  });

  it('Unicode và khoảng trắng đặc biệt được xử lý đúng', () => {
    // Generate 100+ test cases with Unicode and special whitespace
    const unicodeCases: string[] = [
      'Nguyễn Văn A',
      'Tên bệnh nhân',
      'Bệnh viện ABC',
      'Tiếng Việt có dấu',
    ];

    // Generate more Unicode test cases
    for (let i = 0; i < 120; i++) {
      const length = Math.floor(Math.random() * 50) + 1;
      let keyword = '';
      // Mix of ASCII and Unicode
      for (let j = 0; j < length; j++) {
        if (Math.random() > 0.5) {
          const charCode = Math.floor(Math.random() * 26) + 97;
          keyword += String.fromCharCode(charCode);
        } else {
          keyword += 'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ';
        }
      }
      // Add special whitespace
      const wsPrefix = Math.random() > 0.5 ? '\t' : Math.random() > 0.5 ? '\n' : ' ';
      const wsSuffix = Math.random() > 0.5 ? ' ' : '\u00A0';
      unicodeCases.push(wsPrefix + keyword + wsSuffix);
    }

    unicodeCases.forEach((q) => {
      const trimmed = q.trim();
      const len = trimmed.length;

      const result = validateSearchKeyword(q);

      if (len === 0) {
        // Empty after trim → should fail
        expect(result.ok).toBe(false);
      } else if (len >= 1 && len <= 100) {
        // Valid length → should pass
        expect(result.ok).toBe(true);
      } else {
        // > 100 → should fail
        expect(result.ok).toBe(false);
      }
    });
  });
});

// Edge case tests for validateSearchKeyword
describe('validateSearchKeyword - edge cases', () => {
  it('accepts valid keyword with 1 character', () => {
    const result = validateSearchKeyword('a');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('a');
  });

  it('accepts valid keyword with 100 characters', () => {
    const keyword = 'a'.repeat(100);
    const result = validateSearchKeyword(keyword);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(keyword);
  });

  it('rejects keyword > 100 characters', () => {
    const keyword = 'a'.repeat(101);
    const result = validateSearchKeyword(keyword);
    expect(result.ok).toBe(false);
  });

  it('trims leading and trailing whitespace', () => {
    const result = validateSearchKeyword('  test  ');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('test');
  });

  it('handles Unicode characters', () => {
    const result = validateSearchKeyword('Nguyễn Văn A');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('Nguyễn Văn A');
  });
});

// Property 3: Kiểm tra biểu mẫu bệnh nhân
// For any PatientFormInput, validatePatientForm returns ok=true when and only when
// fullName is non-empty/non-whitespace AND sex ∈ {M, F, U};
// otherwise returns ok=false
describe('validators - Property 3: validatePatientForm', () => {
  it('fullName không rỗng VÀ sex ∈ {M,F,U} → ok=true; ngược lại → ok=false', () => {
    // Use fast-check to generate 100+ test cases
    const testCases: { fullName: string; sex: 'M' | 'F' | 'U' | null }[] = [];

    // Generate valid test cases using fast-check
    fc.assert(
      fc.property(
        // Generator for valid fullName (non-empty, non-whitespace-only)
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        // Generator for sex - valid values only: 'M', 'F', 'U'
        fc.oneof(
          fc.constant<'M' | 'F' | 'U'>('M'),
          fc.constant<'M' | 'F' | 'U'>('F'),
          fc.constant<'M' | 'F' | 'U'>('U')
        ),
        (fullName, sex) => {
          const input: PatientFormInput = {
            fullName,
            sex,
          };

          const result = validatePatientForm(input);

          // Property: valid fullName + valid sex → ok=true
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fullName rỗng hoặc chỉ khoảng trắng → ok=false bất kể sex', () => {
    fc.assert(
      fc.property(
        // Generator for invalid fullName (empty or whitespace-only)
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          fc.constant('\n'),
          fc.constant(' \t \n ')
        ),
        // Generator for sex - any value (including invalid)
        fc.oneof(
          fc.constant(null),
          fc.constant('M'),
          fc.constant('F'),
          fc.constant('U'),
          fc.constant('X'),
        ),
        (fullName, sex) => {
          const input: PatientFormInput = {
            fullName,
            sex,
          };

          const result = validatePatientForm(input);

          // Property: invalid fullName → ok=false
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sex không hợp lệ (không ∈ {M,F,U,null}) → ok=false bất kể fullName', () => {
    fc.assert(
      fc.property(
        // Generator for valid fullName
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        // Generator for invalid sex values
        fc.oneof(
          fc.constant('X'),
          fc.constant('male'),
          fc.constant('female'),
          fc.constant('unknown'),
          fc.constant('A'),
          fc.constant('Z'),
          fc.constant(''),
        ),
        (fullName, sex) => {
          const input: PatientFormInput = {
            fullName,
            sex: sex as 'M' | 'F' | 'U' | null,
          };

          const result = validatePatientForm(input);

          // Property: invalid sex → ok=false
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sex = null → ok=true khi fullName hợp lệ (null is valid)', () => {
    fc.assert(
      fc.property(
        // Generator for valid fullName
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (fullName) => {
          const input: PatientFormInput = {
            fullName,
            sex: null,
          };

          const result = validatePatientForm(input);

          // Property: sex = null is valid (optional field)
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// Edge case tests for validatePatientForm
describe('validatePatientForm - edge cases', () => {
  it('validates a complete valid patient input', () => {
    const input: PatientFormInput = {
      fullName: 'Nguyen Van A',
      sex: 'M',
      phone: '0123456789',
      address: '123 ABC Street',
      dob: '1990-01-01',
    };

    const result = validatePatientForm(input);
    expect(result.ok).toBe(true);
  });

  it('rejects empty fullName', () => {
    const input: PatientFormInput = {
      fullName: '',
      sex: 'M',
    };

    const result = validatePatientForm(input);
    expect(result.ok).toBe(false);
    expect(result.errors.fullName).toBeDefined();
  });

  it('rejects whitespace-only fullName', () => {
    const input: PatientFormInput = {
      fullName: '   ',
      sex: 'F',
    };

    const result = validatePatientForm(input);
    expect(result.ok).toBe(false);
  });

  it('rejects invalid sex value', () => {
    const input: PatientFormInput = {
      fullName: 'Test Patient',
      sex: 'X' as 'M' | 'F' | 'U' | null,
    };

    const result = validatePatientForm(input);
    expect(result.ok).toBe(false);
  });

  it('accepts null sex (optional field)', () => {
    const input: PatientFormInput = {
      fullName: 'Test Patient',
      sex: null,
    };

    const result = validatePatientForm(input);
    expect(result.ok).toBe(true);
  });
});