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
      strapi.log.info("[Bootstrap] Strapi cron jobs will be initialized automatically");
  },
};
