---
inclusion: always
---

# Technology Stack & Critical APIs

## Core Framework - Strapi v5

**Strapi 5.37.1** - Headless CMS (Node.js >=20.0.0 <=24.x.x, TypeScript 5.x)

### CRITICAL: Document Service API (v5)

**ALWAYS use Document Service** - Entity Service is deprecated:

```typescript
// ✅ CORRECT - Document Service API
await strapi.documents('api::license.license').findMany({
  filters: { licenseKey },
  populate: { user: true, seats: true },
  status: 'published'
});

await strapi.documents('api::license.license').create({
  data: { ... },
  status: 'published'
});

// ❌ WRONG - Deprecated Entity Service
await strapi.entityService.findMany('api::license.license', { ... });
```

**Key differences from v4**:
- Use `strapi.documents()` not `strapi.entityService`
- Always specify `status: 'published'` in queries
- Use `documentId` for relations, not `id`
- Populate relations explicitly - no auto-population

## Database

- **PostgreSQL** (production) - pg ^8.13.1
- **SQLite** (development) - better-sqlite3 12.4.1
- **Migration path**: `.tmp/data.db` (dev) → PostgreSQL (prod)

## Real-Time Communication

**Socket.IO ^4.8.1** with Redis adapter for multi-replica support:

```typescript
// Event constants defined in src/socketio/events_constants.ts
import { SocketIOEvents } from '../socketio/events_constants';
strapi.io.emit(SocketIOEvents.OnSeatUpdate, payload);
```

**Redis ^4.7.0** - Required for:
- Socket.IO adapter (@socket.io/redis-adapter ^8.3.0)
- Distributed locks (cron jobs)
- Session storage

## External Service Integration

| Service | Package | Purpose |
|---------|---------|---------|
| Firebase | firebase-admin ^13.4.0 | Push notifications to POS clients |
| Mailgun | @strapi/provider-email-mailgun | License expiry, activation emails |
| WhatsApp | wasenderapi ^0.1.5 | Customer support messaging |

## Deployment Architecture

**Docker Swarm** - 3 replicas in production:
- **Nginx** with sticky sessions (required for WebSocket connections)
- **Redis** for distributed state coordination
- **PostgreSQL** for persistent data

### Distributed Cron Jobs

**MANDATORY pattern** - Use distributed locks to prevent duplicate execution:

```typescript
import { withLock } from '../utils/distributed-lock';

export async function cronJob(strapi: Core.Strapi) {
  const result = await withLock(
    strapi,
    { key: 'job-name', ttl: 300 },
    async () => {
      // Only ONE replica executes this block
    }
  );
}
```

## TypeScript Configuration

- **Strict mode enabled** - Explicit types required
- **Never use `any`** - Use `unknown` with type guards
- **Import Strapi types**: `import type { Core } from '@strapi/strapi'`

## Admin Panel (React)

- React ^18.0.0
- React Router DOM ^6.0.0
- Styled Components ^6.0.0
- Custom admin extensions in `src/admin/`

## Environment Variables (Critical)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ENCRYPTION_KEY` | Yes | AES-256-GCM for license keys |
| `MAILGUN_APIKEY` | Yes | Email provider authentication |
| `ENABLE_REDIS_ADAPTER` | Production | Multi-replica Socket.IO |
| `TELEMETRY_SNAPSHOT_SCHEDULE` | No | Cron schedule (default: `* * * * *`) |

## Package Management

- **npm** - Primary package manager
- Lock file: `package-lock.json`
- Node version managed via Docker base image
