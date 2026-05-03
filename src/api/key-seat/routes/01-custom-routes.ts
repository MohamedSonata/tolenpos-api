/**
 * Custom routes for key-seat
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/key-seats/my-seats',
      handler: 'key-seat.mySeats',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/key-seats/aggregated-kpi',
      handler: 'key-seat.getAggregatedKpi',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/key-seats/sales-insights',
      handler: 'key-seat.getSalesInsights',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/key-seats/test-snapshot',
      handler: 'key-seat.testSnapshot',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/key-seats/:documentId/telemetry/query',
      handler: 'key-seat.queryTelemetry',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/key-seats/:documentId/telemetry/latest',
      handler: 'key-seat.getLatestTelemetry',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/key-seats/:documentId/telemetry/snapshot',
      handler: 'key-seat.createSnapshot',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/key-seats/public/:publicSeatId',
      handler: 'key-seat.getPublicSeatInfo',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
