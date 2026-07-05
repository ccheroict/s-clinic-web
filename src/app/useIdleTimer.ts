/**
 * useIdleTimer - Composable to track user idle time
 *
 * Responsibilities:
 * - Monitor user interactions (mousemove, keydown, click, touchstart)
 * - Reset timer on any interaction
 * - After 15 minutes of inactivity: call clearSensitive() + navigate to login
 *
 * Validates: Requirements 8.5
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { clearSensitive } from '../infra/sessionScrubber';

/** Idle timeout duration: 15 minutes in milliseconds */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** Events that indicate user activity */
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'keydown',
  'click',
  'touchstart',
];

/**
 * Composable that monitors user idle time.
 * When user is inactive for 15 minutes, clears sensitive data and navigates to login.
 *
 * @param options - Optional configuration for testing/customization
 * @param options.timeoutMs - Override idle timeout (default: 15 minutes)
 * @param options.onIdle - Optional callback invoked when idle timeout fires (for testing)
 */
export function useIdleTimer(options?: {
  timeoutMs?: number;
  onIdle?: () => void;
}) {
  const router = useRouter();
  const timeoutMs = options?.timeoutMs ?? IDLE_TIMEOUT_MS;

  let timerId: ReturnType<typeof setTimeout> | null = null;
  const isIdle = ref(false);

  /**
   * Handle idle timeout expiration.
   * Clears sensitive data and navigates to login page.
   */
  function handleIdle(): void {
    isIdle.value = true;
    clearSensitive();

    if (options?.onIdle) {
      options.onIdle();
    }

    router.push('/login');
  }

  /**
   * Reset the idle timer. Called on any user interaction.
   */
  function resetTimer(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    isIdle.value = false;
    timerId = setTimeout(handleIdle, timeoutMs);
  }

  /**
   * Start listening for user activity events and begin the timer.
   */
  function start(): void {
    // Start the initial timer
    timerId = setTimeout(handleIdle, timeoutMs);

    // Listen for user activity events
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }
  }

  /**
   * Stop the idle timer and remove all event listeners.
   */
  function stop(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }

    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, resetTimer);
    }
  }

  onMounted(() => {
    start();
  });

  onUnmounted(() => {
    stop();
  });

  return {
    /** Whether the user is currently considered idle */
    isIdle,
    /** Manually reset the idle timer */
    resetTimer,
    /** Stop the idle timer (useful for cleanup) */
    stop,
    /** Start the idle timer (called automatically on mount) */
    start,
  };
}
