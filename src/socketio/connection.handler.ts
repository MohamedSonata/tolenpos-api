/**
 * Connection Socket Handler
 * Handles socket connection, authentication, and disconnection
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';

import authenticateUserConnection from '../socketio/services';
import { setupSeatUpdateHandlers } from './handlers/seat-update.handler';
import { setupTelemetryQueryHandlers } from './handlers/telemetry-query.handler';
import { setupCustomerAppHandlers } from './handlers/customer-app.handler';
import { setupPOSCustomerResponseHandlers } from './handlers/pos-customer-response.handler';
import { initializeSocketManager, multiReplicaSocketManager } from './socket-manager';

// Constants
const USER_SOCKET_TTL = 86400; // 24 hours in seconds

/**
 * Sets up connection handlers for the Socket.IO server
 * @param io - Socket.IO server instance
 * @param strapi - Strapi instance
 */
export function setupConnectionHandlers(
  io: SocketIOServer,
  strapi: Core.Strapi
): void {
  strapi.log.info('[ConnectionHandler] Setting up connection handlers');

  // Initialize socket manager for multi-replica support
  initializeSocketManager(io, strapi);

  io.on('connection', async (socket: Socket) => {
    strapi.log.info(`[ConnectionHandler] New connection: ${socket.id}`);

    // Check if this is a customer or website connection (no auth required)
    const query = socket.handshake.query as any;
    const clientType = query.clientType as string;

    if (clientType === 'customer' || clientType === 'Website') {
      // Customer and website connections don't require authentication
      strapi.log.info(`[ConnectionHandler] ${clientType} connection detected: ${socket.id}`);
      
      // Store client type in socket data for handlers
      socket.data.clientType = clientType;
      
      // Set up customer app handlers (works for both customer mobile app and website)
      setupCustomerAppHandlers(socket, strapi, io);
      
      // Handle disconnection (customer handler has its own disconnect logic)
      return;
    }

    // Authenticate the connection for POS and mobile clients (Requirement 6.1)
    const authenticated = await authenticateUserConnection({ strapi }).authenticateUserConnection(socket);

    if (!authenticated) {
      strapi.log.warn(`[ConnectionHandler] Authentication failed for socket ${socket.id}`);
      return;
    }

    // Get user info and client type from socket
    const userId = (socket as any).userID;
    const authenticatedClientType = (socket as any).clientType;
    const machineUUID = (socket as any).machineUUID;
    const keySeatDocumentId = (socket as any).keySeatDocumentId;
    
    strapi.log.warn(`[ConnectionHandler] New connection User ID: ${userId}, Client Type: ${authenticatedClientType}`);
    
    if (userId) {
      // Determine user role and document ID
      const userInfo = await getUserInfo(strapi, userId);
      
      if (userInfo) {
        // Store user info in socket data for easy access
        socket.data = {
          userId,
          documentId: userInfo.documentId,
          clientType: authenticatedClientType,
          machineUUID,
          keySeatDocumentId,
        };
        strapi.log.warn(`[ConnectionHandler] New connection User info: ${JSON.stringify(socket.data)}`);

        // Map user to socket based on client type
        if (authenticatedClientType === 'pos' && keySeatDocumentId) {
          // Update key-seat socket ID for POS clients
          await updateKeySeatSocketId(socket, keySeatDocumentId, strapi);
          
          // Send current plan to POS on connection (use documentId, not userId)
          await sendCurrentPlanToPOS(socket, userInfo.documentId, strapi);
          
          // Set up POS customer response handlers for POS clients
          setupPOSCustomerResponseHandlers(socket, strapi, io);
        } else {
          // Update user socket ID for mobile clients
          await mapUserToSocket(socket, userInfo);
        }

        // Join appropriate rooms for cross-replica communication
        await multiReplicaSocketManager.joinUserRooms(socket);

        // Set up seat update handlers AFTER socket.data is populated
        setupSeatUpdateHandlers(socket, strapi, io);
        
        // Set up telemetry query handlers
        setupTelemetryQueryHandlers(socket, strapi, io);
      }
    }

    // Handle disconnection
    socket.on('disconnect', async () => {
      // Leave rooms before handling disconnection
      await multiReplicaSocketManager.leaveUserRooms(socket);
      await handleDisconnection(socket, strapi, io);
    });
  });
}


