# Credential Reset Quick Reference Card

## For POS Client Developers

### What Changed in Backend

Backend now sends a **specific error code** when stored credentials are no longer valid:

```json
{
  "error": {
    "details": {
      "reason": "SEAT_NOT_FOUND",
      "recoveryAction": "RE_ACTIVATE_REQUIRED"
    }
  }
}
```

### What You Need to Do

**1. Listen for the error:**
```typescript
socket.on('UnauthorizedError', (errorData) => {
  if (errorData?.error?.details?.recoveryAction === 'RE_ACTIVATE_REQUIRED') {
    handleCredentialReset();
  }
});
```

**2. Clear credentials:**
```typescript
await secureStorage.delete('licenseToken');
await secureStorage.delete('userDocumentId');
await secureStorage.delete('machineUUID');
```

**3. Show user a friendly message:**
```
"Your POS needs to be re-activated.
This happens after server maintenance.
Please enter your license key."
```

**4. Navigate to activation screen:**
```typescript
navigateToActivationScreen();
```

### When Does This Happen?

- ✅ Backend database reset
- ✅ Server maintenance with data wipe
- ✅ Account migration to new system
- ❌ NOT for wrong password
- ❌ NOT for temporary network issues

### Error Types

| Error Type | Clear Credentials? | Action |
|------------|-------------------|--------|
| `SEAT_NOT_FOUND` | ✅ YES | Show re-activation screen |
| Wrong password | ❌ NO | Ask to re-enter password |
| Network error | ❌ NO | Show retry button |
| JWT expired | ❌ NO | Refresh token |

### Complete Code Example

```typescript
// 1. Add event listener
socket.on('UnauthorizedError', async (errorData) => {
  const needsReactivation = 
    errorData?.error?.details?.reason === 'SEAT_NOT_FOUND' &&
    errorData?.error?.details?.recoveryAction === 'RE_ACTIVATE_REQUIRED';
  
  if (needsReactivation) {
    // Clear credentials
    await secureStorage.delete('licenseToken');
    await secureStorage.delete('userDocumentId');
    await secureStorage.delete('machineUUID');
    
    // Disconnect socket
    socket.disconnect();
    
    // Show dialog
    showDialog({
      title: 'Re-activation Required',
      message: 'Your POS system needs to be re-activated.',
      buttons: ['Re-activate Now', 'Contact Support']
    });
    
    // Navigate to activation
    navigateToActivationScreen();
  }
});
```

### Testing

**To test this scenario:**

1. Connect POS to backend (save credentials)
2. Reset backend database
3. Restart POS or trigger reconnection
4. ✅ Should show re-activation screen
5. ✅ Should not show generic error
6. ✅ Should clear stored credentials

### FAQ

**Q: Will this affect mobile apps?**  
A: No, mobile apps use different authentication (JWT)

**Q: What happens to local POS data?**  
A: Local data is safe, only credentials are cleared

**Q: How often will this happen?**  
A: Rarely - only during major backend maintenance

**Q: Can we auto-reactivate?**  
A: No - user must re-enter license key for security

**Q: What if user lost license key?**  
A: Direct them to "Contact Support" button

### Need Help?

- Full guide: `DATABASE_RESET_RECOVERY_GUIDE.md`
- Integration guide: `POS_CLIENT_INTEGRATION_GUIDE.md`
- Backend code: `src/socketio/services/index.ts`
