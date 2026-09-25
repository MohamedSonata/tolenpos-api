# POS Client Integration Guide - Credential Reset Handling

## Overview

This guide explains how to handle the scenario where the backend database is reset and the POS client needs to detect and recover from invalid stored credentials.

## Backend Changes Summary

The backend now emits a specific error when credentials are not found in the database:

```typescript
{
  socketConnected: true,
  credentialsExp: true,
  error: {
    status: 401,
    name: "InvalidCredentialsError",
    message: "Seat credentials not found in database",
    details: {
      reason: "SEAT_NOT_FOUND",
      recoveryAction: "RE_ACTIVATE_REQUIRED",
      userDocumentId: "...",
      machineUUID: "..."
    }
  }
}
```

## Required POS Client Changes

### 1. Add UnauthorizedError Event Listener

Add this listener when initializing the Socket.IO connection:

```typescript
socket.on('UnauthorizedError', async (errorData) => {
  console.error('[SocketIO] Authentication failed:', errorData);
  
  // Check if this requires re-activation
  const needsReactivation = 
    errorData?.error?.details?.reason === 'SEAT_NOT_FOUND' &&
    errorData?.error?.details?.recoveryAction === 'RE_ACTIVATE_REQUIRED';
  
  if (needsReactivation) {
    await handleCredentialReset();
  } else {
    // Handle other auth errors (wrong password, expired, etc.)
    showAuthenticationError(errorData);
  }
});
```

### 2. Implement Credential Reset Handler

```typescript
async function handleCredentialReset() {
  try {
    // 1. Clear all stored credentials
    await secureStorage.delete('licenseToken');
    await secureStorage.delete('userDocumentId');
    await secureStorage.delete('machineUUID');
    await secureStorage.delete('keySeatDocumentId');
    
    // 2. Clear app state
    appState.clearAuthData();
    
    // 3. Disconnect socket
    socket.disconnect();
    
    // 4. Show user-friendly dialog
    const result = await showDialog({
      title: 'Re-activation Required',
      message: 'Your POS system needs to be re-activated. This typically happens after server maintenance.',
      buttons: [
        { text: 'Re-activate Now', value: 'reactivate' },
        { text: 'Contact Support', value: 'support' }
      ]
    });
    
    if (result === 'reactivate') {
      navigateToActivationScreen();
    } else {
      openSupportWindow();
    }
    
  } catch (error) {
    console.error('[Auth] Failed to handle credential reset:', error);
    // Show fallback error message
  }
}
```

### 3. Add Startup Credential Validation

Validate credentials on app startup to catch stale credentials early:

```typescript
async function validateCredentials(): Promise<boolean> {
  const credentials = {
    token: await secureStorage.get('licenseToken'),
    userDocumentId: await secureStorage.get('userDocumentId'),
    machineUUID: await secureStorage.get('machineUUID')
  };
  
  // Check if credentials exist
  if (!credentials.token || !credentials.userDocumentId || !credentials.machineUUID) {
    return false;
  }
  
  // Try connecting to validate
  return new Promise((resolve) => {
    const testSocket = io(SERVER_URL, {
      query: { 
        token: credentials.token,
        userDocumentId: credentials.userDocumentId,
        machineUUID: credentials.machineUUID,
        clientType: 'pos_desktop'
      },
      timeout: 10000,
      reconnection: false
    });
    
    let resolved = false;
    
    testSocket.on('connect', () => {
      // Socket connected, wait a moment for auth
    });
    
    testSocket.on('UnauthorizedError', () => {
      if (!resolved) {
        resolved = true;
        testSocket.disconnect();
        resolve(false);
      }
    });
    
    // If no error after 5 seconds, assume valid
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        testSocket.disconnect();
        resolve(true);
      }
    }, 5000);
  });
}

// In app initialization
async function initApp() {
  const credentialsValid = await validateCredentials();
  
  if (credentialsValid) {
    // Continue to main screen
    navigateToMainScreen();
  } else {
    // Clear and require re-activation
    await clearStoredCredentials();
    navigateToActivationScreen();
  }
}
```

