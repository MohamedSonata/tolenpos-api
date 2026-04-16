/**
 * seat-telemetry-history controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::seat-telemetry-history.seat-telemetry-history', ({ strapi }) => ({
  /**
   * GET /api/seat-telemetry-history/query
   * Queries telemetry history with filtering and pagination
   * Query params:
   *   - machineUUID: Filter by machine UUID
   *   - startDate: ISO date string for range start
   *   - endDate: ISO date string for range end
   *   - page: Page number (default: 1)
   *   - pageSize: Records per page (default: 100, max: 1000)
   */
  async queryTelemetryHistory(ctx) {
    try {
      // Extract authenticated user from JWT
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      const userDocumentId = user.documentId;
      const { machineUUID, startDate, endDate, page = 1, pageSize = 100 } = ctx.query;

      // Validate pagination parameters
      const validatedPage = Math.max(1, parseInt(page as string, 10));
      const validatedPageSize = Math.min(1000, Math.max(1, parseInt(pageSize as string, 10)));

      // If machineUUID is provided, find the seat and verify ownership
      let keySeatDocumentId: string | null = null;

      if (machineUUID) {
        // Find the seat by machineUUID
        const seats: any = await strapi.documents('api::key-seat.key-seat').findMany({
          filters: {
            machineUUID: machineUUID as string
          },
          populate: ['license']
        } as any);

        if (seats.length === 0) {
          return ctx.notFound('Seat not found');
        }

        const seat = seats[0];

        // Verify ownership through license relation
        const license: any = await strapi.documents('api::license.license').findOne({
          documentId: typeof seat.license === 'object' ? seat.license.documentId : seat.license,
          populate: ['user']
        } as any);

        if (!license) {
          return ctx.notFound('License not found');
        }

        const ownerDocumentId = typeof license.user === 'object' 
          ? license.user.documentId 
          : license.user;

        if (ownerDocumentId !== userDocumentId) {
          return ctx.forbidden('You do not have access to this seat');
        }

        keySeatDocumentId = seat.documentId;
      } else {
        // If no machineUUID, return history for all user's seats
        const service = strapi.service('api::key-seat.key-seat');
        const userSeats = await service.getUserSeats(userDocumentId);

        if (userSeats.length === 0) {
          return ctx.send({
            data: [],
            meta: {
              page: validatedPage,
              pageSize: validatedPageSize,
              total: 0
            }
          });
        }

        // Query history for all user's seats
        const allHistory = [];
        for (const seat of userSeats) {
          const history = await service.getSeatTelemetryHistory(
            seat.documentId,
            startDate as string,
            endDate as string,
            validatedPage,
            validatedPageSize
          );
          allHistory.push(...history);
        }

        // Sort by capturedAt descending
        allHistory.sort((a, b) => 
          new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
        );

        // Apply pagination to combined results
        const start = (validatedPage - 1) * validatedPageSize;
        const paginatedHistory = allHistory.slice(start, start + validatedPageSize);

        return ctx.send({
          data: paginatedHistory,
          meta: {
            page: validatedPage,
            pageSize: validatedPageSize,
            total: allHistory.length
          }
        });
      }

      // Query history for specific seat
      const service = strapi.service('api::key-seat.key-seat');
      const history = await service.getSeatTelemetryHistory(
        keySeatDocumentId,
        startDate as string,
        endDate as string,
        validatedPage,
        validatedPageSize
      );

      return ctx.send({
        data: history,
        meta: {
          page: validatedPage,
          pageSize: validatedPageSize,
          total: history.length
        }
      });
    } catch (error) {
      strapi.log.error('[SeatTelemetryHistoryController] Error querying telemetry history:', error);
      return ctx.internalServerError('Failed to query telemetry history');
    }
  }
}));
