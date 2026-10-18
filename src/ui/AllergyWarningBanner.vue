<script setup lang="ts">
/**
 * The allergy warning at the top of a patient's chart.
 *
 * Requirement 10.4: a prominent warning when a severe allergy is on file. The
 * decision about whether there is anything to warn about lives in
 * domain/allergyWarning so it can be tested without a component; this file is
 * only responsible for making it hard to miss.
 *
 * Prominence here means an error-coloured banner at the top of the card, with
 * the substances named rather than counted, and no dismiss button. A banner that
 * can be dismissed is a banner that is dismissed, and this one has to still be
 * there when the prescription is written.
 */
import { computed } from 'vue';

import { allergyWarningFor, needsAllergyReview } from '../domain/allergyWarning';
import type { Allergy, Patient } from '../domain/types';

const props = defineProps<{
  patient: Pick<Patient, 'allergyReviewRequired' | 'allergyLegacyNote'> | null;
  allergies: Allergy[] | null;
  /** Whether the current user may confirm the legacy review. Doctors and admins. */
  canReview?: boolean;
  reviewPending?: boolean;
}>();

const emit = defineEmits<{ (e: 'mark-reviewed'): void }>();

const warning = computed(() => allergyWarningFor(props.patient, props.allergies));

/**
 * Shown alongside a severe warning rather than instead of it: the unreviewed
 * prose may name a substance the coded records do not.
 */
const showReviewNotice = computed(() => needsAllergyReview(props.patient));

const substanceList = computed(() => warning.value.substances.join(', '));
</script>

<template>
  <!--
    role="alert" so a screen reader announces this when the chart loads, rather
    than only reaching it after the demographic fields. A severe allergy is the
    one thing on this page that changes what the clinician is allowed to do next.
  -->
  <v-alert
    v-if="warning.level === 'severe'"
    type="error"
    variant="flat"
    prominent
    role="alert"
    aria-live="assertive"
    class="mb-4"
    data-testid="allergy-severe-banner"
  >
    <v-alert-title class="text-wrap">Dị ứng nặng</v-alert-title>

    <div class="mt-1">
      <strong>{{ substanceList }}</strong>
    </div>
    <div class="mt-1 text-body-2">
      Không kê các thuốc chứa thành phần trên. Kiểm tra lại trước khi chỉ định.
    </div>
  </v-alert>

  <!--
    The patient whose allergies are a sentence nobody has processed. Warning
    rather than error: there may be nothing wrong, and nobody knows yet, which is
    precisely the thing being reported.
  -->
  <v-alert
    v-if="showReviewNotice"
    type="warning"
    variant="tonal"
    role="status"
    class="mb-4"
    data-testid="allergy-review-banner"
  >
    <v-alert-title class="text-wrap">Dị ứng chưa được rà soát</v-alert-title>

    <div class="mt-1 text-body-2">
      Thông tin dị ứng của bệnh nhân này đang ở dạng văn bản tự do, hệ thống
      không kiểm tra tự động được khi kê thuốc.
    </div>

    <div v-if="warning.legacyNote" class="mt-2">
      <div class="text-caption text-medium-emphasis">Nội dung đã ghi:</div>
      <div class="text-body-2 font-italic" data-testid="allergy-legacy-note">
        {{ warning.legacyNote }}
      </div>
    </div>

    <template v-if="canReview" #append>
      <v-btn
        variant="text"
        size="small"
        :loading="reviewPending"
        data-testid="allergy-mark-reviewed"
        @click="emit('mark-reviewed')"
      >
        Đã rà soát
      </v-btn>
    </template>
  </v-alert>
</template>
