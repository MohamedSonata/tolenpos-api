
import { NotificationBody } from "../../socketio/interfaces";
import fireBaseFCMServices from "../services/fcm";
const fireBaseFCMController=({ strapi }) => {
    /**
     
     * Send notification to single user
     */
    return {
    async sendToUser<T>(notiBody:NotificationBody<T>,strapi) {
      try {
        
  
       
  
        if (!notiBody.fcmToken) {
          return 'User FCM token not found';
        }
  
        const result = await fireBaseFCMServices({strapi}).sendToDevice(notiBody)
        // const result = await strapi.service('api::notification.fcm').sendToDevice(
        //   user.fcmToken,
        //   title,
        //   body,
        //   data
        // );
  
        // // Save notification to database (optional)
        // await strapi.entityService.create('api::notification.notification', {
        //   data: {
        //     title,
        //     body,
        //     data: JSON.stringify(data || {}),
        //     recipient: userId,
        //     status: 'sent',
        //     sentAt: new Date(),
        //   },
        // });
  
        return {success:true}
      } catch (error) {
        strapi.log.error('Controller error:', error);
return {success:false}      }
    }
  
    // /**
    //  * Send notification to multiple users
    //  */
    // async sendToUsers(ctx) {
    //   try {
    //     const { userIds, title, body, data } = ctx.request.body;
  
    //     // Get users' FCM tokens
    //     const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
    //       filters: { id: { $in: userIds } },
    //       fields: ['id', 'fcmToken'],
    //     });
  
    //     const validTokens = users
    //       .filter(user => user.fcmToken)
    //       .map(user => user.fcmToken);
  
    //     if (validTokens.length === 0) {
    //       return ctx.badRequest('No valid FCM tokens found');
    //     }
  
    //     const result = await strapi.service('api::notification.fcm').sendToMultipleDevices(
    //       validTokens,
    //       title,
    //       body,
    //       data
    //     );
  
    //     // Save notifications to database (optional)
    //     const notifications = users.map(user => ({
    //       title,
    //       body,
    //       data: JSON.stringify(data || {}),
    //       recipient: user.id,
    //       status: 'sent',
    //       sentAt: new Date(),
    //     }));
  
    //     await strapi.entityService.createMany('api::notification.notification', {
    //       data: notifications,
    //     });
  
    //     ctx.send(result);
    //   } catch (error) {
    //     strapi.log.error('Controller error:', error);
    //     ctx.badRequest('Failed to send notifications');
    //   }
    // },
  
    // /**
    //  * Send notification to topic
    //  */
    // async sendToTopic(ctx) {
    //   try {
    //     const { topic, title, body, data } = ctx.request.body;
  
    //     const result = await strapi.service('api::notification.fcm').sendToTopic(
    //       topic,
    //       title,
    //       body,
    //       data
    //     );
  
    //     ctx.send(result);
    //   } catch (error) {
    //     strapi.log.error('Controller error:', error);
    //     ctx.badRequest('Failed to send topic notification');
    //   }
    // },
  
    // /**
    //  * Subscribe user to topic
    //  */
    // async subscribeToTopic(ctx) {
    //   try {
    //     const { userId, topic } = ctx.request.body;
  
    //     const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
    //       fields: ['fcmToken'],
    //     });
  
    //     if (!user?.fcmToken) {
    //       return ctx.badRequest('User FCM token not found');
    //     }
  
    //     const result = await strapi.service('api::notification.fcm').subscribeToTopic(
    //       [user.fcmToken],
    //       topic
    //     );
  
    //     ctx.send(result);
    //   } catch (error) {
    //     strapi.log.error('Controller error:', error);
    //     ctx.badRequest('Failed to subscribe to topic');
    //   }
}
  };

  export default fireBaseFCMController;