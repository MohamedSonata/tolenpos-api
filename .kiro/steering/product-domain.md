---
inclusion: always
---

# Product Domain: POS License Management System

## System Purpose

Strapi v5 backend managing POS software licensing, seat activations, real-time telemetry, and app distribution for multi-tenant SaaS.

## Core Domain Model

```
User (planType: FreeTrial|Pro|Enterprise)
  └── License (encrypted key, maxSeats, expiration)
        └── Key-Seat (machineUUID, telemetry, timezone)
              └── Seat-Telemetry-History (daily snapshots)
```

**Critical Relationships**:
- One User → Many Licenses
- One License → Many Key-Seats (up to maxSeats limit)
- One Key-Seat → Many Telemetry History records
- Subscription Plan defines feature access and seat limits

## Business Rules You Must Enforce

### License Activation Rules
1. **Seat Limit Enforcement**: Never allow activations exceeding `license.maxSeats`
2. **Unique Machine Binding**: One machineUUID = one active seat per license
3. **Encryption Required**: All license keys MUST use AES-256-GCM encryption via `src/api/license/utils/encryption.ts`
4. **Expiration Validation**: Check `license.expirationDate` and `license.isActive` before any activation
5. **Deactivation Frees Seats**: Deactivating a seat decrements active count, allowing reuse

### Telemetry & Real-Time Updates
1. **Timezone Awareness**: Each seat stores IANA timezone; use for local time calculations
2. **Socket.IO Broadcasting**: Seat updates MUST emit `SocketIOEvents.OnSeatUpdate` to subscribed clients
3. **Daily Snapshots**: Cron job creates `seat-telemetry-history` records for analytics
4. **Telemetry Fields**: `lastSeen`, `appVersion`, `osInfo`, `isOnline` tracked per seat

### Multi-Replica Safety
1. **Distributed Locks Required**: All cron jobs MUST use `withLock()` from `src/cron/utils/distributed-lock.ts`
2. **Redis Coordination**: Locks prevent duplicate execution across Docker Swarm replicas
3. **Socket.IO Adapter**: Redis adapter ensures events reach all replicas

## Entity Schemas (Key Fields)

### License
- `licenseKey` (encrypted string)
- `maxSeats` (integer)
- `expirationDate` (datetime)
- `expirationType` (enum: Trial|Subscription|Perpetual)
- `isActive` (boolean)
- `user` (relation)
- `seats` (relation to key-seat)

### Key-Seat
- `machineUUID` (unique identifier)
- `isActive` (boolean)
- `timezone` (IANA string, e.g., "America/New_York")
- `lastSeen` (datetime)
- `telemetry` (JSON: appVersion, osInfo, etc.)
- `license` (relation)

### User (Extended)
- `planType` (enum: FreeTrial|Pro|Enterprise)
- `fcmTokens` (component: array of Firebase tokens)
- Standard Strapi users-permissions fields

## Integration Behavior

### Socket.IO Events (src/socketio/events_constants.ts)
- `seat:update` - Client sends telemetry
- `seat:updated` - Broadcast to subscribed clients
- `seat:subscribe` - Mobile apps subscribe to license updates
- `license:updated` - Notify on license changes

### External Services
- **Mailgun**: License expiry warnings, activation notifications
- **Firebase**: Push notifications to POS clients via FCM tokens
- **WhatsApp API**: Customer support communications
- **Redis**: Session storage, distributed locks, Socket.IO pub/sub

## Common Operations

### Activating a Seat
1. Validate license exists and `isActive === true`
2. Check `seats.length < maxSeats`
3. Verify machineUUID not already active
4. Create key-seat with `isActive: true`
5. Emit Socket.IO event to subscribers
6. Send confirmation email via Mailgun

### Deactivating a Seat
1. Find seat by machineUUID and license
2. Set `isActive: false`
3. Emit Socket.IO event
4. Free up seat count for reuse

### Checking for App Updates
1. Client queries `app-release` by platform
2. Compare client version with latest release
3. Return update info + change logs if newer version exists

## Deployment Constraints

- **3 replicas** in production Docker Swarm
- **Sticky sessions** required for WebSocket connections (Nginx config)
- **Redis mandatory** for distributed locks and Socket.IO adapter
- **PostgreSQL** for persistent data
- **Environment variables** control encryption keys, API keys, cron schedules

## When Writing Code

- Use **Document Service API** (`strapi.documents()`) not Entity Service
- Always **populate relations** explicitly in queries
- Cron jobs **must acquire distributed lock** before execution
- Socket events **use constants** from `events_constants.ts`
- License keys **always encrypted** before storage
- Validate **seat limits** before any activation logic
- Consider **timezone** when displaying/calculating seat activity times
