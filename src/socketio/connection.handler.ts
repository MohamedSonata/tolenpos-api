/**
 * Connection Socket Handler
 * Handles socket connection, authentication, and disconnection
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';

import authenticateUserConnection from '../socketio/services';

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

  io.on('connection', async (socket: Socket) => {
    strapi.log.info(`[ConnectionHandler] New connection: ${socket.id}`);

    // Authenticate the connection (Requirement 6.1)
    const authenticated = await authenticateUserConnection({ strapi }).authenticateUserConnection(socket);

    if (!authenticated) {
      strapi.log.warn(`[ConnectionHandler] Authentication failed for socket ${socket.id}`);
      return;
    }

    // Get user info from socket
    const userId = (socket as any).userID;
    strapi.log.warn(`[ConnectionHandler]  New connection User ID: ${userId}`);
    
    if (userId) {
      // Determine user role and document ID
      const userInfo = await getUserInfo(strapi, userId);
      
      if (userInfo) {
        // Store user info in socket data for easy access
        socket.data = {
          userId,

          documentId: userInfo.documentId,
        };
        strapi.log.warn(`[ConnectionHandler]  New connection User info: ${JSON.stringify(socket.data)}`);

        // Map user to socket in Redis (Requirement 6.2)
        await mapUserToSocket(socket, userInfo);

 
      }
  
    }

    // Handle disconnection
    socket.on('disconnect', async () => {
      await handleDisconnection(socket, strapi);
    });
  });
}


/**
 * Gets user info (role and document ID) from database
 */
async function getUserInfo(
  strapi: Core.Strapi,
  userId: string
): Promise<{ role: 'authenticated' | 'none'; documentId: string } | null> {
  try {
    // First check if user is a driver
    const user = await strapi.documents('plugin::users-permissions.user').findFirst({
      filters: {
        documentId:  userId ,
      },
      fields: ['documentId'],
    });

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
 * Maps user to socket in Redis
 * Requirement: 6.2
 */
async function mapUserToSocket(
  socket: Socket,
  userInfo: { role: 'authenticated' | 'none'; documentId: string }
): Promise<void> {
  try {
   

    // Update socket ID in database for drivers
    if (userInfo.role === 'authenticated') {
      await updateUserSocketId(socket, userInfo.documentId);
    }
  } catch (error) {
    console.error(`[ConnectionHandler] Error mapping user to socket: ${error}`);
  }
}
async function updateUserSocketId(
  socket: Socket,
  userDocumentId: string
): Promise<void> {
  try {
    await strapi.documents('plugin::users-permissions.user').update({
      documentId: userDocumentId,
      
      data: {
        socketId:socket.id,
      },
      status: 'published',
    });
  } catch (error) {
    console.error(`[ConnectionHandler] Error updating driver socket ID: ${error}`);
  }
}

/**
 * Handles socket disconnection
 * Requirements: 6.4, 6.5, 8.1
 */
async function handleDisconnection(
  socket: Socket,
  strapi: Core.Strapi
): Promise<void> {
  strapi.log.info(`[ConnectionHandler] Socket disconnected: ${socket.id}`);

  try {
    // Get user info from socket data
    const { role, documentId } = socket.data || {};

    if (!documentId) {
      return;
    }

  

 
  
  } catch (error) {
    strapi.log.error(`[ConnectionHandler] Error handling disconnection: ${error}`);
  }
}




