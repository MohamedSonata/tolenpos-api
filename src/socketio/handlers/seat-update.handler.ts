/**
 * Seat Update Socket Handler
 * Handles POS seat update events and mobile app subscription to seat updates
 * Requirements: 7.1, 7.2, 8.1
 * 
 * MULTI-REPLICA COMPATIBLE:
 * - Uses room-based communication exclusively
 * - No socket ID storage in database
 * - Works across all replicas seamlessly
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';
import { SocketIOEvents } from '../events_constants';
import { SeatUpdatePayload, SeatSubscribePayload } from '../interfaces';
import { multiReplicaSocketManager } from '../socket-manager';

/**
 * Sets up seat update event handlers for Socket.IO connections
 * This should be called from within the connection handler after socket.data is populated
 * @param socket - Socket instance
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
export function setupSeatUpdateHandlers(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  // Only set up handlers for authenticated sockets
  if (!socket.data?.userId) {
    strapi.log.warn(`[SeatUpdateHandler] No userId in socket.data for socket ${socket.id}`);
    return;
  }

  strapi.log.info(`[SeatUpdateHandler] Setting up handlers for socket ${socket.id}, clientType: ${socket.data.clientType}`);

  // POS: Handle seat update events
  if (socket.data.clientType === 'pos') {
    strapi.log.info(`[SeatUpdateHandler] Registering POS handlers for socket ${socket.id}`);
    handlePOSSeatUpdate(socket, strapi, io);
  }

  // Mobile: Handle seat subscription events
  if (socket.data.clientType === 'mobile') {
    strapi.log.info(`[SeatUpdateHandler] Registering mobile handlers for socket ${socket.id}`);
    handleMobileSeatSubscription(socket, strapi);
  }
}


/**
 * Handles seat update events from POS clients
 * Requirements: 1.1, 1.2, 1.3, 1.5, 7.3, 7.4, 7.5, 8.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 13.1
 * @param socket - Socket instance for the POS client
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance for broadcasting
 */
function handlePOSSeatUpdate(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnSeatUpdate, async (payload: SeatUpdatePayload) => {
    try {
      const { keySeatDocumentId } = socket.data;

      // Validate that the socket has an associated seat
      if (!keySeatDocumentId) {
        strapi.log.warn(`[SeatUpdateHandler] No seat associated with socket ${socket.id}`);
        socket.emit(SocketIOEvents.EmitSeatUpdateSuccess, {
          success: false,
          error: 'No seat associated with this connection'
        });
        return;
      }

      // Extract fields from payload
      const { realtimeTelemetry, historicalKpiSummary } = payload;

      // Log incoming payload structure
      strapi.log.info(`[SeatUpdateHandler] Received seat update for ${keySeatDocumentId}`, {
        hasRealtimeTelemetry: !!realtimeTelemetry,
        hasHistoricalKpiSummary: !!historicalKpiSummary,
        realtimeTelemetryKeys: realtimeTelemetry ? Object.keys(realtimeTelemetry) : [],
        historicalKpiSummaryKeys: historicalKpiSummary ? Object.keys(historicalKpiSummary) : []
      });

      // Log incoming payload structure
      strapi.log.info(`[SeatUpdateHandler] Received seat update for ${keySeatDocumentId}`, {
        hasRealtimeTelemetry: !!realtimeTelemetry,
        hasHistoricalKpiSummary: !!historicalKpiSummary,
        realtimeTelemetryKeys: realtimeTelemetry ? Object.keys(realtimeTelemetry) : [],
        historicalKpiSummaryKeys: historicalKpiSummary ? Object.keys(historicalKpiSummary) : []
      });

      // Update seat telemetry via service
      const service = strapi.service('api::key-seat.key-seat');
      const updatedSeat = await service.updateSeatTelemetry(
        keySeatDocumentId,
        realtimeTelemetry,
        historicalKpiSummary
      );

      // Emit success to POS client
      socket.emit(SocketIOEvents.EmitSeatUpdateSuccess, {
        success: true,
        updatedAt: updatedSeat.updatedAt
      });

      strapi.log.info(`[SeatUpdateHandler] Seat updated successfully: ${keySeatDocumentId}`);

      // Notify subscribed mobile apps
      await notifyMobileAppsOfSeatUpdate(io, strapi, updatedSeat, socket.data.userId);
    } catch (error) {
      strapi.log.error(`[SeatUpdateHandler] Error updating seat: ${error.message}`, {
        socketId: socket.id,
        keySeatDocumentId: socket.data?.keySeatDocumentId,
        error: error.stack
      });
      socket.emit(SocketIOEvents.EmitSeatUpdateSuccess, {
        success: false,
        error: 'Failed to update seat data'
      });
    }
  });
}


/**
 * Handles seat subscription events from mobile clients
 * Requirements: 4.1, 4.2, 4.3, 4.6, 7.3, 7.4, 7.5, 11.3, 11.4, 11.5
 * @param socket - Socket instance for the mobile client
 * @param strapi - Strapi instance
 */
