
// import controllerA from "./server/controllers";
import * as services from "./server/services/index";
import fcmTokenManager from "./server/services/fcm-token-manager";
// import lifecycles from './content-types/user/lifecycles';
// import { Context, Next } from "koa";
export default async (plugin,) => {



  //   plugin.controllers.user.startPaymentSubscriptionSuccessProccess = async (ctx) => {
  //     console.log("/user/update/payment-subscription-sucess/");
  //     return await services.default.serviceA( {strapi} ).startPaymentSubscriptionSuccessProccess(ctx);
  //   };

  // plugin.routes["content-api"].routes.push({
  //   method: "POST",
  //   path: "/user/update/payment-subscription-sucess",
  //   handler: "user.startPaymentSubscriptionSuccessProccess",
  //   config: {
  //     prefix: "",
  //   },
  // });

  // // Get Real World DateTime based on time zone 
  // plugin.controllers.user.getRealWorldDateTimeByTimeZone = async (ctx) => {
  //   return await services.default.serviceA({ strapi }).getRealWorldDateTimeByTimeZone(ctx);
  // };
  // plugin.routes["content-api"].routes.push({
  //   method: "POST",
  //   path: "/user/timezone/time",
  //   handler: "user.getRealWorldDateTimeByTimeZone",
  //   config: {
  //     prefix: "",
  //   },
  // });

  // Get Real World DateTime based on time zone 
  // plugin.controllers.user.sendOTPByWhatsAppMessage = async (ctx) => {
  //   return await services.default.serviceA({ strapi }).sendOTPByWhatsAppMessage(ctx);
  // };
  // plugin.routes["content-api"].routes.push({
  //   method: "POST",
  //   path: "/user/send-otp-by-whatsapp",
  //   handler: "user.sendOTPByWhatsAppMessage",
  //   config: {
  //     prefix: "",
  //   },
  // });
  plugin.controllers.user.sendVerficationEmail = async (ctx) => {
    return await services.default.serviceA({ strapi }).sendVerficationEmail(ctx);
  };
  plugin.routes["content-api"].routes.push({
    method: "POST",
    path: "/user/send-otp",
    handler: "user.sendVerficationEmail",
    config: {
      prefix: "",
    },
  });

  // Custom User update Components until they fixinx the error while update components as v4
  plugin.controllers.user.updateUserBySpecificFieldKey = async (ctx, next) => {
    // Check if user is authenticated
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be authenticated to update user data');
    }
    
    return await services.default.serviceA({ strapi }).updateUserBySpecificFieldKey(ctx);
  };
  
  plugin.routes["content-api"].routes.push({
    method: "PUT",
    path: "/user/update/field-by-key/:documentId",
    handler: "user.updateUserBySpecificFieldKey",
    config: {
      prefix: "",
      policies: [],
      middlewares: [],
    },
  });



  plugin.controllers.user.forgotPassword = async (ctx, next) => {
    console.log("/api/user/auth/forgot-password");
    return await services.default.serviceA({ strapi }).forgotPassword(ctx);
  };

  plugin.routes["content-api"].routes.push({
    method: "POST",
    path: "/user/auth/forgot-password",
    handler: "user.forgotPassword",
    config: {
      prefix: "",
      policies: [],
      middlewares: [],
    },
  });

  // ============================================
  // FCM Token Management Routes
  // ============================================

  /**
   * Register or update FCM token for a device
   * POST /api/user/fcm-token/register
   * Body: { token, deviceId, deviceName?, platform }
   */
  plugin.controllers.user.registerFCMToken = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be authenticated');
    }

    const { token, deviceId, deviceName, platform } = ctx.request.body;

    if (!token || !deviceId || !platform) {
      return ctx.badRequest('Missing required fields: token, deviceId, platform');
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return ctx.badRequest('Invalid platform. Must be: ios, android, or web');
    }

    try {
      const result = await fcmTokenManager({ strapi }).registerFCMToken(
        ctx.state.user.documentId,
        { token, deviceId, deviceName, platform }
      );

      return ctx.send({
        data: result,
        message: 'FCM token registered successfully'
      });
    } catch (error) {
      strapi.log.error('[FCM] Error registering token:', error);
      return ctx.internalServerError('Failed to register FCM token');
    }
  };

  plugin.routes["content-api"].routes.push({
    method: "POST",
    path: "/user/fcm-token/register",
    handler: "user.registerFCMToken",
    config: {
      prefix: "",
    },
  });

  /**
   * Remove FCM token for a device (logout)
   * DELETE /api/user/fcm-token/:deviceId
   */
  plugin.controllers.user.removeFCMToken = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be authenticated');
    }

    const { deviceId } = ctx.params;

    if (!deviceId) {
      return ctx.badRequest('Device ID is required');
    }

    try {
      const result = await fcmTokenManager({ strapi }).removeFCMToken(
        ctx.state.user.documentId,
        deviceId
      );

      return ctx.send({
        data: result,
        message: 'FCM token removed successfully'
      });
    } catch (error) {
      strapi.log.error('[FCM] Error removing token:', error);
      return ctx.internalServerError('Failed to remove FCM token');
    }
  };

  plugin.routes["content-api"].routes.push({
    method: "DELETE",
    path: "/user/fcm-token/:deviceId",
    handler: "user.removeFCMToken",
    config: {
      prefix: "",
    },
  });

  /**
   * Get all active FCM tokens for current user
   * GET /api/user/fcm-tokens
   */
  plugin.controllers.user.getActiveFCMTokens = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be authenticated');
    }

    try {
      const tokens = await fcmTokenManager({ strapi }).getActiveFCMTokens(
        ctx.state.user.documentId
      );

      return ctx.send({
        data: {
          tokens,
          count: tokens.length
        }
      });
    } catch (error) {
      strapi.log.error('[FCM] Error getting tokens:', error);
      return ctx.internalServerError('Failed to get FCM tokens');
    }
  };

  plugin.routes["content-api"].routes.push({
    method: "GET",
    path: "/user/fcm-tokens",
    handler: "user.getActiveFCMTokens",
    config: {
      prefix: "",
    },
  });

 
  return plugin;
};