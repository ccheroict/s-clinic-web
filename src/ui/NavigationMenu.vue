<script setup lang="ts">
/**
 * NavigationMenu - Responsive navigation drawer
 *
 * Uses Vuetify v-navigation-drawer + v-list + useDisplay.
 *
 * Responsive behavior (R3.1–R3.3):
 * - Mobile (<768px): drawer is temporary (overlay), toggled via hamburger icon
 * - Tablet (768–1023px): drawer is persistent, narrower width (220px)
 * - Desktop (≥1024px): drawer is persistent, full width (256px)
 *
 * Touch targets (R3.5): list items have min-height 44px for mobile.
 *
 * Filters navigation items by the current user's role using visibleNavItems.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 5.5, 7.5
 */
import { computed } from 'vue';
import { useDisplay } from 'vuetify';
import { useRouter } from 'vue-router';
import { visibleNavItems, buildNavModel } from '../domain/navConfig';
import { MODULE_CONFIGS } from '../app/routeGuard';
import { useAuthStore } from '../app/authStore';

const props = defineProps<{
  /** Model value for drawer open state (v-model) */
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { mobile, mdAndUp, lgAndUp } = useDisplay();
const router = useRouter();
const authStore = useAuthStore();

/** Build valid nav model from module configs */
const navModel = computed(() => buildNavModel(MODULE_CONFIGS));

/** Filter visible items based on current user role */
const menuItems = computed(() => {
  const role = authStore.currentRole;
  if (!role) return [];
  return visibleNavItems(navModel.value, role);
});

/** Drawer is temporary (overlay) on mobile, permanent on tablet/desktop */
const drawerTemporary = computed(() => mobile.value);

/**
 * Drawer width adapts to screen size (R3.2, R3.3):
 * - Desktop (≥1024): 256px — spacious
 * - Tablet (768–1023): 220px — narrower to give content more room
 * - Mobile: 280px (temporary overlay, standard mobile drawer width)
 */
const drawerWidth = computed(() => {
  if (lgAndUp.value) return 256;
  if (mdAndUp.value) return 220;
  return 280;
});

/** On mobile, the drawer is only shown when modelValue is true */
const drawerVisible = computed({
  get: () => {
    if (!mobile.value) return true; // Always visible on tablet/desktop
    return props.modelValue;
  },
  set: (val: boolean) => {
    emit('update:modelValue', val);
  },
});

/**
 * List item density:
 * - Mobile: 'default' to ensure ≥ 44px touch targets (R3.5)
 * - Tablet/Desktop: 'compact' for denser navigation
 */
const listDensity = computed(() => mobile.value ? 'default' : 'compact');

function navigateTo(path: string | undefined) {
  if (path) {
    router.push(path);
    // Close drawer on mobile after navigation
    if (mobile.value) {
      emit('update:modelValue', false);
    }
  }
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
  if (mobile.value) {
    emit('update:modelValue', false);
  }
}
</script>

<template>
  <v-navigation-drawer
    v-model="drawerVisible"
    :temporary="drawerTemporary"
    :permanent="!drawerTemporary"
    :width="drawerWidth"
    class="navigation-menu"
  >
    <v-list-item
      title="S-Clinic"
      subtitle="Phòng khám da liễu"
      class="pa-4"
    />

    <v-divider />

    <v-list :density="listDensity" nav>
      <v-list-item
        v-for="item in menuItems"
        :key="item.id"
        :prepend-icon="item.icon"
        :title="item.title"
        :value="item.id"
        :active="$route.path === item.path"
        class="nav-item"
        @click="navigateTo(item.path)"
      />
    </v-list>

    <template #append>
      <v-divider />
      <v-list :density="listDensity" nav>
        <v-list-item
          v-if="authStore.isAuthenticated"
          prepend-icon="mdi-account"
          :title="authStore.username"
          :subtitle="authStore.currentRole ?? ''"
          class="nav-item"
        />
        <v-list-item
          v-if="authStore.isAuthenticated"
          prepend-icon="mdi-logout"
          title="Đăng xuất"
          class="nav-item"
          @click="handleLogout"
        />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<style scoped>
.navigation-menu {
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}

/**
 * Enforce minimum 44px touch targets for nav items (R3.5).
 * Vuetify's density 'default' already provides ~48px height,
 * but this ensures a floor even if density changes.
 */
.nav-item {
  min-height: 44px;
}
</style>
