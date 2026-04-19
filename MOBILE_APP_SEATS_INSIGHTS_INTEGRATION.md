# Mobile App Integration Guide: License Seats Real-Time Insights API

## Overview

This endpoint provides real-time aggregated insights for all POS seats (devices) associated with a license. It's designed for mobile apps to display comprehensive analytics across multiple POS locations/devices.

---

## API Endpoint

**Method:** `GET`  
**URL:** `/api/licenses/:documentId/seats-insights`  
**Authentication:** Required (Bearer token)

---

## Request Specification

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | ✅ Yes | The license document ID (not the license key) |

### Headers

```http
GET /api/licenses/abc123xyz/seats-insights HTTP/1.1
Host: your-backend-domain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

### Example Request (JavaScript/TypeScript)

```typescript
const licenseDocumentId = 'abc123xyz'; // Get this from user's license data

const response = await fetch(
  `https://your-backend-domain.com/api/licenses/${licenseDocumentId}/seats-insights`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${userJwtToken}`,
      'Content-Type': 'application/json',
    },
  }
);

const result = await response.json();
```

### Example Request (React Native with Axios)

```typescript
import axios from 'axios';

const fetchSeatsInsights = async (licenseDocumentId: string) => {
  try {
    const response = await axios.get(
      `/api/licenses/${licenseDocumentId}/seats-insights`,
      {
        headers: {
          Authorization: `Bearer ${userJwtToken}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to fetch seats insights:', error);
    throw error;
  }
};
```

---

## Response Specification

### Success Response (200 OK)

```json
{
  "data": {
    "licenseDocumentId": "abc123xyz",
    "licenseKey": "ENCRYPTED_LICENSE_KEY_STRING",
    "maxSeats": 5,
    "activeSeatsCount": 3,
    "connectedSeatsCount": 2,
    "totalSeatsCount": 4,
    "aggregatedKPIs": {
      "totalSales": 1250.75,
      "totalTransactions": 87,
      "totalExpenses": 320.50,
      "averageTransactionValue": 14.38,
      "period": "today"
    },
    "seats": [
      {
        "seatId": "seat_doc_id_1",
        "machineUUID": "550e8400-e29b-41d4-a716-446655440000",
        "isActive": true,
        "isConnected": true,
        "timezone": "Asia/Singapore",
        "networkStatus": "online",
        "lastSyncTime": "2026-04-19T13:58:54.883Z",
        "lastOrder": {
          "receiptNumber": "RCP-20260419-T01-002",
          "total": 45.50,
          "itemCount": 3,
          "paymentMethod": "CASH",
          "status": "COMPLETED",
          "createdAt": "2026-04-19T13:58:54.000Z",
          "items": [
            {
              "productName": "Coffee Latte",
              "quantity": 2,
              "price": 15.00
            },
            {
              "productName": "Croissant",
              "quantity": 1,
              "price": 15.50
            }
          ]
        },
        "kpiSummary": {
          "totalSales": 650.25,
          "transactionCount": 45,
          "averageTransactionValue": 14.45,
          "period": "today",
          "lastUpdated": "2026-04-19T13:58:54.942Z"
        },
        "expenses": [
          {
            "id": "ab4d6b4c-5a6d-4504-b5c8-d16f1e99c2bb",
            "title": "Kitchen Supplies",
            "amount": 120.00,
            "category": "KITCHEN_SUPPLIES",
            "paymentMethod": "CASH",
            "expenseDate": "2026-04-19T13:58:41.000Z",
            "isUrgent": false
          }
        ],
        "lastUpdated": "2026-04-19T13:58:55.090Z"
      },
      {
        "seatId": "seat_doc_id_2",
        "machineUUID": "660e8400-e29b-41d4-a716-446655440001",
        "isActive": true,
        "isConnected": false,
        "timezone": "America/New_York",
        "networkStatus": "offline",
        "lastSyncTime": "2026-04-19T10:30:00.000Z",
        "lastOrder": null,
        "kpiSummary": {
          "totalSales": 600.50,
          "transactionCount": 42,
          "averageTransactionValue": 14.30,
          "period": "today",
          "lastUpdated": "2026-04-19T10:30:00.000Z"
        },
        "expenses": [],
        "lastUpdated": "2026-04-19T10:30:00.000Z"
      }
    ],
    "generatedAt": "2026-04-19T14:00:00.000Z"
  }
}
```

### Response Fields Explanation

#### Root Level (`data` object)

| Field | Type | Description |
|-------|------|-------------|
| `licenseDocumentId` | string | Unique identifier for the license |
| `licenseKey` | string | Encrypted license key (for reference) |
| `maxSeats` | number | Maximum allowed seats for this license |
| `activeSeatsCount` | number | Number of currently active seats |
| `connectedSeatsCount` | number | Number of seats currently online/connected |
| `totalSeatsCount` | number | Total number of seats ever created for this license |
| `aggregatedKPIs` | object | Combined KPIs across all seats |
| `seats` | array | Individual seat details with telemetry |
| `generatedAt` | string (ISO 8601) | Timestamp when insights were generated |

#### Aggregated KPIs Object

| Field | Type | Description |
|-------|------|-------------|
| `totalSales` | number | Sum of sales from all seats (2 decimal places) |
| `totalTransactions` | number | Total number of transactions across all seats |
| `totalExpenses` | number | Sum of expenses from all seats (2 decimal places) |
| `averageTransactionValue` | number | Average transaction value across all seats |
| `period` | string | Time period for the data (typically "today") |

#### Seat Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `seatId` | string | No | Unique document ID for the seat |
| `machineUUID` | string | No | Unique identifier for the POS device |
| `isActive` | boolean | No | Whether the seat is activated |
| `isConnected` | boolean | No | Whether the POS device is currently online |
| `timezone` | string | No | IANA timezone (e.g., "Asia/Singapore") |
| `networkStatus` | string | Yes | "online" or "offline" (may be null) |
| `lastSyncTime` | string (ISO 8601) | Yes | Last time POS synced data |
| `lastOrder` | object | Yes | Most recent order details (null if no orders) |
| `kpiSummary` | object | Yes | KPIs for this specific seat |
| `expenses` | array | Yes | List of expenses recorded on this seat |
| `lastUpdated` | string (ISO 8601) | Yes | Last telemetry update timestamp |

#### Last Order Object (when present)

| Field | Type | Description |
|-------|------|-------------|
| `receiptNumber` | string | Unique receipt identifier |
| `total` | number | Total order amount |
| `itemCount` | number | Number of items in the order |
| `paymentMethod` | string | Payment method used (e.g., "CASH", "CARD") |
| `status` | string | Order status (e.g., "COMPLETED") |
| `createdAt` | string (ISO 8601) | Order creation timestamp |
| `items` | array | List of order items |

#### Order Item Object

| Field | Type | Description |
|-------|------|-------------|
| `productName` | string | Name of the product |
| `quantity` | number | Quantity ordered |
| `price` | number | Price per unit |

#### KPI Summary Object (per seat)

| Field | Type | Description |
|-------|------|-------------|
| `totalSales` | number | Total sales for this seat |
| `transactionCount` | number | Number of transactions for this seat |
| `averageTransactionValue` | number | Average transaction value for this seat |
| `period` | string | Time period (typically "today") |
| `lastUpdated` | string (ISO 8601) | When KPIs were last calculated |

#### Expense Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique expense identifier (UUID) |
| `title` | string | Expense description |
| `amount` | number | Expense amount |
| `category` | string | Expense category (e.g., "KITCHEN_SUPPLIES") |
| `paymentMethod` | string | Payment method used |
| `expenseDate` | string (ISO 8601) | When expense occurred |
| `isUrgent` | boolean | Whether expense is marked urgent |

---

## Error Responses

### 400 Bad Request - Missing Document ID

```json
{
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "License documentId is required"
  }
}
```

**Cause:** The `documentId` parameter is missing or empty in the URL.

**Mobile App Action:** Validate that you have a valid license document ID before making the request.

---

### 401 Unauthorized - Missing or Invalid Token

```json
{
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Missing or invalid credentials"
  }
}
```

**Cause:** JWT token is missing, expired, or invalid.

**Mobile App Action:** 
- Check if user is logged in
- Refresh the JWT token if expired
- Redirect to login if token refresh fails

---

### 404 Not Found - License Not Found

```json
{
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "License not found"
  }
}
```

**Cause:** The provided `documentId` doesn't exist or user doesn't have access to it.

**Mobile App Action:**
- Verify the license document ID is correct
- Check if the license was deleted
- Show user-friendly error message

---

### 500 Internal Server Error

```json
{
  "error": {
    "status": 500,
    "name": "InternalServerError",
    "message": "Failed to generate insights"
  }
}
```

**Cause:** Server-side error during data processing.

**Mobile App Action:**
- Retry the request after a delay (exponential backoff)
- Show generic error message to user
- Log error for debugging

---

## Edge Cases & Handling

### 1. License with No Seats

**Scenario:** License exists but has no seats activated yet.

**Response:**
```json
{
  "data": {
    "licenseDocumentId": "abc123xyz",
    "licenseKey": "ENCRYPTED_KEY",
    "maxSeats": 5,
    "activeSeatsCount": 0,
    "connectedSeatsCount": 0,
    "totalSeatsCount": 0,
    "aggregatedKPIs": {
      "totalSales": 0,
      "totalTransactions": 0,
      "totalExpenses": 0,
      "averageTransactionValue": 0,
      "period": "today"
    },
    "seats": [],
    "generatedAt": "2026-04-19T14:00:00.000Z"
  }
}
```

**Mobile App Handling:**
- Display empty state UI
- Show message: "No POS devices activated yet"
- Provide CTA to activate first device

---

### 2. All Seats Offline

**Scenario:** All seats are active but currently disconnected.

**Response Characteristics:**
- `connectedSeatsCount: 0`
- All seats have `isConnected: false`
- `networkStatus: "offline"` for all seats
- `lastSyncTime` shows old timestamps

**Mobile App Handling:**
- Show warning banner: "All devices are offline"
- Display last known data with timestamp
- Add "Last updated" indicator for each seat
- Disable real-time features

---

### 3. Seat with No Telemetry Data

**Scenario:** Seat is activated but hasn't sent any telemetry yet.

**Response for that seat:**
```json
{
  "seatId": "seat_doc_id",
  "machineUUID": "uuid",
  "isActive": true,
  "isConnected": false,
  "timezone": "UTC",
  "networkStatus": null,
  "lastSyncTime": null,
  "lastOrder": null,
  "kpiSummary": null,
  "expenses": null,
  "lastUpdated": null
}
```

**Mobile App Handling:**
- Show "Waiting for data..." state
- Display seat as "Pending first sync"
- Don't include in aggregated calculations

---

### 4. Partial Data (Some Fields Missing)

**Scenario:** POS device sent incomplete telemetry data.

**Mobile App Handling:**
- Use optional chaining: `seat.kpiSummary?.totalSales ?? 0`
- Provide default values for missing fields
- Don't crash if expected fields are null/undefined

**Example TypeScript Interface:**

```typescript
interface SeatInsight {
  seatId: string;
  machineUUID: string;
  isActive: boolean;
  isConnected: boolean;
  timezone: string;
  networkStatus?: string | null;
  lastSyncTime?: string | null;
  lastOrder?: LastOrder | null;
  kpiSummary?: KPISummary | null;
  expenses?: Expense[] | null;
  lastUpdated?: string | null;
}
```

---

### 5. Large Number of Seats

**Scenario:** License has many seats (e.g., 50+ devices).

**Considerations:**
- Response payload can be large (100KB+)
- Parsing may take time on low-end devices

**Mobile App Handling:**
- Show loading indicator during fetch
- Consider pagination or filtering in future API versions
- Cache response data locally
- Implement pull-to-refresh for updates

---

### 6. Timezone Differences

**Scenario:** Seats are in different timezones.

**Mobile App Handling:**
- Display times in seat's local timezone
- Use timezone-aware date libraries (e.g., `date-fns-tz`, `luxon`)
- Show timezone indicator next to timestamps
- Convert to user's timezone if needed

**Example (JavaScript):**

```javascript
import { formatInTimeZone } from 'date-fns-tz';

