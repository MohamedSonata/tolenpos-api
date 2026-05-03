# Implementation Plan: Customer Mobile App Integration

## Overview

This plan implements customer-facing mobile app support for the Strapi v5 POS license management backend. The implementation follows a sequential approach: schema updates → utilities → services → handlers → endpoints → cron jobs → migration → testing.

The feature enables end-customers to connect to POS devices via Socket.IO using public seat identifiers, with subscription-based feature flags controlling capabilities like menu browsing and barcode scanning.

## Tasks

- [x] 1. Update subscription plan schema with customer app features
  - Add `allowCustomerApp`, `allowMenuBrowsing`, `allowBarcodeScanning`, `allowCustomerOrdering` boolean fields
  - Add `maxCustomerConnectionsPerSeat` integer field with default 50
  - Update `src/api/subscription-plan/content-types/subscription-plan/schema.json`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

- [x] 2. Update key-seat schema with customer app configuration
  - Add `publicSeatId` (unique string), `businessName`, `businessType` (enum) fields
  - Add `allowCustomerApp`, `allowMenuBrowsing`, `allowBarcodeScanning`, `allowCustomerOrdering` boolean fields
  - Add `maxCustomerConnections`, `currentCustomerConnections` integer fields
  - Add `customerFcmTokens` repeatable component using existing `user.fcm-token` component
  - Update `src/api/key-seat/content-types/key-seat/schema.json`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 19.1, 19.2, 19.3_

- [x] 3. Create public seat ID generator utility
  - [x] 3.1 Implement `generatePublicSeatId()` function with business type prefixes
    - Generate 6-12 character uppercase alphanumeric IDs
    - Use prefixes: REST (restaurant), RETL (retail), CAFE (cafe), PHRM (pharmacy), SEAT (other)
    - _Requirements: 2.2, 2.3_
  
  - [x] 3.2 Implement `isValidPublicSeatId()` validation function
    - Validate format: 6-12 uppercase alphanumeric characters
    - _Requirements: 2.2_
  
  - [x] 3.3 Implement `generateUniquePublicSeatId()` with collision detection
    - Query database to check for existing Public Seat IDs
    - Retry up to 10 times on collision
    - Throw error after max attempts
    - Create file: `src/api/key-seat/utils/public-id-generator.ts`
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.7_

- [x] 4. Create subscription plan service for customer app features
  - [x] 4.1 Implement `getCustomerAppFeatures()` method
    - Query plan by documentId using Document Service API
    - Return customer app feature flags and connection limits
    - Handle missing plan gracefully (return null)
    - _Requirements: 1.6_
  
  - [x] 4.2 Implement `getCustomerAppFeaturesByUser()` method
    - Query user with populated subscriptionPlan relation
    - Extract plan documentId and call `getCustomerAppFeatures()`
    - Handle users without plans (return null)
    - Update file: `src/api/subscription-plan/services/subscription-plan.ts`
    - _Requirements: 1.6_

- [x] 5. Integrate customer app features into license activation
  - [x] 5.1 Update license activation controller to copy plan features
    - Query user's subscription plan features using plan service
    - Generate unique Public Seat ID using generator utility
    - Copy `allowCustomerApp`, `allowMenuBrowsing`, `allowBarcodeScanning`, `allowCustomerOrdering` to seat
    - Copy `maxCustomerConnectionsPerSeat` to `maxCustomerConnections`
    - Initialize `currentCustomerConnections` to 0
    - Initialize `customerFcmTokens` as empty array
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 3.11, 3.12, 3.13_
  
  - [x] 5.2 Update license activation response to include customer app info
    - Return `publicSeatId`, `businessName`, `businessType`, `allowCustomerApp` in response
    - Update file: `src/api/license/controllers/license.ts`
    - _Requirements: 4.9, 4.10, 4.11_

- [x] 6. Add Socket.IO event constants for customer app
  - Add customer connection events: `customer:connect`, `customer:connect:success`, `customer:disconnect`
  - Add menu browsing events: `customer:menu:categories`, `customer:menu:categories:data`, `customer:menu:products`, `customer:menu:products:data`
  - Add barcode scanning events: `customer:product:scan`, `customer:product:data`
  - Add POS request events: `pos:menu:categories:request`, `pos:menu:products:request`, `pos:product:scan:request`
  - Add POS response events: `pos:menu:categories:response`, `pos:menu:products:response`, `pos:product:scan:response`
  - Add error events: `customer:error`, `customer:timeout`
  - Update file: `src/socketio/events_constants.ts`
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12, 13.13, 13.14, 13.15, 13.16, 13.17, 13.18_

