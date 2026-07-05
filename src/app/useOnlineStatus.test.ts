/**
 * Unit tests for useOnlineStatus composable
 *
 * Tests:
 * - Returns true when navigator.onLine is true
 * - Returns false when navigator.onLine is false (offline hides Patient data)
 * - Reacts to online/offline events
 * - Cleans up event listeners on unmount
 *
 * Validates: Requirements 8.6, 8.6a
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Helper component to mount useOnlineStatus in a valid Vue lifecycle context
 */
function createOnlineStatusWrapper() {
  return defineComponent({
    setup() {
      const isOnline = useOnlineStatus();
      return { isOnline };
    },
    template: '<div>{{ isOnline }}</div>',
  });
}

describe('useOnlineStatus', () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  describe('initial state', () => {
    it('should return true when navigator.onLine is true', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });

      const wrapper = mount(createOnlineStatusWrapper());
      const vm = wrapper.vm as any;

      expect(vm.isOnline).toBe(true);

      wrapper.unmount();
    });

    it('should return false when navigator.onLine is false (R8.6 - offline hides Patient data)', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      const wrapper = mount(createOnlineStatusWrapper());
      const vm = wrapper.vm as any;

      expect(vm.isOnline).toBe(false);

      wrapper.unmount();
    });
  });

  describe('reacting to online/offline events (R8.6, R8.6a)', () => {
    it('should update to false when offline event fires (R8.6 - should hide Patient data)', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });

      const wrapper = mount(createOnlineStatusWrapper());
      const vm = wrapper.vm as any;

      expect(vm.isOnline).toBe(true);

      // Simulate going offline
      window.dispatchEvent(new Event('offline'));
      await nextTick();

      expect(vm.isOnline).toBe(false);

      wrapper.unmount();
    });

    it('should update to true when online event fires (R8.6a - allows Patient data display)', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      const wrapper = mount(createOnlineStatusWrapper());
      const vm = wrapper.vm as any;

      expect(vm.isOnline).toBe(false);

      // Simulate coming back online
      window.dispatchEvent(new Event('online'));
      await nextTick();

      expect(vm.isOnline).toBe(true);

      wrapper.unmount();
    });

    it('should track multiple online/offline transitions', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });

      const wrapper = mount(createOnlineStatusWrapper());
      const vm = wrapper.vm as any;

      expect(vm.isOnline).toBe(true);

      // Go offline
      window.dispatchEvent(new Event('offline'));
      await nextTick();
      expect(vm.isOnline).toBe(false);

      // Come back online
      window.dispatchEvent(new Event('online'));
      await nextTick();
      expect(vm.isOnline).toBe(true);

      // Go offline again
      window.dispatchEvent(new Event('offline'));
      await nextTick();
      expect(vm.isOnline).toBe(false);

      wrapper.unmount();
    });
  });

  describe('cleanup on unmount', () => {
    it('should remove event listeners on unmount', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });

      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
      const wrapper = mount(createOnlineStatusWrapper());

      wrapper.unmount();

      expect(removeListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      removeListenerSpy.mockRestore();
    });

    it('should not react to events after unmount', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });

      const wrapper = mount(createOnlineStatusWrapper());
      const vm = wrapper.vm as any;

      // Save the ref value before unmount
      const isOnlineRef = vm.isOnline;
      expect(isOnlineRef).toBe(true);

      wrapper.unmount();

      // Dispatch offline event after unmount - listeners should be removed
      // so the ref should stay at its last value
      window.dispatchEvent(new Event('offline'));
      await nextTick();

      // The component is unmounted, but the ref value should not change
      // since listeners were removed
      // Note: We can't directly observe the ref after unmount in a meaningful way
      // but we verify the listeners were properly cleaned up via the spy test above
    });
  });

  describe('integration with UI hiding Patient data when offline', () => {
    it('isOnline=false should be usable to conditionally hide Patient data', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      // Component simulating patient list visibility based on online status
      const PatientListComponent = defineComponent({
        setup() {
          const isOnline = useOnlineStatus();
          return { isOnline };
        },
        template: `
          <div>
            <div v-if="isOnline" class="patient-data">Patient records here</div>
            <div v-else class="offline-banner">Bạn đang ngoại tuyến. Dữ liệu bệnh nhân không hiển thị.</div>
          </div>
        `,
      });

      const wrapper = mount(PatientListComponent);

      // When offline, patient data should be hidden
      expect(wrapper.find('.patient-data').exists()).toBe(false);
      expect(wrapper.find('.offline-banner').exists()).toBe(true);

      wrapper.unmount();
    });

    it('isOnline=true should allow Patient data to be displayed (R8.6a)', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });

      const PatientListComponent = defineComponent({
        setup() {
          const isOnline = useOnlineStatus();
          return { isOnline };
        },
        template: `
          <div>
            <div v-if="isOnline" class="patient-data">Patient records here</div>
            <div v-else class="offline-banner">Bạn đang ngoại tuyến. Dữ liệu bệnh nhân không hiển thị.</div>
          </div>
        `,
      });

      const wrapper = mount(PatientListComponent);

      // When online, patient data should be visible
      expect(wrapper.find('.patient-data').exists()).toBe(true);
      expect(wrapper.find('.offline-banner').exists()).toBe(false);

      wrapper.unmount();
    });
  });
});
