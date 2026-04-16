export default {
  routes: [
    {
      method: 'GET',
      path: '/key-seats/my-seats',
      handler: 'key-seat.mySeats',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/key-seats/:documentId/telemetry/query',
      handler: 'key-seat.queryTelemetry',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/key-seats/:documentId/telemetry/latest',
      handler: 'key-seat.getLatestTelemetry',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/key-seats/:documentId/telemetry/snapshot',
      handler: 'key-seat.createSnapshot',
      config: {
        policies: [],
        middlewares: []
      }
    }
  ]
};
