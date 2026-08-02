<template>
  <v-container fluid>
    <!-- Page header -->
    <v-row class="mb-4">
      <v-col>
        <h1 class="text-h5">Lịch hẹn hôm nay</h1>
      </v-col>
    </v-row>

    <!-- Loading state -->
    <template v-if="isLoading">
      <v-row class="mb-4">
        <v-col v-for="n in 5" :key="n" cols="12" sm="6" md="4" lg>
          <v-skeleton-loader type="card" />
        </v-col>
      </v-row>
      <v-skeleton-loader type="list-item@3" />
    </template>

    <!-- Main content -->
    <template v-else>
      <!-- Summary cards (R10.2) -->
      <v-row class="mb-6">
        <v-col
          v-for="card in summaryCards"
          :key="card.status"
          cols="6"
          sm="4"
          md
        >
          <v-card :color="card.color" variant="tonal" class="text-center pa-3">
            <v-card-text>
              <div class="text-h4 font-weight-bold">{{ card.count }}</div>
              <div class="text-body-2 mt-1">{{ card.label }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Empty state -->
      <v-alert
        v-if="sortedAppointments.length === 0"
        type="info"
        variant="tonal"
        class="mb-4"
      >
        Không có lịch hẹn nào hôm nay.
      </v-alert>

      <!-- Appointment list (R10.1) -->
      <v-card v-else>
        <v-list lines="two">
          <v-list-item
            v-for="appointment in sortedAppointments"
            :key="appointment.id"
            :class="{ 'upcoming-appointment': isUpcoming(appointment.scheduledAt) }"
          >
            <template #prepend>
              <div class="text-h6 font-weight-bold mr-4" style="min-width: 50px">
                {{ formatTime(appointment.scheduledAt) }}
              </div>
            </template>

            <v-list-item-title class="font-weight-medium">
              {{ appointment.patientName }}
            </v-list-item-title>

            <v-list-item-subtitle>
              {{ appointment.durationMin }} phút
              <span v-if="appointment.reason"> · {{ appointment.reason }}</span>
            </v-list-item-subtitle>

            <template #append>
              <v-chip
                :color="getStatusColor(appointment.status)"
                size="small"
                variant="flat"
              >
                {{ getStatusLabel(appointment.status) }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
      </v-card>
    </template>
  </v-container>
</template>

<script setup lang="ts">
/**
 * TodayDashboard.vue - Doctor's daily appointment dashboard
 *
 * Responsibilities:
 * - Display today's appointments for the logged-in DOCTOR (R10.1)
 * - Summary cards showing count per active status (R10.2)
 * - Highlight appointments within the next 30 minutes (R10.3)
 * - Sort by scheduledAt ascending (R10.4)
 * - Empty state when no appointments
 * - Loading state with skeleton loaders
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */

import { computed } from 'vue';
import { useAuthStore } from '../app/authStore';
import { useTodayAppointments } from '../app/appointmentQueries';
import {
  STATUS_DISPLAY,
  getStatusLabel,
  getStatusColor,
  type AppointmentStatus,
  type Appointment,
} from '../domain/appointmentTypes';
import { isUpcoming } from '../domain/appointmentUtils';
import { storeToRefs } from 'pinia';

const authStore = useAuthStore();
const { username } = storeToRefs(authStore);

/** Fetch today's appointments using username as doctor identifier */
const { data: appointments, isLoading } = useTodayAppointments(username);

/** Active statuses for summary cards */
const ACTIVE_STATUSES: AppointmentStatus[] = [
  'BOOKED',
  'CONFIRMED',
  'ARRIVED',
  'IN_PROGRESS',
  'DONE',
];

/** Client-side sort by scheduledAt ascending as safety measure */
const sortedAppointments = computed<Appointment[]>(() => {
  if (!appointments.value) return [];
  return [...appointments.value].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
});

/** Summary cards with count per status */
const summaryCards = computed(() => {
  const list = appointments.value ?? [];
  return ACTIVE_STATUSES.map((status) => ({
    status,
    label: STATUS_DISPLAY[status].label,
    color: STATUS_DISPLAY[status].color,
    count: list.filter((a) => a.status === status).length,
  }));
});

/** Format ISO datetime to HH:mm */
function formatTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}
</script>

<style scoped>
.upcoming-appointment {
  border-left: 4px solid rgb(var(--v-theme-warning));
  background-color: rgba(var(--v-theme-warning), 0.05);
}
</style>
