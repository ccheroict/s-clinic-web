<script setup lang="ts">
/**
 * AppShell - Main application layout (responsive)
 *
 * Wraps the entire app in v-app + v-main.
 * Includes:
 * - NavigationMenu (responsive drawer)
 * - OfflineBanner (shows when offline)
 * - LoadingIndicator (shows during pending requests > 300ms)
 * - App bar with hamburger toggle for mobile
 *
 * Responsive layout via Vuetify useDisplay (R3.1–R3.6):
 * - Mobile (<768px): collapsible nav drawer, compact app bar, full-width content
 * - Tablet (768–1023px): persistent nav drawer, standard app bar
 * - Desktop (≥1024px): persistent nav drawer, spacious content with padding
 *
 * Touch targets ≥ 44px enforced via Vuetify defaults (R3.5).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.6, 9.1, 9.2
 */
import { ref, computed } from 'vue';
import { useDisplay } from 'vuetify';
import { useIsFetching } from '@tanstack/vue-query';
import NavigationMenu from './NavigationMenu.vue';
import OfflineBanner from './OfflineBanner.vue';
import LoadingIndicator from './LoadingIndicator.vue';
import InstallButton from './InstallButton.vue';
import { useAuthStore } from '../app/authStore';

const { mobile, mdAndUp, lgAndUp, name: breakpointName } = useDisplay();
const authStore = useAuthStore();

/** Drawer open state (for mobile toggle) */
const drawerOpen = ref(false);

/** Track global loading state via vue-query's isFetching */
const isFetching = useIsFetching();

/**
 * App bar density adapts to screen size:
 * - Mobile: compact (saves vertical space)
 * - Tablet/Desktop: default (more comfortable)
 */
const appBarDensity = computed(() => mobile.value ? 'compact' : 'default');

/**
 * Content container padding adjusts per layout (R3.4 no horizontal scroll):
 * - Mobile: minimal padding (pa-2) to maximize content width
 * - Tablet: moderate padding (pa-4)
 * - Desktop: spacious padding (pa-6)
 */
const containerClass = computed(() => {
  if (lgAndUp.value) return 'pa-6';
  if (mdAndUp.value) return 'pa-4';
  return 'pa-2';
});

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value;
}
</script>

<template>
  <v-app>
    <!-- Global loading indicator with 300ms threshold -->
    <LoadingIndicator :loading="isFetching > 0" />

    <!-- Offline banner -->
    <OfflineBanner />

    <!-- App bar - only shown when authenticated -->
    <v-app-bar
      v-if="authStore.isAuthenticated"
      :density="appBarDensity"
      color="primary"
      elevation="2"
    >
      <!-- Mobile hamburger menu (R3.1: collapsible menu for mobile) -->
      <v-app-bar-nav-icon
        v-if="mobile"
        @click="toggleDrawer"
        aria-label="Toggle navigation menu"
        class="touch-target"
      />

      <v-app-bar-title>S-Clinic</v-app-bar-title>

      <template #append>
        <InstallButton />
      </template>
    </v-app-bar>

    <!-- Navigation drawer - only shown when authenticated -->
    <NavigationMenu
      v-if="authStore.isAuthenticated"
      v-model="drawerOpen"
    />

    <!-- Main content area (R3.4: no horizontal scroll via overflow-x-hidden) -->
    <v-main>
      <v-container fluid :class="containerClass" class="overflow-x-hidden">
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
/**
 * Responsive touch target enforcement (R3.5).
 * Ensures all interactive elements within AppShell have a minimum
 * 44×44px touch area on mobile viewports.
 */
.touch-target {
  min-width: 44px;
  min-height: 44px;
}

/**
 * Prevent horizontal overflow at all breakpoints (R3.4).
 */
.overflow-x-hidden {
  overflow-x: hidden;
}
</style>
