# Database Reset Recovery Guide

## Problem Statement

When the backend database is wiped and redeployed with fresh data, POS clients attempting to reconnect with their stored credentials will fail authentication because:
1. The user account no longer exists
2. The license key is not in the new database
3. The key-seat (machine activation) record is missing
4. The stored `userDocumentId` and `machineUUID` reference non-existent data

## Current Flow Analysis

### Backend Socket Connection Flow

```
1. POS Client connects → Socket.IO connection established
2. connection.handler.ts receives connection
3. Calls authenticateUserConnection() from services/index.ts
4. authenticatePOSConnection() validates:
   - License key exists and is active
   - User owns the license (userDocumentId matches)
   - Key-seat exists for machineUUID
5. If validation fails → emits UnauthorizedError
6. POS receives error but socket remains connected (no handlers registered yet)
```

### Problem Points

1. **Socket stays connected** even after auth failure
2. **No clear error code** to differentiate "wrong password" from "data doesn't exist"
3. **POS client doesn't know** it needs to clear credentials and re-activate
4. **No recovery mechanism** for orphaned credentials

## Solution Architecture

### Backend Changes (Implemented)

#### 1. Enhanced Error Response

**File**: `src/socketio/services/index.ts`

```typescript
// When POS authentication fails, emit specific error with recovery info
socket.emit(SocketIOErrorEvents.UnauthorizedError, {
  socketConnected: socket.connected,
  credentialsExp: true,
  error: {
    status: 401,
    name: "InvalidCredentialsError",
    message: "Seat credentials not found in database",
    details: {
      reason: "SEAT_NOT_FOUND",           // Specific failure reason
      recoveryAction: "RE_ACTIVATE_REQUIRED", // What client should do
      userDocumentId,                      // For logging/debugging
      machineUUID                          // For logging/debugging
    },
  },
});
```

#### 2. Better Logging

Replaced `console.log` with structured `strapi.log` for better debugging:
- `strapi.log.info()` for successful operations
- `strapi.log.warn()` for validation failures
- `strapi.log.error()` for unexpected errors

### POS Client Changes (Required)

#### 1. Add Error Event Listener

**Location**: POS Desktop App - Socket.IO connection setup

```typescript
// Listen for UnauthorizedError events
socket.on('UnauthorizedError', async (errorData) => {
  console.error('[SocketIO] Authentication failed:', errorData);
  
  // Check if this is a credential reset scenario
  if (errorData?.error?.details?.reason === 'SEAT_NOT_FOUND' &&
      errorData?.error?.details?.recoveryAction === 'RE_ACTIVATE_REQUIRED') {
    
    // Clear stored credentials
    await clearStoredCredentials();
    
    // Show user-friendly message
    showCredentialResetDialog({
      title: 'Re-activation Required',
      message: 'Your POS system needs to be re-activated. This typically happens after server maintenance or account changes.',
      actions: [
        { label: 'Re-activate Now', action: () => navigateToActivationScreen() },
        { label: 'Contact Support', action: () => openSupportDialog() }
      ]
    });
    
    // Disconnect socket
    socket.disconnect();
    
    // Navigate to activation screen
    navigateToActivationScreen();
  } else {
    // Handle other authentication errors (wrong credentials, expired token, etc.)
    showGenericAuthError(errorData);
  }
});
```

#### 2. Credential Storage Management

```typescript
// Clear all stored credentials
async function clearStoredCredentials() {
  try {
    // Clear from secure storage
    await secureStore.delete('licenseToken');
    await secureStore.delete('userDocumentId');
    await secureStore.delete('machineUUID');
    await secureStore.delete('keySeatDocumentId');
    
    // Clear from app state/Redux/context
    dispatch(clearAuthState());
    
    console.log('[Auth] Credentials cleared successfully');
  } catch (error) {
    console.error('[Auth] Failed to clear credentials:', error);
  }
}
```

#### 3. Connection State Machine

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  AUTH_FAILED = 'auth_failed',
  NEEDS_REACTIVATION = 'needs_reactivation'
}

class SocketConnectionManager {
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  
  async connect() {
    if (this.state === ConnectionState.NEEDS_REACTIVATION) {
      console.warn('[Socket] Cannot connect - re-activation required');
      return;
    }
    
    this.state = ConnectionState.CONNECTING;
    // ... connection logic
  }
  
  handleAuthFailure(errorData: any) {
    if (errorData?.error?.details?.recoveryAction === 'RE_ACTIVATE_REQUIRED') {
      this.state = ConnectionState.NEEDS_REACTIVATION;
    } else {
      this.state = ConnectionState.AUTH_FAILED;
    }
  }
}
```

#### 4. Startup Credential Validation

```typescript
// On app startup, check if credentials are valid
async function validateStoredCredentials(): Promise<boolean> {
  const token = await secureStore.get('licenseToken');
  const userDocumentId = await secureStore.get('userDocumentId');
  const machineUUID = await secureStore.get('machineUUID');
  
  if (!token || !userDocumentId || !machineUUID) {
    return false;
  }
  
  // Try to connect and authenticate
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, {
      query: { token, userDocumentId, machineUUID, clientType: 'pos_desktop' },
      timeout: 10000
    });
    
    socket.on('connect', () => {
      console.log('[Validation] Socket connected');
    });
    
    socket.on('UnauthorizedError', (errorData) => {
      console.log('[Validation] Credentials invalid:', errorData);
      socket.disconnect();
      resolve(false);
    });
    
    // If no error within 5 seconds, assume valid
    setTimeout(() => {
      socket.disconnect();
      resolve(true);
    }, 5000);
  });
}