- [ ] 7. Checkpoint - Verify schemas and utilities
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement customer Socket.IO connection handler
  - [x] 8.1 Create `handleCustomerConnection()` function
    - Validate Public Seat ID format and existence
    - Verify seat is active and `allowCustomerApp` is true
    - Verify POS device is connected (`isConnected` is true)
    - Check connection limit: `currentCustomerConnections < maxCustomerConnections`
    - Join customer socket to seat-specific room
    - Increment `currentCustomerConnections` by 1
    - Store FCM token if provided in connection payload
    - Update `lastUpdatedAt` for existing FCM tokens
    - Emit `customer:connect:success` with business info
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.11_
  
  - [x] 8.2 Create `handleMenuBrowsing()` function
    - Verify customer is connected to a seat
    - Verify `allowMenuBrowsing` is true for the seat
    - Forward menu category requests to POS via `pos:menu:categories:request`
    - Forward menu product requests to POS via `pos:menu:products:request`
    - Include customer socket ID in forwarded requests
    - Start 10-second timeout timer for each request
    - Emit `customer:error` if feature disabled or not connected
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [x] 8.3 Create `handleBarcodeScanning()` function
    - Verify customer is connected to a seat
    - Verify `allowBarcodeScanning` is true for the seat
    - Forward barcode scan requests to POS via `pos:product:scan:request`
    - Include barcode value and customer socket ID in request
    - Start 10-second timeout timer
    - Emit `customer:error` if feature disabled or not connected
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [x] 8.4 Create `handleCustomerDisconnection()` function
    - Retrieve connected seat identifier from socket data
    - Decrement `currentCustomerConnections` by 1
    - Persist updated connection count to database
    - Remove socket from seat-specific rooms
    - Handle cleanup even if socket data incomplete
    - Log disconnection with seat ID and connection count
    - Create file: `src/socketio/handlers/customer-app.handler.ts`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 9. Implement POS customer response handler
  - [x] 9.1 Create `handleMenuCategoriesResponse()` function
    - Extract customer socket ID from POS response payload
    - Forward menu categories data to customer via `customer:menu:categories:data`
    - Cancel timeout timer for the request
    - Discard response if customer socket no longer connected
    - _Requirements: 10.1, 10.2, 10.5, 10.6, 10.7, 11.4_
  
  - [x] 9.2 Create `handleMenuProductsResponse()` function
    - Extract customer socket ID from POS response payload
    - Forward products data to customer via `customer:menu:products:data`
    - Cancel timeout timer for the request
    - Discard response if customer socket disconnected
    - _Requirements: 10.3, 10.5, 10.6, 10.7, 11.4_
  
  - [x] 9.3 Create `handleProductScanResponse()` function
    - Extract customer socket ID from POS response payload
    - Forward product data to customer via `customer:product:data`
    - Cancel timeout timer for the request
    - Discard response if customer socket disconnected
    - Create file: `src/socketio/handlers/pos-customer-response.handler.ts`
    - _Requirements: 10.4, 10.5, 10.6, 10.7, 11.4_

- [x] 10. Register customer app handlers in Socket.IO bootstrap
  - Import customer app handler and POS response handler
  - Register customer app handlers for `clientType: "customer"` connections (no auth required)
  - Register POS response handlers for `clientType: "pos"` connections
  - Update file: `src/socketio/bootstrap.ts` or main Socket.IO initialization file
  - _Requirements: 6.1, 6.2, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 11. Create public seat information endpoint
  - [x] 11.1 Implement `getPublicSeatInfo()` controller method
    - Accept Public Seat ID as URL parameter
    - Query seat with filters: `publicSeatId`, `isActive: true`, `allowCustomerApp: true`
    - Return seat info: `publicSeatId`, `businessName`, `businessType`, `isOnline`, `currentConnections`, `maxConnections`
    - Return feature flags: `allowMenuBrowsing`, `allowBarcodeScanning`, `allowCustomerOrdering`
    - Calculate `canConnect` based on current vs max connections
    - Return 404 if seat not found, inactive, or customer app disabled
    - Return offline status if POS device not connected
    - Update file: `src/api/key-seat/controllers/key-seat.ts`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11_
  
  - [x] 11.2 Add custom route for public seat info endpoint
    - Create route: `GET /api/key-seats/public/:publicSeatId`
    - Set `auth: false` for unauthenticated access
    - Create or update file: `src/api/key-seat/routes/custom-routes.ts`
    - _Requirements: 5.1, 5.2_

