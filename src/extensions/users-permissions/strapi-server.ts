

// import controllerA from "./server/controllers";
import * as services from "./server/services/index";
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

 
  return plugin;
};