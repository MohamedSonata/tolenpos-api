# Requirements Document: Customer Mobile App Integration

## Introduction

This document specifies requirements for adding customer-facing mobile app support to the Strapi v5 POS license management backend. The feature enables end-customers (restaurant patrons, retail shoppers, cafe customers, pharmacy clients) to connect to specific POS devices via Socket.IO for real-time interactions including menu browsing, barcode scanning, and order placement.

The system must support multiple business types (restaurant, retail, cafe, pharmacy) with subscription plan-based feature flags controlling customer app capabilities. Each POS seat will have a unique public identifier for customer connections, separate from internal system identifiers for security.

## Glossary

- **Backend**: The Strapi v5 POS license management system
- **POS_Device**: A physical point-of-sale device running the POS application (one Key-Seat)
- **Customer_App**: The mobile application used by end-customers to interact with POS devices
- **Public_Seat_ID**: A customer-facing unique identifier for connecting to a specific POS device (e.g., "REST42A", "CAFE001")
- **Subscription_Plan**: A plan entity defining feature access and limits for license owners
- **Key_Seat**: A Strapi entity representing an activated POS device
- **License_Owner**: A user who owns licenses and manages POS devices
- **End_Customer**: A patron/shopper using the Customer_App to interact with a POS device
- **Business_Type**: The category of business (restaurant, retail, cafe, pharmacy, other)
- **Socket_IO_Connection**: A real-time bidirectional communication channel
- **Feature_Flag**: A boolean configuration controlling access to specific capabilities
- **Connection_Limit**: Maximum number of concurrent customer connections per seat
- **Request_Response_Flow**: Customer → Backend → POS → Backend → Customer communication pattern
- **FCM_Token**: Firebase Cloud Messaging token used for push notifications to customer devices
- **Customer_FCM_Tokens**: A repeatable component storing FCM tokens for customers connected to a seat

## Requirements

### Requirement 1: Subscription Plan Feature Configuration

**User Story:** As a License_Owner, I want my subscription plan to define customer app capabilities, so that I can offer different service levels to my customers based on my plan tier.

#### Acceptance Criteria

1. THE Subscription_Plan SHALL include an allowCustomerApp feature flag with default value false
2. THE Subscription_Plan SHALL include an allowMenuBrowsing feature flag with default value false
3. THE Subscription_Plan SHALL include an allowBarcodeScanning feature flag with default value false
4. THE Subscription_Plan SHALL include an allowCustomerOrdering feature flag with default value false
5. THE Subscription_Plan SHALL include a maxCustomerConnectionsPerSeat field with default value 50
6. WHEN a Subscription_Plan is queried, THE Backend SHALL return all customer app feature flags
7. THE Backend SHALL validate that maxCustomerConnectionsPerSeat is an integer between 1 and 500

---

### Requirement 2: Public Seat Identifier Generation

**User Story:** As a License_Owner, I want each POS device to have a unique customer-friendly identifier, so that my customers can easily connect to the correct location.

#### Acceptance Criteria

1. WHEN a Key_Seat is created, THE Backend SHALL generate a unique Public_Seat_ID
2. THE Public_Seat_ID SHALL be 6 to 12 uppercase alphanumeric characters
3. THE Public_Seat_ID SHALL include a business type prefix (REST for restaurant, RETL for retail, CAFE for cafe, PHRM for pharmacy, SEAT for other)
4. THE Backend SHALL verify Public_Seat_ID uniqueness across all seats before assignment
5. IF a Public_Seat_ID collision is detected, THEN THE Backend SHALL regenerate a new identifier
6. THE Backend SHALL attempt up to 10 generation retries before returning an error
7. THE Public_Seat_ID SHALL be stored in the Key_Seat entity with unique constraint

---

### Requirement 3: Key-Seat Customer App Configuration

**User Story:** As a License_Owner, I want my POS devices to inherit customer app settings from my subscription plan, so that features are automatically configured during activation.

#### Acceptance Criteria

