# Customer-Facing Mobile App Integration Strategy

## Problem Statement

Your POS system currently has:
- **Users** who own licenses
- **Licenses** that allow multiple seat activations
- **Seats** (Key-Seats) representing individual POS devices (one device = one seat)

**New Requirement**: Enable end-customers (restaurant patrons, retail shoppers, etc.) to use a mobile app that connects to a specific POS device in real-time via Socket.IO to:
- View products/menu items
- Check prices by scanning barcodes
- Place orders directly
- See real-time updates

**Core Challenge**: How do we uniquely identify which POS device (seat) a customer should connect to, considering:
1. One license can have multiple seats (different business types: restaurant, retail, cafe, pharmacy)
2. Each seat is a different physical location/device
3. Customers need a simple way to connect to the correct POS
4. The solution must be production-ready, maintainable, and not overly complex

---

## Architecture Analysis

### Current Schema Structure

```
User (License Owner)
  └── License (maxSeats: 5, planType: Pro)
        ├── Seat 1 (Restaurant POS - Location A)
        ├── Seat 2 (Retail POS - Location B)
        ├── Seat 3 (Cafe POS - Location C)
        └── Seat 4 (Pharmacy POS - Location D)
```

### Current Identifiers

| Entity | Identifiers | Purpose |
|--------|------------|---------|
| User | `documentId`, `id`, `email` | User authentication |
| License | `documentId`, `licenseKey` (encrypted) | License validation |
| Key-Seat | `documentId`, `machineUUID` | Device identification |

### Socket.IO Communication Flow

```
POS App (Seat)                    Backend                    Mobile App (Owner)
     │                               │                              │
     │──seat:update (telemetry)─────►│                              │
     │                               │──seat:updated (broadcast)───►│
     │                               │   (to room: user:{userId})   │
```

**Current limitation**: Mobile apps subscribe to ALL seats owned by a user. There's no mechanism for end-customers to connect to a specific seat.

---

## Recommended Solution: Seat-Level Public Identifier

### Approach: Add `publicSeatId` to Key-Seat Schema

**Why this is the best approach:**

1. **Separation of Concerns**: Keeps customer-facing identifiers separate from internal system IDs
2. **Security**: Doesn't expose internal `documentId` or `machineUUID` to end-customers
3. **Flexibility**: Each seat can have its own customer-facing identity
4. **Scalability**: Works seamlessly with your existing multi-seat, multi-license architecture
5. **Simplicity**: Minimal schema changes, no complex relationship restructuring

### Schema Changes

```json
// src/api/key-seat/content-types/key-seat/schema.json
{
  "attributes": {
    "machineUUID": { "type": "string" },
    "publicSeatId": {
      "type": "string",
      "unique": true,
      "required": true,
      "regex": "^[A-Z0-9]{6,12}$"
    },
    "businessName": {
      "type": "string",
      "required": false
    },
    "businessType": {
      "type": "enumeration",
      "enum": ["restaurant", "retail", "cafe", "pharmacy", "other"],
      "default": "retail"
    },
    "allowCustomerApp": {
      "type": "boolean",
      "default": false
    },
    // ... existing fields
  }
}
```

### Implementation Details

#### 1. Public Seat ID Generation

```typescript
// src/api/key-seat/utils/public-id-generator.ts

/**
 * Generates a unique, customer-friendly seat identifier
 * Format: 6-12 uppercase alphanumeric characters
 * Examples: "REST001", "CAFE42A", "PHARMA123"
 */
export function generatePublicSeatId(businessType?: string): string {
  const prefix = getBusinessPrefix(businessType);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${random}`;
}

function getBusinessPrefix(businessType?: string): string {
  const prefixes = {
    restaurant: 'REST',
    retail: 'RETL',
    cafe: 'CAFE',
    pharmacy: 'PHRM',
    other: 'SEAT'
  };
  return prefixes[businessType || 'other'] || 'SEAT';
}

/**
 * Validates public seat ID format
 */
export function isValidPublicSeatId(id: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(id);
}
```

#### 2. Socket.IO Event Extensions

```typescript
// New events in src/socketio/events_constants.ts

export class SocketIOEvents {
  // ... existing events

  // Customer App Events
  static readonly OnCustomerConnect = "customer:connect";
  static readonly EmitCustomerConnectSuccess = "customer:connect:success";
  static readonly OnCustomerSubscribeToSeat = "customer:subscribe:seat";
  static readonly EmitCustomerSeatData = "customer:seat:data";
  static readonly OnCustomerPlaceOrder = "customer:order:place";
  static readonly OnCustomerQueryProduct = "customer:product:query";
}
```

#### 3. Customer Connection Handler

```typescript
// src/socketio/handlers/customer-app.handler.ts

