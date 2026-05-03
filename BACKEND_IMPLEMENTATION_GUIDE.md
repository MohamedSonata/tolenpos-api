# Backend Implementation Guide - Customer App Feature

## Overview

This guide contains step-by-step instructions for implementing customer-facing mobile app support in the Strapi backend. Follow these phases sequentially.

---

## Phase 1: Update Subscription Plan Schema

### File: `src/api/subscription-plan/content-types/subscription-plan/schema.json`

Add these fields to the `attributes` object:

```json
{
  "allowCustomerApp": {
    "type": "boolean",
    "default": false,
    "description": "Enable customer-facing mobile app for this plan"
  },
  "allowMenuBrowsing": {
    "type": "boolean",
    "default": false,
    "description": "Allow customers to browse menu/categories (restaurant/cafe)"
  },
  "allowBarcodeScanning": {
    "type": "boolean",
    "default": false,
    "description": "Allow customers to scan barcodes for product info (retail/pharmacy)"
  },
  "allowCustomerOrdering": {
    "type": "boolean",
    "default": false,
    "description": "Allow customers to place orders directly from mobile app"
  },
  "maxCustomerConnectionsPerSeat": {
    "type": "integer",
    "default": 50,
    "description": "Maximum concurrent customer connections per seat"
  }
}
```

---

## Phase 2: Create Subscription Plan Service

### File: `src/api/subscription-plan/services/subscription-plan.ts`

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::subscription-plan.subscription-plan', ({ strapi }) => ({
  /**
   * Gets customer app features for a specific plan
   */
  async getCustomerAppFeatures(planDocumentId: string) {
    try {
      const plan = await strapi.documents('api::subscription-plan.subscription-plan').findOne({
        documentId: planDocumentId,
        status: 'published',
        fields: [
          'allowCustomerApp',
          'allowMenuBrowsing',
          'allowBarcodeScanning',
          'allowCustomerOrdering',
          'maxCustomerConnectionsPerSeat'
        ]
      });

      if (!plan) {
        return null;
      }

      return {
        allowCustomerApp: plan.allowCustomerApp || false,
        allowMenuBrowsing: plan.allowMenuBrowsing || false,
        allowBarcodeScanning: plan.allowBarcodeScanning || false,
        allowCustomerOrdering: plan.allowCustomerOrdering || false,
        maxCustomerConnectionsPerSeat: plan.maxCustomerConnectionsPerSeat || 50
      };
    } catch (error) {
      strapi.log.error('[SubscriptionPlanService] Error getting customer app features:', error);
      return null;
    }
  },

  /**
   * Gets customer app features by user document ID
   */
  async getCustomerAppFeaturesByUser(userDocumentId: string) {
    try {
      const user = await strapi.documents('plugin::users-permissions.user').findOne({
        documentId: userDocumentId,
        populate: ['subscriptionPlan']
      });

      if (!user || !user.subscriptionPlan) {
        strapi.log.warn('[SubscriptionPlanService] User has no subscription plan:', userDocumentId);
        return null;
      }

      const planDocumentId = typeof user.subscriptionPlan === 'object'
        ? user.subscriptionPlan.documentId
        : user.subscriptionPlan;

      return await this.getCustomerAppFeatures(planDocumentId);
    } catch (error) {
      strapi.log.error('[SubscriptionPlanService] Error getting features by user:', error);
      return null;
    }
  }
}));
```

---

## Phase 3: Update Key-Seat Schema

### File: `src/api/key-seat/content-types/key-seat/schema.json`

Add these fields to the `attributes` object:

```json
{
  "publicSeatId": {
    "type": "string",
    "unique": true,
    "required": false,
    "description": "Public identifier for customer connections (e.g., REST42A, CAFE001)"
  },
  "businessName": {
    "type": "string",
    "required": false,
    "description": "Display name for the business"
  },
  "businessType": {
    "type": "enumeration",
    "enum": ["restaurant", "retail", "cafe", "pharmacy", "other"],
    "default": "retail",
    "description": "Type of business - determines customer app behavior"
  },
  "allowCustomerApp": {
    "type": "boolean",
    "default": false,
    "description": "Enable customer app for this seat (copied from plan)"
  },
  "allowMenuBrowsing": {
    "type": "boolean",
    "default": false,
    "description": "Allow menu/category browsing"
  },
  "allowBarcodeScanning": {
    "type": "boolean",
    "default": false,
    "description": "Allow barcode scanning"
  },
  "allowCustomerOrdering": {
    "type": "boolean",
    "default": false,
    "description": "Allow direct ordering"
  },
  "maxCustomerConnections": {
    "type": "integer",
    "default": 50,
    "description": "Max concurrent customer connections"
  },
  "currentCustomerConnections": {
    "type": "integer",
    "default": 0,
    "description": "Current number of connected customers"
  }
}
```

---

## Phase 4: Create Public Seat ID Generator

### File: `src/api/key-seat/utils/public-id-generator.ts`

```typescript
import type { Core } from '@strapi/strapi';

