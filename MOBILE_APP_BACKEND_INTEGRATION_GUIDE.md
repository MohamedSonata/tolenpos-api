# Mobile App Backend Integration Guide

## Overview
This guide provides comprehensive instructions for integrating a mobile app with the POS insights backend system. The mobile app is designed for desktop machine POS insights and uses both REST API endpoints and Socket.IO for real-time communication.

## Authentication
All API requests require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Base URLs
- **REST API**: `https://your-backend-domain.com/api`
- **Socket.IO**: `wss://your-backend-domain.com`

---

## 1. REST API Endpoints

### 1.1 User Seats Management

#### Get User's Seats
**Endpoint**: `GET /api/key-seats/my-seats`
**Description**: Fetches all POS seats owned by the authenticated user
**Authentication**: Required (JWT)

**Response Example**:
```json
{
  "data": [
    {
      "id": 1,
      "documentId": "seat_abc123",
      "machineUUID": "machine-uuid-123",
      "userSocketId": "socket_xyz789",
      "isActive": true,
      "telemetry": {
        "osVersion": "Windows 11",
        "appVersion": "1.2.0",
        "firstActivated": "2024-04-16T10:30:00.000Z"
      },
      "realtimeTelemetry": {
        "networkStatus": "online",
        "lastSyncTime": "2024-04-16T14:30:00.000Z",
        "lastOrder": {
          "receiptNumber": "RCP-001234",
          "total": 45.99,
          "itemCount": 3,
          "paymentMethod": "card",
          "status": "completed",
          "createdAt": "2024-04-16T14:25:00.000Z"
        },
        "kpiSummary": {
          "totalSales": 1250.50,
          "transactionCount": 28,
          "averageTransactionValue": 44.66,
          "period": "today",
          "lastUpdated": "2024-04-16T14:30:00.000Z"
        },
        "expenses": [
          {
            "id": "exp_001",
            "title": "Office Supplies",
            "amount": 25.99,
            "category": "supplies",
            "paymentMethod": "cash",
            "expenseDate": "2024-04-16T12:00:00.000Z",
            "isUrgent": false
          }
        ],
        "lastUpdated": "2024-04-16T14:30:00.000Z"
      },
      "licenseDocumentId": "license_def456",
      "licenseKey": "encrypted_license_key",
      "planSubscriptionType": "Pro"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### 1.2 Telemetry Data Management

#### Query Real-time Telemetry
**Endpoint**: `POST /api/key-seats/:documentId/telemetry/query`
**Description**: Requests real-time telemetry data from POS device (checks availability)
**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "filters": {
    "startDate": "2024-04-16T00:00:00.000Z",
    "endDate": "2024-04-16T23:59:59.000Z",
    "dataTypes": ["orders", "sales", "expenses"]
  },
  "waitForRealtime": true,
  "timeout": 10000
}
```

**Response (POS Online)**:
```json
{
  "success": true,
  "message": "POS device is online. Use Socket.IO event 'seat:telemetry:query' for real-time data.",
  "posOnline": true,
  "socketId": "socket_xyz789"
}
```

**Response (POS Offline - Fallback)**:
```json
{
  "success": true,
  "source": "snapshot",
  "data": {
    "lastOrder": {
      "receiptNumber": "RCP-001234",
      "total": 45.99,
      "itemCount": 3,
      "paymentMethod": "card",
      "status": "completed",
      "createdAt": "2024-04-16T14:25:00.000Z"
    },
    "kpiSummary": {
      "totalSales": 1250.50,
      "transactionCount": 28,
      "averageTransactionValue": 44.66,
      "period": "today",
      "lastUpdated": "2024-04-16T14:30:00.000Z"
    }
  },
  "timestamp": "2024-04-16T12:00:00.000Z",
  "warning": "POS device offline - showing snapshot from 2 hours ago",
  "snapshotAge": 2
}
```

#### Get Latest Telemetry Snapshot
**Endpoint**: `GET /api/key-seats/:documentId/telemetry/latest`
**Description**: Gets the latest telemetry snapshot (no real-time query)
**Authentication**: Required (JWT)

