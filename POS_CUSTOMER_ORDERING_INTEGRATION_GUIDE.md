# POS Customer Ordering Integration Guide

## Overview

This guide explains how to integrate customer ordering functionality into your POS application. The backend is ready and waiting for your POS app to handle order requests from customers and send back responses.

**Customer App Status**: ✅ Fully implemented and ready  
**Backend Status**: ✅ Fully implemented and ready  
**POS App Status**: ⏳ Needs implementation (this guide)

---

## Architecture Overview

```
Customer App                Backend                    POS App (YOU)
     │                         │                           │
     │──order:create──────────►│                           │
     │                         │──validates & tracks       │
     │                         │──pos:order:request───────►│ (1) LISTEN
     │                         │                           │
     │                         │◄─pos:order:response───────│ (2) EMIT
     │◄─order:response─────────│                           │
     │                         │                           │
```

**Your Role**: Listen for order requests from backend, process them, and send responses back.

---

## Socket.IO Events Reference

### Events YOU Must Listen To (Incoming)

| Event Name | Constant | Description |
|------------|----------|-------------|
| `pos:order:create:request` | `SocketIOEvents.EmitPOSOrderRequest` | Order request from customer via backend |

### Events YOU Must Emit (Outgoing)

| Event Name | Constant | Description |
|------------|----------|-------------|
| `pos:order:create:response` | `SocketIOEvents.OnPOSOrderResponse` | Your response to order request |

---

## Step 1: Listen for Order Requests

### Event: `pos:order:create:request`

**When**: Backend forwards a customer order to your POS device  
**Timeout**: You have 30 seconds to respond (backend will timeout after 30s)

### Payload Structure

```typescript
interface OrderRequest {
  customerSocketId: string;      // REQUIRED - Use this to route response back
  requestId: string;              // REQUIRED - Unique order tracking ID (UUID)
  publicSeatId: string;           // Your seat's public ID
  customer: {
    name: string;                 // Customer name (2-100 chars)
    phone: string;                // Customer phone (10-15 digits)
    deliveryType: 'pickup' | 'delivery';
    deliveryAddress?: string;     // Required if deliveryType is 'delivery'
  };
  items: Array<{
    productId: string;
    name: string;
    price: number;                // Positive number
    quantity: number;             // 1-99
    addons?: Array<{
      id: string;
      name: string;
      price: number;
    }>;
    notes?: string;
  }>;
  orderNote?: string;             // Optional order-level notes
  subtotal: number;
  tax: number;
  total: number;
  timestamp: string;              // ISO 8601 format
}
```

### Implementation Example

```typescript
// Listen for order requests
socket.on('pos:order:create:request', async (payload: OrderRequest) => {
  console.log('📦 Order request received:', {
    requestId: payload.requestId,
    customerName: payload.customer.name,
    itemCount: payload.items.length,
    total: payload.total
  });

  try {
    // CRITICAL: Extract these for response routing
    const { customerSocketId, requestId } = payload;

    // Process the order in your POS system
    const result = await processOrder(payload);

    // Send response back (see Step 2)
    sendOrderResponse(socket, customerSocketId, requestId, result);

  } catch (error) {
    console.error('❌ Order processing failed:', error);
    
    // Send error response (see Step 2)
    sendOrderErrorResponse(socket, payload.customerSocketId, payload.requestId, error);
  }
});
```

---

## Step 2: Send Order Response

### Event: `pos:order:create:response`

**When**: After processing the order (success or failure)  
**Deadline**: Within 30 seconds of receiving the request

### Success Response Structure

```typescript
interface OrderSuccessResponse {
  customerSocketId: string;      // REQUIRED - From request payload
  requestId: string;              // REQUIRED - From request payload
  success: true;                  // REQUIRED
  order: {                        // REQUIRED when success is true
    id: string;                   // Your internal order ID
    receiptNumber: string;        // Receipt/order number for customer
    status: string;               // e.g., "pending", "confirmed", "preparing"
    total: number;                // Final order total
    estimatedTime?: number;       // Optional: estimated minutes until ready
  };
}
```

### Error Response Structure

```typescript
interface OrderErrorResponse {
  customerSocketId: string;      // REQUIRED - From request payload
  requestId: string;              // REQUIRED - From request payload
  success: false;                 // REQUIRED
  error: {                        // REQUIRED when success is false
    code: string;                 // Error code (see Error Codes section)
    message: string;              // User-friendly error message
  };
}
```

### Implementation Example - Success

```typescript
function sendOrderResponse(
  socket: Socket,
  customerSocketId: string,
  requestId: string,
  orderResult: any
) {
  const response = {
    customerSocketId,              // CRITICAL: Must match request
    requestId,                     // CRITICAL: Must match request
    success: true,
    order: {
      id: orderResult.orderId,
      receiptNumber: orderResult.receiptNumber,
      status: 'confirmed',
      total: orderResult.total,
      estimatedTime: 15            // Optional: 15 minutes
    }
  };

  socket.emit('pos:order:create:response', response);
  
  console.log('✅ Order response sent:', {
    requestId,
    receiptNumber: response.order.receiptNumber
  });
}
```

