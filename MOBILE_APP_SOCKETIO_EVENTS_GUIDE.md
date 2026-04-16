# Mobile App Socket.IO Events Guide

## Overview
This guide provides a complete reference for Socket.IO event handling in the mobile app for POS insights. It covers all events the mobile app needs to listen to and emit, with expected data structures and response examples.

---

## Connection Setup

### Initial Connection
```javascript
import io from 'socket.io-client';

const socket = io('wss://your-backend-domain.com', {
  auth: {
    token: 'your_jwt_token' // JWT token from authentication
  },
  query: {
    clientType: 'mobile' // IMPORTANT: Must be 'mobile'
  },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});
```

### Connection Events to Listen
```javascript
// Connection successful
socket.on('connect', () => {
  console.log('Connected to server');
  console.log('Socket ID:', socket.id);
  // Auto-subscribe to seat updates after connection
  subscribeToSeatUpdates();
});

// Connection error
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  // Handle authentication errors, network issues, etc.
});

// Disconnected from server
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server disconnected the socket, reconnect manually
    socket.connect();
  }
  // Otherwise, socket will auto-reconnect
});

// Reconnection attempt
socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('Reconnection attempt:', attemptNumber);
});

// Successfully reconnected
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  // Re-subscribe to seat updates after reconnection
  subscribeToSeatUpdates();
});
```

---

## 1. Seat Subscription Events

### 1.1 Subscribe to Seat Updates

**Event to Emit**: `seat:subscribe`

**When to Use**: 
- Immediately after connecting to the server
- After reconnecting to the server
- When user navigates to the POS insights screen

**Data to Send**: Empty object
```javascript
socket.emit('seat:subscribe', {});
```

**Response Event to Listen**: `seat:subscribe:success`

**Success Response**:
```json
{
  "success": true,
  "message": "Subscribed to seat updates"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "User document ID not found"
}
```

**Implementation Example**:
```javascript
function subscribeToSeatUpdates() {
  socket.emit('seat:subscribe', {});
  
  socket.once('seat:subscribe:success', (response) => {
    if (response.success) {
      console.log('Successfully subscribed to seat updates');
    } else {
      console.error('Subscription failed:', response.error);
    }
  });
}
```

---

### 1.2 Receive Real-time Seat Updates

**Event to Listen**: `seat:updated`

**When Triggered**: 
- When any of your POS devices sends telemetry updates
- Automatically pushed by the server when POS data changes
- No need to poll or request - updates are pushed in real-time

**Data Structure**:
```typescript
interface SeatUpdatedNotification {
  machineUUID: string;
  realtimeTelemetry: {
    networkStatus?: 'online' | 'offline';
    lastSyncTime?: string;
    lastOrder?: {
      receiptNumber: string;
      total: number;
      itemCount: number;
      paymentMethod: string;
      status: string;
      createdAt: string;
      items?: any[];
      customer?: any;
    } | null;
    kpiSummary?: {
      totalSales: number;
      transactionCount: number;
      averageTransactionValue: number;
      period: string;
      lastUpdated: string;
    } | null;
    expenses?: Array<{
      id: string;
      title: string;
      amount: number;
      category: string;
      paymentMethod: string;
      expenseDate: string;
      isUrgent: boolean;
    }>;
    lastUpdated?: string;
    [key: string]: any; // Additional custom fields
  };
  isActive: boolean;
  updatedAt: string;
  licenseDocumentId: string;
}
```

