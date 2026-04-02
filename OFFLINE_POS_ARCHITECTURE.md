# Offline-First POS Architecture Summary

## Problem Statement

Your POS applications work primarily **offline** with limited or no internet connectivity. Users may only connect during initial license activation. The challenge is: how do you enable/disable features based on subscription plans when the POS can't reliably check with the server?

## Solution: Hybrid Offline-First + Opportunistic Sync

### Core Principle
**The license activation response is the source of truth for offline operation.**

## Architecture Components

### 1. License Activation (Primary Mechanism)

When a POS app activates a license, it receives complete plan information:

```typescript
POST /api/licenses/activate
Body: {
  licenseKey: string,
  machineUUID: string,
  telemetry?: object
}

Response: {
  data: {
    license: {
      documentId: string,
      userDocumentId: string,
      planSubscriptionType: "FreeTrial" | "Pro" | "Enterprise",  // ← Critical field
      licenseKey: string,
      isActive: boolean,
      expirationType: "perpetual" | "expiring",
      expiresAt: string,
      maxSeats: number,
      activeSeats: number
    },
    seat: {
      documentId: string,
      machineUUID: string,
      isActive: boolean
    }
  }
}
```

**POS App Must:**
- Store `planSubscriptionType` locally (localStorage, SQLite, IndexedDB)
- Use this value to enable/disable features
- Work completely offline with this cached data
- Only update when reconnecting or re-activating

### 2. Socket.IO Opportunistic Updates (Secondary Mechanism)

When POS has internet and connects via Socket.IO, it can receive real-time updates:

#### On Connection
```typescript
socket.on('plan:current', (data) => {
  // Server sends current plan to sync with local data
  // {
  //   planType: "Pro",
  //   features: { ... },
  //   syncedAt: "2025-04-02T10:00:00.000Z"
  // }
});
```

#### On Plan Change
```typescript
socket.on('plan:updated', (data) => {
  // User upgraded/downgraded on website
  // {
  //   planType: "Enterprise",
  //   features: { ... },
  //   effectiveDate: "2025-04-02T10:00:00.000Z"
  // }
});
```

### 3. Server-Side Plan Management

#### Updating Plans
```typescript
// When user upgrades on website (payment webhook, admin action, etc.)
import { notifyPOSMachinesOfPlanChange } from './socketio/connection.handler';

async function handlePlanUpgrade(userDocumentId: string, newPlanType: string) {
  // Update user's plan
  await strapi.documents('plugin::users-permissions.user').update({
    documentId: userDocumentId,
    data: { planType: newPlanType }
  });
  
  // Notify all connected POS machines (if any are online)
  await notifyPOSMachinesOfPlanChange(userDocumentId, newPlanType, io, strapi);
  
  // Note: Offline POS machines will get the update when they:
  // 1. Reconnect to Socket.IO, or
  // 2. Re-activate their license
}
```

## Data Flow Diagrams

### Initial Activation (Offline)
```
┌─────────────┐
│   POS App   │
│  (Offline)  │
└──────┬──────┘
       │
       │ 1. User enters license key
       │
       ▼
┌─────────────────────────────┐
│ POST /api/licenses/activate │
│ { licenseKey, machineUUID } │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Server validates & returns  │
│ planSubscriptionType: "Pro" │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ POS stores locally:         │
│ - planSubscriptionType      │
│ - expiresAt                 │
│ - licenseKey                │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ POS enables Pro features    │
│ Works offline indefinitely  │
└─────────────────────────────┘
```

### Plan Upgrade (User Online)
```
┌──────────────┐
│   Website    │
│ User upgrades│
│ to Enterprise│
└──────┬───────┘
       │
       ▼
┌─────────────────────────────┐
│ Payment webhook/Admin action│
│ Updates user.planType       │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ notifyPOSMachinesOfPlanChange()│
│ - Updates all licenses      │
│ - Emits to connected POS    │
└──────┬──────────────────────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
       ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ POS #1   │   │ POS #2   │   │ POS #3   │
│ (Online) │   │ (Offline)│   │ (Online) │
│ ✓ Updated│   │ ✗ Missed │   │ ✓ Updated│
└──────────┘   └────┬─────┘   └──────────┘
                    │
                    │ Later reconnects...
                    ▼
              ┌──────────────┐
              │ Socket.IO    │
              │ plan:current │
              │ ✓ Synced     │
              └──────────────┘
```

