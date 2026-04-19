/**
 * Test Script for Distributed Lock
 * Run this to verify distributed locking works correctly
 * 
 * Usage:
 * 1. Start your Strapi instance
 * 2. Run this script from Strapi console or create a test endpoint
 * 3. Check logs to verify only one execution happens
 */

import type { Core } from '@strapi/strapi';
import { withLock } from './distributed-lock';

/**
 * Simulates a cron job with distributed locking
 */
export async function testDistributedLock(strapi: Core.Strapi): Promise<void> {
  const hostname = process.env.HOSTNAME || 'unknown';
  
  strapi.log.info(`[LockTest] Starting test on ${hostname}`);

  // Simulate 3 replicas trying to execute the same job
  const promises = [1, 2, 3].map(async (replicaId) => {
    const result = await withLock(
      strapi,
      {
        key: 'test-cron-job',
        ttl: 10, // 10 seconds for testing
        retryAttempts: 0
      },
      async () => {
        strapi.log.info(`[LockTest] Replica ${replicaId} is executing the job`);
        
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        strapi.log.info(`[LockTest] Replica ${replicaId} completed the job`);
        
        return { replicaId, success: true };
      }
    );

    if (!result.success) {
      strapi.log.info(`[LockTest] Replica ${replicaId} skipped (lock held by another replica)`);
    }

    return result;
  });

  const results = await Promise.all(promises);

  // Verify only one succeeded
  const successCount = results.filter(r => r.success).length;
  
  if (successCount === 1) {
    strapi.log.info('[LockTest] ✅ SUCCESS: Only one replica executed the job');
  } else {
    strapi.log.error(`[LockTest] ❌ FAILED: ${successCount} replicas executed (expected 1)`);
  }
}

/**
 * Test lock acquisition and release
 */
export async function testLockAcquireRelease(strapi: Core.Strapi): Promise<void> {
  const { acquireLock, releaseLock } = await import('./distributed-lock');
  
  strapi.log.info('[LockTest] Testing lock acquire/release');

  // Test 1: Acquire lock
  const lock1 = await acquireLock(strapi, {
    key: 'test-lock',
    ttl: 30
  });

  if (!lock1.acquired) {
    strapi.log.error('[LockTest] ❌ Failed to acquire lock');
    return;
  }

  strapi.log.info('[LockTest] ✅ Lock acquired successfully');

  // Test 2: Try to acquire same lock (should fail)
  const lock2 = await acquireLock(strapi, {
    key: 'test-lock',
    ttl: 30
  });

  if (lock2.acquired) {
    strapi.log.error('[LockTest] ❌ Second lock acquisition should have failed');
    return;
  }

  strapi.log.info('[LockTest] ✅ Second lock acquisition correctly failed');

  // Test 3: Release lock
  const released = await releaseLock(strapi, 'test-lock', lock1.token!);

  if (!released) {
    strapi.log.error('[LockTest] ❌ Failed to release lock');
    return;
  }

  strapi.log.info('[LockTest] ✅ Lock released successfully');

  // Test 4: Acquire lock again (should succeed now)
  const lock3 = await acquireLock(strapi, {
    key: 'test-lock',
    ttl: 30
  });

  if (!lock3.acquired) {
    strapi.log.error('[LockTest] ❌ Failed to acquire lock after release');
    return;
  }

  strapi.log.info('[LockTest] ✅ Lock re-acquired successfully');

  // Cleanup
  await releaseLock(strapi, 'test-lock', lock3.token!);

  strapi.log.info('[LockTest] ✅ All tests passed!');
}