// In app initialization
async function initializeApp() {
  const credentialsValid = await validateStoredCredentials();
  
  if (!credentialsValid) {
    await clearStoredCredentials();
    navigateToActivationScreen();
  } else {
    navigateToMainScreen();
  }
}
```

## Recovery Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Backend Database Reset (Fresh Data)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  POS Client Attempts Connection                             │
│  - Uses stored credentials (token, userDocumentId, UUID)    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: Socket Connected                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: authenticatePOSConnection()                       │
│  ✗ License not found                                        │
│  ✗ User not found                                           │
│  ✗ Key-seat not found                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: Emit UnauthorizedError                            │
│  - reason: "SEAT_NOT_FOUND"                                 │
│  - recoveryAction: "RE_ACTIVATE_REQUIRED"                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  POS Client: Receives UnauthorizedError                     │
│  - Detects RE_ACTIVATE_REQUIRED                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  POS Client: Clear Stored Credentials                       │
│  - Delete licenseToken                                      │
│  - Delete userDocumentId                                    │
│  - Delete machineUUID                                       │
│  - Clear app state                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  POS Client: Show Re-activation Dialog                      │
│  "Your POS system needs to be re-activated"                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  User: Re-enters License Key                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: Validate New License Key                          │
│  - Create new key-seat record                               │
│  - Return new credentials                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  POS Client: Store New Credentials                          │
│  - Reconnect with new credentials                           │
│  - Resume normal operation                                  │
└─────────────────────────────────────────────────────────────┘
```

## Testing Scenarios

### Scenario 1: Database Reset During Active Connection

**Steps**:
1. POS is connected and running
2. Backend database is reset
3. POS loses connection (WebSocket disconnected)
4. POS attempts auto-reconnect
5. Backend rejects authentication
6. POS clears credentials and shows re-activation screen

### Scenario 2: Database Reset While POS Offline

**Steps**:
1. POS is offline/closed
2. Backend database is reset
3. User opens POS application
4. POS attempts connection with stored credentials
5. Backend rejects authentication
6. POS clears credentials and shows re-activation screen

### Scenario 3: Partial Database Reset (User Exists, License Missing)

**Steps**:
1. Backend database reset but user account manually re-created
2. POS attempts connection
3. Backend finds user but not license/key-seat
4. Backend emits SEAT_NOT_FOUND error
5. POS clears credentials and requires re-activation

## Implementation Checklist

### Backend (✅ Completed)
- [✅] Enhanced error response with `SEAT_NOT_FOUND` reason
- [✅] Added `RE_ACTIVATE_REQUIRED` recovery action
- [✅] Improved logging with `strapi.log` instead of `console.log`
- [✅] Added `CredentialResetRequired` error event constant

### POS Client (❌ Required)
- [ ] Add `UnauthorizedError` event listener
- [ ] Implement `clearStoredCredentials()` function
- [ ] Create re-activation dialog UI
- [ ] Add connection state machine
- [ ] Implement startup credential validation
- [ ] Add automatic navigation to activation screen
- [ ] Update error handling to differentiate error types
- [ ] Add logging for credential lifecycle

## User Communication

When this error occurs, show users a clear, non-technical message:

```
┌──────────────────────────────────────────────┐
│  Re-activation Required                      │
├──────────────────────────────────────────────┤
│                                              │
│  Your POS system needs to be re-activated.  │
│                                              │
│  This can happen after:                      │
│  • Server maintenance or updates             │
│  • Account changes or transfers              │
│  • License renewal                           │
│                                              │
│  Please enter your license key to continue.  │
│                                              │
│  [Re-activate Now]  [Contact Support]        │
│                                              │
└──────────────────────────────────────────────┘
```

## Prevention Strategies

1. **Database Backup Before Reset**: Always backup database before wiping
2. **Migration Scripts**: Use migration scripts instead of full resets when possible
3. **Staging Environment**: Test database changes in staging first
4. **User Notification**: Notify users before planned maintenance that affects credentials
5. **Grace Period**: Implement temporary credential migration period if possible

## Support Documentation

When users contact support about re-activation:

1. **Verify**: Check if backend database was recently reset
2. **Confirm**: User has valid license key
3. **Guide**: Walk through re-activation process
4. **Document**: Log incident for tracking and prevention
5. **Follow-up**: Ensure user successfully re-activates

## Related Files

- `src/socketio/services/index.ts` - Authentication logic
- `src/socketio/connection.handler.ts` - Connection handling
- `src/socketio/error_events.constants.ts` - Error event constants
- POS Client: Socket connection manager (needs implementation)
- POS Client: Activation screen (needs enhancement)
