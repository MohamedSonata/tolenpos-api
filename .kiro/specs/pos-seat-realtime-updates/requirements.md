# Requirements Document

## Introduction

This document specifies requirements for a real-time POS seat updates feature that enables POS applications to send telemetry and status updates to the backend, and allows store owner mobile applications to receive these updates in real-time via Socket.IO. The feature builds upon the existing Socket.IO infrastructure and key-seat collection to provide bidirectional communication between POS machines and mobile apps.

## Glossary

- **POS_App**: Point-of-Sale desktop application that connects via Socket.IO using license key authentication (machineUUID + licenseKey)
- **Mobile_App**: Store owner mobile application that connects via Socket.IO using JWT authentication
- **Backend**: Strapi server with Socket.IO configured for real-time communication
- **Key_Seat**: Database collection that tracks POS machines with fields: machineUUID, userSocketId, telemetry, isActive, license relation
- **License**: Database collection with one-to-many relation to key-seats (seats)
- **Seat_Update**: Real-time data packet containing telemetry, status, or activity information from a POS machine
- **Telemetry**: JSON object containing POS machine metrics, status, and operational data
- **Machine_UUID**: Unique identifier for a POS machine
- **User_Document_ID**: Unique identifier for a user in the system
- **Socket_ID**: Unique identifier for an active Socket.IO connection
- **Seat_Telemetry_History**: Database collection that stores historical snapshots of telemetry data with fields: telemetryData, capturedAt, snapshotType, key-seat relation
- **Snapshot_Type**: Enumeration indicating the type of telemetry snapshot (realtime, daily, hourly)
- **Captured_At**: Timestamp indicating when a telemetry snapshot was captured

## Requirements

### Requirement 1: POS Seat Data Transmission

**User Story:** As a POS application, I want to send real-time updates about my seat data to the backend, so that store owners can monitor my status and activity.

#### Acceptance Criteria

1. WHEN a POS_App emits a seat update event, THE Backend SHALL validate the POS_App is authenticated
2. WHEN a POS_App emits a seat update event with valid telemetry data, THE Backend SHALL store the telemetry in the Key_Seat collection
3. WHEN a POS_App emits a seat update event, THE Backend SHALL associate the update with the correct Key_Seat using the Machine_UUID
4. THE Backend SHALL accept telemetry data as a JSON object with arbitrary structure
5. WHEN a POS_App emits a seat update event, THE Backend SHALL update the Key_Seat record within 500ms

### Requirement 2: Seat Data Persistence

**User Story:** As a backend system, I want to persist POS seat updates in the database, so that the data is available for queries and historical analysis.

#### Acceptance Criteria

1. WHEN THE Backend receives a seat update, THE Backend SHALL update the telemetry field in the Key_Seat collection
2. WHEN THE Backend receives a seat update, THE Backend SHALL create a historical snapshot in the Seat_Telemetry_History collection
3. WHEN THE Backend updates a Key_Seat record, THE Backend SHALL preserve the existing license relation
4. WHEN THE Backend updates a Key_Seat record, THE Backend SHALL maintain the isActive status unless explicitly changed
5. THE Backend SHALL use the Strapi Document Service API (strapi.documents()) for all database operations
6. IF a Key_Seat record does not exist for the Machine_UUID, THEN THE Backend SHALL return an error to the POS_App

### Requirement 3: Mobile App Seat Retrieval

**User Story:** As a store owner using a mobile app, I want to fetch all my POS seats via HTTP, so that I can see the current status of all my machines.

#### Acceptance Criteria

1. THE Backend SHALL provide an HTTP GET endpoint at /api/key-seats/my-seats
2. WHEN a Mobile_App requests /api/key-seats/my-seats with valid JWT authentication, THE Backend SHALL return all Key_Seat records associated with the authenticated user
3. WHEN THE Backend returns seat data, THE Backend SHALL populate the license relation with license details
4. WHEN THE Backend returns seat data, THE Backend SHALL populate the user relation through the license
5. WHEN a Mobile_App requests seats without authentication, THE Backend SHALL return a 401 Unauthorized error
6. WHEN a Mobile_App requests seats with invalid authentication, THE Backend SHALL return a 403 Forbidden error
7. THE Backend SHALL return seat data in JSON format with fields: documentId, machineUUID, userSocketId, telemetry, isActive, license

### Requirement 4: Real-time Seat Update Subscription

