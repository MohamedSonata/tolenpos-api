import { Core } from "@strapi/strapi";
import utils from "../utils";
import strapiUtils from '@strapi/utils';
  import { Context } from 'koa';
import WaSenderController from "../../../../wasender/controller";
  
  const serviceA = ({ strapi }: { strapi: Core.Strapi }) => {


  return {
  async updateUserBySpecificFieldKey(ctx) {

      var userAfterEdited;
      // Function to check if all required fields are present in the request body
    //   const hasAllRequiredFields = (body) => {
    //     return body.lastDeviceUsed != null && body.subscription != null && body.billingAddress != null;
    //   };

      try {
        if (ctx.request.body) {
          userAfterEdited = await strapi.documents('plugin::users-permissions.user').update({
            documentId: ctx.params.documentId,
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
          const sanitizedUser = await utils.userUtils({ strapi }).sanitizeUser(userAfterEdited, ctx);

          return ctx.send(sanitizedUser);
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

        // const sanitizedUser = await utils.userUtils({ strapi }).sanitizeUser(userAfterEdited, ctx);

        // return ctx.send(sanitizedUser);
      }
      catch (e) {
        strapi.log.info(" Not able to update and thing by you key defined (user-Services.ts)L237");

      }
    },
    async sendVerficationEmail(ctx: Context, verficationData?
      : VerficationData
    ) {
      const { identifier, userName } = ctx.request.body;
      let userVerficationData: { verficationCode: String; indentifier?: String; startAt?: Date; endAt?: string; };
      // Sending Phone Message with Code if the phone number is related to user  in the database
      if (identifier) {
        userVerficationData = verficationData ?? await utils.userUtils({ strapi }).verificationCode(identifier);
        const confirmationToken = userVerficationData.verficationCode;

        const emailToSend = {
          to: identifier,
          from: "noreply@xefro.net",
          replyTo: "",
          subject: "Confirmation OTP",
          text: `<p>We noticed you need an confirmation Token!</p>`,
          html: utils.userUtils({ strapi }).customConfirmationEmailTemplate(confirmationToken, userName ?? identifier),
        };
        await strapi.plugins['email'].services.email.send(emailToSend);
        return ctx.send({
          verficationData: userVerficationData,
        });
      }

      throw new strapiUtils.errors.ValidationError(`identifer not found in the request body Check your body request again, [${Object.keys(ctx.request.body)} ]`);

    },
    //     async sendOTPByWhatsAppMessage(ctx) {
    //   let { ip, recipient, message } = ctx.request.body;

    //   if (!ip && !recipient && !message) {
    //     return new strapiUtils.errors.ValidationError(`recipient OR message not found in the request body Check your body request again, [${Object.keys(ctx.request.body)} ]`);;
    //   }
    //   const driverDetails = await strapi.documents('api::driver.driver').findOne({
    //     documentId: ctx.request.body.driverDocumentId,
    //     populate: {
    //       driverDetails: {
    //         populate:{
    //           phoneNumVerfication:true
    //         }
    //       }
    //     }
    //   });
    //   if (!driverDetails) {
    //     return ctx.send({
    //       error: "Can't find the driver entitiy",
    //       message: `Driver documentId not found at our records ${ctx.request.body.driverDocumentId}`
    //     });
    //   }

    //   let userVerficationData = await utils.userUtils({ strapi }).verificationCode(recipient);

    //   // Generate generic OTP message schema for WhatsApp
    //   const otpMessage = utils.userUtils({ strapi }).customWhatsAppOTPMessage(
    //     userVerficationData.verficationCode,
    //     'verification',
    //     driverDetails.driverDetails.name
    //   );

    //   ctx.request.body = {
    //     ...ctx.request.body,
    //     message: otpMessage
    //   }
    //   const res = await WaSenderController.sendText(ctx);
    //   if (!res.success) {
    //     return ctx.send(res);
    //   }


    //   const updatedDriverPhoneNumVerfication = await strapi.
    //     documents('api::driver-detail.driver-detail').update({
    //       documentId: driverDetails.documentId,
    //       status: 'published',
    //       data: {
    //         phoneNumVerfication: {
    //           verficationCode: userVerficationData.verficationCode,
    //           verficationCodeExpireAt: userVerficationData.endAt,
    //           isVerified: false
    //         }
    //       },
    //       populate: {
    //           phoneNumVerfication:true
    //     }
    //   });
    //   const phoneVerficationResult = {
    //     phoneNumber: recipient,
    //     isPhoneNumVerfied: updatedDriverPhoneNumVerfication.phoneNumVerfication.isVerified,
    //     phoneNumVerficationExpireAt: userVerficationData.endAt,
    //     phoneVerficationCode: userVerficationData.verficationCode
    //   }

    //   return ctx.send
    //     ({
    //       ...res,
    //       ...phoneVerficationResult
    //     });
    // },


       async forgotPassword(ctx) {

      const { email } = await utils.userUtils({ strapi }).validateForgotPasswordBody(ctx.request.body);

      try {



        // Find the user by email.
        const user = await strapi.db
          .query('plugin::users-permissions.user')
          .findOne({ where: { email: ctx.request.body.email.toLowerCase() } });

        if (!user || user.blocked) {
          throw new strapiUtils.errors.ValidationError('User not found, or maybe user blocked, check your email again');
        }

        const sanitizedUser = await utils.userUtils({ strapi }).sanitizeUser(user, ctx);
        if (user.resetPasswordToken) {
          const newVerifyTimer = getNewVerifyCodeTimer();
          return ctx.send({
            data: {
              user: sanitizedUser,
              forgotPassword: {
                indentifier: user.email,
                verficationCode: user.resetPasswordToken,
                startAt: newVerifyTimer.startAt,
                endAt: newVerifyTimer.endAt,
              },
            },
          });
        }




        let userVerficationData: { verficationCode: String; indentifier?: String; startAt?: Date; endAt?: string; };
        // Sending Phone Message with Code if the phone number is related to user  in the database
        if (user) {
          userVerficationData = await utils.userUtils({ strapi }).verificationCode(email);
          const resetPasswordToken = userVerficationData.verficationCode;
          //  NOTE: Update the user before sending the email so an Admin can generate the link if the email fails
          await strapi.plugin('users-permissions').service("user").edit(user.id, { resetPasswordToken });
        }
        const resetPasswordToken = userVerficationData.verficationCode;

        const emailToSend = {

          to: user.email,
          from: "noreply@xefro.net",
          replyTo: "",
          subject: "Resset Password",
          text: `<p>We heard that you lost your password. Sorry about that!</p>`,
          html: utils.userUtils({ strapi }).customEmailTemplate(resetPasswordToken, user.username),
        };
        const delay = 15 * 60 * 1000; // 15 minutes in milliseconds
        setTimeout(async () => {
          this.updateUsersResetPassTokenNotNull(user);
        }, delay,);

        // console.log(emailToSend);
        // console.log("Email SentFunction");
        // this.sendSimpleMessage();
        const emaiSent = await strapi.plugins['email'].services.email.send(emailToSend);



        return ctx.send({
          data: {
            user: sanitizedUser,
            forgotPassword: userVerficationData,
          },
        });
      } catch (err) {
        console.log(err);
      }
    },
     async updateUsersResetPassTokenNotNull(user: User) {


      const currentDatetime = new Date();
      if (isCurrentDateAfter(currentDatetime, new Date(`${user.updatedAt}`), 1)) {
        try {
          await strapi.documents('plugin::users-permissions.user').update({
            documentId: user.documentId,
            data: { resetPasswordToken: null },
          });

        } catch (error) {
          strapi.log.info("This Error happen in (cron jobs/ user / services.ts L=146 ", error)
        }
      }
    },
}
function getNewVerifyCodeTimer() {

  const currentTimestamp = new Date();
  const endTimer = new Date();
  endTimer.setMinutes(currentTimestamp.getMinutes() + 15);

  return {
    startAt: currentTimestamp,
    endAt: endTimer.toISOString(),
  }

}
type VerficationData = {
  indentifier: String,
  verficationCode: String,
  startAt: Date,
  endAt: string,
}
async function isCurrentDateAfter(currentDatetime: Date, updatedAt: Date, duration: number): Promise<boolean> {

  // Add 15 minutes to currentDatetime
  const currentDatetimePlus15Minutes = new Date(currentDatetime.getTime() + duration * 60 * 1000);

  // Compare currentDatetimePlus15Minutes with updatedAt
  if (currentDatetimePlus15Minutes > updatedAt) {
    return true;
  } else {
    return false;
  }
}
}

export default serviceA;