---
inclusion: always
---

# Coding Standards

## Critical API Rules

**ALWAYS use Document Service API (Strapi v5)** - Never use deprecated Entity Service:
```typescript
// ✅ CORRECT - Document Service
await strapi.documents('api::license.license').findMany({
  filters: { licenseKey },
  populate: { user: true, seats: true },
  status: 'published'
});

// ❌ WRONG - Entity Service (deprecated)
await strapi.entityService.findMany('api::license.license', { ... });
```

**ALWAYS populate relations explicitly** - Strapi doesn't auto-populate:
```typescript
// ✅ Include populate for relations
populate: { user: true, seats: { fields: ['machineUUID', 'isActive'] } }
```

## TypeScript Standards

- **Explicit types required**: Function parameters, return values, and complex objects
- **Never use `any`**: Use `unknown` for truly dynamic data, then narrow with type guards
- **Import Strapi types**: `import type { Core } from '@strapi/strapi'`
- **Type business logic**: Create interfaces for domain models beyond Strapi schemas

```typescript
// ✅ Good
async function activateSeat(licenseKey: string, machineUUID: string): Promise<{ success: boolean; seatId?: number }> {
  // ...
}

// ❌ Bad
async function activateSeat(licenseKey, machineUUID) {
  // ...
}
```

## Controller Pattern

Controllers handle HTTP concerns only - delegate business logic to services:

```typescript
export default factories.createCoreController('api::license.license', ({ strapi }) => ({
  async activate(ctx) {
    const { licenseKey, machineUUID } = ctx.request.body;
    
    // Validate input
    if (!licenseKey || !machineUUID) {
      return ctx.badRequest('Missing required fields');
    }
    
    // Delegate to service
    try {
      const result = await strapi.service('api::license.license').activateSeat(licenseKey, machineUUID);
      return ctx.send({ data: result });
    } catch (error) {
      strapi.log.error('Seat activation failed:', error);
      return ctx.internalServerError('Activation failed');
    }
  }
}));
```

## Service Pattern

Services contain business logic and data access:

```typescript
export default factories.createCoreService('api::license.license', ({ strapi }) => ({
  async activateSeat(licenseKey: string, machineUUID: string) {
    // 1. Fetch with relations
    const licenses = await strapi.documents('api::license.license').findMany({
      filters: { licenseKey, isActive: true },
      populate: { seats: true },
      status: 'published'
    });
    
    if (!licenses.length) throw new Error('Invalid license');
    
    const license = licenses[0];
    
    // 2. Business rule validation
    if (license.seats.length >= license.maxSeats) {
      throw new Error('Seat limit reached');
    }
    
    // 3. Create seat
    const seat = await strapi.documents('api::key-seat.key-seat').create({
      data: { license: license.documentId, machineUUID, isActive: true },
      status: 'published'
    });
    
    // 4. Emit Socket.IO event
    strapi.io.emit(SocketIOEvents.OnSeatUpdate, { licenseKey, seat });
    
    return seat;
  }
}));
```

## Cron Job Pattern

**MANDATORY**: Use distributed locks to prevent duplicate execution across replicas:

```typescript
import { withLock } from '../utils/distributed-lock';
import type { Core } from '@strapi/strapi';

export async function dailySnapshot(strapi: Core.Strapi) {
  const result = await withLock(
    strapi,
    { key: 'daily-snapshot', ttl: 300 },
    async () => {
      strapi.log.info('Starting daily snapshot...');
      
      // Job logic here - only ONE replica executes this
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: { isActive: true },
        status: 'published'
      });
      
      // Process seats...
      
      strapi.log.info(`Snapshot complete: ${seats.length} seats processed`);
      return { processed: seats.length };
    }
  );
  
  if (!result) {
    strapi.log.warn('Could not acquire lock - another replica is running this job');
  }
}
```

## Socket.IO Events

**ALWAYS use constants** from `src/socketio/events_constants.ts`:

```typescript
import { SocketIOEvents } from '../socketio/events_constants';

// ✅ CORRECT
strapi.io.emit(SocketIOEvents.OnSeatUpdate, payload);

// ❌ WRONG - magic strings
strapi.io.emit('seat:updated', payload);
```

## License Key Encryption

**ALWAYS encrypt license keys** using the utility:

```typescript
import { generateLicenseKey, decryptLicenseKey } from '../utils/encryption';

// Creating a license
const encryptedKey = generateLicenseKey();
await strapi.documents('api::license.license').create({
  data: { licenseKey: encryptedKey, ... }
});

// Reading a license (decrypt for client)
const decrypted = decryptLicenseKey(license.licenseKey);
```

## Error Handling

```typescript
// ✅ Structured error handling
try {
  const result = await riskyOperation();
  return ctx.send({ data: result });
} catch (error) {
  strapi.log.error('Operation failed:', { context: 'activateSeat', error });
  
  if (error.message.includes('Seat limit')) {
    return ctx.badRequest('Maximum seats reached');
  }
  
  return ctx.internalServerError('Operation failed');
}

// ❌ Don't expose internal errors
catch (error) {
  return ctx.send({ error: error.stack }); // NEVER do this
}
```

## Query Optimization

```typescript
// ✅ Single query with populate
const license = await strapi.documents('api::license.license').findFirst({
  filters: { licenseKey },
  populate: { user: true, seats: { filters: { isActive: true } } }
});

// ❌ N+1 query problem
const licenses = await strapi.documents('api::license.license').findMany();
for (const license of licenses) {
  const seats = await strapi.documents('api::key-seat.key-seat').findMany({
    filters: { license: license.documentId }
  });
}
```

## Timezone Handling

Each seat stores IANA timezone - use for local time calculations:

```typescript
import { DateTime } from 'luxon';

const seat = await strapi.documents('api::key-seat.key-seat').findFirst({ ... });
const localTime = DateTime.now().setZone(seat.timezone);
```

## Code Organization

- **Controllers**: HTTP validation, response formatting (< 30 lines per action)
- **Services**: Business logic, data access, Socket.IO events
- **Utils**: Pure functions, encryption, formatting
- **Cron jobs**: Scheduled tasks with distributed locks
- **Socket handlers**: Real-time event processing

## Security Checklist

- [ ] Input validation in controllers
- [ ] License keys encrypted before storage
- [ ] Sensitive data not logged (keys, tokens, passwords)
- [ ] Environment variables for secrets (never hardcode)
- [ ] Authentication checked for protected routes
- [ ] Seat limits enforced before activation
- [ ] Expiration dates validated

## Performance Checklist

- [ ] Relations populated in single query (not in loops)
- [ ] Pagination for large datasets (`start`, `limit` params)
- [ ] Redis used for distributed locks and Socket.IO adapter
- [ ] Expensive operations cached when possible
- [ ] Socket.IO used for real-time updates (not polling)
- [ ] Database indexes defined in schema.json for filtered fields
