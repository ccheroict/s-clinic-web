/**
 * Vuetify Plugin Configuration
 *
 * Configures Vuetify with custom breakpoints and theme for s-clinic-web.
 *
 * Breakpoints (R3.1–R3.3):
 * - xs: 0–319 (below minimum supported, treated as mobile)
 * - sm: 320–767 (mobile layout)
 * - md: 768–1023 (tablet layout)
 * - lg: 1024+ (desktop layout)
 * - xl: 1280+ (large desktop)
 *
 * Touch targets (R3.5):
 * - All interactive elements use Vuetify's density system
 * - Minimum touch target: 44×44px enforced via defaults
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { createVuetify } from 'vuetify';
import 'vuetify/styles';

/**
 * Custom breakpoint thresholds matching requirements:
 * - Mobile: 320px–767px (sm breakpoint starts at 320)
 * - Tablet: 768px–1023px (md breakpoint starts at 768)
 * - Desktop: 1024px+ (lg breakpoint starts at 1024)
 */
export const breakpointThresholds = {
  xs: 0,
  sm: 320,
  md: 768,
  lg: 1024,
  xl: 1280,
};

/**
 * Vuetify display options for responsive layout.
 *
 * The mobileBreakpoint is set to 'sm' so that `useDisplay().mobile`
 * returns true when viewport < md (768px), aligning with R3.1.
 */
export const displayOptions = {
  mobileBreakpoint: 'md' as const,
  thresholds: breakpointThresholds,
};

/**
 * Default component props ensuring touch targets ≥ 44px (R3.5).
 *
 * Vuetify components respect density and min-height/min-width.
 * Setting default sizes and densities ensures interactive elements
 * meet the 44px minimum touch target on mobile.
 */
export const componentDefaults = {
  VBtn: {
    minHeight: 44,
    minWidth: 44,
  },
  VListItem: {
    minHeight: 44,
  },
  VTextField: {
    density: 'comfortable' as const,
  },
  VSelect: {
    density: 'comfortable' as const,
  },
  VTextarea: {
    density: 'comfortable' as const,
  },
  VCheckbox: {
    density: 'comfortable' as const,
  },
  VSwitch: {
    density: 'comfortable' as const,
  },
  VChip: {
    size: 'default' as const,
  },
  VTab: {
    minWidth: 44,
  },
  VAppBarNavIcon: {
    size: 'default' as const,
  },
};

/**
 * Create and export the configured Vuetify instance.
 *
 * Usage in main.ts:
 *   import { vuetify } from './plugins/vuetify';
 *   app.use(vuetify);
 */
export const vuetify = createVuetify({
  display: displayOptions,
  defaults: componentDefaults,
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
});