### Implementation Example - Error

```typescript
function sendOrderErrorResponse(
  socket: Socket,
  customerSocketId: string,
  requestId: string,
  error: any
) {
  const response = {
    customerSocketId,              // CRITICAL: Must match request
    requestId,                     // CRITICAL: Must match request
    success: false,
    error: {
      code: determineErrorCode(error),
      message: getUserFriendlyMessage(error)
    }
  };

  socket.emit('pos:order:create:response', response);
  
  console.log('❌ Order error response sent:', {
    requestId,
    errorCode: response.error.code
  });
}
```

---

## Error Codes Reference

Use these standard error codes in your error responses:

| Error Code | When to Use | Example Message |
|------------|-------------|-----------------|
| `INVENTORY_UNAVAILABLE` | Product out of stock | "One or more items are out of stock" |
| `PAYMENT_REQUIRED` | Payment processing issue | "Payment method required" |
| `INVALID_ITEMS` | Invalid product IDs or prices | "Some items are no longer available" |
| `STORE_CLOSED` | Outside business hours | "Store is currently closed" |
| `ORDER_LIMIT_REACHED` | Too many pending orders | "Too many orders in queue, please try again" |
| `DELIVERY_UNAVAILABLE` | Delivery not available | "Delivery is not available at this time" |
| `MINIMUM_NOT_MET` | Order below minimum | "Order total below minimum amount" |
| `PROCESSING_ERROR` | Generic processing error | "Unable to process order, please try again" |

---

## Complete Integration Example

```typescript
import { Socket } from 'socket.io-client';

class POSOrderHandler {
  private socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupOrderListener();
  }

  private setupOrderListener() {
    this.socket.on('pos:order:create:request', async (payload) => {
      console.log('📦 New order request:', payload.requestId);

      const { customerSocketId, requestId } = payload;

      try {
        // Step 1: Validate order items against inventory
        const validation = await this.validateOrderItems(payload.items);
        if (!validation.valid) {
          return this.sendError(customerSocketId, requestId, {
            code: 'INVENTORY_UNAVAILABLE',
            message: validation.message
          });
        }

        // Step 2: Calculate final total (verify pricing)
        const calculatedTotal = this.calculateTotal(payload.items);
        if (Math.abs(calculatedTotal - payload.total) > 0.01) {
          return this.sendError(customerSocketId, requestId, {
            code: 'INVALID_ITEMS',
            message: 'Price mismatch detected'
          });
        }

        // Step 3: Create order in your POS system
        const order = await this.createOrder({
          customerName: payload.customer.name,
          customerPhone: payload.customer.phone,
          deliveryType: payload.customer.deliveryType,
          deliveryAddress: payload.customer.deliveryAddress,
          items: payload.items,
          orderNote: payload.orderNote,
          total: payload.total
        });

        // Step 4: Send success response
        this.sendSuccess(customerSocketId, requestId, order);

        // Step 5: Optional - Print receipt, notify kitchen, etc.
        await this.printReceipt(order);
        await this.notifyKitchen(order);

      } catch (error) {
        console.error('Order processing error:', error);
        this.sendError(customerSocketId, requestId, {
          code: 'PROCESSING_ERROR',
          message: 'Failed to process order'
        });
      }
    });
  }

  private sendSuccess(
    customerSocketId: string,
    requestId: string,
    order: any
  ) {
    this.socket.emit('pos:order:create:response', {
      customerSocketId,
      requestId,
      success: true,
      order: {
        id: order.id,
        receiptNumber: order.receiptNumber,
        status: order.status,
        total: order.total,
        estimatedTime: order.estimatedTime
      }
    });
  }

  private sendError(
    customerSocketId: string,
    requestId: string,
    error: { code: string; message: string }
  ) {
    this.socket.emit('pos:order:create:response', {
      customerSocketId,
      requestId,
      success: false,
      error
    });
  }

  private async validateOrderItems(items: any[]): Promise<any> {
    // Your inventory validation logic
    return { valid: true };
  }

  private calculateTotal(items: any[]): number {
    // Your pricing calculation logic
    return items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const addonsTotal = (item.addons || []).reduce(
        (addonSum: number, addon: any) => addonSum + addon.price,
        0
      );
      return sum + itemTotal + addonsTotal;
    }, 0);
  }

  private async createOrder(orderData: any): Promise<any> {
    // Your order creation logic
    return {
      id: 'ORD-12345',
      receiptNumber: 'R-001',
      status: 'confirmed',
      total: orderData.total,
      estimatedTime: 15
    };
  }

  private async printReceipt(order: any): Promise<void> {
    // Your receipt printing logic
  }

  private async notifyKitchen(order: any): Promise<void> {
    // Your kitchen notification logic
  }
}

// Usage
const orderHandler = new POSOrderHandler(socket);
```

