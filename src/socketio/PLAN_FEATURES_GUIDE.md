# Plan Features Management for Offline-First POS Apps

## Architecture Overview

This system is designed for POS applications that work primarily **offline** and only connect to the internet during initial activation or occasional syncs.

## How It Works

### 1. Initial Activation (Offline-First Approach)

When a POS app activates a license, it receives the `planSubscriptionType` in the response:

```typescript
// POST /api/licenses/activate
// Body: { licenseKey: string, machineUUID: string, telemetry?: object }

// Response:
{
  "data": {
    "message": "License activated successfully",
    "license": {
      "documentId": "abc123",
      "userDocumentId": "user456",
      "planSubscriptionType": "Pro",  // ← POS stores this locally
      "licenseKey": "encrypted-key",
      "isActive": true,
      "expirationType": "expiring",
      "expiresAt": "2025-12-31T23:59:59.000Z",
      "maxSeats": 5,
      "activeSeats": 1
    },
    "seat": {
      "documentId": "seat789",
      "machineUUID": "machine-uuid",
      "isActive": true
    }
  }
}
```

**POS App Responsibility:**
- Store `planSubscriptionType` locally (localStorage, SQLite, etc.)
- Use it to enable/disable features while offline
- This is the primary source of truth for offline operation

### 2. Opportunistic Updates (When Online)

When the POS app connects to Socket.IO (if internet is available), it can receive real-time plan updates:

```typescript
// POS connects to Socket.IO
const socket = io(SERVER_URL, {
  query: {
    token: licenseKey,
    userDocumentId: userDocumentId,
    machineUUID: machineUUID
  }
});

// Listen for plan updates
socket.on('plan:updated', (data) => {
  console.log('Plan changed:', data);
  // {
  //   planType: "Enterprise",
  //   features: {
  //     maxProducts: -1,  // unlimited
  //     maxRegisters: -1,
  //     advancedReporting: true,
  //     multiLocation: true
  //   },
  //   effectiveDate: "2025-04-02T10:00:00.000Z"
  // }
  
  // Update local storage
  localStorage.setItem('planSubscriptionType', data.planType);
  localStorage.setItem('planFeatures', JSON.stringify(data.features));
  
  // Refresh UI or notify user
  showNotification('Your plan has been upgraded!');
});

// On connection, server sends current plan
socket.on('plan:current', (data) => {
  // Sync local data with server
  const localPlan = localStorage.getItem('planSubscriptionType');
  if (localPlan !== data.planType) {
    console.log('Plan changed while offline, updating...');
    localStorage.setItem('planSubscriptionType', data.planType);
  }
});
```

## Plan Types and Features

### FreeTrial
```typescript
{
  planType: "FreeTrial",
  features: {
    maxProducts: 100,
    maxRegisters: 1,
    advancedReporting: false,
    multiLocation: false,
    inventoryManagement: true,
    basicReports: true,
    duration: "30 days"
  }
}
```

### Pro
```typescript
{
  planType: "Pro",
  features: {
    maxProducts: 1000,
    maxRegisters: 3,
    advancedReporting: true,
    multiLocation: false,
    inventoryManagement: true,
    basicReports: true,
    customerManagement: true,
    emailSupport: true
  }
}
```

### Enterprise
```typescript
{
  planType: "Enterprise",
  features: {
    maxProducts: -1,  // unlimited
    maxRegisters: -1,  // unlimited
    advancedReporting: true,
    multiLocation: true,
    inventoryManagement: true,
    basicReports: true,
    customerManagement: true,
    prioritySupport: true,
    customIntegrations: true,
    dedicatedAccountManager: true
  }
}
```

## Implementation Guide

### POS App Side

#### 1. Store Plan Data Locally

```typescript
// After activation
async function activateLicense(licenseKey: string, machineUUID: string) {
  const response = await fetch('/api/licenses/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey, machineUUID })
  });
  
  const { data } = await response.json();
  
  // Store locally for offline use
  localStorage.setItem('planSubscriptionType', data.license.planSubscriptionType);
  localStorage.setItem('userDocumentId', data.license.userDocumentId);
  localStorage.setItem('licenseKey', data.license.licenseKey);
  localStorage.setItem('expiresAt', data.license.expiresAt);
  
  return data;
}
```

#### 2. Feature Gating

```typescript
// Feature check utility
function hasFeature(featureName: string): boolean {
  const planType = localStorage.getItem('planSubscriptionType');
  
  const featureMatrix = {
    'FreeTrial': {
      advancedReporting: false,
      multiLocation: false,
      maxProducts: 100,
      maxRegisters: 1
    },
    'Pro': {
      advancedReporting: true,
      multiLocation: false,
      maxProducts: 1000,
      maxRegisters: 3
    },
    'Enterprise': {
      advancedReporting: true,
      multiLocation: true,
      maxProducts: -1,  // unlimited
      maxRegisters: -1
    }
  };
  
  return featureMatrix[planType]?.[featureName] ?? false;
}

// Usage in UI
if (hasFeature('advancedReporting')) {
  showAdvancedReportsButton();
} else {
  showUpgradePrompt('Advanced reporting is available in Pro plan');
}
```

#### 3. Socket.IO Integration (Optional, for online updates)

