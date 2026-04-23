/**
 * Strapi Cron Tasks Configuration
 * Manages scheduled jobs for telemetry snapshots, cleanup, and other periodic tasks
 * 
 * DOCKER SWARM DISTRIBUTED LOCKING:
 * =================================
 * With 3 replicas in Docker Swarm, each instance would normally execute cron jobs independently,
 * causing duplicate database records (3x for each job). To prevent this:
 * 
 * - Each job uses Redis distributed locking (see src/cron/utils/distributed-lock.ts)
 * - Only ONE replica acquires the lock and executes the job
 * - Other replicas skip execution (logged as "Job skipped - lock not acquired")
 * - Lock auto-expires after TTL to prevent deadlocks
 * 
 * TIMEZONE STRATEGY FOR INTERNATIONAL USERS (PER-SEAT TIMEZONE):
 * ==============================================================
 * Each key-seat stores its own timezone. The cron job runs hourly and checks:
 * 1. What time it is in each seat's local timezone
 * 2. Only creates snapshots for seats where it's 23:55-23:59 in their local time
 * 3. Ensures each seat gets exactly one snapshot per day at their local end-of-day
 * 
 * This approach provides:
 * - True "end of day" snapshots for each user's timezone
 * - Flexible support for users in any timezone
 * - No need to coordinate global timing
 * - Single execution per job across all replicas (via distributed locking)
 */

import type { Core } from '@strapi/strapi';
import { executeDailySnapshotJob } from "../src/cron/jobs/daily-telemetry-snapshot";
import { executeCleanupJob } from "../src/cron/jobs/cleanup-old-snapshots";

// Log when this module is loaded
console.log('[CronTasks] Cron tasks configuration module loaded');

export default {
  /**
   * Timezone-Aware Daily Telemetry Snapshot Job
   * Runs every hour and creates snapshots for seats where it's 23:55 in their local timezone
   * This ensures each user gets their snapshot at their local "end of day"
   * 
   * DISTRIBUTED LOCKING: Uses Redis lock to ensure only ONE replica executes this job
   * Lock TTL: 1 hour (job should complete within this time)
   */
  dailyTelemetrySnapshot: {
    task: ({ strapi }: { strapi: Core.Strapi }) => {
      const now = new Date().toISOString();
      const hostname = process.env.HOSTNAME || 'unknown';
      strapi.log.info(`[CronTasks] ⏰ TIMEZONE-AWARE CRON TRIGGERED at ${now} on ${hostname} - Starting timezone-aware snapshot job`);
      
      executeDailySnapshotJob(strapi)
        .then(() => {
          strapi.log.info(`[CronTasks] Timezone-aware snapshot job completed successfully on ${hostname}`);
        })
        .catch((error) => {
          strapi.log.error(`[CronTasks] Timezone-aware snapshot job failed on ${hostname}:`, error);
        });
    },
    options: {
      // TIMEZONE-AWARE APPROACH:
      // Run every hour (at :55 minutes) to check all seat timezones
      // For each seat, calculate their local time and snapshot if it's 23:55-23:59
      // 
      // For testing: "*/1 * * * *" runs every minute
      // For production: "55 * * * *" runs at minute 55 of every hour
      rule: process.env.TELEMETRY_SNAPSHOT_SCHEDULE || "55 * * * *",
      // rule: "*/1 * * * *",
      tz: "UTC", // Always use UTC for the cron schedule
    },
  },

  /**
   * Cleanup Old Snapshots Job
   * Deletes telemetry snapshots older than retention period (default: 90 days)
   * Runs weekly on Sunday at 3 AM
   * 
   * DISTRIBUTED LOCKING: Uses Redis lock to ensure only ONE replica executes this job
   * Lock TTL: 2 hours (cleanup might take longer with large datasets)
   */
  cleanupOldSnapshots: {
    task: ({ strapi }: { strapi: Core.Strapi }) => {
      const hostname = process.env.HOSTNAME || 'unknown';
      strapi.log.info(`[CronTasks] Starting cleanup old snapshots job on ${hostname}`);
      
      executeCleanupJob(strapi)
        .then(() => {
          strapi.log.info(`[CronTasks] Cleanup old snapshots job completed successfully on ${hostname}`);
        })
        .catch((error) => {
          strapi.log.error(`[CronTasks] Cleanup old snapshots job failed on ${hostname}:`, error);
        });
    },
    options: {
      // Run at 3 AM every Sunday (configurable via env var)
      rule: process.env.TELEMETRY_CLEANUP_SCHEDULE || "0 3 * * 0",
      tz: process.env.TZ || "UTC",
    },
  },

  /**
   * Example: Update Driver Status Job (currently disabled)
   * Uncomment and implement when needed
   */
  // updateDriverStatus: {
  //   task: async({ strapi }) => {
  //     strapi.log.info("Start Update User Driver Status CronJob");
  //     // await updateDriverStatusCronJob(strapi);
  //     strapi.log.info("End Update User Driver Status CronJob");
  //   },
  //   options: {
  //     // Run every 31 minutes
  //     rule: "*/31 * * * *",
  //   },
  // },
};
