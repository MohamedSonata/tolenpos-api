/**
 * Cleanup Old Snapshots Cron Job
 * Deletes telemetry snapshots older than retention period (default: 90 days)
 * Runs weekly on Sunday at 3 AM
 */

import type { Core } from '@strapi/strapi';

/**
 * Executes the cleanup job
 * Called by Strapi's cron system (config/cron-tasks.ts)
 * @param strapi - Strapi instance
 */
export async function executeCleanupJob(strapi: Core.Strapi): Promise<void> {
  const startTime = Date.now();
  
  strapi.log.info('[CleanupJob] Starting old snapshot cleanup job');

  try {
    const retentionDays = parseInt(process.env.TELEMETRY_RETENTION_DAYS || '90', 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    strapi.log.info('[CleanupJob] Deleting snapshots older than', {
      cutoffDate: cutoffDate.toISOString(),
      retentionDays
    });

    // Find old snapshots
    const oldSnapshots = await strapi.documents('api::seat-telemetry-history.seat-telemetry-history').findMany({
      filters: {
        capturedAt: {
          $lt: cutoffDate.toISOString()
        }
      },
      fields: ['documentId', 'capturedAt']
    });

    strapi.log.info(`[CleanupJob] Found ${oldSnapshots.length} old snapshots to delete`);

    // Delete in batches
    const batchSize = 100;
    let deletedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < oldSnapshots.length; i += batchSize) {
      const batch = oldSnapshots.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(snapshot => 
          strapi.documents('api::seat-telemetry-history.seat-telemetry-history').delete({
            documentId: snapshot.documentId
          })
        )
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          deletedCount++;
        } else {
          failedCount++;
        }
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    strapi.log.info('[CleanupJob] Cleanup job completed', {
      duration: `${duration}s`,
      found: oldSnapshots.length,
      deleted: deletedCount,
      failed: failedCount,
      retentionDays
    });

  } catch (error) {
    strapi.log.error('[CleanupJob] Fatal error in cleanup job', {
      error: error.message,
      stack: error.stack
    });
  }
}
