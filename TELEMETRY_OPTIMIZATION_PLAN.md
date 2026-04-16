# Telemetry Optimization Implementation Plan

## 🎯 Objective
Replace automatic snapshot-on-every-update with a hybrid approach:
- Real-time Socket.IO queries for live data
- Strategic daily snapshots for offline/historical access
- 99% reduction in storage costs

## 📋 Implementation Phases

### Phase 1: Remove Auto-Snapshots ✅
**Goal**: Stop creating snapshots on every telemetry update

**Tasks**:
1. Remove `createTelemetrySnapshot` call from `updateSeatTelemetry`
2. Keep the function for manual/scheduled use
3. Update service documentation

**Files Modified**:
- `src/api/key-seat/services/key-seat.ts`

**Impact**: Immediate 99% reduction in snapshot creation

---

### Phase 2: Socket.IO Real-time Query System 🔄
**Goal**: Enable mobile app to request telemetry data from POS device in real-time

#### 2.1 Socket.IO Events Architecture

**New Events**:
```typescript
// Mobile App → Server → POS Device
'seat:telemetry:request' {
  keySeatDocumentId: string
  filters: {
    startDate?: string
    endDate?: string
    dataTypes?: string[] // ['orders', 'inventory', 'sales']
  }
  requestId: string // For tracking response
}

// POS Device → Server → Mobile App
'seat:telemetry:response' {
  requestId: string
  keySeatDocumentId: string
  telemetryData: Record<string, any>
  timestamp: string
  success: boolean
  error?: string
}

// Server → Mobile App (timeout/error)
'seat:telemetry:error' {
  requestId: string
  keySeatDocumentId: string
  error: string
  fallbackAvailable: boolean
}
```

#### 2.2 Handler Implementation

**Files to Create**:
- `src/socketio/handlers/telemetry-request.handler.ts` - Main request handler
- `src/socketio/services/telemetry-query.service.ts` - Business logic

**Files to Modify**:
- `src/socketio/interfaces.ts` - Add new event types
- `src/index.ts` - Register new handlers

#### 2.3 Request Flow
```
Mobile App                Server                  POS Device
    |                       |                         |
    |--request telemetry--->|                         |
    |   (with filters)      |                         |
    |                       |--forward request------->|
    |                       |   (via socketId)        |
    |                       |                         |
    |                       |                         |--query local DB
    |                       |                         |
    |                       |<--send response---------|
    |<--forward response----|                         |
    |                       |                         |
    |                       |                         |
    [TIMEOUT: 10s]          |                         |
    |<--error + fallback----|                         |
```

---

### Phase 3: Daily Snapshot Scheduler 📅
**Goal**: Create one strategic snapshot per seat per day

#### 3.1 Cron Job Setup

**Files to Create**:
- `src/cron/jobs/daily-telemetry-snapshot.ts` - Cron job logic
- `src/cron/index.ts` - Cron registry

**Configuration**:
- Schedule: `0 2 * * *` (2 AM daily)
- Batch processing: 50 seats at a time
- Error handling: Log failures, continue processing

#### 3.2 Snapshot Strategy
- **When**: 2 AM server time (low traffic)
- **What**: Current `realtimeTelemetry` from each active seat
- **Type**: `snapshotType: 'daily'`
- **Retention**: Keep last 90 days (configurable)

**Files to Modify**:
- `src/index.ts` - Initialize cron jobs
- `src/api/key-seat/services/key-seat.ts` - Add batch snapshot method

---

### Phase 4: Fallback Logic 🔄
**Goal**: Gracefully handle offline POS devices

#### 4.1 Query Strategy
```typescript
async function getTelemetryData(keySeatDocumentId, filters) {
  // 1. Try real-time Socket.IO query (10s timeout)
  const realtimeData = await queryPOSDevice(keySeatDocumentId, filters);
  
  if (realtimeData.success) {
    return {
      source: 'realtime',
      data: realtimeData,
      timestamp: new Date()
    };
  }
  
  // 2. Fallback to last daily snapshot
  const snapshot = await getLatestSnapshot(keySeatDocumentId);
  
  return {
    source: 'snapshot',
    data: snapshot,
    timestamp: snapshot.capturedAt,
    warning: 'POS device offline - showing last snapshot'
  };
}
```

#### 4.2 Mobile App Response Format
```typescript
{
  success: boolean
  source: 'realtime' | 'snapshot' | 'unavailable'
  data: TelemetryData
  timestamp: string
  warning?: string
  snapshotAge?: number // hours since snapshot
}
```

---

### Phase 5: Cleanup & Retention 🧹
**Goal**: Manage historical snapshot storage

#### 5.1 Retention Policy
- Keep daily snapshots for 90 days
- Auto-delete older snapshots
- Configurable via environment variable

**Files to Create**:
- `src/cron/jobs/cleanup-old-snapshots.ts`

**Configuration**:
- Schedule: `0 3 * * 0` (3 AM every Sunday)
- Retention: `TELEMETRY_RETENTION_DAYS=90`

---

