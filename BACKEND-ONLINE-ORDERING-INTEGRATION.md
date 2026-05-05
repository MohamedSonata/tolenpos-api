# Backend Server Online Ordering Integration Guide

## Overview

This document describes the backend server implementation requirements for routing online orders from the Customer Mobile App to the appropriate POS terminal. The backend acts as a message broker and connection manager between customers and restaurants.

## Architecture

```
Customer Mobile App ←→ Backend Server ←→ POS Terminal
                            ↓
                    Connection Manager
                            ↓
                    Order Router
                            ↓
                    Event Logger
```

## Core Responsibilities

1. **Connection Management**
   - Maintain WebSocket connections from customer apps
   - Maintain WebSocket connections from POS terminals
   - Track which customers are connected to which seats
   - Handle connection/disconnection events

2. **Order Routing**
   - Receive orders from customer apps
   - Route orders to correct POS terminal based on publicSeatId
   - Forward responses back to customer apps
   - Handle timeout scenarios

3. **Event Logging**
   - Log all order events for analytics
   - Track order success/failure rates
   - Monitor connection health

## Socket.IO Implementation

### 1. Connection Management

#### Customer App Connection
```typescript
// Customer connects with seat ID
socket.on('customer:connect', async (data: {
  publicSeatId: string
  customerId: string
  deviceInfo: {
    platform: string
    version: string
  }
}) => {
  try {
    // Validate seat exists and is active
    const seat = await db.seats.findOne({ publicSeatId: data.publicSeatId })
    
    if (!seat || !seat.isActive) {
      socket.emit('connection:error', {
        code: 'SEAT_NOT_FOUND',
        message: 'Restaurant not found or inactive'
      })
      socket.disconnect()
      return
    }
    
    // Join seat room
    socket.join(`seat:${data.publicSeatId}`)
    
    // Store connection metadata
    await redis.hset(`customer:${socket.id}`, {
      customerId: data.customerId,
      publicSeatId: data.publicSeatId,
      connectedAt: new Date().toISOString(),
      platform: data.deviceInfo.platform
    })
    
    // Increment connection count
    const connectionCount = await redis.hincrby(
      `seat:${data.publicSeatId}:stats`,
      'activeConnections',
      1
    )
    
    // Notify POS terminal
    io.to(`pos:${data.publicSeatId}`).emit('seat:customer:connected', {
      customerId: data.customerId,
      publicSeatId: data.publicSeatId,
      currentConnections: connectionCount,
      timestamp: new Date().toISOString()
    })
    
    // Send connection success
    socket.emit('connection:success', {
      publicSeatId: data.publicSeatId,
      businessName: seat.businessName,
      businessType: seat.businessType,
      features: seat.features
    })
    
    logger.info('Customer connected', {
      customerId: data.customerId,
      publicSeatId: data.publicSeatId,
      socketId: socket.id
    })
  } catch (error) {
    logger.error('Customer connection failed', { error })
    socket.emit('connection:error', {
      code: 'CONNECTION_FAILED',
      message: 'Failed to connect to restaurant'
    })
    socket.disconnect()
  }
})

// Customer disconnects
socket.on('disconnect', async () => {
  try {
    // Get connection metadata
    const metadata = await redis.hgetall(`customer:${socket.id}`)
    
    if (metadata.publicSeatId) {
      // Decrement connection count
      const connectionCount = await redis.hincrby(
        `seat:${metadata.publicSeatId}:stats`,
        'activeConnections',
        -1
      )
      
      // Notify POS terminal
      io.to(`pos:${metadata.publicSeatId}`).emit('seat:customer:disconnected', {
        customerId: metadata.customerId,
        publicSeatId: metadata.publicSeatId,
        currentConnections: Math.max(0, connectionCount),
        timestamp: new Date().toISOString()
      })
      
      logger.info('Customer disconnected', {
        customerId: metadata.customerId,
        publicSeatId: metadata.publicSeatId,
        socketId: socket.id
      })
    }
    
    // Clean up metadata
    await redis.del(`customer:${socket.id}`)
  } catch (error) {
    logger.error('Customer disconnect cleanup failed', { error })
  }
})
```

