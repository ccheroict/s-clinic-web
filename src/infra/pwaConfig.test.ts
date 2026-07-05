/**
 * Unit tests for PWA / Service Worker configuration.
 * Validates: Requirements 1.1 (manifest), 8.3 (API routes use NetworkOnly, cache never stores /api responses)
 */

import { describe, it, expect } from 'vitest';
import {
  manifest,
  runtimeCaching,
  pwaConfig,
  isApiRoute,
  getCacheHandler,
} from './pwaConfig';

describe('Service Worker Configuration', () => {
  describe('Runtime caching — /api/** is NetworkOnly (R8.3)', () => {
    it('runtimeCaching has a rule matching /api/ paths', () => {
      const apiRule = runtimeCaching.find((rule) =>
        rule.urlPattern.test('/api/patients')
      );
      expect(apiRule).toBeDefined();
    });

    it('/api/** handler is NetworkOnly', () => {
      const apiRule = runtimeCaching.find((rule) =>
        rule.urlPattern.test('/api/patients')
      );
      expect(apiRule!.handler).toBe('NetworkOnly');
    });

    it('all /api sub-paths are matched by the NetworkOnly rule', () => {
      const apiPaths = [
        '/api/patients',
        '/api/patients/123',
        '/api/me',
        '/api/appointments',
        '/api/patients?q=test&page=0&size=20',
      ];

      for (const path of apiPaths) {
        const handler = getCacheHandler(path);
        expect(handler).toBe('NetworkOnly');
      }
    });

    it('cacheableResponse statuses is empty — nothing from /api gets cached', () => {
      const apiRule = runtimeCaching.find((rule) =>
        rule.urlPattern.test('/api/patients')
      );
      expect(apiRule).toBeDefined();
      const opts = apiRule!.options as Record<string, any>;
      expect(opts.cacheableResponse.statuses).toEqual([]);
    });

    it('non-api static paths are NOT matched by the api rule (fall through to precache)', () => {
      const staticPaths = [
        '/index.html',
        '/assets/main.js',
        '/pwa-192x192.png',
        '/favicon.ico',
      ];

      for (const path of staticPaths) {
        const handler = getCacheHandler(path);
        expect(handler).toBe('Precache');
      }
    });
  });

  describe('isApiRoute helper', () => {
    it('returns true for API paths', () => {
      expect(isApiRoute('/api/patients')).toBe(true);
      expect(isApiRoute('/api/me')).toBe(true);
      expect(isApiRoute('/api/patients/abc-123')).toBe(true);
    });

    it('returns false for non-API paths', () => {
      expect(isApiRoute('/index.html')).toBe(false);
      expect(isApiRoute('/assets/logo.png')).toBe(false);
      expect(isApiRoute('/api')).toBe(false); // must have trailing segment
    });
  });

  describe('Web App Manifest (R1.1)', () => {
    it('manifest has a name', () => {
      expect(manifest.name).toBeDefined();
      expect(manifest.name.length).toBeGreaterThan(0);
    });

    it('manifest has an icon with size 192x192', () => {
      const icon192 = manifest.icons.find((icon) => icon.sizes === '192x192');
      expect(icon192).toBeDefined();
      expect(icon192!.type).toBe('image/png');
      expect(icon192!.src).toBeTruthy();
    });

    it('manifest has an icon with size 512x512', () => {
      const icon512 = manifest.icons.find((icon) => icon.sizes === '512x512');
      expect(icon512).toBeDefined();
      expect(icon512!.type).toBe('image/png');
      expect(icon512!.src).toBeTruthy();
    });

    it('manifest has theme_color defined', () => {
      expect(manifest.theme_color).toBeDefined();
      expect(manifest.theme_color.length).toBeGreaterThan(0);
      // Should be a valid hex color
      expect(manifest.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('manifest display is standalone', () => {
      expect(manifest.display).toBe('standalone');
    });

    it('manifest has both required icon sizes (192 and 512)', () => {
      const sizes = manifest.icons.map((icon) => icon.sizes);
      expect(sizes).toContain('192x192');
      expect(sizes).toContain('512x512');
    });
  });

  describe('Full PWA config structure', () => {
    it('pwaConfig has workbox with runtimeCaching', () => {
      expect(pwaConfig.workbox).toBeDefined();
      expect(pwaConfig.workbox.runtimeCaching).toBeDefined();
      expect(pwaConfig.workbox.runtimeCaching.length).toBeGreaterThan(0);
    });

    it('pwaConfig has manifest', () => {
      expect(pwaConfig.manifest).toBeDefined();
      expect(pwaConfig.manifest).toBe(manifest);
    });

    it('globPatterns include common static asset extensions', () => {
      const pattern = pwaConfig.workbox.globPatterns[0];
      expect(pattern).toContain('js');
      expect(pattern).toContain('css');
      expect(pattern).toContain('html');
    });
  });
});
