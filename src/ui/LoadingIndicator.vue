<script setup lang="ts">
/**
 * LoadingIndicator - Global loading bar with 300ms threshold
 *
 * Shows a v-progress-linear only when a request has been pending for > 300ms.
 * Hides within 300ms after the request ends.
 *
 * Validates: Requirements 9.1, 9.2
 */
import { ref, watch, onUnmounted } from 'vue';

const props = defineProps<{
  /** Whether a request is currently pending */
  loading: boolean;
}>();

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
      // R9.1: Show indicator only after 300ms of waiting
      clearTimers();
      showTimer = setTimeout(() => {
        visible.value = true;
        showTimer = null;
      }, 300);
    } else {
      // R9.2: Hide indicator within 300ms after request ends
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

onUnmounted(() => {
  clearTimers();
});
</script>

<template>
  <v-progress-linear
    v-if="visible"
    indeterminate
    color="primary"
    height="3"
    class="loading-indicator"
  />
</template>

<style scoped>
.loading-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
}
</style>