**Response Example**:
```json
{
  "success": true,
  "source": "snapshot",
  "data": {
    "networkStatus": "offline",
    "lastOrder": {
      "receiptNumber": "RCP-001234",
      "total": 45.99,
      "itemCount": 3,
      "paymentMethod": "card",
      "status": "completed",
      "createdAt": "2024-04-16T14:25:00.000Z"
    },
    "kpiSummary": {
      "totalSales": 1250.50,
      "transactionCount": 28,
      "averageTransactionValue": 44.66,
      "period": "today",
      "lastUpdated": "2024-04-16T14:30:00.000Z"
    },
    "expenses": []
  },
  "timestamp": "2024-04-16T12:00:00.000Z",
  "snapshotAge": 2,
  "snapshotType": "daily"
}
```

#### Create Manual Snapshot
**Endpoint**: `POST /api/key-seats/:documentId/telemetry/snapshot`
**Description**: Manually triggers a telemetry snapshot
**Authentication**: Required (JWT)

**Response Example**:
```json
{
  "success": true,
  "message": "Snapshot created successfully",
  "snapshot": {
    "documentId": "snapshot_ghi789",
    "capturedAt": "2024-04-16T15:00:00.000Z",
    "snapshotType": "realtime"
  }
}
```

---

## 2. Socket.IO Integration

### 2.1 Connection Setup

#### Authentication
Socket.IO connections require authentication via JWT token:

```javascript
const socket = io('wss://your-backend-domain.com', {
  auth: {
    token: 'your_jwt_token'
  },
  query: {
    clientType: 'mobile' // Important: identifies as mobile client
  }
});
```

#### Connection Events
```javascript
socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

### 2.2 Seat Subscription (Real-time Updates)

#### Subscribe to Seat Updates
**Event**: `seat:subscribe`
**Description**: Subscribe to real-time updates from POS devices

```javascript
// Subscribe to updates
socket.emit('seat:subscribe', {});

// Listen for subscription confirmation
socket.on('seat:subscribe:success', (data) => {
  console.log('Subscribed to seat updates:', data);
});

// Listen for real-time seat updates
socket.on('seat:updated', (data) => {
  console.log('Seat updated:', data);
  // Handle real-time telemetry updates
});
```

**Seat Update Event Data**:
```json
{
  "machineUUID": "machine-uuid-123",
  "realtimeTelemetry": {
    "networkStatus": "online",
    "lastSyncTime": "2024-04-16T15:30:00.000Z",
    "lastOrder": {
      "receiptNumber": "RCP-001235",
      "total": 67.50,
      "itemCount": 5,
      "paymentMethod": "cash",
      "status": "completed",
      "createdAt": "2024-04-16T15:25:00.000Z"
    },
    "kpiSummary": {
      "totalSales": 1318.00,
      "transactionCount": 29,
      "averageTransactionValue": 45.45,
      "period": "today",
      "lastUpdated": "2024-04-16T15:30:00.000Z"
    },
    "lastUpdated": "2024-04-16T15:30:00.000Z"
  },
  "isActive": true,
  "updatedAt": "2024-04-16T15:30:00.000Z",
  "licenseDocumentId": "license_def456"
}
```

#### Unsubscribe from Updates
```javascript
socket.emit('seat:unsubscribe', {});
```

### 2.3 Real-time Telemetry Queries

#### Query Telemetry Data
**Event**: `seat:telemetry:query`
**Description**: Request specific telemetry data from POS device in real-time

```javascript
const requestId = `query_${Date.now()}_${Math.random()}`;

// Send query request
socket.emit('seat:telemetry:query', {
  requestId: requestId,
  keySeatDocumentId: 'seat_abc123',
  filters: {
    startDate: '2024-04-16T00:00:00.000Z',
    endDate: '2024-04-16T23:59:59.000Z',
    dataTypes: ['orders', 'inventory', 'sales', 'expenses']
  }
});

// Listen for successful response
socket.on('seat:telemetry:query:result', (response) => {
  if (response.requestId === requestId) {
    console.log('Query result:', response);
    handleTelemetryData(response);
  }
});