1. THE Key_Seat SHALL include a publicSeatId field with unique constraint
2. THE Key_Seat SHALL include a businessName field for display purposes
3. THE Key_Seat SHALL include a businessType field with enumeration (restaurant, retail, cafe, pharmacy, other)
4. THE Key_Seat SHALL include an allowCustomerApp feature flag
5. THE Key_Seat SHALL include an allowMenuBrowsing feature flag
6. THE Key_Seat SHALL include an allowBarcodeScanning feature flag
7. THE Key_Seat SHALL include an allowCustomerOrdering feature flag
8. THE Key_Seat SHALL include a maxCustomerConnections field
9. THE Key_Seat SHALL include a currentCustomerConnections field with default value 0
10. THE Key_Seat SHALL include a customerFcmTokens field as a repeatable component using the FCM-Token component
11. WHEN a license is activated, THE Backend SHALL copy customer app feature flags from the Subscription_Plan to the Key_Seat
12. WHEN a license is activated, THE Backend SHALL set currentCustomerConnections to 0
13. WHEN a license is activated, THE Backend SHALL initialize customerFcmTokens as an empty array

---

### Requirement 4: License Activation Integration

**User Story:** As a License_Owner, I want customer app features configured automatically when I activate a POS device, so that I don't need manual setup.

#### Acceptance Criteria

1. WHEN a license activation request is received, THE Backend SHALL retrieve the License_Owner's Subscription_Plan
2. WHEN creating a Key_Seat during activation, THE Backend SHALL generate a unique Public_Seat_ID
3. WHEN creating a Key_Seat during activation, THE Backend SHALL copy allowCustomerApp from the Subscription_Plan
4. WHEN creating a Key_Seat during activation, THE Backend SHALL copy allowMenuBrowsing from the Subscription_Plan
5. WHEN creating a Key_Seat during activation, THE Backend SHALL copy allowBarcodeScanning from the Subscription_Plan
6. WHEN creating a Key_Seat during activation, THE Backend SHALL copy allowCustomerOrdering from the Subscription_Plan
7. WHEN creating a Key_Seat during activation, THE Backend SHALL copy maxCustomerConnectionsPerSeat from the Subscription_Plan to maxCustomerConnections
8. WHEN license activation succeeds, THE Backend SHALL return the Public_Seat_ID in the response
9. WHEN license activation succeeds, THE Backend SHALL return the businessName in the response
10. WHEN license activation succeeds, THE Backend SHALL return the businessType in the response
11. WHEN license activation succeeds, THE Backend SHALL return the allowCustomerApp status in the response

---

### Requirement 5: Public Seat Information Endpoint

**User Story:** As an End_Customer, I want to check if a POS device is online and accepting connections before connecting, so that I know if the service is available.

#### Acceptance Criteria

1. THE Backend SHALL provide a public API endpoint at /api/key-seats/public/:publicSeatId
2. THE Backend SHALL allow unauthenticated access to the public seat information endpoint
3. WHEN a valid Public_Seat_ID is provided, THE Backend SHALL return seat information
4. THE Backend SHALL return publicSeatId, businessName, businessType, isOnline status, currentConnections, and maxConnections
5. THE Backend SHALL return feature flags (allowMenuBrowsing, allowBarcodeScanning, allowCustomerOrdering)
6. THE Backend SHALL return canConnect status based on current versus maximum connections
7. IF the Public_Seat_ID does not exist, THEN THE Backend SHALL return a 404 not found error
8. IF the seat has allowCustomerApp set to false, THEN THE Backend SHALL return a not found error
9. IF the seat is not active, THEN THE Backend SHALL return a not found error
10. IF the POS_Device is offline, THEN THE Backend SHALL return success false with offline status
11. THE Backend SHALL filter queries to only return seats where isActive is true and allowCustomerApp is true

---

### Requirement 6: Customer Socket.IO Connection

**User Story:** As an End_Customer, I want to connect to a specific POS device using its public identifier, so that I can interact with that location in real-time.

#### Acceptance Criteria

