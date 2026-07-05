import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isSecureUrl, assertHttps } from './httpsEnforcer';

describe('httpsEnforcer', () => {
  describe('isSecureUrl', () => {
    it('returns true for HTTPS URLs', () => {
      expect(isSecureUrl('https://example.com')).toBe(true);
      expect(isSecureUrl('https://api.example.com/path')).toBe(true);
      expect(isSecureUrl('https://example.com:443/path')).toBe(true);
    });

    it('returns false for HTTP URLs', () => {
      expect(isSecureUrl('http://example.com')).toBe(false);
      expect(isSecureUrl('http://api.example.com/path')).toBe(false);
    });

    it('returns false for localhost HTTP', () => {
      expect(isSecureUrl('http://localhost')).toBe(false);
      expect(isSecureUrl('http://localhost:8080')).toBe(false);
      expect(isSecureUrl('http://127.0.0.1')).toBe(false);
    });

    it('returns false for invalid URLs', () => {
      expect(isSecureUrl('')).toBe(false);
      expect(isSecureUrl('not-a-url')).toBe(false);
      expect(isSecureUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('assertHttps', () => {
    it('returns true for HTTPS URLs', () => {
      expect(assertHttps('https://example.com')).toBe(true);
      expect(assertHttps('https://api.example.com/path')).toBe(true);
    });

    it('returns true for localhost HTTP (development exception)', () => {
      expect(assertHttps('http://localhost')).toBe(true);
      expect(assertHttps('http://localhost:8080')).toBe(true);
      expect(assertHttps('http://localhost:8080/path')).toBe(true);
      expect(assertHttps('http://127.0.0.1')).toBe(true);
      expect(assertHttps('http://127.0.0.1:3000')).toBe(true);
    });

    it('throws error for HTTP (non-localhost)', () => {
      expect(() => assertHttps('http://example.com')).toThrow();
      expect(() => assertHttps('http://api.example.com')).toThrow();
    });

    it('throws error for invalid URLs', () => {
      expect(() => assertHttps('')).toThrow();
      expect(() => assertHttps('not-a-url')).toThrow();
    });
  });
});


// Feature: clinic-frontend-pwa, Property 15: Ép buộc HTTPS cho mọi yêu cầu chứa dữ liệu
// **Validates: Requirements 8.1, 8.2**
describe('Property 15: Ép buộc HTTPS cho mọi yêu cầu chứa dữ liệu', () => {
  // Generator for non-localhost hostnames
  const nonLocalhostHost = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
    { minLength: 1, maxLength: 20 }
  ).filter(h => h !== 'localhost' && !h.startsWith('-') && !h.endsWith('-'))
   .map(h => `${h}.com`);

  // Generator for valid path segments
  const pathSegment = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
    { minLength: 0, maxLength: 15 }
  ).map(s => `/${s}`);

  // Generator for port numbers
  const port = fc.integer({ min: 1, max: 65535 });

  // Generator for HTTPS URLs (should always be allowed)
  const httpsUrl = fc.tuple(nonLocalhostHost, fc.option(port), pathSegment)
    .map(([host, p, path]) => `https://${host}${p ? `:${p}` : ''}${path}`);

  // Generator for HTTP localhost URLs (development exception, should be allowed)
  const localhostUrl = fc.tuple(
    fc.constantFrom('localhost', '127.0.0.1'),
    fc.option(port),
    pathSegment
  ).map(([host, p, path]) => `http://${host}${p ? `:${p}` : ''}${path}`);

  // Generator for insecure non-localhost URLs (should always be rejected)
  const insecureProtocol = fc.constantFrom('http:', 'ftp:', 'ws:', 'wss:', 'file:');
  const insecureNonLocalhostUrl = fc.tuple(insecureProtocol, nonLocalhostHost, fc.option(port), pathSegment)
    .filter(([proto]) => proto !== 'https:')
    .map(([proto, host, p, path]) => {
      const portPart = p ? `:${p}` : '';
      return `${proto}//${host}${portPart}${path}`;
    })
    // Filter out URLs that would be parsed as localhost by URL constructor
    .filter(url => {
      try {
        const parsed = new URL(url);
        return parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1';
      } catch {
        return false;
      }
    });

  it('HTTPS URLs are always allowed', () => {
    fc.assert(
      fc.property(httpsUrl, (url) => {
        // assertHttps should return true for HTTPS URLs
        expect(assertHttps(url)).toBe(true);
        // isSecureUrl should also return true
        expect(isSecureUrl(url)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('localhost URLs are always allowed regardless of protocol', () => {
    fc.assert(
      fc.property(localhostUrl, (url) => {
        // assertHttps should return true for localhost (development exception)
        expect(assertHttps(url)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('non-HTTPS non-localhost URLs are always rejected', () => {
    fc.assert(
      fc.property(insecureNonLocalhostUrl, (url) => {
        // assertHttps should throw for insecure non-localhost URLs
        expect(() => assertHttps(url)).toThrow();
        // isSecureUrl should return false (URL is not https)
        expect(isSecureUrl(url)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('invalid URLs are always rejected (no data transmitted)', () => {
    const invalidUrl = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz !@#$%'.split('')),
      { minLength: 1, maxLength: 30 }
    ).filter(s => {
      try { new URL(s); return false; } catch { return true; }
    });

    fc.assert(
      fc.property(invalidUrl, (url) => {
        // assertHttps should throw for invalid URLs
        expect(() => assertHttps(url)).toThrow();
        // isSecureUrl should return false
        expect(isSecureUrl(url)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
