# Website Client Integration Guide

## Overview

Added support for restaurant website connections to the Socket.IO backend. Website clients can now connect and request menu data without authentication, similar to the mobile customer app.

## Changes Made

### 1. Connection Handler (`src/socketio/connection.handler.ts`)

**Updated client type detection:**
- Now accepts both `clientType: 'customer'` and `clientType: 'Website'`
- Both types bypass authentication and use the same customer app handlers
- Website connections are logged with their specific client type

```typescript
if (clientType === 'customer' || clientType === 'Website') {
  strapi.log.info(`[ConnectionHandler] ${clientType} connection detected: ${socket.id}`);
  socket.data.clientType = clientType;
  setupCustomerAppHandlers(socket, strapi, io);
  return;
}
```

### 2. Customer App Handler (`src/socketio/handlers/customer-app.handler.ts`)

**Enhanced logging:**
- Added client type to setup logs
- Added detailed payload logging in connection handler
- Improved error messages to include client type

**Key features for website clients:**
- ✅ Connect to seat via `publicSeatId`
- ✅ Request menu categories
- ✅ Request menu products by category
- ✅ Receive real-time responses from POS
- ✅ Automatic timeout handling (10 seconds)
- ✅ Connection limit enforcement
- ✅ POS online/offline detection

## Socket Events for Website Client

### Connection Flow

```typescript
// 1. Connect to backend
const socket = io(SOCKET_URL, {
  query: { clientType: 'Website' },
  transports: ['websocket']
});

// 2. Connect to specific seat
socket.emit('customer:connect', { 
  publicSeatId: 'RESTINTRJ' 
});

socket.on('customer:connect:success', (response) => {
  if (response.success) {
    console.log('Connected to:', response.businessName);
    console.log('Features:', response.features);
  }
});
```

### Menu Browsing

```typescript
// Request categories
socket.emit('customer:menu:categories', {});

socket.on('customer:menu:categories:data', (response) => {
  if (response.success) {
    console.log('Categories:', response.categories);
  }
});

// Request products for a category
socket.emit('customer:menu:products', { 
  categoryId: 'category-123' 
});

socket.on('customer:menu:products:data', (response) => {
  if (response.success) {
    console.log('Products:', response.products);
  }
});
```

### Error Handling

```typescript
// General errors
socket.on('customer:error', (error) => {
  console.error('Error:', error.error);
});

// Timeout errors (10 second limit)
socket.on('customer:timeout', (error) => {
  console.error('Request timed out:', error.requestType);
});
```

## Event Constants

All events are defined in `src/socketio/events_constants.ts`:

| Event | Direction | Purpose |
|-------|-----------|---------|
| `customer:connect` | Client → Server | Connect to seat |
| `customer:connect:success` | Server → Client | Connection result |
| `customer:menu:categories` | Client → Server | Request categories |
| `customer:menu:categories:data` | Server → Client | Categories response |
| `customer:menu:products` | Client → Server | Request products |
| `customer:menu:products:data` | Server → Client | Products response |
| `customer:error` | Server → Client | Error notification |
| `customer:timeout` | Server → Client | Timeout notification |

## Response Formats

### Connection Success Response

```typescript
{
  success: true,
  businessName: "Restaurant Name",
  businessType: "restaurant",
  features: {
    allowMenuBrowsing: true,
    allowBarcodeScanning: false,
    allowCustomerOrdering: true
  },
  timestamp: "2026-05-07T10:00:00.000Z"
}
```

### Menu Categories Response

```typescript
{
  success: true,
  categories: [
    {
      id: "cat-1",
      name: "Appetizers",
      description: "Start your meal",
      imageUrl: "https://..."
    }
  ],
  timestamp: "2026-05-07T10:00:00.000Z"
}
```

### Menu Products Response

```typescript
{
  success: true,
  products: [
    {
      id: "prod-1",
      name: "Caesar Salad",
      description: "Fresh romaine lettuce",
      price: 12.99,
      imageUrl: "https://...",
      available: true
    }
  ],
  categoryId: "cat-1",
  timestamp: "2026-05-07T10:00:00.000Z"
}
```

## Security Features

### Input Validation
- Public Seat ID: 6-12 uppercase alphanumeric characters
- All inputs sanitized to prevent injection attacks
- Request payloads validated before forwarding to POS

### Connection Limits
- Maximum connections per seat enforced (default: 50)
- Connection count tracked in database
- Automatic cleanup on disconnect

### Data Sanitization
- Sensitive fields removed from responses
- No license keys, user IDs, or internal identifiers exposed
- POS responses validated before forwarding to clients

### Timeout Protection
- 10-second timeout on all requests
- Automatic cleanup of pending requests
- Prevents resource exhaustion

## Multi-Replica Support

The implementation is fully compatible with Docker Swarm multi-replica deployments:

- ✅ Room-based communication (no socket ID storage)
- ✅ Redis adapter for cross-replica events
- ✅ Connection counts persisted to database
- ✅ Works seamlessly across all replicas

## Troubleshooting

### Connection Fails

**Check logs for:**
```
[CustomerAppHandler] Connection rejected - Validation failed
```

**Common causes:**
- Invalid `publicSeatId` format (must be 6-12 uppercase alphanumeric)
- Seat not found in database
- Customer app feature disabled on seat
- POS device offline

### Request Timeout

**Check logs for:**
```
[CustomerAppHandler] Request timeout - Menu categories
```

**Common causes:**
- POS device not responding
- POS device disconnected
- Network issues between backend and POS

### No Response from POS

**Verify:**
1. POS device is connected (`isConnected: true`)
2. POS device is in correct room (`pos:${keySeatDocumentId}`)
3. POS device has handlers for request events
4. Backend logs show request forwarded to POS

## Testing

### Manual Test with Socket.IO Client

```bash
npm install socket.io-client
```

```javascript
const { io } = require('socket.io-client');

const socket = io('http://localhost:1337', {
  query: { clientType: 'Website' },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  
  socket.emit('customer:connect', { 
    publicSeatId: 'RESTINTRJ' 
  });
});

socket.on('customer:connect:success', (response) => {
  console.log('Seat connection:', response);
  
  if (response.success) {
    socket.emit('customer:menu:categories', {});
  }
});

socket.on('customer:menu:categories:data', (response) => {
  console.log('Categories:', response);
});

socket.on('customer:error', (error) => {
  console.error('Error:', error);
});
```

## Next Steps

To fully integrate the website client:

1. **POS Device Updates**: Ensure POS devices handle these events:
   - `pos:menu:categories:request`
   - `pos:menu:products:request`
   - Respond with `pos:menu:categories:response` and `pos:menu:products:response`

2. **Database Setup**: Ensure key-seat records have:
   - `allowMenuBrowsing: true`
   - `isConnected: true` (when POS is online)
   - `maxCustomerConnections` configured

3. **Frontend Integration**: Use the provided Socket.IO client code in your React/Vue/Angular app

4. **Monitoring**: Watch logs for connection patterns and errors

## Support

For issues or questions:
- Check backend logs: `[CustomerAppHandler]` and `[POSCustomerResponseHandler]`
- Verify seat configuration in database
- Test with manual Socket.IO client first
- Ensure POS device is properly connected and responding
