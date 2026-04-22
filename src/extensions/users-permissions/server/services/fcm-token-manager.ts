/**
 * FCM Token Manager Service
 * Handles multi-device FCM token registration and management
 */

import type { Core } from '@strapi/strapi';
import type { FCMTokenComponent } from '../../../../socketio/interfaces';

interface FCMTokenData {
  token: string;
  deviceId: string;
  deviceName?: string;
  platform: 'ios' | 'android' | 'web';
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Registers or updates an FCM token for a device
   * If the device already has a token, it updates it
   * If it's a new device, it adds the token to the array
   * 
   * @param userDocumentId - User's document ID
   * @param tokenData - FCM token data with device info
   * @returns Updated user document
   */
  async registerFCMToken(
    userDocumentId: string,
    tokenData: FCMTokenData
  ) {
    try {
      // Get current user with FCM tokens
      const user = await strapi.documents('plugin::users-permissions.user').findOne({
        documentId: userDocumentId,
        populate: ['fcmTokens']
      });

      if (!user) {
        throw new Error('User not found');
      }

      const existingTokens = (user.fcmTokens || []) as FCMTokenComponent[];
      const now = new Date().toISOString();

      // Check if device already has a token registered
      const deviceIndex = existingTokens.findIndex(
        (t) => t.deviceId === tokenData.deviceId
      );

      let updatedTokens: FCMTokenComponent[];

      if (deviceIndex >= 0) {
        // Update existing device token
        updatedTokens = [...existingTokens];
        updatedTokens[deviceIndex] = {
          ...updatedTokens[deviceIndex],
          token: tokenData.token,
          deviceId: tokenData.deviceId,
          deviceName: tokenData.deviceName || updatedTokens[deviceIndex].deviceName,
          platform: tokenData.platform,
          lastUpdatedAt: now,
          isActive: true
        };
        
        strapi.log.info(`[FCMTokenManager] Updated FCM token for device ${tokenData.deviceId}`);
      } else {
        // Add new device token
        updatedTokens = [
          ...existingTokens,
          {
            token: tokenData.token,
            deviceId: tokenData.deviceId,
            deviceName: tokenData.deviceName || `${tokenData.platform} device`,
            platform: tokenData.platform,
            lastUpdatedAt: now,
            isActive: true
          }
        ];
        
        strapi.log.info(`[FCMTokenManager] Registered new FCM token for device ${tokenData.deviceId}`);
      }

      // Update user with new tokens array
      const updatedUser = await strapi.documents('plugin::users-permissions.user').update({
        documentId: userDocumentId,
        data: {
          fcmTokens: updatedTokens as any
        },
        status: 'published'
      });

      return {
        success: true,
        deviceCount: updatedTokens.length,
        message: deviceIndex >= 0 ? 'Token updated' : 'Token registered'
      };
    } catch (error) {
      strapi.log.error('[FCMTokenManager] Error registering FCM token:', error);
      throw error;
    }
  },

  /**
   * Removes an FCM token for a specific device
   * Call this when user logs out from a device
   * 
   * @param userDocumentId - User's document ID
   * @param deviceId - Device identifier
   * @returns Updated user document
   */
  async removeFCMToken(
    userDocumentId: string,
    deviceId: string
  ) {
    try {
      const user = await strapi.documents('plugin::users-permissions.user').findOne({
        documentId: userDocumentId,
        populate: ['fcmTokens']
      });

      if (!user) {
        throw new Error('User not found');
      }

      const existingTokens = (user.fcmTokens || []) as FCMTokenComponent[];
      
      // Remove token for the specified device
      const updatedTokens: FCMTokenComponent[] = existingTokens.filter(
        (t) => t.deviceId !== deviceId
      );

      await strapi.documents('plugin::users-permissions.user').update({
        documentId: userDocumentId,
        data: {
          fcmTokens: updatedTokens as any
        },
        status: 'published'
      });

      strapi.log.info(`[FCMTokenManager] Removed FCM token for device ${deviceId}`);

      return {
        success: true,
        deviceCount: updatedTokens.length,
        message: 'Token removed'
      };
    } catch (error) {
      strapi.log.error('[FCMTokenManager] Error removing FCM token:', error);
      throw error;
    }
  },

