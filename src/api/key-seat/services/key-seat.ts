/**
 * key-seat service
 */

import { factories } from '@strapi/strapi';
import { safeLogger } from '../../../socketio/utils/safe-logger';

export default factories.createCoreService('api::key-seat.key-seat', ({ strapi }) => ({
  /**
   * Removes 'id' fields from component data recursively
   * Strapi adds 'id' to populated components, but we shouldn't pass them when creating new entries
   * @param data - Component data object
   * @returns Clean data without 'id' fields
   */
  removeComponentIds(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.removeComponentIds(item));
    }

    // Handle objects
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip 'id' field
      if (key === 'id') {
        continue;
      }

      // Recursively clean nested objects/arrays
      if (value && typeof value === 'object') {
        cleaned[key] = this.removeComponentIds(value);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  },

  /**
   * Sanitizes realtime telemetry data to match component schema
   * @param data - Raw telemetry data from POS
   * @returns Sanitized telemetry data
   */
  sanitizeRealtimeTelemetry(data: Record<string, any>): Record<string, any> {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const sanitized: Record<string, any> = {
      networkStatus: data.networkStatus || 'offline',
      lastSyncTime: data.lastSyncTime || new Date().toISOString()
    };

    // Sanitize lastOrder
    if (data.lastOrder && typeof data.lastOrder === 'object') {
      sanitized.lastOrder = {
        receiptNumber: data.lastOrder.receiptNumber || '',
        total: parseFloat(data.lastOrder.total) || 0,
        itemCount: parseInt(data.lastOrder.itemCount) || 0,
        paymentMethod: data.lastOrder.paymentMethod || 'CASH',
        status: data.lastOrder.status || 'COMPLETED',
        createdAt: data.lastOrder.createdAt || new Date().toISOString(),
        items: Array.isArray(data.lastOrder.items) 
          ? data.lastOrder.items.map((item: any) => ({
              productName: item.productName || '',
              quantity: parseInt(item.quantity) || 1,
              price: parseFloat(item.price) || 0
            }))
          : []
      };
    }

    // Sanitize kpiSummary
    if (data.kpiSummary && typeof data.kpiSummary === 'object') {
      sanitized.kpiSummary = {
        totalSales: parseFloat(data.kpiSummary.totalSales) || 0,
        transactionCount: parseInt(data.kpiSummary.transactionCount) || 0,
        averageTransactionValue: parseFloat(data.kpiSummary.averageTransactionValue) || 0,
        period: data.kpiSummary.period || 'today',
        lastUpdated: data.kpiSummary.lastUpdated || new Date().toISOString()
      };
    }

    // Sanitize expenses - filter out invalid entries
    if (Array.isArray(data.expenses)) {
      sanitized.expenses = data.expenses
        .filter((expense: any) => expense && typeof expense === 'object' && (expense.id || expense.expenseId))
        .map((expense: any) => ({
          expenseId: expense.expenseId || expense.id || '',
          title: expense.title || '',
          amount: parseFloat(expense.amount) || 0,
          category: expense.category || 'OTHER',
          paymentMethod: expense.paymentMethod || 'CASH',
          expenseDate: expense.expenseDate || new Date().toISOString(),
          isUrgent: Boolean(expense.isUrgent)
        }));
    }

    return sanitized;
  },

  /**
   * Sanitizes historical KPI summary data to match component schema
   * @param data - Raw historical KPI data from POS
   * @returns Sanitized historical KPI data
   */
  sanitizeHistoricalKpiSummary(data: Record<string, any>): Record<string, any> {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const sanitized: Record<string, any> = {
      cachedAt: data.cachedAt || new Date().toISOString()
    };

    // Sanitize period KPI data (yesterday, thisWeek, thisMonth)
    const periods = ['yesterday', 'thisWeek', 'thisMonth'];
    
    for (const period of periods) {
      if (data[period] && typeof data[period] === 'object') {
        sanitized[period] = {
          totalSales: parseFloat(data[period].totalSales) || 0,
          transactionCount: parseInt(data[period].transactionCount) || 0,
          averageTransactionValue: parseFloat(data[period].averageTransactionValue) || 0,
          grossProfit: parseFloat(data[period].grossProfit) || 0,
          marginPercentage: parseFloat(data[period].marginPercentage) || 0,
          categories: Array.isArray(data[period].categories)
            ? data[period].categories.map((cat: any) => ({
                categoryId: cat.categoryId || '',
                categoryName: cat.categoryName || '',
                totalRevenue: parseFloat(cat.totalRevenue) || 0,
                totalQuantitySold: parseInt(cat.totalQuantitySold) || 0,
                transactionCount: parseInt(cat.transactionCount) || 0
              }))
            : []
        };
      }
    }

    return sanitized;
  },

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

      // Sanitize realtime telemetry data
      const sanitizedTelemetry = this.sanitizeRealtimeTelemetry(realtimeTelemetry);

      // Prepare update data
      const updateData: any = {
        realtimeTelemetry: {
          ...sanitizedTelemetry,
          lastUpdated: new Date().toISOString()
        }
      };

      // Add historicalKpiSummary if provided
      if (historicalKpiSummary && Object.keys(historicalKpiSummary).length > 0) {
        updateData.historicalKpiSummary = this.sanitizeHistoricalKpiSummary(historicalKpiSummary);
      }
         const rawData = safeLogger(updateData,true);
         strapi.log.info("Raw Update Seat Data Received");
         strapi.log.info(rawData);

      // Update seat
      const updatedSeat = await strapi.documents('api::key-seat.key-seat').update({
        documentId: keySeatDocumentId,
        status:'published',
        data: updateData,
        populate:{
          license:{
            populate:{
              user:true
            }
          },
          realtimeTelemetry:{
            populate:{
              kpiSummary:true,
              lastOrder:{
                populate:{
                  items:true
                }
              },
              expenses:true
              
            }
          }
        },
       fields:['telemetry','isActive','isConnected','machineUUID',
        'userSocketId','timezone','documentId','id','publishedAt',
       ]
      });

      strapi.log.info(`[KeySeatService] Seat updated: ${keySeatDocumentId}`, {
  
        hasRealtimeTelemetry: !!updatedSeat.realtimeTelemetry
      });
      const { license, ...seatWithoutLicense } = updatedSeat
      const result = {
        ...seatWithoutLicense,
        userDocumentId: updatedSeat.license.user.documentId
      }

      return result;
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
    telemetryData: any,
    historicalKpiSummary: any,
    snapshotType: 'realtime' | 'hourly' | 'daily' = 'realtime'
  ) {
    try {
      strapi.log.info('[KeySeatService] Creating telemetry snapshot:', {
        keySeatDocumentId,
        snapshotType,
        hasTelemetryData: !!telemetryData,
        hasHistoricalKpi: !!historicalKpiSummary,
        telemetryDataKeys: telemetryData ? Object.keys(telemetryData) : [],
        historicalKpiKeys: historicalKpiSummary ? Object.keys(historicalKpiSummary) : []
      });

      // Prepare the data object - use telemetryData for the component field
      const snapshotData: any = {
        keySeat: keySeatDocumentId,
        capturedAt: new Date().toISOString(),
        snapshotType
      };

      // Clean and add telemetryData if it exists and has content
      if (telemetryData && typeof telemetryData === 'object' && Object.keys(telemetryData).length > 0) {
        // Remove 'id' fields from component data
        snapshotData.telemetryData = this.removeComponentIds(telemetryData);
        strapi.log.info('[KeySeatService] Cleaned telemetryData:', {
          originalKeys: Object.keys(telemetryData),
          cleanedKeys: Object.keys(snapshotData.telemetryData)
        });
      }

      // Clean and add historicalKpiSummary if it exists and has content
      if (historicalKpiSummary && typeof historicalKpiSummary === 'object' && Object.keys(historicalKpiSummary).length > 0) {
        // Remove 'id' fields from component data
        snapshotData.historicalKpiSummary = this.removeComponentIds(historicalKpiSummary);
        strapi.log.info('[KeySeatService] Cleaned historicalKpiSummary:', {
          originalKeys: Object.keys(historicalKpiSummary),
          cleanedKeys: Object.keys(snapshotData.historicalKpiSummary)
        });
      }

      strapi.log.info('[KeySeatService] Snapshot data prepared:', {
        hasTelemetryData: !!snapshotData.telemetryData,
        hasHistoricalKpiSummary: !!snapshotData.historicalKpiSummary
      });
      const safeRes= safeLogger(snapshotData,true);
      strapi.log.info("snapshotData");
      strapi.log.info(safeRes);

      const snapshot = await strapi.documents('api::seat-telemetry-history.seat-telemetry-history').create({
        status: "published",
        data: snapshotData
      });

      strapi.log.info('[KeySeatService] Telemetry snapshot created successfully:', {
        keySeatDocumentId,
        snapshotType,
        snapshotId: snapshot.documentId
      });

      return snapshot;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error creating telemetry snapshot:', {
        keySeatDocumentId,
        snapshotType,
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        errorDetails: error.details || 'No details available'
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
   * Gets all seats for a user with minimal data (excludes large telemetry objects)
   * @param userDocumentId - Document ID of the user
   * @returns Array of key-seat documents with essential fields only
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

      // Find all seats with only essential fields (excludes realtimeTelemetry, historicalKpiSummary)
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: {
          license: {
            documentId: {
              $in: licenseDocumentIds
            }
          }
        },
        status: 'published',
        fields: [
          'machineUUID',
          'telemetry',
          'isActive',
          'createdAt',
          'updatedAt',
          'publishedAt',
          'locale',
          'userSocketId',
          'isConnected',
          'timezone',
        ],
        populate: {
          license: {
            fields: ['planSubscriptionType', 'documentId']
          },
          realtimeTelemetry: {
            populate: {
              kpiSummary: true,
              lastOrder: {
                populate: {
                  items: true
                }
              },
              expenses: true
            }
          },
          historicalKpiSummary: {
            populate: {
              yesterday: {
                populate: {
                  categories: true
                }
              },
              thisWeek: {
                populate: {
                  categories: true
                }
              },
              thisMonth: {
                populate: {
                  categories: true
                }
              }
            }
          }
        }
      });

      // Map seats with license information and safe null checks
      const seatsWithMinimalData = seats.map(seat => {
        const realtimeTelemetry = seat.realtimeTelemetry;
        const historicalKpi = seat.historicalKpiSummary ;

        return {
          id: seat.id,
          documentId: seat.documentId,
          machineUUID: seat.machineUUID,
          telemetry: seat.telemetry,
          isActive: seat.isActive,
          createdAt: seat.createdAt,
          updatedAt: seat.updatedAt,
          publishedAt: seat.publishedAt,
          locale: seat.locale,
          userSocketId: seat.userSocketId,
          isConnected: seat.isConnected,
          timezone: seat.timezone,
          licenseDocumentId: seat.license.documentId,
          planSubscriptionType: seat.license.planSubscriptionType,
          todayKpiSummary: realtimeTelemetry?.kpiSummary || null,
          yesterdayKPISummary: historicalKpi?.yesterday ? {
            totalSales: historicalKpi.yesterday.totalSales || 0,
            transactionCount: historicalKpi.yesterday.transactionCount || 0,
            averageTransactionValue: historicalKpi.yesterday.averageTransactionValue || 0,
            grossProfit: historicalKpi.yesterday.grossProfit || 0,
            marginPercentage: historicalKpi.yesterday.marginPercentage || 0,
          } : null,
          lastSevenDaysKPISummary: historicalKpi?.thisWeek ? {
            totalSales: historicalKpi.thisWeek.totalSales || 0,
            transactionCount: historicalKpi.thisWeek.transactionCount || 0,
            averageTransactionValue: historicalKpi.thisWeek.averageTransactionValue || 0,
            grossProfit: historicalKpi.thisWeek.grossProfit || 0,
            marginPercentage: historicalKpi.thisWeek.marginPercentage || 0,
          } : null,
          lastMonthSummary: historicalKpi?.thisMonth ? {
            totalSales: historicalKpi.thisMonth.totalSales || 0,
            transactionCount: historicalKpi.thisMonth.transactionCount || 0,
            averageTransactionValue: historicalKpi.thisMonth.averageTransactionValue || 0,
            grossProfit: historicalKpi.thisMonth.grossProfit || 0,
            marginPercentage: historicalKpi.thisMonth.marginPercentage || 0,
          } : null
        };
      });

      return seatsWithMinimalData;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error getting user seats:', {
        userDocumentId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Aggregates KPI data from seat array (helper for getUserSeats)
   * @param seats - Array of seats with KPI data
   * @returns Aggregated KPI summary
   */
  aggregateSeatsKpi(seats: any[]) {
    let todayTotalSales = 0;
    let todayTransactionCount = 0;
    let todayGrossProfit = 0;
    let yesterdayTotalSales = 0;
    let yesterdayTransactionCount = 0;
    let yesterdayGrossProfit = 0;
    let thisWeekTotalSales = 0;
    let thisWeekTransactionCount = 0;
    let thisWeekGrossProfit = 0;
    let thisMonthTotalSales = 0;
    let thisMonthTransactionCount = 0;
    let thisMonthGrossProfit = 0;

    let hasTodayData = false;
    let hasYesterdayData = false;
    let hasThisWeekData = false;
    let hasThisMonthData = false;

    for (const seat of seats) {
      // Today (from realtimeTelemetry)
      if (seat.todayKpiSummary) {
        hasTodayData = true;
        todayTotalSales += seat.todayKpiSummary.totalSales || 0;
        todayTransactionCount += seat.todayKpiSummary.transactionCount || 0;
        todayGrossProfit += seat.todayKpiSummary.grossProfit || 0;
      }

      // Yesterday
      if (seat.yesterdayKPISummary) {
        hasYesterdayData = true;
        yesterdayTotalSales += seat.yesterdayKPISummary.totalSales || 0;
        yesterdayTransactionCount += seat.yesterdayKPISummary.transactionCount || 0;
        yesterdayGrossProfit += seat.yesterdayKPISummary.grossProfit || 0;
      }

      // This week
      if (seat.lastSevenDaysKPISummary) {
        hasThisWeekData = true;
        thisWeekTotalSales += seat.lastSevenDaysKPISummary.totalSales || 0;
        thisWeekTransactionCount += seat.lastSevenDaysKPISummary.transactionCount || 0;
        thisWeekGrossProfit += seat.lastSevenDaysKPISummary.grossProfit || 0;
      }

      // This month
      if (seat.lastMonthSummary) {
        hasThisMonthData = true;
        thisMonthTotalSales += seat.lastMonthSummary.totalSales || 0;
        thisMonthTransactionCount += seat.lastMonthSummary.transactionCount || 0;
        thisMonthGrossProfit += seat.lastMonthSummary.grossProfit || 0;
      }
    }

    return {
      today: hasTodayData ? {
        totalSales: todayTotalSales,
        transactionCount: todayTransactionCount,
        averageTransactionValue: todayTransactionCount > 0 ? todayTotalSales / todayTransactionCount : 0,
        grossProfit: todayGrossProfit,
        marginPercentage: todayTotalSales > 0 ? (todayGrossProfit / todayTotalSales) * 100 : 0
      } : null,
      yesterday: hasYesterdayData ? {
        totalSales: yesterdayTotalSales,
        transactionCount: yesterdayTransactionCount,
        averageTransactionValue: yesterdayTransactionCount > 0 ? yesterdayTotalSales / yesterdayTransactionCount : 0,
        grossProfit: yesterdayGrossProfit,
        marginPercentage: yesterdayTotalSales > 0 ? (yesterdayGrossProfit / yesterdayTotalSales) * 100 : 0
      } : null,
      thisWeek: hasThisWeekData ? {
        totalSales: thisWeekTotalSales,
        transactionCount: thisWeekTransactionCount,
        averageTransactionValue: thisWeekTransactionCount > 0 ? thisWeekTotalSales / thisWeekTransactionCount : 0,
        grossProfit: thisWeekGrossProfit,
        marginPercentage: thisWeekTotalSales > 0 ? (thisWeekGrossProfit / thisWeekTotalSales) * 100 : 0
      } : null,
      thisMonth: hasThisMonthData ? {
        totalSales: thisMonthTotalSales,
        transactionCount: thisMonthTransactionCount,
        averageTransactionValue: thisMonthTransactionCount > 0 ? thisMonthTotalSales / thisMonthTransactionCount : 0,
        grossProfit: thisMonthGrossProfit,
        marginPercentage: thisMonthTotalSales > 0 ? (thisMonthGrossProfit / thisMonthTotalSales) * 100 : 0
      } : null
    };
  },

  /**
   * Gets detailed seat data including full telemetry (for individual seat requests)
   * @param seatDocumentId - Document ID of the seat
   * @returns Full seat document with all telemetry data
   */
  async getSeatDetails(seatDocumentId: string) {
    try {
      const seat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId: seatDocumentId,
        status: 'published',
        populate: ['license']
      });

      if (!seat) {
        throw new Error(`Seat not found: ${seatDocumentId}`);
      }

      return seat;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error getting seat details:', {
        seatDocumentId,
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
        wrongTimeWindow: 0,
        noTelemetryData: 0,
        alreadySnapshotted: 0,
        errors: [] as any[]
      };

      // Get all active seats with realtime telemetry and timezone
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: {
          isActive: true,
          realtimeTelemetry: {
            $not: null
          }
        },
        populate:{
                  realtimeTelemetry: {
            populate: {
              kpiSummary: true,
              lastOrder: {
                populate: {
                  items: true
                }
              },
              expenses: true
            }
          },
          historicalKpiSummary: {
            populate: {
              yesterday: {
                populate: {
                  categories: true
                }
              },
              thisWeek: {
                populate: {
                  categories: true
                }
              },
              thisMonth: {
                populate: {
                  categories: true
                }
              }
            }
          }
        },
        limit: 10000 // Adjust based on your scale
      });

      summary.total = seats.length;
      
      strapi.log.info(`[KeySeatService] Found ${seats.length} active seats with telemetry data`);

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
                summary.noTelemetryData++;
                summary.skipped++;
                return;
              }

              // Get seat timezone (default to UTC if not set)
              const seatTimezone = seat.timezone || 'UTC';

              // Calculate local time in seat's timezone
              const localTime = this.getLocalTimeInTimezone(nowUTC, seatTimezone);
              const localHour = localTime.getHours();
              const localMinute = localTime.getMinutes();

              strapi.log.info(`[KeySeatService] Checking seat ${seat.documentId}:`, {
                timezone: seatTimezone,
                localTime: localTime.toISOString(),
                localHour,
                localMinute,
                isInTimeWindow: localHour === 23 && localMinute >= 55
              });

              // TESTING MODE: Check environment variable to allow testing at any time
              const isTestMode = process.env.SNAPSHOT_TEST_MODE === 'true';
              const isInTimeWindow = isTestMode || (localHour === 23 && localMinute >= 55);

              if (isTestMode) {
                strapi.log.warn(`[KeySeatService] ⚠️ SNAPSHOT_TEST_MODE enabled - creating snapshot regardless of time`);
              }

              // Only create snapshot if it's between 23:55 and 23:59 in the seat's local time (or test mode)
              if (isInTimeWindow) {
                // Check if we already created a snapshot today for this seat
                const today = localTime.toISOString().split('T')[0]; // YYYY-MM-DD
                const existingSnapshot = await this.hasSnapshotForDate(seat.documentId, today);

                if (existingSnapshot) {
                  summary.alreadySnapshotted++;
                  summary.skipped++;
                  strapi.log.info(`[KeySeatService] Seat ${seat.documentId} already has snapshot for ${today}`);
                  return;
                }

                // Type guard: ensure it's a Record<string, any>
                const telemetryData = seat.realtimeTelemetry as Record<string, any>;
                
                if (Object.keys(telemetryData).length === 0) {
                  summary.skipped++;
                  return;
                }

                // Ensure historicalKpiSummary is an object
                const historicalKpi = seat.historicalKpiSummary && 
                  typeof seat.historicalKpiSummary === 'object' && 
                  !Array.isArray(seat.historicalKpiSummary)
                  ? seat.historicalKpiSummary as Record<string, any>
                  : {};

                strapi.log.info(`[KeySeatService] Preparing snapshot data for seat ${seat.documentId}:`, {
                  telemetryDataType: typeof telemetryData,
                  telemetryDataKeys: Object.keys(telemetryData),
                  historicalKpiType: typeof historicalKpi,
                  historicalKpiKeys: Object.keys(historicalKpi),
                  snapshotLocalTime: localTime.toISOString(),
                  snapshotTimezone: seatTimezone
                });

                await this.createTelemetrySnapshot(
                  seat.documentId,
                  telemetryData,
                  historicalKpi,
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
                summary.wrongTimeWindow++;
                summary.skipped++;
              }
            } catch (error) {
              summary.failed++;
              const errorDetails = {
                seatId: seat.documentId,
                timezone: seat.timezone,
                error: error.message,
                stack: error.stack
              };
              summary.errors.push(errorDetails);
              strapi.log.error(`[KeySeatService] Failed to create snapshot for seat ${seat.documentId}:`, errorDetails);
            }
          })
        );
      }

      strapi.log.info('[KeySeatService] Timezone-aware daily snapshots completed:', {
        ...summary,
        breakdown: {
          wrongTimeWindow: summary.wrongTimeWindow,
          noTelemetryData: summary.noTelemetryData,
          alreadySnapshotted: summary.alreadySnapshotted
        }
      });
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
  },

  /**
   * Aggregates historical KPI data from all seats across all user's licenses
   * @param userDocumentId - Document ID of the user
   * @returns Aggregated KPI summary or null if no data available
   */
  async getAggregatedKpiForUser(userDocumentId: string) {
    try {
      // Find all licenses for the user
      const licenses = await strapi.documents('api::license.license').findMany({
        filters: {
          user: {
            documentId: userDocumentId
          }
        },
        status: 'published'
      });

      if (!licenses || licenses.length === 0) {
        return null;
      }

      // Get license document IDs
      const licenseDocumentIds = licenses.map(license => license.documentId);

      // Find all active seats with historicalKpiSummary
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: {
          license: {
            documentId: {
              $in: licenseDocumentIds
            }
          },
          isActive: true,
          historicalKpiSummary: {
            $not: null
          }
        },
        status: 'published',
        populate:{
          historicalKpiSummary:true
        }
        
      });

      if (!seats || seats.length === 0) {
        return null;
      }

      // Aggregate data from all seats
      let yesterdayTotalSales = 0;
      let yesterdayTransactionCount = 0;
      let yesterdayGrossProfit = 0;
      let thisWeekTotalSales = 0;
      let thisWeekTransactionCount = 0;
      let thisWeekGrossProfit = 0;
      let thisMonthTotalSales = 0;
      let thisMonthTransactionCount = 0;
      let thisMonthGrossProfit = 0;

      let hasYesterdayData = false;
      let hasThisWeekData = false;
      let hasThisMonthData = false;

      // Sum up all seats' data
      for (const seat of seats) {
        const kpiSummary = seat.historicalKpiSummary as any;

        if (!kpiSummary || typeof kpiSummary !== 'object' || Array.isArray(kpiSummary)) {
          continue;
        }

        // Yesterday
        if (kpiSummary.yesterday) {
          hasYesterdayData = true;
          yesterdayTotalSales += kpiSummary.yesterday.totalSales || 0;
          yesterdayTransactionCount += kpiSummary.yesterday.transactionCount || 0;
          yesterdayGrossProfit += kpiSummary.yesterday.grossProfit || 0;
        }

        // This week
        if (kpiSummary.thisWeek) {
          hasThisWeekData = true;
          thisWeekTotalSales += kpiSummary.thisWeek.totalSales || 0;
          thisWeekTransactionCount += kpiSummary.thisWeek.transactionCount || 0;
          thisWeekGrossProfit += kpiSummary.thisWeek.grossProfit || 0;
        }

        // This month
        if (kpiSummary.thisMonth) {
          hasThisMonthData = true;
          thisMonthTotalSales += kpiSummary.thisMonth.totalSales || 0;
          thisMonthTransactionCount += kpiSummary.thisMonth.transactionCount || 0;
          thisMonthGrossProfit += kpiSummary.thisMonth.grossProfit || 0;
        }
      }

      // If no data at all, return null
      if (!hasYesterdayData && !hasThisWeekData && !hasThisMonthData) {
        return null;
      }

      // Create aggregated data
      const aggregated: any = {
        yesterday: hasYesterdayData ? {
          totalSales: yesterdayTotalSales,
          transactionCount: yesterdayTransactionCount,
          averageTransactionValue: yesterdayTransactionCount > 0 
            ? yesterdayTotalSales / yesterdayTransactionCount 
            : 0,
          grossProfit: yesterdayGrossProfit,
          marginPercentage: yesterdayTotalSales > 0 
            ? (yesterdayGrossProfit / yesterdayTotalSales) * 100 
            : 0
        } : null,
        thisWeek: hasThisWeekData ? {
          totalSales: thisWeekTotalSales,
          transactionCount: thisWeekTransactionCount,
          averageTransactionValue: thisWeekTransactionCount > 0 
            ? thisWeekTotalSales / thisWeekTransactionCount 
            : 0,
          grossProfit: thisWeekGrossProfit,
          marginPercentage: thisWeekTotalSales > 0 
            ? (thisWeekGrossProfit / thisWeekTotalSales) * 100 
            : 0
        } : null,
        thisMonth: hasThisMonthData ? {
          totalSales: thisMonthTotalSales,
          transactionCount: thisMonthTransactionCount,
          averageTransactionValue: thisMonthTransactionCount > 0 
            ? thisMonthTotalSales / thisMonthTransactionCount 
            : 0,
          grossProfit: thisMonthGrossProfit,
          marginPercentage: thisMonthTotalSales > 0 
            ? (thisMonthGrossProfit / thisMonthTotalSales) * 100 
            : 0
        } : null,
        cachedAt: new Date().toISOString(),
        seatsCount: seats.length
      };

      strapi.log.info('[KeySeatService] Aggregated KPI data for user:', {
        userDocumentId,
        seatsCount: seats.length,
        hasYesterdayData,
        hasThisWeekData,
        hasThisMonthData
      });

      return aggregated;
    } catch (error) {
      strapi.log.error('[KeySeatService] Error aggregating KPI data:', {
        userDocumentId,
        error: error.message
      });
      throw error;
    }
  }
}));
