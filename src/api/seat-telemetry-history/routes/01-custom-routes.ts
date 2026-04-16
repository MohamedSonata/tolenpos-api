export default {
  routes: [
    {
      method: 'GET',
      path: '/seat-telemetry-history/query',
      handler: 'seat-telemetry-history.queryTelemetryHistory',
      config: {
        policies: [],
        middlewares: []
      }
    }
  ]
};
