# Requirements Document: Customer Ordering Integration

## Introduction

This document specifies requirements for enabling customers to place orders directly from their mobile devices through the Customer Mobile App, with orders routed through the backend to the appropriate POS terminal for processing. This feature extends the existing customer app infrastructure (connection management, menu browsing, barcode scanning) to support full order creation, validation, routing, and response handling.

The system must handle order requests with customer information, line items with addons, delivery preferences, and payment totals. Orders are validated by the backend, routed to the connected POS device, processed by the POS, and responses are forwarded back to the customer with order confirmation or error details. The implementation must support multi-replica deployments, handle timeouts gracefully, and persist order requests for analytics and debugging.

## Glossary

- **Backend**: The Strapi v5 POS license management system with Socket.IO server
- **Customer_App**: The mobile application used by end-customers to browse menus and place orders
- **POS_Device**: A physical point-of-sale device running the POS application (one Key-Seat)
- **Order_Request**: A customer's request to create an order, including items, customer info, and totals
- **Request_ID**: A unique identifier (UUID) for tracking an order request through the system
- **Customer_Socket_ID**: The Socket.IO socket ID used to route responses back to the requesting customer
- **Order_Request_Tracker**: A Strapi content type storing order request metadata for analytics
- **Delivery_Type**: The order fulfillment method (pickup or delivery)
- **Order_Timeout**: The maximum time (30 seconds) to wait for POS response before failing the request
- **Public_Seat_ID**: A customer-facing unique identifier for connecting to a specific POS device
- **Key_Seat**: A Strapi entity representing an activated POS device
- **Order_Payload**: The complete order data structure sent from customer to POS
- **Order_Response**: The POS response containing order confirmation or error details
- **Multi_Replica_Deployment**: Docker Swarm environment with multiple backend instances using Redis adapter
- **Distributed_Lock**: Redis-based locking mechanism to prevent duplicate processing across replicas

## Requirements

### Requirement 1: Order Request Content Type

**User Story:** As a system administrator, I want order requests stored in the database, so that I can analyze order patterns, debug issues, and monitor system health.

#### Acceptance Criteria

1. THE Backend SHALL create an Order_Request_Tracker content type with collectionName "order_requests"
2. THE Order_Request_Tracker SHALL include a requestId field (string, unique, required)
3. THE Order_Request_Tracker SHALL include a customerSocketId field (string, required)
4. THE Order_Request_Tracker SHALL include a publicSeatId field (string, required)
5. THE Order_Request_Tracker SHALL include a customerName field (string, required)
6. THE Order_Request_Tracker SHALL include a customerPhone field (string, required)
7. THE Order_Request_Tracker SHALL include an itemCount field (integer, required)
8. THE Order_Request_Tracker SHALL include a total field (decimal, required)
9. THE Order_Request_Tracker SHALL include a status field (enumeration: pending, completed, failed, timeout)
10. THE Order_Request_Tracker SHALL include an orderId field (string, optional)
11. THE Order_Request_Tracker SHALL include a receiptNumber field (string, optional)
12. THE Order_Request_Tracker SHALL include an errorCode field (string, optional)
13. THE Order_Request_Tracker SHALL include an errorMessage field (text, optional)
14. THE Order_Request_Tracker SHALL include a deliveryType field (enumeration: pickup, delivery)
15. THE Order_Request_Tracker SHALL include timestamps (createdAt, updatedAt)

---

### Requirement 2: Socket.IO Event Constants for Ordering

**User Story:** As a developer, I want all order-related Socket.IO event names defined as constants, so that event names are consistent and typo-free across the codebase.

#### Acceptance Criteria

1. THE Backend SHALL define a constant "customer:order:create" for customer order creation requests
2. THE Backend SHALL define a constant "pos:order:create:request" for forwarding orders to POS
3. THE Backend SHALL define a constant "pos:order:create:response" for POS order responses
4. THE Backend SHALL define a constant "customer:order:create:response" for customer order confirmations
5. THE Backend SHALL use these constants in all order-related Socket.IO event handlers