// Listen for errors
socket.on('seat:telemetry:query:error', (error) => {
  if (error.requestId === requestId) {
    console.error('Query error:', error);
    handleQueryError(error);
  }
});
```

**Query Result Response**:
```json
{
  "requestId": "query_1713276000000_0.123",
  "keySeatDocumentId": "seat_abc123",
  "source": "realtime",
  "data": {
    "orders": [
      {
        "receiptNumber": "RCP-001235",
        "total": 67.50,
        "itemCount": 5,
        "paymentMethod": "cash",
        "status": "completed",
        "createdAt": "2024-04-16T15:25:00.000Z",
        "items": [
          {
            "name": "Coffee",
            "quantity": 2,
            "price": 4.50
          },
          {
            "name": "Sandwich",
            "quantity": 1,
            "price": 8.99
          }
        ]
      }
    ],
    "sales": {
      "totalToday": 1318.00,
      "transactionCount": 29,
      "averageValue": 45.45
    },
    "expenses": [
      {
        "id": "exp_002",
        "title": "Inventory Restock",
        "amount": 150.00,
        "category": "inventory",
        "paymentMethod": "card",
        "expenseDate": "2024-04-16T14:00:00.000Z",
        "isUrgent": false
      }
    ]
  },
  "timestamp": "2024-04-16T15:30:00.000Z",
  "success": true
}
```

**Query Error Response**:
```json
{
  "requestId": "query_1713276000000_0.123",
  "keySeatDocumentId": "seat_abc123",
  "error": "POS device offline and no snapshot available",
  "fallbackAvailable": false
}
```

**Fallback Snapshot Response**:
```json
{
  "requestId": "query_1713276000000_0.123",
  "keySeatDocumentId": "seat_abc123",
  "source": "snapshot",
  "data": {
    "lastOrder": {
      "receiptNumber": "RCP-001234",
      "total": 45.99,
      "itemCount": 3,
      "paymentMethod": "card",
      "status": "completed",
      "createdAt": "2024-04-16T14:25:00.000Z"
    }
  },
  "timestamp": "2024-04-16T12:00:00.000Z",
  "success": true,
  "warning": "POS device offline - showing snapshot from 3 hours ago",
  "snapshotAge": 3
}
```

---

## 3. Data Models

### 3.1 Key-Seat Model
```typescript
interface KeySeat {
  id: number;
  documentId: string;
  machineUUID: string;
  userSocketId: string | null;
  isActive: boolean;
  telemetry: {
    osVersion?: string;
    appVersion?: string;
    firstActivated?: string;
    [key: string]: any;
  };
  realtimeTelemetry: TelemetryData;
  license: License;
  telemetryHistory: TelemetryHistory[];
}
```

### 3.2 Telemetry Data Structure
```typescript
interface TelemetryData {
  // Network status
  networkStatus?: 'online' | 'offline';
  lastSyncTime?: string;
  
  // Business data
  lastOrder?: LastOrderData | null;
  kpiSummary?: KPISummaryData | null;
  expenses?: ExpenseData[];
  
  // System information (optional)
  osVersion?: string;
  appVersion?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskSpace?: number;
  
  // Additional business metrics (optional)
  transactionsToday?: number;
  lastTransactionTime?: string;
  cashDrawerStatus?: 'open' | 'closed';
  printerStatus?: 'online' | 'offline' | 'error';
  
  // Metadata
  lastUpdated?: string;
  
  // Allow additional custom fields
  [key: string]: any;
}

interface LastOrderData {
  receiptNumber: string;
  total: number;
  itemCount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items?: any[];
  customer?: any;
}

interface KPISummaryData {
  totalSales: number;
  transactionCount: number;
  averageTransactionValue: number;
  period: string;
  lastUpdated: string;
}

