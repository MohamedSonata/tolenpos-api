# Integration Guides Update Summary

## 📋 Overview

Both `MOBILE_APP_INTEGRATION_GUIDE.md` and `POS_INTEGRATION_GUIDE.md` have been updated to reflect the latest system changes and improvements.

**Last Updated**: April 15, 2026  
**Status**: ✅ Complete

---

## 🆕 What's New

### 1. Real-time Telemetry Query System

**Mobile App → POS Direct Queries**

Mobile apps can now request telemetry data directly from POS devices in real-time:

- **New Event**: `seat:telemetry:query` (Mobile → Server → POS)
- **Response Events**: 
  - `seat:telemetry:query:result` (success)
  - `seat:telemetry:query:error` (failure)
- **Timeout**: 10 seconds with automatic fallback to snapshots
- **Use Case**: On-demand data refresh, detailed seat inspection

**Benefits**:
- Fresh data when POS is online (500ms - 2s response)
- Automatic fallback to daily snapshots when offline
- Reduced storage costs (99% reduction in snapshots)

---

### 2. Field Name Changes

**Updated Field**: `telemetry` → `realtimeTelemetry`

All telemetry data is now sent under the `realtimeTelemetry` field to distinguish it from historical snapshots.

**Before**:
```json
{
  "telemetry": { /* data */ }
}
```

**After**:
```json
{
  "realtimeTelemetry": { /* data */ }
}
```

**Impact**: 
- All Socket.IO events updated
- HTTP API responses updated
- TypeScript/Dart type definitions updated

---

### 3. Memory Leak Fixes

**Issue**: Pending telemetry query requests weren't cleaned up on disconnect

**Solution**: Added automatic cleanup on socket disconnect

**Implementation**:
- Disconnect handlers clear pending requests
- Timeout handlers are cancelled
- Memory is freed properly

**Mobile App Impact**:
```dart
// Now automatically handled
socket.on('disconnect', () {
  // Cleanup happens automatically
});
```

---

### 4. Strapi Native Cron Jobs

**Change**: Migrated from node-cron to Strapi's built-in cron system

**Configuration**: `config/cron-tasks.ts`

**Jobs**:
1. **Daily Telemetry Snapshot**: Runs at 2 AM daily
2. **Cleanup Old Snapshots**: Runs at 3 AM every Sunday

**Benefits**:
- Better integration with Strapi
- Easier configuration via environment variables
- Improved monitoring and logging

---

## 📱 Mobile App Integration Updates

### New Socket.IO Events

#### 1. `seat:telemetry:query` (Emit)

Request telemetry data from POS device:

```dart
import 'package:uuid/uuid.dart';

final requestId = Uuid().v4();
socket.emit('seat:telemetry:query', {
  'requestId': requestId,
  'keySeatDocumentId': 'seat-doc-id-123',
  'filters': {
    'dataTypes': ['orders', 'inventory', 'sales']
  }
});
```

#### 2. `seat:telemetry:query:result` (Listen)

Receive query response:

```dart
socket.on('seat:telemetry:query:result', (data) {
  final result = TelemetryQueryResult.fromJson(data);
  
  if (result.isRealtime) {
    print('✅ Got real-time data');
  } else {
    print('⚠️ Using snapshot from ${result.snapshotAge} hours ago');
  }
  
  updateUI(result.data);
});
```

#### 3. `seat:telemetry:query:error` (Listen)

Handle query errors:

```dart
socket.on('seat:telemetry:query:error', (data) {
  final error = TelemetryQueryError.fromJson(data);
  showError(error.error);
});
```

### Updated Data Models

```dart
class SeatUpdatedNotification {
  final String machineUUID;
  final Map<String, dynamic> realtimeTelemetry;  // Updated field name
  final bool isActive;
  final String updatedAt;
  final String licenseDocumentId;
}

class TelemetryQueryResult {
  final String requestId;
  final String keySeatDocumentId;
  final String source;  // 'realtime' or 'snapshot'
  final Map<String, dynamic> data;
  final String timestamp;
  final bool success;
  final String? warning;
  final int? snapshotAge;
}

class TelemetryQueryError {
  final String requestId;
  final String keySeatDocumentId;
  final String error;
  final bool fallbackAvailable;
}
```

### New Dependencies

```yaml
dependencies:
  uuid: ^4.0.0  # For generating request IDs
```

---

## 🖥️ POS App Integration Updates

### New Socket.IO Events

#### 1. `seat:telemetry:query:request` (Listen)

Handle telemetry query from mobile app:

```typescript
socket.on('seat:telemetry:query:request', async (request) => {
  console.log('📥 Telemetry query received:', request.requestId);
  
  try {
    const telemetryData = await collectTelemetryData(request.filters);
    
    socket.emit('seat:telemetry:query:response', {
      requestId: request.requestId,
      keySeatDocumentId: request.keySeatDocumentId,
      telemetryData: telemetryData,
      mobileSocketId: request.mobileSocketId,
      timestamp: new Date().toISOString(),
      success: true
    });
  } catch (error) {
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
```

**Important**: Respond within 10 seconds (server timeout)

### Updated Telemetry Structure

```typescript
interface SeatUpdatePayload {
  realtimeTelemetry: TelemetryData;  // Updated field name
}

interface TelemetryData {
  // Network Status
  networkStatus?: 'online' | 'offline';
  lastSyncTime?: string;
  
  // Business Data
  lastOrder?: LastOrderData;
  kpiSummary?: KPISummaryData;
  expenses?: ExpenseData[];
  
  // System Information
  osVersion?: string;
  appVersion?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskSpace?: number;
  cashDrawerStatus?: 'open' | 'closed';
  printerStatus?: 'online' | 'offline' | 'error';
}
```

