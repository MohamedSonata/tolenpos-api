/**
 * Redis Adapter Configuration for Socket.IO
 * Enables communication between Socket.IO instances across multiple replicas
 * 
 * Features:
 * - Automatic reconnection
 * - Health monitoring
 * - Graceful degradation
 * - Shared state management
 */

import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { Server as SocketIOServer } from 'socket.io';
import type { Core } from '@strapi/strapi';

interface RedisClients {
  pubClient: RedisClientType;
  subClient: RedisClientType;
  stateClient: RedisClientType; // For shared state (pending requests, etc.)
}

export async function setupRedisAdapter(
  io: SocketIOServer,
  strapi: Core.Strapi
): Promise<void> {
  try {
    // Redis configuration from environment
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES || '10', 10);
    const retryDelay = parseInt(process.env.REDIS_RETRY_DELAY || '3000', 10);
    
    strapi.log.info(`[Redis] Connecting to Redis at ${redisUrl}`);

    // Create Redis clients with retry strategy
    const clientConfig = {
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > maxRetries) {
            strapi.log.error(`[Redis] Max retries (${maxRetries}) exceeded`);
            return new Error('Max retries exceeded');
          }
          const delay = Math.min(retries * retryDelay, 30000); // Max 30s
          strapi.log.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        }
      }
    };

    // Create three clients: pub, sub, and state
    const pubClient = createClient(clientConfig) as RedisClientType;
    const subClient = pubClient.duplicate() as RedisClientType;
    const stateClient = pubClient.duplicate() as RedisClientType;

    // Set up event handlers for monitoring
    setupRedisEventHandlers(pubClient, 'Pub', strapi);
    setupRedisEventHandlers(subClient, 'Sub', strapi);
    setupRedisEventHandlers(stateClient, 'State', strapi);

    // Connect to Redis
    await Promise.all([
      pubClient.connect(),
      subClient.connect(),
      stateClient.connect()
    ]);

    strapi.log.info('[Redis] All clients connected successfully');

    // Set up the Redis adapter for Socket.IO
    io.adapter(createAdapter(pubClient, subClient));

    strapi.log.info('[SocketIO] Redis adapter configured successfully');

    // Store Redis clients on strapi for access throughout the app
    const clients: RedisClients = { pubClient, subClient, stateClient };
    (strapi as any).redisClients = clients;

    // Set up health check
    setupHealthCheck(clients, strapi);

  } catch (error) {
    strapi.log.error('[SocketIO] Failed to setup Redis adapter:', error);
    
    // In development, we can continue without Redis (single replica)
    if (process.env.NODE_ENV !== 'production') {
      strapi.log.warn('[SocketIO] Continuing without Redis adapter (development mode)');
      return;
    }
    
    throw error;
  }
}

/**
 * Sets up event handlers for Redis client monitoring
 */
function setupRedisEventHandlers(
  client: RedisClientType,
  clientName: string,
  strapi: Core.Strapi
): void {
  client.on('error', (err) => {
    strapi.log.error(`[Redis ${clientName}] Error:`, err);
  });

  client.on('connect', () => {
    strapi.log.info(`[Redis ${clientName}] Connected`);
  });

  client.on('ready', () => {
    strapi.log.info(`[Redis ${clientName}] Ready`);
  });

  client.on('reconnecting', () => {
    strapi.log.warn(`[Redis ${clientName}] Reconnecting...`);
  });

  client.on('end', () => {
    strapi.log.warn(`[Redis ${clientName}] Connection ended`);
  });
}

/**
 * Sets up periodic health check for Redis connections
 */
function setupHealthCheck(clients: RedisClients, strapi: Core.Strapi): void {
  const healthCheckInterval = setInterval(async () => {
    try {
      await clients.stateClient.ping();
      // Health check passed - no need to log every time
    } catch (error) {
      strapi.log.error('[Redis] Health check failed:', error);
    }
  }, 30000); // Check every 30 seconds

  // Store interval for cleanup
  (strapi as any).redisHealthCheckInterval = healthCheckInterval;
}

/**
 * Cleans up Redis connections gracefully
 */
export async function cleanupRedisAdapter(strapi: Core.Strapi): Promise<void> {
  try {
    // Clear health check interval
    const healthCheckInterval = (strapi as any).redisHealthCheckInterval;
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }

    // Disconnect Redis clients
    const clients = (strapi as any).redisClients as RedisClients | undefined;
    if (clients) {
      strapi.log.info('[Redis] Disconnecting clients...');
      
      await Promise.all([
        clients.pubClient.quit(),
        clients.subClient.quit(),
        clients.stateClient.quit()
      ]);
      
      strapi.log.info('[Redis] All clients disconnected successfully');
    }
  } catch (error) {
    strapi.log.error('[Redis] Error cleaning up Redis clients:', error);
  }
}

/**
 * Gets the Redis state client for shared state management
 */
export function getRedisStateClient(strapi: Core.Strapi): RedisClientType | null {
  const clients = (strapi as any).redisClients as RedisClients | undefined;
  return clients?.stateClient || null;
}

/**
 * Checks if Redis is available and healthy
 */
export async function isRedisHealthy(strapi: Core.Strapi): Promise<boolean> {
  try {
    const stateClient = getRedisStateClient(strapi);
    if (!stateClient) return false;
    
    await stateClient.ping();
    return true;
  } catch (error) {
    return false;
  }
}