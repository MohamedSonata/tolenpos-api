/**
 * Cron Jobs Registry
 * 
 * NOTE: This file is deprecated. Cron jobs are now managed by Strapi's native cron system.
 * See config/cron-tasks.ts for cron job configuration.
 * 
 * The cron job implementations are still in src/cron/jobs/ and are called by Strapi's cron system.
 */

import type { Core } from '@strapi/strapi';

/**
 * @deprecated Use Strapi's native cron system in config/cron-tasks.ts instead
 */
export function initializeCronJobs(strapi: Core.Strapi): void {
  strapi.log.warn('[CronJobs] This function is deprecated. Cron jobs are now managed by Strapi in config/cron-tasks.ts');
}
