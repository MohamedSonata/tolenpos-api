# Design Document: Customer Mobile App Integration

## Overview

This design specifies the backend implementation for customer-facing mobile app support in the Strapi v5 POS license management system. The feature enables end-customers (restaurant patrons, retail shoppers, cafe customers, pharmacy clients) to connect to specific POS devices via Socket.IO for real-time interactions.

### Key Capabilities

- **Public Seat Identification**: Each POS device receives a customer-friendly identifier (e.g., "REST42A", "CAFE001") for easy connection
- **Subscription-Based Features**: Customer app capabilities controlled by license owner's subscription plan
- **Real-Time Communication**: Socket.IO-based request-response flow between customers, backend, and POS devices
- **Business Type Adaptation**: Different features enabled based on business type (restaurant, retail, cafe, pharmacy)
- **Connection Management**: Concurrent connection limits per seat with automatic cleanup
- **FCM Token Storage**: Store customer device tokens for push notifications
- **Multi-Replica Support**: Redis-backed Socket.IO adapter for horizontal scaling

### Communication Flow

```
Customer App → Backend (validate) → POS Device → Backend → Customer App
```

All customer requests are validated, forwarded to the appropriate POS device, and responses are routed back to the requesting customer. The backend acts as a secure intermediary, enforcing feature flags and connection limits.

---

## Architecture

### System Components

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Customer App   │◄───────►│  Strapi Backend  │◄───────►│   POS Device    │
│  (Mobile/Web)   │         │  (Socket.IO)     │         │   (Socket.IO)   │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  PostgreSQL DB   │
                            │  (Seat Config)   │
                            └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │      Redis       │
                            │  (Socket.IO      │
                            │   Adapter)       │
                            └──────────────────┘
```

### Component Responsibilities

**Customer App (Client)**
- Connects via Socket.IO with `clientType: "customer"`
- No authentication required (public access)
- Provides Public Seat ID for connection
- Optionally provides FCM token for push notifications
- Emits requests for menu browsing or barcode scanning
- Receives real-time responses from POS devices

**Strapi Backend (Orchestrator)**
- Validates Public Seat IDs and feature flags
- Manages connection limits per seat
- Routes requests between customers and POS devices
- Stores and updates customer FCM tokens
- Enforces subscription plan restrictions
- Handles timeouts and error conditions
- Provides public REST endpoint for seat information

**POS Device (Data Provider)**
- Receives forwarded customer requests
- Processes menu queries or barcode scans
- Returns responses to backend for customer delivery
- Operates independently of customer connections

**PostgreSQL Database**
- Stores subscription plan configurations
- Stores seat configurations and feature flags
- Tracks current customer connection counts
- Stores customer FCM tokens per seat

**Redis**
- Socket.IO adapter for multi-replica coordination
- Distributed locks for cron jobs
- Ensures events reach correct customers across replicas

### Design Decisions

**Decision 1: No Customer Authentication**
- **Rationale**: Customers are transient users who connect via public seat IDs. Authentication would create friction and require account management for casual users.
- **Trade-off**: Security relies on seat ID obscurity and feature flag validation rather than user identity.

**Decision 2: Backend as Request Router**
- **Rationale**: POS devices cannot accept direct customer connections due to firewall/NAT constraints. Backend provides stable connection point.
- **Trade-off**: Adds latency (customer → backend → POS → backend → customer) but enables centralized validation and monitoring.

**Decision 3: Copy Plan Features to Seats**
- **Rationale**: Avoids repeated plan lookups during high-frequency customer operations. Seat-level flags provide fast validation.
- **Trade-off**: Plan changes don't automatically propagate to existing seats (requires manual update or seat reactivation).

**Decision 4: Reuse Existing FCM Token Component**
- **Rationale**: Leverage existing `src/components/user/fcm-token.json` component structure for consistency.
- **Trade-off**: None - component is generic and suitable for customer tokens.

**Decision 5: 10-Second Request Timeout**
- **Rationale**: Balances user experience (customers expect fast responses) with POS processing time (complex queries may take seconds).
- **Trade-off**: May timeout legitimate slow queries, but prevents indefinite waiting.

---

## Components and Interfaces

### Subscription Plan Service

**Location**: `src/api/subscription-plan/services/subscription-plan.ts`

**Purpose**: Query customer app features from subscription plans

**Interface**:
```typescript
interface SubscriptionPlanService {
  /**
   * Gets customer app features for a specific plan
   * @param planDocumentId - The plan's document ID
   * @returns Feature configuration or null if plan not found
   */
  getCustomerAppFeatures(planDocumentId: string): Promise<CustomerAppFeatures | null>;