1. THE Backend SHALL accept Socket.IO connections with clientType set to "customer"
2. WHEN a customer connection is received, THE Backend SHALL not require authentication
3. WHEN a customer emits a "customer:connect" event with a Public_Seat_ID, THE Backend SHALL validate the identifier
4. THE Backend SHALL verify the Public_Seat_ID exists and the seat is active
5. THE Backend SHALL verify the seat has allowCustomerApp set to true
6. THE Backend SHALL verify the POS_Device is currently connected (isConnected is true)
7. THE Backend SHALL verify currentCustomerConnections is less than maxCustomerConnections
8. IF validation succeeds, THEN THE Backend SHALL join the customer socket to a seat-specific room
9. IF validation succeeds, THEN THE Backend SHALL increment currentCustomerConnections by 1
10. IF validation succeeds, THEN THE Backend SHALL emit "customer:connect:success" with businessName and businessType
11. IF validation fails, THEN THE Backend SHALL emit "customer:connect:success" with success false and error message
12. THE Backend SHALL store the connected seat identifier in the socket data
13. THE Backend SHALL store the clientType as "customer" in the socket data
14. IF an FCM token is provided in the connection payload, THEN THE Backend SHALL add or update the token in customerFcmTokens
15. WHEN adding or updating an FCM token, THE Backend SHALL set lastUpdatedAt to the current timestamp

---

### Requirement 7: Customer Connection Limits

**User Story:** As a License_Owner, I want to limit concurrent customer connections per POS device, so that my system resources are not overwhelmed.

#### Acceptance Criteria

1. WHEN a customer attempts to connect, THE Backend SHALL check currentCustomerConnections against maxCustomerConnections
2. IF currentCustomerConnections is greater than or equal to maxCustomerConnections, THEN THE Backend SHALL reject the connection
3. WHEN a customer connection is rejected due to limits, THE Backend SHALL emit an error with message "Connection limit reached"
4. WHEN a customer successfully connects, THE Backend SHALL increment currentCustomerConnections by 1
5. WHEN a customer disconnects, THE Backend SHALL decrement currentCustomerConnections by 1
6. THE Backend SHALL ensure currentCustomerConnections never becomes negative
7. THE Backend SHALL persist currentCustomerConnections updates to the Key_Seat entity

---

### Requirement 8: Menu Browsing for Restaurant and Cafe

**User Story:** As an End_Customer at a restaurant or cafe, I want to browse menu categories and products, so that I can see what is available before ordering.

#### Acceptance Criteria

1. WHEN a customer emits "customer:menu:categories" event, THE Backend SHALL verify the customer is connected to a seat
2. WHEN a customer requests menu categories, THE Backend SHALL verify the seat has allowMenuBrowsing set to true
3. IF allowMenuBrowsing is false, THEN THE Backend SHALL emit "customer:error" with message "Menu browsing not enabled"
4. WHEN menu categories are requested, THE Backend SHALL forward the request to the POS_Device via "pos:menu:categories:request" event
5. THE Backend SHALL include the customer socket ID in the forwarded request
6. WHEN a customer emits "customer:menu:products" event with a category ID, THE Backend SHALL verify allowMenuBrowsing is true
7. WHEN menu products are requested, THE Backend SHALL forward the request to the POS_Device via "pos:menu:products:request" event
8. THE Backend SHALL route requests to the correct POS_Device based on the customer's connected seat
9. IF the customer is not connected to a seat, THEN THE Backend SHALL emit "customer:error" with message "Not connected to a seat"

---

### Requirement 9: Barcode Scanning for Retail and Pharmacy

**User Story:** As an End_Customer at a retail store or pharmacy, I want to scan product barcodes to see prices and information, so that I can make informed purchasing decisions.

#### Acceptance Criteria

1. WHEN a customer emits "customer:product:scan" event with a barcode, THE Backend SHALL verify the customer is connected to a seat
2. WHEN a customer scans a barcode, THE Backend SHALL verify the seat has allowBarcodeScanning set to true
3. IF allowBarcodeScanning is false, THEN THE Backend SHALL emit "customer:error" with message "Barcode scanning not enabled"
4. WHEN a barcode scan is requested, THE Backend SHALL forward the request to the POS_Device via "pos:product:scan:request" event
5. THE Backend SHALL include the barcode value and customer socket ID in the forwarded request
6. THE Backend SHALL route the scan request to the correct POS_Device based on the customer's connected seat
7. IF the customer is not connected to a seat, THEN THE Backend SHALL emit "customer:error" with message "Not connected to a seat"

---

### Requirement 10: POS Response Forwarding

**User Story:** As an End_Customer, I want to receive responses from the POS device in real-time, so that I can see menu data and product information immediately.

#### Acceptance Criteria