/**
 * Gets user info (role and document ID) from database
 */
async function getUserInfo(
  strapi: Core.Strapi,
  userId: string | number
): Promise<{ role: 'authenticated' | 'none'; documentId: string } | null> {
  try {
    // Try to find user by id (numeric) or documentId (string)
    let user;
    
    if (typeof userId === 'number' || !isNaN(Number(userId))) {
      // If userId is numeric, search by id field
      user = await strapi.documents('plugin::users-permissions.user').findFirst({
        filters: {
          id: Number(userId),
        },
        fields: ['id', 'documentId'],
      });
    } else {
      // If userId is a string (documentId), search by documentId
      user = await strapi.documents('plugin::users-permissions.user').findFirst({
        filters: {
          documentId: userId,
        },
        fields: ['id', 'documentId'],
      });
    }

    if (user) {
      return { role: 'authenticated', documentId: user.documentId };
    }

    
    return null;
  } catch (error) {
    strapi.log.error(`[ConnectionHandler] Error getting user info: ${error}`);
    return null;
  }
}

/**
 * Updates the socket ID in the key-seat table for POS clients
 * NOTE: This is kept for backward compatibility and monitoring purposes only.
 * The actual communication uses room-based system, not socket IDs.
 */
async function updateKeySeatSocketId(
  socket: Socket,
  keySeatDocumentId: string,
  strapi: Core.Strapi
): Promise<void> {
  try {
    // Update the socket ID and connection status for monitoring/debugging purposes
    // The room-based system doesn't rely on this
    await strapi.documents('api::key-seat.key-seat').update({
      documentId: keySeatDocumentId,
      status: 'published',
      data: {
        userSocketId: socket.id, // For monitoring only
     //   socketConnectionStatus: true, // Mark as connected
        isConnected: true, // Mark as connected
      //  lastConnectedAt: new Date().toISOString(), // Track connection time
      },
    });
    strapi.log.info(`[ConnectionHandler] Updated key-seat connection info for ${keySeatDocumentId}`);
  } catch (error) {
    strapi.log.error(`[ConnectionHandler] Error updating key-seat connection info: ${error}`);
  }
}

/**
 * Maps user to socket in Redis
 * Requirement: 6.2
 * NOTE: Room-based system handles actual communication. No socket ID storage needed.
 */
async function mapUserToSocket(
  socket: Socket,
  userInfo: { role: 'authenticated' | 'none'; documentId: string }
): Promise<void> {
  try {
    // Only update connection status, not socket ID (supports multiple devices)
    if (userInfo.role === 'authenticated') {
      await updateUserConnectionStatus(socket, userInfo.documentId, true);
    }
  } catch (error) {
    console.error(`[ConnectionHandler] Error mapping user to socket: ${error}`);
  }
}

/**
 * Updates user connection status without storing socket ID
 * This allows multiple devices to be connected simultaneously
 */
async function updateUserConnectionStatus(
  socket: Socket,
  userDocumentId: string,
  isConnected: boolean
): Promise<void> {
  try {
    await strapi.documents('plugin::users-permissions.user').update({
      documentId: userDocumentId,
      data: {
        socketConnectionStatus: isConnected,
        lastConnectedAt: new Date().toISOString(),
      },
      status: 'published',
    });
    
    strapi.log.info(`[ConnectionHandler] Updated connection status for user ${userDocumentId}: ${isConnected}`);
  } catch (error) {
    console.error(`[ConnectionHandler] Error updating user connection status: ${error}`);
  }
}

/**
 * Handles socket disconnection
 * Requirements: 6.4, 6.5, 8.1
 */
