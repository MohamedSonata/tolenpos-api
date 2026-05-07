/**
 * POS Customer Response Handler
 * Handles POS device responses to customer requests and forwards them to the requesting customer
 * Requirements: 10.1-10.7, 11.4
 * 
 * MULTI-REPLICA COMPATIBLE:
 * - Uses Socket.IO server instance to reach customers across all replicas
 * - Timeout cancellation handled via socket data
 * - Works seamlessly with Redis adapter
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';
import { SocketIOEvents } from '../events_constants';
import { ensureNoSensitiveData } from '../../api/key-seat/utils/customer-validation';
import { sendOrderStatusNotification } from '../utils/order-notification-helper';

/**
 * Interface for POS menu categories response payload
 */
interface POSMenuCategoriesResponse {
  customerSocketId: string;
  categories: any[];
  [key: string]: any;
}

/**
 * Interface for POS menu products response payload
 */
interface POSMenuProductsResponse {
  customerSocketId: string;
  products: any[];
  categoryId?: string;
  [key: string]: any;
}

/**
 * Interface for POS product scan response payload
 */
interface POSProductScanResponse {
  customerSocketId: string;
  product: any;
  barcode?: string;
  [key: string]: any;
}

/**
 * Interface for order item in POS response
 */
interface POSOrderItem {
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
}

/**
 * Interface for POS order creation response payload
 */
