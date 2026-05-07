# Order Handling & Notification Improvements

## Overview
Enhanced the customer order handling system to be more reliable and user-friendly by removing rigid timeouts, adding push notification support for order status updates, and including comprehensive order details in responses.

## Problems Solved

### 1. Rigid 30-Second Timeout
**Problem**: Orders were automatically cancelled after 30 seconds even if the cashier was still processing them, leading to poor user experience.

**Solution**: 
- Changed timeout from 30s to 60s monitoring-only timer
- Timeout no longer cancels orders or updates database status
- Instead, sends informational message to customer that order is still being processed
- Order remains valid until POS explicitly responds

### 2. No Notification for Disconnected Customers
**Problem**: If customer closed the app or lost connection before POS responded, they never received order status updates.

**Solution**:
- Integrated push notification system using Firebase Cloud Messaging (FCM)
- Notifications sent automatically when POS responds with order status
- Works for both connected and disconnected customers
- Uses customer FCM tokens stored in key-seat during connection

### 3. Missing Device Tracking
**Problem**: No way to identify which customer device to send notifications to.

**Solution**:
- Added `deviceId` field to `CustomerInfo` interface
- Store `deviceId` in socket data during customer connection
- Store `deviceId` with order request for notification lookup
- Match FCM tokens by `deviceId` for precise notification delivery

### 4. Limited Order Details in Response
**Problem**: Order responses only included basic information (id, receiptNumber, status, total), missing important details like items, payment method, and cashier info.

**Solution**:
- Extended `POSOrderResponse` interface to include comprehensive order details
- Added support for order items array with quantities and prices
- Included subtotal, tax, discount breakdown
- Added orderType, cashierName, paymentMethod, and timestamps
- All new fields are optional for backward compatibility
- Detailed information forwarded to both socket responses and push notifications

## Implementation Details

### Enhanced Order Response Structure

The POS order response now supports comprehensive order details:

```typescript
interface POSOrderResponse {
  customerSocketId: string;
  requestId: string;
  success: boolean;
  order?: {
    // Required fields
    id: string;
    receiptNumber: string;
    status: string;
    total: number;
    
    // Optional detailed fields
    timestamp?: string;
    items?: Array<{
      name: string;
      quantity: number;
      price: number;
      subtotal: number;
      productId?: string;
      addons?: Array<{
        name: string;
        price: number;
      }>;
      notes?: string;
    }>;
    subtotal?: number;
    tax?: number;
    discount?: number;
    orderType?: string;          // e.g., "DELIVERY", "PICKUP", "DINE_IN"
    cashierName?: string;
    createdAt?: string;
    paymentMethod?: string;      // e.g., "CASH", "CARD", "MOBILE"
    estimatedTime?: number;      // in minutes
  };
  error?: {
    code: string;
    message: string;
  };
}
```

### Example POS Response

```json
{
  "customerSocketId": "abc123",
  "requestId": "req-456",
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
        "subtotal": 30.00
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
    "discount": 0,
    "orderType": "DELIVERY",
    "cashierName": "John Doe",
    "createdAt": "2026-05-06T10:30:00.000Z",
    "paymentMethod": "CASH",
    "estimatedTime": 30
  }
}
```

### Files Created

1. **`src/socketio/utils/order-notification-helper.ts`**
   - Sends order status notifications to customer devices
   - Handles both success and failure cases with user-friendly messages
   - Matches FCM tokens by deviceId or falls back to most recent active token
   - Includes order details in notification payload

2. **`src/socketio/utils/customer-fcm-helper.ts`**
   - Low-level FCM notification sending utilities
   - Supports single device and multicast notifications
   - Handles invalid token detection and error logging
   - Configures platform-specific notification settings (Android/iOS)

3. **`src/socketio/utils/safe-logger.ts`**
   - Utility for sanitizing log data
   - Removes sensitive fields before logging
   - Supports deep sanitization

### Files Modified