const displayTime = formatInTimeZone(
  seat.lastSyncTime,
  seat.timezone,
  'yyyy-MM-dd HH:mm:ss zzz'
);
// Output: "2026-04-19 13:58:54 SGT"
```

---

## Mobile App Implementation Checklist

### Pre-Request
- [ ] User is authenticated (valid JWT token)
- [ ] License document ID is available
- [ ] Network connectivity check
- [ ] Show loading state

### Request Handling
- [ ] Set proper headers (Authorization, Content-Type)
- [ ] Implement timeout (e.g., 30 seconds)
- [ ] Handle network errors gracefully

### Response Processing
- [ ] Validate response structure
- [ ] Handle null/undefined fields safely
- [ ] Parse dates correctly
- [ ] Calculate derived metrics if needed

### Error Handling
- [ ] 400: Show validation error message
- [ ] 401: Trigger re-authentication flow
- [ ] 404: Show "License not found" message
- [ ] 500: Retry with exponential backoff
- [ ] Network error: Show offline message

### UI/UX
- [ ] Display aggregated KPIs prominently
- [ ] Show individual seat cards/list
- [ ] Indicate online/offline status clearly
- [ ] Show last update timestamp
- [ ] Implement pull-to-refresh
- [ ] Handle empty states
- [ ] Show loading skeletons

### Performance
- [ ] Cache response data
- [ ] Implement data refresh strategy
- [ ] Optimize re-renders (React: useMemo, useCallback)
- [ ] Lazy load seat details if many seats

---

## Example Mobile App Implementation (React Native)

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import axios from 'axios';

interface SeatsInsightsData {
  licenseDocumentId: string;
  maxSeats: number;
  activeSeatsCount: number;
  connectedSeatsCount: number;
  totalSeatsCount: number;
  aggregatedKPIs: {
    totalSales: number;
    totalTransactions: number;
    totalExpenses: number;
    averageTransactionValue: number;
    period: string;
  };
  seats: any[];
  generatedAt: string;
}

const SeatsInsightsScreen = ({ licenseDocumentId, authToken }) => {
  const [data, setData] = useState<SeatsInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInsights = async () => {
    try {
      setError(null);
      const response = await axios.get(
        `/api/licenses/${licenseDocumentId}/seats-insights`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 30000,
        }
      );
      setData(response.data.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
        // Trigger re-authentication
      } else if (err.response?.status === 404) {
        setError('License not found.');
      } else if (err.code === 'ECONNABORTED') {
        setError('Request timeout. Please try again.');
      } else {
        setError('Failed to load insights. Please try again.');
      }
      console.error('Fetch insights error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [licenseDocumentId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInsights();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Loading insights...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red' }}>{error}</Text>
        <Button title="Retry" onPress={fetchInsights} />
      </View>
    );
  }

  if (!data || data.seats.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>No POS devices activated yet</Text>
        <Text>Activate your first device to see insights</Text>
      </View>
    );
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Aggregated KPIs */}
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
          Total Sales: ${data.aggregatedKPIs.totalSales.toFixed(2)}
        </Text>
        <Text>Transactions: {data.aggregatedKPIs.totalTransactions}</Text>
        <Text>Expenses: ${data.aggregatedKPIs.totalExpenses.toFixed(2)}</Text>
        <Text>
          Avg Transaction: ${data.aggregatedKPIs.averageTransactionValue.toFixed(2)}
        </Text>
        <Text style={{ marginTop: 8, color: 'gray' }}>
          {data.connectedSeatsCount} of {data.activeSeatsCount} devices online
        </Text>
      </View>

      {/* Individual Seats */}
      {data.seats.map((seat) => (
        <View key={seat.seatId} style={{ padding: 16, borderBottomWidth: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold' }}>{seat.machineUUID}</Text>
            <Text style={{ color: seat.isConnected ? 'green' : 'red' }}>
              {seat.isConnected ? '● Online' : '● Offline'}
            </Text>
          </View>
          
          {seat.kpiSummary && (
            <View style={{ marginTop: 8 }}>
              <Text>Sales: ${seat.kpiSummary.totalSales.toFixed(2)}</Text>
              <Text>Transactions: {seat.kpiSummary.transactionCount}</Text>
            </View>
          )}

          {seat.lastOrder && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontStyle: 'italic' }}>
                Last Order: {seat.lastOrder.receiptNumber} - $
                {seat.lastOrder.total.toFixed(2)}
              </Text>
            </View>
          )}

          {seat.lastUpdated && (
            <Text style={{ marginTop: 4, fontSize: 12, color: 'gray' }}>
              Last updated: {new Date(seat.lastUpdated).toLocaleString()}
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

export default SeatsInsightsScreen;
```