**User Story:** As a store owner using a mobile app, I want to subscribe to real-time updates for my POS seats, so that I can see changes immediately without manual refresh.

#### Acceptance Criteria

1. THE Backend SHALL provide a Socket.IO event for Mobile_App to subscribe to seat updates
2. WHEN a Mobile_App emits a subscription event with valid JWT authentication, THE Backend SHALL register the Mobile_App for seat update notifications
3. WHEN a Mobile_App subscribes to seat updates, THE Backend SHALL only send updates for seats owned by the authenticated user
4. WHEN a POS_App sends a seat update, THE Backend SHALL emit the update to all subscribed Mobile_App instances for that user
5. THE Backend SHALL include the Machine_UUID in every seat update notification to Mobile_App
6. WHEN a Mobile_App disconnects, THE Backend SHALL automatically unsubscribe the Mobile_App from seat updates

### Requirement 5: Authorization and Security

**User Story:** As a system administrator, I want to ensure users can only access their own seat data, so that data privacy and security are maintained.

#### Acceptance Criteria

1. THE Backend SHALL verify JWT authentication for all Mobile_App HTTP requests
2. THE Backend SHALL verify JWT authentication for all Mobile_App Socket.IO subscriptions
3. THE Backend SHALL verify license key authentication for all POS_App Socket.IO connections
4. WHEN THE Backend processes a seat query, THE Backend SHALL filter results to only include seats where the license.user matches the authenticated User_Document_ID
5. WHEN THE Backend emits seat updates, THE Backend SHALL only send updates to Mobile_App instances authenticated as the seat owner
6. IF a Mobile_App attempts to access seats not owned by the authenticated user, THEN THE Backend SHALL return a 403 Forbidden error
7. IF a POS_App attempts to update a seat not associated with its Machine_UUID, THEN THE Backend SHALL return a 403 Forbidden error

### Requirement 6: Socket.IO Event Constants

**User Story:** As a developer, I want Socket.IO events to follow the existing event constants pattern, so that the codebase remains consistent and maintainable.

#### Acceptance Criteria

1. THE Backend SHALL define all new Socket.IO event names in the SocketIOEvents class in src/socketio/events_constants.ts
2. THE Backend SHALL follow the existing naming convention pattern (e.g., "entity:action" format)
3. THE Backend SHALL use static readonly properties for all event constants
4. THE Backend SHALL document each event constant with JSDoc comments describing its purpose

### Requirement 7: Connection Handler Integration

**User Story:** As a developer, I want seat update handlers to integrate with the existing connection handler, so that authentication and connection management are consistent.

#### Acceptance Criteria

1. THE Backend SHALL register seat update event handlers in the existing Socket.IO connection flow
2. WHEN a POS_App connects, THE Backend SHALL use the existing authentication mechanism in src/socketio/connection.handler.ts
3. WHEN a Mobile_App connects, THE Backend SHALL use the existing JWT authentication mechanism
4. THE Backend SHALL access authenticated user data from socket.data.userId and socket.data.documentId
5. THE Backend SHALL access POS machine data from socket.data.machineUUID and socket.data.keySeatDocumentId

### Requirement 8: Service Layer Implementation

**User Story:** As a developer, I want seat update logic encapsulated in service methods, so that business logic is separated from controller and Socket.IO handler code.

#### Acceptance Criteria

1. THE Backend SHALL implement seat update logic in src/api/key-seat/services/key-seat.ts
2. THE Backend SHALL implement seat query logic in src/api/key-seat/services/key-seat.ts
3. THE Backend SHALL use the Strapi factory pattern for service creation
4. THE Backend SHALL export service methods that can be called from both HTTP controllers and Socket.IO handlers
5. THE Backend SHALL handle errors in service methods and return descriptive error messages

### Requirement 9: HTTP Controller Implementation

**User Story:** As a developer, I want HTTP endpoints for seat retrieval implemented in the key-seat controller, so that mobile apps can fetch seat data via REST API.

#### Acceptance Criteria

1. THE Backend SHALL implement the /api/key-seats/my-seats endpoint in src/api/key-seat/controllers/key-seat.ts
2. THE Backend SHALL use the Strapi factory pattern for controller creation
3. THE Backend SHALL extract the authenticated user ID from ctx.state.user
4. THE Backend SHALL call service methods to retrieve seat data
5. THE Backend SHALL return HTTP 200 with seat data on success
6. THE Backend SHALL return appropriate HTTP error codes (401, 403, 500) on failure

