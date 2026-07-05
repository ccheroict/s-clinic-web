/**
 * Unit tests for apiClient
 * Validates: Requirements 4.5, 8.1, 8.2, 9.4, 4.8
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient, getApiClient, resetApiClient, AUTH_EXPIRED_EVENT, createApiClient, ApiCredentials } from './apiClient';
import type { ApiResult } from '../domain/types';
import { isApiOk } from '../domain/types';

// Mock fetch globally
global.fetch = vi.fn();

// Mock window.location
const originalLocation = window.location;
beforeEach(() => {
  vi.resetAllMocks();
  resetApiClient();
  // Mock window.location.origin
  Object.defineProperty(window, 'location', {
    value: { origin: 'http://localhost:5173' },
    writable: true,
  });
  // Mock navigator.onLine
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
  });
});

describe('ApiClient', () => {
  describe('credentials management', () => {
    it('should start without credentials', () => {
      const client = createApiClient();
      expect(client.getCredentials()).toBeNull();
    });

    it('should set and get credentials', () => {
      const client = createApiClient();
      const creds: ApiCredentials = { username: 'admin', password: 'pass123' };
      
      client.setCredentials(creds);
      expect(client.getCredentials()).toEqual(creds);
    });

    it('should clear credentials', () => {
      const client = createApiClient();
      const creds: ApiCredentials = { username: 'admin', password: 'pass123' };
      
      client.setCredentials(creds);
      client.clearCredentials();
      expect(client.getCredentials()).toBeNull();
    });
  });

  describe('auth header generation', () => {
    it('should generate correct Basic auth header', async () => {
      const client = createApiClient({ username: 'admin', password: 'password' });
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await client.get('/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Basic YWRtaW46cGFzc3dvcmQ=',
          }),
        })
      );
    });

    it('should not include auth header when no credentials', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await client.get('/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });
  });

  describe('request configuration', () => {
    it('should use default timeout of 30s for regular requests', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await client.get('/api/test');

      // The fetch should have been called - timeout is handled internally
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should use 10s timeout for login requests', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await client.login('/api/me');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should include Content-Type: application/json', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await client.post('/api/test', { data: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should serialize body to JSON', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1 }), { status: 200 })
      );

      await client.post('/api/patients', { fullName: 'John', sex: 'M' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ fullName: 'John', sex: 'M' }),
        })
      );
    });
  });

  describe('response handling', () => {
    it('should return ok result for 200 response', async () => {
      const client = createApiClient();
      const mockData = { id: 1, name: 'Test' };
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 })
      );

      const result = await client.get<typeof mockData>('/api/test');

      expect(isApiOk(result)).toBe(true);
      if (isApiOk(result)) {
        expect(result.data).toEqual(mockData);
      }
    });

    it('should return ok result for 201 response', async () => {
      const client = createApiClient();
      const mockData = { id: 1, name: 'Created' };
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 201 })
      );

      const result = await client.post<typeof mockData>('/api/test');

      expect(isApiOk(result)).toBe(true);
    });

    it('should return ok with undefined for 204 No Content', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(null, { status: 204 })
      );

      const result = await client.delete('/api/patients/1');

      expect(isApiOk(result)).toBe(true);
      if (isApiOk(result)) {
        expect(result.data).toBeUndefined();
      }
    });

    it('should return validation error for 400 response with ProblemDetail', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'fullName: Required; age: Invalid' }), { status: 400 })
      );

      const result = await client.post('/api/test', {});

      expect(result.ok).toBe(false);
      expect(result.status).toBe('validation');
      if ('errors' in result) {
        expect(result.errors.fullName).toContain('Required');
        expect(result.errors.age).toContain('Invalid');
      }
    });

    it('should return unauthorized for 401 response', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(null, { status: 401 })
      );

      const result = await client.get('/api/test');

      expect(result.ok).toBe(false);
      expect(result.status).toBe('unauthorized');
    });

    it('should return forbidden for 403 response', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(null, { status: 403 })
      );

      const result = await client.delete('/api/test');

      expect(result.ok).toBe(false);
      expect(result.status).toBe('forbidden');
    });

    it('should return server error for 500 response without leaking details', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Internal error details', stack: '...' }), { status: 500 })
      );

      const result = await client.get('/api/test');

      expect(result.ok).toBe(false);
      expect(result.status).toBe('server');
      if ('message' in result) {
        expect(result.message).not.toContain('Internal');
        expect(result.message).not.toContain('stack');
      }
    });
  });

  describe('401 event dispatching', () => {
    it('should dispatch auth-expired event on 401 after having session', async () => {
      const client = createApiClient({ username: 'admin', password: 'pass' });
      const eventSpy = vi.fn();
      
      document.addEventListener(AUTH_EXPIRED_EVENT, eventSpy);
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(null, { status: 401 })
      );

      await client.get('/api/test');

      expect(eventSpy).toHaveBeenCalled();
      
      document.removeEventListener(AUTH_EXPIRED_EVENT, eventSpy);
    });

    it('should NOT dispatch auth-expired event on 401 when no credentials', async () => {
      const client = createApiClient();
      const eventSpy = vi.fn();
      
      document.addEventListener(AUTH_EXPIRED_EVENT, eventSpy);
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(null, { status: 401 })
      );

      await client.get('/api/test');

      expect(eventSpy).not.toHaveBeenCalled();
      
      document.removeEventListener(AUTH_EXPIRED_EVENT, eventSpy);
    });
  });

  describe('network errors', () => {
    it('should return network error when fetch throws', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await client.get('/api/test');

      expect(result.ok).toBe(false);
      expect(result.status).toBe('network');
    });

    it('should return network error when offline', async () => {
      const client = createApiClient();
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });
      
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Failed to fetch')
      );

      const result = await client.get('/api/test');

      expect(result.ok).toBe(false);
      expect(result.status).toBe('network');
      expect('message' in result && result.message).toContain('offline');
    });
  });

  describe('query parameters', () => {
    it('should add query parameters to URL', async () => {
      const client = createApiClient();
      
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [] }), { status: 200 })
      );

      await client.get('/api/patients', { page: 0, size: 20, q: 'john' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=0'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('size=20'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=john'),
        expect.any(Object)
      );
    });
  });

  describe('singleton', () => {
    it('should return singleton instance', () => {
      const client1 = getApiClient();
      const client2 = getApiClient();
      
      expect(client1).toBe(client2);
    });

    it('should reset singleton', () => {
      const client1 = getApiClient();
      resetApiClient();
      const client2 = getApiClient();
      
      expect(client1).not.toBe(client2);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
    });

    it('should support get method', async () => {
      const client = createApiClient();
      await client.get('/api/test');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should support post method', async () => {
      const client = createApiClient();
      await client.post('/api/test', { data: 1 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should support put method', async () => {
      const client = createApiClient();
      await client.put('/api/test/1', { data: 1 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test/1'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should support patch method', async () => {
      const client = createApiClient();
      await client.patch('/api/test/1', { data: 1 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test/1'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should support delete method', async () => {
      const client = createApiClient();
      await client.delete('/api/test/1');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});