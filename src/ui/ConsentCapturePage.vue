<script setup lang="ts">
/**
 * Collecting a patient's consent.
 *
 * Requirements 11.1–11.7. The screen a receptionist works through when a new
 * patient is received, and the one anyone returns to in order to record a
 * withdrawal.
 *
 * Two things shape the layout. The consents that hold up treatment are shown
 * apart from the optional ones, because "we cannot treat you until you agree to
 * this" and "may we use your photograph in an advertisement" are different
 * conversations and presenting them as one list is how consent stops being
 * freely given. And the patient-facing wording is fetched and displayed before
 * the confirm button is live, because consent to a document nobody opened is not
 * informed consent.
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';

import {
  useConsentStatus,
  useConsentWording,
  useGrantConsent,
  useWithdrawConsent,
} from '../app/consentQueries';
import {
  blockingConsents,
  careMayProceed,
  consentErrorMessage,
  optionalConsents,
  staleWordingConsents,
  unconfiguredConsents,
} from '../domain/consentRules';
import type {
  ConsentCollectionMethod,
  ConsentStatus,
  ConsentTypeCode,
} from '../domain/types';

const route = useRoute();
const router = useRouter();
const { mobile } = useDisplay();

const patientId = computed(() => (route.params.id as string | undefined) ?? null);

const statusQuery = useConsentStatus(patientId);
const grantMutation = useGrantConsent(patientId);
const withdrawMutation = useWithdrawConsent(patientId);

const statuses = computed<ConsentStatus[]>(() => statusQuery.data.value ?? []);
const blocking = computed(() => blockingConsents(statuses.value));
const optional = computed(() => optionalConsents(statuses.value));
const unconfigured = computed(() => unconfiguredConsents(statuses.value));
const staleWording = computed(() => staleWordingConsents(statuses.value));
const granted = computed(() => statuses.value.filter((s) => s.granted));

/** Null when the query has not resolved, so the banner can stay quiet. */
const clearedForCare = computed(() =>
  statusQuery.isPending.value ? null : careMayProceed(statuses.value),
);

const errorMessage = ref('');

// ---------- the grant dialog ----------

const dialogType = ref<ConsentTypeCode | null>(null);
const dialogOpen = computed({
  get: () => dialogType.value !== null,
  set: (open: boolean) => {
    if (!open) {
      closeDialog();
    }
  },
});

const wordingQuery = useConsentWording(dialogType);

const collectionMethod = ref<ConsentCollectionMethod>('PAPER');
const evidence = ref('');

/**
 * Only true once the wording has actually loaded.
 *
 * The confirm button is disabled until then. Recording consent while the
 * document is still a spinner would record that the patient agreed to something
 * the person collecting it could not have shown them.
 */
const wordingReady = computed(() => wordingQuery.data.value !== undefined);

const methodOptions: { value: ConsentCollectionMethod; title: string }[] = [
  { value: 'PAPER', title: 'Bản giấy có ký tên' },
  { value: 'IN_PERSON_DIGITAL', title: 'Ký trên thiết bị tại phòng khám' },
  { value: 'REMOTE_DIGITAL', title: 'Đồng ý từ xa (trực tuyến)' },
  { value: 'VERBAL', title: 'Đồng ý bằng lời (có người ghi nhận)' },
];

function openDialog(type: ConsentTypeCode): void {
  errorMessage.value = '';
  collectionMethod.value = 'PAPER';
  evidence.value = '';
  dialogType.value = type;
}

function closeDialog(): void {
  dialogType.value = null;
}

async function confirmGrant(): Promise<void> {
  if (dialogType.value === null) {
    return;
  }

  try {
    await grantMutation.mutateAsync({
      type: dialogType.value,
      collectionMethod: collectionMethod.value,
      evidence: evidence.value.trim() === '' ? null : evidence.value.trim(),
    });
    closeDialog();
  } catch (error) {
    errorMessage.value = consentErrorMessage(error);
  }
}

// ---------- withdrawal ----------

const withdrawType = ref<ConsentTypeCode | null>(null);
const withdrawNote = ref('');

const withdrawOpen = computed({
  get: () => withdrawType.value !== null,
  set: (open: boolean) => {
    if (!open) {
      withdrawType.value = null;
    }
  },
});

function openWithdraw(type: ConsentTypeCode): void {
  errorMessage.value = '';
  withdrawNote.value = '';
  withdrawType.value = type;
}

async function confirmWithdraw(): Promise<void> {
  if (withdrawType.value === null) {
    return;
  }

  try {
    await withdrawMutation.mutateAsync({
      type: withdrawType.value,
      // Optional on purpose: the right to withdraw is unconditional, and a
      // required reason would be the system asking the patient to justify
      // exercising it.
      note: withdrawNote.value.trim() === '' ? null : withdrawNote.value.trim(),
    });
    withdrawType.value = null;
  } catch (error) {
    errorMessage.value = consentErrorMessage(error);
  }
}