**Example Data**:
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
      "createdAt": "2024-04-16T15:25:00.000Z",
      "items": [
        {
          "name": "Coffee",
          "quantity": 2,
          "price": 4.50,
          "total": 9.00
        },
        {
          "name": "Sandwich",
          "quantity": 1,
          "price": 8.99,
          "total": 8.99
        }
      ],
      "customer": {
        "name": "John Doe",
        "phone": "+1234567890"
      }
    },
    "kpiSummary": {
      "totalSales": 1318.00,
      "transactionCount": 29,
      "averageTransactionValue": 45.45,
      "period": "today",
      "lastUpdated": "2024-04-16T15:30:00.000Z"
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
      },
      {
        "id": "exp_002",
        "title": "Inventory Restock",
        "amount": 150.00,
        "category": "inventory",
        "paymentMethod": "card",
        "expenseDate": "2024-04-16T14:00:00.000Z",
        "isUrgent": true
      }
    ],
    "lastUpdated": "2024-04-16T15:30:00.000Z"
  },
  "isActive": true,
  "updatedAt": "2024-04-16T15:30:00.000Z",
  "licenseDocumentId": "license_def456"
}
```

**Implementation Example**:
```javascript
socket.on('seat:updated', (data) => {
  console.log('Seat updated:', data.machineUUID);
  
  // Update UI with new data
  updateDashboard({
    machineId: data.machineUUID,
    lastOrder: data.realtimeTelemetry.lastOrder,
    kpis: data.realtimeTelemetry.kpiSummary,
    expenses: data.realtimeTelemetry.expenses,
    isOnline: data.realtimeTelemetry.networkStatus === 'online',
    lastUpdate: data.updatedAt
  });
  
  // Show notification for new order
  if (data.realtimeTelemetry.lastOrder) {
    showNotification(
      'New Order',
      `Receipt ${data.realtimeTelemetry.lastOrder.receiptNumber} - $${data.realtimeTelemetry.lastOrder.total}`
    );
  }
  
  // Alert for urgent expenses
  const urgentExpenses = data.realtimeTelemetry.expenses?.filter(e => e.isUrgent);
  if (urgentExpenses && urgentExpenses.length > 0) {
    showUrgentExpenseAlert(urgentExpenses);
  }
});
```

---

### 1.3 Unsubscribe from Seat Updates

**Event to Emit**: `seat:unsubscribe`

**When to Use**: 
- When user navigates away from POS insights screen
- When app goes to background (optional, to save resources)
- Before disconnecting (cleanup)

**Data to Send**: Empty object
```javascript
socket.emit('seat:unsubscribe', {});
```

**No Response Event** - Unsubscribe is fire-and-forget

**Implementation Example**:
```javascript
function unsubscribeFromSeatUpdates() {
  socket.emit('seat:unsubscribe', {});
  console.log('Unsubscribed from seat updates');
}

// Call when leaving the screen
useEffect(() => {
  return () => {
    unsubscribeFromSeatUpdates();
  };
}, []);
```

---

## 2. Real-time Telemetry Query Events

### 2.1 Query Telemetry Data from POS

**Event to Emit**: `seat:telemetry:query`

**When to Use**: 
- When user requests specific data (e.g., order history, inventory)
- When you need fresh data beyond the automatic updates
- When user pulls to refresh

**Data to Send**:
```typescript
interface TelemetryQueryRequest {
  requestId: string; // Unique ID to track this request
  keySeatDocumentId: string; // The seat document ID
  filters: {
    startDate?: string; // ISO date string
    endDate?: string; // ISO date string
    dataTypes?: string[]; // ['orders', 'inventory', 'sales', 'expenses']
  };
}
```

**Example Request**:
```javascript
const requestId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

socket.emit('seat:telemetry:query', {
  requestId: requestId,
  keySeatDocumentId: 'seat_abc123',
  filters: {
    startDate: '2024-04-16T00:00:00.000Z',
    endDate: '2024-04-16T23:59:59.000Z',
    dataTypes: ['orders', 'sales', 'expenses']
  }
});

