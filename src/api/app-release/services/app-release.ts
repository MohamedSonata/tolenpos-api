/**
 * app-release service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::app-release.app-release', ({ strapi }) => ({
  async incrementDownloadCount(documentId: string) {
    const release = await strapi.documents('api::app-release.app-release').findOne({
      documentId,
      status: 'published'
    });

    if (!release) {
      throw new Error('App release not found');
    }

    const updatedRelease = await strapi.documents('api::app-release.app-release').update({
      documentId,
      status:"published",
      data: {
        downloadCount: (release.downloadCount || 0) + 1
      }
    });

    return updatedRelease;
  }
}));