### 4. Connection State Management

Track connection state to prevent reconnection attempts with invalid credentials:

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  AUTHENTICATED = 'authenticated',
  NEEDS_REACTIVATION = 'needs_reactivation'
}

class SocketManager {
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  
  async connect() {
    if (this.state === ConnectionState.NEEDS_REACTIVATION) {
      console.warn('[Socket] Cannot connect - re-activation required');
      return false;
    }
    
    this.state = ConnectionState.CONNECTING;
    // ... connection logic
  }
  
  handleAuthError(errorData: any) {
    if (errorData?.error?.details?.recoveryAction === 'RE_ACTIVATE_REQUIRED') {
      this.state = ConnectionState.NEEDS_REACTIVATION;
      return true; // Handled as re-activation case
    }
    return false; // Other auth error
  }
}
```

## Error Types Reference

### SEAT_NOT_FOUND (Requires Re-activation)

**When it occurs:**
- Backend database was reset
- License key no longer exists
- Key-seat record no longer exists
- User account no longer exists

**What POS should do:**
1. Clear stored credentials
2. Disconnect socket
3. Show re-activation dialog
4. Navigate to activation screen

### Other Auth Errors (Don't clear credentials)

**When it occurs:**
- Wrong password
- Expired JWT token
- Network issues
- Temporary server errors

**What POS should do:**
1. Show error message
2. Allow user to retry
3. Don't clear credentials
4. Offer to re-enter password

## UI/UX Recommendations

### Re-activation Dialog

```
┌──────────────────────────────────────────┐
│  ⚠️  Re-activation Required               │
├──────────────────────────────────────────┤
│                                          │
│  Your POS system needs to be             │
│  re-activated.                           │
│                                          │
│  This can happen after:                  │
│  • Server maintenance                    │
│  • License renewal                       │
│  • Account changes                       │
│                                          │
│  Your data is safe and will sync         │
│  once you re-activate.                   │
│                                          │
│  ┌────────────────┐  ┌────────────────┐ │
│  │ Re-activate Now│  │ Contact Support│ │
│  └────────────────┘  └────────────────┘ │
└──────────────────────────────────────────┘
```

### Activation Screen Flow

1. Show license key input field
2. User enters license key
3. Validate with backend `/api/licenses/activate`
4. Store new credentials
5. Reconnect socket with new credentials
6. Sync data and continue

## Testing Checklist

- [ ] POS handles `UnauthorizedError` event
- [ ] Credentials are cleared when SEAT_NOT_FOUND
- [ ] Re-activation dialog shows correct message
- [ ] Socket disconnects properly
- [ ] Startup validation works correctly
- [ ] Re-activation flow completes successfully
- [ ] Data syncs after re-activation
- [ ] Connection state prevents reconnect loops
- [ ] Other auth errors don't trigger credential clear
- [ ] Logging captures credential lifecycle

## Common Issues and Solutions

### Issue: POS keeps trying to reconnect with invalid credentials

**Solution**: Implement connection state check:
```typescript
if (this.state === ConnectionState.NEEDS_REACTIVATION) {
  return false; // Don't attempt connection
}
```

### Issue: User doesn't understand why re-activation is needed

**Solution**: Show clear, friendly message explaining common causes

### Issue: Data appears lost after re-activation

**Solution**: 
- Ensure local data persists separately from credentials
- Trigger data sync immediately after re-activation
- Show sync progress to user

### Issue: Multiple error dialogs appear

**Solution**: 
- Use connection state to prevent duplicate handling
- Clear timeout timers on disconnect
- Debounce error handler

## Support Resources

When users contact support about re-activation:

1. **Check backend logs** for authentication failures
2. **Verify license key** is valid and active
3. **Guide through re-activation** step by step
4. **Check data sync** after re-activation
5. **Document incident** for tracking

## Related Backend Files

- `src/socketio/services/index.ts` - Authentication logic
- `src/socketio/error_events.constants.ts` - Error event names
- `DATABASE_RESET_RECOVERY_GUIDE.md` - Complete technical guide

## Contact

For questions or issues with this integration, contact the backend team.
