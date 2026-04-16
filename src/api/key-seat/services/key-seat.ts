/**
 * key-seat service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::key-seat.key-seat', ({ strapi }) => ({
  /**
   * Updates seat real-time telemetry data and creates historical snapshot
   * @param keySeatDocumentId - Document ID of the key-seat
   * @param realtimeTelemetry - Real-time telemetry data object
   * @returns Updated key-seat document
   */
  async updateSeatTelemetry(
    keySeatDocumentId: string,
    realtimeTelemetry: Record<string, any>
  ) {
    try {
      // Validate seat exists and get license info
      const existingSeat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId: keySeatDocumentId,
        status:'published',
        populate: ['license']
      });

      if (!existingSeat) {
        throw new Error(`Key-seat not found: ${keySeatDocumentId}`);
      }

      // Update real-time telemetry in key-seat (preserves initial activation telemetry)
      const updatedSeat = await strapi.documents('api::key-seat.key-seat').update({
        documentId: keySeatDocumentId,
       status:'published',
        data: {
          
          realtimeTelemetry: {
            ...realtimeTelemetry,
            lastUpdated: new Date().toISOString()
          }
        } as any,
        populate: ['license']
      });

      // Note: Automatic snapshots removed to reduce storage costs
      // Daily snapshots are created via cron job
      // Real-time queries use Socket.IO to fetch data from POS device

      return updatedSeat;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error updating seat real-time telemetry:', {
        keySeatDocumentId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Creates a historical telemetry snapshot
   * @param keySeatDocumentId - Document ID of the key-seat
   * @param telemetryData - Telemetry data to snapshot
   * @param snapshotType - Type of snapshot (realtime, hourly, daily)
   * @returns Created snapshot document
   */
  async createTelemetrySnapshot(
    keySeatDocumentId: string,
    telemetryData: Record<string, any>,
    snapshotType: 'realtime' | 'hourly' | 'daily' = 'realtime'
  ) {
    try {
      const snapshot = await strapi.documents('api::seat-telemetry-history.seat-telemetry-history').create({
        status:"published",
        data: {
       
          keySeat: keySeatDocumentId,
          telemetryData,
          capturedAt: new Date().toISOString(),
          snapshotType
        }
      } );

      strapi.log.info('[KeySeatService] Telemetry snapshot created:', {
        keySeatDocumentId,
        snapshotType,
        snapshotId: snapshot.documentId
      });

      return snapshot;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error creating telemetry snapshot:', {
        keySeatDocumentId,
        snapshotType,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Gets telemetry history for a seat with date range filtering
   * @param keySeatDocumentId - Document ID of the key-seat
   * @param startDate - Start date for filtering (ISO string)
   * @param endDate - End date for filtering (ISO string)
   * @param page - Page number for pagination
   * @param pageSize - Number of records per page
   * @returns Array of telemetry history records
   */
  async getSeatTelemetryHistory(
    keySeatDocumentId: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 100
  ) {
    try {
      const filters: any = {
        keySeat: {
          documentId: keySeatDocumentId
        }
      };

      // Add date range filters if provided
      if (startDate || endDate) {
        filters.capturedAt = {};
        if (startDate) {
          filters.capturedAt.$gte = startDate;
        }
        if (endDate) {
          filters.capturedAt.$lte = endDate;
        }
      }

      const history = await strapi.documents('api::seat-telemetry-history.seat-telemetry-history').findMany({
        filters,
        sort: { capturedAt: 'desc' } as any,
        start: (page - 1) * pageSize,
        limit: pageSize,
        populate: ['keySeat'] as any
      });

      return history;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error getting seat telemetry history:', {
        keySeatDocumentId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Gets all seats for a user
   * @param userDocumentId - Document ID of the user
   * @returns Array of key-seat documents with populated relations
   */
  async getUserSeats(userDocumentId: string) {
    try {
      // Find all licenses for the user first
      const licenses = await strapi.documents('api::license.license').findMany({
        filters: {
          user: {
            documentId: userDocumentId
          }
        },
        status: 'published'
      });

      if (!licenses || licenses.length === 0) {
        return [];
      }

      // Get license document IDs
      const licenseDocumentIds = licenses.map(license => license.documentId);

      // Find all seats that belong to these licenses with full data
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: {
          license: {
            documentId: {
              $in: licenseDocumentIds
            }
          }
        },
        status: 'published',
        populate: ['license']
      });

      // Map seats with license information
      const seatsWithLicenseInfo = seats.map(seat => {
        const license = licenses.find(l => l.documentId === seat.license.documentId);
        return {
          ...seat,
          licenseDocumentId: license.documentId,
          licenseKey: license.licenseKey,
          planSubscriptionType: license.planSubscriptionType
        };
      });

      return seatsWithLicenseInfo;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error getting user seats:', {
        userDocumentId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Creates daily snapshots for all active seats (used by cron job)
   * @param batchSize - Number of seats to process at once
   * @returns Summary of snapshot creation
   */
  async createDailySnapshots(batchSize: number = 50) {
    try {
      const summary = {
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [] as any[]
      };

      // Get all active seats with realtime telemetry
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: {
          isActive: true,
          realtimeTelemetry: {
            $notNull: true
          }
        },
        limit: 10000 // Adjust based on your scale
      });

      summary.total = seats.length;

      // Process in batches
      for (let i = 0; i < seats.length; i += batchSize) {
        const batch = seats.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (seat) => {
            try {
              // Skip if no telemetry data or not an object
              if (!seat.realtimeTelemetry || typeof seat.realtimeTelemetry !== 'object') {
                summary.skipped++;
                return;
              }

              // Type guard: ensure it's a Record<string, any>
              const telemetryData = seat.realtimeTelemetry as Record<string, any>;
              
              if (Object.keys(telemetryData).length === 0) {
                summary.skipped++;
                return;
              }

              await this.createTelemetrySnapshot(
                seat.documentId,
                telemetryData,
                'daily'
              );
              
              summary.success++;
            } catch (error) {
              summary.failed++;
              summary.errors.push({
                seatId: seat.documentId,
                error: error.message
              });
            }
          })
        );
      }

      strapi.log.info('[KeySeatService] Daily snapshots completed:', summary);
      return summary;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error creating daily snapshots:', {
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Gets the latest snapshot for a seat (fallback when POS offline)
   * @param keySeatDocumentId - Document ID of the key-seat
   * @returns Latest snapshot or null
   */
  async getLatestSnapshot(keySeatDocumentId: string) {
    try {
      const snapshots = await strapi.documents('api::seat-telemetry-history.seat-telemetry-history').findMany({
        filters: {
          keySeat: {
            documentId: keySeatDocumentId
          }
        },
        sort: { capturedAt: 'desc' } as any,
        limit: 1
      });

      return snapshots[0] || null;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error getting latest snapshot:', {
        keySeatDocumentId,
        error: error.message
      });
      throw error;
    }
  }
}));
