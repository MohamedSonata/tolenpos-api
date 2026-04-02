# POS Socket.IO Implementation Summary

## What Was Implemented

### 1. Dual Authentication System
Added support for both Mobile (JWT) and POS (API Key) authentication methods in the same Socket.IO server.

### 2. POS Authentication Flow
- Detects POS clients by presence of `machineUUID` and `userDocumentId` parameters
- Validates license key (token) against the license table
- Checks license ownership and expiration
- Validates key-seat exists and is active for the machine UUID
- Sets socket properties: `userID`, `clientType`, `machineUUID`, `keySeatDocumentId`

### 3. Socket ID Storage
- **Mobile clients**: Socket ID stored in `user.socketId` field
- **POS clients**: Socket ID stored in `key-seat.userSocketId` field
- Automatic cleanup on disconnect with race condition protection

### 4. Connection Handler Updates
- Detects client type (mobile vs POS) after authentication
- Routes to appropriate socket ID storage method
- Stores client metadata in `socket.data` for easy access

### 5. Helper Methods
Added to `SocketEventManager`:
- `isPOSClient(socket)` - Check if socket is POS client
- `isMobileClient(socket)` - Check if socket is mobile client
- `getMachineUUID(socket)` - Get machine UUID from POS socket
- `getClientType(socket)` - Get client type

## Files Modified

1. **src/socketio/services/index.ts**
   - Added `authenticatePOSConnection()` method
   - Updated `authenticateUserConnection()` to detect and route authentication
   - Added `keySeatDocumentId` to socket properties

2. **src/socketio/connection.handler.ts**
   - Added `updateKeySeatSocketId()` for POS clients
   - Added `clearKeySeatSocketId()` for disconnect cleanup
   - Added `clearUserSocketId()` for mobile client cleanup
   - Updated connection flow to handle both client types

3. **src/socketio/socket-io-manager.ts**
   - Added helper methods for client type detection

4. **src/api/key-seat/content-types/key-seat/schema.json**
   - Added `userSocketId` field to store POS socket IDs

## POS App Connection Requirements

```javascript
const socket = io(SERVER_URL, {
  query: {
    token: "license-key",              // Required: License key
    userDocumentId: "user-doc-id",     // Required: User document ID
    machineUUID: "machine-uuid"        // Required: Machine UUID
  }
});
```

## Database Schema Changes

### key-seat table
Added field:
```json
{
  "userSocketId": {
    "type": "string"
  }
}
```

## Connection Flow

### POS Client Connection:
1. Client sends: token, userDocumentId, machineUUID
2. Server validates license and key-seat
3. Socket properties set with client type "pos"
4. Key-seat.userSocketId updated with socket ID
5. Socket.data populated with user info and client metadata

### POS Client Disconnection:
1. Server detects disconnect
2. Retrieves keySeatDocumentId from socket.data
3. Verifies socket ID matches (prevents race conditions)
4. Clears key-seat.userSocketId

## Usage Examples

### Check Client Type
```typescript
if (socketEventManager.isPOSClient(socket)) {
  const machineUUID = socketEventManager.getMachineUUID(socket);
  // Handle POS-specific logic
}
```

### Emit to Specific POS Machine
```typescript
const keySeat = await strapi.documents('api::key-seat.key-seat').findFirst({
  filters: { machineUUID: "machine-uuid", isActive: true }
});

if (keySeat?.userSocketId) {
  io.to(keySeat.userSocketId).emit('event-name', data);
}
```

## Testing Checklist

- [ ] POS client can connect with valid credentials
- [ ] POS client connection fails with invalid license
- [ ] POS client connection fails with expired license
- [ ] POS client connection fails with inactive key-seat
- [ ] Socket ID is stored in key-seat on connection
- [ ] Socket ID is cleared on disconnect
- [ ] Mobile client still works with JWT authentication
- [ ] Multiple POS machines can connect simultaneously
- [ ] Events can be sent to specific POS machines
- [ ] Race conditions handled on disconnect/reconnect

## Next Steps

1. Test the implementation with actual POS app
2. Add monitoring for POS connections
3. Implement rate limiting for authentication attempts
4. Add telemetry updates for connected POS machines
5. Create admin dashboard to view connected POS machines
