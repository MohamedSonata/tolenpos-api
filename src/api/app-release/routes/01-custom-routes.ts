export default {
  routes: [
    {
      method: 'POST',
      path: '/app-release/:documentId/download-track',
      handler: 'app-release.trackDownload',
      config: {
        policies: [],
        middlewares: []
      }
    }
  ]
};
