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
