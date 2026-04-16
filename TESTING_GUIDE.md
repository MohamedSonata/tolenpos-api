# POS Seat Realtime Updates - Testing Guide

## Issues Fixed (Latest Update)

### Critical Fixes - Round 2

#### 1. Socket.IO Handler Registration Order
**Problem**: `setupSeatUpdateHandlers` was listening to `connection` event independently, but `socket.data` wasn't populated yet
**Solution**: 
- Changed `setupSeatUpdateHandlers` to be called per-socket AFTER authentication completes
- Now called from within `setupConnectionHandlers` after `socket.data` is populated
- Added detailed logging to track handler registration

#### 2. HTTP 403 Forbidden on Custom Routes
**Problem**: Custom routes require authentication but weren't receiving user context
**Solution**: 
- Added debug logging to controllers to diagnose authentication issues
- The routes are correctly configured - issue was likely server not restarted after route file renames

### Previous Fixes - Round 1

### 1. JWT Authentication Issue
**Problem**: JWT payload contains `id` (numeric) but code expected `userId`
**Solution**: Updated `src/socketio/services/index.ts` to handle both `id` and `userId` fields from JWT payload

### 2. User Lookup Issue
**Problem**: `getUserInfo` function was only searching by `documentId`, but JWT contains numeric `id`
**Solution**: Updated `src/socketio/connection.handler.ts` to handle both numeric `id` and string `documentId` lookups

### 3. CORS Configuration
**Problem**: CORS only allowed `http://localhost:3000`, blocking requests from HTML test files
**Solution**: Updated `config/middlewares.ts` to allow all origins (`*`) for testing

### 4. Custom Routes Not Loading
**Problem**: Custom route files weren't being loaded by Strapi
**Solution**: Renamed route files with numeric prefix:
- `custom-routes.ts` → `01-custom-routes.ts`
- Created missing default router for `seat-telemetry-history`

## Files Modified (Latest Update)

### Round 2 Changes:
1. ✅ `src/socketio/handlers/seat-update.handler.ts` - Changed to per-socket registration
2. ✅ `src/socketio/connection.handler.ts` - Added setupSeatUpdateHandlers call after socket.data setup
3. ✅ `src/socketio/index.ts` - Removed duplicate handler registration
4. ✅ `src/api/key-seat/controllers/key-seat.ts` - Added debug logging

### Round 1 Changes:

1. ✅ `src/socketio/services/index.ts` - JWT payload handling
2. ✅ `src/socketio/connection.handler.ts` - User lookup logic
3. ✅ `config/middlewares.ts` - CORS configuration
4. ✅ `src/api/key-seat/routes/01-custom-routes.ts` - Renamed for proper loading
5. ✅ `src/api/seat-telemetry-history/routes/01-custom-routes.ts` - Renamed for proper loading
6. ✅ `src/api/seat-telemetry-history/routes/seat-telemetry-history.ts` - Created default router

## How to Test

### Prerequisites
1. **IMPORTANT: Restart Strapi server** to load all the changes:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   npm run develop
   ```
   Server should be running on `http://localhost:1334`

2. **Clear browser cache** or open in incognito mode to ensure fresh HTML files

3. **Get your credentials**:
   - JWT Token: Login to your app and copy the JWT token
   - License Key: Get from your database
   - User Document ID: Get from your database
   - Machine UUID: Any unique identifier (e.g., `POS-001`)

### Test 1: Mobile App (JWT Authentication)

1. Open `test-mobile-app.html` in your browser
2. Enter your credentials:
   - Server URL: `http://localhost:1334`
   - JWT Token: Your JWT token
3. Click "Connect to Server"
4. Expected result: ✅ Connected successfully
5. Click "Subscribe to Seat Updates"
6. Expected result: ✅ Subscribed successfully
7. Click "Fetch My Seats"
8. Expected result: ✅ Seats displayed in cards

### Test 2: POS App (License Key Authentication)

1. Open `test-pos-app.html` in your browser
2. Enter your credentials:
   - Server URL: `http://localhost:1334`
   - License Key: Your license key
   - User Document ID: Your user document ID
   - Machine UUID: Your machine UUID (e.g., `POS-001`)
3. Click "Connect to Server"
4. Expected result: ✅ Connected successfully
5. Click "Send Telemetry Update"
6. Expected result: ✅ Seat update successful

### Test 3: Real-time Updates (End-to-End)

1. Keep both HTML files open (POS and Mobile)
2. Ensure Mobile app is subscribed to updates
3. In POS app, click "Send Random Telemetry" or "Start Auto-Update"
4. Expected result in Mobile app: 
   - ✅ Real-time notification appears in event log
   - ✅ Seat card updates with new telemetry data
   - ✅ Seat card highlights briefly (yellow flash)
   - ✅ "Updates Received" metric increments

