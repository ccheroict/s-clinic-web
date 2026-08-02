/**
 * Vue Router configuration
 *
 * Responsibilities:
 * - Define routes from MODULE_CONFIGS (data-driven navigation)
 * - Register navigation guard for auth + role-based access
 * - Handle back/forward navigation (R2.4)
 * - Catch-all 404 route (R2.5, R7.4)
 *
 * Validates: Requirements 2.4, 2.5, 4.6, 7.1, 7.4
 */

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { createRouteGuard, MODULE_CONFIGS } from './routeGuard';
import { buildNavModel } from '../domain/navConfig';

// Lazy-loaded page components
const LoginPage = () => import('../ui/LoginPage.vue');
const PatientListPage = () => import('../ui/PatientListPage.vue');
const PatientFormPage = () => import('../ui/PatientFormPage.vue');
const AppointmentListPage = () => import('../ui/AppointmentListPage.vue');
const TodayDashboard = () => import('../ui/TodayDashboard.vue');
const NotFoundPage = () => import('../ui/NotFoundPage.vue');
const UnsupportedBrowserPage = () => import('../ui/UnsupportedBrowserPage.vue');

/**
 * Map module IDs to their page components
 * When adding new modules, register their components here.
 */
const moduleComponentMap: Record<string, () => Promise<unknown>> = {
  patients: PatientListPage,
  appointments: AppointmentListPage,
};

/**
 * Build routes dynamically from MODULE_CONFIGS
 * R7.1: Navigation structure is driven by module config list
 */
function buildModuleRoutes(): RouteRecordRaw[] {
  const validModules = buildNavModel(MODULE_CONFIGS);
  const routes: RouteRecordRaw[] = [];

  for (const mod of validModules) {
    const component = moduleComponentMap[mod.id];
    if (component && mod.path) {
      routes.push({
        path: mod.path,
        name: mod.id,
        component,
        meta: {
          title: mod.title,
          requiredRoles: mod.requiredRoles,
        },
      });
    }
  }

  return routes;
}

/**
 * Static routes that are not part of the module config system
 */
const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { public: true },
  },
  {
    path: '/unsupported-browser',
    name: 'unsupported-browser',
    component: UnsupportedBrowserPage,
    meta: { public: true },
  },
  // Patient sub-routes (create/edit)
  {
    path: '/patients/new',
    name: 'patient-create',
    component: PatientFormPage,
    meta: { title: 'Tạo bệnh nhân' },
  },
  {
    path: '/patients/:id',
    name: 'patient-edit',
    component: PatientFormPage,
    meta: { title: 'Cập nhật bệnh nhân' },
  },
  // Appointment sub-routes
  {
    path: '/appointments/today',
    name: 'appointments-today',
    component: TodayDashboard,
    meta: { title: 'Lịch hẹn hôm nay' },
  },
  // Root redirect to patients (default landing page)
  {
    path: '/',
    redirect: '/patients',
  },
  // R7.4: Not found page (named route for internal redirects)
  {
    path: '/not-found',
    name: 'not-found',
    component: NotFoundPage,
    meta: { public: true },
  },
  // R2.5, R7.4: Catch-all for undefined paths → 404
  {
    path: '/:pathMatch(.*)*',
    name: 'catch-all',
    component: NotFoundPage,
    meta: { public: true },
  },
];

/**
 * Create and configure the Vue Router instance
 * Uses HTML5 history mode for clean URLs and proper back/forward support (R2.4)
 */
export function createAppRouter() {
  const moduleRoutes = buildModuleRoutes();

  // Build final route list: static routes first (except catch-all), then module routes, then catch-all last
  const catchAll = staticRoutes[staticRoutes.length - 1]; // /:pathMatch(.*)*
  const notFoundRoute = staticRoutes[staticRoutes.length - 2]; // /not-found
  const otherStaticRoutes = staticRoutes.slice(0, -2);

  const allRoutes: RouteRecordRaw[] = [
    ...otherStaticRoutes,
    ...moduleRoutes,
    notFoundRoute,
    catchAll,
  ];

  const router = createRouter({
    history: createWebHistory(),
    routes: allRoutes,
    // Scroll behavior for back/forward navigation (R2.4)
    scrollBehavior(_to, _from, savedPosition) {
      if (savedPosition) {
        return savedPosition;
      }
      return { top: 0 };
    },
  });

  // Register navigation guard for auth + role-based access (R4.6, R7.6)
  router.beforeEach(createRouteGuard());

  return router;
}