  /**
   * Gets customer app features by user document ID
   * @param userDocumentId - The user's document ID
   * @returns Feature configuration or null if user has no plan
   */
  getCustomerAppFeaturesByUser(userDocumentId: string): Promise<CustomerAppFeatures | null>;
}

interface CustomerAppFeatures {
  allowCustomerApp: boolean;
  allowMenuBrowsing: boolean;
  allowBarcodeScanning: boolean;
  allowCustomerOrdering: boolean;
  maxCustomerConnectionsPerSeat: number;
}
```

### Public Seat ID Generator

**Location**: `src/api/key-seat/utils/public-id-generator.ts`

**Purpose**: Generate unique, customer-friendly seat identifiers

**Interface**:
```typescript
/**
 * Generates a unique public seat ID with business type prefix
 * @param businessType - Type of business (restaurant, retail, cafe, pharmacy, other)
 * @returns Public seat ID (e.g., "REST42A", "CAFE001")
 */
function generatePublicSeatId(businessType?: string): string;

/**
 * Validates public seat ID format
 * @param id - The ID to validate
 * @returns True if valid format (6-12 uppercase alphanumeric)
 */
function isValidPublicSeatId(id: string): boolean;

/**
 * Generates unique public seat ID by checking database for collisions
 * @param strapi - Strapi instance
 * @param businessType - Type of business
 * @param maxAttempts - Maximum generation attempts (default: 10)
 * @returns Unique public seat ID
 * @throws Error if unable to generate unique ID after maxAttempts
 */
async function generateUniquePublicSeatId(
  strapi: Core.Strapi,
  businessType?: string,
  maxAttempts?: number
): Promise<string>;
```

**Business Type Prefixes**:
- `restaurant` → `REST`
- `retail` → `RETL`
- `cafe` → `CAFE`
- `pharmacy` → `PHRM`
- `other` → `SEAT`

### Customer App Socket.IO Handler

**Location**: `src/socketio/handlers/customer-app.handler.ts`

**Purpose**: Handle customer Socket.IO connections and requests

**Interface**:
```typescript
/**
 * Sets up customer app Socket.IO event handlers
 * @param socket - Customer socket connection
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function setupCustomerAppHandlers(
  socket: Socket,
  strapi: Core.Strapi,
  io: Server
): void;
```

**Events Handled**:
- `customer:connect` - Customer connection request with Public Seat ID
- `customer:menu:categories` - Request menu categories (restaurant/cafe)
- `customer:menu:products` - Request products for category (restaurant/cafe)
- `customer:product:scan` - Scan barcode (retail/pharmacy)
- `disconnect` - Customer disconnection cleanup

### POS Customer Response Handler

**Location**: `src/socketio/handlers/pos-customer-response.handler.ts`

**Purpose**: Forward POS responses to requesting customers

**Interface**:
```typescript
/**
 * Sets up POS customer response event handlers
 * @param socket - POS socket connection
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function setupPOSCustomerResponseHandlers(
  socket: Socket,
  strapi: Core.Strapi,
  io: Server
): void;
```

**Events Handled**:
- `pos:menu:categories:response` - Forward menu categories to customer
- `pos:menu:products:response` - Forward products to customer
- `pos:product:scan:response` - Forward product info to customer

### Key-Seat Controller Extension

**Location**: `src/api/key-seat/controllers/key-seat.ts`

**Purpose**: Provide public seat information endpoint

**Interface**:
```typescript
/**
 * GET /api/key-seats/public/:publicSeatId
 * Gets public seat information (no auth required)
 * @param ctx.params.publicSeatId - The public seat identifier
 * @returns Seat information including online status and features
 */