### Requirement 10: Real-time Update Notification Format

**User Story:** As a mobile app developer, I want seat update notifications to have a consistent format, so that I can reliably parse and display the data.

#### Acceptance Criteria

1. WHEN THE Backend emits a seat update to Mobile_App, THE Backend SHALL include the following fields: machineUUID, telemetry, isActive, updatedAt
2. THE Backend SHALL include the license documentId in seat update notifications
3. THE Backend SHALL format updatedAt as an ISO 8601 timestamp
4. THE Backend SHALL ensure telemetry is a valid JSON object
5. THE Backend SHALL include a success boolean field in all Socket.IO responses

### Requirement 11: Error Handling and Logging

**User Story:** As a system administrator, I want comprehensive error handling and logging, so that I can troubleshoot issues and monitor system health.

#### Acceptance Criteria

1. WHEN THE Backend encounters an error processing a seat update, THE Backend SHALL log the error with context (userId, machineUUID, error message)
2. WHEN THE Backend encounters an error, THE Backend SHALL emit an error event to the requesting client
3. THE Backend SHALL use strapi.log.error() for error logging
4. THE Backend SHALL use strapi.log.info() for successful operations
5. THE Backend SHALL include timestamps in all log messages
6. WHEN THE Backend emits an error event, THE Backend SHALL include a descriptive error message and error code

### Requirement 12: Backward Compatibility

**User Story:** As a system administrator, I want the new feature to maintain backward compatibility, so that existing POS and mobile app functionality is not disrupted.

#### Acceptance Criteria

1. THE Backend SHALL not modify existing Socket.IO event handlers
2. THE Backend SHALL not modify the Key_Seat schema structure
3. THE Backend SHALL not modify existing authentication mechanisms
4. THE Backend SHALL not modify existing connection handler behavior for non-seat-update events
5. THE Backend SHALL maintain the existing telemetry field structure in Key_Seat collection

### Requirement 13: Historical Telemetry Storage

**User Story:** As a backend system, I want to automatically store historical telemetry snapshots, so that POS applications don't need to manage history and store owners can analyze trends over time.

#### Acceptance Criteria

1. WHEN THE Backend updates telemetry in Key_Seat, THE Backend SHALL create a snapshot record in Seat_Telemetry_History
2. WHEN THE Backend creates a historical snapshot, THE Backend SHALL store the telemetryData as a JSON object
3. WHEN THE Backend creates a historical snapshot, THE Backend SHALL set capturedAt to the current timestamp
4. WHEN THE Backend creates a historical snapshot, THE Backend SHALL set snapshotType to "realtime"
5. WHEN THE Backend creates a historical snapshot, THE Backend SHALL establish a manyToOne relation with the Key_Seat record
6. THE Backend SHALL store current telemetry in Key_Seat.telemetry for fast access to latest state
7. THE Backend SHALL complete snapshot creation within 200ms to avoid blocking the seat update operation

### Requirement 14: Historical Telemetry Retrieval

**User Story:** As a store owner using a mobile app, I want to query historical telemetry data by date range, so that I can analyze POS machine performance and trends over time.

#### Acceptance Criteria

1. THE Backend SHALL provide an HTTP GET endpoint at /api/seat-telemetry-history/query
2. WHEN a Mobile_App requests telemetry history with valid JWT authentication, THE Backend SHALL return historical snapshots for seats owned by the authenticated user
3. WHEN a Mobile_App requests telemetry history with startDate and endDate parameters, THE Backend SHALL filter snapshots where capturedAt is within the date range
4. WHEN a Mobile_App requests telemetry history with a machineUUID parameter, THE Backend SHALL filter snapshots for the specified Key_Seat
5. WHEN THE Backend returns telemetry history, THE Backend SHALL include fields: documentId, telemetryData, capturedAt, snapshotType, key-seat relation
6. WHEN THE Backend returns telemetry history, THE Backend SHALL sort results by capturedAt in descending order (newest first)
7. WHEN a Mobile_App requests telemetry history without authentication, THE Backend SHALL return a 401 Unauthorized error
8. WHEN a Mobile_App requests telemetry history for seats not owned by the authenticated user, THE Backend SHALL return a 403 Forbidden error
9. THE Backend SHALL support pagination for telemetry history queries with page and pageSize parameters