#### POS Terminal Connection
```typescript
// POS connects with authentication
socket.on('pos:authenticate', async (data: {
  publicSeatId: string
  authToken: string
  terminalId: string
}) => {
  try {
    // Verify auth token
    const isValid = await verifyAuthToken(data.authToken, data.publicSeatId)
    
    if (!isValid) {
      socket.emit('auth:failed', {
        code: 'INVALID_TOKEN',
        message: 'Authentication failed'
      })
      socket.disconnect()
      return
    }
    
    // Join POS room
    socket.join(`pos:${data.publicSeatId}`)
    
    // Store POS connection
    await redis.hset(`pos:${data.publicSeatId}`, {
      socketId: socket.id,
      terminalId: data.terminalId,
      connectedAt: new Date().toISOString(),
      status: 'online'
    })
    
    // Send auth success
    socket.emit('auth:success', {
      publicSeatId: data.publicSeatId,
      features: ['online_ordering', 'menu_sync', 'real_time_updates']
    })
    
    logger.info('POS authenticated', {
      publicSeatId: data.publicSeatId,
      terminalId: data.terminalId,
      socketId: socket.id
    })
  } catch (error) {
    logger.error('POS authentication failed', { error })
    socket.emit('auth:failed', {
      code: 'AUTH_ERROR',
      message: 'Authentication error'
    })
    socket.disconnect()
  }
})
```

### 2. Order Routing

#### Receive Order from Customer App
```typescript
socket.on('pos:order:create:request', async (data: {
  customerSocketId: string
  requestId: string
  publicSeatId: string
  customer: {
    name: string
    phone: string
    deliveryAddress?: string
    deliveryType: 'pickup' | 'delivery'
  }
  items: Array<{
    productId: string
    name: string
    price: number
    quantity: number
    addons?: Array<any>
    notes?: string
  }>
  orderNote?: string
  subtotal: number
  tax: number
  total: number
  timestamp: string
}) => {
  try {
    // Validate request
    if (!data.customerSocketId || !data.requestId || !data.publicSeatId) {
      throw new Error('Invalid request: missing required fields')
    }
    
    // Check if POS is online
    const posConnection = await redis.hgetall(`pos:${data.publicSeatId}`)
    
    if (!posConnection.socketId || posConnection.status !== 'online') {
      socket.emit('pos:order:create:response', {
        customerSocketId: data.customerSocketId,
        requestId: data.requestId,
        success: false,
        error: {
          code: 'POS_OFFLINE',
          message: 'Restaurant is currently offline. Please try again later.'
        }
      })
      return
    }
    
    // Log order request
    await db.orderRequests.create({
      requestId: data.requestId,
      customerSocketId: data.customerSocketId,
      publicSeatId: data.publicSeatId,
      customerName: data.customer.name,
      customerPhone: data.customer.phone,
      itemCount: data.items.length,
      total: data.total,
      status: 'pending',
      createdAt: new Date()
    })
    
    // Forward to POS terminal
    io.to(`pos:${data.publicSeatId}`).emit('pos:order:create:request', data)
    
    // Set timeout for response (30 seconds)
    setTimeout(async () => {
      const request = await db.orderRequests.findOne({ requestId: data.requestId })
      
      if (request && request.status === 'pending') {
        // Timeout - send error to customer
        io.to(data.customerSocketId).emit('pos:order:create:response', {
          customerSocketId: data.customerSocketId,
          requestId: data.requestId,
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'Order request timed out. Please try again.'
          }
        })
        
        // Update request status
        await db.orderRequests.updateOne(
          { requestId: data.requestId },
          { status: 'timeout', updatedAt: new Date() }
        )
        
        logger.warn('Order request timed out', {
          requestId: data.requestId,
          publicSeatId: data.publicSeatId
        })
      }
    }, 30000)
    
    logger.info('Order request forwarded to POS', {
      requestId: data.requestId,
      publicSeatId: data.publicSeatId,
      itemCount: data.items.length,
      total: data.total
    })
  } catch (error) {
    logger.error('Order routing failed', { error, requestId: data.requestId })
    
    socket.emit('pos:order:create:response', {
      customerSocketId: data.customerSocketId,
      requestId: data.requestId,
      success: false,
      error: {
        code: 'ROUTING_ERROR',
        message: 'Failed to process order. Please try again.'
      }
    })
  }
})
```

