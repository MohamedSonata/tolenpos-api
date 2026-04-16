# Implementation Plan: POS Seat Realtime Updates

## Overview

This implementation plan breaks down the POS seat realtime updates feature into discrete, actionable coding tasks. The feature enables bidirectional real-time communication between POS applications and mobile store owner applications through Socket.IO, with telemetry persistence and real-time notifications.

The implementation follows a phased approach: event constants and interfaces, service layer, Socket.IO handlers, HTTP controller, and testing. Each task builds incrementally on previous work, with checkpoints to ensure stability.

## Tasks

- [x] 1. Set up event constants and TypeScript interfaces
  - [x] 1.1 Add Socket.IO event constants to events_constants.ts
    - Add six new event constants to the SocketIOEvents class following the existing "entity:action" naming pattern
    - Include JSDoc comments for each constant
    - Events: OnSeatUpdate, EmitSeatUpdateSuccess, OnSeatSubscribe, EmitSeatSubscribeSuccess, EmitSeatUpdated, OnSeatUnsubscribe
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 1.2 Define TypeScript interfaces for event payloads
    - Create interfaces in src/socketio/interfaces.ts for SeatUpdatePayload, SeatSubscribePayload, SeatUpdatedNotification
    - Follow existing interface patterns in the file
    - _Requirements: 1.1, 1.4, 10.1, 10.2, 10.3, 10.4_

- [x] 2. Create database schema for historical telemetry
  - [x] 2.1 Create seat-telemetry-history collection schema
    - Create new file src/api/seat-telemetry-history/content-types/seat-telemetry-history/schema.json
    - Define collection with fields: keySeat (manyToOne relation), telemetryData (json), capturedAt (datetime), snapshotType (enum)
    - Set draftAndPublish to false for this collection
    - _Requirements: 2.2, 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [x] 2.2 Update key-seat schema with telemetryHistory relation
    - Modify src/api/key-seat/content-types/key-seat/schema.json
    - Add telemetryHistory field with oneToMany relation to seat-telemetry-history
    - Set mappedBy to "keySeat"
    - _Requirements: 13.5_
  
  - [x] 2.3 Create seat-telemetry-history service and controller scaffolding
    - Create src/api/seat-telemetry-history/services/seat-telemetry-history.ts with factory pattern
    - Create src/api/seat-telemetry-history/controllers/seat-telemetry-history.ts with factory pattern
    - Follow existing Strapi patterns from other API collections
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2_

- [ ] 3. Checkpoint - Verify database schema
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement service layer methods
  - [x] 4.1 Extend key-seat service with updateSeatTelemetry method
    - Modify src/api/key-seat/services/key-seat.ts to add updateSeatTelemetry method
    - Validate seat exists before updating
    - Update telemetry field with new data and add lastUpdated timestamp
    - Call createTelemetrySnapshot asynchronously (non-blocking)
    - Use strapi.documents() API for all database operations
    - Include error handling with descriptive error messages
    - _Requirements: 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.4, 11.1, 11.3, 11.4, 11.5, 13.1, 13.7_
  
  - [x] 4.2 Add createTelemetrySnapshot method to key-seat service
    - Add createTelemetrySnapshot method to src/api/key-seat/services/key-seat.ts
    - Create snapshot record in seat-telemetry-history collection
    - Set keySeat relation, telemetryData, capturedAt, and snapshotType fields
    - Include error handling and logging
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7_
  
  - [x] 4.3 Add getSeatTelemetryHistory method to key-seat service
    - Add getSeatTelemetryHistory method to src/api/key-seat/services/key-seat.ts
    - Query seat-telemetry-history with filters for keySeat, date range (capturedAt)
    - Support pagination with page and pageSize parameters
    - Sort results by capturedAt descending (newest first)
    - Populate keySeat relation
    - _Requirements: 14.2, 14.3, 14.5, 14.6, 14.9_
  
  - [ ]* 4.4 Write unit tests for updateSeatTelemetry method
    - Test successful update with valid input
    - Test error when seat not found
    - Test error handling for invalid telemetry data
    - Test that createTelemetrySnapshot is called asynchronously
    - Mock strapi.documents() calls
    - _Requirements: 2.1, 2.5, 8.5, 13.1_
  
  - [ ]* 4.5 Write unit tests for createTelemetrySnapshot method
    - Test successful snapshot creation
    - Test error handling for invalid data
    - Test different snapshot types (realtime, hourly, daily)
    - Mock strapi.documents() calls
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [ ]* 4.6 Write unit tests for getSeatTelemetryHistory method
    - Test filtering by date range
    - Test pagination
    - Test sorting by capturedAt descending
    - Mock strapi.documents() calls
    - _Requirements: 14.3, 14.6, 14.9_
  
  - [x] 4.7 Extend key-seat service with getUserSeats method
    - Add getUserSeats method to src/api/key-seat/services/key-seat.ts
    - Query licenses by user documentId with seats populated
    - Extract and flatten all seats from all licenses
    - Include license metadata (documentId, licenseKey, planSubscriptionType) with each seat
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7, 5.4, 8.1, 8.2, 8.4_
  
  - [ ]* 4.8 Write unit tests for getUserSeats method
    - Test filtering by user ownership
    - Test with multiple licenses and seats
    - Test with user having no licenses
    - Mock strapi.documents() calls
    - _Requirements: 3.2, 5.4, 8.5_

