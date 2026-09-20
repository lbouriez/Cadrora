/**
 * PC owns photo ingress only. Keep this compatibility module so root route
 * assembly can import photo upload/finalize registration from its frozen path.
 */
export { adminImportRoutes, registerAdminImportRoutes } from './imports';
