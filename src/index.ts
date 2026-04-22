// import type { Core } from '@strapi/strapi';

import { Core } from "@strapi/strapi";
import { initializeSocketIO } from "./socketio";
import fireBaseConfig from "./fcm/fcm_config";

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register( { strapi }: { strapi: Core.Strapi } ) {
      initializeSocketIO(strapi);
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap( { strapi }: { strapi: Core.Strapi } ) {
      fireBaseConfig({ strapi }).initFirebaseAdmin();
      
      // Note: Cron jobs are now managed by Strapi's native cron system
      // See config/cron-tasks.ts for cron job configuration
      const cronSchedule = process.env.TELEMETRY_SNAPSHOT_SCHEDULE || "*/1 * * * *";
      const hostname = process.env.HOSTNAME || 'unknown';
      strapi.log.info(`[Bootstrap] Strapi cron jobs initialized on ${hostname}`);
      strapi.log.info(`[Bootstrap] Daily snapshot schedule: ${cronSchedule} (UTC)`);
      strapi.log.info(`[Bootstrap] Cleanup schedule: ${process.env.TELEMETRY_CLEANUP_SCHEDULE || "0 3 * * 0"} (${process.env.TZ || "UTC"})`);
      
      // List all registered cron jobs after a short delay to ensure they're loaded
      setTimeout(() => {
        const cronJobs = strapi.cron?.jobs || {};
        const jobNames = Object.keys(cronJobs);
        strapi.log.info(`[Bootstrap] Registered cron jobs (${jobNames.length}):`, jobNames);
      }, 2000);
  },
};