### Updated Event Emission

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

---

## 🔄 Migration Guide

### For Mobile App Developers

1. **Update Dependencies**:
   ```bash
   flutter pub add uuid
   ```

2. **Update Field Names**:
   - Change `telemetry` to `realtimeTelemetry` in all models
   - Update JSON parsing logic

3. **Implement Query System** (Optional):
   - Add `TelemetryQueryService` class
   - Implement query request/response handlers
   - Add timeout handling

4. **Test Changes**:
   - Use updated `test-mobile-app.html`
   - Test real-time queries
   - Test fallback to snapshots

### For POS App Developers

1. **Update Field Names**:
   - Change `telemetry` to `realtimeTelemetry` in all payloads
   - Update TypeScript interfaces

2. **Implement Query Handler**:
   - Add listener for `seat:telemetry:query:request`
   - Implement `collectTelemetryData()` function
   - Emit `seat:telemetry:query:response`

3. **Update Business Data Collection**:
   - Ensure `lastOrder`, `kpiSummary`, `expenses` are included
   - Follow the structure in the guide

4. **Test Changes**:
   - Use updated `test-pos-app.html`
   - Test query responses
   - Verify 10-second timeout handling

---

## 📊 Performance Improvements

### Storage Optimization

- **Before**: ~100 snapshots/seat/day = 3,000/month
- **After**: 1 snapshot/seat/day = 30/month
- **Savings**: 99% reduction in storage

### Query Performance

- **Real-time Query**: 500ms - 2s (when POS online)
- **Snapshot Fallback**: 100ms - 500ms
- **Timeout**: 10 seconds maximum

### Memory Management

- **Before**: Memory leaks from pending requests
- **After**: Automatic cleanup on disconnect
- **Impact**: Stable memory usage over time

---

## 🧪 Testing

### Mobile App Testing

1. **Real-time Queries**:
   ```dart
   final result = await queryService.queryTelemetry(
     keySeatDocumentId: 'seat-id',
   );
   expect(result.source, 'realtime');
   ```

2. **Fallback to Snapshots**:
   - Disconnect POS device
   - Query telemetry
   - Verify snapshot is returned

3. **Timeout Handling**:
   - Simulate slow POS response
   - Verify 10-second timeout
   - Check fallback behavior

### POS App Testing

1. **Query Response**:
   - Receive query request
   - Collect telemetry data
   - Send response within 10 seconds

2. **Error Handling**:
   - Simulate data collection failure
   - Send error response
   - Verify mobile app receives error

3. **Business Data**:
   - Verify `lastOrder` is included
   - Verify `kpiSummary` is calculated
   - Verify `expenses` array is populated

---

## 📚 Documentation Files Updated

### 1. MOBILE_APP_INTEGRATION_GUIDE.md

**Sections Added**:
- Real-time Telemetry Queries
- New Socket.IO events (query system)
- Updated data models
- Query service implementation example

**Sections Updated**:
- Socket.IO event reference
- Data models (field name changes)
- Implementation guide
- Testing procedures

### 2. POS_INTEGRATION_GUIDE.md

**Sections Added**:
- Telemetry query request handler
- Query response implementation
- Business data collection guide

**Sections Updated**:
- Socket.IO event reference
- Data models (field name changes)
- Complete example payload
- TypeScript type definitions

---

## ✅ Checklist for Developers

### Mobile App Developers

- [ ] Update `socket_io_client` to latest version
- [ ] Add `uuid` package for request IDs
- [ ] Update all `telemetry` references to `realtimeTelemetry`
- [ ] Implement `TelemetryQueryService` (optional)
- [ ] Add query event listeners
- [ ] Update data models
- [ ] Test real-time queries
- [ ] Test snapshot fallback
- [ ] Test timeout handling

### POS App Developers

- [ ] Update Socket.IO client to latest version
- [ ] Update all `telemetry` references to `realtimeTelemetry`
- [ ] Implement query request handler
- [ ] Implement `collectTelemetryData()` function
- [ ] Add query response emission
- [ ] Update business data collection
- [ ] Test query responses
- [ ] Test error handling
- [ ] Verify 10-second response time

---

## 🔗 Related Documentation

- [TELEMETRY_OPTIMIZATION_PLAN.md](./TELEMETRY_OPTIMIZATION_PLAN.md) - Overall optimization strategy
- [TELEMETRY_FIXES_SUMMARY.md](./TELEMETRY_FIXES_SUMMARY.md) - Memory leak fixes and cron migration
- [QUICK_DEPLOYMENT_GUIDE.md](./QUICK_DEPLOYMENT_GUIDE.md) - Deployment checklist
- [BUSINESS_DATA_ARCHITECTURE.md](./BUSINESS_DATA_ARCHITECTURE.md) - Business data structure
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing procedures

---

## 🆘 Support

### Common Issues

**Issue**: Query timeout
- **Solution**: Check POS is online and responding within 10 seconds

**Issue**: Field name errors
- **Solution**: Ensure all `telemetry` references are updated to `realtimeTelemetry`

**Issue**: Missing business data
- **Solution**: Verify POS is collecting `lastOrder`, `kpiSummary`, `expenses`

### Getting Help

1. Check the integration guides for detailed examples
2. Review the testing guide for troubleshooting steps
3. Check server logs for error messages
4. Use the HTML test files for debugging

---

**Status**: ✅ Ready for Implementation  
**Version**: 2.0.0  
**Last Updated**: April 15, 2026