function handleMobileSeatSubscription(
  socket: Socket,
  strapi: Core.Strapi
): void {
  // Handle subscription event
  socket.on(SocketIOEvents.OnSeatSubscribe, async () => {
    try {
      const { documentId } = socket.data;

      if (!documentId) {
        strapi.log.warn(`[SeatUpdateHandler] No documentId for socket ${socket.id}`);
        socket.emit(SocketIOEvents.EmitSeatSubscribeSuccess, {
          success: false,
          error: 'User document ID not found'
        });
        return;
      }

      // Join a user-specific room for seat updates
      const roomName = `user:${documentId}:seats`;
      socket.join(roomName);

      socket.emit(SocketIOEvents.EmitSeatSubscribeSuccess, {
        success: true,
        message: 'Subscribed to seat updates'
      });

      strapi.log.info(`[SeatUpdateHandler] Mobile app subscribed to seats: ${documentId} (room: ${roomName})`);
    } catch (error) {
      strapi.log.error(`[SeatUpdateHandler] Error subscribing to seats: ${error.message}`, {
        socketId: socket.id,
        error: error.stack
      });
      socket.emit(SocketIOEvents.EmitSeatSubscribeSuccess, {
        success: false,
        error: 'Failed to subscribe to seat updates'
      });
    }
  });

  // Handle unsubscribe event
  socket.on(SocketIOEvents.OnSeatUnsubscribe, async () => {
    try {
      const { documentId } = socket.data;

      if (!documentId) {
        strapi.log.warn(`[SeatUpdateHandler] No documentId for socket ${socket.id} during unsubscribe`);
        return;
      }

      const roomName = `user:${documentId}:seats`;
      socket.leave(roomName);

      strapi.log.info(`[SeatUpdateHandler] Mobile app unsubscribed from seats: ${documentId} (room: ${roomName})`);
    } catch (error) {
      strapi.log.error(`[SeatUpdateHandler] Error unsubscribing from seats: ${error.message}`, {
        socketId: socket.id,
        error: error.stack
      });
    }
  });
}


/**
 * Notifies all subscribed mobile apps of a seat update
 * Uses room-based communication for multi-replica compatibility
 * Requirements: 4.4, 4.5, 5.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.3, 11.4, 11.5
 * @param io - Socket.IO server instance
 * @param strapi - Strapi instance
 * @param updatedSeat - The updated seat document (with license populated)
 */
async function notifyMobileAppsOfSeatUpdate(
  io: SocketIOServer,
  strapi: Core.Strapi,
  updatedSeat: any,
  _userDocumentId: string
): Promise<void> {
  try {
    // Extract license documentId (handle both object and string)
    const licenseDocumentId = typeof updatedSeat.license === 'object' 
      ? updatedSeat.license.documentId 
      : updatedSeat.license;

    if (!licenseDocumentId) {
      strapi.log.warn(`[SeatUpdateHandler] No license found for seat ${updatedSeat.documentId}`);
      return;
    }

    // Get the license with user populated
    const license = await strapi.documents('api::license.license').findOne({
      documentId: licenseDocumentId,
      populate: ['user']
    });

    if (!license || !license.user) {
      strapi.log.warn(`[SeatUpdateHandler] No license/user found for seat ${updatedSeat.documentId}, license ID: ${licenseDocumentId}`);
      return;
    }

    // Extract owner document ID from license.user relation
    const ownerDocumentId = typeof license.user === 'object' 
      ? license.user.documentId 
      : license.user;

    // Prepare notification payload with real-time telemetry
    const notificationPayload = {
      machineUUID: updatedSeat.machineUUID,
      realtimeTelemetry: updatedSeat.realtimeTelemetry || updatedSeat.telemetry,
      isActive: updatedSeat.isActive,
      updatedAt: updatedSeat.updatedAt,
      licenseDocumentId: licenseDocumentId
    };

    // Emit to user-specific room (works across all replicas)
    const roomName = `user:${ownerDocumentId}:seats`;
    io.to(roomName).emit(SocketIOEvents.EmitSeatUpdated, notificationPayload);

    strapi.log.info(`[SeatUpdateHandler] Notified mobile apps in room ${roomName}`, {
      machineUUID: updatedSeat.machineUUID,
      ownerDocumentId,
      hasLastOrder: !!updatedSeat.realtimeTelemetry?.lastOrder,
      hasKpiSummary: !!updatedSeat.realtimeTelemetry?.kpiSummary,
      expensesCount: updatedSeat.realtimeTelemetry?.expenses?.length || 0
    });

  } catch (error) {
    strapi.log.error(`[SeatUpdateHandler] Error notifying mobile apps: ${error.message}`, {
      seatDocumentId: updatedSeat?.documentId,
      error: error.stack
    });
  }
}
  