### Phase 6: API Endpoints 🔌
**Goal**: Provide REST endpoints for telemetry queries

**New Endpoints**:
```typescript
// Request real-time telemetry (triggers Socket.IO)
POST /api/key-seats/:documentId/telemetry/query
Body: {
  filters: {
    startDate?: string
    endDate?: string
    dataTypes?: string[]
  }
  waitForRealtime?: boolean // default: true
  timeout?: number // default: 10000ms
}

// Get latest snapshot (no Socket.IO)
GET /api/key-seats/:documentId/telemetry/latest

// Manual snapshot trigger (admin only)
POST /api/key-seats/:documentId/telemetry/snapshot
```

**Files to Modify**:
- `src/api/key-seat/controllers/key-seat.ts`
- `src/api/key-seat/routes/01-custom-routes.ts`

---

## 🔧 Technical Specifications

### Socket.IO Configuration
```typescript
{
  timeout: 10000, // 10 seconds
  retries: 1,
  acknowledgement: true
}
```

### Error Handling
- **POS Offline**: Return last snapshot with warning
- **Timeout**: Return last snapshot after 10s
- **No Snapshot**: Return error with guidance
- **Invalid Request**: Return 400 with validation errors

### Security
- Verify user owns the seat/license
- Validate Socket.IO room membership
- Rate limiting: 10 requests/minute per user

---

## 📊 Expected Outcomes

### Storage Reduction
- **Before**: ~100 snapshots/seat/day = 3,000/month
- **After**: 1 snapshot/seat/day = 30/month
- **Savings**: 99% reduction

### Performance
- **Real-time Query**: 500ms - 2s (when online)
- **Snapshot Fallback**: 100ms - 500ms
- **Daily Snapshot Job**: 5-10 minutes for 1000 seats

### User Experience
- Mobile app gets fresh data when POS online
- Graceful degradation when POS offline
- Clear indicators of data freshness

---

## 🧪 Testing Strategy

### Unit Tests
- Service methods (snapshot creation, queries)
- Cron job logic
- Fallback mechanisms

### Integration Tests
- Socket.IO event flow
- Timeout handling
- Fallback to snapshots

### Manual Testing
- Mobile app → POS real-time query
- POS offline scenario
- Daily snapshot creation
- Cleanup job execution

---

## 📝 Documentation Updates

**Files to Update**:
- `POS_INTEGRATION_GUIDE.md` - Add Socket.IO telemetry events
- `MOBILE_APP_INTEGRATION_GUIDE.md` - Add query API usage
- `BUSINESS_DATA_ARCHITECTURE.md` - Update telemetry flow
- Create: `TELEMETRY_QUERY_GUIDE.md` - Complete usage guide

---

## 🚀 Deployment Plan

### Phase 1 (Immediate)
1. Deploy auto-snapshot removal
2. Monitor storage reduction

### Phase 2 (Week 1)
1. Deploy Socket.IO handlers
2. Test with beta users
3. Monitor performance

### Phase 3 (Week 2)
1. Deploy daily snapshot cron
2. Deploy cleanup job
3. Full rollout

### Rollback Plan
- Keep `createTelemetrySnapshot` function
- Can re-enable auto-snapshots if needed
- Snapshots are additive (no data loss)

---

## 📦 Dependencies

**New Packages**: None (using existing Socket.IO, node-cron)

**Environment Variables**:
```env
TELEMETRY_RETENTION_DAYS=90
TELEMETRY_QUERY_TIMEOUT=10000
TELEMETRY_SNAPSHOT_SCHEDULE="0 2 * * *"
TELEMETRY_CLEANUP_SCHEDULE="0 3 * * 0"
```

---

## ✅ Success Criteria

1. ✅ 99% reduction in snapshot creation
2. ✅ Real-time queries work when POS online
3. ✅ Graceful fallback when POS offline
4. ✅ Daily snapshots created successfully
5. ✅ Old snapshots cleaned up automatically
6. ✅ No breaking changes to existing APIs
7. ✅ Complete documentation

---

## 🎯 Implementation Status

### ✅ Completed Phases
1. ✅ Phase 1: Remove auto-snapshots
2. ✅ Phase 2: Socket.IO handlers (real-time queries)
3. ✅ Phase 3: Daily snapshots (Strapi native cron)
4. ✅ Phase 4: Fallback logic (snapshot when offline)
5. ✅ Phase 5: Cleanup job (Strapi native cron)
6. ✅ Phase 6: API endpoints

### 🐛 Additional Fixes Applied
- ✅ Fixed memory leak in telemetry query handler
- ✅ Added disconnect cleanup for pending requests
- ✅ Migrated cron jobs to Strapi's native system
- ✅ Removed node-cron dependencies

### 📚 Documentation Created
- ✅ `TELEMETRY_FIXES_SUMMARY.md` - Detailed fix documentation
- ✅ `QUICK_DEPLOYMENT_GUIDE.md` - Deployment checklist
- ✅ Updated cron configuration in `config/cron-tasks.ts`

**Status**: ✅ Complete and Ready for Deployment
**Last Updated**: April 15, 2026
