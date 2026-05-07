# Design Document: Customer Ordering Integration

## Overview

Extends the existing customer mobile app infrastructure to support full order creation, validation, routing, and response handling. Customers place orders through their mobile devices, orders are validated and routed through the backend to the appropriate POS terminal, and responses (confirmation or errors) are forwarded back to customers.

**Key Flow**: Customer App → Backend (validate, track, route) → POS Device → Backend (update, sanitize) → Customer App

**Integration Points**:
- Extends `customer-app.handler.ts` with order creation handler
- Extends `pos-customer-response.handler.ts` with order response handler
- New content type: `order-request` for tracking and analytics
- Reuses existing connection management, feature flags, and validation patterns

---

## Architecture

```
Customer App                Backend                    POS Device
     │                         │                           │
     │──order:create──────────►│                           │
     │                         │──validate payload         │
     │                         │──check POS online         │
     │                         │──check feature flag       │
     │                         │──create tracker (pending) │
     │                         │──pos:order:request───────►│
     │                         │──start 30s timeout        │
     │                         │                           │
     │                         │◄─pos:order:response───────│
     │                         │──cancel timeout           │
     │                         │──update tracker           │
     │                         │──sanitize response        │
     │◄─order:response─────────│                           │
     │                         │                           │
     │  (timeout path)         │                           │
     │◄─order:timeout──────────│──30s elapsed              │
     │                         │──update tracker (timeout) │
```

**Multi-Replica Support**: Uses Socket.IO rooms with Redis adapter for cross-replica routing. Order tracking persisted to database for visibility across all replicas.

---

## Components and Interfaces

### Order Request Tracker Content Type

**Location**: `src/api/order-request/content-types/order-request/schema.json`

**Schema**:
```json
{
  "collectionName": "order_requests",
  "info": { "singularName": "order-request", "pluralName": "order-requests" },
  "options": { "draftAndPublish": false },
  "attributes": {
    "requestId": { "type": "string", "required": true, "unique": true },
    "customerSocketId": { "type": "string", "required": true },
    "publicSeatId": { "type": "string", "required": true },
    "customerName": { "type": "string", "required": true },
    "customerPhone": { "type": "string", "required": true },
    "itemCount": { "type": "integer", "required": true },
    "total": { "type": "decimal", "required": true },
    "deliveryType": { "type": "enumeration", "enum": ["pickup", "delivery"], "required": true },
    "status": { "type": "enumeration", "enum": ["pending", "completed", "failed", "timeout"], "default": "pending" },
    "orderId": { "type": "string" },
    "receiptNumber": { "type": "string" },
    "errorCode": { "type": "string" },
    "errorMessage": { "type": "text" }
  }
}
```

**Indexes**: `requestId` (unique), `publicSeatId`, `status`, `createdAt`

### Socket.IO Event Constants

**Location**: `src/socketio/events_constants.ts`

**New Constants**:
```typescript
// Customer order events
static readonly OnCustomerOrderCreate = "customer:order:create";
static readonly EmitCustomerOrderResponse = "customer:order:create:response";

// POS order events
static readonly EmitPOSOrderRequest = "pos:order:create:request";
static readonly OnPOSOrderResponse = "pos:order:create:response";
```

### Order Validation Utility

**Location**: `src/api/key-seat/utils/customer-validation.ts`

**Function Signature**:
```typescript
function validateOrderPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: OrderPayload;
}

interface OrderPayload {
  requestId: string;
  publicSeatId: string;
  customer: {
    name: string;
    phone: string;
    deliveryAddress?: string;
    deliveryType: 'pickup' | 'delivery';
  };
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    addons?: Array<any>;
    notes?: string;
  }>;
  orderNote?: string;
  subtotal: number;
  tax: number;
  total: number;
  timestamp: string;
}
```