// Store requestId to match with response
pendingRequests.set(requestId, {
  timestamp: Date.now(),
  seatId: 'seat_abc123'
});
```

---

### 2.2 Receive Telemetry Query Results

**Event to Listen**: `seat:telemetry:query:result`

**When Triggered**: 
- After POS device responds to your query (usually within 1-2 seconds)
- If POS is offline, server sends snapshot data (may take up to 10 seconds)

**Data Structure**:
```typescript
interface TelemetryQueryResult {
  requestId: string; // Match with your request
  keySeatDocumentId: string;
  source: 'realtime' | 'snapshot'; // Where data came from
  data: Record<string, any>; // The actual telemetry data
  timestamp: string; // When data was captured
  success: boolean;
  warning?: string; // If using snapshot, explains why
  snapshotAge?: number; // Hours since snapshot (if applicable)
}
```

**Example Response (Real-time)**:
```json
{
  "requestId": "query_1713276000000_abc123",
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
            "price": 4.50,
            "total": 9.00
          }
        ]
      },
      {
        "receiptNumber": "RCP-001236",
        "total": 23.99,
        "itemCount": 2,
        "paymentMethod": "card",
        "status": "completed",
        "createdAt": "2024-04-16T15:45:00.000Z"
      }
    ],
    "sales": {
      "totalToday": 1318.00,
      "transactionCount": 29,
      "averageValue": 45.45,
      "hourlyBreakdown": [
        { "hour": 9, "sales": 120.50, "transactions": 5 },
        { "hour": 10, "sales": 245.00, "transactions": 8 }
      ]
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
  "timestamp": "2024-04-16T15:50:00.000Z",
  "success": true
}
```

**Example Response (Snapshot Fallback)**:
```json
{
  "requestId": "query_1713276000000_abc123",
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
  "success": true,
  "warning": "POS device offline - showing snapshot from 3 hours ago",
  "snapshotAge": 3
}
```

**Implementation Example**:
```javascript
socket.on('seat:telemetry:query:result', (response) => {
  console.log('Query result received:', response.requestId);
  
  // Check if this is the response we're waiting for
  const pendingRequest = pendingRequests.get(response.requestId);
  if (!pendingRequest) {
    console.warn('Received response for unknown request:', response.requestId);
    return;
  }
  
  // Remove from pending
  pendingRequests.delete(response.requestId);
  
  // Handle the data
  if (response.success) {
    if (response.source === 'snapshot') {
      // Show warning that data is from snapshot
      showWarning(response.warning || 'Showing cached data');
    }
    
    // Update UI with the data
    updateDetailedView({
      orders: response.data.orders || [],
      sales: response.data.sales || {},
      expenses: response.data.expenses || [],
      isRealtime: response.source === 'realtime',
      timestamp: response.timestamp
    });
  }
});
```

---

### 2.3 Handle Telemetry Query Errors

**Event to Listen**: `seat:telemetry:query:error`

**When Triggered**: 
- POS device is offline and no snapshot available
- Query timeout (POS didn't respond within 10 seconds)
- Access denied (you don't own this seat)
- Internal server error

**Data Structure**:
```typescript
interface TelemetryQueryError {
  requestId: string;
  keySeatDocumentId: string;
  error: string; // Error message
  fallbackAvailable: boolean; // Whether snapshot data exists
}
```

**Example Error Responses**:

**POS Offline, No Snapshot**:
```json
{
  "requestId": "query_1713276000000_abc123",
  "keySeatDocumentId": "seat_abc123",
  "error": "POS device offline and no snapshot available",
  "fallbackAvailable": false
}
```

**Access Denied**:
```json
{
  "requestId": "query_1713276000000_abc123",
  "keySeatDocumentId": "seat_abc123",
  "error": "Access denied: You do not own this seat",
  "fallbackAvailable": false
}
```

**Timeout**:
```json
{
  "requestId": "query_1713276000000_abc123",
  "keySeatDocumentId": "seat_abc123",
  "error": "Query timeout - POS device did not respond",
  "fallbackAvailable": true
}
```

**Implementation Example**:
```javascript
socket.on('seat:telemetry:query:error', (error) => {
  console.error('Query error:', error.requestId, error.error);
  
  // Check if this is our request
  const pendingRequest = pendingRequests.get(error.requestId);
  if (!pendingRequest) {
    return;
  }
  
  // Remove from pending
  pendingRequests.delete(error.requestId);
  
  // Handle the error
  if (error.error.includes('Access denied')) {
    showError('You do not have permission to view this device');
  } else if (error.error.includes('offline')) {
    if (error.fallbackAvailable) {
      showWarning('Device is offline. Showing last available data.');
      // Optionally retry or fetch snapshot via REST API
    } else {
      showError('Device is offline and no cached data available');
    }
  } else {
    showError('Failed to fetch data. Please try again.');
  }
});
```

---

## 3. Complete Implementation Example

### React/React Native Implementation

```javascript
import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

function usePOSInsights(authToken) {
  const [seats, setSeats] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const pendingRequestsRef = useRef(new Map());

  useEffect(() => {
    // Initialize socket connection
    const socket = io('wss://your-backend-domain.com', {
      auth: { token: authToken },
      query: { clientType: 'mobile' },
      transports: ['websocket'],
      reconnection: true
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('Connected:', socket.id);
      setIsConnected(true);
      subscribeToSeatUpdates();
    });

    socket.on('disconnect', () => {
      console.log('Disconnected');
      setIsConnected(false);
    });

    socket.on('reconnect', () => {
      console.log('Reconnected');
      subscribeToSeatUpdates();
    });

    // Seat subscription events
    socket.on('seat:subscribe:success', (response) => {
      console.log('Subscription:', response);
    });

    socket.on('seat:updated', (data) => {
      console.log('Seat updated:', data.machineUUID);
      
      // Update seats state
      setSeats(prevSeats => {
        const index = prevSeats.findIndex(s => s.machineUUID === data.machineUUID);
        if (index >= 0) {
          const updated = [...prevSeats];
          updated[index] = {
            ...updated[index],
            ...data,
            lastUpdate: new Date()
          };
          return updated;
        } else {
          return [...prevSeats, { ...data, lastUpdate: new Date() }];
        }
      });
    });

    // Telemetry query events
    socket.on('seat:telemetry:query:result', (response) => {
      const handler = pendingRequestsRef.current.get(response.requestId);
      if (handler) {
        handler.resolve(response);
        pendingRequestsRef.current.delete(response.requestId);
      }
    });

    socket.on('seat:telemetry:query:error', (error) => {
      const handler = pendingRequestsRef.current.get(error.requestId);
      if (handler) {
        handler.reject(error);
        pendingRequestsRef.current.delete(error.requestId);
      }
    });

    // Cleanup
    return () => {
      socket.emit('seat:unsubscribe', {});
      socket.disconnect();
    };
  }, [authToken]);

  // Subscribe to seat updates
  const subscribeToSeatUpdates = () => {
    if (socketRef.current) {
      socketRef.current.emit('seat:subscribe', {});
    }
  };

  // Query telemetry data
  const queryTelemetry = (seatDocumentId, filters = {}) => {
    return new Promise((resolve, reject) => {
      const requestId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store promise handlers
      pendingRequestsRef.current.set(requestId, { resolve, reject });
      
      // Set timeout
      setTimeout(() => {
        if (pendingRequestsRef.current.has(requestId)) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error('Query timeout'));
        }
      }, 15000); // 15 second timeout
      
      // Emit query
      socketRef.current.emit('seat:telemetry:query', {
        requestId,
        keySeatDocumentId: seatDocumentId,
        filters
      });
    });
  };

  return {
    seats,
    isConnected,
    queryTelemetry
  };
}

