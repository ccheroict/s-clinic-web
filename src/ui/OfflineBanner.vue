<script setup lang="ts">
/**
 * OfflineBanner - Displays a banner when device is offline
 *
 * Uses the useOnlineStatus composable to reactively track connectivity.
 * When offline, shows a persistent banner informing the user.
 *
 * Validates: Requirements 8.6
 */
import { useOnlineStatus } from '../app/useOnlineStatus';

const isOnline = useOnlineStatus();
</script>

<template>
  <v-banner
    v-if="!isOnline"
    color="warning"
    icon="mdi-wifi-off"
    lines="one"
    class="offline-banner"
    stacked
  >
    <v-banner-text>
      Bạn đang ngoại tuyến. Một số chức năng không khả dụng.
    </v-banner-text>
  </v-banner>
</template>

<style scoped>
.offline-banner {
  position: sticky;
  top: 0;
  z-index: 1000;
}
</style>