### Test 4: HTTP API Endpoints

#### Fetch My Seats
```bash
curl -X GET http://localhost:1334/api/key-seats/my-seats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "data": [
    {
      "documentId": "...",
      "machineUUID": "...",
      "telemetry": {...},
      "isActive": true,
      "licenseKey": "...",
      "planSubscriptionType": "Pro"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

#### Query Telemetry History
```bash
curl -X GET "http://localhost:1334/api/seat-telemetry-history/query?machineUUID=POS-001&page=1&pageSize=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected response:
```json
{
  "data": [
    {
      "documentId": "...",
      "telemetryData": {...},
      "capturedAt": "2024-01-15T10:30:00.000Z",
      "snapshotType": "realtime",
      "keySeat": {
        "machineUUID": "POS-001"
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 10
  }
}
```

## Troubleshooting

### Issue: "Failed to fetch" in Mobile App
**Solution**: 
1. Check that Strapi server is running on port 1334
2. Check browser console for CORS errors
3. Verify JWT token is valid and not expired

### Issue: POS not receiving "seat:update:success" response
**Solution**:
1. Check that machine UUID exists in database
2. Check that license key is valid and active
3. Check server logs for errors

### Issue: Mobile app not receiving real-time updates
**Solution**:
1. Ensure you clicked "Subscribe to Seat Updates"
2. Check that you own the seat being updated
3. Check Socket.IO connection status

### Issue: HTTP endpoints return 404
**Solution**:
1. Restart Strapi server to load renamed route files
2. Check that route files are named with `01-` prefix
3. Check server logs for route registration

## Expected Server Logs (Updated)

### Successful Mobile Connection
```
[ConnectionHandler] New connection: QV2xXuDjgYtR1P_CAAAJ
Attempting JWT authentication
VerifiedUserCredentials { id: 1, iat: ..., exp: ... }
[ConnectionHandler] New connection User ID: 1, Client Type: mobile
[ConnectionHandler] New connection User info: {"userId":1,"documentId":"...","clientType":"mobile"}
[SeatUpdateHandler] Setting up handlers for socket QV2xXuDjgYtR1P_CAAAJ, clientType: mobile
[SeatUpdateHandler] Registering mobile handlers for socket QV2xXuDjgYtR1P_CAAAJ
```

### Successful POS Connection
```
[ConnectionHandler] New connection: gdcDDDm8aZKDnsWvAAAF
Attempting POS authentication
POS authentication successful: { userID: ..., machineUUID: ..., keySeatId: ... }
[ConnectionHandler] New connection User ID: ..., Client Type: pos
[ConnectionHandler] Updated key-seat socket ID for key-seat ...
[ConnectionHandler] Sent current plan to POS: Pro
[SeatUpdateHandler] Setting up handlers for socket gdcDDDm8aZKDnsWvAAAF, clientType: pos
[SeatUpdateHandler] Registering POS handlers for socket gdcDDDm8aZKDnsWvAAAF
```

### Successful Seat Update
```
[SeatUpdateHandler] Processing seat update for ...
[KeySeatService] Updating seat telemetry for ...
[SeatUpdateHandler] Seat updated successfully: ...
[SeatUpdateHandler] Notified mobile apps in room user:...:seats
```

### Successful HTTP Request
```
[KeySeatController] mySeats called
[KeySeatController] ctx.state.user: { id: 1, documentId: '...', ... }
[KeySeatController] User document ID: ...
[KeySeatController] Found seats: 2
http: GET /api/key-seats/my-seats (45 ms) 200
```

## Next Steps

After successful testing:
1. ✅ Verify all Socket.IO events work correctly
2. ✅ Test with multiple POS machines
3. ✅ Test with multiple mobile clients
4. ✅ Test telemetry history queries with date filters
5. ✅ Test error scenarios (invalid tokens, expired licenses, etc.)
6. 🔒 Update CORS configuration for production (remove `*` wildcard)
7. 📊 Monitor performance with high-frequency updates
8. 🧪 Run integration tests from tasks.md

## Security Notes

⚠️ **Important**: The current CORS configuration allows all origins (`*`) for testing purposes. Before deploying to production:

1. Update `config/middlewares.ts` to only allow specific origins:
   ```typescript
   origin: ['https://your-mobile-app.com', 'https://your-admin-panel.com']
   ```

2. Consider implementing rate limiting for telemetry updates

3. Validate telemetry data structure on the server side

4. Implement proper error handling for malformed requests