export function setupCustomerAppHandlers(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  
  // Customer connects with publicSeatId (e.g., from QR code)
  socket.on(SocketIOEvents.OnCustomerConnect, async (payload: { publicSeatId: string }) => {
    try {
      const { publicSeatId } = payload;

      // Find seat by publicSeatId
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: { 
          publicSeatId,
          isActive: true,
          allowCustomerApp: true
        },
        populate: ['license'],
        status: 'published'
      });

      if (!seats.length) {
        socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
          success: false,
          error: 'Invalid or inactive seat ID'
        });
        return;
      }

      const seat = seats[0];

      // Join customer-specific room for this seat
      const customerRoomName = `seat:${seat.documentId}:customers`;
      socket.join(customerRoomName);

      // Store seat info in socket data
      socket.data.connectedSeatId = seat.documentId;
      socket.data.publicSeatId = publicSeatId;
      socket.data.clientType = 'customer';

      socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
        success: true,
        businessName: seat.businessName,
        businessType: seat.businessType
      });

      strapi.log.info(`[CustomerApp] Customer connected to seat ${publicSeatId}`);
    } catch (error) {
      strapi.log.error('[CustomerApp] Connection error:', error);
      socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
        success: false,
        error: 'Connection failed'
      });
    }
  });

  // Customer queries product (e.g., barcode scan)
  socket.on(SocketIOEvents.OnCustomerQueryProduct, async (payload: { barcode: string }) => {
    try {
      const { connectedSeatId } = socket.data;
      
      if (!connectedSeatId) {
        socket.emit(SocketIOEvents.EmitCustomerSeatData, {
          success: false,
          error: 'Not connected to a seat'
        });
        return;
      }

      // Forward query to POS device
      const posRoomName = `seat:${connectedSeatId}:pos`;
      io.to(posRoomName).emit('pos:product:query', {
        barcode: payload.barcode,
        customerId: socket.id
      });

      strapi.log.info(`[CustomerApp] Product query forwarded to POS: ${payload.barcode}`);
    } catch (error) {
      strapi.log.error('[CustomerApp] Product query error:', error);
    }
  });
}
```

#### 4. POS-to-Customer Broadcasting

```typescript
// Modify src/socketio/handlers/seat-update.handler.ts

async function notifyCustomersOfSeatUpdate(
  io: SocketIOServer,
  strapi: Core.Strapi,
  updatedSeat: any
): Promise<void> {
  try {
    // Notify customers connected to this specific seat
    const customerRoomName = `seat:${updatedSeat.documentId}:customers`;
    
    const customersInRoom = await io.in(customerRoomName).fetchSockets();
    
    if (customersInRoom.length > 0) {
      io.to(customerRoomName).emit(SocketIOEvents.EmitCustomerSeatData, {
        lastOrder: updatedSeat.realtimeTelemetry?.lastOrder,
        kpiSummary: updatedSeat.realtimeTelemetry?.kpiSummary,
        updatedAt: updatedSeat.updatedAt
      });

      strapi.log.info(`[CustomerApp] Notified ${customersInRoom.length} customers`);
    }
  } catch (error) {
    strapi.log.error('[CustomerApp] Error notifying customers:', error);
  }
}
```

---

## Alternative Approaches Considered (and Why They Were Rejected)

### ❌ Option 1: License-Level Identifier

**Approach**: Add `publicLicenseId` to License schema

**Why rejected**:
- One license can have multiple seats (different locations)
- Customers would connect to the license, not a specific POS device
- Would require additional logic to route customers to the correct seat
- Doesn't solve the "which device?" problem

### ❌ Option 2: Use Existing `machineUUID`

**Approach**: Expose `machineUUID` to customers

**Why rejected**:
- `machineUUID` is a technical identifier (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- Not user-friendly for QR codes or manual entry
- Exposes internal system architecture
- Security concern: reveals device fingerprinting details

### ❌ Option 3: Use `licenseKey`

**Approach**: Customers connect using the encrypted license key

**Why rejected**:
- License keys are encrypted and meant for POS activation, not customer access
- Security risk: exposing license keys to end-customers
- One license = multiple seats, doesn't identify specific device
- Violates principle of least privilege

### ❌ Option 4: Create Separate "Store" Entity

**Approach**: Add a new `Store` entity that relates to seats

**Why rejected**:
- Over-engineering: adds unnecessary complexity
- Your existing `Key-Seat` already represents a physical location/device
- Would require migration of existing data
- Increases maintenance burden
- Doesn't provide significant benefits over seat-level identifiers

---

## Implementation Roadmap

### Phase 1: Schema & Core Logic (Week 1)
1. ✅ Add `publicSeatId`, `businessName`, `businessType`, `allowCustomerApp` to Key-Seat schema
2. ✅ Create public ID generator utility
3. ✅ Add migration script to generate IDs for existing seats
4. ✅ Update seat creation logic to auto-generate public IDs

### Phase 2: Socket.IO Integration (Week 2)
1. ✅ Add customer app event constants
2. ✅ Create customer app handler
3. ✅ Modify seat update handler to broadcast to customers
4. ✅ Implement POS-to-customer query forwarding

### Phase 3: API Endpoints (Week 3)
1. ✅ `GET /api/seats/public/:publicSeatId` - Get seat info by public ID
2. ✅ `POST /api/seats/:seatId/toggle-customer-access` - Enable/disable customer app
3. ✅ `PATCH /api/seats/:seatId/business-info` - Update business name/type

### Phase 4: QR Code Generation (Week 4)
1. ✅ Generate QR codes containing `publicSeatId`
2. ✅ Admin panel UI for viewing/printing QR codes
3. ✅ Customer app deep linking (e.g., `myapp://connect?seat=REST001`)