async function handleDisconnection(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): Promise<void> {
  strapi.log.info(`[ConnectionHandler] Socket disconnected: ${socket.id}`);

  try {
    // Get user info from socket data
    const { documentId, clientType, keySeatDocumentId } = socket.data || {};

    if (!documentId) {
      return;
    }

    // Clear socket ID based on client type
    if (clientType === 'pos' && keySeatDocumentId) {
      // Clear key-seat socket ID for POS clients
      await clearKeySeatSocketId(keySeatDocumentId, socket.id, strapi);
    } else if (clientType === 'mobile') {
      // Clear user socket ID for mobile clients
      await clearUserSocketId(documentId, strapi, io);
    }
  } catch (error) {
    strapi.log.error(`[ConnectionHandler] Error handling disconnection: ${error}`);
  }
}

/**
 * Clears the socket ID from key-seat table for POS clients
 * Also resets customer connections to 0 since POS is offline
 * Handles database errors gracefully during shutdown
 */
async function clearKeySeatSocketId(
  keySeatDocumentId: string,
  socketId: string,
  strapi: Core.Strapi
): Promise<void> {
  try {
    // Verify the socket ID matches before clearing (prevent race conditions)
    const keySeat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId: keySeatDocumentId,
    });

    if (keySeat && keySeat.userSocketId === socketId) {
      const previousCustomerConnections = keySeat.currentCustomerConnections || 0;
      
      await strapi.documents('api::key-seat.key-seat').update({
        documentId: keySeatDocumentId,
        status: 'published',
        data: {
          userSocketId: null,
          isConnected: false, // Mark as disconnected
          currentCustomerConnections: 0, // Reset customer connections since POS is offline
        },
      });
      
      strapi.log.info(`[ConnectionHandler] Cleared key-seat socket ID for key-seat ${keySeatDocumentId}`, {
        previousCustomerConnections,
        resetTo: 0
      });
      
      if (previousCustomerConnections > 0) {
        strapi.log.warn(`[ConnectionHandler] Reset ${previousCustomerConnections} customer connection(s) due to POS disconnect`);
      }
    } else {
      strapi.log.warn(`[ConnectionHandler] Socket ID mismatch or already cleared for key-seat ${keySeatDocumentId}`);
    }
  } catch (error) {
    // During shutdown, database queries may fail - handle gracefully
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('Timeout') || errorMessage.includes('pool') || errorMessage.includes('aborted')) {
      strapi.log.debug(`[ConnectionHandler] Database unavailable during disconnect cleanup (likely shutting down)`);
    } else {
      strapi.log.error(`[ConnectionHandler] Error clearing key-seat socket ID:`, errorMessage);
    }
  }
}

/**
 * Updates user connection status on disconnect
 * NOTE: We don't set socketConnectionStatus to false immediately because
 * the user might have other devices still connected. The status is managed
 * by checking if any sockets exist in the user's room.
 * Handles database errors gracefully during shutdown
 */
async function clearUserSocketId(
  userDocumentId: string,
  strapi: Core.Strapi,
  io: SocketIOServer
): Promise<void> {
  try {
    // Check if user has other active connections in their room
    const roomName = `user:${userDocumentId}:seats`;
    const socketsInRoom = await io.in(roomName).fetchSockets();
    
    // Only mark as disconnected if no other devices are connected
    if (socketsInRoom.length === 0) {
      await strapi.documents('plugin::users-permissions.user').update({
        documentId: userDocumentId,
        data: {
          socketConnectionStatus: false,
        },
        status: 'published',
      });
      strapi.log.info(`[ConnectionHandler] User ${userDocumentId} fully disconnected (no devices remaining)`);
    } else {
      strapi.log.info(`[ConnectionHandler] User ${userDocumentId} still has ${socketsInRoom.length} device(s) connected`);
    }
  } catch (error) {
    // During shutdown, database queries may fail - handle gracefully
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('Timeout') || errorMessage.includes('pool') || errorMessage.includes('aborted')) {
      strapi.log.debug(`[ConnectionHandler] Database unavailable during user disconnect cleanup (likely shutting down)`);
    } else {
      strapi.log.error(`[ConnectionHandler] Error updating user connection status:`, errorMessage);
    }
  }
}

/**
 * Sends current plan information to POS client on connection
 * This allows POS to sync with server when online
 */