**Validation Rules**:
- `requestId`: Valid UUID format
- `publicSeatId`: 6-12 uppercase alphanumeric
- `customer.name`: 2-100 characters
- `customer.phone`: 10-15 digits
- `customer.deliveryAddress`: Required if `deliveryType === 'delivery'`, 10-500 characters
- `items`: 1-50 items, each with valid `productId`, `name`, `price` (positive), `quantity` (1-99)
- `subtotal`, `tax`, `total`: Positive numbers
- All strings sanitized to remove HTML/script tags

### Customer Order Handler

**Location**: `src/socketio/handlers/customer-app.handler.ts`

**Function Signature**:
```typescript
function handleCustomerOrderCreation(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void
```

**Responsibilities**:
1. Validate customer is connected to seat
2. Validate `allowCustomerOrdering` feature flag
3. Validate POS device is online (`isConnected: true`)
4. Validate and sanitize order payload
5. Check rate limit (1 order per 60 seconds per socket)
6. Create `order-request` tracker with status "pending"
7. Forward order to POS via room `pos:${keySeatDocumentId}`
8. Start 30-second timeout timer
9. Handle all error cases with appropriate responses

### POS Order Response Handler

**Location**: `src/socketio/handlers/pos-customer-response.handler.ts`

**Function Signature**:
```typescript
function handlePOSOrderResponse(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void
```

**Responsibilities**:
1. Extract `customerSocketId` and `requestId` from payload
2. Cancel timeout timer for `requestId`
3. Validate response structure (success, order/error fields)
4. Update `order-request` tracker with response data
5. Sanitize response to remove sensitive POS data
6. Forward response to customer via `io.to(customerSocketId)`
7. Handle disconnected customer sockets gracefully

---

## Data Models

### Order Payload TypeScript Interfaces

```typescript
interface CustomerOrderRequest {
  requestId: string;
  publicSeatId: string;
  customer: CustomerInfo;
  items: OrderItem[];
  orderNote?: string;
  subtotal: number;
  tax: number;
  total: number;
  timestamp: string;
}

interface CustomerInfo {
  name: string;
  phone: string;
  deliveryAddress?: string;
  deliveryType: 'pickup' | 'delivery';
}

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  addons?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  notes?: string;
}

interface OrderResponse {
  customerSocketId: string;
  requestId: string;
  success: boolean;
  order?: {
    id: string;
    receiptNumber: string;
    status: string;
    estimatedTime?: number;
    total: number;
    timestamp: string;
  };
  error?: {
    code: string;
    message: string;
  };
}
```

### Order Request Tracker Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| requestId | string | Yes | UUID for tracking |
| customerSocketId | string | Yes | Socket ID for response routing |
| publicSeatId | string | Yes | Seat identifier |
| customerName | string | Yes | Customer name |
| customerPhone | string | Yes | Customer phone |
| itemCount | integer | Yes | Number of items |
| total | decimal | Yes | Order total |
| deliveryType | enum | Yes | pickup or delivery |
| status | enum | Yes | pending, completed, failed, timeout |
| orderId | string | No | POS order ID (on success) |
| receiptNumber | string | No | Receipt number (on success) |
| errorCode | string | No | Error code (on failure) |
| errorMessage | text | No | Error message (on failure) |

---

## Error Handling

| Error Code | Message | Trigger | Response |
|------------|---------|---------|----------|
| NOT_CONNECTED | Not connected to a seat | Customer not connected | Reject immediately |
| FEATURE_DISABLED | Customer ordering not enabled | `allowCustomerOrdering: false` | Reject immediately |
| POS_OFFLINE | Restaurant is currently offline | `isConnected: false` | Reject immediately |
| INVALID_PAYLOAD | Invalid order data | Validation failure | Reject with details |
| RATE_LIMIT_EXCEEDED | Please wait before placing another order | < 60s since last order | Reject immediately |
| TIMEOUT | Order request timed out | No POS response in 30s | Update tracker, notify customer |
| ROUTING_ERROR | Failed to process order | Unexpected error | Log details, generic message |

