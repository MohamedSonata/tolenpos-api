# POS Application Integration Guide (Electron/Vite)
## Real-time Seat Telemetry & License Management System

> **AI Agent Ready**: This document contains complete specifications for integrating the POS application with the real-time seat telemetry system. All request/response formats, Socket.IO events, and HTTP endpoints are documented with TypeScript types.

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Socket.IO Integration](#socketio-integration)
5. [HTTP REST API](#http-rest-api)
6. [Data Models](#data-models)
7. [Implementation Guide](#implementation-guide)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [Testing](#testing)

---

## Overview

### System Purpose
The POS application connects to a Strapi backend server to:
- Authenticate using license keys and machine UUIDs
- Send real-time telemetry data about the POS system
- Receive plan updates and feature changes
- Maintain persistent connection for instant updates

### Technology Stack
- **Frontend**: Electron + Vite
- **Real-time Communication**: Socket.IO Client v4.5.4+
- **HTTP Client**: Fetch API or Axios
- **Authentication**: API Key (License Key) + Machine UUID

### Key Features
- ✅ Real-time telemetry updates
- ✅ Automatic reconnection handling
- ✅ Offline capability with queue management
- ✅ Plan feature synchronization
- ✅ Multi-seat license support

---

## Architecture

### Connection Flow
```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   POS App   │────────▶│  Socket.IO   │────────▶│   Strapi    │
│ (Electron)  │◀────────│   Server     │◀────────│   Backend   │
└─────────────┘         └──────────────┘         └─────────────┘
      │                                                  │
      │                                                  │
      └──────────────── HTTP REST API ──────────────────┘
```

### Data Flow
1. **Connection**: POS authenticates with license key + machine UUID
2. **Telemetry Push**: POS sends telemetry data every N seconds
3. **Server Processing**: Server validates, stores, and broadcasts to mobile apps
4. **Plan Updates**: Server pushes plan changes to POS in real-time

---

## Authentication

### Authentication Method: API Key + Machine UUID

The POS app uses a **dual-factor authentication** approach:
- **License Key**: Acts as the API token
- **Machine UUID**: Identifies the specific POS machine
- **User Document ID**: Links the machine to the user account

### Connection Parameters

```typescript
interface POSConnectionParams {
  token: string;           // License key (acts as API key)
  userDocumentId: string;  // User's document ID from Strapi
  machineUUID: string;     // Unique machine identifier (e.g., "POS-001")
}
```

### Generating Machine UUID

```typescript
// Example: Generate or retrieve machine UUID
function getMachineUUID(): string {
  // Check if UUID exists in local storage
  let uuid = localStorage.getItem('machineUUID');
  
  if (!uuid) {
    // Generate new UUID (use a proper UUID library)
    uuid = `POS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('machineUUID', uuid);
  }
  
  return uuid;
}
```

### Authentication Flow

```typescript
// 1. User enters license key and user ID in POS settings
const licenseKey = "your-license-key-here";
const userDocumentId = "user-document-id-here";
const machineUUID = getMachineUUID();

// 2. Connect to Socket.IO with authentication params
const socket = io('https://your-server.com', {
  query: {
    token: licenseKey,
    userDocumentId: userDocumentId,
    machineUUID: machineUUID
  },
  transports: ['websocket', 'polling']
});
```

### Authentication Validation

The server validates:
1. ✅ License key exists and is active
2. ✅ License is not expired (for expiring licenses)
3. ✅ User owns the license
4. ✅ Machine UUID is registered as a seat under the license
5. ✅ Seat is active

### Authentication Errors

```typescript
socket.on('UnauthorizedError', (data) => {
  console.error('Authentication failed:', data);
  // data structure:
  // {
  //   socketConnected: boolean,
  //   credentialsExp: boolean,
  //   error: {
  //     status: 401,
  //     name: "UnauthorizedError",
  //     message: "Missing or invalid credentials",
  //     details: {}
  //   }
  // }
});
```

---

## Socket.IO Integration

### Installation

```bash
npm install socket.io-client@^4.5.4
```

### Basic Setup

```typescript
import { io, Socket } from 'socket.io-client';

class POSSocketManager {
  private socket: Socket | null = null;
  private serverUrl: string;
  private licenseKey: string;
  private userDocumentId: string;
  private machineUUID: string;

  constructor(config: {
    serverUrl: string;
    licenseKey: string;
    userDocumentId: string;
    machineUUID: string;
  }) {
    this.serverUrl = config.serverUrl;
    this.licenseKey = config.licenseKey;
    this.userDocumentId = config.userDocumentId;
    this.machineUUID = config.machineUUID;
  }

  connect(): void {
    this.socket = io(this.serverUrl, {
      query: {
        token: this.licenseKey,
        userDocumentId: this.userDocumentId,
        machineUUID: this.machineUUID
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', this.onConnect.bind(this));
    this.socket.on('disconnect', this.onDisconnect.bind(this));
    this.socket.on('connect_error', this.onConnectError.bind(this));

    // Authentication events
    this.socket.on('UnauthorizedError', this.onUnauthorized.bind(this));

    // Seat update events
    this.socket.on('seat:update:success', this.onSeatUpdateSuccess.bind(this));

    // Plan events
    this.socket.on('plan:current', this.onPlanCurrent.bind(this));
    this.socket.on('plan:updated', this.onPlanUpdated.bind(this));
  }

  private onConnect(): void {
    console.log('✅ Connected to server', this.socket?.id);
    // Trigger UI update, enable features, etc.
  }

  private onDisconnect(reason: string): void {
    console.log('❌ Disconnected:', reason);
    // Handle disconnection, show offline mode, etc.
  }

  private onConnectError(error: Error): void {
    console.error('Connection error:', error);
    // Handle connection errors
  }

  private onUnauthorized(data: any): void {
    console.error('Unauthorized:', data);
    // Show authentication error to user
  }

  private onSeatUpdateSuccess(data: any): void {
    console.log('Seat update response:', data);
    // Handle success/failure of telemetry update
  }

  private onPlanCurrent(data: any): void {
    console.log('Current plan:', data);
    // Sync plan features with local storage
  }

  private onPlanUpdated(data: any): void {
    console.log('Plan updated:', data);
    // Update UI with new plan features
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
```

### Socket.IO Events Reference

#### Events Emitted by POS (Client → Server)

##### 1. `seat:update` - Send Telemetry Update

**Purpose**: Send current telemetry data to the server

**Payload Type**:
```typescript
interface SeatUpdatePayload {
  telemetry: Record<string, any>;  // Flexible telemetry data
}
```

**Example Payload**:
```typescript
{
  realtimeTelemetry: {
    // Network Status
    networkStatus: "online",
    lastSyncTime: "2024-01-15T10:30:45.123Z",
    
    // Business Data
    lastOrder: {
      receiptNumber: "RCP-2024-001234",
      total: 125.50,
      itemCount: 3,
      paymentMethod: "card",
      status: "completed",
      createdAt: "2024-01-15T10:25:30.000Z",
      items: [
        {
          name: "Coffee",
          quantity: 2,
          price: 5.00
        },
        {
          name: "Sandwich",
          quantity: 1,
          price: 115.50
        }
      ]
    },
    kpiSummary: {
      totalSales: 3450.75,
      transactionCount: 42,
      averageTransactionValue: 82.16,
      period: "today",
      lastUpdated: "2024-01-15T10:30:45.123Z"
    },
    expenses: [
      {
        id: "exp-001",
        title: "Office Supplies",
        amount: 125.00,
        category: "Supplies",
        paymentMethod: "card",
        expenseDate: "2024-01-15T09:00:00.000Z",
        isUrgent: false
      }
    ],
    
    // System Information
    osVersion: "Windows 10",
    appVersion: "2.1.0",
    cpuUsage: 45,              // percentage
    memoryUsage: 60,           // percentage
    diskSpace: 250,            // GB available
    cashDrawerStatus: "closed",  // "open" | "closed"
    printerStatus: "online",     // "online" | "offline" | "error"
    temperature: 25.5,         // optional: device temperature
    errorCount: 0              // optional: error count since last update
  }
}
```

**Usage**:
```typescript
socket.emit('seat:update', {
  realtimeTelemetry: {
    networkStatus: 'online',
    lastSyncTime: new Date().toISOString(),
    lastOrder: await getLastOrder(),
    kpiSummary: await getKPISummary(),
    expenses: await getRecentExpenses(),
    cpuUsage: 45,
    memoryUsage: 60
    // ... other telemetry data
  }
});
```

**Server Response**: `seat:update:success` event

---

#### Events Received by POS (Server → Client)

##### 1. `seat:update:success` - Telemetry Update Response

**Purpose**: Confirmation of telemetry update success/failure

**Payload Type**:
```typescript
interface SeatUpdateSuccessResponse {
  success: boolean;
  updatedAt?: string;  // ISO 8601 timestamp (if success)
  error?: string;      // Error message (if failure)
}
```

**Success Example**:
```typescript
{
  success: true,
  updatedAt: "2024-01-15T10:30:45.123Z"
}
```

**Failure Example**:
```typescript
{
  success: false,
  error: "No seat associated with this connection"
}
```

**Usage**:
```typescript
socket.on('seat:update:success', (data) => {
  if (data.success) {
    console.log('Telemetry updated at:', data.updatedAt);
    // Update UI, clear pending queue, etc.
  } else {
    console.error('Update failed:', data.error);
    // Retry logic, show error to user
  }
});
```

---

##### 2. `seat:telemetry:query:request` - Telemetry Query from Mobile App (NEW)

**Purpose**: Mobile app requests telemetry data from this POS device

**Payload Type**:
```typescript
interface TelemetryQueryRequestFromServer {
  requestId: string;
  keySeatDocumentId: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    dataTypes?: string[];
  };
  mobileSocketId: string;  // Socket ID of requesting mobile app
}
```

**Example**:
```typescript
{
  requestId: "uuid-123",
  keySeatDocumentId: "seat-doc-id-123",
  filters: {
    dataTypes: ["orders", "inventory", "sales"]
  },
  mobileSocketId: "mobile-socket-xyz"
}
```

**Usage**:
```typescript
socket.on('seat:telemetry:query:request', async (request) => {
  console.log('📥 Telemetry query received:', request.requestId);
  
  try {
    // Collect requested telemetry data
    const telemetryData = await collectTelemetryData(request.filters);
    
    // Send response back to server
    socket.emit('seat:telemetry:query:response', {
      requestId: request.requestId,
      keySeatDocumentId: request.keySeatDocumentId,
      telemetryData: telemetryData,
      mobileSocketId: request.mobileSocketId,
      timestamp: new Date().toISOString(),
      success: true
    });
    
    console.log('✅ Telemetry query response sent');
  } catch (error) {
    console.error('❌ Failed to process query:', error);
    
    // Send error response
    socket.emit('seat:telemetry:query:response', {
      requestId: request.requestId,
      keySeatDocumentId: request.keySeatDocumentId,
      telemetryData: {},
      mobileSocketId: request.mobileSocketId,
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message
    });
  }
});

// Helper function to collect telemetry data
async function collectTelemetryData(filters?: any): Promise<Record<string, any>> {
  const telemetry: Record<string, any> = {
    networkStatus: 'online',
    lastSyncTime: new Date().toISOString()
  };

  // Collect business data if requested
  if (!filters?.dataTypes || filters.dataTypes.includes('orders')) {
    telemetry.lastOrder = await getLastOrder();
    telemetry.kpiSummary = await getKPISummary();
  }

  if (!filters?.dataTypes || filters.dataTypes.includes('inventory')) {
    telemetry.inventoryStatus = await getInventoryStatus();
  }

  if (!filters?.dataTypes || filters.dataTypes.includes('expenses')) {
    telemetry.expenses = await getRecentExpenses();
  }

  // Always include system metrics
  telemetry.osVersion = getOSVersion();
  telemetry.appVersion = getAppVersion();
  telemetry.cpuUsage = getCPUUsage();
  telemetry.memoryUsage = getMemoryUsage();
  telemetry.diskSpace = getDiskSpace();

  return telemetry;
}
```

**Important Notes**:
- Respond within 10 seconds (server timeout)
- Include the same `requestId` in response
- Include `mobileSocketId` so server knows where to forward
- Handle errors gracefully and send error response

---

##### 3. `plan:current` - Current Plan Information

**Purpose**: Sent on connection to sync current plan features

**Payload Type**:
```typescript
interface PlanCurrentResponse {
  planType: 'FreeTrial' | 'Pro' | 'Enterprise';
  features: PlanFeatures;
  syncedAt: string;  // ISO 8601 timestamp
}

interface PlanFeatures {
  maxProducts?: number;           // -1 for unlimited
  maxRegisters?: number;          // -1 for unlimited
  advancedReporting?: boolean;
  multiLocation?: boolean;
  inventoryManagement?: boolean;
  basicReports?: boolean;
  customerManagement?: boolean;
  emailSupport?: boolean;
  prioritySupport?: boolean;
  customIntegrations?: boolean;
  dedicatedAccountManager?: boolean;
  duration?: string;              // e.g., "30 days" for trial
}
```

**Example**:
```typescript
{
  planType: "Pro",
  features: {
    maxProducts: 5000,
    maxRegisters: 3,
    advancedReporting: true,
    multiLocation: false,
    inventoryManagement: true,
    basicReports: true,
    customerManagement: true,
    emailSupport: true
  },
  syncedAt: "2024-01-15T10:30:00Z"
}
```

**Usage**:
```typescript
socket.on('plan:current', (data) => {
  console.log('Current plan:', data.planType);
  
  // Store features in local state/storage
  localStorage.setItem('planFeatures', JSON.stringify(data.features));
  
  // Update UI based on features
  updateUIFeatures(data.features);
});
```

---

##### 3. `plan:updated` - Plan Change Notification

**Purpose**: Real-time notification when user upgrades/downgrades plan

**Payload Type**:
```typescript
interface PlanUpdatedResponse {
  planType: 'FreeTrial' | 'Pro' | 'Enterprise';
  features: PlanFeatures;
  effectiveDate: string;  // ISO 8601 timestamp
}
```

**Example**:
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
  },
  effectiveDate: "2024-01-15T10:30:00Z"
}
```

**Usage**:
```typescript
socket.on('plan:updated', (data) => {
  console.log('Plan upgraded to:', data.planType);
  
  // Update local storage
  localStorage.setItem('planFeatures', JSON.stringify(data.features));
  
  // Show notification to user
  showNotification(`Plan upgraded to ${data.planType}!`);
  
  // Unlock new features in UI
  updateUIFeatures(data.features);
});
```

---

##### 4. `UnauthorizedError` - Authentication Error

**Purpose**: Emitted when authentication fails

**Payload Type**:
```typescript
interface UnauthorizedErrorResponse {
  socketConnected: boolean;
  credentialsExp: boolean;
  error: {
    status: 401;
    name: "UnauthorizedError";
    message: string;
    details: Record<string, any>;
  };
}
```

**Example**:
```typescript
{
  socketConnected: false,
  credentialsExp: true,
  error: {
    status: 401,
    name: "UnauthorizedError",
    message: "Missing or invalid credentials",
    details: {}
  }
}
```

**Usage**:
```typescript
socket.on('UnauthorizedError', (data) => {
  console.error('Authentication failed:', data.error.message);
  
  // Disconnect socket
  socket.disconnect();
  
  // Show error to user
  showAuthError(data.error.message);
  
  // Redirect to settings/login
  navigateToSettings();
});
```

---


### Complete Socket.IO Implementation Example

```typescript
// pos-socket-service.ts
import { io, Socket } from 'socket.io-client';

export interface POSConfig {
  serverUrl: string;
  licenseKey: string;
  userDocumentId: string;
  machineUUID: string;
}

export interface TelemetryData {
  osVersion?: string;
  appVersion?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskSpace?: number;
  transactionsToday?: number;
  lastTransactionTime?: string;
  cashDrawerStatus?: 'open' | 'closed';
  printerStatus?: 'online' | 'offline' | 'error';
  networkStatus?: 'online' | 'offline';
  lastSyncTime?: string;
  temperature?: number;
  errorCount?: number;
  [key: string]: any;  // Allow custom fields
}

export class POSSocketService {
  private socket: Socket | null = null;
  private config: POSConfig;
  private telemetryInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private pendingUpdates: TelemetryData[] = [];

  constructor(config: POSConfig) {
    this.config = config;
  }

  /**
   * Connect to the Socket.IO server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.config.serverUrl, {
        query: {
          token: this.config.licenseKey,
          userDocumentId: this.config.userDocumentId,
          machineUUID: this.config.machineUUID
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: 20000
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to server:', this.socket?.id);
        this.isConnected = true;
        this.processPendingUpdates();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        this.isConnected = false;
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected:', reason);
        this.isConnected = false;
      });

      this.socket.on('UnauthorizedError', (data) => {
        console.error('🚫 Unauthorized:', data);
        this.isConnected = false;
        reject(new Error(data.error.message));
      });

      this.socket.on('seat:update:success', (data) => {
        if (data.success) {
          console.log('✅ Telemetry updated:', data.updatedAt);
        } else {
          console.error('❌ Update failed:', data.error);
        }
      });

      this.socket.on('plan:current', (data) => {
        console.log('📋 Current plan:', data.planType);
        this.handlePlanUpdate(data);
      });

      this.socket.on('plan:updated', (data) => {
        console.log('🔄 Plan updated:', data.planType);
        this.handlePlanUpdate(data);
      });
    });
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    this.stopAutoTelemetry();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Send telemetry data to server
   */
  public sendTelemetry(telemetry: TelemetryData): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Not connected, queuing telemetry update');
      this.pendingUpdates.push(telemetry);
      return;
    }

    this.socket.emit('seat:update', { telemetry });
  }

  /**
   * Start automatic telemetry updates
   */
  public startAutoTelemetry(intervalMs: number = 30000): void {
    if (this.telemetryInterval) {
      console.warn('⚠️ Auto-telemetry already running');
      return;
    }

    console.log(`🔄 Starting auto-telemetry (every ${intervalMs}ms)`);
    this.telemetryInterval = setInterval(() => {
      const telemetry = this.collectTelemetry();
      this.sendTelemetry(telemetry);
    }, intervalMs);

    // Send initial telemetry immediately
    const telemetry = this.collectTelemetry();
    this.sendTelemetry(telemetry);
  }

  /**
   * Stop automatic telemetry updates
   */
  public stopAutoTelemetry(): void {
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
      console.log('⏹️ Auto-telemetry stopped');
    }
  }

  /**
   * Collect current telemetry data
   * Override this method to customize telemetry collection
   */
  protected collectTelemetry(): TelemetryData {
    return {
      osVersion: this.getOSVersion(),
      appVersion: this.getAppVersion(),
      cpuUsage: this.getCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      diskSpace: this.getDiskSpace(),
      transactionsToday: this.getTransactionsToday(),
      lastTransactionTime: this.getLastTransactionTime(),
      cashDrawerStatus: this.getCashDrawerStatus(),
      printerStatus: this.getPrinterStatus(),
      networkStatus: this.getNetworkStatus(),
      lastSyncTime: new Date().toISOString()
    };
  }

  /**
   * Process pending updates when connection is restored
   */
  private processPendingUpdates(): void {
    if (this.pendingUpdates.length === 0) return;

    console.log(`📤 Processing ${this.pendingUpdates.length} pending updates`);
    
    // Send the most recent update (or all if needed)
    const latestUpdate = this.pendingUpdates[this.pendingUpdates.length - 1];
    this.sendTelemetry(latestUpdate);
    
    this.pendingUpdates = [];
  }

  /**
   * Handle plan updates
   */
  private handlePlanUpdate(data: any): void {
    // Store in localStorage or state management
    localStorage.setItem('currentPlan', data.planType);
    localStorage.setItem('planFeatures', JSON.stringify(data.features));
    
    // Emit event for UI to react
    window.dispatchEvent(new CustomEvent('plan-updated', { detail: data }));
  }

  // Telemetry collection methods (implement based on your system)
  private getOSVersion(): string {
    return process.platform + ' ' + process.arch;
  }

  private getAppVersion(): string {
    return process.env.npm_package_version || '1.0.0';
  }

  private getCPUUsage(): number {
    // Implement CPU usage collection
    return Math.random() * 100;
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return (usage.heapUsed / usage.heapTotal) * 100;
  }

  private getDiskSpace(): number {
    // Implement disk space check
    return 250;
  }

  private getTransactionsToday(): number {
    // Implement transaction count from your database
    return 0;
  }

  private getLastTransactionTime(): string | undefined {
    // Implement last transaction time from your database
    return undefined;
  }

  private getCashDrawerStatus(): 'open' | 'closed' {
    // Implement cash drawer status check
    return 'closed';
  }

  private getPrinterStatus(): 'online' | 'offline' | 'error' {
    // Implement printer status check
    return 'online';
  }

  private getNetworkStatus(): 'online' | 'offline' {
    return navigator.onLine ? 'online' : 'offline';
  }

  public isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }
}
```

### Usage in Electron App

```typescript
// main.ts or app initialization
import { POSSocketService } from './pos-socket-service';

// Initialize the service
const posSocket = new POSSocketService({
  serverUrl: 'https://your-server.com',
  licenseKey: 'your-license-key',
  userDocumentId: 'user-document-id',
  machineUUID: 'POS-001'
});

// Connect to server
async function initializePOS() {
  try {
    await posSocket.connect();
    console.log('✅ POS connected successfully');
    
    // Start automatic telemetry updates every 30 seconds
    posSocket.startAutoTelemetry(30000);
    
  } catch (error) {
    console.error('❌ Failed to connect:', error);
    // Handle connection failure
  }
}

// Listen for plan updates
window.addEventListener('plan-updated', (event: any) => {
  const { planType, features } = event.detail;
  console.log('Plan updated:', planType);
  
  // Update UI based on new features
  updateFeatureFlags(features);
});

// Clean up on app close
app.on('before-quit', () => {
  posSocket.disconnect();
});

// Initialize
initializePOS();
```

---

## HTTP REST API

### Base URL
```
https://your-server.com/api
```

### Authentication
All HTTP requests require JWT authentication via Bearer token.

**Header**:
```
Authorization: Bearer <jwt-token>
```

> **Note**: For HTTP API, you need a JWT token, not the license key. The license key is only for Socket.IO authentication.

---

### Endpoints

#### 1. GET `/key-seats/my-seats` - Fetch User's Seats

**Purpose**: Retrieve all seats (POS machines) owned by the authenticated user

**Method**: `GET`

**Authentication**: Required (JWT Bearer token)

**Query Parameters**: None

**Request Example**:
```typescript
const response = await fetch('https://your-server.com/api/key-seats/my-seats', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

**Response Type**:
```typescript
interface MySeatsResponse {
  data: KeySeat[];
  meta: {
    total: number;
  };
}

interface KeySeat {
  id: number;
  documentId: string;
  machineUUID: string;
  userSocketId: string | null;
  telemetry: Record<string, any> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  locale: string | null;
  license: {
    documentId: string;
    licenseKey: string;
    planSubscriptionType: 'FreeTrial' | 'Pro' | 'Enterprise';
  };
}
```

**Success Response (200)**:
```json
{
  "data": [
    {
      "id": 1,
      "documentId": "abc123def456",
      "machineUUID": "POS-001",
      "userSocketId": "socket-id-xyz",
      "telemetry": {
        "cpuUsage": 45,
        "memoryUsage": 60,
        "transactionsToday": 150
      },
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "publishedAt": "2024-01-15T10:00:00.000Z",
      "locale": null,
      "license": {
        "documentId": "lic-doc-id-123",
        "licenseKey": "your-license-key",
        "planSubscriptionType": "Pro"
      }
    }
  ],
  "meta": {
    "total": 1
  }
}
```

**Error Responses**:

- **401 Unauthorized**:
```json
{
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Authentication required"
  }
}
```

- **500 Internal Server Error**:
```json
{
  "error": {
    "status": 500,
    "name": "InternalServerError",
    "message": "Failed to fetch seats"
  }
}
```

**Usage Example**:
```typescript
async function fetchMySeats(jwtToken: string): Promise<KeySeat[]> {
  try {
    const response = await fetch('https://your-server.com/api/key-seats/my-seats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: MySeatsResponse = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to fetch seats:', error);
    throw error;
  }
}
```

---

#### 2. GET `/seat-telemetry-history/query` - Query Telemetry History

**Purpose**: Retrieve historical telemetry data with filtering and pagination

**Method**: `GET`

**Authentication**: Required (JWT Bearer token)

**Query Parameters**:
```typescript
interface TelemetryHistoryQueryParams {
  machineUUID?: string;    // Filter by specific machine (optional)
  startDate?: string;      // ISO 8601 date string (optional)
  endDate?: string;        // ISO 8601 date string (optional)
  page?: number;           // Page number (default: 1)
  pageSize?: number;       // Records per page (default: 100, max: 1000)
}
```

**Request Example**:
```typescript
const params = new URLSearchParams({
  machineUUID: 'POS-001',
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-31T23:59:59Z',
  page: '1',
  pageSize: '50'
});

const response = await fetch(
  `https://your-server.com/api/seat-telemetry-history/query?${params}`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
```

**Response Type**:
```typescript
interface TelemetryHistoryResponse {
  data: TelemetryHistoryRecord[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

interface TelemetryHistoryRecord {
  id: number;
  documentId: string;
  capturedAt: string;           // ISO 8601 timestamp
  snapshotType: 'scheduled' | 'manual' | 'event-triggered';
  telemetryData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  locale: string | null;
  keySeat: {
    documentId: string;
    machineUUID: string;
  };
}
```

**Success Response (200)**:
```json
{
  "data": [
    {
      "id": 1,
      "documentId": "hist-doc-id-123",
      "capturedAt": "2024-01-15T10:30:00.000Z",
      "snapshotType": "scheduled",
      "telemetryData": {
        "cpuUsage": 45,
        "memoryUsage": 60,
        "transactionsToday": 150,
        "diskSpace": 250
      },
      "createdAt": "2024-01-15T10:30:05.000Z",
      "updatedAt": "2024-01-15T10:30:05.000Z",
      "publishedAt": "2024-01-15T10:30:05.000Z",
      "locale": null,
      "keySeat": {
        "documentId": "seat-doc-id-456",
        "machineUUID": "POS-001"
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 1
  }
}
```

**Error Responses**:

- **401 Unauthorized**:
```json
{
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Authentication required"
  }
}
```

- **403 Forbidden**:
```json
{
  "error": {
    "status": 403,
    "name": "ForbiddenError",
    "message": "You do not have access to this seat"
  }
}
```

- **404 Not Found**:
```json
{
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "Seat not found"
  }
}
```

**Usage Example**:
```typescript
async function fetchTelemetryHistory(
  jwtToken: string,
  machineUUID?: string,
  startDate?: Date,
  endDate?: Date
): Promise<TelemetryHistoryRecord[]> {
  try {
    const params = new URLSearchParams({
      page: '1',
      pageSize: '100'
    });

    if (machineUUID) params.append('machineUUID', machineUUID);
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await fetch(
      `https://your-server.com/api/seat-telemetry-history/query?${params}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: TelemetryHistoryResponse = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to fetch telemetry history:', error);
    throw error;
  }
}
```

---


## Data Models

### Complete TypeScript Definitions

```typescript
// ============================================
// Authentication & Connection
// ============================================

export interface POSConnectionConfig {
  serverUrl: string;
  licenseKey: string;
  userDocumentId: string;
  machineUUID: string;
}

// ============================================
// Socket.IO Event Payloads
// ============================================

export interface SeatUpdatePayload {
  realtimeTelemetry: TelemetryData;  // Updated field name
}

export interface SeatUpdateSuccessResponse {
  success: boolean;
  updatedAt?: string;
  error?: string;
}

export interface TelemetryQueryRequestFromServer {
  requestId: string;
  keySeatDocumentId: string;
  filters?: {
    startDate?: string;
    endDate?: string;
    dataTypes?: string[];
  };
  mobileSocketId: string;
}

export interface TelemetryQueryResponse {
  requestId: string;
  keySeatDocumentId: string;
  telemetryData: Record<string, any>;
  mobileSocketId: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

export interface PlanCurrentResponse {
  planType: PlanType;
  features: PlanFeatures;
  syncedAt: string;
}

export interface PlanUpdatedResponse {
  planType: PlanType;
  features: PlanFeatures;
  effectiveDate: string;
}

export interface UnauthorizedErrorResponse {
  socketConnected: boolean;
  credentialsExp: boolean;
  error: {
    status: 401;
    name: 'UnauthorizedError';
    message: string;
    details: Record<string, any>;
  };
}

// ============================================
// Telemetry Data
// ============================================

export interface TelemetryData {
  // Network Status
  networkStatus?: 'online' | 'offline';
  lastSyncTime?: string;  // ISO 8601
  
  // Business Data (NEW)
  lastOrder?: LastOrderData;
  kpiSummary?: KPISummaryData;
  expenses?: ExpenseData[];
  
  // System Information
  osVersion?: string;
  appVersion?: string;
  
  // Performance Metrics
  cpuUsage?: number;              // 0-100 percentage
  memoryUsage?: number;           // 0-100 percentage
  diskSpace?: number;             // GB available
  temperature?: number;           // Celsius
  
  // Hardware Status
  cashDrawerStatus?: 'open' | 'closed';
  printerStatus?: 'online' | 'offline' | 'error';
  scannerStatus?: 'online' | 'offline' | 'error';
  cardReaderStatus?: 'online' | 'offline' | 'error';
  
  // Error Tracking
  errorCount?: number;
  lastError?: string;
  
  // Custom Fields
  [key: string]: any;
}

// Business Data Types (NEW)
export interface LastOrderData {
  receiptNumber: string;
  total: number;
  itemCount: number;
  paymentMethod: 'card' | 'cash' | 'mobile';
  status: 'completed' | 'pending' | 'cancelled';
  createdAt: string;  // ISO 8601
  items?: OrderItem[];
  customer?: CustomerInfo;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  [key: string]: any;
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
  email?: string;
  [key: string]: any;
}

export interface KPISummaryData {
  totalSales: number;
  transactionCount: number;
  averageTransactionValue: number;
  period: string;  // e.g., "today"
  lastUpdated: string;  // ISO 8601
}

export interface ExpenseData {
  id: string;
  title: string;
  amount: number;
  category: string;
  paymentMethod: 'card' | 'cash';
  expenseDate: string;  // ISO 8601
  isUrgent: boolean;
}

// ============================================
// Plan & Features
// ============================================

export type PlanType = 'FreeTrial' | 'Pro' | 'Enterprise';

export interface PlanFeatures {
  // Product Limits
  maxProducts?: number;           // -1 for unlimited
  maxRegisters?: number;          // -1 for unlimited
  
  // Feature Flags
  advancedReporting?: boolean;
  multiLocation?: boolean;
  inventoryManagement?: boolean;
  basicReports?: boolean;
  customerManagement?: boolean;
  employeeManagement?: boolean;
  loyaltyProgram?: boolean;
  giftCards?: boolean;
  
  // Support
  emailSupport?: boolean;
  phoneSupport?: boolean;
  prioritySupport?: boolean;
  dedicatedAccountManager?: boolean;
  
  // Integrations
  customIntegrations?: boolean;
  apiAccess?: boolean;
  webhooks?: boolean;
  
  // Trial Specific
  duration?: string;              // e.g., "30 days"
}

// ============================================
// HTTP API Models
// ============================================

export interface KeySeat {
  id: number;
  documentId: string;
  machineUUID: string;
  userSocketId: string | null;
  telemetry: TelemetryData | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  locale: string | null;
  license: {
    documentId: string;
    licenseKey: string;
    planSubscriptionType: PlanType;
    maxSeats: number;
    expiresAt: string | null;
    expirationType: 'perpetual' | 'expiring';
  };
}

export interface MySeatsResponse {
  data: KeySeat[];
  meta: {
    total: number;
  };
}

export interface TelemetryHistoryRecord {
  id: number;
  documentId: string;
  capturedAt: string;
  snapshotType: 'scheduled' | 'manual' | 'event-triggered';
  telemetryData: TelemetryData;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  locale: string | null;
  keySeat: {
    documentId: string;
    machineUUID: string;
  };
}

export interface TelemetryHistoryResponse {
  data: TelemetryHistoryRecord[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

// ============================================
// Error Models
// ============================================

export interface APIError {
  error: {
    status: number;
    name: string;
    message: string;
    details?: Record<string, any>;
  };
}
```

---

## Implementation Guide

### Step-by-Step Integration

#### Step 1: Install Dependencies

```bash
npm install socket.io-client@^4.5.4
```

#### Step 2: Create Configuration

```typescript
// config/pos-config.ts
export const POSConfig = {
  serverUrl: process.env.SERVER_URL || 'https://your-server.com',
  licenseKey: process.env.LICENSE_KEY || '',
  userDocumentId: process.env.USER_DOCUMENT_ID || '',
  machineUUID: getMachineUUID(),
  telemetryInterval: 30000,  // 30 seconds
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000
};

function getMachineUUID(): string {
  let uuid = localStorage.getItem('machineUUID');
  if (!uuid) {
    uuid = `POS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('machineUUID', uuid);
  }
  return uuid;
}
```

#### Step 3: Implement Socket Service

Use the `POSSocketService` class provided in the [Complete Socket.IO Implementation Example](#complete-socketio-implementation-example) section above.

#### Step 4: Initialize in Main Process

```typescript
// main.ts
import { app, BrowserWindow } from 'electron';
import { POSSocketService } from './services/pos-socket-service';
import { POSConfig } from './config/pos-config';

let mainWindow: BrowserWindow | null = null;
let posSocket: POSSocketService | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Initialize POS socket connection
  await initializePOSConnection();
}

async function initializePOSConnection() {
  try {
    posSocket = new POSSocketService(POSConfig);
    await posSocket.connect();
    
    console.log('✅ POS connected successfully');
    
    // Start automatic telemetry
    posSocket.startAutoTelemetry(POSConfig.telemetryInterval);
    
    // Notify renderer process
    mainWindow?.webContents.send('pos-connected', true);
    
  } catch (error) {
    console.error('❌ Failed to connect POS:', error);
    
    // Show error dialog
    dialog.showErrorBox(
      'Connection Error',
      'Failed to connect to server. Please check your license key and internet connection.'
    );
    
    // Notify renderer process
    mainWindow?.webContents.send('pos-connected', false);
  }
}

app.on('ready', createWindow);

app.on('before-quit', () => {
  if (posSocket) {
    posSocket.disconnect();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

#### Step 5: Handle Plan Updates in Renderer

```typescript
// renderer.ts
import { ipcRenderer } from 'electron';

// Listen for connection status
ipcRenderer.on('pos-connected', (event, isConnected) => {
  if (isConnected) {
    showNotification('Connected to server', 'success');
  } else {
    showNotification('Connection failed', 'error');
  }
});

// Listen for plan updates
window.addEventListener('plan-updated', (event: any) => {
  const { planType, features } = event.detail;
  
  console.log('Plan updated:', planType);
  
  // Update UI based on features
  updateFeatureAccess(features);
  
  // Show notification
  showNotification(`Plan upgraded to ${planType}!`, 'success');
});

function updateFeatureAccess(features: PlanFeatures) {
  // Enable/disable features based on plan
  const advancedReportsBtn = document.getElementById('advanced-reports-btn');
  if (advancedReportsBtn) {
    advancedReportsBtn.disabled = !features.advancedReporting;
  }
  
  const multiLocationBtn = document.getElementById('multi-location-btn');
  if (multiLocationBtn) {
    multiLocationBtn.disabled = !features.multiLocation;
  }
  
  // Update product limit display
  const productLimitEl = document.getElementById('product-limit');
  if (productLimitEl) {
    productLimitEl.textContent = features.maxProducts === -1 
      ? 'Unlimited' 
      : features.maxProducts?.toString() || '0';
  }
}
```

#### Step 6: Implement Offline Queue

```typescript
// services/offline-queue.ts
export class OfflineQueue {
  private queue: TelemetryData[] = [];
  private maxQueueSize: number = 100;

  constructor(maxQueueSize?: number) {
    if (maxQueueSize) {
      this.maxQueueSize = maxQueueSize;
    }
    this.loadFromStorage();
  }

  public enqueue(telemetry: TelemetryData): void {
    this.queue.push(telemetry);
    
    // Keep only the most recent items
    if (this.queue.length > this.maxQueueSize) {
      this.queue = this.queue.slice(-this.maxQueueSize);
    }
    
    this.saveToStorage();
  }

  public dequeue(): TelemetryData | undefined {
    const item = this.queue.shift();
    this.saveToStorage();
    return item;
  }

  public getAll(): TelemetryData[] {
    return [...this.queue];
  }

  public clear(): void {
    this.queue = [];
    this.saveToStorage();
  }

  public size(): number {
    return this.queue.length;
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('telemetry-queue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save queue to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('telemetry-queue');
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load queue from storage:', error);
      this.queue = [];
    }
  }
}

// Usage in POSSocketService
export class POSSocketService {
  private offlineQueue: OfflineQueue;

  constructor(config: POSConfig) {
    this.config = config;
    this.offlineQueue = new OfflineQueue();
  }

  public sendTelemetry(telemetry: TelemetryData): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Not connected, queuing telemetry update');
      this.offlineQueue.enqueue(telemetry);
      return;
    }

    this.socket.emit('seat:update', { telemetry });
  }

  private processPendingUpdates(): void {
    const queueSize = this.offlineQueue.size();
    if (queueSize === 0) return;

    console.log(`📤 Processing ${queueSize} queued updates`);
    
    // Send all queued updates
    while (this.offlineQueue.size() > 0) {
      const telemetry = this.offlineQueue.dequeue();
      if (telemetry) {
        this.sendTelemetry(telemetry);
      }
    }
  }
}
```

---

## Error Handling

### Connection Errors

```typescript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  
  // Categorize error
  if (error.message.includes('timeout')) {
    showError('Connection timeout. Please check your internet connection.');
  } else if (error.message.includes('unauthorized')) {
    showError('Invalid license key. Please check your credentials.');
  } else {
    showError('Failed to connect to server. Please try again later.');
  }
  
  // Implement exponential backoff
  const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
  setTimeout(() => {
    socket.connect();
  }, retryDelay);
});
```

### Telemetry Update Errors

```typescript
socket.on('seat:update:success', (data) => {
  if (!data.success) {
    console.error('Telemetry update failed:', data.error);
    
    // Handle specific errors
    if (data.error.includes('No seat associated')) {
      showError('Machine not registered. Please contact support.');
    } else if (data.error.includes('License expired')) {
      showError('Your license has expired. Please renew.');
    } else {
      showError('Failed to update telemetry. Will retry automatically.');
    }
  }
});
```

### HTTP API Errors

```typescript
async function handleAPIError(response: Response): Promise<never> {
  const error: APIError = await response.json();
  
  switch (error.error.status) {
    case 401:
      throw new Error('Authentication failed. Please log in again.');
    case 403:
      throw new Error('Access denied. You do not have permission.');
    case 404:
      throw new Error('Resource not found.');
    case 500:
      throw new Error('Server error. Please try again later.');
    default:
      throw new Error(error.error.message || 'Unknown error occurred');
  }
}

// Usage
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    await handleAPIError(response);
  }
  return await response.json();
} catch (error) {
  console.error('API error:', error);
  showError(error.message);
}
```

---

## Best Practices

### 1. Connection Management

```typescript
// ✅ Good: Implement reconnection logic
const socket = io(serverUrl, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity
});

// ❌ Bad: No reconnection handling
const socket = io(serverUrl, {
  reconnection: false
});
```

### 2. Telemetry Frequency

```typescript
// ✅ Good: Reasonable update interval (30-60 seconds)
posSocket.startAutoTelemetry(30000);

// ❌ Bad: Too frequent updates (network overhead)
posSocket.startAutoTelemetry(1000);
```

### 3. Offline Handling

```typescript
// ✅ Good: Queue updates when offline
if (!socket.connected) {
  offlineQueue.enqueue(telemetry);
  return;
}

// ❌ Bad: Ignore offline state
socket.emit('seat:update', { telemetry });
```

### 4. Error Logging

```typescript
// ✅ Good: Structured error logging
console.error('Telemetry update failed:', {
  error: data.error,
  timestamp: new Date().toISOString(),
  machineUUID: config.machineUUID
});

// ❌ Bad: Generic error logging
console.error('Error');
```

### 5. Resource Cleanup

```typescript
// ✅ Good: Clean up on app close
app.on('before-quit', () => {
  posSocket.stopAutoTelemetry();
  posSocket.disconnect();
});

// ❌ Bad: No cleanup
app.on('before-quit', () => {
  // Nothing
});
```

### 6. Feature Flag Management

```typescript
// ✅ Good: Centralized feature checking
function hasFeature(featureName: string): boolean {
  const features = JSON.parse(localStorage.getItem('planFeatures') || '{}');
  return features[featureName] === true;
}

if (hasFeature('advancedReporting')) {
  showAdvancedReports();
}

// ❌ Bad: Hardcoded feature checks
if (planType === 'Enterprise') {
  showAdvancedReports();
}
```

---

## Testing

### Manual Testing with HTML Simulator

Use the provided `test-pos-app.html` file to test the integration:

1. Open `test-pos-app.html` in a browser
2. Enter your server URL, license key, user document ID, and machine UUID
3. Click "Connect to Server"
4. Test telemetry updates with "Send Telemetry Update" button
5. Monitor the event log for responses

### Automated Testing

```typescript
// tests/pos-socket.test.ts
import { POSSocketService } from '../services/pos-socket-service';

describe('POSSocketService', () => {
  let service: POSSocketService;

  beforeEach(() => {
    service = new POSSocketService({
      serverUrl: 'http://localhost:1334',
      licenseKey: 'test-license-key',
      userDocumentId: 'test-user-id',
      machineUUID: 'TEST-001'
    });
  });

  afterEach(() => {
    service.disconnect();
  });

  test('should connect successfully', async () => {
    await expect(service.connect()).resolves.not.toThrow();
    expect(service.isSocketConnected()).toBe(true);
  });

  test('should send telemetry', () => {
    const telemetry = {
      cpuUsage: 50,
      memoryUsage: 60
    };
    
    expect(() => service.sendTelemetry(telemetry)).not.toThrow();
  });

  test('should queue telemetry when offline', () => {
    service.disconnect();
    
    const telemetry = {
      cpuUsage: 50,
      memoryUsage: 60
    };
    
    service.sendTelemetry(telemetry);
    // Verify telemetry is queued (check internal queue)
  });
});
```

---

## Troubleshooting

### Common Issues

#### 1. Connection Fails

**Symptoms**: `connect_error` event fired, cannot connect to server

**Solutions**:
- Verify server URL is correct
- Check license key is valid and active
- Ensure machine UUID is registered as a seat
- Check firewall/network settings
- Verify server is running and accessible

#### 2. Authentication Fails

**Symptoms**: `UnauthorizedError` event received

**Solutions**:
- Verify license key is correct
- Check user document ID matches the license owner
- Ensure license is not expired
- Verify seat is active in the database

#### 3. Telemetry Updates Fail

**Symptoms**: `seat:update:success` returns `success: false`

**Solutions**:
- Check seat is associated with the connection
- Verify telemetry data format is valid JSON
- Ensure connection is established before sending
- Check server logs for detailed error messages

#### 4. Plan Updates Not Received

**Symptoms**: `plan:updated` event not fired

**Solutions**:
- Verify socket connection is active
- Check user's plan was actually changed on the server
- Ensure event listener is registered before plan change
- Check server logs for notification delivery

---

## Summary

This guide provides complete integration specifications for the POS application (Electron/Vite) with the real-time seat telemetry system. Key points:

- **Authentication**: License key + Machine UUID + User Document ID
- **Socket.IO Events**: `seat:update`, `seat:update:success`, `plan:current`, `plan:updated`
- **HTTP Endpoints**: `/api/key-seats/my-seats`, `/api/seat-telemetry-history/query`
- **Best Practices**: Offline queuing, reconnection handling, feature flag management
- **Error Handling**: Comprehensive error categorization and user feedback

For questions or issues, refer to the troubleshooting section or contact support.

---

**Document Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**Maintained By**: Backend Team


---

## Business Data Integration (NEW)

### Overview

The telemetry system now supports sending business data including order information, KPI summaries, and expense tracking. This enables store owners to monitor business metrics in real-time through their mobile apps.

### Business Data Structure

The telemetry payload now includes three new optional fields:

```typescript
interface TelemetryData {
  // Network Status
  networkStatus?: 'online' | 'offline';
  lastSyncTime?: string;
  
  // Business Data (NEW)
  lastOrder?: LastOrderData | null;
  kpiSummary?: KPISummaryData | null;
  expenses?: ExpenseData[];
  
  // System Information (existing)
  osVersion?: string;
  appVersion?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  // ... other fields
}
```

### Business Data Types

#### LastOrderData

Contains details about the most recent order:

```typescript
interface LastOrderData {
  receiptNumber: string;
  total: number;
  itemCount: number;
  paymentMethod: 'card' | 'cash' | 'mobile';
  status: 'completed' | 'pending' | 'cancelled';
  createdAt: string;  // ISO 8601
  items?: OrderItem[];
  customer?: CustomerInfo;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  // Add other fields as needed
}

interface CustomerInfo {
  name?: string;
  phone?: string;
  email?: string;
  // Add other fields as needed
}
```

#### KPISummaryData

Contains today's key performance indicators:

```typescript
interface KPISummaryData {
  totalSales: number;
  transactionCount: number;
  averageTransactionValue: number;
  period: string;  // e.g., "today"
  lastUpdated: string;  // ISO 8601
}
```

#### ExpenseData

Array of recent expense records (up to 10 from today):

```typescript
interface ExpenseData {
  id: string;
  title: string;
  amount: number;
  category: string;
  paymentMethod: 'card' | 'cash';
  expenseDate: string;  // ISO 8601
  isUrgent: boolean;
}
```

### Implementation Guide

#### Step 1: Create Data Collection Service

```typescript
// business-data-collector.ts
import { OrderRepository } from './repositories/order-repository';
import { ExpenseRepository } from './repositories/expense-repository';

export class BusinessDataCollector {
  constructor(
    private orderRepository: OrderRepository,
    private expenseRepository: ExpenseRepository
  ) {}

  /**
   * Collect the most recent order
   */
  async collectLastOrder(): Promise<LastOrderData | null> {
    try {
      const order = await this.orderRepository.findMostRecent();
      
      if (!order) {
        return null;
      }

      return {
        receiptNumber: order.receiptNumber,
        total: order.total,
        itemCount: order.items.length,
        paymentMethod: order.paymentMethod,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        customer: order.customer ? {
          name: order.customer.name,
          phone: order.customer.phone
        } : undefined
      };
    } catch (error) {
      console.error('Failed to collect lastOrder:', error);
      return null;
    }
  }

  /**
   * Calculate today's KPI summary
   */
  async collectKPISummary(): Promise<KPISummaryData | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayOrders = await this.orderRepository.findByDateRange(
        today,
        new Date()
      );

      if (todayOrders.length === 0) {
        return null;
      }

      const totalSales = todayOrders.reduce((sum, order) => sum + order.total, 0);
      const transactionCount = todayOrders.length;

      return {
        totalSales,
        transactionCount,
        averageTransactionValue: totalSales / transactionCount,
        period: 'today',
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to collect kpiSummary:', error);
      return null;
    }
  }

  /**
   * Collect recent expenses from today
   */
  async collectExpenses(): Promise<ExpenseData[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const expenses = await this.expenseRepository.findByDateRange(
        today,
        new Date(),
        10  // Limit to 10 most recent
      );

      return expenses.map(expense => ({
        id: expense.id,
        title: expense.title,
        amount: expense.amount,
        category: expense.category,
        paymentMethod: expense.paymentMethod,
        expenseDate: expense.expenseDate.toISOString(),
        isUrgent: expense.isUrgent
      }));
    } catch (error) {
      console.error('Failed to collect expenses:', error);
      return [];
    }
  }
}
```

#### Step 2: Integrate with Telemetry Service

```typescript
// Enhanced POSSocketService with business data
export class POSSocketService {
  private businessDataCollector: BusinessDataCollector;

  constructor(
    config: POSConfig,
    orderRepository: OrderRepository,
    expenseRepository: ExpenseRepository
  ) {
    this.config = config;
    this.businessDataCollector = new BusinessDataCollector(
      orderRepository,
      expenseRepository
    );
  }

  /**
   * Collect complete telemetry including business data
   */
  protected async collectTelemetry(): Promise<TelemetryData> {
    // Collect business data in parallel
    const [lastOrder, kpiSummary, expenses] = await Promise.all([
      this.businessDataCollector.collectLastOrder(),
      this.businessDataCollector.collectKPISummary(),
      this.businessDataCollector.collectExpenses()
    ]);

    return {
      // Network status
      networkStatus: this.getNetworkStatus(),
      lastSyncTime: new Date().toISOString(),
      
      // Business data
      lastOrder,
      kpiSummary,
      expenses,
      
      // System information
      osVersion: this.getOSVersion(),
      appVersion: this.getAppVersion(),
      cpuUsage: this.getCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      diskSpace: this.getDiskSpace(),
      cashDrawerStatus: this.getCashDrawerStatus(),
      printerStatus: this.getPrinterStatus()
    };
  }

  /**
   * Send telemetry update (now async to support business data collection)
   */
  public async sendTelemetryUpdate(): Promise<void> {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Not connected, skipping telemetry update');
      return;
    }

    try {
      const telemetry = await this.collectTelemetry();
      this.socket.emit('seat:update', { telemetry });
      console.log('📤 Telemetry sent with business data');
    } catch (error) {
      console.error('❌ Failed to collect/send telemetry:', error);
    }
  }

  /**
   * Start automatic telemetry updates (updated to use async)
   */
  public startAutoTelemetry(intervalMs: number = 30000): void {
    if (this.telemetryInterval) {
      console.warn('⚠️ Auto-telemetry already running');
      return;
    }

    console.log(`🔄 Starting auto-telemetry (every ${intervalMs}ms)`);
    
    // Send initial telemetry immediately
    this.sendTelemetryUpdate();
    
    // Set up interval
    this.telemetryInterval = setInterval(() => {
      this.sendTelemetryUpdate();
    }, intervalMs);
  }
}
```

#### Step 3: Trigger Updates on Business Events

```typescript
// Send telemetry after each transaction
class OrderService {
  constructor(private posSocket: POSSocketService) {}

  async completeOrder(order: Order): Promise<void> {
    // Save order to database
    await this.orderRepository.save(order);
    
    // Trigger telemetry update with new business data
    await this.posSocket.sendTelemetryUpdate();
    
    console.log('✅ Order completed and telemetry updated');
  }
}

// Send telemetry after expense creation
class ExpenseService {
  constructor(private posSocket: POSSocketService) {}

  async createExpense(expense: Expense): Promise<void> {
    // Save expense to database
    await this.expenseRepository.save(expense);
    
    // Trigger telemetry update
    await this.posSocket.sendTelemetryUpdate();
    
    console.log('✅ Expense created and telemetry updated');
  }
}
```

### Complete Example Payload

```json
{
  "realtimeTelemetry": {
    "networkStatus": "online",
    "lastSyncTime": "2024-01-15T10:30:45.123Z",
    "lastOrder": {
      "receiptNumber": "RCP-2024-001234",
      "total": 125.50,
      "itemCount": 3,
      "paymentMethod": "card",
      "status": "completed",
      "createdAt": "2024-01-15T10:25:30.000Z",
      "items": [
        {
          "name": "Coffee",
          "quantity": 2,
          "price": 5.00
        },
        {
          "name": "Sandwich",
          "quantity": 1,
          "price": 115.50
        }
      ],
      "customer": {
        "name": "John Doe",
        "phone": "+1234567890"
      }
    },
    "kpiSummary": {
      "totalSales": 3450.75,
      "transactionCount": 42,
      "averageTransactionValue": 82.16,
      "period": "today",
      "lastUpdated": "2024-01-15T10:30:45.123Z"
    },
    "expenses": [
      {
        "id": "exp-001",
        "title": "Office Supplies",
        "amount": 125.00,
        "category": "Supplies",
        "paymentMethod": "card",
        "expenseDate": "2024-01-15T09:00:00.000Z",
        "isUrgent": false
      },
      {
        "id": "exp-002",
        "title": "Cleaning Services",
        "amount": 75.00,
        "category": "Services",
        "paymentMethod": "cash",
        "expenseDate": "2024-01-15T08:30:00.000Z",
        "isUrgent": false
      }
    ],
    "osVersion": "Windows 10",
    "appVersion": "2.1.0",
    "cpuUsage": 45,
    "memoryUsage": 60,
    "diskSpace": 250,
    "cashDrawerStatus": "closed",
    "printerStatus": "online"
  }
}
```

### Error Handling Best Practices

```typescript
/**
 * Robust telemetry collection with error handling
 */
protected async collectTelemetry(): Promise<TelemetryData> {
  const telemetry: TelemetryData = {
    networkStatus: this.getNetworkStatus(),
    lastSyncTime: new Date().toISOString()
  };

  // Collect business data with individual error handling
  try {
    telemetry.lastOrder = await this.businessDataCollector.collectLastOrder();
  } catch (error) {
    console.error('Failed to collect lastOrder:', error);
    telemetry.lastOrder = null;
  }

  try {
    telemetry.kpiSummary = await this.businessDataCollector.collectKPISummary();
  } catch (error) {
    console.error('Failed to collect kpiSummary:', error);
    telemetry.kpiSummary = null;
  }

  try {
    telemetry.expenses = await this.businessDataCollector.collectExpenses();
  } catch (error) {
    console.error('Failed to collect expenses:', error);
    telemetry.expenses = [];
  }

  // Add system information (non-critical)
  try {
    telemetry.osVersion = this.getOSVersion();
    telemetry.appVersion = this.getAppVersion();
    telemetry.cpuUsage = this.getCPUUsage();
    telemetry.memoryUsage = this.getMemoryUsage();
    telemetry.diskSpace = this.getDiskSpace();
    telemetry.cashDrawerStatus = this.getCashDrawerStatus();
    telemetry.printerStatus = this.getPrinterStatus();
  } catch (error) {
    console.error('Failed to collect system info:', error);
  }

  return telemetry;
}
```

### Performance Considerations

1. **Async Data Collection**: Business data collection is asynchronous and may involve database queries
2. **Parallel Collection**: Use `Promise.all()` to collect data in parallel
3. **Error Isolation**: Each data field has independent error handling
4. **Graceful Degradation**: If business data fails, system telemetry still sends
5. **Update Frequency**: Consider reducing update frequency if database queries are expensive

### Testing Business Data

Use the updated `test-pos-app.html` file which includes example business data:

```bash
# Open test-pos-app.html in browser
# The default telemetry now includes:
# - lastOrder with sample order data
# - kpiSummary with sample KPIs
# - expenses array with sample expenses

# Click "Send Random Telemetry" to generate realistic test data
```

### Related Documentation

- [TELEMETRY_DATA_STRUCTURE.md](./TELEMETRY_DATA_STRUCTURE.md) - Complete field specifications
- [BUSINESS_DATA_IMPLEMENTATION_SUMMARY.md](./BUSINESS_DATA_IMPLEMENTATION_SUMMARY.md) - Implementation details
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing procedures

---
