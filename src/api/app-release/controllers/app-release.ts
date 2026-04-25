/**
 * app-release controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::app-release.app-release', ({ strapi }) => ({
  async trackDownload(ctx) {
    const { documentId } = ctx.params;

    if (!documentId) {
      return ctx.badRequest('Missing documentId');
    }

    try {
      const result = await strapi.service('api::app-release.app-release').incrementDownloadCount(documentId);
      return ctx.send({ data: result });
    } catch (error) {
      strapi.log.error('Download tracking failed:', error);
      return ctx.internalServerError('Failed to track download');
    }
  }
}));
