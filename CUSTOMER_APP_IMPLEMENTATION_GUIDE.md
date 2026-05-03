# Customer-Facing Mobile App Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Schema Changes](#schema-changes)
4. [Phase 1: Subscription Plan Features](#phase-1-subscription-plan-features)
5. [Phase 2: Seat Activation with Plan Validation](#phase-2-seat-activation-with-plan-validation)
6. [Phase 3: Socket.IO Events by Business Type](#phase-3-socketio-events-by-business-type)
7. [Phase 4: Customer Connection & Product Queries](#phase-4-customer-connection--product-queries)
8. [Testing Strategy](#testing-strategy)

---

## Overview

This guide provides step-by-step implementation instructions for adding customer-facing mobile app support to the POS system. The implementation includes:

- **Plan-based feature flags** (allowCustomerApp at subscription plan level)
- **Seat-level public identifiers** (publicSeatId for customer connections)
- **Business-type-specific Socket.IO events** (different flows for restaurant/cafe vs retail/pharmacy)
- **Targeted event broadcasting** (customer-specific responses, not room-wide broadcasts)
- **Real-time product queries** (menu browsing for restaurants, barcode scanning for retail)

### Key Design Decisions

#### Decision 1: Feature Flags Location
**Chosen Approach**: Store `allowCustomerApp` flag at **both** Subscription Plan AND Key-Seat levels

**Rationale**:
- **Subscription Plan**: Defines what features are available in the plan
- **Key-Seat**: Caches the feature flag during activation to avoid repeated plan lookups
- **Benefits**: 
  - No performance impact (no plan refetch on every customer connection)
  - Plan changes can be propagated to seats via admin action
  - Seats can be individually toggled without changing the plan

**Implementation Flow**:
```
License Activation → Check User's Plan → Copy allowCustomerApp to Seat → Customer Connects → Check Seat Flag
```

#### Decision 2: Business-Type-Specific Events
**Chosen Approach**: Different Socket.IO event flows based on `businessType` field

**Restaurant/Cafe Flow**:
```
Customer → customer:menu:categories → Server → POS
POS → pos:menu:categories:response → Server → Specific Customer
Customer → customer:menu:products → Server → POS (with categoryId)
POS → pos:menu:products:response → Server → Specific Customer
```

**Retail/Pharmacy Flow**:
```
Customer → customer:product:scan → Server → POS (with barcode)
POS → pos:product:scan:response → Server → Specific Customer
```

**Rationale**:
- Restaurants need category-based browsing (menu structure)
- Retail needs barcode-based lookup (individual product queries)
- Avoids sending entire product catalog to customers
- Reduces bandwidth and improves performance

#### Decision 3: Targeted Event Broadcasting
**Chosen Approach**: Use `socket.id` to send responses to specific customers, not room-wide broadcasts

**Rationale**:
- Multiple customers can query simultaneously
- Each customer should only receive their own query results
- Prevents data leakage between customers
- Maintains privacy and reduces confusion

**Implementation Pattern**:
```typescript
// Customer sends query with their socket ID
socket.emit('customer:product:scan', { barcode: '123', customerId: socket.id });

// Server forwards to POS with customer ID
io.to(posRoomName).emit('pos:product:scan', { barcode: '123', customerId });

// POS responds with customer ID
posSocket.emit('pos:product:scan:response', { product, customerId });

// Server sends ONLY to that specific customer
io.to(customerId).emit('customer:product:data', { product });
```

---

## Architecture Decisions

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUBSCRIPTION PLAN                            │
│  - allowCustomerApp: boolean                                     │
│  - allowMenuBrowsing: boolean                                    │
│  - allowBarcodeScanning: boolean                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Plan features copied during activation
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                         LICENSE                                  │
│  - user: User                                                    │
│  - planSubscriptionType: enum                                    │
│  - maxSeats: number                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Activation creates seat with plan features
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        KEY-SEAT                                  │
│  - publicSeatId: string (unique)                                 │
│  - businessName: string                                          │
│  - businessType: enum (restaurant|retail|cafe|pharmacy|other)    │
│  - allowCustomerApp: boolean (copied from plan)                  │
│  - allowMenuBrowsing: boolean (copied from plan)                 │
│  - allowBarcodeScanning: boolean (copied from plan)              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Customer connects via publicSeatId
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER CONNECTION                           │
│  Socket Room: seat:{seatDocumentId}:customers                    │
│  Socket Data: { connectedSeatId, publicSeatId, clientType }     │
└─────────────────────────────────────────────────────────────────┘
```

### Socket.IO Room Structure

```
┌──────────────────────────────────────────────────────────────────┐
│                         SOCKET.IO ROOMS                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POS Room: seat:{seatDocumentId}:pos                            │
│  └─ Contains: POS device socket                                 │
│                                                                  │
│  Customer Room: seat:{seatDocumentId}:customers                 │
│  └─ Contains: All customer sockets connected to this seat       │
│                                                                  │
│  Owner Room: user:{userDocumentId}:seats                        │
│  └─ Contains: Mobile app sockets of license owner               │
│                                                                  │
│  Individual Customer: {customerId} (socket.id)                  │
│  └─ Used for targeted responses to specific customers           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Subscription Plan Features

### Step 1.1: Update Subscription Plan Schema

**File**: `src/api/subscription-plan/content-types/subscription-plan/schema.json`

Add customer app feature flags to the subscription plan:

```json
{
  "attributes": {
    // ... existing fields ...
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
}
```

**Why these fields?**
- `allowCustomerApp`: Master toggle for the entire customer app feature
- `allowMenuBrowsing`: Specific to restaurant/cafe business types
- `allowBarcodeScanning`: Specific to retail/pharmacy business types
- `allowCustomerOrdering`: Future feature for direct ordering
- `maxCustomerConnectionsPerSeat`: Prevents abuse and manages server load

### Step 1.2: Create Subscription Plan Service Helper

**File**: `src/api/subscription-plan/services/subscription-plan.ts`

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::subscription-plan.subscription-plan', ({ strapi }) => ({
  /**
   * Gets customer app features for a specific plan
   * @param planDocumentId - Document ID of the subscription plan
   * @returns Customer app feature flags
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
   * @param userDocumentId - Document ID of the user
   * @returns Customer app feature flags or null if no plan
   */
  async getCustomerAppFeaturesByUser(userDocumentId: string) {
    try {
      // Get user with subscription plan
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

**Purpose**: Centralized service for fetching plan features, used during seat activation.

---

## Phase 2: Seat Activation with Plan Validation

### Step 2.1: Update Key-Seat Schema

**File**: `src/api/key-seat/content-types/key-seat/schema.json`

Add customer app fields to the seat schema:

```json
{
  "attributes": {
    // ... existing fields ...
    "publicSeatId": {
      "type": "string",
      "unique": true,
      "required": false,
      "description": "Public identifier for customer connections (e.g., REST42A, CAFE001)"
    },
    "businessName": {
      "type": "string",
      "required": false,
      "description": "Display name for the business (e.g., 'Joe's Pizza', 'Main Street Pharmacy')"
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
      "description": "Enable customer app for this seat (copied from plan during activation)"
    },
    "allowMenuBrowsing": {
      "type": "boolean",
      "default": false,
      "description": "Allow menu browsing (restaurant/cafe)"
    },
    "allowBarcodeScanning": {
      "type": "boolean",
      "default": false,
      "description": "Allow barcode scanning (retail/pharmacy)"
    },
    "allowCustomerOrdering": {
      "type": "boolean",
      "default": false,
      "description": "Allow direct ordering from customer app"
    },
    "maxCustomerConnections": {
      "type": "integer",
      "default": 50,
      "description": "Max concurrent customer connections"
    }
  }
}
```

### Step 2.2: Create Public Seat ID Generator Utility

**File**: `src/api/key-seat/utils/public-id-generator.ts`

```typescript
import type { Core } from '@strapi/strapi';

/**
 * Generates a unique, customer-friendly seat identifier
 * Format: PREFIX + 4-6 random alphanumeric characters
 * Examples: "REST42A", "CAFE001", "PHRM5X2"
 */
export function generatePublicSeatId(businessType?: string): string {
  const prefix = getBusinessPrefix(businessType);
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}${random}`;
}

/**
 * Gets business type prefix for public seat IDs
 */
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

/**
 * Validates public seat ID format
 */
export function isValidPublicSeatId(id: string): boolean {
  return /^[A-Z]{4}[A-Z0-9]{4,6}$/.test(id);
}

/**
 * Generates a unique public seat ID by checking database for collisions
 * @param strapi - Strapi instance
 * @param businessType - Type of business
 * @param maxAttempts - Maximum generation attempts before failing
 * @returns Unique public seat ID
 */
export async function generateUniquePublicSeatId(
  strapi: Core.Strapi,
  businessType?: string,
  maxAttempts: number = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const publicSeatId = generatePublicSeatId(businessType);

    // Check if ID already exists
    const existing = await strapi.documents('api::key-seat.key-seat').findMany({
      filters: { publicSeatId },
      status: 'published',
      limit: 1
    });

    if (!existing || existing.length === 0) {
      return publicSeatId;
    }

    strapi.log.warn(`[PublicIdGenerator] Collision detected for ${publicSeatId}, retrying...`);
  }

  throw new Error(`Failed to generate unique public seat ID after ${maxAttempts} attempts`);
}
```

### Step 2.3: Update License Activation Controller

**File**: `src/api/license/controllers/license.ts`

Modify the `activate` method to include plan feature propagation:

```typescript
async activate(ctx) {
  try {
    const { licenseKey, machineUUID, telemetry, timezone, businessType, businessName } = ctx.request.body;

    // ... existing validation code ...

    // After validating license and before creating/updating seat:
    
    // Get user's subscription plan features
    const planService = strapi.service('api::subscription-plan.subscription-plan');
    const planFeatures = await planService.getCustomerAppFeaturesByUser(userDocumentId);

    // Generate unique public seat ID
    const { generateUniquePublicSeatId } = await import('../key-seat/utils/public-id-generator');
    const publicSeatId = await generateUniquePublicSeatId(strapi, businessType);

    // Prepare seat data with plan features
    const seatData: any = {
      machineUUID,
      isActive: true,
      timezone: validatedTimezone,
      license: license.documentId,
      telemetry: {
        ...telemetry,
        firstActivated: new Date().toISOString()
      },
      publicSeatId,
      businessType: businessType || 'retail',
      businessName: businessName || 'My Business'
    };

    // Copy plan features to seat if plan exists
    if (planFeatures) {
      seatData.allowCustomerApp = planFeatures.allowCustomerApp;
      seatData.allowMenuBrowsing = planFeatures.allowMenuBrowsing;
      seatData.allowBarcodeScanning = planFeatures.allowBarcodeScanning;
      seatData.allowCustomerOrdering = planFeatures.allowCustomerOrdering;
      seatData.maxCustomerConnections = planFeatures.maxCustomerConnectionsPerSeat;

      strapi.log.info('[LicenseActivation] Applied plan features to seat:', {
        publicSeatId,
        allowCustomerApp: planFeatures.allowCustomerApp,
        businessType: seatData.businessType
      });
    } else {
      strapi.log.warn('[LicenseActivation] No plan features found, using defaults');
    }

    // Create or update seat
    if (existingSeatForThisLicense) {
      // Update existing seat
      keySeat = await strapi.documents('api::key-seat.key-seat').update({
        documentId: existingSeatForThisLicense.documentId,
        status: 'published',
        data: seatData
      });
    } else {
      // Create new seat
      keySeat = await strapi.documents('api::key-seat.key-seat').create({
        data: seatData,
        status: 'published'
      });
    }

    // ... rest of activation logic ...

    // Return response with public seat ID
    return ctx.send({
      data: {
        message: 'License activated successfully',
        license: {
          // ... existing license data ...
        },
        seat: {
          documentId: keySeat.documentId,
          machineUUID: keySeat.machineUUID,
          publicSeatId: keySeat.publicSeatId,
          businessName: keySeat.businessName,
          businessType: keySeat.businessType,
          isActive: keySeat.isActive,
          allowCustomerApp: keySeat.allowCustomerApp
        }
      }
    });
  } catch (error) {
    // ... error handling ...
  }
}
```

**Key Changes**:
1. Accept `businessType` and `businessName` in activation request
2. Fetch user's subscription plan features
3. Generate unique `publicSeatId`
4. Copy plan features to seat during activation
5. Return `publicSeatId` in response for POS to display (QR code, etc.)

---

## Phase 1: Subscription Plan Features

### Step 1.1: Update Subscription Plan Schema

**File**: `src/api/subscription-plan/content-types/subscription-plan/schema.json`

Add customer app feature flags to the subscription plan:

```json
{
  "attributes": {
    // ... existing fields ...
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
}
```

**Why these fields?**
- `allowCustomerApp`: Master toggle for the entire customer app feature
- `allowMenuBrowsing`: Specific to restaurant/cafe business types
- `allowBarcodeScanning`: Specific to retail/pharmacy business types
- `allowCustomerOrdering`: Future feature for direct ordering
- `maxCustomerConnectionsPerSeat`: Prevents abuse and manages server load

### Step 1.2: Create Subscription Plan Service Helper

**File**: `src/api/subscription-plan/services/subscription-plan.ts`

```typescript
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::subscription-plan.subscription-plan', ({ strapi }) => ({
  /**
   * Gets customer app features for a specific plan
   * @param planDocumentId - Document ID of the subscription plan
   * @returns Customer app feature flags
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
   * @param userDocumentId - Document ID of the user
   * @returns Customer app feature flags or null if no plan
   */
  async getCustomerAppFeaturesByUser(userDocumentId: string) {
    try {
      // Get user with subscription plan
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

**Purpose**: Centralized service for retrieving plan features, used during seat activation.

---

## Phase 2: Seat Activation with Plan Validation

### Step 2.1: Update Key-Seat Schema

**File**: `src/api/key-seat/content-types/key-seat/schema.json`

Add customer app fields to the seat schema:

```json
{
  "attributes": {
    // ... existing fields ...
    "publicSeatId": {
      "type": "string",
      "unique": true,
      "required": false,
      "description": "Public identifier for customer connections (e.g., REST42A, CAFE001)"
    },
    "businessName": {
      "type": "string",
      "required": false,
      "description": "Display name for the business (e.g., 'Joe's Pizza', 'Main Street Pharmacy')"
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
      "description": "Enable customer app for this seat (copied from plan during activation)"
    },
    "allowMenuBrowsing": {
      "type": "boolean",
      "default": false,
      "description": "Allow menu/category browsing (copied from plan)"
    },
    "allowBarcodeScanning": {
      "type": "boolean",
      "default": false,
      "description": "Allow barcode scanning (copied from plan)"
    },
    "allowCustomerOrdering": {
      "type": "boolean",
      "default": false,
      "description": "Allow direct ordering (copied from plan)"
    },
    "maxCustomerConnections": {
      "type": "integer",
      "default": 50,
      "description": "Max concurrent customer connections (copied from plan)"
    },
    "currentCustomerConnections": {
      "type": "integer",
      "default": 0,
      "description": "Current number of connected customers (updated in real-time)"
    }
  }
}
```

### Step 2.2: Create Public Seat ID Generator Utility

**File**: `src/api/key-seat/utils/public-id-generator.ts`

```typescript
import type { Core } from '@strapi/strapi';

/**
 * Generates a unique, customer-friendly seat identifier
 * Format: PREFIX + 4-6 random alphanumeric characters
 * Examples: "REST42A", "CAFE001", "PHARMA123", "RETL5X9"
 */
export function generatePublicSeatId(businessType?: string): string {
  const prefix = getBusinessPrefix(businessType);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${random}`;
}

/**
 * Gets business type prefix for public seat IDs
 */
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

/**
 * Validates public seat ID format
 * Must be 6-12 uppercase alphanumeric characters
 */
export function isValidPublicSeatId(id: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(id);
}

/**
 * Generates a unique public seat ID by checking database for collisions
 * @param strapi - Strapi instance
 * @param businessType - Type of business
 * @param maxAttempts - Maximum number of generation attempts
 * @returns Unique public seat ID
 */
export async function generateUniquePublicSeatId(
  strapi: Core.Strapi,
  businessType?: string,
  maxAttempts: number = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const publicSeatId = generatePublicSeatId(businessType);

    // Check if this ID already exists
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

### Step 2.3: Modify License Activation Controller

**File**: `src/api/license/controllers/license.ts`

Update the `activate` method to copy plan features to the seat:

```typescript
// Inside the activate method, after validating the license and before creating the seat

// Get user's subscription plan features
const planService = strapi.service('api::subscription-plan.subscription-plan');
const planFeatures = await planService.getCustomerAppFeaturesByUser(userDocumentId);

// Generate unique public seat ID
const { generateUniquePublicSeatId } = await import('../../key-seat/utils/public-id-generator');
const publicSeatId = await generateUniquePublicSeatId(strapi, telemetry?.businessType);

// Create new key-seat entry with plan features
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
```

**Important**: The POS app must now send `businessName` and `businessType` in the activation telemetry:

```typescript
// POS App activation request body
{
  licenseKey: "encrypted_key",
  machineUUID: "device_uuid",
  timezone: "America/New_York",
  telemetry: {
    os: "Windows",
    appVersion: "1.0.0",
    businessName: "Joe's Pizza",      // NEW: Required for customer app
    businessType: "restaurant"         // NEW: Required for customer app
  }
}
```

---

## Phase 3: Socket.IO Events by Business Type

### Step 3.1: Add Customer App Event Constants

**File**: `src/socketio/events_constants.ts`

Add new event constants for customer app interactions:

```typescript
export class SocketIOEvents {
  // ... existing events ...

  // ============================================
  // CUSTOMER APP EVENTS
  // ============================================

  // Connection Events
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

  // POS Response Events (POS → Server → Customer)
  static readonly OnPOSMenuCategoriesResponse = "pos:menu:categories:response";
  static readonly OnPOSMenuProductsResponse = "pos:menu:products:response";
  static readonly OnPOSProductScanResponse = "pos:product:scan:response";

  // POS Request Events (Server → POS)
  static readonly EmitPOSMenuCategoriesRequest = "pos:menu:categories:request";
  static readonly EmitPOSMenuProductsRequest = "pos:menu:products:request";
  static readonly EmitPOSProductScanRequest = "pos:product:scan:request";

  // Error Events
  static readonly EmitCustomerError = "customer:error";
  static readonly EmitCustomerTimeout = "customer:timeout";
}
```

### Step 3.2: Create Customer App Handler

**File**: `src/socketio/handlers/customer-app.handler.ts`

```typescript
import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';
import { SocketIOEvents } from '../events_constants';

interface CustomerConnectPayload {
  publicSeatId: string;
}

interface MenuCategoriesPayload {
  // No additional data needed - fetch all categories
}

interface MenuProductsPayload {
  categoryId: string;
}

interface ProductScanPayload {
  barcode: string;
}

/**
 * Sets up customer app event handlers for Socket.IO connections
 * This should be called when a customer connects (no authentication required)
 */
export function setupCustomerAppHandlers(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  strapi.log.info(`[CustomerAppHandler] Setting up handlers for socket ${socket.id}`);

  // Handle customer connection with publicSeatId
  handleCustomerConnection(socket, strapi, io);

  // Handle menu browsing (restaurant/cafe)
  handleMenuBrowsing(socket, strapi, io);

  // Handle barcode scanning (retail/pharmacy)
  handleBarcodeScanning(socket, strapi, io);

  // Handle disconnection
  handleCustomerDisconnection(socket, strapi);
}

/**
 * Handles customer connection to a specific seat via publicSeatId
 */
function handleCustomerConnection(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnCustomerConnect, async (payload: CustomerConnectPayload) => {
    try {
      const { publicSeatId } = payload;

      if (!publicSeatId) {
        socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
          success: false,
          error: 'Public seat ID is required'
        });
        return;
      }

      strapi.log.info(`[CustomerAppHandler] Customer connecting to seat: ${publicSeatId}`);

      // Find seat by publicSeatId
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: {
          publicSeatId,
          isActive: true,
          allowCustomerApp: true
        },
        populate: ['license'],
        status: 'published'
      });

      if (!seats || seats.length === 0) {
        socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
          success: false,
          error: 'Invalid seat ID or customer app not enabled'
        });
        return;
      }

      const seat = seats[0];

      // Check if seat is online (POS connected)
      if (!seat.isConnected) {
        socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
          success: false,
          error: 'POS device is currently offline'
        });
        return;
      }

      // Check customer connection limit
      const currentConnections = seat.currentCustomerConnections || 0;
      const maxConnections = seat.maxCustomerConnections || 50;

      if (currentConnections >= maxConnections) {
        socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
          success: false,
          error: 'Maximum customer connections reached. Please try again later.'
        });
        return;
      }

      // Join customer-specific room for this seat
      const customerRoomName = `seat:${seat.documentId}:customers`;
      socket.join(customerRoomName);

      // Store seat info in socket data
      socket.data.connectedSeatId = seat.documentId;
      socket.data.publicSeatId = publicSeatId;
      socket.data.clientType = 'customer';
      socket.data.businessType = seat.businessType;

      // Increment customer connection count
      await strapi.documents('api::key-seat.key-seat').update({
        documentId: seat.documentId,
        data: {
          currentCustomerConnections: currentConnections + 1
        },
        status: 'published'
      });

      // Send success response with seat info
      socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
        success: true,
        seat: {
          publicSeatId: seat.publicSeatId,
          businessName: seat.businessName,
          businessType: seat.businessType,
          features: {
            allowMenuBrowsing: seat.allowMenuBrowsing,
            allowBarcodeScanning: seat.allowBarcodeScanning,
            allowCustomerOrdering: seat.allowCustomerOrdering
          }
        }
      });

      strapi.log.info(`[CustomerAppHandler] Customer connected successfully:`, {
        publicSeatId,
        socketId: socket.id,
        businessType: seat.businessType,
        currentConnections: currentConnections + 1
      });
    } catch (error) {
      strapi.log.error('[CustomerAppHandler] Connection error:', error);
      socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
        success: false,
        error: 'Connection failed'
      });
    }
  });
}

/**
 * Handles menu browsing for restaurant/cafe business types
 */
function handleMenuBrowsing(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  // Request menu categories
  socket.on(SocketIOEvents.OnCustomerMenuCategories, async (payload: MenuCategoriesPayload) => {
    try {
      const { connectedSeatId, businessType } = socket.data;

      if (!connectedSeatId) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          error: 'Not connected to a seat'
        });
        return;
      }

      // Validate business type supports menu browsing
      if (businessType !== 'restaurant' && businessType !== 'cafe') {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          error: 'Menu browsing not available for this business type'
        });
        return;
      }

      // Get seat to check features
      const seat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId: connectedSeatId,
        status: 'published'
      });

      if (!seat || !seat.allowMenuBrowsing) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          error: 'Menu browsing not enabled'
        });
        return;
      }

      strapi.log.info(`[CustomerAppHandler] Menu categories requested:`, {
        seatId: connectedSeatId,
        customerId: socket.id
      });

      // Forward request to POS device
      const posRoomName = `seat:${connectedSeatId}:pos`;
      io.to(posRoomName).emit(SocketIOEvents.EmitPOSMenuCategoriesRequest, {
        customerId: socket.id,
        requestId: `${socket.id}-${Date.now()}`
      });

      // Set timeout for POS response
      setTimeout(() => {
        // Check if response was received (would be handled in POS response handler)
        socket.emit(SocketIOEvents.EmitCustomerTimeout, {
          error: 'Request timeout - POS did not respond'
        });
      }, 10000); // 10 second timeout

    } catch (error) {
      strapi.log.error('[CustomerAppHandler] Menu categories error:', error);
      socket.emit(SocketIOEvents.EmitCustomerError, {
        error: 'Failed to fetch menu categories'
      });
    }
  });

  // Request products by category
  socket.on(SocketIOEvents.OnCustomerMenuProducts, async (payload: MenuProductsPayload) => {
    try {
      const { connectedSeatId, businessType } = socket.data;
      const { categoryId } = payload;

      if (!connectedSeatId) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          error: 'Not connected to a seat'
        });
        return;
      }

      if (!categoryId) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          error: 'Category ID is required'
        });
        return;
      }

      // Validate business type
      if (businessType !== 'restaurant' && businessType !== 'cafe') {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          error: 'Menu browsing not available for this business type'
        });
        return;
      }

      strapi.log.info(`[CustomerAppHandler] Menu products requested:`, {
        seatId: connectedSeatId,
        categoryId,
        customerId: socket.id
      });

      // Forward request to POS device
      const posRoomName = `seat:${connectedSeatId}:pos`;
      io.to(posRoomName).emit(SocketIOEvents.EmitPOSMenuProductsRequest, {
        customerId: socket.id,
        categoryId,
        requestId: `${socket.id}-${Date.now()}`
      });

    } catch (error) {
      strapi.log.error('[CustomerAppHandler] Menu products error:', error);
      socket.emit(SocketIOEvents.EmitCustomerError, {
        error: 'Failed to fetch menu products'
      });
    }
  });
}

/**
 * Handles barcode scanning for retail/pharmacy business types
 */
function handleBarcodeScanning(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnCustomerProductScan, async (payload: ProductScanPayload) => {
    try {
      const { connectedSeatId, businessType } = socket.data;
      const { barcode } = payload;

      if (!connectedSeatId) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          error: 'Not connected to a seat'
        });
        return;
      }

      if (!barcode) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          error: 'Barcode is required'
        });
        return;
      }

      // Validate business type supports barcode scanning
      if (businessType !== 'retail' && businessType !== 'pharmacy') {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          error: 'Barcode scanning not available for this business type'
        });
        return;
      }

      // Get seat to check features
      const seat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId: connectedSeatId,
        status: 'published'
      });

      if (!seat || !seat.allowBarcodeScanning) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          error: 'Barcode scanning not enabled'
        });
        return;
      }

      strapi.log.info(`[CustomerAppHandler] Product scan requested:`, {
        seatId: connectedSeatId,
        barcode,
        customerId: socket.id
      });

      // Forward request to POS device
      const posRoomName = `seat:${connectedSeatId}:pos`;
      io.to(posRoomName).emit(SocketIOEvents.EmitPOSProductScanRequest, {
        customerId: socket.id,
        barcode,
        requestId: `${socket.id}-${Date.now()}`
      });

    } catch (error) {
      strapi.log.error('[CustomerAppHandler] Product scan error:', error);
      socket.emit(SocketIOEvents.EmitCustomerError, {
        error: 'Failed to scan product'
      });
    }
  });
}

/**
 * Handles customer disconnection and cleanup
 */
function handleCustomerDisconnection(
  socket: Socket,
  strapi: Core.Strapi
): void {
  socket.on('disconnect', async () => {
    try {
      const { connectedSeatId } = socket.data;

      if (connectedSeatId) {
        // Decrement customer connection count
        const seat = await strapi.documents('api::key-seat.key-seat').findOne({
          documentId: connectedSeatId,
          status: 'published'
        });

        if (seat) {
          const currentConnections = seat.currentCustomerConnections || 0;
          await strapi.documents('api::key-seat.key-seat').update({
            documentId: connectedSeatId,
            data: {
              currentCustomerConnections: Math.max(0, currentConnections - 1)
            },
            status: 'published'
          });

          strapi.log.info(`[CustomerAppHandler] Customer disconnected:`, {
            seatId: connectedSeatId,
            socketId: socket.id,
            remainingConnections: Math.max(0, currentConnections - 1)
          });
        }
      }
    } catch (error) {
      strapi.log.error('[CustomerAppHandler] Disconnection cleanup error:', error);
    }
  });
}

export default setupCustomerAppHandlers;
```

---

## Phase 4: Customer Connection & Product Queries

### Step 4.1: Create POS Response Handler

**File**: `src/socketio/handlers/pos-customer-response.handler.ts`

This handler processes responses from POS devices and forwards them to specific customers:

```typescript
import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';
import { SocketIOEvents } from '../events_constants';

interface POSMenuCategoriesResponse {
  customerId: string;
  requestId: string;
  categories: Array<{
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    sortOrder?: number;
  }>;
}

interface POSMenuProductsResponse {
  customerId: string;
  requestId: string;
  categoryId: string;
  products: Array<{
    id: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    isAvailable: boolean;
  }>;
}

interface POSProductScanResponse {
  customerId: string;
  requestId: string;
  barcode: string;
  product?: {
    id: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    stock: number;
    isAvailable: boolean;
  };
  found: boolean;
}

/**
 * Sets up POS response handlers for customer queries
 * This should be called for POS device connections
 */
export function setupPOSCustomerResponseHandlers(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  // Only set up for POS clients
  if (socket.data?.clientType !== 'pos') {
    return;
  }

  strapi.log.info(`[POSCustomerResponseHandler] Setting up handlers for POS socket ${socket.id}`);

  // Handle menu categories response
  handleMenuCategoriesResponse(socket, strapi, io);

  // Handle menu products response
  handleMenuProductsResponse(socket, strapi, io);

  // Handle product scan response
  handleProductScanResponse(socket, strapi, io);
}

/**
 * Handles POS response for menu categories request
 */
function handleMenuCategoriesResponse(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnPOSMenuCategoriesResponse, async (payload: POSMenuCategoriesResponse) => {
    try {
      const { customerId, requestId, categories } = payload;

      if (!customerId) {
        strapi.log.warn('[POSCustomerResponseHandler] Menu categories response missing customerId');
        return;
      }

      strapi.log.info(`[POSCustomerResponseHandler] Forwarding menu categories to customer:`, {
        customerId,
        requestId,
        categoriesCount: categories?.length || 0
      });

      // Send response ONLY to the specific customer who requested it
      io.to(customerId).emit(SocketIOEvents.EmitCustomerMenuCategories, {
        success: true,
        requestId,
        categories: categories || []
      });

    } catch (error) {
      strapi.log.error('[POSCustomerResponseHandler] Menu categories response error:', error);
    }
  });
}

/**
 * Handles POS response for menu products request
 */
function handleMenuProductsResponse(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnPOSMenuProductsResponse, async (payload: POSMenuProductsResponse) => {
    try {
      const { customerId, requestId, categoryId, products } = payload;

      if (!customerId) {
        strapi.log.warn('[POSCustomerResponseHandler] Menu products response missing customerId');
        return;
      }

      strapi.log.info(`[POSCustomerResponseHandler] Forwarding menu products to customer:`, {
        customerId,
        requestId,
        categoryId,
        productsCount: products?.length || 0
      });

      // Send response ONLY to the specific customer who requested it
      io.to(customerId).emit(SocketIOEvents.EmitCustomerMenuProducts, {
        success: true,
        requestId,
        categoryId,
        products: products || []
      });

    } catch (error) {
      strapi.log.error('[POSCustomerResponseHandler] Menu products response error:', error);
    }
  });
}

/**
 * Handles POS response for product scan request
 */
function handleProductScanResponse(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnPOSProductScanResponse, async (payload: POSProductScanResponse) => {
    try {
      const { customerId, requestId, barcode, product, found } = payload;

      if (!customerId) {
        strapi.log.warn('[POSCustomerResponseHandler] Product scan response missing customerId');
        return;
      }

      strapi.log.info(`[POSCustomerResponseHandler] Forwarding product scan result to customer:`, {
        customerId,
        requestId,
        barcode,
        found
      });

      // Send response ONLY to the specific customer who requested it
      io.to(customerId).emit(SocketIOEvents.EmitCustomerProductData, {
        success: true,
        requestId,
        barcode,
        found,
        product: found ? product : null,
        message: found ? 'Product found' : 'Product not found'
      });

    } catch (error) {
      strapi.log.error('[POSCustomerResponseHandler] Product scan response error:', error);
    }
  });
}

export default setupPOSCustomerResponseHandlers;
```

### Step 4.2: Update Main Socket.IO Bootstrap

**File**: `src/socketio/bootstrap.ts` (or wherever you initialize Socket.IO)

Update the connection handler to support customer connections:

```typescript
import setupCustomerAppHandlers from './handlers/customer-app.handler';
import setupPOSCustomerResponseHandlers from './handlers/pos-customer-response.handler';

// Inside your Socket.IO connection handler
io.on('connection', async (socket: Socket) => {
  strapi.log.info(`[SocketIO] New connection: ${socket.id}`);

  // Extract client type from handshake query
  const clientType = socket.handshake.query.clientType as string;

  if (clientType === 'customer') {
    // Customer connection (no authentication required)
    socket.data.clientType = 'customer';
    setupCustomerAppHandlers(socket, strapi, io);
    
    strapi.log.info(`[SocketIO] Customer client connected: ${socket.id}`);
    return;
  }

  // For POS and mobile owner apps, require authentication
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    strapi.log.warn(`[SocketIO] No token provided for ${clientType} client`);
    socket.disconnect();
    return;
  }

  // Authenticate and set up handlers based on client type
  try {
    const user = await authenticateSocket(token);
    socket.data.userId = user.id;
    socket.data.documentId = user.documentId;
    socket.data.clientType = clientType;

    if (clientType === 'pos') {
      // POS device connection
      await setupPOSHandlers(socket, strapi, io);
      setupPOSCustomerResponseHandlers(socket, strapi, io); // NEW: Add customer response handlers
    } else if (clientType === 'mobile') {
      // Mobile owner app connection
      await setupMobileHandlers(socket, strapi, io);
    }

  } catch (error) {
    strapi.log.error('[SocketIO] Authentication failed:', error);
    socket.disconnect();
  }
});
```

### Step 4.3: Create Customer Connection API Endpoint

**File**: `src/api/key-seat/controllers/key-seat.ts`

Add endpoint to get seat info by public ID (for customer app):

```typescript
/**
 * GET /api/key-seats/public/:publicSeatId
 * Gets public seat information for customer app connection
 * No authentication required - public endpoint
 */
async getPublicSeatInfo(ctx) {
  try {
    const { publicSeatId } = ctx.params;

    if (!publicSeatId) {
      return ctx.badRequest('Public seat ID is required');
    }

    // Find seat by publicSeatId
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

    // Check if seat is online
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

    // Check connection limit
    const currentConnections = seat.currentCustomerConnections || 0;
    const maxConnections = seat.maxCustomerConnections || 50;
    const canConnect = currentConnections < maxConnections;

    return ctx.send({
      success: true,
      seat: {
        publicSeatId: seat.publicSeatId,
        businessName: seat.businessName,
        businessType: seat.businessType,
        isOnline: seat.isConnected,
        canConnect,
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

### Step 4.4: Add Custom Route for Public Seat Info

**File**: `src/api/key-seat/routes/custom-routes.ts`

```typescript
export default {
  routes: [
    {
      method: 'GET',
      path: '/key-seats/public/:publicSeatId',
      handler: 'key-seat.getPublicSeatInfo',
      config: {
        auth: false, // No authentication required
        policies: [],
        middlewares: []
      }
    }
  ]
};
```

---

## Phase 5: Testing Strategy

### Step 5.1: Unit Tests for Public ID Generator

**File**: `tests/unit/public-id-generator.test.ts`

```typescript
import { generatePublicSeatId, isValidPublicSeatId } from '../../src/api/key-seat/utils/public-id-generator';

describe('Public Seat ID Generator', () => {
  test('generates valid format', () => {
    const id = generatePublicSeatId('restaurant');
    expect(isValidPublicSeatId(id)).toBe(true);
    expect(id).toMatch(/^REST[A-Z0-9]{4,8}$/);
  });

  test('generates unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(generatePublicSeatId());
    }
    expect(ids.size).toBe(1000); // All unique
  });

  test('uses correct prefixes', () => {
    expect(generatePublicSeatId('restaurant')).toMatch(/^REST/);
    expect(generatePublicSeatId('cafe')).toMatch(/^CAFE/);
    expect(generatePublicSeatId('retail')).toMatch(/^RETL/);
    expect(generatePublicSeatId('pharmacy')).toMatch(/^PHRM/);
  });
});
```

### Step 5.2: Integration Test for License Activation

**Test Scenario**: Verify plan features are copied to seat during activation

```typescript
describe('License Activation with Plan Features', () => {
  test('copies plan features to seat', async () => {
    // 1. Create subscription plan with customer app enabled
    const plan = await strapi.documents('api::subscription-plan.subscription-plan').create({
      data: {
        name: 'Pro Plan',
        allowCustomerApp: true,
        allowMenuBrowsing: true,
        allowBarcodeScanning: false,
        maxCustomerConnectionsPerSeat: 100
      },
      status: 'published'
    });

    // 2. Create user with this plan
    const user = await strapi.documents('plugin::users-permissions.user').create({
      data: {
        username: 'testuser',
        email: 'test@example.com',
        subscriptionPlan: plan.documentId
      }
    });

    // 3. Create license for user
    const license = await createLicense(user.documentId);

    // 4. Activate license
    const response = await request(strapi.server.httpServer)
      .post('/api/licenses/activate')
      .send({
        licenseKey: license.licenseKey,
        machineUUID: 'test-machine-uuid',
        timezone: 'America/New_York',
        telemetry: {
          businessName: 'Test Restaurant',
          businessType: 'restaurant'
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.data.seat).toBeDefined();

    // 5. Verify seat has plan features
    const seat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId: response.body.data.seat.documentId
    });

    expect(seat.allowCustomerApp).toBe(true);
    expect(seat.allowMenuBrowsing).toBe(true);
    expect(seat.allowBarcodeScanning).toBe(false);
    expect(seat.maxCustomerConnections).toBe(100);
    expect(seat.publicSeatId).toMatch(/^REST[A-Z0-9]+$/);
  });
});
```

### Step 5.3: Socket.IO Integration Test

**Test Scenario**: Customer connects and queries menu categories

```typescript
import { io as ioClient, Socket } from 'socket.io-client';

describe('Customer App Socket.IO', () => {
  let customerSocket: Socket;
  let posSocket: Socket;
  let seat: any;

  beforeAll(async () => {
    // Create seat with customer app enabled
    seat = await createTestSeat({
      allowCustomerApp: true,
      allowMenuBrowsing: true,
      businessType: 'restaurant'
    });
  });

  afterAll(async () => {
    customerSocket?.disconnect();
    posSocket?.disconnect();
  });

  test('customer connects to seat', (done) => {
    customerSocket = ioClient('http://localhost:1337', {
      query: { clientType: 'customer' }
    });

    customerSocket.emit('customer:connect', {
      publicSeatId: seat.publicSeatId
    });

    customerSocket.on('customer:connect:success', (response) => {
      expect(response.success).toBe(true);
      expect(response.seat.businessName).toBe(seat.businessName);
      done();
    });
  });

  test('customer requests menu categories', (done) => {
    // Set up POS to respond
    posSocket = ioClient('http://localhost:1337', {
      auth: { token: posAuthToken },
      query: { clientType: 'pos' }
    });

    posSocket.on('pos:menu:categories:request', (request) => {
      // POS responds with categories
      posSocket.emit('pos:menu:categories:response', {
        customerId: request.customerId,
        requestId: request.requestId,
        categories: [
          { id: '1', name: 'Appetizers' },
          { id: '2', name: 'Main Courses' }
        ]
      });
    });

    // Customer requests categories
    customerSocket.emit('customer:menu:categories', {});

    customerSocket.on('customer:menu:categories:data', (response) => {
      expect(response.success).toBe(true);
      expect(response.categories).toHaveLength(2);
      expect(response.categories[0].name).toBe('Appetizers');
      done();
    });
  });

  test('customer scans barcode (retail)', (done) => {
    // Change seat to retail type
    seat.businessType = 'retail';
    seat.allowBarcodeScanning = true;

    posSocket.on('pos:product:scan:request', (request) => {
      posSocket.emit('pos:product:scan:response', {
        customerId: request.customerId,
        requestId: request.requestId,
        barcode: request.barcode,
        found: true,
        product: {
          id: 'prod-123',
          name: 'Test Product',
          price: 19.99,
          stock: 50
        }
      });
    });

    customerSocket.emit('customer:product:scan', {
      barcode: '1234567890'
    });

    customerSocket.on('customer:product:data', (response) => {
      expect(response.success).toBe(true);
      expect(response.found).toBe(true);
      expect(response.product.name).toBe('Test Product');
      done();
    });
  });
});
```

### Step 5.4: Load Testing

**Test Scenario**: Simulate 100 concurrent customers connecting to one seat

```typescript
import { io as ioClient } from 'socket.io-client';

describe('Customer App Load Test', () => {
  test('handles 100 concurrent customers', async () => {
    const seat = await createTestSeat({
      allowCustomerApp: true,
      maxCustomerConnections: 100
    });

    const customers: Socket[] = [];
    const connectionPromises: Promise<void>[] = [];

    // Connect 100 customers
    for (let i = 0; i < 100; i++) {
      const promise = new Promise<void>((resolve, reject) => {
        const socket = ioClient('http://localhost:1337', {
          query: { clientType: 'customer' }
        });

        socket.emit('customer:connect', {
          publicSeatId: seat.publicSeatId
        });

        socket.on('customer:connect:success', (response) => {
          if (response.success) {
            customers.push(socket);
            resolve();
          } else {
            reject(new Error(response.error));
          }
        });

        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      connectionPromises.push(promise);
    }

    // Wait for all connections
    await Promise.all(connectionPromises);

    expect(customers.length).toBe(100);

    // Verify seat connection count
    const updatedSeat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId: seat.documentId
    });

    expect(updatedSeat.currentCustomerConnections).toBe(100);

    // Disconnect all
    customers.forEach(socket => socket.disconnect());

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify count decreased
    const finalSeat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId: seat.documentId
    });

    expect(finalSeat.currentCustomerConnections).toBe(0);
  });

  test('rejects connection when limit reached', async () => {
    const seat = await createTestSeat({
      allowCustomerApp: true,
      maxCustomerConnections: 2
    });

    // Connect 2 customers (should succeed)
    const socket1 = await connectCustomer(seat.publicSeatId);
    const socket2 = await connectCustomer(seat.publicSeatId);

    // Try to connect 3rd customer (should fail)
    const socket3 = ioClient('http://localhost:1337', {
      query: { clientType: 'customer' }
    });

    const response = await new Promise((resolve) => {
      socket3.emit('customer:connect', {
        publicSeatId: seat.publicSeatId
      });

      socket3.on('customer:connect:success', resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('Maximum customer connections reached');

    socket1.disconnect();
    socket2.disconnect();
    socket3.disconnect();
  });
});
```

---

## Phase 6: POS App Integration Guide

### What the POS App Needs to Implement

#### 1. Send Business Info During Activation

```typescript
// POS App: License activation request
const activationPayload = {
  licenseKey: encryptedLicenseKey,
  machineUUID: deviceUUID,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  telemetry: {
    os: 'Windows',
    appVersion: '1.0.0',
    // NEW: Required for customer app
    businessName: 'Joe\'s Pizza',
    businessType: 'restaurant' // restaurant | retail | cafe | pharmacy | other
  }
};

const response = await fetch('https://api.example.com/api/licenses/activate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(activationPayload)
});

const result = await response.json();
console.log('Public Seat ID:', result.data.seat.publicSeatId); // e.g., "REST42A"
```

#### 2. Listen for Customer Query Events

```typescript
// POS App: Socket.IO event listeners
socket.on('pos:menu:categories:request', async (request) => {
  const { customerId, requestId } = request;

  // Fetch categories from local database
  const categories = await db.getCategories();

  // Respond with categories
  socket.emit('pos:menu:categories:response', {
    customerId,
    requestId,
    categories: categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      imageUrl: cat.imageUrl,
      sortOrder: cat.sortOrder
    }))
  });
});

socket.on('pos:menu:products:request', async (request) => {
  const { customerId, requestId, categoryId } = request;

  // Fetch products for category
  const products = await db.getProductsByCategory(categoryId);

  // Respond with products
  socket.emit('pos:menu:products:response', {
    customerId,
    requestId,
    categoryId,
    products: products.map(prod => ({
      id: prod.id,
      name: prod.name,
      description: prod.description,
      price: prod.price,
      imageUrl: prod.imageUrl,
      isAvailable: prod.stock > 0
    }))
  });
});

socket.on('pos:product:scan:request', async (request) => {
  const { customerId, requestId, barcode } = request;

  // Lookup product by barcode
  const product = await db.getProductByBarcode(barcode);

  // Respond with product info
  socket.emit('pos:product:scan:response', {
    customerId,
    requestId,
    barcode,
    found: !!product,
    product: product ? {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.stock,
      isAvailable: product.stock > 0
    } : null
  });
});
```

#### 3. Display Public Seat ID in POS UI

```typescript
// POS App: Show QR code for customers
import QRCode from 'qrcode';

async function displayCustomerQRCode(publicSeatId: string) {
  // Generate QR code with deep link
  const deepLink = `myapp://connect?seat=${publicSeatId}`;
  const qrCodeDataUrl = await QRCode.toDataURL(deepLink);

  // Display in UI
  document.getElementById('customer-qr').src = qrCodeDataUrl;
  document.getElementById('seat-id-text').textContent = publicSeatId;
}
```

---

## Phase 7: Customer Mobile App Integration Guide

### Customer App Implementation

#### 1. Connect to Seat via QR Code

```typescript
// Customer App: Scan QR code and connect
import { io, Socket } from 'socket.io-client';

let socket: Socket;

async function connectToSeat(publicSeatId: string) {
  // First, check if seat is available (optional REST call)
  const seatInfo = await fetch(`https://api.example.com/api/key-seats/public/${publicSeatId}`);
  const seatData = await seatInfo.json();

  if (!seatData.success || !seatData.seat.isOnline) {
    alert('POS is currently offline');
    return;
  }

  // Connect via Socket.IO
  socket = io('https://api.example.com', {
    query: { clientType: 'customer' }
  });

  socket.emit('customer:connect', { publicSeatId });

  socket.on('customer:connect:success', (response) => {
    if (response.success) {
      console.log('Connected to:', response.seat.businessName);
      console.log('Business type:', response.seat.businessType);
      console.log('Features:', response.seat.features);

      // Show appropriate UI based on business type
      if (response.seat.businessType === 'restaurant' || response.seat.businessType === 'cafe') {
        showMenuBrowsingUI();
      } else {
        showBarcodeScannerUI();
      }
    } else {
      alert(response.error);
    }
  });
}
```

#### 2. Browse Menu (Restaurant/Cafe)

```typescript
// Customer App: Browse menu categories
function browseMenu() {
  socket.emit('customer:menu:categories', {});

  socket.on('customer:menu:categories:data', (response) => {
    if (response.success) {
      displayCategories(response.categories);
    }
  });
}

function selectCategory(categoryId: string) {
  socket.emit('customer:menu:products', { categoryId });

  socket.on('customer:menu:products:data', (response) => {
    if (response.success) {
      displayProducts(response.products);
    }
  });
}
```

#### 3. Scan Barcode (Retail/Pharmacy)

```typescript
// Customer App: Scan product barcode
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';

async function scanProduct() {
  const result = await BarcodeScanner.startScan();

  if (result.hasContent) {
    socket.emit('customer:product:scan', {
      barcode: result.content
    });

    socket.on('customer:product:data', (response) => {
      if (response.success && response.found) {
        displayProductInfo(response.product);
      } else {
        alert('Product not found');
      }
    });
  }
}
```

#### 4. Handle Errors and Timeouts

```typescript
// Customer App: Error handling
socket.on('customer:error', (error) => {
  console.error('Error:', error.error);
  showErrorMessage(error.error);
});

socket.on('customer:timeout', (error) => {
  console.error('Timeout:', error.error);
  showErrorMessage('Request timed out. Please try again.');
});

socket.on('disconnect', () => {
  console.log('Disconnected from POS');
  showDisconnectedUI();
});
```

---

## Phase 8: Database Migration Script

### Migration for Existing Seats

**File**: `database/migrations/add-customer-app-fields.ts`

```typescript
export async function up(strapi: Core.Strapi) {
  strapi.log.info('[Migration] Adding customer app fields to existing seats...');

  try {
    // Get all existing seats
    const seats = await strapi.documents('api::key-seat.key-seat').findMany({
      populate: ['license.user.subscriptionPlan'],
      status: 'published',
      limit: 10000
    });

    strapi.log.info(`[Migration] Found ${seats.length} seats to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const seat of seats) {
      try {
        // Generate public seat ID if not exists
        if (!seat.publicSeatId) {
          const { generateUniquePublicSeatId } = await import('../src/api/key-seat/utils/public-id-generator');
          const publicSeatId = await generateUniquePublicSeatId(
            strapi,
            seat.businessType || 'retail'
          );

          // Get plan features if available
          let planFeatures = null;
          if (seat.license?.user?.subscriptionPlan) {
            const planService = strapi.service('api::subscription-plan.subscription-plan');
            const planDocumentId = typeof seat.license.user.subscriptionPlan === 'object'
              ? seat.license.user.subscriptionPlan.documentId
              : seat.license.user.subscriptionPlan;
            
            planFeatures = await planService.getCustomerAppFeatures(planDocumentId);
          }

          // Update seat with new fields
          await strapi.documents('api::key-seat.key-seat').update({
            documentId: seat.documentId,
            data: {
              publicSeatId,
              businessName: seat.businessName || 'Unnamed Business',
              businessType: seat.businessType || 'retail',
              allowCustomerApp: planFeatures?.allowCustomerApp || false,
              allowMenuBrowsing: planFeatures?.allowMenuBrowsing || false,
              allowBarcodeScanning: planFeatures?.allowBarcodeScanning || false,
              allowCustomerOrdering: planFeatures?.allowCustomerOrdering || false,
              maxCustomerConnections: planFeatures?.maxCustomerConnectionsPerSeat || 50,
              currentCustomerConnections: 0
            },
            status: 'published'
          });

          successCount++;
          strapi.log.info(`[Migration] Updated seat ${seat.documentId} with publicSeatId: ${publicSeatId}`);
        }
      } catch (error) {
        errorCount++;
        strapi.log.error(`[Migration] Failed to update seat ${seat.documentId}:`, error);
      }
    }

    strapi.log.info(`[Migration] Complete: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    strapi.log.error('[Migration] Migration failed:', error);
    throw error;
  }
}

export async function down(strapi: Core.Strapi) {
  strapi.log.info('[Migration] Rolling back customer app fields...');
  // Rollback logic if needed
}
```

**Run migration**:
```bash
# Add to config/database.ts or run manually
npm run strapi migration:run
```

---

## Phase 9: Admin Panel Enhancements

### Step 9.1: Add QR Code Generation Endpoint

**File**: `src/api/key-seat/controllers/key-seat.ts`

```typescript
/**
 * GET /api/key-seats/:documentId/qr-code
 * Generates QR code for customer app connection
 */
async generateQRCode(ctx) {
  try {
    const { documentId } = ctx.params;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    // Validate ownership
    const seat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId,
      populate: ['license.user'],
      status: 'published'
    });

    if (!seat || !seat.license) {
      return ctx.notFound('Seat not found');
    }

    const licenseUser = typeof seat.license.user === 'object'
      ? seat.license.user.documentId
      : seat.license.user;

    if (licenseUser !== user.documentId) {
      return ctx.forbidden('Access denied');
    }

    if (!seat.publicSeatId) {
      return ctx.badRequest('Seat does not have a public ID');
    }

    // Generate QR code
    const QRCode = require('qrcode');
    const deepLink = `myapp://connect?seat=${seat.publicSeatId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(deepLink, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return ctx.send({
      success: true,
      qrCode: qrCodeDataUrl,
      publicSeatId: seat.publicSeatId,
      deepLink,
      businessName: seat.businessName
    });

  } catch (error) {
    strapi.log.error('[KeySeatController] QR code generation error:', error);
    return ctx.internalServerError('Failed to generate QR code');
  }
}

/**
 * PATCH /api/key-seats/:documentId/toggle-customer-app
 * Enable/disable customer app for a specific seat
 */
async toggleCustomerApp(ctx) {
  try {
    const { documentId } = ctx.params;
    const { enabled } = ctx.request.body;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    if (typeof enabled !== 'boolean') {
      return ctx.badRequest('enabled field must be a boolean');
    }

    // Validate ownership
    const seat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId,
      populate: ['license.user'],
      status: 'published'
    });

    if (!seat || !seat.license) {
      return ctx.notFound('Seat not found');
    }

    const licenseUser = typeof seat.license.user === 'object'
      ? seat.license.user.documentId
      : seat.license.user;

    if (licenseUser !== user.documentId) {
      return ctx.forbidden('Access denied');
    }

    // Update seat
    const updatedSeat = await strapi.documents('api::key-seat.key-seat').update({
      documentId,
      data: { allowCustomerApp: enabled },
      status: 'published'
    });

    return ctx.send({
      success: true,
      message: `Customer app ${enabled ? 'enabled' : 'disabled'}`,
      seat: {
        documentId: updatedSeat.documentId,
        allowCustomerApp: updatedSeat.allowCustomerApp
      }
    });

  } catch (error) {
    strapi.log.error('[KeySeatController] Toggle customer app error:', error);
    return ctx.internalServerError('Failed to toggle customer app');
  }
}

/**
 * PATCH /api/key-seats/:documentId/business-info
 * Update business name and type
 */
async updateBusinessInfo(ctx) {
  try {
    const { documentId } = ctx.params;
    const { businessName, businessType } = ctx.request.body;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    // Validate business type
    const validTypes = ['restaurant', 'retail', 'cafe', 'pharmacy', 'other'];
    if (businessType && !validTypes.includes(businessType)) {
      return ctx.badRequest(`Invalid business type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate ownership
    const seat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId,
      populate: ['license.user'],
      status: 'published'
    });

    if (!seat || !seat.license) {
      return ctx.notFound('Seat not found');
    }

    const licenseUser = typeof seat.license.user === 'object'
      ? seat.license.user.documentId
      : seat.license.user;

    if (licenseUser !== user.documentId) {
      return ctx.forbidden('Access denied');
    }

    // Update seat
    const updateData: any = {};
    if (businessName) updateData.businessName = businessName;
    if (businessType) updateData.businessType = businessType;

    const updatedSeat = await strapi.documents('api::key-seat.key-seat').update({
      documentId,
      data: updateData,
      status: 'published'
    });

    return ctx.send({
      success: true,
      message: 'Business info updated',
      seat: {
        documentId: updatedSeat.documentId,
        businessName: updatedSeat.businessName,
        businessType: updatedSeat.businessType
      }
    });

  } catch (error) {
    strapi.log.error('[KeySeatController] Update business info error:', error);
    return ctx.internalServerError('Failed to update business info');
  }
}
```

### Step 9.2: Add Custom Routes

**File**: `src/api/key-seat/routes/custom-routes.ts`

```typescript
export default {
  routes: [
    {
      method: 'GET',
      path: '/key-seats/public/:publicSeatId',
      handler: 'key-seat.getPublicSeatInfo',
      config: {
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/key-seats/:documentId/qr-code',
      handler: 'key-seat.generateQRCode',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'PATCH',
      path: '/key-seats/:documentId/toggle-customer-app',
      handler: 'key-seat.toggleCustomerApp',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'PATCH',
      path: '/key-seats/:documentId/business-info',
      handler: 'key-seat.updateBusinessInfo',
      config: {
        policies: [],
        middlewares: []
      }
    }
  ]
};
```

---

## Phase 10: Deployment Checklist

### Pre-Deployment

- [ ] **Schema Changes Applied**
  - [ ] Subscription plan schema updated with customer app flags
  - [ ] Key-seat schema updated with public ID and business fields
  - [ ] Database migration script created and tested

- [ ] **Code Implementation**
  - [ ] Public ID generator utility created
  - [ ] License activation updated to copy plan features
  - [ ] Customer app Socket.IO handlers implemented
  - [ ] POS response handlers implemented
  - [ ] Custom API endpoints added

- [ ] **Testing Completed**
  - [ ] Unit tests for public ID generator
  - [ ] Integration tests for license activation
  - [ ] Socket.IO connection tests
  - [ ] Load tests for concurrent customers
  - [ ] End-to-end tests with POS and customer apps

### Deployment Steps

1. **Database Migration**
   ```bash
   # Backup database first
   pg_dump -U postgres -d pos_db > backup_$(date +%Y%m%d).sql
   
   # Run migration
   npm run strapi migration:run
   ```

2. **Update Environment Variables**
   ```bash
   # .env.production
   CUSTOMER_APP_ENABLED=true
   CUSTOMER_APP_MAX_CONNECTIONS_DEFAULT=50
   CUSTOMER_APP_TIMEOUT_MS=10000
   ```

3. **Deploy Backend**
   ```bash
   # Build
   npm run build
   
   # Deploy to Docker Swarm
   docker stack deploy -c docker-compose.swarm.yml pos-backend
   ```

4. **Verify Deployment**
   ```bash
   # Check all replicas are running
   docker service ls
   
   # Check logs
   docker service logs pos-backend_strapi
   ```

### Post-Deployment

- [ ] **Verify Features**
  - [ ] Test customer connection to existing seat
  - [ ] Test menu browsing (restaurant)
  - [ ] Test barcode scanning (retail)
  - [ ] Test QR code generation
  - [ ] Test connection limits

- [ ] **Monitor Metrics**
  - [ ] Customer connection count per seat
  - [ ] Socket.IO event latency
  - [ ] Error rates
  - [ ] Redis memory usage

- [ ] **Documentation**
  - [ ] Update API documentation
  - [ ] Create POS integration guide
  - [ ] Create customer app integration guide
  - [ ] Update admin panel user guide

---

## Summary

This implementation guide provides a complete roadmap for adding customer-facing mobile app support to your POS system. The key architectural decisions are:

1. **Plan-based feature flags** stored at subscription level, copied to seats during activation
2. **Seat-level public identifiers** for customer connections (no authentication required)
3. **Business-type-specific events** (menu browsing for restaurants, barcode scanning for retail)
4. **Targeted event broadcasting** using socket IDs to prevent data leakage between customers
5. **Connection limits** to prevent abuse and manage server load

The implementation is production-ready, scalable, and maintains backward compatibility with existing POS and mobile owner apps.
