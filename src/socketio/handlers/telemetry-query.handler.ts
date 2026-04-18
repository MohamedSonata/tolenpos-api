/**
 * Telemetry Query Socket Handler
 * Handles real-time telemetry queries from mobile apps to POS devices
 * Implements request-response pattern with timeout and fallback to snapshots
 * 
 * MULTI-REPLICA COMPATIBLE:
 * - Uses room-based communication instead of socket IDs
 * - Stores pending requests in Redis for cross-replica access
 * - Works regardless of which replica handles the request/response
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';
import { SocketIOEvents } from '../events_constants';
import {
  TelemetryQueryRequest,
  TelemetryQueryResponse,
  TelemetryQueryError
} from '../interfaces';
import { multiReplicaSocketManager } from '../socket-manager';
import { redisStateManager, PendingRequest } from '../redis-state-manager';

// Timeout for waiting for POS response (10 seconds)
const QUERY_TIMEOUT_MS = parseInt(process.env.TELEMETRY_QUERY_TIMEOUT || '10000', 10);

/**
 * Sets up telemetry query event handlers for Socket.IO connections
 * @param socket - Socket instance
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
export function setupTelemetryQueryHandlers(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  if (!socket.data?.userId) {
    return;
  }

  strapi.log.info(`[TelemetryQueryHandler] Setting up handlers for socket ${socket.id}, clientType: ${socket.data.clientType}`);

  // Mobile: Handle telemetry query requests
  if (socket.data.clientType === 'mobile') {
    handleMobileTelemetryQuery(socket, strapi, io);
  }

  // POS: Handle telemetry query responses
  if (socket.data.clientType === 'pos') {
    handlePOSTelemetryResponse(socket, strapi, io);
  }

  // Clean up pending requests on disconnect to prevent memory leaks
  socket.on('disconnect', () => {
    cleanupPendingRequests(socket, strapi);
  });
}

/**
 * Handles telemetry query requests from mobile clients
 * Flow: Mobile → Server → POS Device
 * @param socket - Socket instance for the mobile client
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handleMobileTelemetryQuery(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnTelemetryQuery, async (request: TelemetryQueryRequest) => {
    try {
      const { keySeatDocumentId, filters, requestId } = request;
      const userDocumentId = socket.data.documentId;

      strapi.log.info(`[TelemetryQueryHandler] Received query request`, {
        requestId,
        keySeatDocumentId,
        userDocumentId,
        filters
      });

      // Validate ownership
      const hasAccess = await validateSeatAccess(strapi, keySeatDocumentId, userDocumentId);
      if (!hasAccess) {
        socket.emit(SocketIOEvents.EmitTelemetryQueryError, {
          requestId,
          keySeatDocumentId,
          error: 'Access denied: You do not own this seat',
          fallbackAvailable: false
        } as TelemetryQueryError);
        return;
      }

      // Get the seat to find POS socket ID
      const seat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId: keySeatDocumentId,
        populate: ['license']
      });

      if (!seat) {
        socket.emit(SocketIOEvents.EmitTelemetryQueryError, {
          requestId,
          keySeatDocumentId,
          error: 'Seat not found',
          fallbackAvailable: false
        } as TelemetryQueryError);
        return;
      }

      // Check if POS is online (has socketId)
      if (!seat.userSocketId) {
        strapi.log.info(`[TelemetryQueryHandler] POS offline, using fallback`, {
          requestId,
          keySeatDocumentId
        });
        await sendFallbackSnapshot(socket, strapi, requestId, keySeatDocumentId);
        return;
      }

      // Store pending request in Redis (works across replicas)
      const pendingRequest: PendingRequest = {
        requestId,
        mobileSocketId: socket.id,
        keySeatDocumentId,
        createdAt: Date.now(),
        expiresAt: Date.now() + QUERY_TIMEOUT_MS
      };
      
      await redisStateManager.storePendingRequest(pendingRequest);

      // Forward request to POS device using room-based communication
      const posRoom = `pos:${keySeatDocumentId}`;
      io.to(posRoom).emit(SocketIOEvents.EmitTelemetryQueryRequest, {
        requestId,
        keySeatDocumentId,
        filters,
        mobileSocketId: socket.id // For logging/debugging only
      });

      strapi.log.info(`[TelemetryQueryHandler] Forwarded query to POS room`, {
        requestId,
        posRoom
      });

      // Set timeout for POS response
      setTimeout(async () => {
        // Check if request still exists (not already responded)
        const stillPending = await redisStateManager.getPendingRequest(requestId);
        
        if (stillPending) {
          await redisStateManager.deletePendingRequest(requestId);
          
          strapi.log.warn(`[TelemetryQueryHandler] Query timeout, using fallback`, {
            requestId,
            keySeatDocumentId
          });

          await sendFallbackSnapshot(socket, strapi, requestId, keySeatDocumentId);
        }
      }, QUERY_TIMEOUT_MS);

    } catch (error) {
      strapi.log.error(`[TelemetryQueryHandler] Error handling query request`, {
        error: error.message,
        stack: error.stack
      });

      socket.emit(SocketIOEvents.EmitTelemetryQueryError, {
        requestId: request.requestId,
        keySeatDocumentId: request.keySeatDocumentId,
        error: 'Internal server error',
        fallbackAvailable: true
      } as TelemetryQueryError);
    }
  });
}

/**
 * Handles telemetry query responses from POS clients
 * Flow: POS Device → Server → Mobile
 * @param socket - Socket instance for the POS client
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handlePOSTelemetryResponse(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnTelemetryQueryResponse, async (response: TelemetryQueryResponse) => {
    try {
      const { requestId, keySeatDocumentId, telemetryData, mobileSocketId } = response;

      strapi.log.info(`[TelemetryQueryHandler] Received response from POS`, {
        requestId,
        keySeatDocumentId,
        dataSize: JSON.stringify(telemetryData).length
      });

      // Get pending request from Redis
      const pendingRequest = await redisStateManager.getPendingRequest(requestId);
      
      if (!pendingRequest) {
        strapi.log.warn(`[TelemetryQueryHandler] No pending request found (may have timed out)`, {
          requestId
        });
        return;
      }

      // Delete pending request
      await redisStateManager.deletePendingRequest(requestId);

      // Forward response to mobile app using room-based communication
      // Use the mobile socket ID from the pending request (more reliable than response)
      const mobileRoom = `mobile:${pendingRequest.mobileSocketId}`;
      io.to(mobileRoom).emit(SocketIOEvents.EmitTelemetryQueryResponse, {
        requestId,
        keySeatDocumentId,
        source: 'realtime',
        data: telemetryData,
        timestamp: new Date().toISOString(),
        success: true
      });

      strapi.log.info(`[TelemetryQueryHandler] Forwarded response to mobile room`, {
        requestId,
        mobileRoom
      });

    } catch (error) {
      strapi.log.error(`[TelemetryQueryHandler] Error handling query response`, {
        error: error.message,
        stack: error.stack
      });
    }
  });
}

/**
 * Validates that a user has access to a seat
 * @param strapi - Strapi instance
 * @param keySeatDocumentId - Seat document ID
 * @param userDocumentId - User document ID
 * @returns True if user owns the seat
 */
