# Socket.IO Authentication Guide

This guide explains how to authenticate with the Socket.IO server for both Mobile and POS applications.

## Authentication Methods

The server supports two authentication methods:

### 1. Mobile App Authentication (JWT)

Mobile apps authenticate using JWT tokens from the users-permissions plugin.

**Connection Parameters:**
```javascript
const socket = io(SERVER_URL, {
  query: {
    token: "your-jwt-token-here"
  }
});
```

**Authentication Flow:**
1. Client sends JWT token in query parameters
2. Server verifies token using Strapi JWT secret
3. On success: Socket is associated with user ID and strategy "users-permissions"
4. On failure: UnauthorizedError event is emitted and connection may be rejected

### 2. POS App Authentication (API Key)

POS applications authenticate using license keys with machine UUID validation.

**Connection Parameters:**
```javascript
const socket = io(SERVER_URL, {
  query: {
    token: "license-key-here",
    userDocumentId: "user-document-id",
    machineUUID: "unique-machine-identifier"
  }
});
```

**Authentication Flow:**
1. Client sends license key (token), user document ID, and machine UUID
2. Server validates:
   - License exists and is active
   - License belongs to the specified user
   - License is not expired (for expiring licenses)
   - Key-seat exists for the machine UUID
   - Key-seat is active and linked to the license
3. On success: Socket is associated with user ID, machine UUID, and strategy "pos-api-key"
4. On failure: UnauthorizedError event is emitted

**Validation Checks:**
- License must have `isActive: true`
- For expiring licenses, `expiresAt` must be in the future
- User must own the license (license.user.documentId matches userDocumentId)
- Key-seat must exist with matching machineUUID and license
- Key-seat must have `isActive: true`

## Socket Properties After Authentication

### Mobile App Socket:
```typescript
socket.userID = "user-id"
socket.strategeyName = "users-permissions"
socket.clientType = "mobile"
```

**Database Update:**
- User's `socketId` field is updated with the current socket ID
- On disconnect, the `socketId` is cleared

### POS App Socket:
```typescript
socket.userID = "user-id"
socket.strategeyName = "pos-api-key"
socket.clientType = "pos"
socket.machineUUID = "machine-uuid"
socket.keySeatDocumentId = "key-seat-document-id"
```

**Database Update:**
- Key-seat's `userSocketId` field is updated with the current socket ID
- On disconnect, the `userSocketId` is cleared (with race condition protection)
- This allows you to find and emit events to specific POS machines

## Error Handling

On authentication failure, the server emits an `UnauthorizedError` event:

```javascript
socket.on('UnauthorizedError', (data) => {
  console.error('Authentication failed:', data);
  // data structure:
  // {
  //   socketConnected: boolean,
  //   credentialsExp: true,
  //   error: {
  //     status: 401,
  //     name: "UnauthorizedError",
  //     message: "Missing or invalid credentials",
  //     details: {}
  //   }
  // }
});
```

## Helper Methods

The SocketEventManager provides helper methods to check client type:

```typescript
import { socketEventManager } from './socket-io-manager';

// Check if socket is from POS app
if (socketEventManager.isPOSClient(socket)) {
  const machineUUID = socketEventManager.getMachineUUID(socket);
  // Handle POS-specific logic
}

// Check if socket is from mobile app
if (socketEventManager.isMobileClient(socket)) {
  // Handle mobile-specific logic
}

// Get client type
const clientType = socketEventManager.getClientType(socket); // 'mobile' | 'pos' | undefined
```

## Database Schema Requirements

### License Schema
```json
{
  "licenseKey": "string",
  "isActive": "boolean",
  "expirationType": "perpetual | expiring",
  "expiresAt": "datetime",
  "user": "relation to user"
}
```

### Key-Seat Schema
```json
{
  "machineUUID": "string",
  "userSocketId": "string",
  "isActive": "boolean",
  "license": "relation to license"
}
```

**Note:** The `userSocketId` field is automatically updated when a POS client connects and cleared when it disconnects.

## Security Notes

1. Always use HTTPS/WSS in production
2. Keep license keys secure and never expose them in client-side code
3. Machine UUIDs should be unique and persistent per device
4. Regularly audit active key-seats and licenses
5. Implement rate limiting for authentication attempts
6. Monitor for suspicious authentication patterns

## Emitting Events to Specific POS Machines

You can emit events to specific POS machines by finding their socket ID from the key-seat table:

```typescript
// Example: Send event to a specific POS machine
async function sendEventToPOSMachine(machineUUID: string, eventName: string, data: any) {
  // Find the key-seat with the machine UUID
  const keySeat = await strapi.documents('api::key-seat.key-seat').findFirst({
    filters: {
      machineUUID: machineUUID,
      isActive: true,
    },
  });

  if (keySeat && keySeat.userSocketId) {
    // Emit to the specific socket
    io.to(keySeat.userSocketId).emit(eventName, data);
    console.log(`Event sent to POS machine ${machineUUID}`);
  } else {
    console.log(`POS machine ${machineUUID} is not connected`);
  }
}

// Example: Send event to all POS machines of a user
async function sendEventToUserPOSMachines(userDocumentId: string, eventName: string, data: any) {
  // Find all licenses for the user
  const licenses = await strapi.documents('api::license.license').findMany({
    filters: {
      user: {
        documentId: userDocumentId,
      },
      isActive: true,
    },
    populate: ['seats'],
  });

  // Get all active key-seats with socket IDs
  for (const license of licenses) {
    if (license.seats) {
      for (const seat of license.seats) {
        if (seat.isActive && seat.userSocketId) {
          io.to(seat.userSocketId).emit(eventName, data);
        }
      }
    }
  }
}
```
