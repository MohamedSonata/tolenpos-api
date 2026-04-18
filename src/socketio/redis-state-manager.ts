/**
 * Redis State Manager
 * Manages shared state across replicas using Redis
 * 
 * Use cases:
 * - Pending telemetry requests (with timeouts)
 * - Socket metadata
 * - Distributed locks
 */

import type { Core } from '@strapi/strapi';
import { getRedisStateClient } from './redis-adapter';

const PENDING_REQUEST_PREFIX = 'pending_request:';
const PENDING_REQUEST_TTL = 30; // 30 seconds TTL

export interface PendingRequest {
  requestId: string;
  mobileSocketId: string;
  keySeatDocumentId: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Redis State Manager for cross-replica shared state
 */
export class RedisStateManager {
  private static instance: RedisStateManager;
  private strapi: Core.Strapi;
  private fallbackMap: Map<string, PendingRequest>; // Fallback for when Redis is down

  private constructor(strapi: Core.Strapi) {
    this.strapi = strapi;
    this.fallbackMap = new Map();
  }

  public static getInstance(strapi: Core.Strapi): RedisStateManager {
    if (!RedisStateManager.instance) {
      RedisStateManager.instance = new RedisStateManager(strapi);
    }
    return RedisStateManager.instance;
  }

  /**
   * Store a pending request (works across replicas)
   */
  public async storePendingRequest(request: PendingRequest): Promise<boolean> {
    try {
      const redis = getRedisStateClient(this.strapi);
      
      if (redis) {
        const key = `${PENDING_REQUEST_PREFIX}${request.requestId}`;
        await redis.setEx(
          key,
          PENDING_REQUEST_TTL,
          JSON.stringify(request)
        );
        return true;
      } else {
        // Fallback to in-memory (single replica mode)
        this.fallbackMap.set(request.requestId, request);
        
        // Auto-cleanup after TTL
        setTimeout(() => {
          this.fallbackMap.delete(request.requestId);
        }, PENDING_REQUEST_TTL * 1000);
        
        return true;
      }
    } catch (error) {
      this.strapi.log.error('[RedisState] Error storing pending request:', error);
      
      // Fallback to in-memory
      this.fallbackMap.set(request.requestId, request);
      return false;
    }
  }

  /**
   * Get a pending request (works across replicas)
   */
  public async getPendingRequest(requestId: string): Promise<PendingRequest | null> {
    try {
      const redis = getRedisStateClient(this.strapi);
      
      if (redis) {
        const key = `${PENDING_REQUEST_PREFIX}${requestId}`;
        const data = await redis.get(key);
        
        if (data) {
          return JSON.parse(data) as PendingRequest;
        }
        return null;
      } else {
        // Fallback to in-memory
        return this.fallbackMap.get(requestId) || null;
      }
    } catch (error) {
      this.strapi.log.error('[RedisState] Error getting pending request:', error);
      
      // Fallback to in-memory
      return this.fallbackMap.get(requestId) || null;
    }
  }

  /**
   * Delete a pending request (works across replicas)
   */
  public async deletePendingRequest(requestId: string): Promise<boolean> {
    try {
      const redis = getRedisStateClient(this.strapi);
      
      if (redis) {
        const key = `${PENDING_REQUEST_PREFIX}${requestId}`;
        await redis.del(key);
        return true;
      } else {
        // Fallback to in-memory
        this.fallbackMap.delete(requestId);
        return true;
      }
    } catch (error) {
      this.strapi.log.error('[RedisState] Error deleting pending request:', error);
      
      // Fallback to in-memory
      this.fallbackMap.delete(requestId);
      return false;
    }
  }

  /**
   * Get all pending requests for a mobile socket (for cleanup on disconnect)
   */
  public async getPendingRequestsByMobileSocket(mobileSocketId: string): Promise<PendingRequest[]> {
    try {
      const redis = getRedisStateClient(this.strapi);
      
      if (redis) {
        const pattern = `${PENDING_REQUEST_PREFIX}*`;
        const keys = await redis.keys(pattern);
        
        const requests: PendingRequest[] = [];
        for (const key of keys) {
          const data = await redis.get(key);
          if (data) {
            const request = JSON.parse(data) as PendingRequest;
            if (request.mobileSocketId === mobileSocketId) {
              requests.push(request);
            }
          }
        }
        
        return requests;
      } else {
        // Fallback to in-memory
        return Array.from(this.fallbackMap.values())
          .filter(req => req.mobileSocketId === mobileSocketId);
      }
    } catch (error) {
      this.strapi.log.error('[RedisState] Error getting pending requests by socket:', error);
      
      // Fallback to in-memory
      return Array.from(this.fallbackMap.values())
        .filter(req => req.mobileSocketId === mobileSocketId);
    }
  }

  /**
   * Clean up all pending requests for a socket (on disconnect)
   */
  public async cleanupPendingRequestsForSocket(mobileSocketId: string): Promise<number> {
    try {
      const requests = await this.getPendingRequestsByMobileSocket(mobileSocketId);
      
      for (const request of requests) {
        await this.deletePendingRequest(request.requestId);
      }
      
      this.strapi.log.info(`[RedisState] Cleaned up ${requests.length} pending requests for socket ${mobileSocketId}`);
      return requests.length;
    } catch (error) {
      this.strapi.log.error('[RedisState] Error cleaning up pending requests:', error);
      return 0;
    }
  }

  /**
   * Check if Redis is available
   */
  public isRedisAvailable(): boolean {
    return getRedisStateClient(this.strapi) !== null;
  }
}

// Export singleton instance
export let redisStateManager: RedisStateManager;

export function initializeRedisStateManager(strapi: Core.Strapi): RedisStateManager {
  redisStateManager = RedisStateManager.getInstance(strapi);
  return redisStateManager;
}