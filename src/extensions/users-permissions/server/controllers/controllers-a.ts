import { Core } from "@strapi/strapi";
import utils from "../utils";

const serviceA = ({ strapi }: { strapi: Core.Strapi }) => {


  return {
        async updateUserBySpecificFieldKey(ctx) {

      var userAfterEdited;
      // Function to check if all required fields are present in the request body
      const hasAllRequiredFields = (body) => {
        return body.lastDeviceUsed != null && body.subscription != null && body.billingAddress != null;
      };

      try {
        if (ctx.request.body) {
          userAfterEdited = await strapi.documents('plugin::users-permissions.user').update({
            documentId: ctx.params.id,
            data: ctx.request.body,
            ...ctx.request.query
          });
        }

        // if (hasAllRequiredFields(ctx.request.body)) {
        //   userAfterEdited = await strapi.documents('plugin::users-permissions.user').update({
        //     documentId: ctx.params.id,

        //     data: {

        //       lastDeviceUsed: ctx.request.body.lastDeviceUsed,
        //       subscription: ctx.request.body.subscription,
        //       billingAddress: ctx.request.body.billingAddress,
        //     },
        //     ...ctx.request.query
        //   });
        //   const sanitizedUser = await utils.default.userUtils({ strapi }).sanitizeUser(userAfterEdited, ctx);

        //   return ctx.send(sanitizedUser);
        // }

        // if (ctx.request.body.lastDeviceUsed != null) {
        //   userAfterEdited = await strapi.documents('plugin::users-permissions.user').update({
        //     documentId: ctx.params.id,
        //     data: {

        //       lastDeviceUsed: ctx.request.body.lastDeviceUsed,

        //     },
        //     ...ctx.request.query
        //   });
        // } else if (ctx.request.body.subscription != null) {
        //   userAfterEdited = await strapi.documents('plugin::users-permissions.user').update({
        //     documentId: ctx.params.id,
        //     data: {
        //       subscription: ctx.request.body.subscription,

        //     },
        //     ...ctx.request.query
        //   });
        // } else if (ctx.request.body.billingAddress != null) {
        //   userAfterEdited = await strapi.documents('plugin::users-permissions.user').update({
        //     documentId: ctx.params.id,
        //     data: {
        //       billingAddress: ctx.request.body.billingAddress,
        //     },
        //     ...ctx.request.query
        //   });
        // } else {
        //   userAfterEdited = await strapi.documents('plugin::users-permissions.user').update({
        //     documentId: ctx.params.id,
        //     data: ctx.request.body,
        //     ...ctx.request.query
        //   });

        // }

        const sanitizedUser = await utils.userUtils({ strapi }).sanitizeUser(userAfterEdited, ctx);

        return ctx.send(sanitizedUser);
      }
      catch (e) {
        strapi.log.info(" Not able to update and thing by you key defined (user-Services.ts)L237");

      }
    }
  }}

  export default serviceA;