async function validateSeatAccess(
  strapi: Core.Strapi,
  keySeatDocumentId: string,
  userDocumentId: string
): Promise<boolean> {
  try {
    const seat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId: keySeatDocumentId,
      populate: ['license.user']
    });

    if (!seat || !seat.license) {
      return false;
    }

    const license = seat.license;
    const licenseUser = typeof license.user === 'object' 
      ? license.user.documentId 
      : license.user;

    return licenseUser === userDocumentId;
  } catch (error) {
    strapi.log.error(`[TelemetryQueryHandler] Error validating seat access`, {
      error: error.message
    });
    return false;
  }
}

/**
 * Sends fallback snapshot when POS is offline or timeout occurs
 * @param socket - Mobile client socket
 * @param strapi - Strapi instance
 * @param requestId - Request ID
 * @param keySeatDocumentId - Seat document ID
 */
async function sendFallbackSnapshot(
  socket: Socket,
  strapi: Core.Strapi,
  requestId: string,
  keySeatDocumentId: string
): Promise<void> {
  try {
    const service = strapi.service('api::key-seat.key-seat');
    const snapshot = await service.getLatestSnapshot(keySeatDocumentId);

    if (!snapshot) {
      socket.emit(SocketIOEvents.EmitTelemetryQueryError, {
        requestId,
        keySeatDocumentId,
        error: 'POS device offline and no snapshot available',
        fallbackAvailable: false
      } as TelemetryQueryError);
      return;
    }

    // Calculate snapshot age
    const snapshotDate = new Date(snapshot.capturedAt);
    const ageHours = Math.floor((Date.now() - snapshotDate.getTime()) / (1000 * 60 * 60));

    socket.emit(SocketIOEvents.EmitTelemetryQueryResponse, {
      requestId,
      keySeatDocumentId,
      source: 'snapshot',
      data: snapshot.telemetryData,
      timestamp: snapshot.capturedAt,
      success: true,
      warning: `POS device offline - showing snapshot from ${ageHours} hours ago`,
      snapshotAge: ageHours
    });

    strapi.log.info(`[TelemetryQueryHandler] Sent fallback snapshot`, {
      requestId,
      keySeatDocumentId,
      snapshotAge: ageHours
    });

  } catch (error) {
    strapi.log.error(`[TelemetryQueryHandler] Error sending fallback snapshot`, {
      error: error.message
    });

    socket.emit(SocketIOEvents.EmitTelemetryQueryError, {
      requestId,
      keySeatDocumentId,
      error: 'Failed to retrieve fallback data',
      fallbackAvailable: false
    } as TelemetryQueryError);
  }
}

/**
 * Cleans up pending requests for a disconnected socket
 * Prevents memory leaks and ensures timeouts are cleared
 * @param socket - Socket that disconnected
 * @param strapi - Strapi instance
 */
async function cleanupPendingRequests(socket: Socket, strapi: Core.Strapi): Promise<void> {
  try {
    const cleanedCount = await redisStateManager.cleanupPendingRequestsForSocket(socket.id);
    
    if (cleanedCount > 0) {
      strapi.log.info(`[TelemetryQueryHandler] Cleaned up ${cleanedCount} pending requests for socket ${socket.id}`);
    }
  } catch (error) {
    strapi.log.error(`[TelemetryQueryHandler] Error cleaning up pending requests:`, error);
  }
}
