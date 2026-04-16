# Integration Quick Reference Card

## 🚀 Quick Start

### Mobile App (Flutter)

```dart
// 1. Add dependencies
dependencies:
  socket_io_client: ^2.0.3+1
  uuid: ^4.0.0

// 2. Connect
final socket = io(serverUrl, 
  OptionBuilder()
    .setQuery({'token': jwtToken})
    .build()
);

// 3. Subscribe to updates
socket.emit('seat:subscribe', {});

// 4. Listen for updates
socket.on('seat:updated', (data) {
  final update = SeatUpdatedNotification.fromJson(data);
  print('Received: ${update.realtimeTelemetry}');
});

// 5. Query telemetry (NEW)
socket.emit('seat:telemetry:query', {
  'requestId': Uuid().v4(),
  'keySeatDocumentId': 'seat-id'
});
```

### POS App (TypeScript)

```typescript
// 1. Install
npm install socket.io-client@^4.5.4

// 2. Connect
const socket = io(serverUrl, {
  query: {
    token: licenseKey,
    userDocumentId: userId,
    machineUUID: machineId
  }
});

// 3. Send telemetry
socket.emit('seat:update', {
  realtimeTelemetry: {
    networkStatus: 'online',
    lastOrder: await getLastOrder(),
    kpiSummary: await getKPISummary(),
    cpuUsage: 45
  }
});

// 4. Handle queries (NEW)
socket.on('seat:telemetry:query:request', async (req) => {
  const data = await collectTelemetryData(req.filters);
  socket.emit('seat:telemetry:query:response', {
    requestId: req.requestId,
    keySeatDocumentId: req.keySeatDocumentId,
    telemetryData: data,
    mobileSocketId: req.mobileSocketId,
    success: true
  });
});
```

---

## 📡 Socket.IO Events

### Mobile App Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `seat:subscribe` | Emit | Subscribe to seat updates |
| `seat:unsubscribe` | Emit | Unsubscribe from updates |
| `seat:telemetry:query` | Emit | Request real-time data |
| `seat:subscribe:success` | Listen | Subscription confirmation |
| `seat:updated` | Listen | Real-time seat update |
| `seat:telemetry:query:result` | Listen | Query response |
| `seat:telemetry:query:error` | Listen | Query error |

### POS App Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `seat:update` | Emit | Send telemetry update |
| `seat:telemetry:query:response` | Emit | Respond to query |
| `seat:update:success` | Listen | Update confirmation |
| `seat:telemetry:query:request` | Listen | Handle query request |
| `plan:current` | Listen | Current plan info |
| `plan:updated` | Listen | Plan change notification |

---

## 📦 Data Structures

### Telemetry Data (realtimeTelemetry)

```typescript
{
  // Network
  networkStatus: 'online' | 'offline',
  lastSyncTime: '2024-01-15T10:30:45.123Z',
  
  // Business Data
  lastOrder: {
    receiptNumber: 'RCP-001',
    total: 125.50,
    itemCount: 3,
    paymentMethod: 'card',
    status: 'completed'
  },
  kpiSummary: {
    totalSales: 3450.75,
    transactionCount: 42,
    averageTransactionValue: 82.16
  },
  expenses: [
    {
      id: 'exp-001',
      title: 'Office Supplies',
      amount: 125.00,
      category: 'Supplies'
    }
  ],
  
  // System
  osVersion: 'Windows 10',
  appVersion: '2.1.0',
  cpuUsage: 45,
  memoryUsage: 60
}
```

### Query Request

```typescript
{
  requestId: 'uuid-123',
  keySeatDocumentId: 'seat-id',
  filters: {
    dataTypes: ['orders', 'inventory', 'sales']
  }
}
```

### Query Response

```typescript
{
  requestId: 'uuid-123',
  keySeatDocumentId: 'seat-id',
  source: 'realtime' | 'snapshot',
  data: { /* telemetry data */ },
  timestamp: '2024-01-15T10:30:45.123Z',
  success: true,
  warning: 'POS offline - using snapshot',
  snapshotAge: 2  // hours
}
```

---

## 🔑 Key Changes

### Field Name Update

❌ **Old**: `telemetry`  
✅ **New**: `realtimeTelemetry`

```typescript
// Before
socket.emit('seat:update', {
  telemetry: { /* data */ }
});

// After
socket.emit('seat:update', {
  realtimeTelemetry: { /* data */ }
});
```

### New Query System

```dart
// Mobile: Request data
socket.emit('seat:telemetry:query', {
  'requestId': Uuid().v4(),
  'keySeatDocumentId': 'seat-id'
});

// POS: Respond to query
socket.on('seat:telemetry:query:request', async (req) => {
  const data = await collectData();
  socket.emit('seat:telemetry:query:response', {
    requestId: req.requestId,
    telemetryData: data,
    success: true
  });
});
```

---

## ⏱️ Timeouts & Intervals

| Operation | Timeout/Interval |
|-----------|------------------|
| Telemetry Query | 10 seconds |
| Auto Telemetry Update | 30 seconds (recommended) |
| Socket Reconnection | 1-5 seconds (exponential backoff) |
| Daily Snapshot | 2 AM daily |
| Snapshot Cleanup | 3 AM Sunday |

---

## 🧪 Testing

### Test URLs

- Mobile: `test-mobile-app.html`
- POS: `test-pos-app.html`

### Quick Test Commands

```bash
# Mobile App
flutter pub add uuid
flutter run

# POS App
npm install socket.io-client
npm run dev
```

### Test Checklist

- [ ] Socket connection
- [ ] Authentication
- [ ] Telemetry updates
- [ ] Real-time queries
- [ ] Snapshot fallback
- [ ] Timeout handling
- [ ] Disconnect cleanup

---

## 🐛 Common Issues

### Connection Fails
```typescript
// Check authentication
query: {
  token: jwtToken,  // Mobile
  // OR
  token: licenseKey,  // POS
  userDocumentId: userId,
  machineUUID: machineId
}
```

### Query Timeout
```dart
// Implement timeout
await completer.future.timeout(
  Duration(seconds: 12),
  onTimeout: () => throw TimeoutException()
);
```

### Field Not Found
```typescript
// Use realtimeTelemetry, not telemetry
const data = update.realtimeTelemetry;
```

---

## 📚 Full Documentation

- [MOBILE_APP_INTEGRATION_GUIDE.md](./MOBILE_APP_INTEGRATION_GUIDE.md)
- [POS_INTEGRATION_GUIDE.md](./POS_INTEGRATION_GUIDE.md)
- [INTEGRATION_GUIDES_UPDATE_SUMMARY.md](./INTEGRATION_GUIDES_UPDATE_SUMMARY.md)

---

**Version**: 2.0.0  
**Last Updated**: April 15, 2026