interface POSOrderResponse {
  customerSocketId: string;
  requestId: string;
  success: boolean;
  order?: {
    id: string;
    receiptNumber: string;
    status: string;
    total: number;
    timestamp?: string;
    items?: POSOrderItem[];
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
  [key: string]: any;
}

/**
 * Sets up POS customer response event handlers for Socket.IO connections
 * This should be called for connections with clientType: "pos"
 * @param socket - POS socket instance
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
export function setupPOSCustomerResponseHandlers(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  strapi.log.info(`[POSCustomerResponseHandler] Setting up handlers for POS socket ${socket.id}`);

  // Handle menu categories response
  handleMenuCategoriesResponse(socket, strapi, io);

  // Handle menu products response
  handleMenuProductsResponse(socket, strapi, io);

  // Handle product scan response
  handleProductScanResponse(socket, strapi, io);

  // Handle order creation response
  handlePOSOrderResponse(socket, strapi, io);
}

/**
 * Handles menu categories response from POS device
 * Requirements: 10.1, 10.2, 10.5, 10.6, 10.7, 11.4
 * @param socket - POS socket instance
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handleMenuCategoriesResponse(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnPOSMenuCategoriesResponse, async (payload: POSMenuCategoriesResponse) => {
    try {
      const { customerSocketId, categories, ...rest } = payload;

      if (!customerSocketId) {
        strapi.log.warn(`[POSCustomerResponseHandler] Menu categories response missing customerSocketId from POS ${socket.id}`);
        return;
      }

      strapi.log.info(`[POSCustomerResponseHandler] Received menu categories response from POS`, {
        posSocketId: socket.id,
        customerSocketId,
        categoriesCount: categories?.length || 0
      });

      // Sanitize response - remove sensitive fields that POS might have included
      const sanitizedRest = { ...rest };
      const sensitiveFields = [
        'token', 'licenseKey', 'userDocumentId', 'machineUUID', 
        'documentId', 'userId', 'keySeatId', 'license', 'user',
        'apiKey', 'password', 'encryptionKey'
      ];
      
      sensitiveFields.forEach(field => {
        delete sanitizedRest[field];
      });

      // Forward menu categories data to customer
      const responsePayload = {
        success: true,
        categories,
        ...sanitizedRest,
        timestamp: new Date().toISOString()
      };
      
      // Ensure no sensitive data in response before forwarding to customer
      try {
        ensureNoSensitiveData(responsePayload);
      } catch (sensitiveDataError) {
        strapi.log.error(`[POSCustomerResponseHandler] Sensitive data detected in POS response`, {
          posSocketId: socket.id,
          customerSocketId,
          responseType: 'menu:categories',
          error: sensitiveDataError.message,
          timestamp: new Date().toISOString()
        });
        // Send generic error to customer instead of potentially sensitive data
        // Use io.to() for cross-replica support
        io.to(customerSocketId).emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: 'Invalid response from POS device',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Emit to customer socket ID - works across replicas with Redis adapter
      io.to(customerSocketId).emit(SocketIOEvents.EmitCustomerMenuCategories, responsePayload);

      strapi.log.info(`[POSCustomerResponseHandler] Response forwarded successfully`, {
        posSocketId: socket.id,
        customerSocketId,
        responseType: 'menu:categories',
        categoriesCount: categories?.length || 0,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      strapi.log.error(`[POSCustomerResponseHandler] Error handling menu categories response`, {
        posSocketId: socket.id,
        error: error.message,
        stack: error.stack,
        responseType: 'menu:categories',
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Handles menu products response from POS device
 * Requirements: 10.3, 10.5, 10.6, 10.7, 11.4
 * @param socket - POS socket instance
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handleMenuProductsResponse(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnPOSMenuProductsResponse, async (payload: POSMenuProductsResponse) => {
    try {
      const { customerSocketId, products, categoryId, ...rest } = payload;

      if (!customerSocketId) {
        strapi.log.warn(`[POSCustomerResponseHandler] Menu products response missing customerSocketId from POS ${socket.id}`);
        return;
      }

      strapi.log.info(`[POSCustomerResponseHandler] Received menu products response from POS`, {
        posSocketId: socket.id,
        customerSocketId,
        productsCount: products?.length || 0,
        categoryId
      });

      // Sanitize response - remove sensitive fields that POS might have included
      const sanitizedRest = { ...rest };
      const sensitiveFields = [
        'token', 'licenseKey', 'userDocumentId', 'machineUUID', 
        'documentId', 'userId', 'keySeatId', 'license', 'user',
        'apiKey', 'password', 'encryptionKey'
      ];
      
      sensitiveFields.forEach(field => {
        delete sanitizedRest[field];
      });

      // Forward products data to customer
      const responsePayload = {
        success: true,
        products,
        categoryId,
        ...sanitizedRest,
        timestamp: new Date().toISOString()
      };
      
      // Ensure no sensitive data in response before forwarding to customer
      try {
        ensureNoSensitiveData(responsePayload);
      } catch (sensitiveDataError) {
        strapi.log.error(`[POSCustomerResponseHandler] Sensitive data detected in POS response`, {
          posSocketId: socket.id,
          customerSocketId,
          responseType: 'menu:products',
          error: sensitiveDataError.message,
          timestamp: new Date().toISOString()
        });
        // Send generic error to customer instead of potentially sensitive data
        // Use io.to() for cross-replica support
        io.to(customerSocketId).emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: 'Invalid response from POS device',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Emit to customer socket ID - works across replicas with Redis adapter
      io.to(customerSocketId).emit(SocketIOEvents.EmitCustomerMenuProducts, responsePayload);

      strapi.log.info(`[POSCustomerResponseHandler] Response forwarded successfully`, {
        posSocketId: socket.id,
        customerSocketId,
        responseType: 'menu:products',
        productsCount: products?.length || 0,
        categoryId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      strapi.log.error(`[POSCustomerResponseHandler] Error handling menu products response`, {
        posSocketId: socket.id,
        error: error.message,
        stack: error.stack,
        responseType: 'menu:products',
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Handles product scan response from POS device
 * Requirements: 10.4, 10.5, 10.6, 10.7, 11.4
 * @param socket - POS socket instance
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handleProductScanResponse(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnPOSProductScanResponse, async (payload: POSProductScanResponse) => {
    try {
      const { customerSocketId, product, barcode, ...rest } = payload;

      if (!customerSocketId) {
        strapi.log.warn(`[POSCustomerResponseHandler] Product scan response missing customerSocketId from POS ${socket.id}`);
        return;
      }

      strapi.log.info(`[POSCustomerResponseHandler] Received product scan response from POS`, {
        posSocketId: socket.id,
        customerSocketId,
        barcode,
        hasProduct: !!product
      });

      // Sanitize response - remove sensitive fields that POS might have included
      const sanitizedRest = { ...rest };
      const sensitiveFields = [
        'token', 'licenseKey', 'userDocumentId', 'machineUUID', 
        'documentId', 'userId', 'keySeatId', 'license', 'user',
        'apiKey', 'password', 'encryptionKey'
      ];
      
      sensitiveFields.forEach(field => {
        delete sanitizedRest[field];
      });

      // Forward product data to customer
      const responsePayload = {
        success: true,
        product,
        barcode,
        ...sanitizedRest,
        timestamp: new Date().toISOString()
      };
      
      // Ensure no sensitive data in response before forwarding to customer
      try {
        ensureNoSensitiveData(responsePayload);
      } catch (sensitiveDataError) {
        strapi.log.error(`[POSCustomerResponseHandler] Sensitive data detected in POS response`, {
          posSocketId: socket.id,
          customerSocketId,
          responseType: 'product:scan',
          error: sensitiveDataError.message,
          timestamp: new Date().toISOString()
        });
        // Send generic error to customer instead of potentially sensitive data
        // Use io.to() for cross-replica support
        io.to(customerSocketId).emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: 'Invalid response from POS device',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Emit to customer socket ID - works across replicas with Redis adapter
      io.to(customerSocketId).emit(SocketIOEvents.EmitCustomerProductData, responsePayload);

      strapi.log.info(`[POSCustomerResponseHandler] Response forwarded successfully`, {
        posSocketId: socket.id,
        customerSocketId,
        responseType: 'product:scan',
        barcode,
        hasProduct: !!product,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      strapi.log.error(`[POSCustomerResponseHandler] Error handling product scan response`, {
        posSocketId: socket.id,
        error: error.message,
        stack: error.stack,
        responseType: 'product:scan',
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Handles order creation response from POS device
 * Requirements: 8.9, 8.10, 9.1-9.14, 10.1-10.12, 13.8, 13.9, 17.1-17.10
 * @param socket - POS socket instance
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handlePOSOrderResponse(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnPOSOrderResponse, async (payload: POSOrderResponse) => {
    try {
      const { customerSocketId, requestId, success, order, error, ...rest } = payload;

      // Extract customerSocketId and requestId from payload (Req 9.1, 9.2)
      if (!customerSocketId) {
        strapi.log.warn(`[POSCustomerResponseHandler] Order response missing customerSocketId from POS ${socket.id}`);
        return;
      }

      if (!requestId) {
        strapi.log.warn(`[POSCustomerResponseHandler] Order response missing requestId from POS ${socket.id}`);
        return;
      }

      strapi.log.info(`[POSCustomerResponseHandler] Received order response from POS`, {
        posSocketId: socket.id,
        customerSocketId,
        requestId,
        success
      });

      // Cancel timeout timer using requestId (Req 8.9, 8.10, 9.3)
      // Find the customer socket to clear the timeout
      const customerSocket = io.sockets.sockets.get(customerSocketId);
      if (customerSocket?.data) {
        const timeoutKey = `timeout:order:${requestId}`;
        const timeoutId = customerSocket.data[timeoutKey];
        if (timeoutId) {
          clearTimeout(timeoutId);
          delete customerSocket.data[timeoutKey];
          strapi.log.info(`[POSCustomerResponseHandler] Timeout cancelled for order`, {
            requestId,
            customerSocketId
          });
        }
      }

      // Validate response structure: success field required (Req 9.4)
      if (typeof success !== 'boolean') {
        strapi.log.error(`[POSCustomerResponseHandler] Invalid response structure - success field missing or invalid`, {
          posSocketId: socket.id,
          requestId,
          customerSocketId
        });
        return;
      }

      // If success is true, validate order object (Req 9.5, 9.6)
      if (success) {
        if (!order || typeof order !== 'object') {
          strapi.log.error(`[POSCustomerResponseHandler] Invalid success response - order object missing`, {
            posSocketId: socket.id,
            requestId,
            customerSocketId
          });
          return;
        }

        // Validate required fields
        if (!order.id || !order.receiptNumber || !order.status || typeof order.total !== 'number') {
          strapi.log.error(`[POSCustomerResponseHandler] Invalid order object - missing required fields`, {
            posSocketId: socket.id,
            requestId,
            customerSocketId,
            hasId: !!order.id,
            hasReceiptNumber: !!order.receiptNumber,
            hasStatus: !!order.status,
            hasTotal: typeof order.total === 'number'
          });
          return;
        }

        // Validate optional items array if provided
        if (order.items && !Array.isArray(order.items)) {
          strapi.log.error(`[POSCustomerResponseHandler] Invalid order object - items must be an array`, {
            posSocketId: socket.id,
            requestId,
            customerSocketId
          });
          return;
        }
      }

      // If success is false, validate error object (Req 9.7, 9.8)
      if (!success) {
        if (!error || typeof error !== 'object') {
          strapi.log.error(`[POSCustomerResponseHandler] Invalid failure response - error object missing`, {
            posSocketId: socket.id,
            requestId,
            customerSocketId
          });
          return;
        }

        if (!error.code || !error.message) {
          strapi.log.error(`[POSCustomerResponseHandler] Invalid error object - missing code or message`, {
            posSocketId: socket.id,
            requestId,
            customerSocketId,
            hasCode: !!error.code,
            hasMessage: !!error.message
          });
          return;
        }
      }

      // Update Order_Request_Tracker record by requestId (Req 9.9)
      try {
        const updateData: any = {};

        if (success) {
          // If success, set status to "completed", orderId, receiptNumber (Req 9.10)
          updateData.status = 'completed';
          updateData.orderId = order.id;
          updateData.receiptNumber = order.receiptNumber;
        } else {
          // If failure, set status to "failed", errorCode, errorMessage (Req 9.11)
          updateData.status = 'failed';
          updateData.errorCode = error.code;
          updateData.errorMessage = error.message;
        }

        const trackers = await strapi.documents('api::order-request.order-request').findMany({
          filters: { requestId },
          status: 'published'
        });

        if (trackers.length > 0) {
          await strapi.documents('api::order-request.order-request').update({
            documentId: trackers[0].documentId,
            data: updateData
          });

          strapi.log.info(`[POSCustomerResponseHandler] Order tracker updated`, {
            requestId,
            status: updateData.status,
            orderId: updateData.orderId,
            errorCode: updateData.errorCode
          });
        } else {
          strapi.log.warn(`[POSCustomerResponseHandler] Order tracker not found for requestId`, {
            requestId
          });
        }
      } catch (trackerError) {
        strapi.log.error(`[POSCustomerResponseHandler] Failed to update order tracker`, {
          requestId,
          error: trackerError.message,
          stack: trackerError.stack
        });
        // Continue processing - tracker update failure shouldn't block customer response
      }

      // Sanitize response to remove sensitive POS data (Req 10.11, 13.8, 13.9)
      const sanitizedRest = { ...rest };
      const sensitiveFields = [
        'token', 'licenseKey', 'userDocumentId', 'machineUUID', 
        'documentId', 'userId', 'keySeatId', 'license', 'user',
        'apiKey', 'password', 'encryptionKey', 'ownerId', 'fcmTokens',
        'telemetry', 'encryptionKey'
      ];
      
      sensitiveFields.forEach(field => {
        delete sanitizedRest[field];
      });

      // Build sanitized response payload
      const responsePayload: any = {
        success,
        requestId,
        timestamp: new Date().toISOString()
      };

      if (success && order) {
        responsePayload.order = {
          id: order.id,
          receiptNumber: order.receiptNumber,
          status: order.status,
          total: order.total
        };

        // Add optional fields if provided
        if (order.timestamp) responsePayload.order.timestamp = order.timestamp;
        if (order.items) responsePayload.order.items = order.items;
        if (typeof order.subtotal === 'number') responsePayload.order.subtotal = order.subtotal;
        if (typeof order.tax === 'number') responsePayload.order.tax = order.tax;
        if (typeof order.discount === 'number') responsePayload.order.discount = order.discount;
        if (order.orderType) responsePayload.order.orderType = order.orderType;
        if (order.cashierName) responsePayload.order.cashierName = order.cashierName;
        if (order.createdAt) responsePayload.order.createdAt = order.createdAt;
        if (order.paymentMethod) responsePayload.order.paymentMethod = order.paymentMethod;
        if (typeof order.estimatedTime === 'number') responsePayload.order.estimatedTime = order.estimatedTime;
      }

      if (!success && error) {
        responsePayload.error = {
          code: error.code,
          message: error.message
        };
      }

      // Add any other non-sensitive fields
      Object.assign(responsePayload, sanitizedRest);

      // Ensure no sensitive data in response before forwarding to customer (Req 10.10)
      try {
        ensureNoSensitiveData(responsePayload);
      } catch (sensitiveDataError) {
        strapi.log.error(`[POSCustomerResponseHandler] Sensitive data detected in POS order response`, {
          posSocketId: socket.id,
          customerSocketId,
          requestId,
          error: sensitiveDataError.message,
          timestamp: new Date().toISOString()
        });
        // Send generic error to customer instead of potentially sensitive data
        io.to(customerSocketId).emit(SocketIOEvents.EmitCustomerOrderResponse, {
          success: false,
          requestId,
          error: {
            code: 'ROUTING_ERROR',
            message: 'Failed to process order response'
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Forward sanitized response to customer via io.to(customerSocketId) (Req 9.12, 9.13, 10.1-10.9)
      // Handle disconnected customer sockets gracefully (Req 10.12)
      const customerSocketExists = io.sockets.sockets.has(customerSocketId);
      
      if (!customerSocketExists) {
        strapi.log.warn(`[POSCustomerResponseHandler] Customer socket disconnected - will send notification instead`, {
          customerSocketId,
          requestId,
          success
        });
      } else {
        // Emit to customer socket ID - works across replicas with Redis adapter
        io.to(customerSocketId).emit(SocketIOEvents.EmitCustomerOrderResponse, responsePayload);
      }

      // Send push notification as backup or for disconnected customers
      // This ensures customer gets order status even if they closed the app
      try {
        // Get the key-seat document ID from POS socket data
        const keySeatDocumentId = socket.data.keySeatDocumentId;
        
        if (keySeatDocumentId) {
          // Try to get deviceId from customer socket if still connected
          let deviceId: string | undefined;
          const customerSocket = io.sockets.sockets.get(customerSocketId);
          if (customerSocket?.data) {
            deviceId = customerSocket.data.customerDeviceId || 
                      customerSocket.data[`order:${requestId}:deviceId`];
          }

          await sendOrderStatusNotification(
            strapi,
            keySeatDocumentId,
            customerSocketId,
            {
              requestId,
              success,
              order,
              error
            },
            deviceId
          );
        } else {
          strapi.log.warn(`[POSCustomerResponseHandler] Cannot send notification - keySeatDocumentId not found in POS socket data`, {
            posSocketId: socket.id,
            requestId
          });
        }
      } catch (notificationError) {
        strapi.log.error(`[POSCustomerResponseHandler] Failed to send order notification`, {
          requestId,
          error: notificationError.message
        });
        // Don't block the response flow if notification fails
      }

      // Log response received, tracker updated, and forwarding success (Req 9.14, 17.10)
      strapi.log.info(`[POSCustomerResponseHandler] Order response processed successfully`, {
        posSocketId: socket.id,
        customerSocketId,
        requestId,
        success,
        orderId: order?.id,
        errorCode: error?.code,
        customerConnected: customerSocketExists,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      strapi.log.error(`[POSCustomerResponseHandler] Error handling order response`, {
        posSocketId: socket.id,
        error: error.message,
        stack: error.stack,
        responseType: 'order:create',
        timestamp: new Date().toISOString()
      });
    }
  });
}