---

### Requirement 3: Order Payload Validation

**User Story:** As a system administrator, I want order payloads validated before processing, so that invalid or malicious data is rejected early.

#### Acceptance Criteria

1. WHEN an order request is received, THE Backend SHALL validate the requestId is a valid UUID
2. WHEN an order request is received, THE Backend SHALL validate the publicSeatId matches the pattern for public seat identifiers
3. WHEN an order request is received, THE Backend SHALL validate customer name is 2-100 characters
4. WHEN an order request is received, THE Backend SHALL validate customer phone matches pattern for phone numbers (10-15 digits)
5. WHEN an order request is received, THE Backend SHALL validate deliveryType is either "pickup" or "delivery"
6. IF deliveryType is "delivery", THEN THE Backend SHALL validate deliveryAddress is provided and 10-500 characters
7. WHEN an order request is received, THE Backend SHALL validate items array contains 1-50 items
8. FOR each item, THE Backend SHALL validate productId, name, price, and quantity are provided
9. FOR each item, THE Backend SHALL validate quantity is an integer between 1 and 99
10. FOR each item, THE Backend SHALL validate price is a positive number
11. WHEN an order request is received, THE Backend SHALL validate subtotal, tax, and total are positive numbers
12. WHEN an order request is received, THE Backend SHALL sanitize all string fields to prevent injection attacks
13. IF validation fails, THEN THE Backend SHALL emit "customer:error" with validation error message
14. IF validation fails, THEN THE Backend SHALL not create an Order_Request_Tracker record
15. IF validation fails, THEN THE Backend SHALL not forward the request to the POS_Device

---

### Requirement 4: POS Online Validation

**User Story:** As an end-customer, I want to know immediately if the restaurant is offline, so that I don't wait for an order that cannot be processed.

#### Acceptance Criteria

1. WHEN an order request is received, THE Backend SHALL verify the customer is connected to a seat
2. WHEN an order request is received, THE Backend SHALL retrieve the Key_Seat by the customer's connected seat ID
3. WHEN an order request is received, THE Backend SHALL verify the Key_Seat has isConnected set to true
4. IF the Key_Seat has isConnected set to false, THEN THE Backend SHALL emit "customer:order:create:response" with success false
5. IF the POS_Device is offline, THEN THE Backend SHALL include error code "POS_OFFLINE"
6. IF the POS_Device is offline, THEN THE Backend SHALL include error message "Restaurant is currently offline"
7. IF the POS_Device is offline, THEN THE Backend SHALL not create an Order_Request_Tracker record
8. IF the POS_Device is offline, THEN THE Backend SHALL log the rejection with reason "POS offline"

---

### Requirement 5: Feature Flag Validation for Ordering

**User Story:** As a license owner, I want ordering disabled if my subscription plan doesn't include it, so that customers cannot place orders when the feature is not enabled.

#### Acceptance Criteria

1. WHEN an order request is received, THE Backend SHALL verify the customer is connected to a seat
2. WHEN an order request is received, THE Backend SHALL check the allowCustomerOrdering flag on the connected Key_Seat
3. IF allowCustomerOrdering is false, THEN THE Backend SHALL emit "customer:error" with message "Customer ordering not enabled"
4. IF allowCustomerOrdering is false, THEN THE Backend SHALL not create an Order_Request_Tracker record
5. IF allowCustomerOrdering is false, THEN THE Backend SHALL not forward the request to the POS_Device
6. IF allowCustomerOrdering is false, THEN THE Backend SHALL log the rejection with reason "Feature disabled"

---

### Requirement 6: Order Request Tracking Creation

**User Story:** As a system administrator, I want every order request logged to the database, so that I can track order volume and debug issues.

#### Acceptance Criteria

