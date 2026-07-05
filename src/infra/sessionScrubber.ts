/**
 * Session Scrubber - Xóa dữ liệu nhạy cảm khỏi browser storage
 *
 * Chịu trách nhiệm xóa dữ liệu Patient_Record khỏi:
 * - Vue Query cache
 * - sessionStorage
 * - localStorage
 *
 * Được gọi khi:
 * - User logout (R4.7, R8.4)
 * - Idle 15 phút (R8.5)
 * - Nhận 401 (R4.8)
 */

import type { VueQueryPluginOptions } from '@tanstack/vue-query';

/**
 * Xóa toàn bộ dữ liệu nhạy cảm khỏi browser storage
 *
 * Clears:
 * - Vue Query cache (query cache)
 * - sessionStorage
 * - localStorage
 *
 * @param queryClient - Optional Vue Query client để xóa cache
 */
export async function clearSensitive(queryClient?: { clear: () => void }): Promise<void> {
  // 1. Xóa vue-query cache (query cache)
  // Wrap in try-catch to ensure storage is cleared even if cache fails
  if (queryClient) {
    try {
      queryClient.clear();
    } catch {
      console.warn('Failed to clear query cache');
    }
  }

  // 2. Xóa sessionStorage
  try {
    sessionStorage.clear();
  } catch {
    // sessionStorage có thể không khả dụng (VD: trong một số context)
    console.warn('Failed to clear sessionStorage');
  }

  // 3. Xóa localStorage
  try {
    localStorage.clear();
  } catch {
    // localStorage có thể không khả dụng (VD: trong một số context)
    console.warn('Failed to clear localStorage');
  }
}

/**
 * Kiểm tra xem trình duyệt có hỗ trợ storage không
 */
export function isStorageAvailable(): {
  sessionStorage: boolean;
  localStorage: boolean;
} {
  return {
    sessionStorage: checkStorageAccess('sessionStorage'),
    localStorage: checkStorageAccess('localStorage'),
  };
}

function checkStorageAccess(storageName: 'sessionStorage' | 'localStorage'): boolean {
  try {
    const storage = window[storageName];
    const testKey = '__storage_test__';
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}