#### Forward Response to Customer App
```typescript
socket.on('pos:order:create:response', async (data: {
  customerSocketId: string
  requestId: string
  success: boolean
  order?: {
    id: string
    receiptNumber: string
    status: string
    estimatedTime?: number
    total: number
    timestamp: string
  }
  error?: {
    code: string
    message: string
  }
}) => {
  try {
    // Update order request status
    await db.orderRequests.updateOne(
      { requestId: data.requestId },
      {
        status: data.success ? 'completed' : 'failed',
        orderId: data.order?.id,
        receiptNumber: data.order?.receiptNumber,
        errorCode: data.error?.code,
        errorMessage: data.error?.message,
        updatedAt: new Date()
      }
    )
    
    // Forward response to customer app
    io.to(data.customerSocketId).emit('pos:order:create:response', data)
    
    logger.info('Order response forwarded to customer', {
      requestId: data.requestId,
      success: data.success,
      orderId: data.order?.id
    })
    
    // Send analytics event
    if (data.success) {
      analytics.track('order_completed', {
        requestId: data.requestId,
        orderId: data.order?.id,
        total: data.order?.total
      })
    } else {
      analytics.track('order_failed', {
        requestId: data.requestId,
        errorCode: data.error?.code
      })
    }
  } catch (error) {
    logger.error('Response forwarding failed', { error, requestId: data.requestId })
  }
})
```

### 3. Menu Data Routing

#### Menu Categories Request
```typescript
socket.on('pos:menu:categories:request', async (data: {
  customerSocketId: string
  requestId: string
}) => {
  try {
    // Get customer's seat
    const metadata = await redis.hgetall(`customer:${socket.id}`)
    
    if (!metadata.publicSeatId) {
      socket.emit('error', { message: 'Not connected to a seat' })
      return
    }
    
    // Forward to POS
    io.to(`pos:${metadata.publicSeatId}`).emit('pos:menu:categories:request', {
      customerSocketId: data.customerSocketId,
      requestId: data.requestId
    })
    
    logger.debug('Menu categories request forwarded', {
      requestId: data.requestId,
      publicSeatId: metadata.publicSeatId
    })
  } catch (error) {
    logger.error('Menu categories request failed', { error })
  }
})

// Forward response back to customer
socket.on('pos:menu:categories:response', async (data: any) => {
  io.to(data.customerSocketId).emit('pos:menu:categories:response', data)
})
```

#### Menu Products Request
```typescript
socket.on('pos:menu:products:request', async (data: {
  customerSocketId: string
  requestId: string
  categoryId: string
}) => {
  try {
    // Get customer's seat
    const metadata = await redis.hgetall(`customer:${socket.id}`)
    
    if (!metadata.publicSeatId) {
      socket.emit('error', { message: 'Not connected to a seat' })
      return
    }
    
    // Forward to POS
    io.to(`pos:${metadata.publicSeatId}`).emit('pos:menu:products:request', data)
    
    logger.debug('Menu products request forwarded', {
      requestId: data.requestId,
      categoryId: data.categoryId,
      publicSeatId: metadata.publicSeatId
    })
  } catch (error) {
    logger.error('Menu products request failed', { error })
  }
})

// Forward response back to customer
socket.on('pos:menu:products:response', async (data: any) => {
  io.to(data.customerSocketId).emit('pos:menu:products:response', data)
})
```

## Database Schema

### Seats Table
```sql
CREATE TABLE seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_seat_id VARCHAR(50) UNIQUE NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_seats_public_seat_id ON seats(public_seat_id);
CREATE INDEX idx_seats_is_active ON seats(is_active);
```

### Order Requests Table
```sql
CREATE TABLE order_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(100) UNIQUE NOT NULL,
  customer_socket_id VARCHAR(100) NOT NULL,
  public_seat_id VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  item_count INTEGER NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL, -- pending, completed, failed, timeout
  order_id VARCHAR(100),
  receipt_number VARCHAR(100),
  error_code VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_requests_request_id ON order_requests(request_id);
CREATE INDEX idx_order_requests_public_seat_id ON order_requests(public_seat_id);
CREATE INDEX idx_order_requests_status ON order_requests(status);
CREATE INDEX idx_order_requests_created_at ON order_requests(created_at);
```

## Redis Data Structures

### Customer Connection Metadata
```
Key: customer:{socketId}
Type: Hash
Fields:
  - customerId: string
  - publicSeatId: string
  - connectedAt: ISO timestamp
  - platform: string
TTL: 1 hour (auto-expire on disconnect)
```

### POS Connection Metadata
```
Key: pos:{publicSeatId}
Type: Hash
Fields:
  - socketId: string
  - terminalId: string
  - connectedAt: ISO timestamp
  - status: online | offline
TTL: None (persistent)
```

