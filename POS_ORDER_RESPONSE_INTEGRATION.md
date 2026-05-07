# POS Order Response Integration Guide

## Overview
This guide explains how POS applications should respond to customer orders with comprehensive order details.

## Response Event
When your POS receives a customer order via `pos:order:request`, respond using:
```
Event: pos:order:response
```

## Response Structure

### Success Response (Minimal - Required Fields Only)
```json
{
  "customerSocketId": "customer-socket-id-from-request",
  "requestId": "request-id-from-order",
  "success": true,
  "order": {
    "id": "order-789",
    "receiptNumber": "RCP-001234",
    "status": "completed",
    "total": 45.50
  }
}
```

### Success Response (Complete - With All Optional Fields)
```json
{
  "customerSocketId": "customer-socket-id-from-request",
  "requestId": "request-id-from-order",
  "success": true,
  "order": {
    "id": "order-789",
    "receiptNumber": "RCP-001234",
    "status": "completed",
    "total": 45.50,
    "timestamp": "2026-05-06T10:30:00.000Z",
    "items": [
      {
        "name": "Burger",
        "quantity": 2,
        "price": 15.00,
        "subtotal": 30.00,
        "productId": "prod-123",
        "addons": [
          {
            "name": "Extra Cheese",
            "price": 2.00
          }
        ],
        "notes": "No onions"
      },
      {
        "name": "Fries",
        "quantity": 1,
        "price": 5.00,
        "subtotal": 5.00
      }
    ],
    "subtotal": 35.00,
    "tax": 3.50,
    "discount": 7.00,
    "orderType": "DELIVERY",
    "cashierName": "John Doe",
    "createdAt": "2026-05-06T10:30:00.000Z",
    "paymentMethod": "CASH",
    "estimatedTime": 30
  }
}
```

### Failure Response
```json
{
  "customerSocketId": "customer-socket-id-from-request",
  "requestId": "request-id-from-order",
  "success": false,
  "error": {
    "code": "OUT_OF_STOCK",
    "message": "Some items are out of stock"
  }
}
```

## Field Descriptions

### Required Fields (order object)
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique order identifier in your POS system |
| `receiptNumber` | string | Human-readable receipt number (e.g., "RCP-001234") |
| `status` | string | Order status (e.g., "completed", "pending", "preparing") |
| `total` | number | Final total amount including tax and discounts |

### Optional Fields (order object)
| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp when order was created |
| `items` | array | Array of order items (see Item Structure below) |
| `subtotal` | number | Subtotal before tax and discounts |
| `tax` | number | Tax amount |
| `discount` | number | Discount amount (positive number) |
| `orderType` | string | Order type: "DELIVERY", "PICKUP", "DINE_IN", etc. |
| `cashierName` | string | Name of cashier who processed the order |
| `createdAt` | string | ISO 8601 timestamp when order was created in POS |
| `paymentMethod` | string | Payment method: "CASH", "CARD", "MOBILE", etc. |
| `estimatedTime` | number | Estimated preparation time in minutes |

### Item Structure
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Item name |
| `quantity` | number | Yes | Quantity ordered |
| `price` | number | Yes | Unit price |
| `subtotal` | number | Yes | Item subtotal (price × quantity + addons) |
| `productId` | string | No | Product ID in your system |
| `addons` | array | No | Array of addon objects |
| `notes` | string | No | Special instructions for this item |

### Addon Structure
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Addon name (e.g., "Extra Cheese") |
| `price` | number | Addon price |

### Error Codes
Use these standard error codes for better customer experience:

| Code | Customer Message |
|------|------------------|
| `INVALID_ITEMS` | Some items in your order are no longer available |
| `PAYMENT_REQUIRED` | Payment is required to complete your order |
| `STORE_CLOSED` | The store is currently closed |
| `OUT_OF_STOCK` | Some items are out of stock |
| `MINIMUM_NOT_MET` | Order does not meet minimum amount |
| `DELIVERY_UNAVAILABLE` | Delivery is not available at this time |
| `INVALID_ADDRESS` | Delivery address is invalid |
| `SYSTEM_ERROR` | Unable to process your order. Please try again |

