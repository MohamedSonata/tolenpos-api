/**
 * Enhanced Socket Manager for Multi-Replica Environment
 * Handles socket management with room-based architecture and Redis fallback
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';
import { socketEventManager } from './socket-io-manager';

export class MultiReplicaSocketManager {
  private static instance: MultiReplicaSocketManager;
  private io: SocketIOServer;
  private strapi: Core.Strapi;

  private constructor(io: SocketIOServer, strapi: Core.Strapi) {
    this.io = io;
    this.strapi = strapi;
  }

  public static getInstance(io: SocketIOServer, strapi: Core.Strapi): MultiReplicaSocketManager {
    if (!MultiReplicaSocketManager.instance) {
      MultiReplicaSocketManager.instance = new MultiReplicaSocketManager(io, strapi);
    }
    return MultiReplicaSocketManager.instance;
  }

  /**
   * Emit to user by document ID (works across replicas)
   */
  public async emitToUser<T>(
    userDocumentId: string,
    eventName: string,
    data: T,
    clientType?: 'mobile' | 'pos'
  ): Promise<boolean> {
    try {
      // Use room-based emission for cross-replica communication
      const roomName = `user:${userDocumentId}`;
      
      if (clientType) {
        const specificRoom = `${roomName}:${clientType}`;
        this.io.to(specificRoom).emit(eventName, data);
        this.strapi.log.debug(`[SocketManager] Emitted ${eventName} to room ${specificRoom}`);
      } else {
        this.io.to(roomName).emit(eventName, data);
        this.strapi.log.debug(`[SocketManager] Emitted ${eventName} to room ${roomName}`);
      }
      
      return true;
    } catch (error) {
      this.strapi.log.error(`[SocketManager] Error emitting to user ${userDocumentId}:`, error);
      return false;
    }
  }

  /**
   * Emit to POS machine by key-seat document ID
   */
  public async emitToPOSMachine<T>(
    keySeatDocumentId: string,
    eventName: string,
    data: T
  ): Promise<boolean> {
    try {
      const roomName = `pos:${keySeatDocumentId}`;
      this.io.to(roomName).emit(eventName, data);
      this.strapi.log.debug(`[SocketManager] Emitted ${eventName} to POS room ${roomName}`);
      return true;
    } catch (error) {
      this.strapi.log.error(`[SocketManager] Error emitting to POS ${keySeatDocumentId}:`, error);
      return false;
    }
  }

  /**
   * Emit to all POS machines for a license
   */
  public async emitToLicensePOSMachines<T>(
    licenseDocumentId: string,
    eventName: string,
    data: T
  ): Promise<boolean> {
    try {
      const roomName = `license:${licenseDocumentId}`;
      this.io.to(roomName).emit(eventName, data);
      this.strapi.log.debug(`[SocketManager] Emitted ${eventName} to license room ${roomName}`);
      return true;
    } catch (error) {
      this.strapi.log.error(`[SocketManager] Error emitting to license ${licenseDocumentId}:`, error);
      return false;
    }
  }

  /**
   * Join socket to appropriate rooms based on user type and data
   */
  public async joinUserRooms(socket: Socket): Promise<void> {
    try {
      const { userId, documentId, clientType, keySeatDocumentId } = socket.data || {};

      if (!documentId) {
        this.strapi.log.warn(`[SocketManager] No documentId found for socket ${socket.id}`);
        return;
      }

      // Join user-specific room
      const userRoom = `user:${documentId}`;
      await socket.join(userRoom);
      this.strapi.log.debug(`[SocketManager] Socket ${socket.id} joined room ${userRoom}`);

      // Join client-type specific room
      if (clientType) {
        const clientRoom = `${userRoom}:${clientType}`;
        await socket.join(clientRoom);
        this.strapi.log.debug(`[SocketManager] Socket ${socket.id} joined room ${clientRoom}`);
      }

      // For mobile clients, join seats subscription room
      if (clientType === 'mobile') {
        const seatsRoom = `user:${documentId}:seats`;
        await socket.join(seatsRoom);
        this.strapi.log.debug(`[SocketManager] Socket ${socket.id} joined seats room ${seatsRoom}`);
        
        // Also join a mobile-specific room for direct messaging
        const mobileRoom = `mobile:${socket.id}`;
        await socket.join(mobileRoom);
        this.strapi.log.debug(`[SocketManager] Socket ${socket.id} joined mobile room ${mobileRoom}`);
      }

      // For POS clients, join additional rooms
      if (clientType === 'pos' && keySeatDocumentId) {
        // Join POS-specific room
        const posRoom = `pos:${keySeatDocumentId}`;
        await socket.join(posRoom);
        this.strapi.log.debug(`[SocketManager] Socket ${socket.id} joined POS room ${posRoom}`);

        // Join license room (for license-wide broadcasts)
        const licenseDocumentId = await this.getLicenseForKeySeat(keySeatDocumentId);
        if (licenseDocumentId) {
          const licenseRoom = `license:${licenseDocumentId}`;
          await socket.join(licenseRoom);
          this.strapi.log.debug(`[SocketManager] Socket ${socket.id} joined license room ${licenseRoom}`);
        }
      }
    } catch (error) {
      this.strapi.log.error(`[SocketManager] Error joining rooms for socket ${socket.id}:`, error);
    }
  }

  /**
   * Leave all user rooms when socket disconnects
   */
  public async leaveUserRooms(socket: Socket): Promise<void> {
    try {
      const { documentId, clientType, keySeatDocumentId } = socket.data || {};

      if (!documentId) return;

      const rooms = [
        `user:${documentId}`,
        `user:${documentId}:${clientType}`,
      ];

      if (clientType === 'mobile') {
        rooms.push(`user:${documentId}:seats`);
        rooms.push(`mobile:${socket.id}`);
      }

      if (clientType === 'pos' && keySeatDocumentId) {
        rooms.push(`pos:${keySeatDocumentId}`);
        
        const licenseDocumentId = await this.getLicenseForKeySeat(keySeatDocumentId);
        if (licenseDocumentId) {
          rooms.push(`license:${licenseDocumentId}`);
        }
      }

      for (const room of rooms) {
        if (room.includes('undefined') || room.includes('null')) continue;
        await socket.leave(room);
        this.strapi.log.debug(`[SocketManager] Socket ${socket.id} left room ${room}`);
      }
    } catch (error) {
      this.strapi.log.error(`[SocketManager] Error leaving rooms for socket ${socket.id}:`, error);
    }
  }

  /**
   * Get license document ID for a key-seat
   * Handles errors gracefully during shutdown
   */
  private async getLicenseForKeySeat(keySeatDocumentId: string): Promise<string | null> {
    try {
      const keySeat = await this.strapi.documents('api::key-seat.key-seat').findOne({
        documentId: keySeatDocumentId,
        populate: ['license'],
      });

      return keySeat?.license?.documentId || null;
    } catch (error) {
      // During shutdown, database queries may be aborted - this is expected
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('aborted') || errorMessage.includes('Timeout') || errorMessage.includes('pool')) {
        this.strapi.log.debug(`[SocketManager] Database unavailable for key-seat ${keySeatDocumentId} (likely shutting down)`);
      } else {
        this.strapi.log.error(`[SocketManager] Error getting license for key-seat ${keySeatDocumentId}:`, errorMessage);
      }
      return null;
    }
  }

  /**
   * Get connected socket count for a room
   */
  public async getRoomSocketCount(roomName: string): Promise<number> {
    try {
      const sockets = await this.io.in(roomName).fetchSockets();
      return sockets.length;
    } catch (error) {
      this.strapi.log.error(`[SocketManager] Error getting socket count for room ${roomName}:`, error);
      return 0;
    }
  }

  /**
   * Check if user is connected (in any replica)
   */
  public async isUserConnected(userDocumentId: string, clientType?: 'mobile' | 'pos'): Promise<boolean> {
    try {
      const roomName = clientType ? `user:${userDocumentId}:${clientType}` : `user:${userDocumentId}`;
      const count = await this.getRoomSocketCount(roomName);
      return count > 0;
    } catch (error) {
      this.strapi.log.error(`[SocketManager] Error checking user connection ${userDocumentId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export let multiReplicaSocketManager: MultiReplicaSocketManager;

export function initializeSocketManager(io: SocketIOServer, strapi: Core.Strapi): MultiReplicaSocketManager {
  multiReplicaSocketManager = MultiReplicaSocketManager.getInstance(io, strapi);
  return multiReplicaSocketManager;
}