**Error Response Format**:
```typescript
{
  success: false,
  error: "User-friendly message",
  code: "ERROR_CODE",
  timestamp: "2024-01-15T10:30:00Z"
}
```

**Logging Strategy**:
- Info: Order received, forwarded, response received
- Warn: Validation failures, POS offline, timeouts
- Error: Unexpected errors with stack traces
- Never log: Full phone numbers, addresses, payment details

---

## Testing Strategy

**Not suitable for property-based testing** - This feature involves:
- Real-time event routing (Socket.IO)
- Side-effect operations (database writes, timeout timers)
- Infrastructure coordination (Redis adapter, multi-replica)
- Integration with external services (POS devices)

**Testing Approach**:

**Unit Tests**:
- `validateOrderPayload()`: Valid/invalid payloads, sanitization, edge cases
- Rate limit logic: Timing checks, socket data management
- Timeout timer management: Creation, cancellation, cleanup
- Response sanitization: Sensitive field removal

**Integration Tests**:
- Customer order creation flow: Connect → order → POS response → customer receives
- POS offline rejection: Order rejected when `isConnected: false`
- Feature flag enforcement: Order rejected when `allowCustomerOrdering: false`
- Timeout handling: No POS response → timeout event → tracker updated
- Rate limiting: Multiple orders → second rejected
- Multi-replica routing: Customer on replica A, POS on replica B → events routed correctly
- Tracker creation and updates: Status transitions (pending → completed/failed/timeout)
- Disconnected customer handling: POS responds after customer disconnects → no error

**Example-Based Tests**:
- Valid order with pickup: All fields valid → forwarded to POS
- Valid order with delivery: Includes delivery address → forwarded to POS
- Invalid order (missing fields): Rejected with validation error
- Invalid order (too many items): Rejected with validation error
- Order with addons: Complex item structure → forwarded correctly
- Successful POS response: Tracker updated, customer receives confirmation
- Failed POS response: Tracker updated, customer receives error
- Timeout scenario: 30s elapses → customer receives timeout error

**Manual Testing Checklist**:
- [ ] Place order with valid data → POS receives, customer gets confirmation
- [ ] Place order when POS offline → immediate rejection
- [ ] Place order when feature disabled → immediate rejection
- [ ] Place order twice within 60s → second rejected
- [ ] POS doesn't respond → timeout after 30s
- [ ] Customer disconnects during order → no errors logged
- [ ] Multi-replica: Customer and POS on different replicas → order completes

---

## Implementation Notes

### Rate Limiting

Store last order timestamp in socket data:
```typescript
socket.data.lastOrderTimestamp = Date.now();
```

Check before processing new order:
```typescript
const lastOrder = socket.data.lastOrderTimestamp || 0;
if (Date.now() - lastOrder < 60000) {
  // Reject with RATE_LIMIT_EXCEEDED
}
```

### Timeout Management

Store timeout ID in socket data with unique key:
```typescript
const timeoutId = setTimeout(() => {
  // Emit timeout error, update tracker
}, 30000);
socket.data[`timeout:order:${requestId}`] = timeoutId;
```

Cancel on POS response:
```typescript
const timeoutId = socket.data[`timeout:order:${requestId}`];
if (timeoutId) {
  clearTimeout(timeoutId);
  delete socket.data[`timeout:order:${requestId}`];
}
```

### Cleanup on Disconnect

Extend existing disconnect handler:
```typescript
// Clear all order timeout timers
Object.keys(socket.data).forEach(key => {
  if (key.startsWith('timeout:order:')) {
    clearTimeout(socket.data[key]);
  }
});
```

### Response Sanitization

