import { Server as SocketIOServer, Socket } from 'socket.io';
import { Core } from '@strapi/strapi';

// Import services for initialization
import { setupConnectionHandlers } from './connection.handler';
import { setupRedisAdapter } from './redis-adapter';
import { initializeRedisStateManager } from './redis-state-manager';


// import rideEvents from './api-events/ride/ride-events';

interface StrapiWithIO extends Core.Strapi {
  io?: SocketIOServer;
  server: Core.Strapi['server'] & {
    httpServer: any; // We keep any here since the actual server type varies by environment
  };
}

/**
 * Initializes Socket.IO server and sets up event handlers
 * @param strapi - The Strapi instance
 */
async function initializeSocketIO(strapi: StrapiWithIO): Promise<void> {

  strapi.log.info('[SocketIO] Ride lifecycle and driver matching services initialized');

  // Create Socket.IO server with CORS configuration
  const io = new SocketIOServer(strapi.server.httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:1334",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Store io instance on strapi object for access in other modules
  strapi.io = io;

  // Setup Redis adapter for multi-replica support
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_REDIS_ADAPTER === 'true') {
    await setupRedisAdapter(io, strapi);
    
    // Initialize Redis state manager for shared state across replicas
    initializeRedisStateManager(strapi);
    
    strapi.log.info('[SocketIO] Multi-replica mode enabled with Redis');
  } else {
    strapi.log.warn('[SocketIO] Running in single-replica mode (no Redis adapter)');
  }

  setupConnectionHandlers(strapi.io, strapi);
}

export {
  initializeSocketIO,

};


