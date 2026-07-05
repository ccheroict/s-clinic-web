<script setup lang="ts">
/**
 * RoleGate - Conditionally renders slot content based on user role
 *
 * Wraps any content that should only be visible to specific roles.
 * Uses v-if to completely prevent rendering (not just hiding) when
 * the current user's role is not in the allowedRoles list.
 *
 * Validates: Requirements 5.3, 6.11
 */
import { computed } from 'vue';
import type { UserRole } from '../domain/types';
import { useAuthStore } from '../app/authStore';

const props = defineProps<{
  allowedRoles: UserRole[];
}>();

const authStore = useAuthStore();

const isAllowed = computed(() => {
  const currentRole = authStore.currentRole;
  if (!currentRole) return false;
  return props.allowedRoles.includes(currentRole);
});
</script>

<template>
  <slot v-if="isAllowed" />
</template>
