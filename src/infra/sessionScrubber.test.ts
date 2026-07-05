/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { clearSensitive, isStorageAvailable } from './sessionScrubber';

// Mock window objects
const mockSessionStorage = {
  data: {} as Record<string, string>,
  clear: vi.fn(),
  getItem: vi.fn((key: string) => mockSessionStorage.data[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockSessionStorage.data[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockSessionStorage.data[key]; }),
  key: vi.fn(),
  length: 0,
};

const mockLocalStorage = {
  data: {} as Record<string, string>,
  clear: vi.fn(),
  getItem: vi.fn((key: string) => mockLocalStorage.data[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockLocalStorage.data[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockLocalStorage.data[key]; }),
  key: vi.fn(),
  length: 0,
};

describe('sessionScrubber', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', mockSessionStorage);
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('clearSensitive', () => {
    it('should clear sessionStorage', async () => {
      // Arrange
      mockSessionStorage.data = { patient1: 'test', patient2: 'test2' };

      // Act
      await clearSensitive();

      // Assert
      expect(sessionStorage.clear).toHaveBeenCalled();
    });

    it('should clear localStorage', async () => {
      // Arrange
      mockLocalStorage.data = { patient1: 'test', patient2: 'test2' };

      // Act
      await clearSensitive();

      // Assert
      expect(localStorage.clear).toHaveBeenCalled();
    });

    it('should clear vue-query cache when queryClient is provided', async () => {
      // Arrange
      const mockQueryClient = {
        clear: vi.fn(),
      };

      // Act
      await clearSensitive(mockQueryClient);

      // Assert
      expect(mockQueryClient.clear).toHaveBeenCalled();
    });

    it('should handle missing queryClient gracefully', async () => {
      // Act & Assert - should not throw
      await expect(clearSensitive()).resolves.not.toThrow();
      await expect(clearSensitive(undefined)).resolves.not.toThrow();
    });

    it('should clear all storage even when queryClient throws', async () => {
      // Arrange
      const mockQueryClient = {
        clear: vi.fn(() => { throw new Error('Cache error'); }),
      };

      // Act
      await clearSensitive(mockQueryClient as any);

      // Assert - should still clear storage even if queryClient.clear throws
      expect(sessionStorage.clear).toHaveBeenCalled();
      expect(localStorage.clear).toHaveBeenCalled();
    });
  });

  describe('isStorageAvailable', () => {
    it('should return true when storage is available and accessible', () => {
      // Mock storage with working setItem
      const workingStorage = {
        setItem: vi.fn((key: string, value: string) => {}),
        removeItem: vi.fn((key: string) => {}),
      };

      vi.stubGlobal('sessionStorage', workingStorage);
      vi.stubGlobal('localStorage', workingStorage);

      // Act
      const result = isStorageAvailable();

      // Assert
      expect(result.sessionStorage).toBe(true);
      expect(result.localStorage).toBe(true);
    });

    it('should return false when storage throws on access', () => {
      // Mock storage that throws on setItem
      const brokenStorage = {
        setItem: vi.fn(() => { throw new Error('Storage full'); }),
      };

      vi.stubGlobal('sessionStorage', brokenStorage);
      vi.stubGlobal('localStorage', brokenStorage);

      // Act
      const result = isStorageAvailable();

      // Assert
      expect(result.sessionStorage).toBe(false);
      expect(result.localStorage).toBe(false);
    });
  });
});


// Feature: clinic-frontend-pwa, Property 16: Xóa sạch dữ liệu nhạy cảm
// **Validates: Requirements 8.4**
describe('Property 16: Xóa sạch dữ liệu nhạy cảm', () => {
  // Generator for storage key-value pairs (simulating Patient_Record data)
  const storageKey = fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-.'.split('')),
    { minLength: 1, maxLength: 30 }
  );

  const storageValue = fc.oneof(
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.json(),
    // Simulate patient record JSON
    fc.record({
      id: fc.uuid(),
      fullName: fc.string({ minLength: 1, maxLength: 50 }),
      dob: fc.date().map(d => d.toISOString()),
      sex: fc.constantFrom('M', 'F', 'U'),
      phone: fc.string({ minLength: 5, maxLength: 15 }),
      medicalHistory: fc.string({ minLength: 0, maxLength: 200 }),
      allergies: fc.string({ minLength: 0, maxLength: 100 }),
    }).map(r => JSON.stringify(r))
  );

  // Generator for a set of key-value pairs to populate storage
  const storageEntries = fc.array(
    fc.tuple(storageKey, storageValue),
    { minLength: 0, maxLength: 10 }
  );

  // Generator for query cache entries (simulating vue-query cache data)
  const queryCacheEntries = fc.array(
    fc.tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.anything()
    ),
    { minLength: 0, maxLength: 10 }
  );

  // Helper to create a fake storage backed by a plain object
  function createFakeStorage(store: Record<string, string>) {
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() { return Object.keys(store).length; },
    };
  }

  const emptyStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };

  it('after clearSensitive(), sessionStorage contains no data', async () => {
    await fc.assert(
      fc.asyncProperty(storageEntries, async (entries) => {
        // Arrange: create a storage-like object with data
        const store: Record<string, string> = {};
        for (const [key, value] of entries) {
          store[key] = value;
        }

        vi.stubGlobal('sessionStorage', createFakeStorage(store));
        vi.stubGlobal('localStorage', emptyStorage);

        // Act
        await clearSensitive();

        // Assert: sessionStorage should be empty after clearSensitive
        expect(Object.keys(store).length).toBe(0);

        vi.unstubAllGlobals();
      }),
      { numRuns: 100 }
    );
  });

  it('after clearSensitive(), localStorage contains no data', async () => {
    await fc.assert(
      fc.asyncProperty(storageEntries, async (entries) => {
        // Arrange: create a storage-like object with data
        const store: Record<string, string> = {};
        for (const [key, value] of entries) {
          store[key] = value;
        }

        vi.stubGlobal('localStorage', createFakeStorage(store));
        vi.stubGlobal('sessionStorage', emptyStorage);

        // Act
        await clearSensitive();

        // Assert: localStorage should be empty after clearSensitive
        expect(Object.keys(store).length).toBe(0);

        vi.unstubAllGlobals();
      }),
      { numRuns: 100 }
    );
  });

  it('after clearSensitive(), query cache is cleared', async () => {
    await fc.assert(
      fc.asyncProperty(queryCacheEntries, async (entries) => {
        // Arrange: mock query client with data
        const cache: Map<string, unknown> = new Map();
        for (const [key, value] of entries) {
          cache.set(key, value);
        }

        let cleared = false;
        const mockQueryClient = {
          clear: () => { cache.clear(); cleared = true; },
        };

        vi.stubGlobal('sessionStorage', emptyStorage);
        vi.stubGlobal('localStorage', emptyStorage);

        // Act
        await clearSensitive(mockQueryClient);

        // Assert: query cache should be cleared
        expect(cleared).toBe(true);
        expect(cache.size).toBe(0);

        vi.unstubAllGlobals();
      }),
      { numRuns: 100 }
    );
  });

  it('after clearSensitive(), all three stores are empty simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(
        storageEntries,
        storageEntries,
        queryCacheEntries,
        async (sessionEntries, localEntries, cacheEntries) => {
          // Arrange: populate all stores
          const sessionStore: Record<string, string> = {};
          for (const [key, value] of sessionEntries) {
            sessionStore[key] = value;
          }

          const localStore: Record<string, string> = {};
          for (const [key, value] of localEntries) {
            localStore[key] = value;
          }

          const queryCache: Map<string, unknown> = new Map();
          for (const [key, value] of cacheEntries) {
            queryCache.set(key, value);
          }

          const mockQueryClient = {
            clear: () => { queryCache.clear(); },
          };

          vi.stubGlobal('sessionStorage', createFakeStorage(sessionStore));
          vi.stubGlobal('localStorage', createFakeStorage(localStore));

          // Act
          await clearSensitive(mockQueryClient);

          // Assert: all three stores should be empty
          expect(Object.keys(sessionStore).length).toBe(0);
          expect(Object.keys(localStore).length).toBe(0);
          expect(queryCache.size).toBe(0);

          vi.unstubAllGlobals();
        }
      ),
      { numRuns: 100 }
    );
  });
});
