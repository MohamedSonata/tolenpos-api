/**
 * Customer FCM Token Cleanup Cron Job
 * Removes inactive customer FCM tokens older than 30 days
 * Prevents database accumulation of stale tokens from devices that no longer connect
 * 
 * DOCKER SWARM PROTECTION:
 * Uses distributed locking to ensure only one replica executes this job
 */

import type { Core } from '@strapi/strapi';
import { withLock } from '../utils/distributed-lock';

interface CleanupSummary {
  totalSeatsProcessed: number;
  totalTokensRemoved: number;
  seatsWithRemovals: number;
  errors: Array<{ seatId: string; error: string }>;
}

/**
 * Executes the customer FCM token cleanup job with distributed lock protection
 * Called by Strapi's cron system (config/cron-tasks.ts)
 * @param strapi - Strapi instance
 */
export async function executeCustomerFcmTokenCleanup(strapi: Core.Strapi): Promise<void> {
  const startTime = Date.now();
  
  strapi.log.info('[CustomerFcmTokenCleanup] Starting customer FCM token cleanup job');

  // Execute with distributed lock to prevent duplicate execution across replicas
  const result = await withLock(
    strapi,
    {
      key: 'cleanup-customer-fcm-tokens',
      ttl: 300, // 5 minutes lock (job should complete within this time)
      retryAttempts: 0 // Don't retry - if another replica is running, skip this execution
    },
    async () => {
      try {
        const summary = await cleanupInactiveTokens(strapi);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        strapi.log.info('[CustomerFcmTokenCleanup] Cleanup job completed', {
          duration: `${duration}s`,
          totalSeatsProcessed: summary.totalSeatsProcessed,
          totalTokensRemoved: summary.totalTokensRemoved,
          seatsWithRemovals: summary.seatsWithRemovals,
          errorCount: summary.errors.length
        });

        // Log first few errors for debugging
        if (summary.errors.length > 0) {
          strapi.log.error('[CustomerFcmTokenCleanup] Sample errors:', {
            errors: summary.errors.slice(0, 5)
          });
        }

        return summary;

      } catch (error) {
        strapi.log.error('[CustomerFcmTokenCleanup] Fatal error in cleanup job', {
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    }
  );

  if (!result.success) {
    strapi.log.info('[CustomerFcmTokenCleanup] Job skipped or failed', {
      reason: result.error,
      hostname: process.env.HOSTNAME
    });
  }
}

/**
 * Cleans up inactive customer FCM tokens older than 30 days
 * @param strapi - Strapi instance
 * @returns Cleanup summary with statistics
 */
async function cleanupInactiveTokens(strapi: Core.Strapi): Promise<CleanupSummary> {
  const summary: CleanupSummary = {
    totalSeatsProcessed: 0,
    totalTokensRemoved: 0,
    seatsWithRemovals: 0,
    errors: []
  };

  // Calculate cutoff date (30 days ago)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  try {
    // Query all Key-Seat records with customerFcmTokens populated
    const seats = await strapi.documents('api::key-seat.key-seat').findMany({
      filters: {
        customerFcmTokens: {
          $notNull: true
        }
      },
      populate: {
        customerFcmTokens: true
      },
      status: 'published'
    });

    strapi.log.info('[CustomerFcmTokenCleanup] Found seats to process', {
      count: seats.length
    });

    // Process each seat
    for (const seat of seats) {
      summary.totalSeatsProcessed++;

      try {
        // Skip seats without customerFcmTokens
        if (!seat.customerFcmTokens || seat.customerFcmTokens.length === 0) {
          continue;
        }

        // Identify tokens to keep (updated within 30 days)
        const tokensToKeep = seat.customerFcmTokens.filter((token: any) => {
          // Filter out tokens without required fields
          if (!token.token || !token.deviceId || !token.platform) {
            return false;
          }

          if (!token.lastUpdatedAt) {
            // Keep tokens without lastUpdatedAt (shouldn't happen, but be safe)
            return true;
          }

          const lastUpdated = new Date(token.lastUpdatedAt);
          return lastUpdated >= cutoffDate;
        });

        const tokensRemoved = seat.customerFcmTokens.length - tokensToKeep.length;

        // Only update if tokens were removed
        if (tokensRemoved > 0) {
          // Map to ensure all required fields are present
          const validTokens = tokensToKeep.map((token: any) => ({
            token: token.token,
            deviceId: token.deviceId,
            platform: token.platform,
            deviceName: token.deviceName || 'Unknown Device',
            isActive: token.isActive !== undefined ? token.isActive : true,
            lastUpdatedAt: token.lastUpdatedAt || new Date().toISOString()
          }));

          await strapi.documents('api::key-seat.key-seat').update({
            documentId: seat.documentId,
            data: {
              customerFcmTokens: validTokens
            }
          });

          summary.totalTokensRemoved += tokensRemoved;
          summary.seatsWithRemovals++;

          strapi.log.info('[CustomerFcmTokenCleanup] Removed tokens from seat', {
            seatId: seat.publicSeatId || seat.documentId,
            tokensRemoved,
            tokensRemaining: tokensToKeep.length
          });
        }

      } catch (error) {
        // Log error but continue processing other seats
        const errorMessage = error.message || 'Unknown error';
        summary.errors.push({
          seatId: seat.publicSeatId || seat.documentId,
          error: errorMessage
        });

        strapi.log.error('[CustomerFcmTokenCleanup] Error processing seat', {
          seatId: seat.publicSeatId || seat.documentId,
          error: errorMessage
        });
      }
    }

  } catch (error) {
    strapi.log.error('[CustomerFcmTokenCleanup] Error querying seats', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }

  return summary;
}