interface ExpenseData {
  id: string;
  title: string;
  amount: number;
  category: string;
  paymentMethod: string;
  expenseDate: string;
  isUrgent: boolean;
}
```

### 3.3 License Model
```typescript
interface License {
  id: number;
  documentId: string;
  licenseKey: string;
  maxSeats: number;
  expiresAt: string | null;
  expirationType: 'perpetual' | 'expiring';
  isActive: boolean;
  planSubscriptionType: 'FreeTrial' | 'Pro' | 'Enterprise';
  user: User;
  seats: KeySeat[];
}
```

---

## 4. Error Handling

### 4.1 HTTP Error Responses
```json
{
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Authentication required"
  }
}
```

### 4.2 Socket.IO Error Events
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

---

## 5. Implementation Examples

### 5.1 Complete Mobile App Integration
```javascript
class POSInsightsAPI {
  constructor(baseURL, socketURL, token) {
    this.baseURL = baseURL;
    this.token = token;
    this.socket = io(socketURL, {
      auth: { token },
      query: { clientType: 'mobile' }
    });
    this.setupSocketListeners();
  }

  // REST API Methods
  async getUserSeats() {
    const response = await fetch(`${this.baseURL}/api/key-seats/my-seats`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }
"seeats response "
{
    "data": [
        {
            "id": 803,
            "documentId": "cpmtzqffb0qn5tsbtl36opfy",
            "machineUUID": "9d59fb49861e37e7339d6b317a68ed3582bef8104fe41450ae7138d6765e109e",
            "telemetry": {
                "networkStatus": "online",
                "lastSyncTime": "2026-04-14T18:11:58.793Z",
                "lastOrder": {
                    "receiptNumber": "RCP-20260414-T01-001",
                    "total": 0.82,
                    "itemCount": 1,
                    "paymentMethod": "CASH",
                    "status": "COMPLETED",
                    "createdAt": "2026-04-14T18:05:13.000Z",
                    "items": [
                        {
                            "productName": "فلافل 1 دينار",
                            "quantity": 1,
                            "price": 1
                        }
                    ]
                },
                "kpiSummary": {
                    "totalSales": 0.82,
                    "transactionCount": 1,
                    "averageTransactionValue": 0.82,
                    "period": "today",
                    "lastUpdated": "2026-04-14T18:11:58.851Z"
                },
                "expenses": [
                    {
                        "id": "d6dd68da-da21-4058-898a-b344d47e2e95",
                        "title": "Testoing",
                        "amount": 0.5,
                        "category": "KITCHEN_SUPPLIES",
                        "paymentMethod": "CASH",
                        "expenseDate": "2026-04-14T18:05:29.000Z",
                        "isUrgent": false
                    }
                ],
                "lastUpdated": "2026-04-14T18:11:58.992Z"
            },
            "isActive": true,
            "createdAt": "2026-04-14T17:05:27.883Z",
            "updatedAt": "2026-04-15T17:44:58.897Z",
            "publishedAt": "2026-04-15T17:44:58.928Z",
            "locale": null,
            "userSocketId": null,
            "realtimeTelemetry": {
                "networkStatus": "online",
                "lastSyncTime": "2026-04-15T17:44:50.397Z",
                "lastOrder": {
                    "receiptNumber": "RCP-20260415-T01-004",
                    "total": 0.65,
                    "itemCount": 1,
                    "paymentMethod": "CASH",
                    "status": "COMPLETED",
                    "createdAt": "2026-04-15T16:06:52.000Z",
                    "items": [
                        {
                            "productName": "فلافل 0.65 قرش",
                            "quantity": 1,
                            "price": 0.65
                        }
                    ]
                },
                "kpiSummary": {
                    "totalSales": 24.3,
                    "transactionCount": 4,
                    "averageTransactionValue": 6.08,
                    "period": "today",
                    "lastUpdated": "2026-04-15T17:44:50.416Z"
                },
                "expenses": [],
                "lastUpdated": "2026-04-15T17:44:50.482Z"
            },
            "license": {
                "id": 57,
                "documentId": "zrp0aqpu7dczfsey0sl76naa",
                "licenseKey": "YdeMKNsbB5dmb2Dzt0eUh5AxaihjcKqPTwXB7eZtsqNiuS73khA8Rdr/waLYJBl3tXeHAhn4kR7dCTvmArlMDYm75noAfZKgcR/SIFeNGOZE5ZvqPtRF3A+ZFgm07vLai+mGU32Bt/IPDEOpgUE4mlFNfjGCWig/2AKnDbnQX4Nck8E+5NHOKWWFhitLYkF5dlhH2A6+jy29IF/reGMvKzMoyyHs9VTvu1GCtdo3UA==",
                "maxSeats": 3,
                "expirationType": "expiring",
                "isActive": true,
                "createdAt": "2026-03-01T15:27:36.220Z",
                "updatedAt": "2026-04-15T18:00:27.215Z",
                "publishedAt": "2026-04-15T18:00:27.267Z",
                "locale": null,
                "expiresAt": "2026-04-26T22:00:00.000Z",
                "planSubscriptionType": "Pro"
            },
            "licenseDocumentId": "zrp0aqpu7dczfsey0sl76naa",
            "licenseKey": "YdeMKNsbB5dmb2Dzt0eUh5AxaihjcKqPTwXB7eZtsqNiuS73khA8Rdr/waLYJBl3tXeHAhn4kR7dCTvmArlMDYm75noAfZKgcR/SIFeNGOZE5ZvqPtRF3A+ZFgm07vLai+mGU32Bt/IPDEOpgUE4mlFNfjGCWig/2AKnDbnQX4Nck8E+5NHOKWWFhitLYkF5dlhH2A6+jy29IF/reGMvKzMoyyHs9VTvu1GCtdo3UA==",
            "planSubscriptionType": "Pro"
        },
        {
            "id": 1217,
            "documentId": "gcrao9s95fo2vahg97crnkag",
            "machineUUID": "09c9e360a47442387069f005cde8cc17dc053d90358307400440d980bd25370f",
            "telemetry": {
                "os": "win32",
                "appVersion": "1.0.0",
                "timestamp": "2026-04-15T18:00:26.988Z",
                "hostname": "DESKTOP-F29D9AV",
                "platform": "Windows",
                "osVersion": "10.0.26100",
                "firstActivated": "2026-04-15T18:00:27.073Z"
            },
            "isActive": true,
            "createdAt": "2026-04-15T18:00:27.090Z",
            "updatedAt": "2026-04-15T22:00:07.843Z",
            "publishedAt": "2026-04-15T22:00:07.866Z",
            "locale": null,
            "userSocketId": null,
            "realtimeTelemetry": {
                "networkStatus": "online",
                "lastSyncTime": "2026-04-15T21:59:58.497Z",
                "lastOrder": {
                    "receiptNumber": "RCP-20260415-T01-004",
                    "total": 0.65,
                    "itemCount": 1,
                    "paymentMethod": "CASH",
                    "status": "COMPLETED",
                    "createdAt": "2026-04-15T16:06:52.000Z",
                    "items": [
                        {
                            "productName": "فلافل 0.65 قرش",
                            "quantity": 1,
                            "price": 0.65
                        }
                    ]
                },
                "kpiSummary": {
                    "totalSales": 0,
                    "transactionCount": 0,
                    "averageTransactionValue": 0,
                    "period": "today",
                    "lastUpdated": "2026-04-15T21:59:58.528Z"
                },
                "expenses": [],
                "lastUpdated": "2026-04-15T21:59:58.602Z"
            },
            "license": {
                "id": 57,
                "documentId": "zrp0aqpu7dczfsey0sl76naa",
                "licenseKey": "YdeMKNsbB5dmb2Dzt0eUh5AxaihjcKqPTwXB7eZtsqNiuS73khA8Rdr/waLYJBl3tXeHAhn4kR7dCTvmArlMDYm75noAfZKgcR/SIFeNGOZE5ZvqPtRF3A+ZFgm07vLai+mGU32Bt/IPDEOpgUE4mlFNfjGCWig/2AKnDbnQX4Nck8E+5NHOKWWFhitLYkF5dlhH2A6+jy29IF/reGMvKzMoyyHs9VTvu1GCtdo3UA==",
                "maxSeats": 3,
                "expirationType": "expiring",
                "isActive": true,
                "createdAt": "2026-03-01T15:27:36.220Z",
                "updatedAt": "2026-04-15T18:00:27.215Z",
                "publishedAt": "2026-04-15T18:00:27.267Z",
                "locale": null,
                "expiresAt": "2026-04-26T22:00:00.000Z",
                "planSubscriptionType": "Pro"
            },
            "licenseDocumentId": "zrp0aqpu7dczfsey0sl76naa",
            "licenseKey": "YdeMKNsbB5dmb2Dzt0eUh5AxaihjcKqPTwXB7eZtsqNiuS73khA8Rdr/waLYJBl3tXeHAhn4kR7dCTvmArlMDYm75noAfZKgcR/SIFeNGOZE5ZvqPtRF3A+ZFgm07vLai+mGU32Bt/IPDEOpgUE4mlFNfjGCWig/2AKnDbnQX4Nck8E+5NHOKWWFhitLYkF5dlhH2A6+jy29IF/reGMvKzMoyyHs9VTvu1GCtdo3UA==",
            "planSubscriptionType": "Pro"
        }
    ],
    "meta": {
        "total": 2
    }
} 
  async getLatestTelemetry(seatDocumentId) {
    const response = await fetch(
      `${this.baseURL}/api/key-seats/${seatDocumentId}/telemetry/latest`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.json();
  }

  // Socket.IO Methods
  setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('Connected:', this.socket.id);
      this.subscribeToSeatUpdates();
    });

