---
inclusion: always
---

# Strapi License Management Backend

## Architecture Overview

Docker Swarm deployed Strapi v5 backend for POS license management with real-time telemetry via Socket.IO.

**Core Domain**: License keys → Seat activations → Real-time telemetry

## Key Entities & Relations

```
User (planType: FreeTrial|Pro|Enterprise)
  └── License (licenseKey, maxSeats, expirationType, isActive)
        └── Key-Seat (machineUUID, telemetry, isActive, timezone)
              └── Seat-Telemetry-History (daily snapshots)
```

## Directory Structure

```
src/
├── api/{entity}/                 # Strapi APIs
│   ├── content-types/{entity}/schema.json
│   ├── controllers/              # HTTP handlers
│   ├── services/                 # Business logic
│   └── routes/
├── socketio/                     # Real-time communication
│   ├── handlers/                 # Event handlers
│   ├── events_constants.ts       # Socket event names
│   └── redis-adapter.ts          # Multi-replica support
├── cron/
│   ├── jobs/                     # Scheduled tasks
│   └── utils/distributed-lock.ts # Redis locking
└── extensions/users-permissions/ # Custom user schema

config/
├── cron-tasks.ts                 # Cron registration
├── plugins.ts                    # Email (Mailgun), auth config
└── server.ts                     # Cron enabled
```

## Code Patterns

### Document Service API (Strapi v5)
```typescript
// Always use Document Service, NOT Entity Service
await strapi.documents('api::license.license').findMany({
  filters: { licenseKey },
  populate: { user: true, seats: true },
  status: 'published'
});

await strapi.documents('api::license.license').create({
  data: { ... },
  status: 'published'
});
```

### Controller Pattern
```typescript
export default factories.createCoreController('api::license.license', ({ strapi }) => ({
  async customAction(ctx) {
    // 1. Validate input
    // 2. Business logic
    // 3. Return ctx.send({ data }) or ctx.badRequest()
  }
}));
```

### Distributed Lock for Cron Jobs
```typescript
import { withLock } from '../utils/distributed-lock';

export async function executeJob(strapi: Core.Strapi) {
  const result = await withLock(strapi, { key: 'job-name', ttl: 300 }, async () => {
    // Only ONE replica executes this
  });
}
```

### Socket.IO Events
```typescript
// Use constants from events_constants.ts
import { SocketIOEvents } from '../events_constants';
socket.emit(SocketIOEvents.OnSeatUpdate, payload);
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ENCRYPTION_KEY` | AES-256-GCM for license keys |
| `MAILGUN_APIKEY` | Email provider |
| `TELEMETRY_SNAPSHOT_SCHEDULE` | Cron schedule (default: every minute) |
| `ENABLE_REDIS_ADAPTER` | Multi-replica Socket.IO |

## Critical Rules

1. **Always use Document Service API** - Never use deprecated Entity Service
2. **Cron jobs MUST use distributed locks** - Prevents duplicate execution across replicas
3. **License keys are encrypted** - Use `generateLicenseKey()` / `decryptLicenseKey()` from `src/api/license/utils/encryption.ts`
4. **Populate relations explicitly** - Strapi doesn't auto-populate
5. **Timezone-aware telemetry** - Each seat stores its own IANA timezone

## Socket.IO Event Flow

```
POS App                          Backend                    Mobile App
  │                                │                            │
  │──seat:update (telemetry)──────►│                            │
  │◄─seat:update:success──────────│                            │
  │                                │──seat:updated (broadcast)─►│
  │                                │                            │
  │                                │◄─seat:subscribe────────────│
  │                                │──seat:subscribe:success───►│
```

## Docker Swarm Notes

- 3 replicas in production
- Redis required for: distributed locks, Socket.IO adapter, shared state
- Nginx sticky sessions for WebSocket connections