function goBack(): void {
  router.push(patientId.value === null ? '/patients' : `/patients/${patientId.value}`);
}
</script>

<template>
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" :md="10" :lg="8">
        <v-card>
          <v-toolbar color="primary" dark flat>
            <v-btn icon class="touch-target" @click="goBack">
              <v-icon>mdi-arrow-left</v-icon>
            </v-btn>
            <v-toolbar-title>Sự đồng ý của bệnh nhân</v-toolbar-title>
          </v-toolbar>

          <v-card-text :class="mobile ? 'pa-3' : 'pa-4'">
            <v-alert
              v-if="errorMessage"
              type="error"
              variant="tonal"
              closable
              class="mb-4"
              @click:close="errorMessage = ''"
            >
              {{ errorMessage }}
            </v-alert>

            <!--
              Whether treatment can proceed. Only the care-blocking consents
              count: a patient who declines marketing use of their photographs is
              fully treatable, and a banner that demanded everything would turn an
              optional request into a condition of care.
            -->
            <v-alert
              v-if="clearedForCare === false"
              type="warning"
              variant="tonal"
              role="status"
              class="mb-4"
              data-testid="consent-blocking-banner"
            >
              <v-alert-title class="text-wrap">Chưa đủ sự đồng ý để điều trị</v-alert-title>
              <div class="mt-1 text-body-2">
                Còn thiếu {{ blocking.length }} sự đồng ý bắt buộc. Các hành động
                phụ thuộc sẽ bị từ chối cho đến khi thu đủ.
              </div>
            </v-alert>

            <v-alert
              v-else-if="clearedForCare === true"
              type="success"
              variant="tonal"
              role="status"
              class="mb-4"
              data-testid="consent-cleared-banner"
            >
              Đã thu đủ các sự đồng ý bắt buộc cho việc khám và điều trị.
            </v-alert>

            <v-progress-linear v-if="statusQuery.isPending.value" indeterminate class="mb-4" />

            <!-- Required first: they are the reason the patient is waiting. -->
            <section v-if="blocking.length > 0" class="mb-6">
              <h3 class="text-subtitle-1 font-weight-medium mb-2">Bắt buộc</h3>

              <v-list density="comfortable" class="pa-0">
                <v-list-item
                  v-for="status in blocking"
                  :key="status.typeCode"
                  class="px-0"
                  :data-testid="`consent-row-${status.typeCode}`"
                >
                  <v-list-item-title class="text-wrap font-weight-medium">
                    {{ status.typeName }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-wrap">
                    {{ status.description }}
                  </v-list-item-subtitle>

                  <template #append>
                    <v-chip
                      v-if="status.sensitive"
                      size="small"
                      color="warning"
                      variant="tonal"
                      class="mr-2"
                    >
                      Dữ liệu nhạy cảm
                    </v-chip>
                    <v-btn
                      color="primary"
                      variant="flat"
                      size="small"
                      :data-testid="`consent-collect-${status.typeCode}`"
                      @click="openDialog(status.typeCode)"
                    >
                      Thu đồng ý
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
            </section>

            <!--
              Optional, and visibly so. Kept in its own section with a quieter
              presentation: bundling these with the required ones is how a patient
              comes to believe that agreeing to advertising is part of being
              treated.
            -->
            <section v-if="optional.length > 0" class="mb-6">
              <h3 class="text-subtitle-1 font-weight-medium mb-1">Tùy chọn</h3>
              <p class="text-body-2 text-medium-emphasis mb-2">
                Bệnh nhân có quyền từ chối. Việc từ chối không ảnh hưởng đến việc
                khám và điều trị.
              </p>

              <v-list density="comfortable" class="pa-0">
                <v-list-item
                  v-for="status in optional"
                  :key="status.typeCode"
                  class="px-0"
                  :data-testid="`consent-row-${status.typeCode}`"
                >
                  <v-list-item-title class="text-wrap">
                    {{ status.typeName }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-wrap">
                    {{ status.description }}
                  </v-list-item-subtitle>

                  <template #append>
                    <v-btn
                      variant="tonal"
                      size="small"
                      :data-testid="`consent-collect-${status.typeCode}`"
                      @click="openDialog(status.typeCode)"
                    >
                      Thu đồng ý
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
            </section>

            <!-- Already collected, with withdrawal available on each. -->
            <section v-if="granted.length > 0" class="mb-6">
              <h3 class="text-subtitle-1 font-weight-medium mb-2">Đã đồng ý</h3>

              <v-list density="comfortable" class="pa-0">
                <v-list-item
                  v-for="status in granted"
                  :key="status.typeCode"
                  class="px-0"
                  :data-testid="`consent-granted-${status.typeCode}`"
                >
                  <v-list-item-title class="text-wrap">
                    <v-icon color="success" size="small" class="mr-1">mdi-check-circle</v-icon>
                    {{ status.typeName }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-wrap">
                    Bản {{ status.currentVersion }}
                    <span v-if="status.supersededWording">
                      — nội dung đã có bản mới, nên thu lại khi bệnh nhân đến lần tới
                    </span>
                  </v-list-item-subtitle>

                  <template #append>
                    <v-btn
                      variant="text"
                      size="small"
                      color="error"
                      :data-testid="`consent-withdraw-${status.typeCode}`"
                      @click="openWithdraw(status.typeCode)"
                    >
                      Rút đồng ý
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
            </section>

            <!--
              Types with no published wording. Shown rather than hidden: a
              receptionist who cannot find a consent needs to be told that nobody
              has published its text, not left to decide the system is broken.
            -->
            <v-alert
              v-if="unconfigured.length > 0"
              type="info"
              variant="tonal"
              class="mb-2"
              data-testid="consent-unconfigured"
            >
              <v-alert-title class="text-wrap">Chưa cấu hình nội dung</v-alert-title>
              <div class="mt-1 text-body-2">
                Chưa thể thu các loại sau vì quản trị viên chưa công bố nội dung:
                {{ unconfigured.map((s) => s.typeName).join(', ') }}.
              </div>
            </v-alert>

            <v-alert
              v-if="staleWording.length > 0"
              type="info"
              variant="tonal"
              density="compact"
              data-testid="consent-stale-wording"
            >
              {{ staleWording.length }} sự đồng ý được ký theo nội dung cũ. Vẫn còn
              hiệu lực, nên thu lại theo nội dung mới khi thuận tiện.
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- ---------- collecting one consent ---------- -->
    <v-dialog v-model="dialogOpen" :max-width="mobile ? undefined : 760" :fullscreen="mobile">
      <v-card v-if="dialogType">
        <v-card-title class="text-wrap">
          {{ wordingQuery.data.value?.typeName ?? 'Nội dung đồng ý' }}
        </v-card-title>

        <v-card-text>
          <v-progress-linear v-if="wordingQuery.isPending.value" indeterminate class="mb-3" />

          <v-alert v-if="wordingQuery.isError.value" type="error" variant="tonal">
            Không tải được nội dung đồng ý. Không thể thu đồng ý khi chưa đọc được
            nội dung.
          </v-alert>

          <template v-if="wordingQuery.data.value">
            <!--
              The sensitivity notice comes first and in its own box. It is the
              part NĐ 13/2023 requires the patient to be told in terms, and
              paragraph nine of a long document is not telling them.
            -->
            <v-alert
              v-if="wordingQuery.data.value.sensitivityNotice"
              type="warning"
              variant="tonal"
              class="mb-3"
              data-testid="consent-sensitivity-notice"
            >
              {{ wordingQuery.data.value.sensitivityNotice }}
            </v-alert>

            <div class="text-caption text-medium-emphasis mb-1">
              Mục đích xử lý
            </div>
            <div class="text-body-2 mb-3">{{ wordingQuery.data.value.purpose }}</div>

            <div class="text-caption text-medium-emphasis mb-1">
              Nội dung (bản {{ wordingQuery.data.value.version }})
            </div>
            <div
              class="text-body-2 mb-4"
              style="white-space: pre-wrap; max-height: 40vh; overflow-y: auto"
              data-testid="consent-content"
            >
              {{ wordingQuery.data.value.content }}
            </div>

            <v-select
              v-model="collectionMethod"
              :items="methodOptions"
              item-title="title"
              item-value="value"
              label="Phương thức thu"
              density="comfortable"
              class="mb-2"
            />

            <v-text-field
              v-model="evidence"
              label="Bằng chứng (số hồ sơ bản giấy, người làm chứng…)"
              density="comfortable"
              hint="Giúp chứng minh sự đồng ý về sau. Nên ghi, nhất là với đồng ý bằng lời."
              persistent-hint
            />
          </template>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Hủy</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!wordingReady"
            :loading="grantMutation.isPending.value"
            data-testid="consent-confirm"
            @click="confirmGrant"
          >
            Bệnh nhân đã đồng ý
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ---------- withdrawal ---------- -->
    <v-dialog v-model="withdrawOpen" :max-width="mobile ? undefined : 560">
      <v-card>
        <v-card-title class="text-wrap">Rút sự đồng ý</v-card-title>

        <v-card-text>
          <p class="text-body-2 mb-3">
            Sau khi rút, các hành động phụ thuộc sự đồng ý này sẽ bị từ chối ngay.
            Bản ghi cũ được giữ lại để chứng minh sự đồng ý đã từng có hiệu lực.
          </p>

          <v-textarea
            v-model="withdrawNote"
            label="Ghi chú (không bắt buộc)"
            rows="2"
            density="comfortable"
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="withdrawType = null">Hủy</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="withdrawMutation.isPending.value"
            data-testid="consent-withdraw-confirm"
            @click="confirmWithdraw"
          >
            Xác nhận rút
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
