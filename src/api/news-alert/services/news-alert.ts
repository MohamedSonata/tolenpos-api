/**
 * news-alert service
 */

import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';

interface FindActiveAlertsParams {
  shopType?: string;
  appVersion?: string;
  locale?: string;
}

export default factories.createCoreService('api::news-alert.news-alert', ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Find active alerts based on filters
   */
  async findActiveAlerts(params: FindActiveAlertsParams) {
    const { shopType, appVersion, locale = 'en' } = params;
    const now = new Date().toISOString();

    // Build base filters
    const filters: any = {
      isActive: true,
      startDate: { $lte: now },
      $or: [
        { endDate: { $gte: now } },
        { endDate: { $null: true } }
      ]
    };

    // Filter by shop type
    if (shopType && shopType !== 'all') {
      filters.$and = filters.$and || [];
      filters.$and.push({
        $or: [
          { targetAudience: 'all' },
          { targetAudience: shopType }
        ]
      });
    }

    // Filter by version (basic string comparison - implement semver if needed)
    if (appVersion) {
      filters.$and = filters.$and || [];
      
      // Min version filter
      filters.$and.push({
        $or: [
          { minVersion: { $null: true } },
          { minVersion: { $lte: appVersion } }
        ]
      });
      
      // Max version filter
      filters.$and.push({
        $or: [
          { maxVersion: { $null: true } },
          { maxVersion: { $gte: appVersion } }
        ]
      });
    }

    try {
      const alerts = await strapi.documents('api::news-alert.news-alert').findMany({
        filters,
        populate:{
          actionButton:true
        },
        sort: { priority: 'desc', createdAt: 'desc' },
        locale,
        status: 'published'
      });

      strapi.log.info('Active alerts fetched:', {
        count: alerts.length,
        shopType,
        appVersion,
        locale
      });

      return alerts;
    } catch (error) {
      strapi.log.error('Error fetching active alerts:', {
        error: error.message,
        filters
      });
      throw error;
    }
  },

  /**
   * Increment view count for an alert
   */
  async incrementViewCount(documentId: string) {
    try {
      // Find the alert first
      const alert = await strapi.documents('api::news-alert.news-alert').findOne({
        documentId,
        status: 'published'
      });

      if (!alert) {
        return null;
      }

      // Update view count
      const updated = await strapi.documents('api::news-alert.news-alert').update({
        documentId,
        data: {
          viewCount: (alert.viewCount || 0) + 1
        },
        status: 'published'
      });

      strapi.log.debug('Alert view tracked:', {
        documentId,
        viewCount: updated.viewCount
      });

      return updated;
    } catch (error) {
      strapi.log.error('Error incrementing view count:', {
        documentId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Increment click count for an alert
   */
  async incrementClickCount(documentId: string) {
    try {
      // Find the alert first
      const alert = await strapi.documents('api::news-alert.news-alert').findOne({
        documentId,
        status: 'published'
      });

      if (!alert) {
        return null;
      }

      // Update click count
      const updated = await strapi.documents('api::news-alert.news-alert').update({
        documentId,
        data: {
          clickCount: (alert.clickCount || 0) + 1
        },
        status: 'published'
      });

      strapi.log.debug('Alert click tracked:', {
        documentId,
        clickCount: updated.clickCount
      });

      return updated;
    } catch (error) {
      strapi.log.error('Error incrementing click count:', {
        documentId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Increment dismiss count for an alert
   */
  async incrementDismissCount(documentId: string) {
    try {
      // Find the alert first
      const alert = await strapi.documents('api::news-alert.news-alert').findOne({
        documentId,
        status: 'published'
      });

      if (!alert) {
        return null;
      }

      // Update dismiss count
      const updated = await strapi.documents('api::news-alert.news-alert').update({
        documentId,
        data: {
          dismissCount: (alert.dismissCount || 0) + 1
        },
        status: 'published'
      });

      strapi.log.debug('Alert dismiss tracked:', {
        documentId,
        dismissCount: updated.dismissCount
      });

      return updated;
    } catch (error) {
      strapi.log.error('Error incrementing dismiss count:', {
        documentId,
        error: error.message
      });
      throw error;
    }
  }
}));
