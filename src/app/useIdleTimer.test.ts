/**
 * Unit tests for useIdleTimer composable
 *
 * Tests:
 * - Idle 15 minutes triggers clearSensitive() + navigates to login (fake timers)
 * - User activity resets the idle timer
 * - Timer is cleaned up on unmount
 *
 * Validates: Requirements 8.5
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { useIdleTimer, IDLE_TIMEOUT_MS } from './useIdleTimer';

// Mock vue-router
const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock sessionScrubber
const mockClearSensitive = vi.fn();
vi.mock('../infra/sessionScrubber', () => ({
  clearSensitive: (...args: any[]) => mockClearSensitive(...args),
}));

/**
 * Helper component to mount useIdleTimer in a valid Vue lifecycle context
 */
function createIdleTimerWrapper(options?: { timeoutMs?: number; onIdle?: () => void }) {
  return defineComponent({
    setup() {
      const idle = useIdleTimer(options);
      return { idle };
    },
    template: '<div></div>',
  });
}

describe('useIdleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have IDLE_TIMEOUT_MS set to 15 minutes', () => {
    expect(IDLE_TIMEOUT_MS).toBe(15 * 60 * 1000);
  });

  describe('idle timeout triggers clearSensitive and navigation to login (R8.5)', () => {
    it('should call clearSensitive() after 15 minutes of inactivity', () => {
      const wrapper = mount(createIdleTimerWrapper());

      // Advance time to just before the timeout
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);
      expect(mockClearSensitive).not.toHaveBeenCalled();

      // Advance past the timeout
      vi.advanceTimersByTime(1);
      expect(mockClearSensitive).toHaveBeenCalledTimes(1);

      wrapper.unmount();
    });

    it('should navigate to /login after 15 minutes of inactivity', () => {
      const wrapper = mount(createIdleTimerWrapper());

      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

      expect(mockPush).toHaveBeenCalledWith('/login');
      expect(mockPush).toHaveBeenCalledTimes(1);

      wrapper.unmount();
    });

    it('should set isIdle to true after timeout fires', () => {
      const wrapper = mount(createIdleTimerWrapper());
      const vm = wrapper.vm as any;

      expect(vm.idle.isIdle.value).toBe(false);

      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

      expect(vm.idle.isIdle.value).toBe(true);

      wrapper.unmount();
    });

    it('should call onIdle callback when provided', () => {
      const onIdle = vi.fn();
      const wrapper = mount(createIdleTimerWrapper({ onIdle }));

      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

      expect(onIdle).toHaveBeenCalledTimes(1);

      wrapper.unmount();
    });

    it('should support custom timeout for testing', () => {
      const customTimeout = 5000; // 5 seconds
      const wrapper = mount(createIdleTimerWrapper({ timeoutMs: customTimeout }));

      vi.advanceTimersByTime(customTimeout - 1);
      expect(mockClearSensitive).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockClearSensitive).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/login');

      wrapper.unmount();
    });
  });

  describe('user activity resets timer', () => {
    it('should reset timer on mousemove event', () => {
      const wrapper = mount(createIdleTimerWrapper());

      // Advance 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(mockClearSensitive).not.toHaveBeenCalled();

      // Simulate user activity
      window.dispatchEvent(new Event('mousemove'));

      // Advance another 10 minutes (should NOT trigger since timer was reset)
      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(mockClearSensitive).not.toHaveBeenCalled();

      // Advance the remaining 5 minutes to complete new 15-minute window
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(mockClearSensitive).toHaveBeenCalledTimes(1);

      wrapper.unmount();
    });

    it('should reset timer on keydown event', () => {
      const wrapper = mount(createIdleTimerWrapper());

      vi.advanceTimersByTime(14 * 60 * 1000); // 14 minutes
      window.dispatchEvent(new Event('keydown'));

      // Should not trigger at original 15-min mark
      vi.advanceTimersByTime(1 * 60 * 1000);
      expect(mockClearSensitive).not.toHaveBeenCalled();

      // Should trigger 15 minutes after last activity
      vi.advanceTimersByTime(14 * 60 * 1000);
      expect(mockClearSensitive).toHaveBeenCalledTimes(1);

      wrapper.unmount();
    });

    it('should reset timer on click event', () => {
      const wrapper = mount(createIdleTimerWrapper());

      vi.advanceTimersByTime(14 * 60 * 1000);
      window.dispatchEvent(new Event('click'));

      vi.advanceTimersByTime(14 * 60 * 1000);
      expect(mockClearSensitive).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1 * 60 * 1000);
      expect(mockClearSensitive).toHaveBeenCalledTimes(1);

      wrapper.unmount();
    });

    it('should reset timer on touchstart event', () => {
      const wrapper = mount(createIdleTimerWrapper());

      vi.advanceTimersByTime(14 * 60 * 1000);
      window.dispatchEvent(new Event('touchstart'));

      vi.advanceTimersByTime(14 * 60 * 1000);
      expect(mockClearSensitive).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1 * 60 * 1000);
      expect(mockClearSensitive).toHaveBeenCalledTimes(1);

      wrapper.unmount();
    });

    it('should set isIdle back to false when activity occurs', () => {
      const wrapper = mount(createIdleTimerWrapper());
      const vm = wrapper.vm as any;

      // Let it go idle
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
      expect(vm.idle.isIdle.value).toBe(true);

      // Trigger a reset
      vm.idle.resetTimer();
      expect(vm.idle.isIdle.value).toBe(false);

      wrapper.unmount();
    });
  });

  describe('cleanup on unmount', () => {
    it('should not trigger after component unmounts', () => {
      const wrapper = mount(createIdleTimerWrapper());

      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
      wrapper.unmount();

      // Advance past the original timeout
      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(mockClearSensitive).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should remove event listeners on unmount', () => {
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
      const wrapper = mount(createIdleTimerWrapper());

      wrapper.unmount();

      expect(removeListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));

      removeListenerSpy.mockRestore();
    });
  });
});
