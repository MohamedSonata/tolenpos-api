/**
 * Strapi Cron Tasks Configuration
 * Manages scheduled jobs for telemetry snapshots, cleanup, and other periodic tasks
 */

import { executeDailySnapshotJob } from "../src/cron/jobs/daily-telemetry-snapshot";
import { executeCleanupJob } from "../src/cron/jobs/cleanup-old-snapshots";

export default {
  /**
   * Daily Telemetry Snapshot Job
   * Creates one snapshot per active seat per day at 2 AM
   * Reduces storage costs by 99% compared to snapshot-on-every-update
   */
  dailyTelemetrySnapshot: {
    task: async ({ strapi }) => {
      strapi.log.info("[CronTasks] Starting daily telemetry snapshot job");
      await executeDailySnapshotJob(strapi);
      strapi.log.info("[CronTasks] Daily telemetry snapshot job completed");
    },
    options: {
      // Run at 2 AM every day (configurable via env var)
      rule: process.env.TELEMETRY_SNAPSHOT_SCHEDULE || "0 2 * * *",
      tz: process.env.TZ || "UTC",
    },
  },

  /**
   * Cleanup Old Snapshots Job
   * Deletes telemetry snapshots older than retention period (default: 90 days)
   * Runs weekly on Sunday at 3 AM
   */
  cleanupOldSnapshots: {
    task: async ({ strapi }) => {
      strapi.log.info("[CronTasks] Starting cleanup old snapshots job");
      await executeCleanupJob(strapi);
      strapi.log.info("[CronTasks] Cleanup old snapshots job completed");
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