1. WHEN an order request passes validation, THE Backend SHALL create an Order_Request_Tracker record
2. WHEN creating the tracker, THE Backend SHALL set requestId from the order payload
3. WHEN creating the tracker, THE Backend SHALL set customerSocketId from the order payload
4. WHEN creating the tracker, THE Backend SHALL set publicSeatId from the customer's connected seat
5. WHEN creating the tracker, THE Backend SHALL set customerName from the order payload
6. WHEN creating the tracker, THE Backend SHALL set customerPhone from the order payload
7. WHEN creating the tracker, THE Backend SHALL set itemCount from the items array length
8. WHEN creating the tracker, THE Backend SHALL set total from the order payload
9. WHEN creating the tracker, THE Backend SHALL set deliveryType from the order payload
10. WHEN creating the tracker, THE Backend SHALL set status to "pending"
11. WHEN creating the tracker, THE Backend SHALL set orderId, receiptNumber, errorCode, and errorMessage to null
12. IF tracker creation fails, THEN THE Backend SHALL log the error and continue processing the order

---

### Requirement 7: Order Routing to POS Device

**User Story:** As an end-customer, I want my order sent to the correct restaurant, so that my order is processed by the right location.

#### Acceptance Criteria

1. WHEN an order request passes validation, THE Backend SHALL forward the order to the POS_Device
2. WHEN forwarding the order, THE Backend SHALL emit "pos:order:create:request" to the POS room
3. THE Backend SHALL route the order to room "pos:{keySeatDocumentId}"
4. WHEN forwarding the order, THE Backend SHALL include customerSocketId for response routing
5. WHEN forwarding the order, THE Backend SHALL include requestId for tracking
6. WHEN forwarding the order, THE Backend SHALL include publicSeatId for POS reference
7. WHEN forwarding the order, THE Backend SHALL include complete customer object (name, phone, deliveryAddress, deliveryType)
8. WHEN forwarding the order, THE Backend SHALL include complete items array with all product details
9. WHEN forwarding the order, THE Backend SHALL include orderNote if provided
10. WHEN forwarding the order, THE Backend SHALL include subtotal, tax, and total
11. WHEN forwarding the order, THE Backend SHALL include timestamp
12. THE Backend SHALL log the forwarded order with requestId, publicSeatId, itemCount, and total

---

### Requirement 8: Order Request Timeout Handling

**User Story:** As an end-customer, I want to receive a timeout notification if the restaurant doesn't respond within 30 seconds, so that I know my order failed and can retry.

#### Acceptance Criteria

1. WHEN an order is forwarded to a POS_Device, THE Backend SHALL start a 30-second timeout timer
2. THE Backend SHALL store the timeout timer ID in socket data with key "timeout:order:{requestId}"
3. IF the POS_Device does not respond within 30 seconds, THEN THE Backend SHALL emit "customer:order:create:response" to the customer
4. WHEN a timeout occurs, THE Backend SHALL include success false in the response
5. WHEN a timeout occurs, THE Backend SHALL include error code "TIMEOUT"
6. WHEN a timeout occurs, THE Backend SHALL include error message "Order request timed out"
7. WHEN a timeout occurs, THE Backend SHALL update the Order_Request_Tracker status to "timeout"
8. WHEN a timeout occurs, THE Backend SHALL log the timeout with requestId and publicSeatId
9. WHEN a POS response is received before timeout, THE Backend SHALL cancel the timeout timer
10. WHEN canceling the timeout, THE Backend SHALL clear the timer from socket data

---

### Requirement 9: POS Order Response Handling

**User Story:** As a backend system, I want to receive order responses from POS devices and forward them to customers, so that customers receive order confirmation or error details.

#### Acceptance Criteria

