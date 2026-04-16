/**
 * Daily Telemetry Snapshot Cron Job
 * Creates one snapshot per active seat per day at 2 AM
 * Reduces storage costs by 99% compared to snapshot-on-every-update
 */

import type { Core } from '@strapi/strapi';

/**
 * Executes the daily snapshot job
 * Called by Strapi's cron system (config/cron-tasks.ts)
 * @param strapi - Strapi instance
 */
export async function executeDailySnapshotJob(strapi: Core.Strapi): Promise<void> {
  const startTime = Date.now();
  
  strapi.log.info('[DailySnapshotJob] Starting daily telemetry snapshot job');

  try {
    const service = strapi.service('api::key-seat.key-seat');
    const summary = await service.createDailySnapshots(50); // Process 50 seats at a time

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    strapi.log.info('[DailySnapshotJob] Daily snapshot job completed', {
      duration: `${duration}s`,
      total: summary.total,
      success: summary.success,
      failed: summary.failed,
      skipped: summary.skipped,
      errorCount: summary.errors.length
    });

    // Log first few errors for debugging
    if (summary.errors.length > 0) {
      strapi.log.error('[DailySnapshotJob] Sample errors:', {
        errors: summary.errors.slice(0, 5)
      });
    }

  } catch (error) {
    strapi.log.error('[DailySnapshotJob] Fatal error in daily snapshot job', {
      error: error.message,
      stack: error.stack
    });
  }
}
