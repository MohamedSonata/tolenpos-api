# Mobile App Insights - Simple Data Flow Diagram

## Overview
This diagram shows the simplest flow for fetching POS license insights in the mobile app.

---

## Data Model Hierarchy

```
User (You)
  ├── Plan Type: FreeTrial | Pro | Enterprise
  ├── Subscription Plan (features, limits, pricing)
  └── Licenses (Your POS Licenses)
        ├── License Key (encrypted)
        ├── Max Seats (limit)
        ├── Expiration Date
        ├── Status (active/inactive)
        └── Seats (Active POS Devices)
              ├── Machine UUID
              ├── Connection Status (online/offline)
              ├── Timezone
              ├── Real-time Telemetry (live data)
              └── Telemetry History (daily snapshots)
```

---

## Mobile App Screen Flow

### 1. Dashboard (Home Screen)
**Single API Call**: `GET /api/users/me?populate=deep`

```
┌─────────────────────────────────┐
│      📱 Dashboard               │
├─────────────────────────────────┤
│ Welcome, [Username]             │
│ Plan: Pro (Upgrade ↗)           │
│                                 │
│ 📊 Quick Stats                  │
│ ┌─────────┬─────────┬─────────┐│
│ │ 3/5     │ 2 Online│ 1 Alert ││
│ │ Seats   │ Devices │         ││
│ └─────────┴─────────┴─────────┘│
│                                 │
│ 🔑 Your Licenses (3)            │
│ ├─ License #1 → [Tap for seats]│
│ ├─ License #2 → [Tap for seats]│
│ └─ License #3 → [Tap for seats]│
└─────────────────────────────────┘
```

**Data Fetched**:
- User info (username, email, planType)
- Subscription plan (features, maxSeats)
- All licenses with seat counts
- Active/inactive status

---

### 2. License Details Screen
**Single API Call**: `GET /api/licenses/:id?populate[seats][populate]=telemetryHistory`

```
┌─────────────────────────────────┐
│  ← License #ABC123              │
├─────────────────────────────────┤
│ Status: ✅ Active               │
│ Expires: Dec 31, 2026           │
│ Seats: 3/5 used                 │
│                                 │
│ 💻 Active Devices               │
│                                 │
│ ┌─────────────────────────────┐│
│ │ 🟢 POS-001 (Main Store)     ││
│ │ Last seen: 2 mins ago       ││
│ │ [View Details →]            ││
│ └─────────────────────────────┘│
│                                 │
│ ┌─────────────────────────────┐│
│ │ 🟢 POS-002 (Branch A)       ││
│ │ Last seen: 5 mins ago       ││
│ │ [View Details →]            ││
│ └─────────────────────────────┘│
│                                 │
│ ┌─────────────────────────────┐│
│ │ 🔴 POS-003 (Branch B)       ││
│ │ Last seen: 2 hours ago      ││
│ │ [View Details →]            ││
│ └─────────────────────────────┘│
└─────────────────────────────────┘
```

**Data Fetched**:
- License details (key, maxSeats, expiresAt, isActive)
- All seats with connection status
- Last seen timestamps (from telemetry)

---

### 3. Seat Details Screen (Real-time + Historical)
**Two Data Sources**:
1. **REST API**: `GET /api/key-seats/:id?populate=telemetryHistory`
2. **Socket.IO**: Subscribe to `seat:updated` events

```
┌─────────────────────────────────┐
│  ← POS-001 (Main Store)         │
├─────────────────────────────────┤
│ Status: 🟢 Online               │
│ Machine: UUID-12345             │
│ Timezone: America/New_York      │
│                                 │
│ 📊 Real-time Telemetry          │
│ ┌─────────────────────────────┐│
│ │ Sales Today: $1,234.56      ││
│ │ Transactions: 45            ││
│ │ App Version: 2.1.0          ││
│ │ OS: Windows 11              ││
│ │ Last Updated: Just now 🔄   ││
│ └─────────────────────────────┘│
│                                 │
│ 📈 Historical Insights (7 days) │
│ ┌─────────────────────────────┐│
│ │     Sales Trend             ││
│ │  $  ┌─┐                     ││
│ │     │ │  ┌─┐                ││
│ │  ┌─┐│ │┌─┘ └─┐              ││
│ │  └─┘└─┘└─────┘              ││
│ │  Mon Tue Wed Thu Fri        ││
│ └─────────────────────────────┘│
│                                 │
│ [View Full History →]           │
└─────────────────────────────────┘
```

**Data Fetched**:
- Seat info (machineUUID, isActive, timezone)
- Real-time telemetry (live data via Socket.IO)
- Telemetry history (daily snapshots for charts)
- Historical KPI summary