Reuse existing `ensureNoSensitiveData()` utility before forwarding to customer:
```typescript
try {
  ensureNoSensitiveData(responsePayload);
  io.to(customerSocketId).emit(SocketIOEvents.EmitCustomerOrderResponse, responsePayload);
} catch (error) {
  // Log error, send generic error to customer
}
```

### Multi-Replica Considerations

- Use `io.to(customerSocketId)` for cross-replica response routing
- Persist tracker to database immediately (visible to all replicas)
- Timeout timers are local to each socket (no cross-replica coordination needed)
- Rate limit data stored in socket data (per-replica, acceptable for this use case)

---

## Event Flow Summary

**Success Path**:
1. Customer emits `customer:order:create` with order payload
2. Backend validates (connected, feature enabled, POS online, payload valid, rate limit)
3. Backend creates tracker with status "pending"
4. Backend emits `pos:order:create:request` to POS room
5. Backend starts 30s timeout timer
6. POS processes order, emits `pos:order:create:response`
7. Backend cancels timeout, updates tracker to "completed"
8. Backend sanitizes response, emits `customer:order:create:response` to customer
9. Customer receives confirmation with order ID and receipt number

**Timeout Path**:
1-5. Same as success path
6. 30 seconds elapse without POS response
7. Backend timeout fires, updates tracker to "timeout"
8. Backend emits `customer:order:create:response` with timeout error
9. Customer receives timeout notification

**Error Paths**:
- Not connected: Immediate rejection with `NOT_CONNECTED`
- Feature disabled: Immediate rejection with `FEATURE_DISABLED`
- POS offline: Immediate rejection with `POS_OFFLINE`
- Invalid payload: Immediate rejection with `INVALID_PAYLOAD`
- Rate limited: Immediate rejection with `RATE_LIMIT_EXCEEDED`
- POS error: Tracker updated to "failed", error forwarded to customer

---

## Configuration

**Timeout Duration**: 30 seconds (longer than menu/barcode requests due to order complexity)

**Rate Limit**: 1 order per 60 seconds per customer socket

**Validation Limits**:
- Customer name: 2-100 characters
- Customer phone: 10-15 digits
- Delivery address: 10-500 characters (required for delivery orders)
- Items: 1-50 per order
- Item quantity: 1-99 per item

**Database Indexes**:
- `requestId`: Unique index for fast lookup
- `publicSeatId`: Index for analytics queries
- `status`: Index for status-based queries
- `createdAt`: Index for time-range queries

---

## Security Considerations

1. **Input Sanitization**: All strings sanitized to remove HTML/script tags, SQL injection patterns
2. **Rate Limiting**: Prevents order spam (1 per minute per customer)
3. **Feature Flag Enforcement**: Respects `allowCustomerOrdering` flag
4. **POS Validation**: Always verify POS online before forwarding
5. **Response Sanitization**: Remove sensitive fields (documentId, machineUUID, licenseKey, tokens)
6. **Timeout Protection**: 30s timeout prevents indefinite waiting
7. **Payload Size Limits**: Max 50 items per order, reasonable string lengths
8. **No Sensitive Logging**: Never log full phone numbers, addresses, payment details

**Sensitive Fields Removed Before Customer Response**:
- documentId, machineUUID, licenseKey, license, user, userId, ownerId
- encryptionKey, apiKey, token, password, telemetry, fcmTokens

---

## Monitoring Metrics

**Order Metrics**:
- Order request rate per publicSeatId
- Order success rate (completed / total)
- Order timeout rate
- Average order processing time (request to response)
- Error rate by error code

**Alert Conditions**:
- Timeout rate > 10% (POS performance issues)
- Error rate > 20% (system issues)
- POS offline rate > 50% (connectivity issues)

**Log Events**:
- Order received: requestId, publicSeatId, itemCount, total
- Order forwarded: requestId, timestamp
- Order response: requestId, success, orderId
- Order timeout: requestId, publicSeatId, duration
- Validation failure: requestId, error reason
- POS offline rejection: requestId, publicSeatId
