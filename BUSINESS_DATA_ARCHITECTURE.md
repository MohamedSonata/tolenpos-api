# Business Data Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         POS Application                              │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ OrderRepository  │  │ExpenseRepository │  │  System Monitor  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘ │
│           │                     │                      │            │
│           └─────────────────────┴──────────────────────┘            │
│                                 │                                   │
│                    ┌────────────▼────────────┐                     │
│                    │ BusinessDataCollector   │                     │
│                    │  - collectLastOrder()   │                     │
│                    │  - collectKPISummary()  │                     │
│                    │  - collectExpenses()    │                     │
│                    └────────────┬────────────┘                     │
│                                 │                                   │
│                    ┌────────────▼────────────┐                     │
│                    │   TelemetryService      │                     │
│                    │  - collectTelemetry()   │                     │
│                    └────────────┬────────────┘                     │
│                                 │                                   │
│                    ┌────────────▼────────────┐                     │
│                    │   POSSocketService      │                     │
│                    │  - sendTelemetryUpdate()│                     │
│                    └────────────┬────────────┘                     │
└─────────────────────────────────┼────────────────────────────────┘
                                  │
                                  │ Socket.IO
                                  │ seat:update event
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│                      Strapi Backend                               │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Socket.IO Handler (seat-update.handler.ts)         │ │
│  │  - Receives telemetry payload                              │ │
│  │  - Logs business data presence                             │ │
│  │  - Validates authentication                                │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                       │
│  ┌────────────────────────▼───────────────────────────────────┐ │
│  │         Key-Seat Service (key-seat.service.ts)             │ │
│  │  - updateSeatTelemetry()                                   │ │
│  │  - createTelemetrySnapshot()                               │ │
│  └────────────┬───────────────────────┬───────────────────────┘ │
│               │                       │                           │
│  ┌────────────▼────────────┐  ┌──────▼──────────────────────┐   │
│  │   key-seat Collection   │  │ seat-telemetry-history      │   │
│  │  ┌──────────────────┐   │  │      Collection             │   │
│  │  │ telemetry (JSON) │   │  │  ┌──────────────────────┐   │   │
│  │  │  - networkStatus │   │  │  │ telemetryData (JSON) │   │   │
│  │  │  - lastSyncTime  │   │  │  │  - Complete snapshot │   │   │
│  │  │  - lastOrder     │   │  │  │  - capturedAt        │   │   │
│  │  │  - kpiSummary    │   │  │  │  - snapshotType      │   │   │
│  │  │  - expenses      │   │  │  └──────────────────────┘   │   │
│  │  │  - system info   │   │  │                              │   │
│  │  └──────────────────┘   │  └──────────────────────────────┘   │
│  │  (Current State)         │  (Historical Snapshots)             │
│  └──────────────────────────┘                                     │
│                           │                                        │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │         Notification Service                                │  │
│  │  - Finds subscribed mobile apps                            │  │
│  │  - Broadcasts seat:updated event                           │  │
│  └────────────────────────┬───────────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            │ Socket.IO
                            │ seat:updated event
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                    Mobile Applications                            │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Socket.IO Client                                   │ │
│  │  - Subscribes to seat updates                              │ │
│  │  - Receives real-time notifications                        │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                       │
│  ┌────────────────────────▼───────────────────────────────────┐ │
│  │         Dashboard UI                                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │ Last Order   │  │ KPI Summary  │  │   Expenses   │    │ │
│  │  │  - Receipt   │  │  - Sales     │  │  - Recent    │    │ │
│  │  │  - Total     │  │  - Trans     │  │  - Amounts   │    │ │
│  │  │  - Items     │  │  - Average   │  │  - Categories│    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

### 1. Transaction Completed in POS

```
User completes transaction
         ↓
OrderRepository.save(order)
         ↓
Trigger telemetry update
```

### 2. Business Data Collection

```
BusinessDataCollector
         ↓
┌────────┴────────┬────────────┐
│                 │            │
collectLastOrder  collectKPI   collectExpenses
│                 │            │
OrderRepository   Calculate    ExpenseRepository
│                 │            │
└────────┬────────┴────────────┘
         ↓
Return telemetry object
```

