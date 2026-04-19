/**
 * Custom license routes
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/licenses/activate',
      handler: 'license.activate',
      config: {
        policies: [],
        middlewares: [],
        auth: false
      },
    },
    {
      method: 'POST',
      path: '/licenses/:documentId/regenerate-key',
      handler: 'license.regenerateKey',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/licenses/:documentId/seats-insights',
      handler: 'license.getSeatsInsights',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