1. WHEN a POS_Device emits "pos:order:create:response", THE Backend SHALL extract customerSocketId from the payload
2. WHEN a POS response is received, THE Backend SHALL extract requestId from the payload
3. WHEN a POS response is received, THE Backend SHALL cancel the timeout timer for that requestId
4. WHEN a POS response is received, THE Backend SHALL validate the response contains success field
5. IF success is true, THEN THE Backend SHALL validate the response contains order object
6. IF success is true, THEN THE Backend SHALL validate order object contains id, receiptNumber, status, and total
7. IF success is false, THEN THE Backend SHALL validate the response contains error object
8. IF success is false, THEN THE Backend SHALL validate error object contains code and message
9. WHEN a POS response is received, THE Backend SHALL update the Order_Request_Tracker record
10. IF success is true, THEN THE Backend SHALL set status to "completed", orderId, and receiptNumber
11. IF success is false, THEN THE Backend SHALL set status to "failed", errorCode, and errorMessage
12. WHEN a POS response is received, THE Backend SHALL forward the response to the customer via customerSocketId
13. THE Backend SHALL emit "customer:order:create:response" to the customer socket
14. THE Backend SHALL log successful response forwarding with requestId, success status, and orderId

---

### Requirement 10: Customer Order Response Forwarding

**User Story:** As an end-customer, I want to receive order confirmation with receipt number and estimated time, so that I know my order was accepted.

#### Acceptance Criteria

1. WHEN forwarding a successful order response, THE Backend SHALL include success true
2. WHEN forwarding a successful order response, THE Backend SHALL include requestId
3. WHEN forwarding a successful order response, THE Backend SHALL include order object with id, receiptNumber, status, total
4. WHEN forwarding a successful order response, THE Backend SHALL include estimatedTime if provided by POS
5. WHEN forwarding a successful order response, THE Backend SHALL include timestamp
6. WHEN forwarding a failed order response, THE Backend SHALL include success false
7. WHEN forwarding a failed order response, THE Backend SHALL include requestId
8. WHEN forwarding a failed order response, THE Backend SHALL include error object with code and message
9. WHEN forwarding a failed order response, THE Backend SHALL include timestamp
10. THE Backend SHALL sanitize all response data to remove sensitive POS information before forwarding
11. THE Backend SHALL not expose internal identifiers (documentId, machineUUID, licenseKey) to customers
12. IF the customer socket is no longer connected, THEN THE Backend SHALL discard the response and log the event

---

### Requirement 11: Order Request Error Handling

**User Story:** As an end-customer, I want clear error messages when my order fails, so that I understand what went wrong and can take corrective action.

#### Acceptance Criteria

1. IF the customer is not connected to a seat, THEN THE Backend SHALL return error "Not connected to a seat"
2. IF allowCustomerOrdering is false, THEN THE Backend SHALL return error "Customer ordering not enabled"
3. IF the POS_Device is offline, THEN THE Backend SHALL return error code "POS_OFFLINE" with message "Restaurant is currently offline"
4. IF validation fails, THEN THE Backend SHALL return error with specific validation failure reason
5. IF the order times out, THEN THE Backend SHALL return error code "TIMEOUT" with message "Order request timed out"
6. IF the POS returns an error, THEN THE Backend SHALL forward the POS error code and message to the customer
7. IF an unexpected error occurs, THEN THE Backend SHALL return error code "ROUTING_ERROR" with message "Failed to process order"
8. WHEN an error occurs, THE Backend SHALL log detailed error information for debugging
9. WHEN an error occurs, THE Backend SHALL not expose internal error details or stack traces to customers
10. THE Backend SHALL use consistent error response format with code, message, and timestamp fields

---

### Requirement 12: Multi-Replica Order Routing

**User Story:** As a system administrator, I want order routing to work across multiple backend replicas, so that the system scales horizontally in production.

#### Acceptance Criteria

1. THE Backend SHALL use Socket.IO rooms for routing orders to POS devices
2. WHEN a customer connects to replica A, THE Backend SHALL allow orders to be routed to POS on replica B
3. WHEN a POS response is received on replica B, THE Backend SHALL forward the response to customer on replica A
4. THE Backend SHALL use Redis adapter to broadcast events across all replicas
5. THE Backend SHALL persist Order_Request_Tracker records to the database for cross-replica visibility
6. THE Backend SHALL use customerSocketId with io.to() for cross-replica response routing
7. THE Backend SHALL not rely on in-memory state for order tracking
8. THE Backend SHALL handle timeout timers correctly even if customer and POS are on different replicas