```typescript
let socket: Socket | null = null;

function connectToServer() {
  const licenseKey = localStorage.getItem('licenseKey');
  const userDocumentId = localStorage.getItem('userDocumentId');
  const machineUUID = getMachineUUID();
  
  if (!licenseKey || !userDocumentId) return;
  
  socket = io(SERVER_URL, {
    query: { token: licenseKey, userDocumentId, machineUUID },
    reconnection: true,
    reconnectionDelay: 5000
  });
  
  socket.on('connect', () => {
    console.log('Connected to server');
  });
  
  socket.on('plan:current', (data) => {
    syncPlanData(data);
  });
  
  socket.on('plan:updated', (data) => {
    handlePlanUpdate(data);
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server (app continues offline)');
  });
}

function syncPlanData(serverData: any) {
  const localPlan = localStorage.getItem('planSubscriptionType');
  if (localPlan !== serverData.planType) {
    localStorage.setItem('planSubscriptionType', serverData.planType);
    notifyPlanChanged(serverData);
  }
}

function handlePlanUpdate(data: any) {
  localStorage.setItem('planSubscriptionType', data.planType);
  showNotification(`Your plan has been ${data.planType === 'Enterprise' ? 'upgraded' : 'changed'} to ${data.planType}!`);
  reloadFeatures();
}
```

### Server Side

#### 1. Emit Plan Updates When User Upgrades

```typescript
// In your subscription/payment webhook handler
async function handleSubscriptionUpgrade(userDocumentId: string, newPlanType: string) {
  // Update user's plan in database
  await strapi.documents('plugin::users-permissions.user').update({
    documentId: userDocumentId,
    data: { planType: newPlanType }
  });
  
  // Update all licenses for this user
  const licenses = await strapi.documents('api::license.license').findMany({
    filters: { user: { documentId: userDocumentId } },
    populate: ['seats']
  });
  
  for (const license of licenses) {
    await strapi.documents('api::license.license').update({
      documentId: license.documentId,
      data: { planSubscriptionType: newPlanType }
    });
    
    // Notify all connected POS machines
    if (license.seats) {
      for (const seat of license.seats) {
        if (seat.isActive && seat.userSocketId) {
          io.to(seat.userSocketId).emit('plan:updated', {
            planType: newPlanType,
            features: getPlanFeatures(newPlanType),
            effectiveDate: new Date().toISOString()
          });
        }
      }
    }
  }
}

function getPlanFeatures(planType: string) {
  const features = {
    'FreeTrial': {
      maxProducts: 100,
      maxRegisters: 1,
      advancedReporting: false,
      multiLocation: false
    },
    'Pro': {
      maxProducts: 1000,
      maxRegisters: 3,
      advancedReporting: true,
      multiLocation: false
    },
    'Enterprise': {
      maxProducts: -1,
      maxRegisters: -1,
      advancedReporting: true,
      multiLocation: true
    }
  };
  
  return features[planType] || features['FreeTrial'];
}
```

#### 2. Send Current Plan on Connection

```typescript
// In connection.handler.ts
async function handlePOSConnection(socket: Socket) {
  const userDocumentId = socket.userID;
  
  // Fetch user's current plan
  const user = await strapi.documents('plugin::users-permissions.user').findOne({
    documentId: userDocumentId
  });
  
  // Send current plan to POS
  socket.emit('plan:current', {
    planType: user.planType,
    features: getPlanFeatures(user.planType)
  });
}
```

## Best Practices

### For POS Apps

1. **Always work offline-first**: Don't block functionality waiting for server connection
2. **Store plan data locally**: Use persistent storage (not just memory)
3. **Graceful degradation**: If plan data is missing, default to FreeTrial features
4. **Sync when possible**: Connect to Socket.IO when internet is available to get updates
5. **Cache feature matrix**: Don't make network calls to check features
6. **Handle expiration**: Check `expiresAt` locally and prompt for renewal

### For Server

1. **Return plan in activation**: Always include `planSubscriptionType` in activation response
2. **Emit updates opportunistically**: Send plan updates via Socket.IO when POS is online
3. **Don't require online checks**: POS should work fully offline
4. **Sync on reconnection**: Send current plan when POS reconnects
5. **Log plan changes**: Track when plans are updated for audit purposes

## Security Considerations

1. **Plan data is not secret**: It's okay to store locally, but validate on server for critical operations
2. **Server is source of truth**: Always validate plan on server for purchases, upgrades, etc.
3. **License validation**: Periodically re-validate license when online
4. **Expiration checks**: Enforce expiration dates even offline

## Troubleshooting

### POS shows wrong features
- Check local storage for `planSubscriptionType`
- Verify license activation response included correct plan
- Connect to Socket.IO to sync with server

### Plan update not received
- POS may be offline (this is expected)
- Plan will sync next time POS connects
- User can manually re-activate license to get latest plan

### Features not working after upgrade
- POS needs to connect to internet to receive update
- Or user can re-activate license to get new plan
- Check Socket.IO connection status

## Example: Complete Flow

1. **User purchases Pro plan on website**
2. **Server creates license with `planSubscriptionType: "Pro"`**
3. **User receives license key via email**
4. **User enters license key in POS app (offline)**
5. **POS activates license, receives `planSubscriptionType: "Pro"`**
6. **POS stores plan locally and enables Pro features**
7. **POS works offline with Pro features for weeks/months**
8. **User upgrades to Enterprise on website**
9. **Server updates license `planSubscriptionType: "Enterprise"`**
10. **Next time POS connects to internet:**
    - Socket.IO connects
    - Server emits `plan:updated` event
    - POS receives update and enables Enterprise features
11. **If POS never connects, user can re-activate license to get Enterprise plan**

This hybrid approach ensures POS apps work reliably offline while still receiving updates when online.