1. **`src/socketio/handlers/customer-app.handler.ts`**
   - Changed timeout from 30s to 60s
   - Timeout now monitoring-only (doesn't cancel order)
   - Sends "still processing" message instead of error
   - Stores `deviceId` in socket data for notification lookup
   - Stores `deviceId` with each order request

2. **`src/socketio/handlers/pos-customer-response.handler.ts`**
   - Added notification sending after POS response
   - Sends notification regardless of customer connection status
   - Retrieves `deviceId` from customer socket data
   - Passes order details to notification helper
   - Logs notification success/failure

3. **`src/api/key-seat/utils/customer-validation.ts`**
   - Added `deviceId` field to `CustomerInfo` interface
   - Added `deviceId` sanitization in `validateOrderPayload`
   - Preserves `deviceId` through validation pipeline

## Notification Flow

### Success Case
```
1. Customer places order → stored with deviceId
2. POS processes order → responds with comprehensive details
3. Backend receives response:
   a. Validates all required and optional fields
   b. Forwards complete order details to customer socket (if connected)
   c. Sends push notification with order summary (always)
4. Customer receives notification:
   Title: "Order Confirmed! 🎉"
   Body: "Your order #12345 has been confirmed. 3 items - Total: $45.50 - Ready in 30 min"
   Data: {
     orderId, receiptNumber, status, total, estimatedTime,
     subtotal, tax, discount, orderType, cashierName,
     paymentMethod, items (JSON), itemsCount, timestamps
   }
5. Customer app can display:
   - Complete order breakdown
   - Individual items with quantities
   - Payment method used
   - Cashier who processed the order
   - Estimated preparation time
```

### Failure Case
```
1. Customer places order → stored with deviceId
2. POS rejects order → responds with error
3. Backend receives response:
   a. Forwards to customer socket (if connected)
   b. Sends push notification (always)
4. Customer receives notification:
   Title: "Order Issue"
   Body: User-friendly error message based on error code
   Data: { errorCode, errorMessage }
```

### Disconnected Customer
```
1. Customer places order → closes app
2. POS processes order → responds
3. Backend detects customer disconnected:
   a. Skips socket emit (no connection)
   b. Sends push notification (using stored deviceId)
4. Customer receives notification on device
```

## Error Code Mapping

The system translates technical error codes to user-friendly messages:

| Error Code | User Message |
|------------|--------------|
| `INVALID_ITEMS` | Some items in your order are no longer available |
| `PAYMENT_REQUIRED` | Payment is required to complete your order |
| `STORE_CLOSED` | The store is currently closed |
| `OUT_OF_STOCK` | Some items are out of stock |
| `MINIMUM_NOT_MET` | Order does not meet minimum amount |
| `DELIVERY_UNAVAILABLE` | Delivery is not available at this time |
| `INVALID_ADDRESS` | Delivery address is invalid |
| `SYSTEM_ERROR` | Unable to process your order. Please try again |

## Configuration

### FCM Token Storage
Customer FCM tokens are stored in `key-seat.customerFcmTokens` component:
```json
{
  "token": "fcm_token_string",
  "deviceId": "unique_device_id",
  "platform": "ios|android|web",
  "deviceName": "iPhone 13",
  "lastUpdatedAt": "2024-01-01T00:00:00.000Z",
  "isActive": true
}
```

### Notification Channels
- **Android**: Channel ID `orders` with high priority
- **iOS**: Default sound and badge support
- **Data payload**: Includes order details for deep linking

## Testing Recommendations

1. **Test timeout behavior**:
   - Place order and wait 60 seconds without POS response
   - Verify customer receives "still processing" message
   - Verify order NOT cancelled in database

2. **Test connected customer with basic response**:
   - Place order with customer app open
   - POS responds with minimal fields (id, receiptNumber, status, total)
   - Verify customer receives both socket response AND notification

3. **Test connected customer with detailed response**:
   - Place order with customer app open
   - POS responds with all optional fields (items, subtotal, tax, etc.)
   - Verify customer receives complete order details
   - Verify notification includes item count and detailed data payload

4. **Test disconnected customer**:
   - Place order then close customer app
   - POS responds after customer disconnects
   - Verify customer receives push notification with order details

5. **Test device matching**:
   - Connect with specific deviceId
   - Place order
   - Verify notification sent to correct device token

6. **Test error cases**:
   - Test each error code mapping
   - Verify user-friendly messages displayed
   - Verify error details in notification data

7. **Test order items display**:
   - Place order with multiple items
   - Verify items array properly forwarded to customer
   - Verify item quantities and subtotals calculated correctly
   - Verify addons and notes included if provided

8. **Test payment and order type fields**:
   - Test different orderType values (DELIVERY, PICKUP, DINE_IN)
   - Test different paymentMethod values (CASH, CARD, MOBILE)
   - Verify cashierName displayed correctly
   - Verify timestamps formatted properly

## Benefits

1. **Better UX**: Customers aren't told their order failed when it's still being processed
2. **Reliability**: Notifications ensure customers always get order status updates
3. **Flexibility**: Cashiers have more time to process orders without artificial timeouts
4. **Transparency**: Customers informed when orders take longer than expected
5. **Offline Support**: Customers receive updates even after closing the app
6. **Detailed Information**: Customers see complete order breakdown including items, pricing, and payment details
7. **Better Tracking**: Order type, cashier name, and timestamps provide full audit trail
8. **Rich Notifications**: Push notifications include comprehensive order data for deep linking and display

## Future Enhancements

1. Add order status polling endpoint for customers to check status manually
2. Implement retry logic for failed notifications
3. Add notification preferences (enable/disable order notifications)
4. Track notification delivery success rates
5. Add support for order status changes (preparing, ready, delivered)