---

### Requirement 13: Order Request Security and Sanitization

**User Story:** As a system administrator, I want order data sanitized before forwarding to POS, so that malicious input cannot compromise the POS system.

#### Acceptance Criteria

1. WHEN validating order payloads, THE Backend SHALL sanitize all string fields to remove HTML tags
2. WHEN validating order payloads, THE Backend SHALL sanitize all string fields to remove script tags
3. WHEN validating order payloads, THE Backend SHALL sanitize all string fields to remove SQL injection patterns
4. WHEN validating order payloads, THE Backend SHALL limit string field lengths to prevent buffer overflow
5. WHEN validating order payloads, THE Backend SHALL validate numeric fields are within reasonable ranges
6. WHEN validating order payloads, THE Backend SHALL reject payloads with unexpected additional fields
7. WHEN forwarding orders to POS, THE Backend SHALL only include validated and sanitized fields
8. WHEN forwarding responses to customers, THE Backend SHALL remove sensitive POS fields (token, licenseKey, machineUUID)
9. THE Backend SHALL log security validation failures with details for monitoring
10. THE Backend SHALL rate-limit order requests to prevent abuse (maximum 1 order per minute per customer)

---

### Requirement 14: Order Request Monitoring and Logging

**User Story:** As a system administrator, I want comprehensive logging of order requests and responses, so that I can monitor system health and troubleshoot issues.

#### Acceptance Criteria

1. WHEN an order request is received, THE Backend SHALL log the requestId, publicSeatId, customerName, itemCount, and total
2. WHEN validation fails, THE Backend SHALL log the validation error with requestId and reason
3. WHEN a POS is offline, THE Backend SHALL log the rejection with requestId and publicSeatId
4. WHEN an order is forwarded to POS, THE Backend SHALL log the forwarding with requestId and timestamp
5. WHEN a POS response is received, THE Backend SHALL log the response with requestId, success status, and orderId
6. WHEN a timeout occurs, THE Backend SHALL log the timeout with requestId, publicSeatId, and timeout duration
7. WHEN a response is forwarded to customer, THE Backend SHALL log the forwarding with requestId and customerSocketId
8. WHEN an error occurs, THE Backend SHALL log the error with requestId, error message, and stack trace
9. THE Backend SHALL include timestamps in all order-related log entries
10. THE Backend SHALL use structured logging format for easy parsing and analysis
11. THE Backend SHALL not log sensitive customer information (full phone numbers, addresses) in plain text

---

### Requirement 15: Order Request Analytics Queries

**User Story:** As a system administrator, I want to query order request data for analytics, so that I can understand order patterns and system performance.

#### Acceptance Criteria

1. THE Backend SHALL provide a query to retrieve all order requests for a specific publicSeatId
2. THE Backend SHALL provide a query to retrieve order requests by status (pending, completed, failed, timeout)
3. THE Backend SHALL provide a query to retrieve order requests within a date range
4. THE Backend SHALL provide a query to calculate total order count per publicSeatId
5. THE Backend SHALL provide a query to calculate success rate (completed / total) per publicSeatId
6. THE Backend SHALL provide a query to calculate average order total per publicSeatId
7. THE Backend SHALL provide a query to identify orders that timed out
8. THE Backend SHALL provide a query to retrieve orders by errorCode for debugging
9. THE Backend SHALL support pagination for order request queries (page, limit parameters)
10. THE Backend SHALL support sorting order requests by createdAt, total, or status

---

### Requirement 16: Customer Order Creation Handler

**User Story:** As a backend system, I want a dedicated handler for customer order creation, so that order logic is organized and maintainable.

#### Acceptance Criteria

