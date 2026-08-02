/**
 * Utility functions for Appointment module
 *
 * Pure functions extracted for testability and reuse.
 *
 * Validates: Requirements 10.3, 9.4
 */

import type { Appointment } from './appointmentTypes';

/**
 * Determines if an appointment is "upcoming" — i.e., its scheduledAt time
 * falls within the window [now, now + 30 minutes].
 *
 * This is used by TodayDashboard.vue to visually highlight appointments
 * that are about to start within the next 30 minutes.
 *
 * @param scheduledAt - ISO 8601 datetime string of the appointment
 * @param now - Optional current time for testing (defaults to new Date())
 * @returns true if the appointment is within the next 30 minutes
 */
export function isUpcoming(scheduledAt: string, now?: Date): boolean {
  const currentTime = now ?? new Date();
  const appointmentTime = new Date(scheduledAt);

  // If the date is invalid, return false
  if (isNaN(appointmentTime.getTime())) {
    return false;
  }

  const diffMs = appointmentTime.getTime() - currentTime.getTime();
  const thirtyMinutesMs = 30 * 60 * 1000;

  // Appointment must be in the future (or exactly now) AND within 30 minutes
  return diffMs >= 0 && diffMs <= thirtyMinutesMs;
}


/**
 * Checks if a time slot overlaps with an existing appointment.
 *
 * A slot [slotStart, slotStart + slotDuration) overlaps with appointment
 * [apptStart, apptStart + apptDuration) if:
 *   slotStart < apptEnd AND apptStart < slotEnd
 *
 * @param slotTime - Slot start time in "HH:mm" format
 * @param slotDuration - Slot duration in minutes
 * @param appointment - Existing appointment to check against
 * @param date - The date (YYYY-MM-DD) being checked
 * @returns true if the slot is booked (overlaps with the appointment)
 */
function isSlotOverlapping(
  slotTime: string,
  slotDuration: number,
  appointment: Appointment,
  date: string,
): boolean {
  // Parse slot start time
  const [slotHour, slotMin] = slotTime.split(':').map(Number);
  const slotStartMin = slotHour * 60 + slotMin;
  const slotEndMin = slotStartMin + slotDuration;

  // Parse appointment start time (ISO datetime)
  const apptDate = new Date(appointment.scheduledAt);
  // Extract local date from the appointment
  const apptDateStr = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}-${String(apptDate.getDate()).padStart(2, '0')}`;

  // Only consider appointments on the same date
  if (apptDateStr !== date) {
    return false;
  }

  const apptStartMin = apptDate.getHours() * 60 + apptDate.getMinutes();
  const apptEndMin = apptStartMin + appointment.durationMin;

  // Overlap condition: slotStart < apptEnd AND apptStart < slotEnd
  return slotStartMin < apptEndMin && apptStartMin < slotEndMin;
}

/**
 * Computes available time slots for a doctor on a given date,
 * excluding slots that overlap with existing booked appointments.
 *
 * Business hours: 08:00 - 17:00 (slots generated from 08:00 to 16:30 for 30-min slots).
 * Appointments with status CANCELLED or NO_SHOW are not considered.
 *
 * Validates: Requirements 9.4
 *
 * @param bookedAppointments - Existing appointments for the doctor on that date
 * @param date - The date being checked (YYYY-MM-DD format)
 * @param slotDuration - Duration of each slot in minutes (default: 30)
 * @returns Array of available time strings in "HH:mm" format
 */
export function computeAvailableSlots(
  bookedAppointments: Appointment[],
  date: string,
  slotDuration: number = 30,
): string[] {
  // Generate all possible slots within business hours (08:00 - 17:00)
  const allSlots: string[] = [];
  const startHour = 8;
  const endHour = 17;

  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += slotDuration) {
      // Don't generate a slot if it would exceed business hours end
      const slotEndMin = hour * 60 + min + slotDuration;
      if (slotEndMin > endHour * 60) continue;

      allSlots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
  }

  // Filter out appointments that are cancelled or no-show
  const activeAppointments = bookedAppointments.filter(
    (appt) => appt.status !== 'CANCELLED' && appt.status !== 'NO_SHOW',
  );

  // Filter out slots that overlap with active appointments
  return allSlots.filter((slot) => {
    return !activeAppointments.some((appt) =>
      isSlotOverlapping(slot, slotDuration, appt, date),
    );
  });
}
