/**
 * Push Notification Helper
 * Sends Firebase push notifications to all user devices
 */

import type { Core } from '@strapi/strapi';
import type { FCMTokenComponent } from '../socketio/interfaces';
import * as admin from 'firebase-admin';

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

/**
 * Sends push notification to all active devices of a user
 * @param strapi - Strapi instance
 * @param userDocumentId - User's document ID
 * @param payload - Notification payload
 * @returns Summary of sent notifications
 */
export async function sendPushNotificationToUser(
  strapi: Core.Strapi,
  userDocumentId: string,
  payload: PushNotificationPayload
): Promise<{
  success: boolean;
  sentCount: number;
  failedCount: number;
  errors: any[];
}> {
  try {
    // Get all active FCM tokens for the user
    const user = await strapi.documents('plugin::users-permissions.user').findOne({
      documentId: userDocumentId,
      populate: ['fcmTokens']
    });

    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      strapi.log.warn(`[PushNotification] No FCM tokens found for user ${userDocumentId}`);
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        errors: ['No FCM tokens registered']
      };
    }

    const tokens = user.fcmTokens as FCMTokenComponent[];

    // Filter active tokens
    const activeTokens = tokens
      .filter((t) => t.isActive !== false)
      .map((t) => t.token);

    if (activeTokens.length === 0) {
      strapi.log.warn(`[PushNotification] No active FCM tokens for user ${userDocumentId}`);
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        errors: ['No active FCM tokens']
      };
    }

    // Prepare FCM message
    const message: admin.messaging.MulticastMessage = {
      tokens: activeTokens,
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
          channelId: 'default'
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

    strapi.log.info(`[PushNotification] Sent to ${response.successCount}/${activeTokens.length} devices for user ${userDocumentId}`);

    // Handle failed tokens (remove invalid ones)
    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        strapi.log.error(`[PushNotification] Failed to send to token ${idx}:`, error?.message);
        
        // If token is invalid or unregistered, mark for removal
        if (
          error?.code === 'messaging/invalid-registration-token' ||
          error?.code === 'messaging/registration-token-not-registered'
        ) {
          failedTokens.push(activeTokens[idx]);
        }
      }
    });

    // Remove invalid tokens
    if (failedTokens.length > 0) {
      await removeInvalidTokens(strapi, userDocumentId, failedTokens);
    }

    return {
      success: response.successCount > 0,
      sentCount: response.successCount,
      failedCount: response.failureCount,
      errors: response.responses
        .filter(r => !r.success)
        .map(r => r.error?.message)
    };
  } catch (error) {
    strapi.log.error('[PushNotification] Error sending push notification:', error);
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      errors: [error.message]
    };
  }
}

/**
 * Sends push notification to multiple users
 * @param strapi - Strapi instance
 * @param userDocumentIds - Array of user document IDs
 * @param payload - Notification payload
 * @returns Summary of sent notifications
 */
export async function sendPushNotificationToMultipleUsers(
  strapi: Core.Strapi,
  userDocumentIds: string[],
  payload: PushNotificationPayload
): Promise<{
  totalUsers: number;
  totalSent: number;
  totalFailed: number;
}> {
  const results = await Promise.allSettled(
    userDocumentIds.map(userId => 
      sendPushNotificationToUser(strapi, userId, payload)
    )
  );

  const summary = results.reduce(
    (acc, result) => {
      if (result.status === 'fulfilled') {
        acc.totalSent += result.value.sentCount;
        acc.totalFailed += result.value.failedCount;
      }
      return acc;
    },
    { totalUsers: userDocumentIds.length, totalSent: 0, totalFailed: 0 }
  );

  strapi.log.info(`[PushNotification] Batch notification sent to ${summary.totalUsers} users: ${summary.totalSent} success, ${summary.totalFailed} failed`);

  return summary;
}

/**
 * Removes invalid FCM tokens from user's token list
 * @param strapi - Strapi instance
 * @param userDocumentId - User's document ID
 * @param invalidTokens - Array of invalid tokens to remove
 */
async function removeInvalidTokens(
  strapi: Core.Strapi,
  userDocumentId: string,
  invalidTokens: string[]
): Promise<void> {
  try {
    const user = await strapi.documents('plugin::users-permissions.user').findOne({
      documentId: userDocumentId,
      populate: ['fcmTokens']
    });

    if (!user || !user.fcmTokens) {
      return;
    }

    const tokens = user.fcmTokens as FCMTokenComponent[];

    // Filter out invalid tokens
    const updatedTokens: FCMTokenComponent[] = tokens.filter(
      (t) => !invalidTokens.includes(t.token)
    );

    await strapi.documents('plugin::users-permissions.user').update({
      documentId: userDocumentId,
      data: {
        fcmTokens: updatedTokens as any
      },
      status: 'published'
    });

    strapi.log.info(`[PushNotification] Removed ${invalidTokens.length} invalid tokens for user ${userDocumentId}`);
  } catch (error) {
    strapi.log.error('[PushNotification] Error removing invalid tokens:', error);
  }
}

/**
 * Example usage in your code:
 * 
 * // Send to single user
 * await sendPushNotificationToUser(strapi, userDocumentId, {
 *   title: 'Seat Updated',
 *   body: 'Your POS seat has been updated',
 *   data: {
 *     type: 'seat_update',
 *     seatId: 'seat-123'
 *   }
 * });
 * 
 * // Send to multiple users
 * await sendPushNotificationToMultipleUsers(strapi, [userId1, userId2], {
 *   title: 'System Maintenance',
 *   body: 'Scheduled maintenance in 1 hour'
 * });
 */