async getPublicSeatInfo(ctx: Context): Promise<void>;
```

**Response Format**:
```typescript
interface PublicSeatInfoResponse {
  success: boolean;
  error?: string;
  seat: {
    publicSeatId: string;
    businessName: string;
    businessType: string;
    isOnline: boolean;
    canConnect: boolean;
    currentConnections: number;
    maxConnections: number;
    features: {
      allowMenuBrowsing: boolean;
      allowBarcodeScanning: boolean;
      allowCustomerOrdering: boolean;
    };
  };
}
```

### FCM Token Cleanup Cron Job

**Location**: `src/cron/jobs/cleanup-customer-fcm-tokens.ts`

**Purpose**: Remove inactive customer FCM tokens older than 30 days

**Interface**:
```typescript
/**
 * Cleans up inactive customer FCM tokens
 * Runs daily at 2:00 AM UTC
 * Uses distributed lock for multi-replica safety
 * @param strapi - Strapi instance
 */
async function cleanupCustomerFcmTokens(strapi: Core.Strapi): Promise<void>;
```

---

## Data Models

### Subscription Plan Schema Extensions

**File**: `src/api/subscription-plan/content-types/subscription-plan/schema.json`

**New Attributes**:
```json
{
  "allowCustomerApp": {
    "type": "boolean",
    "default": false,
    "description": "Enable customer-facing mobile app for this plan"
  },
  "allowMenuBrowsing": {
    "type": "boolean",
    "default": false,
    "description": "Allow customers to browse menu/categories (restaurant/cafe)"
  },
  "allowBarcodeScanning": {
    "type": "boolean",
    "default": false,
    "description": "Allow customers to scan barcodes for product info (retail/pharmacy)"
  },
  "allowCustomerOrdering": {
    "type": "boolean",
    "default": false,
    "description": "Allow customers to place orders directly from mobile app"
  },
  "maxCustomerConnectionsPerSeat": {
    "type": "integer",
    "default": 50,
    "description": "Maximum concurrent customer connections per seat"
  }
}
```

**Validation Rules**:
- `maxCustomerConnectionsPerSeat` must be between 1 and 500
- All boolean flags default to `false` for security
- Feature flags are independent (can enable any combination)

### Key-Seat Schema Extensions

**File**: `src/api/key-seat/content-types/key-seat/schema.json`

**New Attributes**:
```json
{
  "publicSeatId": {
    "type": "string",
    "unique": true,
    "required": false,
    "description": "Public identifier for customer connections (e.g., REST42A, CAFE001)"
  },
  "businessName": {
    "type": "string",
    "required": false,
    "description": "Display name for the business"
  },
  "businessType": {
    "type": "enumeration",
    "enum": ["restaurant", "retail", "cafe", "pharmacy", "other"],
    "default": "retail",
    "description": "Type of business - determines customer app behavior"
  },
  "allowCustomerApp": {
    "type": "boolean",
    "default": false,
    "description": "Enable customer app for this seat (copied from plan)"
  },
  "allowMenuBrowsing": {
    "type": "boolean",
    "default": false,
    "description": "Allow menu/category browsing"
  },
  "allowBarcodeScanning": {
    "type": "boolean",
    "default": false,
    "description": "Allow barcode scanning"
  },
  "allowCustomerOrdering": {
    "type": "boolean",
    "default": false,
    "description": "Allow direct ordering"
  },
  "maxCustomerConnections": {
    "type": "integer",
    "default": 50,
    "description": "Max concurrent customer connections"
  },
  "currentCustomerConnections": {
    "type": "integer",
    "default": 0,
    "description": "Current number of connected customers"
  },
  "customerFcmTokens": {
    "type": "component",
    "component": "user.fcm-token",
    "repeatable": true,
    "description": "FCM tokens for customers connected to this seat"
  }
}
```

**Constraints**:
- `publicSeatId` has unique constraint across all seats
- `currentCustomerConnections` must never be negative
- `currentCustomerConnections` must not exceed `maxCustomerConnections`
- `customerFcmTokens` reuses existing `user.fcm-token` component structure

**Indexes**:
- Index on `publicSeatId` for fast customer connection lookups
- Index on `isActive` and `allowCustomerApp` for public endpoint queries

### Socket.IO Event Constants

**File**: `src/socketio/events_constants.ts`

**New Constants**:
```typescript
// Customer App Events
static readonly OnCustomerConnect = "customer:connect";
static readonly EmitCustomerConnectSuccess = "customer:connect:success";
static readonly OnCustomerDisconnect = "customer:disconnect";