    this.socket.on('seat:updated', (data) => {
      this.handleSeatUpdate(data);
    });

    this.socket.on('seat:telemetry:query:result', (response) => {
      this.handleTelemetryQueryResult(response);
    });

    this.socket.on('seat:telemetry:query:error', (error) => {
      this.handleTelemetryQueryError(error);
    });
  }

  subscribeToSeatUpdates() {
    this.socket.emit('seat:subscribe', {});
  }

  queryRealTimeTelemetry(seatDocumentId, filters = {}) {
    const requestId = `query_${Date.now()}_${Math.random()}`;
    
    this.socket.emit('seat:telemetry:query', {
      requestId,
      keySeatDocumentId: seatDocumentId,
      filters
    });

    return requestId; // Return for tracking the response
  }

  handleSeatUpdate(data) {
    console.log('Real-time seat update:', data);
    // Update UI with new telemetry data
  }

  handleTelemetryQueryResult(response) {
    console.log('Telemetry query result:', response);
    // Process the telemetry data
  }

  handleTelemetryQueryError(error) {
    console.error('Telemetry query error:', error);
    // Handle error (show fallback data, retry, etc.)
  }
}

// Usage
const api = new POSInsightsAPI(
  'https://your-backend-domain.com',
  'wss://your-backend-domain.com',
  'your_jwt_token'
);