1. THE Backend SHALL create a handleCustomerOrderCreation function in customer-app.handler.ts
2. THE function SHALL be registered for event "customer:order:create"
3. THE function SHALL validate the customer is connected to a seat
4. THE function SHALL validate allowCustomerOrdering feature flag
5. THE function SHALL validate the POS_Device is online
6. THE function SHALL validate the order payload
7. THE function SHALL create an Order_Request_Tracker record
8. THE function SHALL forward the order to the POS_Device
9. THE function SHALL start a 30-second timeout timer
10. THE function SHALL handle all error cases with appropriate error responses
11. THE function SHALL log all significant events (validation, forwarding, errors)

---

### Requirement 17: POS Order Response Handler

**User Story:** As a backend system, I want a dedicated handler for POS order responses, so that response logic is organized and maintainable.

#### Acceptance Criteria

1. THE Backend SHALL create a handlePOSOrderResponse function in pos-customer-response.handler.ts
2. THE function SHALL be registered for event "pos:order:create:response"
3. THE function SHALL extract customerSocketId and requestId from the payload
4. THE function SHALL cancel the timeout timer for the requestId
5. THE function SHALL validate the response structure
6. THE function SHALL update the Order_Request_Tracker record with response data
7. THE function SHALL sanitize the response to remove sensitive POS data
8. THE function SHALL forward the response to the customer via customerSocketId
9. THE function SHALL handle cases where the customer socket is disconnected
10. THE function SHALL log all significant events (response received, tracker updated, forwarded)

---

### Requirement 18: Order Request Cleanup on Customer Disconnect

**User Story:** As a system administrator, I want pending order requests cleaned up when customers disconnect, so that timeout timers don't accumulate in memory.

#### Acceptance Criteria

1. WHEN a customer socket disconnects, THE Backend SHALL check for pending order timeout timers
2. WHEN a customer disconnects, THE Backend SHALL cancel all timeout timers associated with that socket
3. WHEN a customer disconnects, THE Backend SHALL clear timeout timer references from socket data
4. WHEN a customer disconnects, THE Backend SHALL log the cleanup with socket ID and number of timers cleared
5. THE Backend SHALL handle disconnection cleanup even if socket data is incomplete
6. THE Backend SHALL not update Order_Request_Tracker status when cleaning up timers (let timeout handler do it)

---

### Requirement 19: Order Request Validation Utility

**User Story:** As a developer, I want a reusable validation utility for order payloads, so that validation logic is consistent and testable.

#### Acceptance Criteria

1. THE Backend SHALL create a validateOrderPayload function in customer-validation.ts
2. THE function SHALL accept an order payload object as input
3. THE function SHALL return a validation result with valid boolean and sanitized payload
4. THE function SHALL validate all required fields are present
5. THE function SHALL validate field types and formats
6. THE function SHALL validate field lengths and ranges
7. THE function SHALL sanitize string fields to remove malicious content
8. THE function SHALL return specific error messages for each validation failure
9. THE function SHALL be exported for use in customer-app.handler.ts
10. THE function SHALL include TypeScript type definitions for order payload structure

---

### Requirement 20: Order Request Rate Limiting

**User Story:** As a system administrator, I want order requests rate-limited per customer, so that the system is protected from abuse and spam.

#### Acceptance Criteria

1. THE Backend SHALL track order request timestamps per customer socket ID
2. WHEN an order request is received, THE Backend SHALL check the last order timestamp for that socket
3. IF the last order was less than 60 seconds ago, THEN THE Backend SHALL reject the request
4. WHEN rate limit is exceeded, THE Backend SHALL emit "customer:error" with error code "RATE_LIMIT_EXCEEDED"
5. WHEN rate limit is exceeded, THE Backend SHALL include error message "Please wait before placing another order"
6. WHEN rate limit is exceeded, THE Backend SHALL log the rejection with socket ID and timestamp
7. THE Backend SHALL store rate limit data in socket data (not Redis) for simplicity
8. WHEN a customer disconnects, THE Backend SHALL clear rate limit data for that socket
9. THE Backend SHALL allow order requests after 60 seconds have elapsed since the last order
10. THE Backend SHALL not count failed validation or offline POS rejections toward rate limit

