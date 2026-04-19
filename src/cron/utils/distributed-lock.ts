/**
 * Distributed Lock Utility for Docker Swarm
 * Ensures only one replica executes cron jobs at a time using Redis
 * 
 * PROBLEM: With 3 replicas in Docker Swarm, each instance runs cron jobs independently
 * SOLUTION: Use Redis locks to coordinate job execution across replicas
 */

import type { Core } from '@strapi/strapi';
import { getRedisStateClient } from '../../socketio/redis-adapter';

export interface LockOptions {
  /** Lock key name */
  key: string;
  /** Lock TTL in seconds (default: 300 = 5 minutes) */
  ttl?: number;
  /** Retry attempts if lock is held (default: 0 = no retry) */
  retryAttempts?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
}

export interface LockResult {
  /** Whether lock was acquired */
  acquired: boolean;
  /** Lock token for releasing (only if acquired) */
  token?: string;
  /** Reason if lock was not acquired */
  reason?: string;
}

/**
 * Acquires a distributed lock using Redis
 * Uses SET NX EX pattern for atomic lock acquisition
 */
export async function acquireLock(
  strapi: Core.Strapi,
  options: LockOptions
): Promise<LockResult> {
  const {
    key,
    ttl = 300, // 5 minutes default
    retryAttempts = 0,
    retryDelay = 1000
  } = options;

  // Get Redis client
  const redis = getRedisStateClient(strapi);
  if (!redis) {
    strapi.log.warn('[DistributedLock] Redis not available, allowing execution without lock');
    return {
      acquired: true,
      token: 'no-redis-fallback',
      reason: 'Redis not available - running without distributed lock'
    };
  }

  // Generate unique token for this lock instance
  const token = `${process.env.HOSTNAME || 'unknown'}-${Date.now()}-${Math.random()}`;
  const lockKey = `cron:lock:${key}`;

  let attempts = 0;
  
  while (attempts <= retryAttempts) {
    try {
      // Try to acquire lock using SET NX EX (atomic operation)
      const result = await redis.set(lockKey, token, {
        NX: true, // Only set if not exists
        EX: ttl   // Expire after ttl seconds
      });

      if (result === 'OK') {
        strapi.log.info(`[DistributedLock] Lock acquired: ${key}`, {
          token,
          ttl,
          hostname: process.env.HOSTNAME
        });
        
        return {
          acquired: true,
          token
        };
      }

      // Lock is held by another instance
      if (attempts < retryAttempts) {
        strapi.log.debug(`[DistributedLock] Lock held, retrying: ${key}`, {
          attempt: attempts + 1,
          maxAttempts: retryAttempts + 1
        });
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        attempts++;
        continue;
      }

      // Max retries reached
      const holder = await redis.get(lockKey);
      return {
        acquired: false,
        reason: `Lock held by another instance: ${holder}`
      };

    } catch (error) {
      strapi.log.error(`[DistributedLock] Error acquiring lock: ${key}`, {
        error: error.message,
        attempt: attempts + 1
      });

      if (attempts < retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        attempts++;
        continue;
      }

      return {
        acquired: false,
        reason: `Error: ${error.message}`
      };
    }
  }

  return {
    acquired: false,
    reason: 'Max retry attempts reached'
  };
}

/**
 * Releases a distributed lock
 * Uses Lua script to ensure only the lock holder can release it
 */
export async function releaseLock(
  strapi: Core.Strapi,
  key: string,
  token: string
): Promise<boolean> {
  // Skip if using fallback mode
  if (token === 'no-redis-fallback') {
    return true;
  }

  const redis = getRedisStateClient(strapi);
  if (!redis) {
    strapi.log.warn('[DistributedLock] Redis not available for lock release');
    return false;
  }

  const lockKey = `cron:lock:${key}`;

  try {
    // Lua script to atomically check token and delete
    // Only delete if the token matches (prevents releasing someone else's lock)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await redis.eval(script, {
      keys: [lockKey],
      arguments: [token]
    }) as number;

    if (result === 1) {
      strapi.log.info(`[DistributedLock] Lock released: ${key}`, {
        token,
        hostname: process.env.HOSTNAME
      });
      return true;
    } else {
      strapi.log.warn(`[DistributedLock] Lock not released (token mismatch or expired): ${key}`, {
        token
      });
      return false;
    }

  } catch (error) {
    strapi.log.error(`[DistributedLock] Error releasing lock: ${key}`, {
      error: error.message,
      token
    });
    return false;
  }
}

/**
 * Executes a function with distributed lock protection
 * Automatically acquires lock, executes function, and releases lock
 */
export async function withLock<T>(
  strapi: Core.Strapi,
  options: LockOptions,
  fn: () => Promise<T>
): Promise<{ success: boolean; result?: T; error?: string }> {
  const lockResult = await acquireLock(strapi, options);

  if (!lockResult.acquired) {
    strapi.log.info(`[DistributedLock] Skipping job (lock not acquired): ${options.key}`, {
      reason: lockResult.reason
    });
    
    return {
      success: false,
      error: lockResult.reason
    };
  }

  try {
    const result = await fn();
    
    return {
      success: true,
      result
    };

  } catch (error) {
    strapi.log.error(`[DistributedLock] Error executing locked function: ${options.key}`, {
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message
    };

  } finally {
    // Always release lock, even if function throws
    if (lockResult.token) {
      await releaseLock(strapi, options.key, lockResult.token);
    }
  }
}