---

## Security Considerations

### 1. Rate Limiting
```typescript
// Prevent brute-force seat ID guessing
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many connection attempts'
});

app.use('/api/seats/public', rateLimiter);
```

### 2. Seat Access Control
```typescript
// Only allow customer connections if explicitly enabled
filters: {
  publicSeatId,
  isActive: true,
  allowCustomerApp: true // Must be explicitly enabled
}
```

### 3. Data Exposure Limits
```typescript
// Only expose necessary data to customers
const customerSafeData = {
  businessName: seat.businessName,
  businessType: seat.businessType,
  // DO NOT expose: machineUUID, license info, telemetry, etc.
};
```

### 4. Connection Validation
```typescript
// Validate seat is online before allowing customer connections
if (!seat.isConnected) {
  return { success: false, error: 'POS device is offline' };
}
```

---

## Production Deployment Checklist

- [ ] Database migration for existing seats (generate `publicSeatId`)
- [ ] Add database index on `publicSeatId` for fast lookups
- [ ] Implement rate limiting on customer connection endpoints
- [ ] Set up monitoring for customer connection metrics
- [ ] Create admin UI for managing seat public IDs
- [ ] Generate and distribute QR codes to license owners
- [ ] Update Socket.IO Redis adapter configuration (already done)
- [ ] Load test customer connections (simulate 100+ concurrent customers per seat)
- [ ] Document customer app integration guide for mobile developers

---

## Why This Approach Wins

### ✅ Maintainability
- Minimal schema changes (4 new fields on existing entity)
- No complex relationship restructuring
- Easy to understand: one seat = one public ID = one physical location

### ✅ Scalability
- Works seamlessly with multi-seat licenses
- No performance impact (indexed lookups)
- Supports unlimited customers per seat (room-based Socket.IO)

### ✅ Security
- Public IDs are separate from internal system IDs
- Explicit opt-in via `allowCustomerApp` flag
- Rate limiting prevents abuse
- Minimal data exposure to customers

### ✅ User Experience
- Simple 6-12 character codes (easy to type, scan, share)
- Business-type prefixes make IDs recognizable (CAFE, REST, PHRM)
- QR code support for instant connection
- Works offline (QR codes printed on receipts, table tents, etc.)

### ✅ Production Ready
- Leverages existing Socket.IO infrastructure
- Compatible with Docker Swarm multi-replica setup
- No breaking changes to existing POS/mobile owner apps
- Incremental rollout possible (enable per-seat)

---

## Example User Flows

### Flow 1: Restaurant Customer Orders from Table
1. Customer scans QR code on table tent → `myapp://connect?seat=REST42A`
2. Mobile app connects via Socket.IO with `publicSeatId: "REST42A"`
3. Backend validates seat is active and allows customer access
4. Customer joins room `seat:{documentId}:customers`
5. Customer browses menu, places order
6. POS receives order via Socket.IO event
7. Customer receives real-time order status updates

### Flow 2: Retail Customer Checks Price
1. Customer scans product barcode in mobile app
2. App sends `customer:product:query` event with barcode
3. Backend forwards query to POS device in room `seat:{documentId}:pos`
4. POS responds with product info (name, price, stock)
5. Backend forwards response to customer
6. Customer sees price instantly

### Flow 3: Cafe Customer Views Live Order Queue
1. Customer connects to cafe's public seat ID
2. Subscribes to real-time updates
3. Receives `customer:seat:data` events when orders are processed
4. Sees their order number move up in the queue
5. Gets notification when order is ready

---

## Conclusion

**Recommended Approach**: Add `publicSeatId` to the Key-Seat schema.

This approach provides the optimal balance of:
- **Simplicity**: Minimal code changes, leverages existing architecture
- **Security**: Separate public identifiers, explicit access control
- **Scalability**: Works with multi-seat licenses, supports unlimited customers
- **Maintainability**: Easy to understand, test, and extend
- **Production Readiness**: No breaking changes, incremental rollout

The seat-level identifier is the natural choice because:
1. Seats already represent physical devices/locations
2. Customers connect to a specific POS, not a license or user
3. Each seat can have different business types and customer access policies
4. Aligns with your existing Socket.IO room-based architecture

**Next Steps**: Proceed with Phase 1 implementation (schema changes and ID generation).
