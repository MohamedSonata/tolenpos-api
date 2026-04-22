# FCM Token Multi-Device Migration Guide

## Problem Solved

Previously, the `fcmToken` field stored only ONE token per user, causing:
- Device A registers → stores token A
- Device B registers → overwrites token A with token B
- Push notifications only reach the last connected device ❌

Now with `fcmTokens` (repeatable), all devices receive notifications ✅

## Schema Changes

### 1. User Schema
Changed from:
```json
"fcmToken": {
  "type": "component",
  "component": "user.fcm-token",
  "repeatable": false  // ❌ Single token
}
```

To:
```json
"fcmTokens": {
  "type": "component",
  "component": "user.fcm-token",
  "repeatable": true  // ✅ Multiple tokens
}
```

### 2. FCM Token Component
Enhanced with device tracking:
```json
{
  "token": "string (required)",
  "deviceId": "string (required)",  // NEW: Unique device identifier
  "deviceName": "string",            // NEW: e.g., "iPhone 13 Pro"
  "platform": "enum (ios|android|web)", // NEW: Platform type
  "lastUpdatedAt": "datetime",
  "isActive": "boolean (default: true)" // NEW: Soft delete support
}
```

## API Endpoints

### Register/Update FCM Token
```http
POST /api/user/fcm-token/register
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "token": "fcm_token_here",
  "deviceId": "unique_device_id",  // Use device UUID or similar
  "deviceName": "iPhone 13 Pro",   // Optional
  "platform": "ios"                // Required: ios, android, or web
}
```

Response:
```json
{
  "data": {
    "success": true,
    "deviceCount": 2,
    "message": "Token registered"
  }
}
```

### Remove FCM Token (Logout)
```http
DELETE /api/user/fcm-token/:deviceId
Authorization: Bearer <jwt_token>
```

### Get All Active Tokens
```http
GET /api/user/fcm-tokens
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "data": {
    "tokens": ["token1", "token2", "token3"],
    "count": 3
  }
}
```

## Mobile App Integration

### On App Launch (After Login)
```typescript
// Get device info
const deviceId = await getDeviceId(); // Use device UUID
const deviceName = await getDeviceName(); // e.g., "iPhone 13 Pro"
const platform = Platform.OS; // 'ios' or 'android'

// Get FCM token
const fcmToken = await messaging().getToken();

// Register with backend
await fetch('/api/user/fcm-token/register', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    token: fcmToken,
    deviceId,
    deviceName,
    platform
  })
});
```

### On Logout
```typescript
const deviceId = await getDeviceId();

await fetch(`/api/user/fcm-token/${deviceId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});
```

### On Token Refresh
```typescript
messaging().onTokenRefresh(async (newToken) => {
  const deviceId = await getDeviceId();
  
  // Update token on backend
  await fetch('/api/user/fcm-token/register', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: newToken,
      deviceId,
      platform: Platform.OS
    })
  });
});
```

## Backend Usage

### Send Push Notification to User (All Devices)
```typescript
import { sendPushNotificationToUser } from '../utils/push-notification-helper';

// Send to all user's devices
const result = await sendPushNotificationToUser(strapi, userDocumentId, {
  title: 'Seat Updated',
  body: 'Your POS seat has been updated',
  data: {
    type: 'seat_update',
    seatId: 'seat-123',
    licenseKey: 'license-key'
  },
  imageUrl: 'https://example.com/image.png' // Optional
});

console.log(`Sent to ${result.sentCount} devices, ${result.failedCount} failed`);
```

### Send to Multiple Users
```typescript
import { sendPushNotificationToMultipleUsers } from '../utils/push-notification-helper';

const userIds = ['user1', 'user2', 'user3'];

const summary = await sendPushNotificationToMultipleUsers(strapi, userIds, {
  title: 'System Maintenance',
  body: 'Scheduled maintenance in 1 hour'
});

console.log(`Sent to ${summary.totalSent} devices across ${summary.totalUsers} users`);
```

### Manual Token Management
```typescript
import fcmTokenManager from './extensions/users-permissions/server/services/fcm-token-manager';

// Register token
await fcmTokenManager({ strapi }).registerFCMToken(userDocumentId, {
  token: 'fcm_token',
  deviceId: 'device_uuid',
  deviceName: 'iPhone 13',
  platform: 'ios'
});

// Remove token
await fcmTokenManager({ strapi }).removeFCMToken(userDocumentId, 'device_uuid');

// Get active tokens
const tokens = await fcmTokenManager({ strapi }).getActiveFCMTokens(userDocumentId);

// Cleanup old tokens (90+ days)
await fcmTokenManager({ strapi }).cleanupOldTokens(userDocumentId, 90);
```

## Migration Steps

### 1. Database Migration
After deploying the schema changes, Strapi will automatically create the new field. However, you may need to migrate existing data:

```typescript
// Run this once to migrate old fcmToken to fcmTokens array
async function migrateFCMTokens() {
  const users = await strapi.documents('plugin::users-permissions.user').findMany({
    filters: {
      fcmToken: { $notNull: true }
    },
    limit: 1000
  });

  for (const user of users) {
    if (user.fcmToken && user.fcmToken.token) {
      await strapi.documents('plugin::users-permissions.user').update({
        documentId: user.documentId,
        data: {
          fcmTokens: [{
            token: user.fcmToken.token,
            deviceId: 'migrated-device',
            deviceName: 'Legacy Device',
            platform: 'android', // Default
            lastUpdatedAt: user.fcmToken.lastUpdatedAt || new Date().toISOString(),
            isActive: true
          }]
        }
      });
    }
  }
}
```

### 2. Update Mobile Apps
- Update app to use new registration endpoint
- Include deviceId, deviceName, and platform
- Update logout flow to remove token

### 3. Update Backend Code
- Replace old FCM sending logic with new helper
- Use `sendPushNotificationToUser()` instead of single token sends

## Benefits

✅ Multiple devices per user supported
✅ Automatic invalid token cleanup
✅ Device tracking (name, platform, last updated)
✅ Soft delete support (deactivate without removing)
✅ Batch notifications to all user devices
✅ Multi-replica compatible (no socket ID dependency)

## Maintenance

### Periodic Cleanup (Cron Job)
```typescript
// Add to src/cron/jobs/cleanup-old-fcm-tokens.ts
import { withLock } from '../utils/distributed-lock';
import fcmTokenManager from '../../extensions/users-permissions/server/services/fcm-token-manager';

export async function cleanupOldFCMTokens(strapi: Core.Strapi) {
  await withLock(strapi, { key: 'cleanup-fcm-tokens', ttl: 3600 }, async () => {
    const users = await strapi.documents('plugin::users-permissions.user').findMany({
      filters: {
        fcmTokens: { $notNull: true }
      },
      limit: 1000
    });

    for (const user of users) {
      await fcmTokenManager({ strapi }).cleanupOldTokens(user.documentId, 90);
    }
  });
}
```

Register in `config/cron-tasks.ts`:
```typescript
{
  cleanupOldFCMTokens: {
    task: async ({ strapi }) => {
      await cleanupOldFCMTokens(strapi);
    },
    options: {
      rule: '0 2 * * *', // Daily at 2 AM
    },
  },
}
```
