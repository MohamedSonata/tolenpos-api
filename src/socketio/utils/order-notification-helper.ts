/**
 * Order Notification Helper
 * Sends push notifications for order status updates
 */

import type { Core } from '@strapi/strapi';
import { sendPushNotificationToCustomerDevice } from './customer-fcm-helper';

interface OrderNotificationPayload {
  requestId: string;
  success: boolean;
  order?: {
    id: string;
    receiptNumber: string;
    status: string;
    total: number;
    timestamp?: string;
    items?: Array<{
      name: string;
      quantity: number;
      price: number;
      subtotal: number;
    }>;
    subtotal?: number;
    tax?: number;
    discount?: number;
    orderType?: string;
    cashierName?: string;
    createdAt?: string;
    paymentMethod?: string;
    estimatedTime?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Sends order status notification to customer device
 * @param strapi - Strapi instance
 * @param keySeatDocumentId - Key-Seat document ID
 * @param customerSocketId - Customer socket ID (used for logging)
 * @param payload - Order notification payload
 * @param deviceId - Optional device ID for precise token matching
 */
export async function sendOrderStatusNotification(
  strapi: Core.Strapi,
  keySeatDocumentId: string,
  customerSocketId: string,
  payload: OrderNotificationPayload,
  deviceId?: string
): Promise<void> {
  try {
    // Fetch key-seat with customer FCM tokens
    const seat = await strapi.documents('api::key-seat.key-seat').findOne({
      documentId: keySeatDocumentId,
      populate: { customerFcmTokens: true },
      status: 'published'
    });

    if (!seat || !seat.customerFcmTokens || seat.customerFcmTokens.length === 0) {
      strapi.log.warn(`[OrderNotification] No customer FCM tokens found for seat ${keySeatDocumentId}`);
      return;
    }

    // Find the FCM token matching the customer's device
    const customerTokens = seat.customerFcmTokens as any[];
    let targetToken: any;

    if (deviceId) {
      // Try to find exact device match
      targetToken = customerTokens.find(
        (t: any) => t.deviceId === deviceId && t.isActive !== false
      );
    }

    // Fallback to most recent active token if no device match
    if (!targetToken) {
      targetToken = customerTokens
        .filter((t: any) => t.isActive !== false)
        .sort((a: any, b: any) => {
          const dateA = new Date(a.lastUpdatedAt || 0).getTime();
          const dateB = new Date(b.lastUpdatedAt || 0).getTime();
          return dateB - dateA;
        })[0];
    }

    if (!targetToken) {
      strapi.log.warn(`[OrderNotification] No active customer FCM token found for seat ${keySeatDocumentId}`);
      return;
    }

    // Prepare notification content
    let title: string;
    let body: string;
    const data: Record<string, string> = {
      type: 'order_status',
      requestId: payload.requestId,
      success: String(payload.success)
    };

    if (payload.success && payload.order) {
      title = 'Order Confirmed! 🎉';
      
      // Build detailed body message
      let bodyParts: string[] = [
        `Your order #${payload.order.receiptNumber} has been confirmed.`
      ];
      
      // Add item count if available
      if (payload.order.items && payload.order.items.length > 0) {
        const itemCount = payload.order.items.reduce((sum, item) => sum + item.quantity, 0);
        bodyParts.push(`${itemCount} item${itemCount > 1 ? 's' : ''}`);
      }
      
      // Add total
      bodyParts.push(`Total: $${payload.order.total.toFixed(2)}`);
      
      // Add estimated time if available
      if (payload.order.estimatedTime) {
        bodyParts.push(`Ready in ${payload.order.estimatedTime} min`);
      }
      
      body = bodyParts.join(' - ');
      
      // Add order details to data payload
      data.orderId = payload.order.id;
      data.receiptNumber = payload.order.receiptNumber;
      data.status = payload.order.status;
      data.total = String(payload.order.total);
      
      if (payload.order.timestamp) data.timestamp = payload.order.timestamp;
      if (payload.order.subtotal !== undefined) data.subtotal = String(payload.order.subtotal);
      if (payload.order.tax !== undefined) data.tax = String(payload.order.tax);
      if (payload.order.discount !== undefined) data.discount = String(payload.order.discount);
      if (payload.order.orderType) data.orderType = payload.order.orderType;
      if (payload.order.cashierName) data.cashierName = payload.order.cashierName;
      if (payload.order.createdAt) data.createdAt = payload.order.createdAt;
      if (payload.order.paymentMethod) data.paymentMethod = payload.order.paymentMethod;
      if (payload.order.estimatedTime) data.estimatedTime = String(payload.order.estimatedTime);
      
      // Add items summary to data (as JSON string)
      if (payload.order.items) {
        data.itemsCount = String(payload.order.items.length);
        data.items = JSON.stringify(payload.order.items);
      }
    } else if (!payload.success && payload.error) {
      title = 'Order Issue';
      body = getErrorMessage(payload.error.code, payload.error.message);
      data.errorCode = payload.error.code;
      data.errorMessage = payload.error.message;
    } else {
      title = 'Order Update';
      body = 'Your order status has been updated';
    }

    // Send notification to the specific device
    await sendPushNotificationToCustomerDevice(
      strapi,
      targetToken.token,
      {
        title,
        body,
        data
      }
    );

    strapi.log.info(`[OrderNotification] Sent order notification`, {
      keySeatDocumentId,
      customerSocketId,
      requestId: payload.requestId,
      success: payload.success,
      deviceId: targetToken.deviceId,
      fcmToken: targetToken.token.substring(0, 20) + '...'
    });

  } catch (error) {
    strapi.log.error(`[OrderNotification] Error sending order notification`, {
      keySeatDocumentId,
      customerSocketId,
      requestId: payload.requestId,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Converts error codes to user-friendly messages
 */
function getErrorMessage(code: string, defaultMessage: string): string {
  const errorMessages: Record<string, string> = {
    'INVALID_ITEMS': 'Some items in your order are no longer available',
    'PAYMENT_REQUIRED': 'Payment is required to complete your order',
    'STORE_CLOSED': 'The store is currently closed',
    'OUT_OF_STOCK': 'Some items are out of stock',
    'MINIMUM_NOT_MET': 'Order does not meet minimum amount',
    'DELIVERY_UNAVAILABLE': 'Delivery is not available at this time',
    'INVALID_ADDRESS': 'Delivery address is invalid',
    'SYSTEM_ERROR': 'Unable to process your order. Please try again'
  };

  return errorMessages[code] || defaultMessage || 'Unable to process your order';
}