  /**
   * Marks a device token as inactive (soft delete)
   * Useful for temporarily disabling notifications without removing the token
   * 
   * @param userDocumentId - User's document ID
   * @param deviceId - Device identifier
   */
  async deactivateFCMToken(
    userDocumentId: string,
    deviceId: string
  ) {
    try {
      const user = await strapi.documents('plugin::users-permissions.user').findOne({
        documentId: userDocumentId,
        populate: ['fcmTokens']
      });

      if (!user) {
        throw new Error('User not found');
      }

      const existingTokens = (user.fcmTokens || []) as FCMTokenComponent[];
      
      const updatedTokens: FCMTokenComponent[] = existingTokens.map((t) => {
        if (t.deviceId === deviceId) {
          return { ...t, isActive: false };
        }
        return t;
      });

      await strapi.documents('plugin::users-permissions.user').update({
        documentId: userDocumentId,
        data: {
          fcmTokens: updatedTokens as any
        },
        status: 'published'
      });

      strapi.log.info(`[FCMTokenManager] Deactivated FCM token for device ${deviceId}`);

      return { success: true, message: 'Token deactivated' };
    } catch (error) {
      strapi.log.error('[FCMTokenManager] Error deactivating FCM token:', error);
      throw error;
    }
  },

  /**
   * Gets all active FCM tokens for a user
   * Use this when sending push notifications
   * 
   * @param userDocumentId - User's document ID
   * @returns Array of active FCM tokens
   */
  async getActiveFCMTokens(userDocumentId: string): Promise<string[]> {
    try {
      const user = await strapi.documents('plugin::users-permissions.user').findOne({
        documentId: userDocumentId,
        populate: ['fcmTokens']
      });

      if (!user || !user.fcmTokens) {
        return [];
      }

      const tokens = user.fcmTokens as FCMTokenComponent[];

      // Return only active tokens
      const activeTokens = tokens
        .filter((t) => t.isActive !== false)
        .map((t) => t.token);

      return activeTokens;
    } catch (error) {
      strapi.log.error('[FCMTokenManager] Error getting active FCM tokens:', error);
      return [];
    }
  },

  /**
   * Cleans up old/inactive tokens
   * Call this periodically to remove tokens that haven't been updated in X days
   * 
   * @param userDocumentId - User's document ID
   * @param daysOld - Number of days to consider a token old (default: 90)
   */
  async cleanupOldTokens(userDocumentId: string, daysOld: number = 90) {
    try {
      const user = await strapi.documents('plugin::users-permissions.user').findOne({
        documentId: userDocumentId,
        populate: ['fcmTokens']
      });

      if (!user || !user.fcmTokens) {
        return { success: true, removed: 0 };
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const tokens = user.fcmTokens as FCMTokenComponent[];
      const updatedTokens: FCMTokenComponent[] = tokens.filter((t) => {
        const lastUpdated = new Date(t.lastUpdatedAt || new Date());
        return lastUpdated > cutoffDate;
      });

      const removedCount = tokens.length - updatedTokens.length;

      if (removedCount > 0) {
        await strapi.documents('plugin::users-permissions.user').update({
          documentId: userDocumentId,
          data: {
            fcmTokens: updatedTokens as any
          },
          status: 'published'
        });

        strapi.log.info(`[FCMTokenManager] Cleaned up ${removedCount} old tokens for user ${userDocumentId}`);
      }

      return { success: true, removed: removedCount };
    } catch (error) {
      strapi.log.error('[FCMTokenManager] Error cleaning up old tokens:', error);
      throw error;
    }
  }
});
