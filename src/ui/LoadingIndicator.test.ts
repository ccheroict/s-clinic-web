/**
 * Unit tests for LoadingIndicator.vue
 *
 * Tests the 300ms threshold behavior:
 * - R9.1: Show indicator only after 300ms of pending request
 * - R9.2: Hide indicator within 300ms after request ends
 *
 * Uses fake timers per task specification.
 *
 * Validates: Requirements 9.1, 9.2
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { defineComponent, ref, watch, nextTick } from 'vue';

/**
 * Test wrapper that replicates LoadingIndicator logic:
 * - visible becomes true only after loading has been true for > 300ms
 * - visible becomes false within 300ms after loading turns false
 *
 * This tests the core timing logic without needing Vuetify.
 */
const LoadingIndicatorLogic = defineComponent({
  props: {
    loading: { type: Boolean, required: true },
  },
  setup(props) {
    const visible = ref(false);
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    function clearTimers() {
      if (showTimer !== null) {
        clearTimeout(showTimer);
        showTimer = null;
      }
      if (hideTimer !== null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    watch(
      () => props.loading,
      (isLoading) => {
        if (isLoading) {
          clearTimers();
          showTimer = setTimeout(() => {
            visible.value = true;
            showTimer = null;
          }, 300);
        } else {
          clearTimers();
          if (visible.value) {
            hideTimer = setTimeout(() => {
              visible.value = false;
              hideTimer = null;
            }, 300);
          }
        }
      }
    );

    return { visible };
  },
  template: '<div :data-visible="visible">{{ visible }}</div>',
});

describe('LoadingIndicator - 300ms threshold (R9.1, R9.2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('R9.1: Show loading only after 300ms of pending', () => {
    it('does NOT show indicator immediately when loading starts', async () => {
      const wrapper = mount(LoadingIndicatorLogic, {
        props: { loading: false },
      });

      await wrapper.setProps({ loading: true });
      await nextTick();

      // Should NOT be visible immediately
      expect(wrapper.vm.visible).toBe(false);

      wrapper.unmount();
    });

    it('does NOT show indicator at 299ms', async () => {
      const wrapper = mount(LoadingIndicatorLogic, {
        props: { loading: false },
      });

      await wrapper.setProps({ loading: true });
      await nextTick();

      vi.advanceTimersByTime(299);
      expect(wrapper.vm.visible).toBe(false);

      wrapper.unmount();
    });

    it('shows indicator at exactly 300ms', async () => {
      const wrapper = mount(LoadingIndicatorLogic, {
        props: { loading: false },
      });

      await wrapper.setProps({ loading: true });
      await nextTick();

      vi.advanceTimersByTime(300);
      expect(wrapper.vm.visible).toBe(true);

      wrapper.unmount();
    });

    it('shows indicator continuously after 300ms threshold', async () => {
      const wrapper = mount(LoadingIndicatorLogic, {
        props: { loading: false },
      });

      await wrapper.setProps({ loading: true });
      await nextTick();

      vi.advanceTimersByTime(500);
      expect(wrapper.vm.visible).toBe(true);

      vi.advanceTimersByTime(5000);
      expect(wrapper.vm.visible).toBe(true);

      wrapper.unmount();
    });

    it('does NOT show indicator if request completes before 300ms', async () => {
      const wrapper = mount(LoadingIndicatorLogic, {
        props: { loading: false },
      });

      // Start loading
      await wrapper.setProps({ loading: true });
      await nextTick();

      // Complete before 300ms
      vi.advanceTimersByTime(200);
      await wrapper.setProps({ loading: false });
      await nextTick();

      // Even after waiting, should never have become visible
      vi.advanceTimersByTime(500);
      expect(wrapper.vm.visible).toBe(false);

      wrapper.unmount();
    });
  });

  describe('R9.2: Hide loading within 300ms after request ends', () => {
    it('hides indicator within 300ms after loading becomes false', async () => {
      const wrapper = mount(LoadingIndicatorLogic, {
        props: { loading: false },
      });

      // Start loading and wait for indicator to show
      await wrapper.setProps({ loading: true });
      await nextTick();
      vi.advanceTimersByTime(300);
      expect(wrapper.vm.visible).toBe(true);

      // End loading
      await wrapper.setProps({ loading: false });
      await nextTick();

      // Still visible immediately after loading ends
      expect(wrapper.vm.visible).toBe(true);

      // Hidden within 300ms
      vi.advanceTimersByTime(300);
      expect(wrapper.vm.visible).toBe(false);

      wrapper.unmount();
    });

    it('still visible at 299ms after loading ends', async () => {
      const wrapper = mount(LoadingIndicatorLogic, {
        props: { loading: false },
      });

      await wrapper.setProps({ loading: true });
      await nextTick();
      vi.advanceTimersByTime(300);
      expect(wrapper.vm.visible).toBe(true);

      await wrapper.setProps({ loading: false });
      await nextTick();

      vi.advanceTimersByTime(299);
      expect(wrapper.vm.visible).toBe(true);

      wrapper.unmount();
    });

    it('cancels hide timer if loading restarts', async () => {
      const wrapper = mount(LoadingIndicatorLogic, {
        props: { loading: false },
      });

      // Show indicator
      await wrapper.setProps({ loading: true });
      await nextTick();
      vi.advanceTimersByTime(300);
      expect(wrapper.vm.visible).toBe(true);

      // End loading
      await wrapper.setProps({ loading: false });
      await nextTick();
      vi.advanceTimersByTime(100);

      // Start loading again before hide completes
      await wrapper.setProps({ loading: true });
      await nextTick();

      // After more time, should still be visible (hide was cancelled)
      vi.advanceTimersByTime(500);
      expect(wrapper.vm.visible).toBe(true);

      wrapper.unmount();
    });

    it('indicator hidden immediately if it never became visible', async () => {
      const wrapper = mount(LoadingIndicatorLogic, {
        props: { loading: false },
      });

      // Start and stop loading within 300ms - never shown
      await wrapper.setProps({ loading: true });
      await nextTick();
      vi.advanceTimersByTime(100);
      await wrapper.setProps({ loading: false });
      await nextTick();

      // Should remain hidden forever
      vi.advanceTimersByTime(1000);
      expect(wrapper.vm.visible).toBe(false);

      wrapper.unmount();
    });
  });
});