1. WHEN a POS_Device emits "pos:menu:categories:response" event, THE Backend SHALL extract the customer socket ID from the payload
2. WHEN menu categories response is received, THE Backend SHALL forward the data to the specific customer via "customer:menu:categories:data" event
3. WHEN a POS_Device emits "pos:menu:products:response" event, THE Backend SHALL forward the data to the requesting customer via "customer:menu:products:data" event
4. WHEN a POS_Device emits "pos:product:scan:response" event, THE Backend SHALL forward the data to the requesting customer via "customer:product:data" event
5. THE Backend SHALL only forward responses to the customer socket ID specified in the POS response
6. IF the customer socket is no longer connected, THEN THE Backend SHALL discard the response
7. THE Backend SHALL log successful response forwarding for monitoring purposes

---

### Requirement 11: Request Timeout Handling

**User Story:** As an End_Customer, I want to receive a timeout notification if the POS device doesn't respond, so that I know the request failed and can retry.

#### Acceptance Criteria

1. WHEN a customer request is forwarded to a POS_Device, THE Backend SHALL start a 10-second timeout timer
2. IF the POS_Device does not respond within 10 seconds, THEN THE Backend SHALL emit "customer:timeout" to the customer
3. WHEN a timeout occurs, THE Backend SHALL include the request type in the timeout message
4. WHEN a POS response is received before timeout, THE Backend SHALL cancel the timeout timer
5. THE Backend SHALL log timeout events for monitoring and debugging purposes

---

### Requirement 12: Customer Disconnection Handling

**User Story:** As a License_Owner, I want customer connections to be properly cleaned up when they disconnect, so that connection counts remain accurate.

#### Acceptance Criteria

1. WHEN a customer socket disconnects, THE Backend SHALL retrieve the connected seat identifier from socket data
2. WHEN a customer disconnects, THE Backend SHALL decrement currentCustomerConnections by 1 for the associated seat
3. WHEN a customer disconnects, THE Backend SHALL persist the updated currentCustomerConnections to the Key_Seat entity
4. WHEN a customer disconnects, THE Backend SHALL remove the socket from all seat-specific rooms
5. THE Backend SHALL handle disconnection cleanup even if the socket data is incomplete
6. THE Backend SHALL log customer disconnection events with seat identifier and connection count

---

### Requirement 13: Socket.IO Event Constants

**User Story:** As a developer, I want all Socket.IO event names defined as constants, so that event names are consistent and typo-free across the codebase.

#### Acceptance Criteria

1. THE Backend SHALL define a constant "customer:connect" for customer connection requests
2. THE Backend SHALL define a constant "customer:connect:success" for connection confirmation
3. THE Backend SHALL define a constant "customer:disconnect" for disconnection events
4. THE Backend SHALL define a constant "customer:menu:categories" for menu category requests
5. THE Backend SHALL define a constant "customer:menu:categories:data" for menu category responses
6. THE Backend SHALL define a constant "customer:menu:products" for menu product requests
7. THE Backend SHALL define a constant "customer:menu:products:data" for menu product responses
8. THE Backend SHALL define a constant "customer:product:scan" for barcode scan requests
9. THE Backend SHALL define a constant "customer:product:data" for product scan responses
10. THE Backend SHALL define a constant "pos:menu:categories:request" for POS menu category requests
11. THE Backend SHALL define a constant "pos:menu:categories:response" for POS menu category responses
12. THE Backend SHALL define a constant "pos:menu:products:request" for POS menu product requests
13. THE Backend SHALL define a constant "pos:menu:products:response" for POS menu product responses
14. THE Backend SHALL define a constant "pos:product:scan:request" for POS barcode scan requests
15. THE Backend SHALL define a constant "pos:product:scan:response" for POS barcode scan responses
16. THE Backend SHALL define a constant "customer:error" for error notifications
17. THE Backend SHALL define a constant "customer:timeout" for timeout notifications
18. THE Backend SHALL use these constants in all Socket.IO event handlers

---

### Requirement 14: Database Migration for Existing Seats

**User Story:** As a system administrator, I want existing POS seats to be updated with customer app fields, so that the feature works with previously activated devices.

#### Acceptance Criteria

