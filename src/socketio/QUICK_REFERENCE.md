# Socket.IO Quick Reference

## POS App Connection

### Required Parameters
```javascript
{
  token: "license-key",           // License key from license table
  userDocumentId: "user-doc-id",  // User's document ID
  machineUUID: "machine-uuid"     // Unique machine identifier
}
```

### Connection Example
```javascript
import io from 'socket.io-client';

const socket = io('https://your-server.com', {
  query: {
    token: "LIC-2024-ABC123",
    userDocumentId: "jvuandzqwq8258v786juhm6q",
    machineUUID: "b5363c7156b0fc80c6804e3151f0f651a8450c7fb09ae0d838f30c37532f7d17"
  }
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('UnauthorizedError', (error) => {
  console.error('Auth failed:', error);
});
```

## Mobile App Connection

### Required Parameters
```javascript
{
  token: "jwt-token"  // JWT from Strapi authentication
}
```

### Connection Example
```javascript
const socket = io('https://your-server.com', {
  query: {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
});
```

## Server-Side: Emit to Specific POS Machine

```typescript
// Find and emit to a specific POS machine
async function emitToPOS(machineUUID: string, eventName: string, data: any) {
  const keySeat = await strapi.documents('api::key-seat.key-seat').findFirst({
    filters: { machineUUID, isActive: true }
  });
  
  if (keySeat?.userSocketId) {
    io.to(keySeat.userSocketId).emit(eventName, data);
  }
}

// Usage
await emitToPOS('machine-uuid-here', 'update-inventory', { items: [...] });
```

## Server-Side: Check Client Type

```typescript
import { socketEventManager } from './socket-io-manager';

// In your socket event handler
socket.on('some-event', (data) => {
  if (socketEventManager.isPOSClient(socket)) {
    const machineUUID = socketEventManager.getMachineUUID(socket);
    // Handle POS-specific logic
  } else if (socketEventManager.isMobileClient(socket)) {
    // Handle mobile-specific logic
  }
});
```

## Database Queries

### Find all connected POS machines for a user
```typescript
const licenses = await strapi.documents('api::license.license').findMany({
  filters: {
    user: { documentId: userDocumentId },
    isActive: true
  },
  populate: ['seats']
});

const connectedMachines = [];
for (const license of licenses) {
  for (const seat of license.seats || []) {
    if (seat.isActive && seat.userSocketId) {
      connectedMachines.push({
        machineUUID: seat.machineUUID,
        socketId: seat.userSocketId
      });
    }
  }
}
```

### Check if a POS machine is online
```typescript
const keySeat = await strapi.documents('api::key-seat.key-seat').findFirst({
  filters: { machineUUID: 'your-machine-uuid' }
});

const isOnline = keySeat?.userSocketId ? true : false;
```

## Common Events

### Server → POS
```typescript
// Inventory update
io.to(socketId).emit('inventory:update', { items: [...] });

// Price change
io.to(socketId).emit('price:change', { productId: '123', newPrice: 99.99 });

// System message
io.to(socketId).emit('system:message', { message: 'Server maintenance in 10 minutes' });
```

### POS → Server
```typescript
// Sale completed
socket.emit('sale:completed', { 
  saleId: '123',
  total: 150.00,
  items: [...]
});

// Sync request
socket.emit('sync:request', { lastSyncTime: '2026-04-01T12:00:00Z' });
```

## Error Handling

### Authentication Errors
```javascript
socket.on('UnauthorizedError', (error) => {
  // error.error.status === 401
  // error.error.message === "Missing or invalid credentials"
  
  // Handle: Show login screen, refresh token, etc.
});
```

### Connection Errors
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
  // Handle: Retry, show offline mode, etc.
});

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server disconnected the client, reconnect manually
    socket.connect();
  }
  // else: automatic reconnection will be attempted
});
```

## Socket Properties Reference

### POS Socket
```typescript
socket.userID              // User document ID
socket.strategeyName       // "pos-api-key"
socket.clientType          // "pos"
socket.machineUUID         // Machine UUID
socket.keySeatDocumentId   // Key-seat document ID
```

### Mobile Socket
```typescript
socket.userID              // User document ID
socket.strategeyName       // "users-permissions"
socket.clientType          // "mobile"
```

## Validation Checklist

Before connecting, ensure:
- [ ] License exists and is active
- [ ] License is not expired (if expiring type)
- [ ] User owns the license
- [ ] Key-seat exists for machine UUID
- [ ] Key-seat is active
- [ ] Key-seat is linked to the license

## Troubleshooting

### POS can't connect
1. Check license key is correct
2. Verify license is active (`isActive: true`)
3. Check license expiration date
4. Verify user document ID matches license owner
5. Confirm key-seat exists with correct machine UUID
6. Verify key-seat is active

### Socket ID not updating
1. Check TypeScript types are regenerated (`npm run strapi ts:generate-types`)
2. Verify `userSocketId` field exists in key-seat schema
3. Check server logs for update errors

### Events not received
1. Verify socket is connected (`socket.connected === true`)
2. Check socket ID is stored in database
3. Verify event name matches exactly
4. Check server logs for emission errors
