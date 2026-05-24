/**
 * news-alert controller
 */

import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';

export default factories.createCoreController('api::news-alert.news-alert', ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Get active alerts based on filters
   * GET /api/news-alerts/active
   * Query params: shopType, appVersion, locale
   */
  async findActive(ctx) {
    try {
      const { shopType, appVersion, locale } = ctx.query;

      // Delegate to service
      const alerts = await strapi.service('api::news-alert.news-alert').findActiveAlerts({
        shopType,
        appVersion,
        locale: locale || 'en'
      });

      return ctx.send({
        data: alerts,
        
        meta: {
          pagination: {
            page: 1,
            pageSize: alerts.length,
            pageCount: 1,
            total: alerts.length
          }
        }
      });
    } catch (error) {
      strapi.log.error('Failed to fetch active alerts:', {
        error: error.message,
        stack: error.stack
      });

      return ctx.internalServerError('Failed to fetch active alerts');
    }
  },

  /**
   * Track alert view
   * POST /api/news-alerts/:documentId/track-view
   */
  async trackView(ctx) {
    try {
      const { documentId } = ctx.params;

      if (!documentId) {
        return ctx.badRequest('Alert documentId is required');
      }

      const result = await strapi.service('api::news-alert.news-alert').incrementViewCount(documentId);

      if (!result) {
        return ctx.notFound('Alert not found');
      }

      return ctx.send({
        success: true,
        viewCount: result.viewCount
      });
    } catch (error) {
      strapi.log.error('Failed to track view:', {
        documentId: ctx.params.documentId,
        error: error.message
      });

      return ctx.internalServerError('Failed to track view');
    }
  },

  /**
   * Track alert click
   * POST /api/news-alerts/:documentId/track-click
   */
  async trackClick(ctx) {
    try {
      const { documentId } = ctx.params;

      if (!documentId) {
        return ctx.badRequest('Alert documentId is required');
      }

      const result = await strapi.service('api::news-alert.news-alert').incrementClickCount(documentId);

      if (!result) {
        return ctx.notFound('Alert not found');
      }

      return ctx.send({
        success: true,
        clickCount: result.clickCount
      });
    } catch (error) {
      strapi.log.error('Failed to track click:', {
        documentId: ctx.params.documentId,
        error: error.message
      });

      return ctx.internalServerError('Failed to track click');
    }
  },

  /**
   * Track alert dismiss
   * POST /api/news-alerts/:documentId/track-dismiss
   */
  async trackDismiss(ctx) {
    try {
      const { documentId } = ctx.params;

      if (!documentId) {
        return ctx.badRequest('Alert documentId is required');
      }

      const result = await strapi.service('api::news-alert.news-alert').incrementDismissCount(documentId);

      if (!result) {
        return ctx.notFound('Alert not found');
      }

      return ctx.send({
        success: true,
        dismissCount: result.dismissCount
      });
    } catch (error) {
      strapi.log.error('Failed to track dismiss:', {
        documentId: ctx.params.documentId,
        error: error.message
      });

      return ctx.internalServerError('Failed to track dismiss');
    }
  }
}));