---

## Implementation Notes

### Parser and Serializer Requirements

This feature does not require custom parsers or serializers. All data exchange uses JSON format via Socket.IO, which handles serialization automatically.

### Round-Trip Properties

Not applicable - this feature focuses on request-response flow rather than data transformation.

### Critical Integration Points

1. **Customer App Handler**: Extend src/socketio/handlers/customer-app.handler.ts with order creation handler
2. **POS Response Handler**: Extend src/socketio/handlers/pos-customer-response.handler.ts with order response handler
3. **Event Constants**: Add order-related events to src/socketio/events_constants.ts
4. **Validation Utility**: Create validateOrderPayload in src/api/key-seat/utils/customer-validation.ts
5. **Order Request Tracker**: Create new Strapi content type in src/api/order-request/
6. **Socket.IO Bootstrap**: Register order handlers for clientType "customer" and "pos"
7. **Multi-Replica Support**: Use io.to() for cross-replica routing with Redis adapter

### Order Flow Summary

```
Customer App → Backend (validate customer connected, feature enabled, POS online)
            → Backend (validate order payload, sanitize data)
            → Backend (create Order_Request_Tracker with status "pending")
            → Backend (forward to POS via room, start 30s timeout)
            → POS Device (process order)
            → Backend (receive response, cancel timeout, update tracker)
            → Backend (sanitize response, forward to customer)
            → Customer App (display confirmation or error)

Timeout Path:
            → Backend (30s timeout expires)
            → Backend (update tracker status to "timeout")
            → Backend (emit timeout error to customer)
            → Customer App (display timeout error)
```

### Error Code Reference

| Error Code | Message | Cause |
|------------|---------|-------|
| NOT_CONNECTED | Not connected to a seat | Customer not connected via customer:connect |
| FEATURE_DISABLED | Customer ordering not enabled | allowCustomerOrdering is false |
| POS_OFFLINE | Restaurant is currently offline | POS isConnected is false |
| INVALID_PAYLOAD | Invalid order data | Validation failed |
| TIMEOUT | Order request timed out | POS did not respond within 30 seconds |
| ROUTING_ERROR | Failed to process order | Unexpected backend error |
| RATE_LIMIT_EXCEEDED | Please wait before placing another order | Order request within 60 seconds of previous |

### Timeout Configuration

- **Menu/Barcode Requests**: 10 seconds (existing)
- **Order Requests**: 30 seconds (new, longer due to order complexity)
- Timeout duration is longer for orders because POS must validate inventory, calculate totals, and potentially interact with payment systems

### Database Schema Notes

The Order_Request_Tracker content type should be created as a standard Strapi collection type with the following characteristics:
- Enable draft/publish: false (orders are always published)
- Enable timestamps: true (createdAt, updatedAt)
- API permissions: Admin only (customers should not query order history directly)
- Indexes: requestId (unique), publicSeatId, status, createdAt for query performance

### Security Considerations

1. **Input Sanitization**: All customer-provided strings must be sanitized to prevent XSS and injection attacks
2. **Rate Limiting**: Prevent order spam by limiting to 1 order per minute per customer
3. **POS Validation**: Always verify POS is online before forwarding orders
4. **Response Sanitization**: Remove sensitive POS data (tokens, keys, UUIDs) before forwarding to customers
5. **Timeout Protection**: 30-second timeout prevents indefinite waiting and resource exhaustion
6. **Feature Flag Enforcement**: Respect allowCustomerOrdering flag to prevent unauthorized ordering

### Monitoring and Alerting

Recommended metrics to track:
- Order request rate per publicSeatId
- Order success rate (completed / total)
- Order timeout rate
- Average order processing time (request to response)
- Error rate by error code
- POS offline rejection rate

Alert conditions:
- Timeout rate > 10% (indicates POS performance issues)
- Error rate > 20% (indicates system issues)
- POS offline rate > 50% (indicates connectivity issues)