### Seat Statistics
```
Key: seat:{publicSeatId}:stats
Type: Hash
Fields:
  - activeConnections: number
  - totalOrders: number
  - successfulOrders: number
  - failedOrders: number
TTL: None (persistent)
```

## API Endpoints

### REST API for Management

#### Get Seat Status
```
GET /api/seats/:publicSeatId/status

Response:
{
  publicSeatId: string
  businessName: string
  isActive: boolean
  posOnline: boolean
  activeConnections: number
  stats: {
    totalOrders: number
    successfulOrders: number
    failedOrders: number
  }
}
```

#### Get Order History
```
GET /api/seats/:publicSeatId/orders?page=1&limit=50

Response:
{
  orders: Array<{
    requestId: string
    customerName: string
    customerPhone: string
    itemCount: number
    total: number
    status: string
    createdAt: string
  }>
  pagination: {
    page: number
    limit: number
    total: number
  }
}
```

## Monitoring & Analytics

### Metrics to Track

1. **Connection Metrics**
   - Active customer connections per seat
   - POS uptime percentage
   - Connection duration average
   - Reconnection rate

2. **Order Metrics**
   - Orders per hour/day
   - Success rate
   - Failure rate by error code
   - Average order value
   - Average response time

3. **Performance Metrics**
   - Message latency (customer → POS)
   - Response latency (POS → customer)
   - Timeout rate
   - Server CPU/memory usage

### Logging

```typescript
// Connection Events
logger.info('customer_connected', { customerId, publicSeatId, socketId })
logger.info('customer_disconnected', { customerId, publicSeatId, duration })
logger.info('pos_connected', { publicSeatId, terminalId })
logger.info('pos_disconnected', { publicSeatId, duration })

// Order Events
logger.info('order_request_received', { requestId, publicSeatId, total })
logger.info('order_request_forwarded', { requestId, publicSeatId })
logger.info('order_response_received', { requestId, success, orderId })
logger.info('order_response_forwarded', { requestId, customerSocketId })

// Errors
logger.error('order_routing_failed', { error, requestId })
logger.error('connection_failed', { error, socketId })
logger.warn('order_timeout', { requestId, publicSeatId })
```

## Security

### Authentication
- POS terminals authenticate with JWT tokens
- Tokens expire after 24 hours
- Refresh tokens for long-lived connections

### Rate Limiting
```typescript
// Per customer
- 10 menu requests per minute
- 1 order request per minute
- 100 socket messages per minute

// Per POS
- 1000 socket messages per minute
```

### Input Validation
```typescript
// Validate all incoming data
const orderSchema = Joi.object({
  customerSocketId: Joi.string().required(),
  requestId: Joi.string().uuid().required(),
  publicSeatId: Joi.string().pattern(/^[A-Z0-9]{6,10}$/).required(),
  customer: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required(),
    deliveryAddress: Joi.string().max(500),
    deliveryType: Joi.string().valid('pickup', 'delivery').required()
  }).required(),
  items: Joi.array().min(1).max(50).items(
    Joi.object({
      productId: Joi.string().required(),
      name: Joi.string().required(),
      price: Joi.number().positive().required(),
      quantity: Joi.number().integer().min(1).max(99).required()
    })
  ).required(),
  total: Joi.number().positive().required()
})
```

## Error Handling

### Error Codes
```typescript
enum ErrorCode {
  SEAT_NOT_FOUND = 'SEAT_NOT_FOUND',
  POS_OFFLINE = 'POS_OFFLINE',
  INVALID_REQUEST = 'INVALID_REQUEST',
  TIMEOUT = 'TIMEOUT',
  ROUTING_ERROR = 'ROUTING_ERROR',
  AUTH_FAILED = 'AUTH_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}
```

### Error Response Format
```typescript
{
  code: string
  message: string
  details?: any
  timestamp: string
}
```

## Deployment

### Environment Variables
```bash
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://host:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
```

### Docker Compose
```yaml
version: '3.8'

services:
  backend:
    image: tolen-backend:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=tolen
      - POSTGRES_USER=tolen
      - POSTGRES_PASSWORD=${DB_PASSWORD}

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Testing

### Unit Tests
- Connection management logic
- Order routing logic
- Input validation
- Error handling

### Integration Tests
- Customer app → Backend → POS flow
- Menu data synchronization
- Order timeout handling
- Connection recovery

### Load Tests
- 1000 concurrent customer connections
- 100 orders per minute
- POS reconnection under load

---

**Last Updated:** 2026-05-05
**Version:** 1.0.0
**Status:** Draft - Pending Implementation
