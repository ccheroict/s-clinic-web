/**
 * PWA configuration for s-clinic-web.
 * Extracted as a module so it can be tested independently.
 *
 * Requirements: 1.1 (manifest), 8.3 (Service Worker caching strategy)
 */

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export interface PwaManifest {
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  display: string;
  orientation: string;
  scope: string;
  start_url: string;
  icons: ManifestIcon[];
}

export interface RuntimeCacheEntry {
  urlPattern: RegExp;
  handler: string;
  options?: Record<string, unknown>;
}

export interface PwaConfig {
  registerType: string;
  includeAssets: string[];
  manifest: PwaManifest;
  workbox: {
    globPatterns: string[];
    runtimeCaching: RuntimeCacheEntry[];
  };
}

/**
 * The PWA manifest configuration.
 * Requirement 1.1: name, icons 192/512, theme_color, display standalone.
 */
export const manifest: PwaManifest = {
  name: 'S-Clinic',
  short_name: 'S-Clinic',
  description: 'Phần mềm quản lý phòng khám da liễu',
  theme_color: '#1976D2',
  background_color: '#FFFFFF',
  display: 'standalone',
  orientation: 'portrait-primary',
  scope: '/',
  start_url: '/',
  icons: [
    {
      src: 'pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
};

/**
 * Runtime caching rules for Workbox.
 * Requirement 8.3: /api/** must use NetworkOnly — never cache patient data.
 */
export const runtimeCaching: RuntimeCacheEntry[] = [
  {
    urlPattern: /\/api\/.*/,
    handler: 'NetworkOnly',
    options: {
      cacheName: 'api-no-cache',
      expiration: {
        maxEntries: 0,
        maxAgeSeconds: 0,
      },
      cacheableResponse: {
        statuses: [], // empty = nothing is cacheable
      },
    },
  },
];

/**
 * Full PWA plugin config object.
 */
export const pwaConfig: PwaConfig = {
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
  manifest,
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching,
  },
};

/**
 * Check whether a given URL path matches the API pattern that should be NetworkOnly.
 * Used for verifying that API responses are never cached.
 */
export function isApiRoute(path: string): boolean {
  return /\/api\//.test(path);
}

/**
 * Get the cache handler for a given path based on runtimeCaching rules.
 * Returns the handler name (e.g. 'NetworkOnly') or 'Precache' for non-matching paths.
 */
export function getCacheHandler(path: string): string {
  for (const rule of runtimeCaching) {
    if (rule.urlPattern.test(path)) {
      return rule.handler;
    }
  }
  return 'Precache';
}
