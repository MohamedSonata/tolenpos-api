/**
 * Customer Notification Helper
 * Utilities for finding and sending notifications to specific customers
 */

import type { Core } from '@strapi/strapi';
import { Server as SocketIOServer } from 'socket.io';

/**
 * Finds the FCM token for a specific customer by socketId or deviceId
 * @param strapi - Strapi instance
 * @param keySeatDocumentId - Key-seat document ID
 * @param customerSocketId - Customer's socket ID
 * @param deviceId - Optional device ID for fallback lookup
 * @returns FCM token object or null if not found
 */
export async function findCustomerFcmToken(
  strapi: Core.Strapi,
  keySeatDocumentId: string,
  customerSocketId: string,
  deviceId?: string
): Promise<{ token: string; deviceId: string; platform: string } | null> {
  try {
    // Fetch seat with FCM tokens
    const seat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId: keySeatDocumentId,
      populate: ['customerFcmTokens'],
      status: 'published'
    });

    if (!seat || !seat.customerFcmTokens) {
      strapi.log.debug(`[CustomerNotificationHelper] No FCM tokens found for seat`, {
        keySeatDocumentId
      });
      return null;
    }

    const tokens = seat.customerFcmTokens as any[];

    // First, try to find by socketId (most accurate for current connection)
    let matchingToken = tokens.find((t: any) => 
      t.socketId === customerSocketId && t.isActive
    );

    // Fallback: try to find by deviceId if provided
    if (!matchingToken && deviceId) {
      matchingToken = tokens.find((t: any) => 
        t.deviceId === deviceId && t.isActive
      );
    }

    if (matchingToken) {
      strapi.log.info(`[CustomerNotificationHelper] Found FCM token for customer`, {
        customerSocketId,
        deviceId: matchingToken.deviceId,
        platform: matchingToken.platform,
        matchedBy: matchingToken.socketId === customerSocketId ? 'socketId' : 'deviceId'
      });

      return {
        token: matchingToken.token,
        deviceId: matchingToken.deviceId,
        platform: matchingToken.platform
      };
    }

    strapi.log.debug(`[CustomerNotificationHelper] No matching FCM token found`, {
      customerSocketId,
      deviceId,
      totalTokens: tokens.length
    });

    return null;
  } catch (error) {
    strapi.log.error(`[CustomerNotificationHelper] Error finding FCM token`, {
      keySeatDocumentId,
      customerSocketId,
      error: error.message
    });
    return null;
  }
}

/**
 * Checks if a customer socket is still connected
 * @param io - Socket.IO server instance
 * @param customerSocketId - Customer's socket ID
 * @returns true if connected, false otherwise
 */
export function isCustomerConnected(
  io: SocketIOServer,
  customerSocketId: string
): boolean {
  return io.sockets.sockets.has(customerSocketId);
}

/**
 * Gets customer socket data if connected
 * @param io - Socket.IO server instance
 * @param customerSocketId - Customer's socket ID
 * @returns Socket data or null if not connected
 */
export function getCustomerSocketData(
  io: SocketIOServer,
  customerSocketId: string
): any | null {
  const socket = io.sockets.sockets.get(customerSocketId);
  return socket?.data || null;
}

/**
 * Cleans up stale socketId references in FCM tokens
 * Call this periodically or on disconnect to keep data clean
 * @param strapi - Strapi instance
 * @param keySeatDocumentId - Key-seat document ID
 * @param socketId - Socket ID to remove
 */
export async function cleanupStaleSocketId(
  strapi: Core.Strapi,
  keySeatDocumentId: string,
  socketId: string
): Promise<void> {
  try {
    const seat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId: keySeatDocumentId,
      populate: {
        customerFcmTokens:true
      },
      status: 'published'
    });

    if (!seat || !seat.customerFcmTokens) {
      return;
    }

    const tokens = seat.customerFcmTokens as any[];
    const hasMatchingSocket = tokens.some((t: any) => t.socketId === socketId);

    if (hasMatchingSocket) {
      // Clear socketId from matching tokens
      const updatedTokens = tokens.map((t: any) => {
        if (t.socketId === socketId) {
          return {
            ...t,
            socketId: null // Clear the socket reference
          };
        }
        return t;
      });

      await strapi.documents('api::key-seat.key-seat').update({
        documentId: keySeatDocumentId,
        data: {
          customerFcmTokens: updatedTokens,
          currentCustomerConnections:seat.currentCustomerConnections-1
        },
        status: 'published'
      });

      strapi.log.debug(`[CustomerNotificationHelper] Cleaned up stale socketId`, {
        keySeatDocumentId,
        socketId
      });
    }
  } catch (error) {
    strapi.log.error(`[CustomerNotificationHelper] Error cleaning up socketId`, {
      keySeatDocumentId,
      socketId,
      error: error.message
    });
  }
}
