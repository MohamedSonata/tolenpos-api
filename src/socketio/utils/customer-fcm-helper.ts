/**
 * Customer FCM Helper
 * Sends push notifications to customer devices
 */

import type { Core } from '@strapi/strapi';
import * as admin from 'firebase-admin';

interface CustomerNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

/**
 * Sends push notification to a specific customer device token
 * @param strapi - Strapi instance
 * @param fcmToken - Customer device FCM token
 * @param payload - Notification payload
 * @returns Success status
 */
export async function sendPushNotificationToCustomerDevice(
  strapi: Core.Strapi,
  fcmToken: string,
  payload: CustomerNotificationPayload
): Promise<boolean> {
  try {
    // Prepare FCM message
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl })
      },
      data: payload.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'orders',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            alert: {
              title: payload.title,
              body: payload.body
            }
          }
        }
      }
    };

    // Send notification
    const response = await admin.messaging().send(message);

    strapi.log.info(`[CustomerFCM] Notification sent successfully`, {
      messageId: response,
      title: payload.title
    });

    return true;
  } catch (error) {
    strapi.log.error(`[CustomerFCM] Error sending notification`, {
      error: error.message,
      code: error.code,
      title: payload.title
    });

    // Handle invalid token errors
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      strapi.log.warn(`[CustomerFCM] Invalid FCM token detected: ${fcmToken.substring(0, 20)}...`);
    }

    return false;
  }
}

/**
 * Sends push notification to multiple customer devices
 * @param strapi - Strapi instance
 * @param fcmTokens - Array of customer device FCM tokens
 * @param payload - Notification payload
 * @returns Summary of sent notifications
 */
export async function sendPushNotificationToCustomerDevices(
  strapi: Core.Strapi,
  fcmTokens: string[],
  payload: CustomerNotificationPayload
): Promise<{
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}> {
  try {
    if (fcmTokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    // Prepare FCM multicast message
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl })
      },
      data: payload.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'orders',
          priority: 'high'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    // Send to all devices
    const response = await admin.messaging().sendEachForMulticast(message);

    // Collect invalid tokens
    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        if (
          error?.code === 'messaging/invalid-registration-token' ||
          error?.code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(fcmTokens[idx]);
        }
      }
    });

    strapi.log.info(`[CustomerFCM] Multicast notification sent`, {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokensCount: invalidTokens.length
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens
    };
  } catch (error) {
    strapi.log.error(`[CustomerFCM] Error sending multicast notification`, {
      error: error.message,
      tokensCount: fcmTokens.length
    });

    return {
      successCount: 0,
      failureCount: fcmTokens.length,
      invalidTokens: []
    };
  }
}
