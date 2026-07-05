<script setup lang="ts">
/**
 * InstallButton - PWA install prompt trigger
 *
 * Captures the browser's `beforeinstallprompt` event and provides a button
 * for users to install the app. The button remains visible after the user
 * dismisses the prompt so they can re-trigger it later.
 *
 * Hidden when:
 * - Browser doesn't support install (no `beforeinstallprompt` event fired)
 * - Service Worker registration has failed
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 1.7
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';

/**
 * Holds the deferred prompt event from the browser.
 * null when install is not available.
 */
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);

/**
 * Whether the install button should be shown.
 * true only when: beforeinstallprompt fired AND SW is healthy
 */
const showInstallButton = ref(false);

/**
 * Track whether Service Worker registration has failed.
 * When true, the install button is hidden (R1.3).
 */
const swFailed = ref(false);

/**
 * Handle the browser's beforeinstallprompt event.
 * Prevents default browser mini-infobar and stores the event for later use (R1.4).
 */
function handleBeforeInstallPrompt(e: Event) {
  // Prevent the default browser install prompt
  e.preventDefault();
  // Store the event for triggering later
  deferredPrompt.value = e as BeforeInstallPromptEvent;
  // Show install button only if SW hasn't failed (R1.3)
  if (!swFailed.value) {
    showInstallButton.value = true;
  }
}

/**
 * Trigger the install prompt when user clicks the install button (R1.4).
 * After the user responds (accept or dismiss), keep the button visible
 * so they can re-trigger it later (R1.5).
 */
async function installApp() {
  if (!deferredPrompt.value) return;

  // Show the browser's install prompt
  deferredPrompt.value.prompt();

  // Wait for user's choice
  const { outcome } = await deferredPrompt.value.userChoice;

  if (outcome === 'accepted') {
    // User accepted - hide the button since app is installed
    showInstallButton.value = false;
    deferredPrompt.value = null;
  }
  // If dismissed: keep button visible (R1.5) - no action needed
  // The deferredPrompt is consumed after prompt(), but the browser will
  // fire a new beforeinstallprompt if the app still qualifies
}

/**
 * Handle appinstalled event - the app was installed.
 * Hide the button since install is complete.
 */
function handleAppInstalled() {
  showInstallButton.value = false;
  deferredPrompt.value = null;
}

/**
 * Check SW registration status.
 * If SW registration has failed, hide the install button (R1.3).
 */
async function checkServiceWorkerStatus() {
  if (!('serviceWorker' in navigator)) {
    // Browser doesn't support Service Workers - hide install (R1.7)
    swFailed.value = true;
    showInstallButton.value = false;
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    // If there's no registration yet, wait for it (SW might still be registering)
    // The beforeinstallprompt event handles showing the button
    if (registration && registration.installing === null && registration.active === null) {
      // Registration exists but no active worker - possible failure
      swFailed.value = true;
      showInstallButton.value = false;
    }
  } catch {
    // getRegistration failed - SW not available
    swFailed.value = true;
    showInstallButton.value = false;
  }
}

onMounted(() => {
  // Listen for beforeinstallprompt (R1.4)
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  // Listen for appinstalled
  window.addEventListener('appinstalled', handleAppInstalled);
  // Check SW health
  checkServiceWorkerStatus();
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.removeEventListener('appinstalled', handleAppInstalled);
});
</script>

<template>
  <v-btn
    v-if="showInstallButton"
    variant="outlined"
    color="primary"
    size="small"
    prepend-icon="mdi-download"
    aria-label="Cài đặt ứng dụng"
    @click="installApp"
  >
    Cài đặt
  </v-btn>
</template>