1. THE Backend SHALL provide a migration script to update existing Key_Seat records
2. WHEN the migration runs, THE Backend SHALL generate a unique Public_Seat_ID for each existing seat without one
3. WHEN the migration runs, THE Backend SHALL set businessType to "retail" for seats without a business type
4. WHEN the migration runs, THE Backend SHALL set allowCustomerApp to false for existing seats
5. WHEN the migration runs, THE Backend SHALL set currentCustomerConnections to 0 for existing seats
6. WHEN the migration runs, THE Backend SHALL set maxCustomerConnections to 50 for existing seats
7. THE Backend SHALL log the number of seats updated during migration
8. THE Backend SHALL handle migration errors gracefully without corrupting existing data

---

### Requirement 15: Multi-Replica Socket.IO Support

**User Story:** As a system administrator, I want customer connections to work across multiple backend replicas, so that the system scales horizontally in production.

#### Acceptance Criteria

1. THE Backend SHALL use Redis adapter for Socket.IO in multi-replica deployments
2. WHEN a customer connects to replica A, THE Backend SHALL allow POS responses from replica B to reach the customer
3. WHEN a customer request is forwarded to a POS_Device, THE Backend SHALL ensure the request reaches the POS regardless of which replica it is connected to
4. THE Backend SHALL use Socket.IO rooms for seat-specific customer grouping
5. THE Backend SHALL broadcast POS responses to the correct room across all replicas
6. THE Backend SHALL maintain connection count accuracy across replicas using database persistence

---

### Requirement 16: Security and Access Control

**User Story:** As a system administrator, I want customer connections to be secure and isolated, so that customers cannot access unauthorized data or interfere with other seats.

#### Acceptance Criteria

1. THE Backend SHALL not require authentication for customer Socket.IO connections
2. THE Backend SHALL validate Public_Seat_ID before allowing any customer operations
3. THE Backend SHALL restrict customer access to only the seat they are connected to
4. THE Backend SHALL not expose internal identifiers (documentId, machineUUID) to customers
5. THE Backend SHALL not expose License_Owner information to customers
6. THE Backend SHALL not expose telemetry data to customers
7. THE Backend SHALL only return businessName, businessType, and feature flags to customers
8. THE Backend SHALL rate-limit public seat information endpoint to prevent abuse
9. THE Backend SHALL validate all customer event payloads before forwarding to POS devices
10. THE Backend SHALL sanitize customer input to prevent injection attacks

---

### Requirement 17: Monitoring and Logging

**User Story:** As a system administrator, I want comprehensive logging of customer connections and requests, so that I can monitor usage and troubleshoot issues.

#### Acceptance Criteria

1. WHEN a customer connects, THE Backend SHALL log the Public_Seat_ID and socket ID
2. WHEN a customer connection is rejected, THE Backend SHALL log the rejection reason
3. WHEN a customer request is forwarded to a POS_Device, THE Backend SHALL log the request type and seat identifier
4. WHEN a POS response is forwarded to a customer, THE Backend SHALL log successful delivery
5. WHEN a request timeout occurs, THE Backend SHALL log the timeout with request details
6. WHEN a customer disconnects, THE Backend SHALL log the disconnection with connection duration
7. THE Backend SHALL log currentCustomerConnections changes for each seat
8. THE Backend SHALL include timestamps in all customer-related log entries
9. THE Backend SHALL use structured logging format for easy parsing and analysis

---

### Requirement 19: Customer FCM Token Storage

**User Story:** As a License_Owner, I want to store FCM tokens for connected customers, so that I can send push notifications to customers about their orders or updates.

#### Acceptance Criteria

1. THE Key_Seat SHALL include a customerFcmTokens field as a repeatable component
2. THE customerFcmTokens component SHALL use the existing FCM-Token component structure
3. THE customerFcmTokens component SHALL store token, deviceId, deviceName, platform, lastUpdatedAt, and isActive fields
4. WHEN a customer successfully connects via Socket.IO, THE Backend SHALL check if an FCM token is provided in the connection payload
5. IF an FCM token is provided, THE Backend SHALL check if the token already exists in customerFcmTokens for that seat
6. IF the token does not exist, THEN THE Backend SHALL add the new FCM token to the customerFcmTokens array
7. IF the token already exists, THEN THE Backend SHALL update the lastUpdatedAt field to the current timestamp
8. WHEN adding or updating an FCM token, THE Backend SHALL set isActive to true
9. THE Backend SHALL validate that the FCM token string is not empty before storing
10. THE Backend SHALL validate that the deviceId is provided with the FCM token
11. THE Backend SHALL persist customerFcmTokens updates to the Key_Seat entity immediately after connection success

