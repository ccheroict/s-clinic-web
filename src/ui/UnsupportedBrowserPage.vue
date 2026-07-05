<script setup lang="ts">
/**
 * UnsupportedBrowserPage.vue - Unsupported Browser notification
 *
 * Displayed when the user's browser does not meet the minimum
 * requirements (not in the supported list or lacks required web features).
 * Lists the supported browsers: Chrome, Edge, Firefox, Safari.
 * Does NOT show a blank screen or technical errors.
 *
 * This page is standalone (no navigation shell) since the app cannot
 * function properly on an unsupported browser.
 *
 * Validates: Requirements 2.2
 */

const supportedBrowsers = [
  { name: 'Google Chrome', icon: 'mdi-google-chrome', url: 'https://www.google.com/chrome/' },
  { name: 'Microsoft Edge', icon: 'mdi-microsoft-edge', url: 'https://www.microsoft.com/edge' },
  { name: 'Mozilla Firefox', icon: 'mdi-firefox', url: 'https://www.mozilla.org/firefox/' },
  { name: 'Apple Safari', icon: 'mdi-apple-safari', url: 'https://www.apple.com/safari/' },
];
</script>

<template>
  <v-app>
    <v-main>
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="10" md="6" class="text-center">
            <v-icon
              size="120"
              color="warning"
              class="mb-4"
            >
              mdi-web-off
            </v-icon>

            <h1 class="text-h4 font-weight-bold mb-2">
              Trình duyệt không được hỗ trợ
            </h1>

            <p class="text-body-1 text-grey-darken-1 mb-6">
              Trình duyệt của bạn không được hỗ trợ hoặc thiếu các tính năng cần thiết để chạy ứng dụng S-Clinic.
              Vui lòng sử dụng một trong các trình duyệt sau (phiên bản ổn định gần nhất):
            </p>

            <v-row justify="center" class="mb-6">
              <v-col
                v-for="browser in supportedBrowsers"
                :key="browser.name"
                cols="6"
                sm="3"
              >
                <v-card
                  variant="outlined"
                  class="pa-4 d-flex flex-column align-center"
                  :href="browser.url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <v-icon size="48" color="primary" class="mb-2">
                    {{ browser.icon }}
                  </v-icon>
                  <span class="text-body-2 font-weight-medium">
                    {{ browser.name }}
                  </span>
                </v-card>
              </v-col>
            </v-row>

            <p class="text-body-2 text-grey">
              Ứng dụng hỗ trợ hai phiên bản ổn định gần nhất của mỗi trình duyệt trên.
            </p>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>