### 3. Telemetry Transmission

```
TelemetryService.collectTelemetry()
         ↓
{
  networkStatus: "online",
  lastSyncTime: "2024-01-15T10:30:45.123Z",
  lastOrder: { receiptNumber, total, ... },
  kpiSummary: { totalSales, transactionCount, ... },
  expenses: [ { id, title, amount, ... } ],
  osVersion: "Windows 10",
  cpuUsage: 45,
  ...
}
         ↓
POSSocketService.sendTelemetryUpdate()
         ↓
socket.emit('seat:update', { telemetry })
```

### 4. Backend Processing

```
Socket.IO receives 'seat:update'
         ↓
seat-update.handler.ts
         ↓
Log business data presence
         ↓
key-seat.service.ts
         ↓
┌────────┴────────┐
│                 │
Update            Create
key-seat          seat-telemetry-history
(current state)   (snapshot)
│                 │
└────────┬────────┘
         ↓
Broadcast to mobile apps
```

### 5. Mobile App Update

```
Socket.IO receives 'seat:updated'
         ↓
{
  machineUUID: "POS-001",
  telemetry: { lastOrder, kpiSummary, expenses, ... },
  isActive: true,
  updatedAt: "2024-01-15T10:30:45.123Z"
}
         ↓
Update Dashboard UI
         ↓
Display business metrics
```

## Data Structure Hierarchy

```
TelemetryData
├── Network Status
│   ├── networkStatus: "online" | "offline"
│   └── lastSyncTime: ISO 8601 string
│
├── Business Data (NEW)
│   ├── lastOrder: LastOrderData | null
│   │   ├── receiptNumber: string
│   │   ├── total: number
│   │   ├── itemCount: number
│   │   ├── paymentMethod: "card" | "cash" | "mobile"
│   │   ├── status: "completed" | "pending" | "cancelled"
│   │   ├── createdAt: ISO 8601 string
│   │   ├── items?: OrderItem[]
│   │   └── customer?: CustomerInfo
│   │
│   ├── kpiSummary: KPISummaryData | null
│   │   ├── totalSales: number
│   │   ├── transactionCount: number
│   │   ├── averageTransactionValue: number
│   │   ├── period: string
│   │   └── lastUpdated: ISO 8601 string
│   │
│   └── expenses: ExpenseData[]
│       └── [0..10]
│           ├── id: string
│           ├── title: string
│           ├── amount: number
│           ├── category: string
│           ├── paymentMethod: "card" | "cash"
│           ├── expenseDate: ISO 8601 string
│           └── isUrgent: boolean
│
└── System Information
    ├── osVersion?: string
    ├── appVersion?: string
    ├── cpuUsage?: number
    ├── memoryUsage?: number
    ├── diskSpace?: number
    ├── cashDrawerStatus?: "open" | "closed"
    └── printerStatus?: "online" | "offline" | "error"
```

## Storage Architecture

### Current State Storage (key-seat.telemetry)

```
┌─────────────────────────────────────────┐
│         key-seat Collection             │
├─────────────────────────────────────────┤
│ documentId: "seat-abc123"               │
│ machineUUID: "POS-001"                  │
│ isActive: true                          │
│ telemetry: {                            │
│   networkStatus: "online",              │
│   lastSyncTime: "2024-01-15T10:30:45Z", │
│   lastOrder: { ... },                   │
│   kpiSummary: { ... },                  │
│   expenses: [ ... ],                    │
│   osVersion: "Windows 10",              │
│   cpuUsage: 45,                         │
│   ...                                   │
│ }                                       │
│ updatedAt: "2024-01-15T10:30:45Z"       │
└─────────────────────────────────────────┘
         ↑
         │ Fast read access
         │ Always current
         │ Single record per seat
```

### Historical Storage (seat-telemetry-history)

