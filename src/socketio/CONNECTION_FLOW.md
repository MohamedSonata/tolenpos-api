# Socket.IO Connection Flow Diagram

## Mobile App Connection Flow

```
┌─────────────┐
│ Mobile App  │
└──────┬──────┘
       │
       │ Connect with: { token: "jwt-token" }
       │
       ▼
┌─────────────────────────────────────┐
│  authenticateUserConnection()       │
│  - Detects: No machineUUID          │
│  - Uses: JWT verification           │
└──────┬──────────────────────────────┘
       │
       │ JWT Valid?
       │
       ▼ YES
┌─────────────────────────────────────┐
│  Socket Properties Set:             │
│  - userID                           │
│  - strategeyName: "users-permissions"│
│  - clientType: "mobile"             │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  getUserInfo()                      │
│  - Fetch user from database         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  updateUserSocketId()               │
│  - Update user.socketId             │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  ✓ Connected & Authenticated        │
└─────────────────────────────────────┘
```

## POS App Connection Flow

```
┌─────────────┐
│   POS App   │
└──────┬──────┘
       │
       │ Connect with: {
       │   token: "license-key",
       │   userDocumentId: "user-id",
       │   machineUUID: "machine-uuid"
       │ }
       │
       ▼
┌─────────────────────────────────────┐
│  authenticateUserConnection()       │
│  - Detects: machineUUID present    │
│  - Routes to: authenticatePOSConnection()│
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  authenticatePOSConnection()        │
│  1. Find license by licenseKey      │
│  2. Check license.isActive          │
│  3. Check license expiration        │
│  4. Verify license.user matches     │
│  5. Find key-seat by machineUUID    │
│  6. Check key-seat.isActive         │
└──────┬──────────────────────────────┘
       │
       │ All Valid?
       │
       ▼ YES
┌─────────────────────────────────────┐
│  Socket Properties Set:             │
│  - userID                           │
│  - strategeyName: "pos-api-key"     │
│  - clientType: "pos"                │
│  - machineUUID                      │
│  - keySeatDocumentId                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  getUserInfo()                      │
│  - Fetch user from database         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  updateKeySeatSocketId()            │
│  - Update key-seat.userSocketId     │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  ✓ Connected & Authenticated        │
└─────────────────────────────────────┘
```

## Disconnection Flow

### Mobile App Disconnect
```
┌─────────────────────────────────────┐
│  Socket Disconnect Event            │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  handleDisconnection()              │
│  - Get clientType from socket.data  │
│  - clientType === "mobile"          │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  clearUserSocketId()                │
│  - Set user.socketId = null         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  ✓ Cleanup Complete                 │
└─────────────────────────────────────┘
```

### POS App Disconnect
```
┌─────────────────────────────────────┐
│  Socket Disconnect Event            │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  handleDisconnection()              │
│  - Get clientType from socket.data  │
│  - clientType === "pos"             │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  clearKeySeatSocketId()             │
│  1. Fetch key-seat by documentId    │
│  2. Verify socketId matches         │
│  3. Set key-seat.userSocketId = null│
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  ✓ Cleanup Complete                 │
└─────────────────────────────────────┘
```

## Authentication Decision Tree

```
                    ┌─────────────────┐
                    │ New Connection  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Parse Query     │
                    │ Parameters      │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
    ┌───────────────────┐     ┌───────────────────┐
    │ Has machineUUID   │     │ No machineUUID    │
    │ AND userDocumentId│     │                   │
    └────────┬──────────┘     └────────┬──────────┘
             │                          │
             ▼                          ▼
    ┌───────────────────┐     ┌───────────────────┐
    │ POS Authentication│     │ JWT Authentication│
    │ (API Key)         │     │ (Mobile)          │
    └────────┬──────────┘     └────────┬──────────┘
             │                          │
             ▼                          ▼
    ┌───────────────────┐     ┌───────────────────┐
    │ Validate:         │     │ Verify JWT Token  │
    │ - License         │     │                   │
    │ - Key-Seat        │     │                   │
    │ - Expiration      │     │                   │
    └────────┬──────────┘     └────────┬──────────┘
             │                          │
             └────────────┬─────────────┘
                          │
                          ▼
                 ┌────────────────┐
                 │ Authenticated? │
                 └────────┬───────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼ YES                   ▼ NO
    ┌──────────────────┐    ┌──────────────────┐
    │ Set Socket Props │    │ Emit Error       │
    │ Update DB        │    │ Reject Connection│
    └──────────────────┘    └──────────────────┘
```

## Data Flow: Emitting to POS Machine

```
┌─────────────────────────────────────┐
│  Server wants to emit to POS        │
│  machineUUID: "abc123..."           │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Query key-seat table:              │
│  WHERE machineUUID = "abc123..."    │
│  AND isActive = true                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Get userSocketId from key-seat     │
│  userSocketId: "socket-xyz"         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  io.to("socket-xyz").emit(...)      │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  ✓ Event delivered to POS machine   │
└─────────────────────────────────────┘
```

## Key Validation Points

### POS Authentication Checks
1. ✓ License exists
2. ✓ License is active (`isActive: true`)
3. ✓ License not expired (if `expirationType: "expiring"`)
4. ✓ License belongs to user (`license.user.documentId === userDocumentId`)
5. ✓ Key-seat exists for machine UUID
6. ✓ Key-seat is active (`isActive: true`)
7. ✓ Key-seat linked to license

### Mobile Authentication Checks
1. ✓ JWT token is valid
2. ✓ JWT not expired
3. ✓ JWT signature matches Strapi secret
4. ✓ User ID exists in payload