- [ ] 5. Checkpoint - Verify service layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create Socket.IO event handlers
  - [x] 6.1 Create seat-update.handler.ts file structure
    - Create new file src/socketio/handlers/seat-update.handler.ts
    - Import required dependencies (Socket.IO types, Strapi types, event constants)
    - Define setupSeatUpdateHandlers function that registers handlers on connection
    - Add JSDoc comments describing the handler's purpose
    - _Requirements: 7.1, 7.2, 8.1_
  
  - [x] 6.2 Implement POS seat update event handler
    - Implement handlePOSSeatUpdate function in seat-update.handler.ts
    - Validate socket.data.keySeatDocumentId exists
    - Call service.updateSeatTelemetry with keySeatDocumentId and telemetry payload
    - Emit EmitSeatUpdateSuccess event to POS client with success status
    - Call notifyMobileAppsOfSeatUpdate to broadcast to subscribed mobile apps
    - Add error handling and logging
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 7.3, 7.4, 7.5, 8.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 13.1_
  
  - [x] 6.3 Implement mobile subscription event handler
    - Implement handleMobileSeatSubscription function in seat-update.handler.ts
    - Handle OnSeatSubscribe event by joining user-specific room (user:{documentId}:seats)
    - Emit EmitSeatSubscribeSuccess confirmation to mobile client
    - Handle OnSeatUnsubscribe event by leaving the room
    - Add logging for subscription events
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 7.3, 7.4, 7.5, 11.3, 11.4, 11.5_
  
  - [x] 6.4 Implement notification logic for mobile apps
    - Implement notifyMobileAppsOfSeatUpdate function in seat-update.handler.ts
    - Query license by seat's license documentId with user populated
    - Extract owner documentId from license.user
    - Emit EmitSeatUpdated event to room user:{ownerDocumentId}:seats
    - Include machineUUID, telemetry, isActive, updatedAt, licenseDocumentId in notification
    - Add error handling and logging
    - _Requirements: 4.4, 4.5, 5.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.3, 11.4, 11.5_
  
  - [ ]* 6.5 Write integration tests for Socket.IO handlers
    - Test POS seat update end-to-end flow
    - Test mobile subscription and notification flow
    - Test authorization prevents cross-user notifications
    - Test that telemetry snapshots are created
    - Use real Socket.IO clients and test database
    - _Requirements: 1.1, 4.1, 4.4, 5.5, 5.7, 13.1_