// Usage in component
function POSInsightsScreen() {
  const { seats, isConnected, queryTelemetry } = usePOSInsights(authToken);

  const handleRefresh = async (seatId) => {
    try {
      const result = await queryTelemetry(seatId, {
        dataTypes: ['orders', 'sales', 'expenses']
      });
      console.log('Fresh data:', result);
    } catch (error) {
      console.error('Query failed:', error);
    }
  };

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      {seats.map(seat => (
        <div key={seat.machineUUID}>
          <h3>Device: {seat.machineUUID}</h3>
          <p>Last Order: {seat.realtimeTelemetry?.lastOrder?.receiptNumber}</p>
          <p>Total Sales: ${seat.realtimeTelemetry?.kpiSummary?.totalSales}</p>
          <button onClick={() => handleRefresh(seat.documentId)}>
            Refresh
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 4. Event Summary Table

| Event Name | Direction | Purpose | Data Required | Response Event |
|------------|-----------|---------|---------------|----------------|
| `seat:subscribe` | Mobile → Server | Subscribe to seat updates | `{}` | `seat:subscribe:success` |
| `seat:subscribe:success` | Server → Mobile | Confirm subscription | N/A | N/A |
| `seat:updated` | Server → Mobile | Real-time seat data push | N/A | N/A |
| `seat:unsubscribe` | Mobile → Server | Unsubscribe from updates | `{}` | None |
| `seat:telemetry:query` | Mobile → Server | Request specific data | `{ requestId, keySeatDocumentId, filters }` | `seat:telemetry:query:result` or `seat:telemetry:query:error` |
| `seat:telemetry:query:result` | Server → Mobile | Query response with data | N/A | N/A |
| `seat:telemetry:query:error` | Server → Mobile | Query failed | N/A | N/A |

---

## 5. Best Practices

### 5.1 Request ID Management
- Always generate unique request IDs for telemetry queries
- Store pending requests with timeouts
- Clean up completed/failed requests to prevent memory leaks

### 5.2 Connection Management
- Re-subscribe to seat updates after reconnection
- Handle connection errors gracefully
- Show connection status to users

### 5.3 Data Handling
- Update UI immediately when receiving `seat:updated` events
- Cache data locally for offline viewing
- Show data freshness indicators (real-time vs snapshot)

### 5.4 Error Handling
- Always listen for error events
- Provide fallback options when POS is offline
- Show meaningful error messages to users

### 5.5 Performance
- Unsubscribe when not viewing POS insights
- Implement request debouncing for user-triggered queries
- Use request timeouts to prevent hanging requests

---

## 6. Troubleshooting

### Connection Issues
```javascript
socket.on('connect_error', (error) => {
  if (error.message.includes('authentication')) {
    // Token expired or invalid - refresh token
    refreshAuthToken();
  } else {
    // Network issue - retry
    console.error('Connection error:', error);
  }
});
```

### Not Receiving Updates
- Verify `clientType: 'mobile'` is set in connection query
- Ensure you've called `seat:subscribe` after connecting
- Check that JWT token is valid and not expired
- Verify user owns the seats being updated

### Query Timeouts
- Check POS device is online and connected
- Verify seat document ID is correct
- Ensure filters are valid (proper date formats)
- Consider using REST API fallback for offline devices

This guide provides everything needed to implement Socket.IO event handling in your mobile app for real-time POS insights.