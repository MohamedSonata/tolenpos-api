/**
 * key-seat controller
 */

import { factories } from '@strapi/strapi';
import {
  sanitizePublicSeatId,
  sanitizeSeatDataForCustomer,
  ensureNoSensitiveData
} from '../utils/customer-validation';

export default factories.createCoreController('api::key-seat.key-seat', ({ strapi }) => ({
  /**
   * GET /api/key-seats/my-seats
   * Fetches all seats owned by the authenticated user
   */
  async mySeats(ctx) {
    try {
      // Debug logging
      strapi.log.info('[KeySeatController] mySeats called');
      strapi.log.info('[KeySeatController] ctx.state.user:', ctx.state.user);
      strapi.log.info('[KeySeatController] Authorization header:', ctx.request.headers.authorization);

      // Extract authenticated user from JWT
      const user = ctx.state.user;

      if (!user) {
        strapi.log.warn('[KeySeatController] No user in ctx.state.user');
        return ctx.unauthorized('Authentication required');
      }

      // Get user's document ID
      const userDocumentId = user.documentId;
      strapi.log.info('[KeySeatController] User document ID:', userDocumentId);

      // Fetch seats via service
      const service = strapi.service('api::key-seat.key-seat');
      const seats = await service.getUserSeats(userDocumentId);

      strapi.log.info('[KeySeatController] Found seats:', seats.length);

      // Aggregate KPI data across all seats
      const aggregatedKpi = service.aggregateSeatsKpi(seats);

      return ctx.send({
        data: seats,
        meta: {
          total: seats.length,
          today: aggregatedKpi.today,
          yesterday: aggregatedKpi.yesterday,
          thisWeek: aggregatedKpi.thisWeek,
          thisMonth: aggregatedKpi.thisMonth
        }
      });
    } catch (error) {
      strapi.log.error('[KeySeatController] Error fetching user seats:', error);
      return ctx.internalServerError('Failed to fetch seats');
    }
  },

  /**
   * POST /api/key-seats/:documentId/telemetry/query
   * Requests real-time telemetry data from POS device via Socket.IO
   * Falls back to latest snapshot if POS is offline or timeout occurs
   */
  async queryTelemetry(ctx) {
    try {
      const { documentId } = ctx.params;
      const { filters = {}, waitForRealtime = true, timeout = 10000 } = ctx.request.body;
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      strapi.log.info('[KeySeatController] Telemetry query requested', {
        documentId,
        userDocumentId: user.documentId,
        filters
      });

      // Validate ownership
      const service = strapi.service('api::key-seat.key-seat');
      const seat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId,
        populate: ['license.user']
      });

      if (!seat || !seat.license) {
        return ctx.notFound('Seat not found');
      }

      const licenseUser = typeof seat.license.user === 'object' 
        ? seat.license.user.documentId 
        : seat.license.user;

      if (licenseUser !== user.documentId) {
        return ctx.forbidden('Access denied: You do not own this seat');
      }

      // If not waiting for realtime, return latest snapshot immediately
      if (!waitForRealtime) {
        const snapshot = await service.getLatestSnapshot(documentId);
        
        if (!snapshot) {
          return ctx.notFound('No telemetry data available');
        }

        const snapshotDate = new Date(snapshot.capturedAt);
        const ageHours = Math.floor((Date.now() - snapshotDate.getTime()) / (1000 * 60 * 60));

        return ctx.send({
          success: true,
          source: 'snapshot',
          data: snapshot.telemetryData,
          timestamp: snapshot.capturedAt,
          snapshotAge: ageHours
        });
      }

      // Check if POS is online
      if (!seat.userSocketId) {
        strapi.log.info('[KeySeatController] POS offline, returning snapshot');
        const snapshot = await service.getLatestSnapshot(documentId);
        
        if (!snapshot) {
          return ctx.notFound('POS device offline and no snapshot available');
        }

        const snapshotDate = new Date(snapshot.capturedAt);
        const ageHours = Math.floor((Date.now() - snapshotDate.getTime()) / (1000 * 60 * 60));

        return ctx.send({
          success: true,
          source: 'snapshot',
          data: snapshot.telemetryData,
          timestamp: snapshot.capturedAt,
          warning: `POS device offline - showing snapshot from ${ageHours} hours ago`,
          snapshotAge: ageHours
        });
      }

      // POS is online - trigger Socket.IO query
      // Note: This is a REST endpoint, so we can't wait for Socket.IO response
      // The mobile app should use Socket.IO directly for real-time queries
      // This endpoint is mainly for checking availability and getting snapshots

      return ctx.send({
        success: true,
        message: 'POS device is online. Use Socket.IO event "seat:telemetry:query" for real-time data.',
        posOnline: true,
        socketId: seat.userSocketId
      });

    } catch (error) {
      strapi.log.error('[KeySeatController] Error querying telemetry:', error);
      return ctx.internalServerError('Failed to query telemetry data');
    }
  },

  /**
   * GET /api/key-seats/:documentId/telemetry/latest
   * Gets the latest telemetry snapshot (no Socket.IO, snapshot only)
   */
  async getLatestTelemetry(ctx) {
    try {
      const { documentId } = ctx.params;
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      // Validate ownership
      const seat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId,
        populate: ['license.user']
      });

      if (!seat || !seat.license) {
        return ctx.notFound('Seat not found');
      }

      const licenseUser = typeof seat.license.user === 'object' 
        ? seat.license.user.documentId 
        : seat.license.user;

      if (licenseUser !== user.documentId) {
        return ctx.forbidden('Access denied: You do not own this seat');
      }

      // Get latest snapshot
      const service = strapi.service('api::key-seat.key-seat');
      const snapshot = await service.getLatestSnapshot(documentId);

      if (!snapshot) {
        return ctx.notFound('No telemetry snapshot available');
      }

      const snapshotDate = new Date(snapshot.capturedAt);
      const ageHours = Math.floor((Date.now() - snapshotDate.getTime()) / (1000 * 60 * 60));

      return ctx.send({
        success: true,
        source: 'snapshot',
        data: snapshot.telemetryData,
        timestamp: snapshot.capturedAt,
        snapshotAge: ageHours,
        snapshotType: snapshot.snapshotType
      });

    } catch (error) {
      strapi.log.error('[KeySeatController] Error getting latest telemetry:', error);
      return ctx.internalServerError('Failed to get telemetry data');
    }
  },

  /**
   * POST /api/key-seats/:documentId/telemetry/snapshot
   * Manually triggers a telemetry snapshot (admin/user triggered)
   */
  async createSnapshot(ctx) {
    try {
      const { documentId } = ctx.params;
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      // Validate ownership
      const seat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId,
        populate: {
          license:{
            populate:{
              user:true
            }
          },
          realtimeTelemetry:true,
          historicalKpiSummary:true
        }
      });

      if (!seat || !seat.license) {
        return ctx.notFound('Seat not found');
      }

      const licenseUser = typeof seat.license.user === 'object' 
        ? seat.license.user.documentId 
        : seat.license.user;

      if (licenseUser !== user.documentId) {
        return ctx.forbidden('Access denied: You do not own this seat');
      }

      // Check if seat has telemetry data
      if (!seat.realtimeTelemetry || Object.keys(seat.realtimeTelemetry).length === 0) {
        return ctx.badRequest('No telemetry data available to snapshot');
      }

      // Create snapshot
      const service = strapi.service('api::key-seat.key-seat');
      const snapshot = await service.createTelemetrySnapshot(
        documentId,
        seat.realtimeTelemetry,
        seat.historicalKpiSummary || {},
        'realtime' // User-triggered snapshots are marked as 'realtime'
      );

      return ctx.send({
        success: true,
        message: 'Snapshot created successfully',
        snapshot: {
          documentId: snapshot.documentId,
          capturedAt: snapshot.capturedAt,
          snapshotType: snapshot.snapshotType
        }
      });

    } catch (error) {
      strapi.log.error('[KeySeatController] Error creating snapshot:', error);
      return ctx.internalServerError('Failed to create snapshot');
    }
  },

  /**
   * POST /api/key-seats/test-snapshot
   * Test endpoint to manually trigger snapshot creation with detailed error logging
   */
  async testSnapshot(ctx) {
    try {
      strapi.log.info('[KeySeatController] Test snapshot triggered');

      // Get first active seat with telemetry
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: {
          isActive: true,
          realtimeTelemetry: {
            $not: null
          }
        },
        populate: {
          realtimeTelemetry: true,
          historicalKpiSummary: true
        },
        limit: 1
      });

      if (!seats || seats.length === 0) {
        return ctx.send({
          success: false,
          message: 'No active seats with telemetry found'
        });
      }

      const seat = seats[0];
      
      strapi.log.info('[KeySeatController] Test seat data:', {
        documentId: seat.documentId,
        hasRealtimeTelemetry: !!seat.realtimeTelemetry,
        realtimeTelemetryType: typeof seat.realtimeTelemetry,
        realtimeTelemetryKeys: seat.realtimeTelemetry ? Object.keys(seat.realtimeTelemetry) : [],
        hasHistoricalKpi: !!seat.historicalKpiSummary,
        historicalKpiType: typeof seat.historicalKpiSummary
      });

      // Try to create snapshot
      const service = strapi.service('api::key-seat.key-seat');
      
      try {
        const snapshot = await service.createTelemetrySnapshot(
          seat.documentId,
          seat.realtimeTelemetry,
          seat.historicalKpiSummary || {},
          'daily'
        );

        return ctx.send({
          success: true,
          message: 'Snapshot created successfully',
          snapshot: {
            documentId: snapshot.documentId,
            capturedAt: snapshot.capturedAt
          }
        });
      } catch (snapshotError) {
        strapi.log.error('[KeySeatController] Snapshot creation failed:', {
          error: snapshotError.message,
          stack: snapshotError.stack,
          name: snapshotError.name,
          details: snapshotError.details || 'No details',
          cause: snapshotError.cause || 'No cause'
        });

        return ctx.send({
          success: false,
          error: snapshotError.message,
          errorName: snapshotError.name,
          errorDetails: snapshotError.details || null,
          stack: snapshotError.stack
        });
      }

    } catch (error) {
      strapi.log.error('[KeySeatController] Test snapshot error:', error);
      return ctx.internalServerError({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  },

  /**
   * GET /api/key-seats/aggregated-kpi
   * Gets aggregated historical KPI data from all user's seats across all licenses
   */
  async getAggregatedKpi(ctx) {
    try {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      strapi.log.info('[KeySeatController] Aggregated KPI requested', {
        userDocumentId: user.documentId
      });

      // Get aggregated KPI data
      const service = strapi.service('api::key-seat.key-seat');
      const aggregatedKpi = await service.getAggregatedKpiForUser(user.documentId);

      if (!aggregatedKpi) {
        return ctx.send({
          success: true,
          data: null,
          message: 'No historical KPI data available'
        });
      }

      return ctx.send({
        success: true,
        data: aggregatedKpi
      });

    } catch (error) {
      strapi.log.error('[KeySeatController] Error getting aggregated KPI:', error);
      return ctx.internalServerError('Failed to get aggregated KPI data');
    }
  },

  /**
   * GET /api/key-seats/sales-insights
   * Gets sales insights for a specific date across all user's seats
   * Query params:
   *   - date: ISO date string (YYYY-MM-DD) - defaults to today
   * 
   * Routes to realtime telemetry (today) or historical snapshots (past dates)
   */
  async getSalesInsights(ctx) {
    try {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      // Get target date from query params (default to today)
      const targetDateParam = ctx.query.date;
      const targetDate = targetDateParam ? new Date(targetDateParam as string) : new Date();

      // Validate date
      if (isNaN(targetDate.getTime())) {
        return ctx.badRequest('Invalid date format. Use YYYY-MM-DD');
      }

      strapi.log.info('[KeySeatController] Sales insights requested', {
        userDocumentId: user.documentId,
        targetDate: targetDate.toISOString(),
        queryParam: targetDateParam
      });

      // Get sales insights
      const service = strapi.service('api::key-seat.key-seat');
      const insights = await service.getSalesInsights(user.documentId, targetDate);

      return ctx.send({
        success: true,
        data: insights
      });

    } catch (error) {
      strapi.log.error('[KeySeatController] Error getting sales insights:', error);
      return ctx.internalServerError('Failed to get sales insights');
    }
  },

  /**
   * GET /api/key-seats/public/:publicSeatId
   * Gets public seat information (no authentication required)
   * Used by customer mobile apps to check seat availability before connecting
   */
  async getPublicSeatInfo(ctx) {
    try {
      const { publicSeatId } = ctx.params;

      if (!publicSeatId) {
        strapi.log.warn('[KeySeatController] Public seat info request rejected - Missing Public Seat ID', {
          reason: 'Missing parameter',
          timestamp: new Date().toISOString()
        });
        return ctx.badRequest({
          success: false,
          error: 'Public Seat ID is required',
          timestamp: new Date().toISOString()
        });
      }

      // Validate and sanitize Public Seat ID format
      const sanitizedSeatId = sanitizePublicSeatId(publicSeatId);
      
      if (!sanitizedSeatId) {
        strapi.log.warn('[KeySeatController] Public seat info request rejected - Invalid Public Seat ID format', {
          publicSeatId,
          reason: 'Invalid format',
          timestamp: new Date().toISOString()
        });
        return ctx.badRequest({
          success: false,
          error: 'Invalid Public Seat ID format',
          timestamp: new Date().toISOString()
        });
      }

      strapi.log.info('[KeySeatController] Public seat info requested', {
        publicSeatId: sanitizedSeatId,
        timestamp: new Date().toISOString()
      });

      // Query seat with required filters
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: {
          publicSeatId: sanitizedSeatId,
          isActive: true,
          allowCustomerApp: true
        },
        status: 'published'
      });

      // Return 404 if seat not found, inactive, or customer app disabled
      if (!seats || seats.length === 0) {
        strapi.log.warn('[KeySeatController] Public seat info request rejected - Seat not found or customer app disabled', {
          publicSeatId: sanitizedSeatId,
          reason: 'Seat not found or customer app disabled',
          timestamp: new Date().toISOString()
        });
        return ctx.notFound({
          success: false,
          error: 'Seat not found or customer app not enabled',
          timestamp: new Date().toISOString()
        });
      }

      const seat = seats[0] ;

      // Check if POS device is connected
      const isOnline = !!seat.userSocketId;

      // Calculate if customer can connect
      const currentConnections = seat.currentCustomerConnections || 0;
      const maxConnections = seat.maxCustomerConnections || 50;
      const canConnect = currentConnections < maxConnections;

      // Return offline status if POS device not connected
      if (!isOnline) {
        strapi.log.info('[KeySeatController] Public seat info returned - POS device offline', {
          publicSeatId: sanitizedSeatId,
          businessName: seat.businessName,
          businessType: seat.businessType,
          isOnline: false,
          timestamp: new Date().toISOString()
        });
        
        // Sanitize response to ensure no sensitive data
        const sanitizedResponse = {
          success: false,
          error: 'POS device is currently offline',
          seat: {
            publicSeatId: seat.publicSeatId,
            businessName: seat.businessName,
            businessType: seat.businessType,
            isOnline: false
          },
          timestamp: new Date().toISOString()
        };
        
        // Verify no sensitive data in response
        ensureNoSensitiveData(sanitizedResponse);
        
        return ctx.send(sanitizedResponse);
      }

      // Prepare sanitized seat data for customer
      const seatData = sanitizeSeatDataForCustomer({
        publicSeatId: seat.publicSeatId,
        businessName: seat.businessName,
        businessType: seat.businessType,
        isConnected: isOnline,
        currentCustomerConnections: currentConnections,
        maxCustomerConnections: maxConnections,
        allowMenuBrowsing: seat.allowMenuBrowsing,
        allowBarcodeScanning: seat.allowBarcodeScanning,
        allowCustomerOrdering: seat.allowCustomerOrdering
      });

      // Return seat information
      strapi.log.info('[KeySeatController] Public seat info returned successfully', {
        publicSeatId: sanitizedSeatId,
        businessName: seat.businessName,
        businessType: seat.businessType,
        isOnline,
        canConnect,
        currentConnections,
        maxConnections,
        timestamp: new Date().toISOString()
      });

      const response = {
        success: true,
        seat: {
          ...seatData,
          canConnect
        },
        timestamp: new Date().toISOString()
      };
      
      // Verify no sensitive data in response
      ensureNoSensitiveData(response);

      return ctx.send(response);

    } catch (error) {
      strapi.log.error('[KeySeatController] Error getting public seat info', {
        publicSeatId: ctx.params?.publicSeatId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Don't expose internal error details to customers
      return ctx.internalServerError({
        success: false,
        error: 'Failed to get seat information',
        timestamp: new Date().toISOString()
      });
    }
  }
}));
