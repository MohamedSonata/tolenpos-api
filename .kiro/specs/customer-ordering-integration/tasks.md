# Implementation Plan: Customer Ordering Integration

## Overview

This plan extends the existing customer mobile app infrastructure to support full order creation, validation, routing, and response handling. Customers place orders through their mobile devices, orders are validated and routed through the backend to the appropriate POS terminal, and responses (confirmation or errors) are forwarded back to customers.

The implementation follows a sequential approach: schema updates → event constants → validation utility → customer order handler → POS response handler → integration testing.

## Tasks

- [x] 1. Create order-request content type for tracking
  - Create directory structure: `src/api/order-request/content-types/order-request/`
  - Create schema.json with all required fields: requestId (unique), customerSocketId, publicSeatId, customerName, customerPhone, itemCount, total, deliveryType, status (enum), orderId, receiptNumber, errorCode, errorMessage
  - Set collectionName to "order_requests"
  - Disable draft/publish: `"draftAndPublish": false`
  - Enable timestamps for createdAt and updatedAt
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15_

- [x] 2. Add Socket.IO event constants for ordering
  - Add customer order event: `OnCustomerOrderCreate = "customer:order:create"`
  - Add POS order request event: `EmitPOSOrderRequest = "pos:order:create:request"`
  - Add POS order response event: `OnPOSOrderResponse = "pos:order:create:response"`
  - Add customer order response event: `EmitCustomerOrderResponse = "customer:order:create:response"`
  - Update file: `src/socketio/events_constants.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Implement order payload validation utility
  - [x] 3.1 Create validateOrderPayload function in customer-validation.ts
    - Define OrderPayload TypeScript interface with all required fields
    - Validate requestId is valid UUID format
    - Validate publicSeatId matches 6-12 uppercase alphanumeric pattern
    - Validate customer.name is 2-100 characters
    - Validate customer.phone is 10-15 digits
    - Validate deliveryType is "pickup" or "delivery"
    - Validate deliveryAddress required if deliveryType is "delivery" (10-500 characters)
    - Validate items array contains 1-50 items
    - Validate each item has productId, name, price (positive), quantity (1-99)
    - Validate subtotal, tax, total are positive numbers
    - Sanitize all string fields to remove HTML/script tags
    - Return validation result with valid boolean, error message, and sanitized payload
    - Update file: `src/api/key-seat/utils/customer-validation.ts`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10_

- [ ] 4. Checkpoint - Verify schema and validation utility
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement customer order creation handler
  - [x] 5.1 Create handleCustomerOrderCreation function
    - Verify customer is connected to a seat (check socket.data.connectedSeatId)
    - Retrieve Key-Seat by connectedSeatId with populate for license
    - Verify allowCustomerOrdering feature flag is true
    - Verify POS device is online (isConnected is true)
    - Validate order payload using validateOrderPayload utility
    - Check rate limit: last order timestamp must be > 60 seconds ago
    - Create Order_Request_Tracker with status "pending"
    - Forward order to POS via `io.to(pos:${keySeatDocumentId})` room
    - Include customerSocketId, requestId, and complete order payload
    - Start 30-second timeout timer and store in socket.data
    - Update socket.data.lastOrderTimestamp to current time
    - Handle all error cases: NOT_CONNECTED, FEATURE_DISABLED, POS_OFFLINE, INVALID_PAYLOAD, RATE_LIMIT_EXCEEDED
    - Log order received, forwarded, and any rejections
    - Update file: `src/socketio/handlers/customer-app.handler.ts`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 14.11, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10_

- [x] 6. Implement POS order response handler
  - [x] 6.1 Create handlePOSOrderResponse function
    - Extract customerSocketId and requestId from POS response payload
    - Cancel timeout timer using requestId (clear from socket.data)
    - Validate response structure: success field required
    - If success is true, validate order object with id, receiptNumber, status, total
    - If success is false, validate error object with code and message
    - Update Order_Request_Tracker record by requestId
    - If success, set status to "completed", orderId, receiptNumber
    - If failure, set status to "failed", errorCode, errorMessage
    - Sanitize response to remove sensitive POS data (documentId, machineUUID, licenseKey, tokens)
    - Forward sanitized response to customer via `io.to(customerSocketId)`
    - Handle disconnected customer sockets gracefully (discard response, log event)
    - Log response received, tracker updated, and forwarding success
    - Update file: `src/socketio/handlers/pos-customer-response.handler.ts`
    - _Requirements: 8.9, 8.10, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13, 9.14, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 13.8, 13.9, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10_

- [x] 7. Register order handlers in Socket.IO bootstrap
  - Import handleCustomerOrderCreation from customer-app.handler.ts
  - Import handlePOSOrderResponse from pos-customer-response.handler.ts
  - Register customer order handler for event "customer:order:create" on clientType "customer" connections
  - Register POS response handler for event "pos:order:create:response" on clientType "pos" connections
  - Update file: `src/socketio/bootstrap.ts` or main Socket.IO initialization file
  - _Requirements: 2.1, 2.3, 16.1, 16.2, 17.1, 17.2_

- [x] 8. Extend customer disconnect handler for order cleanup
  - Check socket.data for pending order timeout timers (keys starting with "timeout:order:")
  - Cancel all timeout timers associated with the disconnecting socket
  - Clear timeout timer references from socket.data
  - Log cleanup with socket ID and number of timers cleared
  - Do not update Order_Request_Tracker status (let timeout handler do it)
  - Update file: `src/socketio/handlers/customer-app.handler.ts`
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [ ] 9. Final checkpoint - Integration testing and verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks reference specific requirements for traceability
- Implementation uses TypeScript with Strapi v5 Document Service API
- Socket.IO handlers use Redis adapter for multi-replica support
- Order tracking persisted to database for cross-replica visibility
- Rate limiting: 1 order per 60 seconds per customer socket
- Timeout handling: 30-second timer with cleanup on response or disconnect
- Multi-replica support: Use io.to() for routing responses across replicas
- Response sanitization: Remove sensitive fields before forwarding to customers
- Checkpoints ensure incremental validation before proceeding
