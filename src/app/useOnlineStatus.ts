/**
 * useOnlineStatus - Composable to track online/offline status
 * 
 * Responsibilities:
 * - Monitor navigator.onLine property
 * - Listen to online/offline events
 * - Return a reactive ref that reflects current online status
 * 
 * Validates: Requirements 8.6, 8.6a
 */

import { ref, onMounted, onUnmounted } from 'vue';

/**
 * Composable to track browser online/offline status
 * @returns Reactive ref: true when online, false when offline
 */
export function useOnlineStatus() {
  const isOnline = ref(navigator.onLine);

  /**
   * Handler for online event
   */
  const handleOnline = () => {
    isOnline.value = true;
  };

  /**
   * Handler for offline event
   */
  const handleOffline = () => {
    isOnline.value = false;
  };

  onMounted(() => {
    // Initialize with current state
    isOnline.value = navigator.onLine;

    // Listen to browser online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  });

  onUnmounted(() => {
    // Clean up event listeners
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  });

  return isOnline;
}