// Get user's seats
api.getUserSeats().then(seats => {
  console.log('User seats:', seats);
});

// Query real-time data
const requestId = api.queryRealTimeTelemetry('seat_abc123', {
  dataTypes: ['orders', 'sales', 'expenses']
});
```

---

## 6. Best Practices

### 6.1 Connection Management
- Always handle connection/disconnection events
- Implement reconnection logic for Socket.IO
- Store request IDs to match responses with requests

### 6.2 Data Handling
- Cache telemetry data locally for offline viewing
- Show data age/freshness indicators to users
- Implement fallback to snapshot data when POS is offline

### 6.3 Error Handling
- Always handle both HTTP and Socket.IO errors
- Provide meaningful error messages to users
- Implement retry mechanisms for failed requests

### 6.4 Performance
- Use Socket.IO for real-time updates, REST API for initial data loading
- Implement data pagination for large datasets
- Cache frequently accessed data

---

## 7. Socket.IO Event Constants

Use these exact event names in your implementation:

```javascript
const SOCKET_EVENTS = {
  // Seat subscription events
  SEAT_SUBSCRIBE: 'seat:subscribe',
  SEAT_SUBSCRIBE_SUCCESS: 'seat:subscribe:success',
  SEAT_UPDATED: 'seat:updated',
  SEAT_UNSUBSCRIBE: 'seat:unsubscribe',

  // Telemetry query events
  TELEMETRY_QUERY: 'seat:telemetry:query',
  TELEMETRY_QUERY_RESULT: 'seat:telemetry:query:result',
  TELEMETRY_QUERY_ERROR: 'seat:telemetry:query:error'
};
```

This guide provides everything needed to integrate a mobile app with the POS insights backend system. The combination of REST APIs for data management and Socket.IO for real-time updates ensures optimal performance and user experience.