---

### Requirement 20: FCM Token Cleanup Cron Job

**User Story:** As a system administrator, I want inactive FCM tokens automatically removed, so that the database doesn't accumulate stale tokens from devices that no longer connect.

#### Acceptance Criteria

1. THE Backend SHALL provide a cron job to clean up inactive FCM tokens
2. THE cron job SHALL run daily at a configurable time (default: 2:00 AM UTC)
3. WHEN the cron job runs, THE Backend SHALL use a distributed lock to prevent duplicate execution across replicas
4. THE Backend SHALL query all Key_Seat records with customerFcmTokens
5. FOR each seat, THE Backend SHALL identify FCM tokens where lastUpdatedAt is older than 30 days
6. THE Backend SHALL remove FCM tokens that have not been updated for 30 days or more
7. THE Backend SHALL log the number of tokens removed per seat
8. THE Backend SHALL log the total number of tokens removed across all seats
9. THE Backend SHALL handle errors gracefully without affecting active tokens
10. THE cron job SHALL complete within 5 minutes or log a warning

---

### Requirement 18: Error Handling and Resilience

**User Story:** As an End_Customer, I want clear error messages when something goes wrong, so that I understand what happened and can take appropriate action.

#### Acceptance Criteria

1. IF a Public_Seat_ID is invalid, THEN THE Backend SHALL return error message "Invalid or inactive seat ID"
2. IF a POS_Device is offline, THEN THE Backend SHALL return error message "POS device is currently offline"
3. IF connection limit is reached, THEN THE Backend SHALL return error message "Connection limit reached"
4. IF a feature is not enabled, THEN THE Backend SHALL return error message "{Feature} not enabled"
5. IF a customer is not connected, THEN THE Backend SHALL return error message "Not connected to a seat"
6. WHEN an error occurs, THE Backend SHALL emit "customer:error" event with error message
7. THE Backend SHALL not expose internal error details or stack traces to customers
8. THE Backend SHALL log detailed error information for debugging while sending user-friendly messages to customers
9. THE Backend SHALL handle Socket.IO connection errors gracefully without crashing
10. THE Backend SHALL recover from Redis connection failures without losing customer connections

---

## Implementation Notes

### Parser and Serializer Requirements

This feature does not require custom parsers or serializers. All data exchange uses JSON format via Socket.IO, which handles serialization automatically.

### Round-Trip Properties

Not applicable - this feature focuses on real-time event forwarding rather than data transformation.

### Critical Integration Points

1. **Subscription Plan Service**: Must be created to query customer app features by plan or user
2. **Public ID Generator Utility**: Must ensure uniqueness across distributed system
3. **License Activation Flow**: Must be modified to copy plan features and generate public IDs
4. **Socket.IO Bootstrap**: Must register customer app handlers for clientType "customer"
5. **POS Response Handlers**: Must be created to forward POS responses to customers
6. **FCM Token Component**: Reuse existing FCM-Token component from src/components/user/fcm-token.json
7. **FCM Token Cleanup Cron**: Must use distributed lock pattern for multi-replica safety

### Business Type Behavior

- **Restaurant/Cafe**: Primarily uses menu browsing features
- **Retail/Pharmacy**: Primarily uses barcode scanning features
- **Other**: Can use any enabled features based on plan configuration

### Connection Flow Summary

```
Customer App → Backend (validate) → Join Room → Increment Counter → Store/Update FCM Token → Confirm
Customer Request → Backend (validate) → Forward to POS → Start Timeout
POS Response → Backend (route) → Forward to Customer → Cancel Timeout
Customer Disconnect → Backend → Decrement Counter → Cleanup
Daily Cron → Backend → Remove FCM Tokens older than 30 days
```

### FCM Token Management Flow

```
Customer Connect with FCM Token → Backend validates token
  ├─ Token exists in customerFcmTokens → Update lastUpdatedAt
  └─ Token does not exist → Add new token entry
Daily Cron Job → Query all seats → Remove tokens where lastUpdatedAt > 30 days
```