- [ ] 7. Checkpoint - Verify Socket.IO handlers
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement HTTP controller endpoints
  - [x] 8.1 Extend key-seat controller with mySeats method
    - Modify src/api/key-seat/controllers/key-seat.ts to add mySeats method
    - Extract authenticated user from ctx.state.user
    - Return 401 Unauthorized if user not authenticated
    - Call service.getUserSeats with user documentId
    - Return seats data with meta.total count
    - Add error handling for 500 Internal Server Error
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 5.1, 5.2, 5.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 11.1, 11.3, 11.4, 11.5_
  
  - [x] 8.2 Create custom route configuration for key-seat
    - Create new file src/api/key-seat/routes/custom-routes.ts
    - Define GET route for /key-seats/my-seats pointing to key-seat.mySeats handler
    - Export route configuration following Strapi route pattern
    - _Requirements: 3.1, 9.1_
  
  - [x] 8.3 Implement seat-telemetry-history controller queryTelemetryHistory method
    - Modify src/api/seat-telemetry-history/controllers/seat-telemetry-history.ts
    - Extract authenticated user from ctx.state.user
    - Return 401 Unauthorized if user not authenticated
    - Extract query parameters: machineUUID, startDate, endDate, page, pageSize
    - Validate pagination parameters (max pageSize: 1000)
    - If machineUUID provided, verify seat ownership and query history for that seat
    - If no machineUUID, query history for all user's seats
    - Return history data with pagination metadata
    - Add error handling for 403 Forbidden and 500 Internal Server Error
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9_
  
  - [x] 8.4 Create custom route configuration for seat-telemetry-history
    - Create new file src/api/seat-telemetry-history/routes/custom-routes.ts
    - Define GET route for /seat-telemetry-history/query pointing to seat-telemetry-history.queryTelemetryHistory handler
    - Export route configuration following Strapi route pattern
    - _Requirements: 14.1_
  
  - [ ]* 8.5 Write integration tests for HTTP endpoints
    - Test successful fetch of user's seats with JWT authentication
    - Test 401 error without authentication
    - Test authorization prevents accessing other user's seats
    - Test response format includes all required fields
    - Test telemetry history query with date range filtering
    - Test telemetry history query with pagination
    - Test telemetry history query with machineUUID filtering
    - Test authorization prevents accessing other user's telemetry history
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.4, 5.6, 14.2, 14.3, 14.4, 14.6, 14.7, 14.8, 14.9_

- [ ] 9. Checkpoint - Verify HTTP controllers
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Wire Socket.IO handlers into connection flow
  - [x] 10.1 Integrate seat update handlers with Socket.IO server
    - Modify src/socketio/index.ts to import setupSeatUpdateHandlers
    - Call setupSeatUpdateHandlers(io, strapi) after setupConnectionHandlers
    - Ensure handlers are registered on the same io instance
    - _Requirements: 7.1, 7.2, 12.1, 12.4_
  
  - [x] 10.2 Verify handler registration for authenticated connections
    - Ensure handlers only register for authenticated sockets (socket.data.userId exists)
    - Verify POS handlers only register for clientType === 'pos'
    - Verify mobile handlers only register for clientType === 'mobile'
    - Add logging to confirm handler registration
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 12.4_

- [ ] 11. Final integration and testing
  - [ ]* 11.1 Write end-to-end integration tests
    - Test complete flow: POS connects, sends update, mobile receives notification
    - Test multiple POS machines for same user
    - Test multiple mobile clients subscribed to same user
    - Test disconnection cleanup
    - Test telemetry snapshot creation on seat update
    - Test querying telemetry history after multiple updates
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 4.1, 4.4, 4.6, 5.5, 7.2, 7.3, 7.4, 7.5, 13.1, 14.2_
  
  - [ ]* 11.2 Test error handling and edge cases
    - Test POS update with invalid keySeatDocumentId
    - Test mobile subscription without authentication
    - Test seat update for non-existent seat
    - Test notification when no mobile apps subscribed
    - Test telemetry history query with invalid date range
    - Test telemetry history query with invalid pagination parameters
    - Verify all error responses include descriptive messages
    - _Requirements: 2.5, 5.6, 5.7, 11.1, 11.2, 11.6, 14.7, 14.8_
  
  - [ ]* 11.3 Verify backward compatibility
    - Test existing Socket.IO connections still work
    - Test existing HTTP endpoints remain unchanged
    - Test existing authentication mechanisms work
    - Verify no breaking changes to key-seat schema
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 12. Final checkpoint - Complete feature verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation uses TypeScript and follows existing Strapi patterns
- All database operations use strapi.documents() API
- Socket.IO handlers integrate with existing connection.handler.ts authentication
- The hybrid telemetry storage approach stores current state in key-seat.telemetry and historical snapshots in seat-telemetry-history collection
- Historical snapshots are created automatically and asynchronously (non-blocking) on every telemetry update
- Authorization is enforced at service layer through user ownership filtering
- Real-time notifications use Socket.IO rooms for efficient targeted broadcasting
- Telemetry history queries support date range filtering and pagination for scalable historical analysis