async function sendCurrentPlanToPOS(
  socket: Socket,
  userDocumentId: string,
  strapi: Core.Strapi
): Promise<void> {
  try {
    // Fetch user's current plan
    const user = await strapi.documents('plugin::users-permissions.user').findOne({
      documentId: userDocumentId,
      fields: ['planType']
    });

    if (user && user.planType) {
      const planFeatures = getPlanFeatures(user.planType);
      
      socket.emit('plan:current', {
        planType: user.planType,
        features: planFeatures,
        syncedAt: new Date().toISOString()
      });
      
      strapi.log.info(`[ConnectionHandler] Sent current plan to POS: ${user.planType}`);
    }
  } catch (error) {
    strapi.log.error(`[ConnectionHandler] Error sending plan to POS: ${error}`);
  }
}

/**
 * Gets feature set for a given plan type
 */
function getPlanFeatures(planType: string): Record<string, any> {
  const features: Record<string, Record<string, any>> = {
    'FreeTrial': {
      maxProducts: 100,
      maxRegisters: 1,
      advancedReporting: false,
      multiLocation: false,
      inventoryManagement: true,
      basicReports: true,
      duration: '30 days'
    },
    'Pro': {
      maxProducts: 5000,
      maxRegisters: 3,
      advancedReporting: true,
      multiLocation: false,
      inventoryManagement: true,
      basicReports: true,
      customerManagement: true,
      emailSupport: true
    },
    'Enterprise': {
      maxProducts: -1,  // unlimited
      maxRegisters: -1,  // unlimited
      advancedReporting: true,
      multiLocation: true,
      inventoryManagement: true,
      basicReports: true,
      customerManagement: true,
      prioritySupport: true,
      customIntegrations: true,
      dedicatedAccountManager: true
    }
  };

  return features[planType] || features['FreeTrial'];
}

/**
 * Gets count of connected devices for a user
 * Useful for monitoring and debugging multi-device connections
 */
export async function getConnectedDeviceCount(
  userDocumentId: string,
  io: SocketIOServer
): Promise<number> {
  try {
    const roomName = `user:${userDocumentId}:seats`;
    const socketsInRoom = await io.in(roomName).fetchSockets();
    return socketsInRoom.length;
  } catch (error) {
    console.error(`[ConnectionHandler] Error getting connected device count: ${error}`);
    return 0;
  }
}

/**
 * Notifies all POS machines for a user about plan changes
 * Call this when a user upgrades/downgrades their plan
 * Uses room-based communication for multi-replica support
 */
export async function notifyPOSMachinesOfPlanChange(
  userDocumentId: string,
  newPlanType: string,
  io: SocketIOServer,
  strapi: Core.Strapi
): Promise<void> {
  try {
    // Find all licenses for the user
    const licenses = await strapi.documents('api::license.license').findMany({
      filters: {
        user: {
          documentId: userDocumentId,
        },
        isActive: true,
      },
      populate: ['seats'],
    });

    const planFeatures = getPlanFeatures(newPlanType);
    let notifiedCount = 0;

    // Emit to all connected POS machines using room-based system
    for (const license of licenses) {
      // Update license plan type
      await strapi.documents('api::license.license').update({
        documentId: license.documentId,
        data: { planSubscriptionType: newPlanType as 'FreeTrial' | 'Pro' | 'Enterprise' },
      });

      // Notify connected POS machines via their seat rooms
      if (license.seats) {
        for (const seat of license.seats) {
          if (seat.isActive && seat.documentId) {
            const seatRoomName = `seat:${seat.documentId}`;
            
            // Check if seat has connected devices
            const socketsInRoom = await io.in(seatRoomName).fetchSockets();
            
            if (socketsInRoom.length > 0) {
              io.to(seatRoomName).emit('plan:updated', {
                planType: newPlanType,
                features: planFeatures,
                effectiveDate: new Date().toISOString()
              });
              notifiedCount += socketsInRoom.length;
              strapi.log.info(`[ConnectionHandler] Notified ${socketsInRoom.length} POS instance(s) for seat ${seat.machineUUID}`);
            }
          }
        }
      }
    }

    strapi.log.info(`[ConnectionHandler] Plan change notification sent to ${notifiedCount} POS instance(s)`);
  } catch (error) {
    strapi.log.error(`[ConnectionHandler] Error notifying POS machines of plan change: ${error}`);
  }
}