// Menu Browsing Events (Restaurant/Cafe)
static readonly OnCustomerMenuCategories = "customer:menu:categories";
static readonly EmitCustomerMenuCategories = "customer:menu:categories:data";
static readonly OnCustomerMenuProducts = "customer:menu:products";
static readonly EmitCustomerMenuProducts = "customer:menu:products:data";

// Barcode Scanning Events (Retail/Pharmacy)
static readonly OnCustomerProductScan = "customer:product:scan";
static readonly EmitCustomerProductData = "customer:product:data";

// POS Response Events
static readonly OnPOSMenuCategoriesResponse = "pos:menu:categories:response";
static readonly OnPOSMenuProductsResponse = "pos:menu:products:response";
static readonly OnPOSProductScanResponse = "pos:product:scan:response";

// POS Request Events
static readonly EmitPOSMenuCategoriesRequest = "pos:menu:categories:request";
static readonly EmitPOSMenuProductsRequest = "pos:menu:products:request";
static readonly EmitPOSProductScanRequest = "pos:product:scan:request";

// Error Events
static readonly EmitCustomerError = "customer:error";
static readonly EmitCustomerTimeout = "customer:timeout";
```

---

## Error Handling

### Error Categories

**1. Connection Errors**

| Error Condition | Error Message | HTTP Status / Event | Recovery Action |
|----------------|---------------|---------------------|-----------------|
| Invalid Public Seat ID | "Invalid or inactive seat ID" | `customer:error` | Customer must verify seat ID |
| Seat not found | "Seat not found or customer app not enabled" | 404 | Customer must check with business |
| POS device offline | "POS device is currently offline" | `customer:error` | Customer waits for POS to reconnect |
| Connection limit reached | "Connection limit reached" | `customer:error` | Customer retries later |
| Customer app disabled | "Customer app not enabled for this seat" | `customer:error` | License owner must upgrade plan |

**2. Feature Access Errors**

| Error Condition | Error Message | Event | Recovery Action |
|----------------|---------------|-------|-----------------|
| Menu browsing disabled | "Menu browsing not enabled" | `customer:error` | Feature not available in plan |
| Barcode scanning disabled | "Barcode scanning not enabled" | `customer:error` | Feature not available in plan |
| Customer ordering disabled | "Customer ordering not enabled" | `customer:error` | Feature not available in plan |
| Not connected to seat | "Not connected to a seat" | `customer:error` | Customer must connect first |

**3. Request Timeout Errors**

| Error Condition | Error Message | Event | Recovery Action |
|----------------|---------------|-------|-----------------|
| POS response timeout (10s) | "Request timed out - POS did not respond" | `customer:timeout` | Customer can retry request |
| Menu categories timeout | "Menu categories request timed out" | `customer:timeout` | Retry or check POS status |
| Product scan timeout | "Product scan request timed out" | `customer:timeout` | Retry scan |

**4. Database Errors**

| Error Condition | Logging | Response | Recovery Action |
|----------------|---------|----------|-----------------|
| Seat query failure | Log full error with context | "Failed to get seat information" | Retry with exponential backoff |
| Connection count update failure | Log error, attempt rollback | Continue operation, log warning | Background job reconciles counts |
| FCM token storage failure | Log error with seat ID | Continue connection, skip token | Token will be updated on next connection |
| Public ID collision (after 10 retries) | Log error with attempted IDs | "Failed to generate unique seat ID" | Manual intervention required |

**5. Socket.IO Infrastructure Errors**

| Error Condition | Handling | Logging | Impact |
|----------------|----------|---------|--------|
| Redis adapter disconnection | Graceful degradation to single replica | Error log with reconnection attempts | Events may not reach all replicas |
| Socket disconnection during request | Cancel timeout, cleanup state | Info log with socket ID | Customer must reconnect |
| Room join failure | Reject connection | Error log with seat ID | Customer cannot connect |
| Event emission failure | Log error, continue | Error log with event type | Specific customer misses update |

### Error Response Format

**Socket.IO Error Events**:
```typescript
{
  success: false,
  error: "User-friendly error message",
  code: "ERROR_CODE", // Optional: for client-side handling
  timestamp: "2024-01-15T10:30:00Z"
}
```

**REST API Error Responses**:
```typescript
{
  success: false,
  error: "User-friendly error message",
  seat?: {
    publicSeatId: string,
    businessName: string,
    isOnline: boolean
  }
}
```

### Error Handling Strategies

**1. Graceful Degradation**

- If Redis adapter fails, continue with single-replica mode (log warning)
- If FCM token storage fails, allow connection to proceed (log error)
- If telemetry update fails, continue with connection management (log error)

**2. Automatic Retry**

- Public ID generation: Up to 10 retries with collision detection
- Database connection count updates: 3 retries with exponential backoff
- Redis lock acquisition: 3 retries with 100ms delay

**3. State Reconciliation**

- Background cron job verifies `currentCustomerConnections` matches actual Socket.IO room members
- Reconciliation runs every 5 minutes
- Corrects drift caused by unhandled disconnections or errors

**4. Circuit Breaker Pattern**

- If POS device fails to respond to 5 consecutive requests, mark as "degraded"
- Return immediate error to customers without forwarding requests
- Reset circuit after 60 seconds or successful POS response

**5. Logging Strategy**

```typescript
// Error logging format
strapi.log.error('[CustomerApp] Connection failed', {
  publicSeatId,
  socketId: socket.id,
  error: error.message,
  timestamp: new Date().toISOString()
});