```
┌─────────────────────────────────────────┐
│   seat-telemetry-history Collection     │
├─────────────────────────────────────────┤
│ Snapshot 1 (10:30:45)                   │
│ ├─ telemetryData: { complete data }    │
│ ├─ capturedAt: "2024-01-15T10:30:45Z"  │
│ └─ snapshotType: "realtime"            │
├─────────────────────────────────────────┤
│ Snapshot 2 (10:31:45)                   │
│ ├─ telemetryData: { complete data }    │
│ ├─ capturedAt: "2024-01-15T10:31:45Z"  │
│ └─ snapshotType: "realtime"            │
├─────────────────────────────────────────┤
│ Snapshot 3 (10:32:45)                   │
│ ├─ telemetryData: { complete data }    │
│ ├─ capturedAt: "2024-01-15T10:32:45Z"  │
│ └─ snapshotType: "realtime"            │
└─────────────────────────────────────────┘
         ↑
         │ Historical analysis
         │ Trend tracking
         │ Multiple records per seat
```

## Error Handling Flow

```
POS App
  ↓
Try collect lastOrder
  ├─ Success → Include in telemetry
  └─ Error → Set to null, log error
  ↓
Try collect kpiSummary
  ├─ Success → Include in telemetry
  └─ Error → Set to null, log error
  ↓
Try collect expenses
  ├─ Success → Include in telemetry
  └─ Error → Set to [], log error
  ↓
Try collect system info
  ├─ Success → Include in telemetry
  └─ Error → Skip field, log error
  ↓
Send telemetry (with available data)
  ↓
Backend
  ↓
Accept any valid JSON
  ↓
Store complete payload
  ↓
Log what was received
  ↓
Broadcast to mobile apps
```

## Performance Considerations

### POS Side

```
Parallel Collection (Fast)
┌─────────────────────────┐
│ Promise.all([           │
│   collectLastOrder(),   │ ← Database query
│   collectKPISummary(),  │ ← Calculation
│   collectExpenses()     │ ← Database query
│ ])                      │
└─────────────────────────┘
         ↓
    ~100-200ms
         ↓
Send to backend
```

### Backend Side

```
Receive telemetry
         ↓
Update key-seat (~50ms)
         ↓
Create snapshot (async, non-blocking)
         ↓
Broadcast to mobile apps (~10ms)
         ↓
Total: ~60ms
```

## Monitoring Points

### 1. POS Application
- Data collection success rate
- Collection time per field
- Telemetry send frequency
- Network connectivity

### 2. Backend
- Business data presence rate
- Field completeness
- Update frequency per seat
- Snapshot creation rate

### 3. Mobile Application
- Update reception rate
- UI render time
- Data freshness
- User engagement

## Security & Privacy

```
POS App
  ↓
  Authenticated via license key
  ↓
  Can only update own seat
  ↓
Backend
  ↓
  Validates ownership
  ↓
  Stores in isolated seat record
  ↓
  Broadcasts only to owner's mobile apps
  ↓
Mobile App
  ↓
  Authenticated via JWT
  ↓
  Can only view own seats
  ↓
  Receives only own business data
```

## Scalability

### Horizontal Scaling

```
Multiple POS Machines
├─ POS-001 → Backend → Mobile App 1
├─ POS-002 → Backend → Mobile App 1
├─ POS-003 → Backend → Mobile App 2
└─ POS-004 → Backend → Mobile App 2

Each seat operates independently
No cross-contamination
Parallel processing
```

### Data Volume

```
Per Seat:
- Current state: ~5KB (single record)
- Snapshots: ~5KB × updates per day
- Example: 1440 updates/day = ~7MB/day/seat

Per Store (10 seats):
- Current state: ~50KB
- Daily snapshots: ~70MB/day
- Monthly: ~2.1GB/month

Retention policy recommended:
- Keep snapshots for 90 days
- Archive older data
```

## Related Documentation

- [TELEMETRY_DATA_STRUCTURE.md](./TELEMETRY_DATA_STRUCTURE.md) - Field specifications
- [BUSINESS_DATA_IMPLEMENTATION_SUMMARY.md](./BUSINESS_DATA_IMPLEMENTATION_SUMMARY.md) - Implementation guide
- [BUSINESS_DATA_QUICK_REFERENCE.md](./BUSINESS_DATA_QUICK_REFERENCE.md) - Quick reference
- [POS_INTEGRATION_GUIDE.md](./POS_INTEGRATION_GUIDE.md) - POS integration
- [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) - Completion summary
