<script setup lang="ts">
/**
 * App.vue - Root application component
 *
 * Wraps the router-view inside AppShell.
 * Initializes:
 * - useIdleTimer (R8.5: auto-logout after 15 minutes idle)
 * - useOnlineStatus (R8.6, R8.6a: track online/offline status)
 * - AuthStore 401 event listener (R4.8: auto-logout on expired session)
 *
 * Validates: Requirements 2.4, 4.6, 7.1, 8.5, 8.6
 */

import { onMounted, onUnmounted, provide } from 'vue';
import { useAuthStore } from './app/authStore';
import { useIdleTimer } from './app/useIdleTimer';
import { useOnlineStatus } from './app/useOnlineStatus';
import AppShell from './ui/AppShell.vue';

const authStore = useAuthStore();

// R8.5: Initialize idle timer (15 min inactivity → clear data + redirect to login)
const { stop: stopIdleTimer } = useIdleTimer();

// R8.6, R8.6a: Track online/offline status reactively
const isOnline = useOnlineStatus();
provide('isOnline', isOnline);

// R4.8: Listen for 401 events to auto-clear session
let cleanupAuthListener: (() => void) | null = null;

onMounted(() => {
  cleanupAuthListener = authStore.setupAuthExpiredListener();
});

onUnmounted(() => {
  stopIdleTimer();
  if (cleanupAuthListener) {
    cleanupAuthListener();
  }
});
</script>

<template>
  <AppShell>
    <router-view />
  </AppShell>
</template>