---

## API Endpoints Summary

### REST API (Initial Data Load)

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `GET /api/users/me?populate=deep` | Dashboard data | User + licenses + seat counts |
| `GET /api/licenses/:id?populate[seats]=true` | License details | License + all seats |
| `GET /api/key-seats/:id?populate=telemetryHistory` | Seat details + history | Seat + telemetry snapshots |
| `GET /api/subscription-plans/:id` | Plan features | Features, limits, pricing |

### Socket.IO (Real-time Updates)

| Event | Direction | Purpose |
|-------|-----------|---------|
| `seat:subscribe` | Mobile → Server | Subscribe to license updates |
| `seat:subscribe:success` | Server → Mobile | Subscription confirmed |
| `seat:updated` | Server → Mobile | Real-time seat telemetry |
| `seat:unsubscribe` | Mobile → Server | Stop receiving updates |

---

## Simple 3-Step Data Fetching Strategy

### Step 1: Login & Dashboard
```typescript
// Single call gets everything for dashboard
const user = await api.get('/api/users/me', {
  params: {
    populate: {
      licenses: {
        populate: ['seats']
      },
      subscriptionPlan: true
    }
  }
});

// Display:
// - User plan type
// - Total licenses
// - Total seats (active/inactive)
// - Quick stats
```

### Step 2: License Details
```typescript
// When user taps a license
const license = await api.get(`/api/licenses/${licenseId}`, {
  params: {
    populate: {
      seats: {
        fields: ['machineUUID', 'isActive', 'isConnected', 'timezone'],
        populate: ['telemetry']
      }
    }
  }
});

// Display:
// - License status
// - Expiration date
// - List of seats with online/offline status
```

### Step 3: Seat Details + Real-time
```typescript
// REST API for initial data
const seat = await api.get(`/api/key-seats/${seatId}`, {
  params: {
    populate: {
      telemetryHistory: {
        filters: {
          snapshotType: 'daily',
          capturedAt: { $gte: sevenDaysAgo }
        },
        sort: 'capturedAt:desc'
      }
    }
  }
});

// Socket.IO for live updates
socket.emit('seat:subscribe', { licenseKey: license.licenseKey });
socket.on('seat:updated', (data) => {
  // Update UI with real-time telemetry
  updateRealtimeTelemetry(data);
});

// Display:
// - Real-time telemetry (live)
// - Historical charts (7-day trend)
// - KPI summaries
```

---

## Key Telemetry Fields

### Real-time Telemetry (Live Data)
```json
{
  "realtimeTelemetry": {
    "salesToday": 1234.56,
    "transactionsCount": 45,
    "appVersion": "2.1.0",
    "osInfo": "Windows 11",
    "lastSeen": "2024-04-28T10:30:00Z",
    "isOnline": true
  }
}
```

### Historical Telemetry (Daily Snapshots)
```json
{
  "telemetryData": {
    "date": "2024-04-27",
    "totalSales": 2500.00,
    "totalTransactions": 120,
    "averageTicket": 20.83,
    "peakHour": "14:00"
  },
  "historicalKpiSummary": {
    "weeklyGrowth": "+12%",
    "monthlyRevenue": 45000.00
  }
}
```

---

## Mobile App Features Checklist

### Essential Features (MVP)
- [ ] User authentication (JWT)
- [ ] Dashboard with license overview
- [ ] License details with seat list
- [ ] Seat details with real-time telemetry
- [ ] Socket.IO connection for live updates
- [ ] Push notifications (FCM) for alerts

### Nice-to-Have Features
- [ ] Historical charts (7-day, 30-day trends)
- [ ] Seat activation/deactivation
- [ ] License renewal reminders
- [ ] Export reports (PDF/CSV)
- [ ] Multi-language support
- [ ] Dark mode

---

## Performance Tips

1. **Lazy Loading**: Load telemetry history only when user opens seat details
2. **Caching**: Cache dashboard data for 5 minutes
3. **Pagination**: Limit telemetry history to last 30 days by default
4. **Socket.IO**: Only subscribe to licenses user is viewing
5. **Offline Mode**: Store last fetched data locally

---

## Security Considerations

- Use JWT tokens for authentication
- Never display raw license keys (show masked: `ABC***123`)
- Validate user owns the license before showing data
- Use HTTPS for all API calls
- Implement rate limiting on API endpoints

---

## Summary

This diagram provides a simple 3-screen flow:
1. **Dashboard** → Overview of all licenses
2. **License Details** → List of seats per license
3. **Seat Details** → Real-time + historical telemetry

Each screen requires only 1-2 API calls, making it fast and user-friendly.