---

## Critical Implementation Rules

### ✅ DO

1. **Always include `customerSocketId` and `requestId`** in your response (exact values from request)
2. **Respond within 30 seconds** (backend will timeout after 30s)
3. **Validate inventory** before confirming orders
4. **Verify pricing** matches your current prices
5. **Use standard error codes** from the Error Codes Reference
6. **Log all order requests and responses** for debugging
7. **Handle errors gracefully** and send error responses

### ❌ DON'T

1. **Don't modify `customerSocketId` or `requestId`** - use exact values from request
2. **Don't take longer than 30 seconds** to respond
3. **Don't send success without creating the order** in your system
4. **Don't expose sensitive data** (internal IDs, costs, margins) in responses
5. **Don't ignore validation errors** - always send error responses
6. **Don't forget to emit the response** - customer is waiting

---

## Testing Your Integration

### Test Scenario 1: Successful Order

**Request from Backend:**
```json
{
  "customerSocketId": "cust-socket-123",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "publicSeatId": "ABC123",
  "customer": {
    "name": "John Doe",
    "phone": "1234567890",
    "deliveryType": "pickup"
  },
  "items": [
    {
      "productId": "prod-1",
      "name": "Burger",
      "price": 10.99,
      "quantity": 2
    }
  ],
  "subtotal": 21.98,
  "tax": 1.76,
  "total": 23.74,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Expected Response from YOU:**
```json
{
  "customerSocketId": "cust-socket-123",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "success": true,
  "order": {
    "id": "ORD-12345",
    "receiptNumber": "R-001",
    "status": "confirmed",
    "total": 23.74,
    "estimatedTime": 15
  }
}
```

### Test Scenario 2: Out of Stock Error

**Expected Response from YOU:**
```json
{
  "customerSocketId": "cust-socket-123",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "success": false,
  "error": {
    "code": "INVENTORY_UNAVAILABLE",
    "message": "Burger is currently out of stock"
  }
}
```

---

## Troubleshooting

### Problem: Not receiving order requests

**Check:**
- Is your POS socket connected with `clientType: "pos"`?
- Did you join the correct room: `pos:${keySeatDocumentId}`?
- Is `allowCustomerOrdering` enabled on your Key-Seat?
- Is your POS marked as `isConnected: true`?

### Problem: Customer not receiving response

**Check:**
- Did you include exact `customerSocketId` from request?
- Did you include exact `requestId` from request?
- Did you emit to `pos:order:create:response` (correct event name)?
- Did you respond within 30 seconds?

### Problem: Backend shows timeout errors

**Check:**
- Are you responding within 30 seconds?
- Is your response payload structure correct?
- Are you emitting the response event?
- Check backend logs for validation errors

---

## AI Agent Integration Prompt

Use this prompt to help an AI agent implement the POS ordering integration:

```
You are integrating customer ordering into a POS application using Socket.IO.

CONTEXT:
- Backend and Customer App are fully implemented and ready
- Your POS app needs to listen for order requests and send responses
- You have 30 seconds to respond to each order request

YOUR TASKS:
1. Listen for event: "pos:order:create:request"
2. Extract customerSocketId and requestId from payload (CRITICAL - needed for response routing)
3. Validate order items against inventory
4. Verify pricing matches current prices
5. Create order in POS system
6. Emit response to: "pos:order:create:response" within 30 seconds

RESPONSE STRUCTURE (Success):
{
  customerSocketId: string (from request),
  requestId: string (from request),
  success: true,
  order: {
    id: string,
    receiptNumber: string,
    status: string,
    total: number,
    estimatedTime?: number
  }
}

RESPONSE STRUCTURE (Error):
{
  customerSocketId: string (from request),
  requestId: string (from request),
  success: false,
  error: {
    code: string (use standard codes: INVENTORY_UNAVAILABLE, PAYMENT_REQUIRED, etc.),
    message: string (user-friendly message)
  }
}

CRITICAL RULES:
- ALWAYS include exact customerSocketId and requestId from request
- ALWAYS respond within 30 seconds
- ALWAYS validate inventory before confirming
- ALWAYS send error response if validation fails
- NEVER expose sensitive internal data in responses

ERROR CODES TO USE:
- INVENTORY_UNAVAILABLE: Product out of stock
- INVALID_ITEMS: Invalid product IDs or prices
- STORE_CLOSED: Outside business hours
- PROCESSING_ERROR: Generic error

Implement the order handler following these requirements.
```

---

## Support & Resources

- **Backend Handler**: `src/socketio/handlers/customer-app.handler.ts`
- **Response Handler**: `src/socketio/handlers/pos-customer-response.handler.ts`
- **Event Constants**: `src/socketio/events_constants.ts`
- **Validation Utils**: `src/api/key-seat/utils/customer-validation.ts`

For questions or issues, check the backend logs for detailed error messages and validation failures.