/**
 * Generates a unique, customer-friendly seat identifier
 * Examples: "REST42A", "CAFE001", "PHARMA123"
 */
export function generatePublicSeatId(businessType?: string): string {
  const prefix = getBusinessPrefix(businessType);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${random}`;
}

function getBusinessPrefix(businessType?: string): string {
  const prefixes: Record<string, string> = {
    restaurant: 'REST',
    retail: 'RETL',
    cafe: 'CAFE',
    pharmacy: 'PHRM',
    other: 'SEAT'
  };
  return prefixes[businessType || 'other'] || 'SEAT';
}

export function isValidPublicSeatId(id: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(id);
}

/**
 * Generates a unique public seat ID by checking database for collisions
 */
export async function generateUniquePublicSeatId(
  strapi: Core.Strapi,
  businessType?: string,
  maxAttempts: number = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const publicSeatId = generatePublicSeatId(businessType);

    const existingSeats = await strapi.documents('api::key-seat.key-seat').findMany({
      filters: { publicSeatId },
      status: 'published',
      limit: 1
    });

    if (!existingSeats || existingSeats.length === 0) {
      return publicSeatId;
    }

    strapi.log.warn(`[PublicIdGenerator] Collision detected for ${publicSeatId}, retrying...`);
  }

  throw new Error(`Failed to generate unique public seat ID after ${maxAttempts} attempts`);
}
```

---

## Phase 5: Update License Activation Controller

### File: `src/api/license/controllers/license.ts`

In the `activate` method, add this code after validating the license and before creating the seat:

```typescript
// Get user's subscription plan features
const planService = strapi.service('api::subscription-plan.subscription-plan');
const planFeatures = await planService.getCustomerAppFeaturesByUser(userDocumentId);

// Generate unique public seat ID
const { generateUniquePublicSeatId } = await import('../../key-seat/utils/public-id-generator');
const publicSeatId = await generateUniquePublicSeatId(strapi, telemetry?.businessType);

// When creating the seat, add these fields:
keySeat = await strapi.documents('api::key-seat.key-seat').create({
  data: {
    machineUUID,
    isActive: true,
    timezone: validatedTimezone,
    license: license.documentId,
    publicSeatId,
    businessName: telemetry?.businessName || 'Unnamed Business',
    businessType: telemetry?.businessType || 'retail',
    // Copy plan features to seat
    allowCustomerApp: planFeatures?.allowCustomerApp || false,
    allowMenuBrowsing: planFeatures?.allowMenuBrowsing || false,
    allowBarcodeScanning: planFeatures?.allowBarcodeScanning || false,
    allowCustomerOrdering: planFeatures?.allowCustomerOrdering || false,
    maxCustomerConnections: planFeatures?.maxCustomerConnectionsPerSeat || 50,
    currentCustomerConnections: 0,
    telemetry: {
      ...telemetry,
      firstActivated: new Date().toISOString()
    }
  },
  status: 'published'
});

strapi.log.info('[LicenseActivation] Seat created with customer app features:', {
  publicSeatId,
  allowCustomerApp: planFeatures?.allowCustomerApp,
  businessType: telemetry?.businessType
});

// In the response, add publicSeatId:
return ctx.send({
  data: {
    message: 'License activated successfully',
    license: { /* ... existing fields ... */ },
    seat: {
      documentId: keySeat.documentId,
      machineUUID: keySeat.machineUUID,
      publicSeatId: keySeat.publicSeatId,  // NEW
      businessName: keySeat.businessName,   // NEW
      businessType: keySeat.businessType,   // NEW
      isActive: keySeat.isActive,
      allowCustomerApp: keySeat.allowCustomerApp  // NEW
    }
  }
});
```

---

## Phase 6: Add Socket.IO Event Constants

### File: `src/socketio/events_constants.ts`

Add these constants to the `SocketIOEvents` class:

```typescript
// Customer App Events
static readonly OnCustomerConnect = "customer:connect";
static readonly EmitCustomerConnectSuccess = "customer:connect:success";
static readonly OnCustomerDisconnect = "customer:disconnect";

// Menu Browsing Events (Restaurant/Cafe)
static readonly OnCustomerMenuCategories = "customer:menu:categories";
static readonly EmitCustomerMenuCategories = "customer:menu:categories:data";
static readonly OnCustomerMenuProducts = "customer:menu:products";
static readonly EmitCustomerMenuProducts = "customer:menu:products:data";

// Barcode Scanning Events (Retail/Pharmacy)
static readonly OnCustomerProductScan = "customer:product:scan";
static readonly EmitCustomerProductData = "customer:product:data";

// POS Response Events
static readonly OnPOSMenuCategoriesResponse = "pos:menu:categories:response";
static readonly OnPOSMenuProductsResponse = "pos:menu:products:response";
static readonly OnPOSProductScanResponse = "pos:product:scan:response";

// POS Request Events
static readonly EmitPOSMenuCategoriesRequest = "pos:menu:categories:request";
static readonly EmitPOSMenuProductsRequest = "pos:menu:products:request";
static readonly EmitPOSProductScanRequest = "pos:product:scan:request";

// Error Events
static readonly EmitCustomerError = "customer:error";
static readonly EmitCustomerTimeout = "customer:timeout";
```

---

## Phase 7: Create Customer App Handler

### File: `src/socketio/handlers/customer-app.handler.ts`

Create this new file with the complete handler implementation (see full code in original guide Phase 3.2).

Key functions:
- `setupCustomerAppHandlers()` - Main setup function
- `handleCustomerConnection()` - Validates seat and connects customer
- `handleMenuBrowsing()` - Handles restaurant/cafe menu queries
- `handleBarcodeScanning()` - Handles retail/pharmacy barcode scans
- `handleCustomerDisconnection()` - Cleanup on disconnect

---

## Phase 8: Create POS Response Handler

### File: `src/socketio/handlers/pos-customer-response.handler.ts`

Create this new file with the complete handler implementation (see full code in original guide Phase 4.1).

Key functions:
- `setupPOSCustomerResponseHandlers()` - Main setup function
- `handleMenuCategoriesResponse()` - Forwards menu categories to customer
- `handleMenuProductsResponse()` - Forwards products to customer
- `handleProductScanResponse()` - Forwards product info to customer

---

## Phase 9: Update Socket.IO Bootstrap

### File: `src/socketio/bootstrap.ts` (or your main Socket.IO file)

Add imports:
```typescript
import setupCustomerAppHandlers from './handlers/customer-app.handler';
import setupPOSCustomerResponseHandlers from './handlers/pos-customer-response.handler';
```

Update connection handler:
```typescript
io.on('connection', async (socket: Socket) => {
  const clientType = socket.handshake.query.clientType as string;

  // Handle customer connections (no auth required)
  if (clientType === 'customer') {
    socket.data.clientType = 'customer';
    setupCustomerAppHandlers(socket, strapi, io);
    strapi.log.info(`[SocketIO] Customer client connected: ${socket.id}`);
    return;
  }

  // Existing auth logic for POS and mobile...
  
  if (clientType === 'pos') {
    await setupPOSHandlers(socket, strapi, io);
    setupPOSCustomerResponseHandlers(socket, strapi, io); // NEW
  }
});
```

---

## Phase 10: Add Public Seat Info Endpoint

### File: `src/api/key-seat/controllers/key-seat.ts`

Add this method:

```typescript
/**
 * GET /api/key-seats/public/:publicSeatId
 * Gets public seat information (no auth required)
 */
async getPublicSeatInfo(ctx) {
  try {
    const { publicSeatId } = ctx.params;

    if (!publicSeatId) {
      return ctx.badRequest('Public seat ID is required');
    }

    const seats = await strapi.documents('api::key-seat.key-seat').findMany({
      filters: {
        publicSeatId,
        isActive: true,
        allowCustomerApp: true
      },
      fields: [
        'publicSeatId',
        'businessName',
        'businessType',
        'allowMenuBrowsing',
        'allowBarcodeScanning',
        'allowCustomerOrdering',
        'isConnected',
        'currentCustomerConnections',
        'maxCustomerConnections'
      ],
      status: 'published'
    });

    if (!seats || seats.length === 0) {
      return ctx.notFound('Seat not found or customer app not enabled');
    }

    const seat = seats[0];

    if (!seat.isConnected) {
      return ctx.send({
        success: false,
        error: 'POS device is currently offline',
        seat: {
          publicSeatId: seat.publicSeatId,
          businessName: seat.businessName,
          businessType: seat.businessType,
          isOnline: false
        }
      });
    }

    const currentConnections = seat.currentCustomerConnections || 0;
    const maxConnections = seat.maxCustomerConnections || 50;

    return ctx.send({
      success: true,
      seat: {
        publicSeatId: seat.publicSeatId,
        businessName: seat.businessName,
        businessType: seat.businessType,
        isOnline: seat.isConnected,
        canConnect: currentConnections < maxConnections,
        currentConnections,
        maxConnections,
        features: {
          allowMenuBrowsing: seat.allowMenuBrowsing,
          allowBarcodeScanning: seat.allowBarcodeScanning,
          allowCustomerOrdering: seat.allowCustomerOrdering
        }
      }
    });
  } catch (error) {
    strapi.log.error('[KeySeatController] Error getting public seat info:', error);
    return ctx.internalServerError('Failed to get seat information');
  }
}
```

---

## Phase 11: Add Custom Routes

### File: `src/api/key-seat/routes/custom-routes.ts`

Create or update this file:

```typescript
export default {
  routes: [
    {
      method: 'GET',
      path: '/key-seats/public/:publicSeatId',
      handler: 'key-seat.getPublicSeatInfo',
      config: {
        auth: false, // Public endpoint
        policies: [],
        middlewares: []
      }
    }
  ]
};
```

---

## Phase 12: Database Migration

### File: `database/migrations/add-customer-app-fields.ts`

Create migration script to update existing seats (see full code in original guide Phase 8).

Run with:
```bash
npm run strapi migration:run
```

---

## Testing Checklist

- [ ] Subscription plan schema updated
- [ ] Key-seat schema updated
- [ ] Public ID generator working
- [ ] License activation copies plan features
- [ ] Socket.IO handlers registered
- [ ] Public seat info endpoint accessible
- [ ] Migration script tested on staging

---

## Deployment Steps

1. Backup database
2. Apply schema changes (restart Strapi)
3. Run migration script
4. Deploy code changes
5. Verify Socket.IO events working
6. Test customer connection flow

---

## Monitoring

After deployment, monitor:
- Customer connection counts per seat
- Socket.IO event latency
- Public seat ID uniqueness
- Plan feature propagation accuracy
