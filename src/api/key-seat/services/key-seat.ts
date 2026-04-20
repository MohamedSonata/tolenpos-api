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
    realtimeTelemetry: Record<string, any>,
    historicalKpiSummary: Record<string, any>
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

      // Prepare update data
      const updateData: any = {
        realtimeTelemetry: {
          ...realtimeTelemetry,
          lastUpdated: new Date().toISOString()
        }
      };

      // Add historicalKpiSummary if provided
      if (historicalKpiSummary && Object.keys(historicalKpiSummary).length > 0) {
        updateData.historicalKpiSummary = historicalKpiSummary;
      }

      // Update seat
      const updatedSeat = await strapi.documents('api::key-seat.key-seat').update({
        documentId: keySeatDocumentId,
        status:'published',
        data: updateData,
        populate: ['license']
      });

      strapi.log.info(`[KeySeatService] Seat updated: ${keySeatDocumentId}`, {
        hasHistoricalKpi: !!updatedSeat.historicalKpiSummary,
        hasRealtimeTelemetry: !!updatedSeat.realtimeTelemetry
      });

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
   * Creates timezone-aware daily snapshots for seats where it's end-of-day in their local timezone
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
        timezoneChecked: 0,
        errors: [] as any[]
      };

      // Get all active seats with realtime telemetry and timezone
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

      // Get current UTC time
      const nowUTC = new Date();

      // Process in batches
      for (let i = 0; i < seats.length; i += batchSize) {
        const batch = seats.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (seat) => {
            try {
              summary.timezoneChecked++;

              // Skip if no telemetry data or not an object
              if (!seat.realtimeTelemetry || typeof seat.realtimeTelemetry !== 'object') {
                summary.skipped++;
                return;
              }

              // Get seat timezone (default to UTC if not set)
              const seatTimezone = seat.timezone || 'UTC';

              // Calculate local time in seat's timezone
              const localTime = this.getLocalTimeInTimezone(nowUTC, seatTimezone);
              const localHour = localTime.getHours();
              const localMinute = localTime.getMinutes();

              // Only create snapshot if it's between 23:55 and 23:59 in the seat's local time
              if (localHour === 23 && localMinute >= 55) {
                // Check if we already created a snapshot today for this seat
                const today = localTime.toISOString().split('T')[0]; // YYYY-MM-DD
                const existingSnapshot = await this.hasSnapshotForDate(seat.documentId, today);

                if (existingSnapshot) {
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
                  {
                    ...telemetryData,
                    snapshotLocalTime: localTime.toISOString(),
                    snapshotTimezone: seatTimezone
                  },
                  'daily'
                );
                
                summary.success++;

                strapi.log.info(`[KeySeatService] Created timezone-aware snapshot for seat ${seat.documentId}`, {
                  seatTimezone,
                  localTime: localTime.toISOString(),
                  utcTime: nowUTC.toISOString()
                });
              } else {
                // Not the right time for this seat's timezone
                summary.skipped++;
              }
            } catch (error) {
              summary.failed++;
              summary.errors.push({
                seatId: seat.documentId,
                timezone: seat.timezone,
                error: error.message
              });
            }
          })
        );
      }

      strapi.log.info('[KeySeatService] Timezone-aware daily snapshots completed:', summary);
      return summary;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error creating timezone-aware daily snapshots:', {
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Converts UTC time to local time in specified timezone
   * @param utcDate - UTC date
   * @param timezone - Target timezone (e.g., 'America/New_York', 'Asia/Singapore')
   * @returns Local date in the specified timezone
   */
  getLocalTimeInTimezone(utcDate: Date, timezone: string): Date {
    try {
      // Use Intl.DateTimeFormat to get the time in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(utcDate);
      const partsObj = parts.reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {} as any);

      // Create local date
      const localDate = new Date(
        parseInt(partsObj.year),
        parseInt(partsObj.month) - 1, // Month is 0-indexed
        parseInt(partsObj.day),
        parseInt(partsObj.hour),
        parseInt(partsObj.minute),
        parseInt(partsObj.second)
      );

      return localDate;
    } catch (error) {
      strapi.log.error(`[KeySeatService] Error converting timezone ${timezone}:`, error.message);
      // Fallback to UTC if timezone conversion fails
      return utcDate;
    }
  },

  /**
   * Checks if a snapshot already exists for a specific date
   * @param keySeatDocumentId - Document ID of the key-seat
   * @param dateString - Date string in YYYY-MM-DD format
   * @returns Boolean indicating if snapshot exists
   */
  async hasSnapshotForDate(keySeatDocumentId: string, dateString: string): Promise<boolean> {
    try {
      const startOfDay = `${dateString}T00:00:00.000Z`;
      const endOfDay = `${dateString}T23:59:59.999Z`;

      const snapshots = await strapi.documents('api::seat-telemetry-history.seat-telemetry-history').findMany({
        filters: {
          keySeat: {
            documentId: keySeatDocumentId
          },
          snapshotType: 'daily',
          capturedAt: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        },
        limit: 1
      });

      return snapshots.length > 0;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error checking existing snapshot:', {
        keySeatDocumentId,
        dateString,
        error: error.message
      });
      return false; // Assume no snapshot exists if check fails
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