- [ ] 12. Checkpoint - Verify Socket.IO handlers and endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Create FCM token cleanup cron job
  - [x] 13.1 Implement `cleanupCustomerFcmTokens()` cron job function
    - Use distributed lock with key `cleanup-customer-fcm-tokens` and TTL 300 seconds
    - Query all Key-Seat records with `customerFcmTokens` populated
    - Identify FCM tokens where `lastUpdatedAt` is older than 30 days
    - Remove tokens older than 30 days from `customerFcmTokens` array
    - Log number of tokens removed per seat and total across all seats
    - Handle errors gracefully without affecting active tokens
    - Create file: `src/cron/jobs/cleanup-customer-fcm-tokens.ts`
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10_
  
  - [x] 13.2 Register FCM token cleanup cron job
    - Add cron job to `config/cron-tasks.ts` with schedule `0 2 * * *` (daily at 2:00 AM UTC)
    - _Requirements: 20.2_

- [ ] 14. Create database migration for existing seats
  - [ ] 14.1 Implement migration script to update existing Key-Seat records
    - Generate unique Public Seat ID for seats without one
    - Set `businessType` to "retail" for seats without business type
    - Set `allowCustomerApp` to false for existing seats
    - Set `currentCustomerConnections` to 0
    - Set `maxCustomerConnections` to 50
    - Initialize `customerFcmTokens` as empty array
    - Log number of seats updated
    - Handle errors gracefully without corrupting data
    - Create file: `database/migrations/add-customer-app-fields.ts`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

- [x] 15. Add comprehensive error handling and logging
  - [x] 15.1 Implement error responses for connection errors
    - Invalid Public Seat ID: "Invalid or inactive seat ID"
    - Seat not found: "Seat not found or customer app not enabled"
    - POS offline: "POS device is currently offline"
    - Connection limit: "Connection limit reached"
    - Customer app disabled: "Customer app not enabled for this seat"
    - _Requirements: 18.1, 18.2, 18.3, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10_
  
  - [x] 15.2 Implement error responses for feature access errors
    - Menu browsing disabled: "Menu browsing not enabled"
    - Barcode scanning disabled: "Barcode scanning not enabled"
    - Customer ordering disabled: "Customer ordering not enabled"
    - Not connected: "Not connected to a seat"
    - _Requirements: 18.4, 18.5_
  
  - [x] 15.3 Implement logging for customer operations
    - Log customer connections with Public Seat ID and socket ID
    - Log connection rejections with reason
    - Log request forwarding with request type and seat identifier
    - Log response forwarding success
    - Log timeouts with request details
    - Log disconnections with connection duration
    - Log connection count changes
    - Use structured logging with timestamps
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 18.6, 18.7, 18.8_

- [x] 16. Add input validation and security measures
  - Validate Public Seat ID format before database queries
  - Sanitize customer input before forwarding to POS devices
  - Validate FCM token and device ID when provided
  - Validate barcode format and category IDs
  - Ensure internal identifiers (documentId, machineUUID) not exposed to customers
  - Ensure License Owner information not exposed to customers
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10_

- [ ] 17. Final checkpoint - Integration testing and verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks reference specific requirements for traceability
- Implementation uses TypeScript with Strapi v5 Document Service API
- Socket.IO handlers use Redis adapter for multi-replica support
- FCM token storage reuses existing `user.fcm-token` component
- Cron job uses distributed lock pattern for multi-replica safety
- Public endpoint requires no authentication by design
- Connection limits prevent resource exhaustion
- Checkpoints ensure incremental validation before proceeding