// Warning logging format
strapi.log.warn('[CustomerApp] Connection limit approaching', {
  publicSeatId,
  currentConnections,
  maxConnections,
  utilizationPercent: (currentConnections / maxConnections) * 100
});

// Info logging format
strapi.log.info('[CustomerApp] Customer connected', {
  publicSeatId,
  socketId: socket.id,
  businessType,
  features: { allowMenuBrowsing, allowBarcodeScanning }
});
```

### Security Error Handling

**1. Input Validation**

- Validate Public Seat ID format before database query (prevent injection)
- Sanitize all customer input before forwarding to POS devices
- Reject requests with invalid or missing required fields

**2. Rate Limiting**

- Public seat info endpoint: 100 requests per minute per IP
- Socket.IO connection attempts: 10 per minute per IP
- Customer requests: 30 per minute per socket

**3. Error Message Sanitization**

- Never expose internal error details (stack traces, database errors)
- Never expose internal identifiers (documentId, machineUUID)
- Never expose license owner information
- Use generic messages for security-related errors

### Monitoring and Alerting

**Critical Errors (Immediate Alert)**:
- Public ID generation failure after 10 retries
- Redis adapter complete failure
- Database connection pool exhaustion
- Connection count drift exceeding 10% of max connections

**Warning Conditions (Log and Monitor)**:
- Connection limit reached for any seat
- Request timeout rate exceeding 5%
- FCM token storage failure rate exceeding 1%
- POS response time exceeding 5 seconds

**Metrics to Track**:
- Customer connection success rate
- Average request-response latency
- Timeout rate per seat
- Connection count accuracy (actual vs. stored)
- FCM token storage success rate

---

## Testing Strategy

### Testing Approach

This feature is **NOT suitable for property-based testing** because it primarily involves:
- Real-time event routing and forwarding (Socket.IO)
- Side-effect operations (connection counting, FCM token storage)
- Infrastructure coordination (Redis adapter, multi-replica support)
- Integration with external services (Socket.IO, PostgreSQL, Redis)

**Testing will focus on**:
- **Unit tests** for business logic and validation functions
- **Integration tests** for Socket.IO event flows and database operations
- **Example-based tests** for specific scenarios and edge cases
- **Manual testing** for end-to-end customer flows

### Unit Tests

**1. Public Seat ID Generator** (`src/api/key-seat/utils/public-id-generator.ts`)

Test cases:
- Generates ID with correct business type prefix (REST, RETL, CAFE, PHRM, SEAT)
- Generated ID is 6-12 uppercase alphanumeric characters
- `isValidPublicSeatId()` correctly validates format
- `generateUniquePublicSeatId()` retries on collision
- Throws error after max retry attempts (10)

**2. Subscription Plan Service** (`src/api/subscription-plan/services/subscription-plan.ts`)

Test cases:
- `getCustomerAppFeatures()` returns correct features for valid plan
- Returns null for non-existent plan
- Returns default values (false, 50) when plan fields are missing
- `getCustomerAppFeaturesByUser()` returns null when user has no plan
- Correctly extracts plan documentId from populated relation

**3. Input Validation Functions**

Test cases:
- Public Seat ID format validation (length, characters, case)
- FCM token validation (non-empty string, valid format)
- Device ID validation (required with FCM token)
- Barcode format validation (non-empty, reasonable length)
- Category ID validation for menu requests

**4. Error Message Formatting**

Test cases:
- Error responses include required fields (success, error, timestamp)
- Error messages are user-friendly (no stack traces)
- Error codes are consistent across handlers
- Timeout messages include request type

### Integration Tests

**1. Customer Connection Flow**

Test scenarios:
- Customer connects with valid Public Seat ID → success
- Customer connects with invalid Public Seat ID → error
- Customer connects when POS offline → error
- Customer connects when limit reached → error
- Customer connects with FCM token → token stored
- Customer connects with existing FCM token → lastUpdatedAt updated
- Connection increments `currentCustomerConnections`
- Disconnection decrements `currentCustomerConnections`

**2. Menu Browsing Flow (Restaurant/Cafe)**

Test scenarios:
- Customer requests menu categories → forwarded to POS
- POS responds with categories → forwarded to customer
- Customer requests products for category → forwarded to POS
- POS responds with products → forwarded to customer
- Request without `allowMenuBrowsing` → error
- Request from unconnected customer → error
- Request timeout after 10 seconds → timeout event

**3. Barcode Scanning Flow (Retail/Pharmacy)**

Test scenarios:
- Customer scans barcode → forwarded to POS
- POS responds with product info → forwarded to customer
- Scan without `allowBarcodeScanning` → error
- Scan from unconnected customer → error
- Scan timeout after 10 seconds → timeout event

**4. Public Seat Info Endpoint**

Test scenarios:
- GET with valid Public Seat ID → returns seat info
- GET with invalid Public Seat ID → 404
- GET for inactive seat → 404
- GET for seat with `allowCustomerApp: false` → 404
- GET for offline POS → returns offline status
- GET when connection limit reached → `canConnect: false`
- Endpoint accessible without authentication

**5. License Activation Integration**

Test scenarios:
- License activation generates unique Public Seat ID
- Activation copies plan features to seat
- Activation initializes `currentCustomerConnections` to 0
- Activation initializes `customerFcmTokens` as empty array
- Activation response includes Public Seat ID and business info

**6. FCM Token Cleanup Cron Job**

Test scenarios:
- Cron job acquires distributed lock
- Removes tokens older than 30 days
- Preserves tokens updated within 30 days
- Logs number of tokens removed
- Handles seats with no tokens gracefully
- Only one replica executes (distributed lock test)

### Example-Based Tests

**1. Business Type Behavior**

Examples:
- Restaurant seat: `allowMenuBrowsing: true`, prefix "REST"
- Retail seat: `allowBarcodeScanning: true`, prefix "RETL"
- Cafe seat: `allowMenuBrowsing: true`, prefix "CAFE"
- Pharmacy seat: `allowBarcodeScanning: true`, prefix "PHRM"
- Other seat: default features, prefix "SEAT"

**2. Connection Limit Scenarios**

Examples:
- Seat with `maxCustomerConnections: 50`, current 49 → allow connection
- Seat with `maxCustomerConnections: 50`, current 50 → reject connection
- Seat with `maxCustomerConnections: 1`, current 0 → allow connection
- Seat with `maxCustomerConnections: 1`, current 1 → reject connection

**3. Feature Flag Combinations**

Examples:
- All features enabled → all requests allowed
- Only menu browsing enabled → barcode scan rejected
- Only barcode scanning enabled → menu request rejected
- All features disabled → all requests rejected
- Customer app disabled → connection rejected

**4. Edge Cases**

Examples:
- Customer disconnects during pending request → timeout cleanup
- POS disconnects while customer connected → customer receives offline error
- Multiple customers request simultaneously → all forwarded correctly
- Customer reconnects with same FCM token → lastUpdatedAt updated
- Public Seat ID collision on first attempt → retry succeeds

### Multi-Replica Testing

**Test scenarios**:
- Customer connects to replica A, POS on replica B → events routed correctly
- Customer on replica A, POS response from replica B → customer receives response
- Connection count updates synchronized across replicas
- Cron job runs on only one replica (distributed lock)
- Redis adapter failure → graceful degradation

### Manual Testing Checklist

**Customer Connection**:
- [ ] Connect with valid Public Seat ID via Socket.IO
- [ ] Verify connection success event received
- [ ] Verify `currentCustomerConnections` incremented
- [ ] Disconnect and verify count decremented
- [ ] Connect with FCM token and verify storage

**Menu Browsing (Restaurant)**:
- [ ] Request menu categories
- [ ] Verify request forwarded to POS
- [ ] Verify POS response received by customer
- [ ] Request products for category
- [ ] Verify timeout after 10 seconds if POS doesn't respond

**Barcode Scanning (Retail)**:
- [ ] Scan barcode
- [ ] Verify request forwarded to POS
- [ ] Verify product info received by customer
- [ ] Verify timeout handling

**Public Seat Info Endpoint**:
- [ ] GET `/api/key-seats/public/:publicSeatId` without auth
- [ ] Verify response includes business info and features
- [ ] Verify offline status when POS disconnected
- [ ] Verify 404 for invalid seat ID

**Error Handling**:
- [ ] Connect to offline POS → error message
- [ ] Connect when limit reached → error message
- [ ] Request feature when disabled → error message
- [ ] Request without connection → error message

**Multi-Replica**:
- [ ] Connect to different replicas → events routed correctly
- [ ] Verify cron job runs on only one replica
- [ ] Verify connection counts synchronized

### Test Data Setup

**Subscription Plans**:
- Free plan: `allowCustomerApp: false`
- Basic plan: `allowCustomerApp: true`, `allowMenuBrowsing: true`, `maxCustomerConnectionsPerSeat: 10`
- Pro plan: All features enabled, `maxCustomerConnectionsPerSeat: 50`
- Enterprise plan: All features enabled, `maxCustomerConnectionsPerSeat: 200`

**Key-Seats**:
- Restaurant seat: `businessType: "restaurant"`, `allowMenuBrowsing: true`
- Retail seat: `businessType: "retail"`, `allowBarcodeScanning: true`
- Offline seat: `isConnected: false`
- Full seat: `currentCustomerConnections === maxCustomerConnections`

### Performance Testing

**Load scenarios**:
- 50 concurrent customers per seat (max connections)
- 100 requests per second across all customers
- 1000 seats with active customers
- POS response time: 100ms, 500ms, 1000ms, 5000ms

**Metrics to measure**:
- Request-response latency (p50, p95, p99)
- Connection success rate
- Timeout rate
- Database query performance
- Redis adapter overhead

### Continuous Integration

**Automated test execution**:
- Unit tests run on every commit
- Integration tests run on pull requests
- Manual test checklist required before production deployment
- Performance tests run weekly on staging environment

**Test coverage goals**:
- Unit tests: 80% code coverage
- Integration tests: All critical paths covered
- Error handling: All error conditions tested

---

## Implementation Notes

### Prerequisites

- Strapi v5.37.1 with Document Service API
- Socket.IO ^4.8.1 with Redis adapter
- Redis ^4.7.0 for distributed coordination
- PostgreSQL for persistent storage
- Existing FCM token component at `src/components/user/fcm-token.json`

### Implementation Order

1. **Schema Updates** (Subscription Plan, Key-Seat)
2. **Utility Functions** (Public ID generator, validation)
3. **Services** (Subscription Plan service)
4. **License Activation Integration**
5. **Socket.IO Event Constants**
6. **Customer App Handler** (connection, requests)
7. **POS Response Handler** (forwarding)
8. **Public Seat Info Endpoint**
9. **FCM Token Cleanup Cron Job**
10. **Database Migration** (existing seats)
11. **Testing** (unit, integration, manual)
12. **Documentation** (API docs, deployment guide)

### Database Migration Considerations

- Existing seats need Public Seat IDs generated
- Default `businessType` to "retail" for existing seats
- Set `allowCustomerApp: false` for existing seats (opt-in)
- Initialize `currentCustomerConnections: 0`
- Initialize `customerFcmTokens: []`
- Verify no Public Seat ID collisions

### Deployment Checklist

- [ ] Backup database before schema changes
- [ ] Apply schema updates (restart Strapi)
- [ ] Run database migration script
- [ ] Verify Socket.IO event constants registered
- [ ] Test customer connection flow on staging
- [ ] Verify Redis adapter working across replicas
- [ ] Monitor connection counts and error rates
- [ ] Verify FCM token storage and cleanup
- [ ] Update API documentation
- [ ] Train support team on customer app features

### Monitoring and Observability

**Key metrics**:
- Customer connections per seat (current, max, utilization %)
- Request-response latency (by request type)
- Timeout rate (by seat, by request type)
- Error rate (by error type)
- FCM token storage success rate
- Public Seat ID generation success rate
- Connection count accuracy (actual vs. stored)

**Dashboards**:
- Real-time customer connection counts
- Request volume and latency trends
- Error rate by category
- POS response time distribution
- Connection limit utilization by seat

**Alerts**:
- Connection limit reached for any seat
- Timeout rate exceeding 5%
- Error rate exceeding 2%
- Connection count drift exceeding 10%
- Public ID generation failures

### Security Considerations

- Public Seat IDs are not secret (designed for customer sharing)
- No authentication required for customer connections (by design)
- Rate limiting prevents abuse of public endpoints
- Input validation prevents injection attacks
- Internal identifiers never exposed to customers
- License owner data isolated from customer access
- FCM tokens stored securely with seat association

### Scalability Considerations

- Redis adapter enables horizontal scaling (multiple replicas)
- Connection limits prevent resource exhaustion per seat
- Database indexes on `publicSeatId` for fast lookups
- Socket.IO rooms isolate customer groups by seat
- Cron jobs use distributed locks for single execution
- Connection count reconciliation prevents drift

### Future Enhancements

- Customer ordering implementation (currently feature flag only)
- Customer authentication for order history
- Push notifications via stored FCM tokens
- Customer analytics and insights
- QR code generation for Public Seat IDs
- Customer feedback and rating system

