<script setup lang="ts">
/**
 * NotFoundPage.vue - 404 Page Not Found
 *
 * Displays a user-friendly "page not found" message while preserving
 * the navigation shell (AppShell with NavigationMenu).
 * The user can navigate back to a valid page via the navigation menu
 * or the action button.
 *
 * Validates: Requirements 2.5, 7.4
 */
import { useRouter } from 'vue-router';

const router = useRouter();

function goHome() {
  router.push('/patients');
}
</script>

<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" class="text-center">
        <v-icon
          size="120"
          color="grey-lighten-1"
          class="mb-4"
        >
          mdi-file-search-outline
        </v-icon>

        <h1 class="text-h4 font-weight-bold mb-2">
          Không tìm thấy trang
        </h1>

        <p class="text-body-1 text-grey-darken-1 mb-6">
          Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.
        </p>

        <v-btn
          color="primary"
          variant="elevated"
          size="large"
          prepend-icon="mdi-home"
          @click="goHome"
        >
          Quay về trang chính
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>