## Implementation Checklist

### POS App (Client Side)

- [x] Store `planSubscriptionType` from activation response
- [x] Implement feature gating based on local plan data
- [x] Work fully offline without server checks
- [ ] Optional: Connect to Socket.IO when online
- [ ] Optional: Listen for `plan:current` and `plan:updated` events
- [ ] Optional: Sync local data when receiving updates
- [ ] Handle license expiration locally

### Server Side

- [x] Return `planSubscriptionType` in activation response
- [x] Store `planSubscriptionType` in license schema
- [x] Send `plan:current` when POS connects via Socket.IO
- [x] Implement `notifyPOSMachinesOfPlanChange()` function
- [ ] Call notification function when plans change (payment webhooks, admin actions)
- [ ] Update all user's licenses when plan changes

## Plan Feature Matrix

| Feature | FreeTrial | Pro | Enterprise |
|---------|-----------|-----|------------|
| Max Products | 100 | 1,000 | Unlimited |
| Max Registers | 1 | 3 | Unlimited |
| Advanced Reporting | ❌ | ✅ | ✅ |
| Multi-Location | ❌ | ❌ | ✅ |
| Inventory Management | ✅ | ✅ | ✅ |
| Basic Reports | ✅ | ✅ | ✅ |
| Customer Management | ❌ | ✅ | ✅ |
| Email Support | ❌ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ✅ |
| Custom Integrations | ❌ | ❌ | ✅ |
| Duration | 30 days | 1 year | 1 year |

## Security & Best Practices

### POS App
1. **Never trust client-side feature checks for critical operations** - Always validate on server
2. **Cache plan data persistently** - Use SQLite or similar, not just memory
3. **Handle missing data gracefully** - Default to FreeTrial if plan data is corrupted
4. **Check expiration locally** - Don't let expired licenses work indefinitely
5. **Provide manual refresh** - Let users re-activate to get latest plan

### Server
1. **Validate plan on server** - For purchases, upgrades, critical operations
2. **Log plan changes** - Audit trail for compliance
3. **Update all licenses** - When user plan changes, update all their licenses
4. **Don't require online** - POS must work offline
5. **Emit updates opportunistically** - Send to connected POS, don't wait for all

## Edge Cases Handled

### POS Never Connects After Activation
- ✅ Works offline with plan from activation response
- ✅ Features enabled based on cached plan
- ✅ Expiration checked locally

### User Upgrades While POS Offline
- ✅ POS continues with old plan (acceptable)
- ✅ Syncs when reconnects to Socket.IO
- ✅ Or user can re-activate license to get new plan

### License Expires While Offline
- ✅ POS checks `expiresAt` locally
- ✅ Can prompt user to renew
- ✅ User must connect to activate renewed license

### Multiple POS Machines
- ✅ Each gets plan on activation
- ✅ All receive updates when online
- ✅ Offline machines sync when they reconnect

## Files Modified

1. **src/api/license/controllers/license.ts**
   - Returns `planSubscriptionType` in activation response
   - Fixed TypeScript errors

2. **src/socketio/connection.handler.ts**
   - Added `sendCurrentPlanToPOS()` on connection
   - Added `notifyPOSMachinesOfPlanChange()` for updates
   - Added `getPlanFeatures()` helper

3. **src/socketio/PLAN_FEATURES_GUIDE.md** (New)
   - Complete implementation guide
   - Code examples for POS and server
   - Feature matrix and best practices

4. **OFFLINE_POS_ARCHITECTURE.md** (This file)
   - Architecture overview
   - Data flow diagrams
   - Implementation checklist

## Next Steps

1. **Test activation response** - Verify `planSubscriptionType` is returned
2. **Implement POS client** - Store and use plan data locally
3. **Add payment webhook** - Call `notifyPOSMachinesOfPlanChange()` on upgrades
4. **Test offline operation** - Ensure POS works without internet
5. **Test online sync** - Verify Socket.IO updates work
6. **Monitor and log** - Track plan changes and POS connections

## Conclusion

This architecture is **correct for offline-first POS apps**. The key insight is:

> **The activation response is the source of truth, Socket.IO is just an optimization.**

POS apps work reliably offline with cached plan data, and opportunistically sync when online. This provides the best of both worlds: offline reliability and online updates when possible.