---

## Testing Recommendations

### Unit Tests
- Test response parsing with complete data
- Test response parsing with missing/null fields
- Test error handling for each status code
- Test timezone conversions

### Integration Tests
- Test with real API endpoint
- Test with expired JWT token
- Test with invalid license document ID
- Test with slow network (timeout scenarios)

### Manual Testing Scenarios
1. Fresh license with no seats
2. License with 1 active, connected seat
3. License with multiple seats (some online, some offline)
4. License with seats in different timezones
5. Offline mode (no network)
6. Slow network (3G simulation)

---

## Performance Optimization Tips

1. **Caching:** Cache response for 30-60 seconds to avoid excessive API calls
2. **Debouncing:** If user can trigger refresh, debounce the action
3. **Pagination:** For licenses with 50+ seats, consider requesting paginated data
4. **Selective Updates:** Use WebSocket/Socket.IO for real-time updates instead of polling
5. **Background Refresh:** Fetch data in background when app comes to foreground

---

## Security Considerations

1. **Never log sensitive data:** Don't log license keys or full telemetry in production
2. **Validate JWT expiry:** Check token expiry before making request
3. **HTTPS only:** Ensure all API calls use HTTPS
4. **Store tokens securely:** Use secure storage (Keychain/Keystore) for JWT tokens
5. **Handle token refresh:** Implement automatic token refresh flow

---

## Support & Troubleshooting

### Common Issues

**Issue:** "License not found" error  
**Solution:** Verify you're using the license `documentId`, not the `licenseKey`

**Issue:** Empty seats array despite having activated devices  
**Solution:** Check if seats are marked as `isActive: true` in the database

**Issue:** Stale data showing  
**Solution:** Ensure POS devices are sending telemetry updates via Socket.IO

**Issue:** Timezone display incorrect  
**Solution:** Use the `timezone` field from each seat for proper conversion

---

## API Versioning

**Current Version:** v1 (implicit)  
**Endpoint Stability:** Stable  
**Breaking Changes:** Will be communicated via API changelog

---

## Related Endpoints

- `POST /api/licenses/activate` - Activate a license on a POS device
- `GET /api/licenses/:documentId` - Get license details
- `GET /api/key-seats/:documentId` - Get individual seat details
- `GET /api/seat-telemetry-history` - Get historical telemetry snapshots

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-19 | 1.0.0 | Initial release of seats insights endpoint |

---

## Contact

For API issues or questions, contact the backend team or refer to the main API documentation.
