

interface NotificationBody<T> {
  fcmToken: string;
  title: string;
  body: string;
  data: NotificationBodyData<T>;
}
interface NotificationBodyData<T> {
  bodyData: T;
  timestamp: Date | string;
  action: NotificationAction;
  type: NotificationType
}
enum NotificationAction {
  SHOW_DRIVER = "SHOW_DRIVER",
  UPDATE_DRIVER = "UPDATE_DRIVER",
  HIDE_DRIVER = "HIDE_DRIVER",
  HIDE_ALL_DRIVERS = "HIDE_ALL_DRIVERS",
  SHOW_ALL_DRIVERS = "SHOW_ALL_DRIVERS",
  UPDATE_ALL_DRIVERS = "UPDATE_ALL_DRIVERS",
  UPDATE_CUSTOMER_LOCATION = "UPDATE_CUSTOMER_LOCATION",
  UPDATE_CUSTOMER_STATUS = "UPDATE_CUSTOMER_STATUS",
  UPDATE_DRIVER_STATUS = "UPDATE_DRIVER_STATUS",
  UPDATE_DRIVER_LOCATION = "UPDATE_DRIVER_LOCATION",
  SHOW_MESSAGE_ALERT = "SHOW_MESSAGE_ALERT",
  SHOW_NEw_OTP_ALERT = "SHOW_NEw_OTP_ALERT",
}

enum NotificationType {
  RIDE_REQUEST = "RIDE_REQUEST",
  RIDE_ACCEPTANCE = "RIDE_ACCEPTANCE",
  RIDE_REJECTION = "RIDE_REJECTION",
  RIDE_COMPLETED = "RIDE_COMPLETED",
  RIDE_CANCELATION = "RIDE_CANCELATION",
  PAYMENT = "PAYMENT",
  RIDE_RATING = "RIDE_RATING",
  NEW_MESSAGE = "NEW_MESSAGE",
  DRIVER_ARRIVED = "DRIVER_ARRIVED",
  NEW_RIDE_OTP = "NEW_RIDE_OTP",
}
const fireBaseFCMServices = ({ strapi }) => {

  return {
    /**
     * Send notification to a single device
     */
    async sendToDevice<T>(fcmBody: NotificationBody<T>) {
      const { fcmToken, title, body, data } = fcmBody;

      if (!fcmToken) {
        return { success: false, error: 'FCM token is required' };
      }
      try {
        console.log("Start sending message....");
        console.log("FCM Data being sent:", JSON.stringify(data, null, 2));
        const message = {
          token: fcmToken, // FCM requires 'token' not 'fcmToken'
          notification: {
            title,
            body,
          },
          data:
          {
            // Convert all values to strings (FCM requirement)
            ...Object.keys(data || {}).reduce((acc, key) => {
              const value = data[key];
              if (typeof value === 'object') {
                acc[key] = JSON.stringify(value);
              } else {
                acc[key] = String(value);
              }
              return acc;
            }, {})
          },
          android: {
            notification: {
              channel_id: 'high_importance_channel',
              priority: 'high',
            },
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title,
                  body,
                },
                badge: 1,
                sound: 'default',
              },
            },
          },
        };


        const response = await strapi.firebase.messaging().send(message);
        strapi.log.info('📱 Notification sent successfully:', response);
        return { success: true, messageId: response };
      } catch (error) {
        strapi.log.error('❌ Error sending notification:', error);

      }
    },

    /**
     * Send notification to multiple devices
     */
    async sendToMultipleDevices(tokens, title, body, data = {}) {
      try {
        const message = {
          tokens,
          notification: {
            title,
            body,
          },
          data: {
            ...Object.keys(data).reduce((acc, key) => {
              acc[key] = String(data[key]);
              return acc;
            }, {})
          },
          android: {
            notification: {
              channel_id: 'high_importance_channel',
              priority: 'high',
            },
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title,
                  body,
                },
                badge: 1,
                sound: 'default',
              },
            },
          },
        };

        const response = await strapi.firebase.messaging().sendEachForMulticast(message);
        strapi.log.info('📱 Batch notification sent:', {
          successCount: response.successCount,
          failureCount: response.failureCount,
        });

        return {
          success: true,
          successCount: response.successCount,
          failureCount: response.failureCount,
          responses: response.responses,
        };
      } catch (error) {
        strapi.log.error('❌ Error sending batch notification:', error);
        throw error;
      }
    },

    /**
     * Send notification to a topic
     */
    async sendToTopic(topic, title, body, data = {}) {
      try {
        const message = {
          topic,
          notification: {
            title,
            body,
          },
          data: {
            ...Object.keys(data).reduce((acc, key) => {
              acc[key] = String(data[key]);
              return acc;
            }, {})
          },
        };

        const response = await strapi.firebase.messaging().send(message);
        strapi.log.info('📢 Topic notification sent successfully:', response);
        return { success: true, messageId: response };
      } catch (error) {
        strapi.log.error('❌ Error sending topic notification:', error);
        throw error;
      }
    },

    /**
     * Subscribe users to topic
     */
    async subscribeToTopic(tokens, topic) {
      try {
        const response = await strapi.firebase.messaging().subscribeToTopic(tokens, topic);
        strapi.log.info('✅ Subscribed to topic:', { topic, successCount: response.successCount });
        return response;
      } catch (error) {
        strapi.log.error('❌ Error subscribing to topic:', error);
        throw error;
      }
    },

    /**
     * Unsubscribe users from topic
     */
    async unsubscribeFromTopic(tokens, topic) {
      try {
        const response = await strapi.firebase.messaging().unsubscribeFromTopic(tokens, topic);
        strapi.log.info('❌ Unsubscribed from topic:', { topic, successCount: response.successCount });
        return response;
      } catch (error) {
        strapi.log.error('❌ Error unsubscribing from topic:', error);
        throw error;
      }
    },

    /**
     * Validate FCM token
     */
    async validateToken(token) {
      try {
        const message = {
          token,
          data: { test: 'true' },
          dryRun: true, // Don't actually send
        };

        await strapi.firebase.messaging().send(message);
        return { valid: true };
      } catch (error) {
        if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
          return { valid: false, error: error.code };
        }
        throw error;
      }
    },
  }

}
export default fireBaseFCMServices;