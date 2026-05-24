/**
 * Custom news-alert routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/news-alerts/active',
      handler: 'news-alert.findActive',
      config: {
        policies: [],
        middlewares: [],
        auth: false
      },
    },
    {
      method: 'POST',
      path: '/news-alerts/:documentId/track-view',
      handler: 'news-alert.trackView',
      config: {
        policies: [],
        middlewares: [],
        auth: false
      },
    },
    {
      method: 'POST',
      path: '/news-alerts/:documentId/track-click',
      handler: 'news-alert.trackClick',
      config: {
        policies: [],
        middlewares: [],
        auth: false
      },
    },
    {
      method: 'POST',
      path: '/news-alerts/:documentId/track-dismiss',
      handler: 'news-alert.trackDismiss',
      config: {
        policies: [],
        middlewares: [],
        auth: false
      },
    },
  ],
};
