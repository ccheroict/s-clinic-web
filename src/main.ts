/**
 * main.ts - Application entry point
 *
 * Registers all plugins and mounts the Vue application:
 * - Pinia (state management for AuthStore)
 * - Vue Router (navigation with guards)
 * - VueQueryPlugin (@tanstack/vue-query for server state)
 * - Vuetify (Material Design component library + responsive system)
 *
 * Validates: Requirements 2.4, 2.5, 4.6, 7.1, 7.4
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query';

// Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import App from './App.vue';
import { createAppRouter } from './app/router';

// Create Vuetify instance with Material Design Icons and custom theme
const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976D2',
          secondary: '#424242',
          accent: '#82B1FF',
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FB8C00',
        },
      },
    },
  },
  defaults: {
    VBtn: {
      style: 'min-height: 44px; min-width: 44px;', // R3.5: Touch target >= 44px
    },
    VListItem: {
      style: 'min-height: 44px;', // R3.5: Touch target >= 44px
    },
  },
});

// Create Pinia instance
const pinia = createPinia();

// Create Vue Router instance
const router = createAppRouter();

// VueQuery configuration
const vueQueryOptions: VueQueryPluginOptions = {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30 seconds
        retry: false, // Retry is handled by retryPolicy at the app level (R9.5)
        refetchOnWindowFocus: false,
      },
    },
  },
};

// Create and mount the application
const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(VueQueryPlugin, vueQueryOptions);
app.use(vuetify);

app.mount('#app');
