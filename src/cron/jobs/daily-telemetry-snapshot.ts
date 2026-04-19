/**
 * Daily Telemetry Snapshot Cron Job
 * Creates one snapshot per active seat per day at 2 AM
 * Reduces storage costs by 99% compared to snapshot-on-every-update
 * 
 * DOCKER SWARM PROTECTION:
 * Uses distributed locking to ensure only one replica executes this job
 */

import type { Core } from '@strapi/strapi';
import { withLock } from '../utils/distributed-lock';

/**
 * Executes the daily snapshot job with distributed lock protection
 * Called by Strapi's cron system (config/cron-tasks.ts)
 * @param strapi - Strapi instance
 */
export async function executeDailySnapshotJob(strapi: Core.Strapi): Promise<void> {
  const startTime = Date.now();
  
  strapi.log.info('[DailySnapshotJob] Starting daily telemetry snapshot job');

  // Execute with distributed lock to prevent duplicate execution across replicas
  const result = await withLock(
    strapi,
    {
      key: 'daily-telemetry-snapshot',
      ttl: 3600, // 1 hour lock (job should complete within this time)
      retryAttempts: 0 // Don't retry - if another replica is running, skip this execution
    },
    async () => {
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

        return summary;

      } catch (error) {
        strapi.log.error('[DailySnapshotJob] Fatal error in daily snapshot job', {
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    }
  );

  if (!result.success) {
    strapi.log.info('[DailySnapshotJob] Job skipped or failed', {
      reason: result.error,
      hostname: process.env.HOSTNAME
    });
  }
}