## Implementation Examples

### Node.js / Socket.IO
```javascript
socket.on('pos:order:request', async (orderRequest) => {
  const { customerSocketId, requestId, customer, items } = orderRequest;
  
  try {
    // Process order in your POS system
    const order = await processOrder(customer, items);
    
    // Send success response with full details
    socket.emit('pos:order:response', {
      customerSocketId,
      requestId,
      success: true,
      order: {
        id: order.id,
        receiptNumber: order.receiptNumber,
        status: order.status,
        total: order.total,
        timestamp: new Date().toISOString(),
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          productId: item.productId,
          addons: item.addons,
          notes: item.notes
        })),
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        orderType: order.type,
        cashierName: getCurrentCashier(),
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod,
        estimatedTime: calculateEstimatedTime(order)
      }
    });
  } catch (error) {
    // Send error response
    socket.emit('pos:order:response', {
      customerSocketId,
      requestId,
      success: false,
      error: {
        code: error.code || 'SYSTEM_ERROR',
        message: error.message
      }
    });
  }
});
```

### Python / Socket.IO
```python
@sio.on('pos:order:request')
async def handle_order_request(sid, data):
    customer_socket_id = data['customerSocketId']
    request_id = data['requestId']
    
    try:
        # Process order
        order = await process_order(data['customer'], data['items'])
        
        # Send success response
        await sio.emit('pos:order:response', {
            'customerSocketId': customer_socket_id,
            'requestId': request_id,
            'success': True,
            'order': {
                'id': order.id,
                'receiptNumber': order.receipt_number,
                'status': order.status,
                'total': order.total,
                'timestamp': datetime.now().isoformat(),
                'items': [
                    {
                        'name': item.name,
                        'quantity': item.quantity,
                        'price': item.price,
                        'subtotal': item.subtotal
                    }
                    for item in order.items
                ],
                'subtotal': order.subtotal,
                'tax': order.tax,
                'discount': order.discount,
                'orderType': order.type,
                'cashierName': get_current_cashier(),
                'createdAt': order.created_at.isoformat(),
                'paymentMethod': order.payment_method,
                'estimatedTime': calculate_estimated_time(order)
            }
        })
    except Exception as e:
        # Send error response
        await sio.emit('pos:order:response', {
            'customerSocketId': customer_socket_id,
            'requestId': request_id,
            'success': False,
            'error': {
                'code': getattr(e, 'code', 'SYSTEM_ERROR'),
                'message': str(e)
            }
        })
```

## Best Practices

1. **Always include customerSocketId and requestId** - These are required for routing the response back to the customer

2. **Respond within 60 seconds** - After 60 seconds, customers receive a "still processing" message. Try to respond faster for better UX.

3. **Include as many optional fields as possible** - More details = better customer experience. Customers can see exactly what they ordered.

4. **Use standard error codes** - This ensures customers see user-friendly error messages instead of technical errors.

5. **Calculate accurate estimated times** - If you can't calculate it, omit the field rather than guessing.

6. **Include item details** - Customers want to see what they ordered. Include addons and notes if applicable.

7. **Validate totals** - Ensure subtotal + tax - discount = total before sending response.

8. **Use ISO 8601 timestamps** - Format: "2026-05-06T10:30:00.000Z" for consistency.

## What Happens After You Respond

1. **Backend validates** your response structure
2. **Customer socket** receives the response (if still connected)
3. **Push notification** sent to customer's device with order summary
4. **Order tracker** updated in database with order details
5. **Customer app** displays complete order information

## Backward Compatibility

The system is backward compatible. If you only send the required fields (id, receiptNumber, status, total), it will work fine. Optional fields enhance the customer experience but are not mandatory.

## Testing Your Integration

1. Send a minimal response (required fields only) - should work
2. Send a complete response (all fields) - should display rich details
3. Send an error response - should show user-friendly message
4. Test with disconnected customer - should receive push notification
5. Verify notification includes order details in data payload

## Support

For questions or issues with order response integration, check:
- Backend logs for validation errors
- Socket.IO connection status
- Response payload structure matches this guide
