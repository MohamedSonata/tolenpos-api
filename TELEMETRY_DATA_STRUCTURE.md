# Telemetry Data Structure Guide

## Overview

This document describes the complete telemetry data structure that POS applications send to the backend via Socket.IO. The telemetry data includes network status, business metrics, and operational data that gets stored in both the `key-seat` collection (current state) and `seat-telemetry-history` collection (historical snapshots).

## Complete Telemetry Payload

When a POS app emits a `seat:update` event, it sends the following payload structure:

```typescript
{
  "telemetry": {
    // Network Status
    "networkStatus": "online" | "offline",
    "lastSyncTime": "2024-01-15T10:30:45.123Z",
    
    // Business Data (NEW)
    "lastOrder": {
      "receiptNumber": "RCP-2024-001234",
      "total": 125.50,
      "itemCount": 3,
      "paymentMethod": "card" | "cash" | "mobile",
      "status": "completed" | "pending" | "cancelled",
      "createdAt": "2024-01-15T10:25:30.000Z",
      "items": [...],  // Optional: Array of order items
      "customer": {...}  // Optional: Customer information
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
        "paymentMethod": "card" | "cash",
        "expenseDate": "2024-01-15T09:00:00.000Z",
        "isUrgent": false
      }
      // ... up to 10 most recent expenses from today
    ],
    
    // System Information (Optional)
    "osVersion": "Windows 10",
    "appVersion": "1.2.3",
    "cpuUsage": 45.2,
    "memoryUsage": 62.8,
    "diskSpace": 85.5,
    
    // Additional Business Metrics (Optional)
    "transactionsToday": 42,
    "lastTransactionTime": "2024-01-15T10:25:30.000Z",
    "cashDrawerStatus": "open" | "closed",
    "printerStatus": "online" | "offline" | "error"
  }
}
```

## Field Descriptions

### Network Status Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `networkStatus` | string | No | Current network connectivity status: "online" or "offline" |
| `lastSyncTime` | string (ISO 8601) | No | Timestamp of the last successful data synchronization |

### Business Data Fields (NEW)

#### lastOrder

Contains details about the most recent order processed by the POS.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `receiptNumber` | string | Yes | Unique receipt identifier |
| `total` | number | Yes | Total order amount |
| `itemCount` | number | Yes | Number of items in the order |
| `paymentMethod` | string | Yes | Payment method used: "card", "cash", "mobile" |
| `status` | string | Yes | Order status: "completed", "pending", "cancelled" |
| `createdAt` | string (ISO 8601) | Yes | Order creation timestamp |
| `items` | array | No | Array of order items with details |
| `customer` | object | No | Customer information if available |

**Note:** If no orders exist, `lastOrder` should be `null`.

#### kpiSummary

Contains today's key performance indicators and sales metrics.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `totalSales` | number | Yes | Total sales amount for the period |
| `transactionCount` | number | Yes | Number of transactions completed |
| `averageTransactionValue` | number | Yes | Average value per transaction |
| `period` | string | Yes | Time period for the KPIs (typically "today") |
| `lastUpdated` | string (ISO 8601) | Yes | Timestamp when KPIs were calculated |

**Note:** If no sales data exists, `kpiSummary` should be `null`.

#### expenses

Array of recent expense records from today (up to 10 most recent).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique expense identifier |
| `title` | string | Yes | Expense description/title |
| `amount` | number | Yes | Expense amount |
| `category` | string | Yes | Expense category |
| `paymentMethod` | string | Yes | Payment method: "card", "cash" |
| `expenseDate` | string (ISO 8601) | Yes | Date when expense occurred |
| `isUrgent` | boolean | Yes | Whether the expense is marked as urgent |

**Note:** If no expenses exist, `expenses` should be an empty array `[]`.

### System Information Fields (Optional)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `osVersion` | string | No | Operating system version |
| `appVersion` | string | No | POS application version |
| `cpuUsage` | number | No | CPU usage percentage |
| `memoryUsage` | number | No | Memory usage percentage |
| `diskSpace` | number | No | Available disk space percentage |

### Additional Business Metrics (Optional)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transactionsToday` | number | No | Total transactions today (legacy field) |
| `lastTransactionTime` | string (ISO 8601) | No | Last transaction timestamp (legacy field) |
| `cashDrawerStatus` | string | No | Cash drawer status: "open", "closed" |
| `printerStatus` | string | No | Printer status: "online", "offline", "error" |

## Backend Processing

### Data Storage

When the backend receives telemetry data:

1. **Current State Storage** - The complete telemetry object is stored in the `key-seat.telemetry` field
2. **Historical Snapshot** - A snapshot is created in the `seat-telemetry-history` collection with:
   - `telemetryData`: Complete telemetry object
   - `capturedAt`: Current timestamp
   - `snapshotType`: "realtime"
   - `keySeat`: Reference to the key-seat document

### Data Validation

The backend performs minimal validation:
- Ensures the POS is authenticated
- Verifies the seat exists
- Accepts any valid JSON structure for telemetry

### Metadata Addition

The backend automatically adds:
- `lastUpdated`: ISO 8601 timestamp when the telemetry was received

## Example Complete Payload

```json
{
  "telemetry": {
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
    "appVersion": "1.2.3",
    "cpuUsage": 45.2,
    "memoryUsage": 62.8,
    "diskSpace": 85.5,
    "cashDrawerStatus": "closed",
    "printerStatus": "online"
  }
}
```

## Mobile App Notifications

When a seat update occurs, subscribed mobile apps receive a notification with this structure:

```json
{
  "machineUUID": "ABC-123-XYZ",
  "telemetry": {
    // Complete telemetry object as shown above
  },
  "isActive": true,
  "updatedAt": "2024-01-15T10:30:45.123Z",
  "licenseDocumentId": "lic_abc123"
}
```

## Error Handling

### POS Side

If data collection fails for any business data field:
- Set the field to `null` (for `lastOrder`, `kpiSummary`)
- Set to empty array `[]` (for `expenses`)
- Continue sending the telemetry update with available data

### Backend Side

The backend:
- Accepts any valid JSON structure
- Does not validate individual field formats
- Logs warnings for missing critical data
- Always creates historical snapshots regardless of data completeness

## Best Practices

### For POS Applications

1. **Send Complete Data**: Include all available fields in every update
2. **Handle Nulls Gracefully**: Use `null` for unavailable single objects, `[]` for unavailable arrays
3. **Use ISO 8601 Timestamps**: All dates should be in ISO 8601 format
4. **Limit Expenses**: Send only the 10 most recent expenses from today
5. **Update Frequency**: Send updates at reasonable intervals (e.g., after each transaction, every 5 minutes)

### For Mobile Applications

1. **Check Field Existence**: Always check if business data fields exist before accessing
2. **Handle Null Values**: Be prepared for `lastOrder` and `kpiSummary` to be `null`
3. **Display Gracefully**: Show appropriate messages when data is unavailable
4. **Subscribe to Updates**: Use the `seat:subscribe` event to receive real-time updates

## TypeScript Interfaces

The complete TypeScript interfaces are available in `src/socketio/interfaces.ts`:

```typescript
import {
  TelemetryData,
  LastOrderData,
  KPISummaryData,
  ExpenseData,
  SeatUpdatePayload
} from './src/socketio/interfaces';
```

## Related Documentation

- [POS Integration Guide](./POS_INTEGRATION_GUIDE.md) - How to integrate POS applications
- [Mobile App Integration Guide](./MOBILE_APP_INTEGRATION_GUIDE.md) - How to integrate mobile apps
- [Testing Guide](./TESTING_GUIDE.md) - How to test telemetry updates
