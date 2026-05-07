/**
 * Customer App Socket Handler
 * Handles customer-facing mobile app connections and interactions with POS devices
 * Requirements: 6.1-6.15, 7.1-7.7, 8.1-8.9, 9.1-9.7, 11.1-11.5, 12.1-12.6, 19.4-19.11
 * 
 * MULTI-REPLICA COMPATIBLE:
 * - Uses room-based communication for POS device routing
 * - Connection counts persisted to database
 * - Works across all replicas seamlessly
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';
import { SocketIOEvents } from '../events_constants';
import {
  validateConnectionPayload,
  validateMenuRequest,
  validateBarcodeScanPayload,
  validateOrderPayload
} from '../../api/key-seat/utils/customer-validation';
import { safeLogger } from '../utils/safe-logger';

/**
 * Interface for customer connection payload
 */
interface CustomerConnectPayload {
  publicSeatId: string;
  fcmToken?: string;
  deviceId?: string;
  deviceName?: string;
  platform?: 'ios' | 'android' | 'web';
}

/**
 * Interface for menu category request payload
 */
interface MenuCategoriesPayload {
  // Optional filters or parameters
  [key: string]: any;
}

/**
 * Interface for menu products request payload
 */
interface MenuProductsPayload {
  categoryId?: string;
  [key: string]: any;
}

/**
 * Interface for barcode scan payload
 */
interface BarcodeScanPayload {
  barcode: string;
  [key: string]: any;
}

/**
 * Sets up customer app event handlers for Socket.IO connections
 * This should be called for connections with clientType: "customer"
 * @param socket - Socket instance
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
export function setupCustomerAppHandlers(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  const clientType = socket.data?.clientType || 'customer';
  strapi.log.info(`[CustomerAppHandler] Setting up handlers for ${clientType} socket ${socket.id}`);

  // Handle customer connection
  handleCustomerConnection(socket, strapi, io);

  // Handle explicit customer disconnection
  handleExplicitDisconnection(socket, strapi, io);

  // Handle menu browsing
  handleMenuBrowsing(socket, strapi, io);

  // Handle barcode scanning
  handleBarcodeScanning(socket, strapi, io);

  // Handle customer order creation
  handleCustomerOrderCreation(socket, strapi, io);

  // Handle disconnection
  handleCustomerDisconnection(socket, strapi, io);
}

/**
 * Handles customer connection to a specific POS seat
 * Requirements: 6.1-6.15, 7.1-7.7, 19.4-19.11
 * @param socket - Socket instance for the customer
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handleCustomerConnection(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnCustomerConnect, async (payload: CustomerConnectPayload) => {
    try {
      const dd= safeLogger({    socketId: socket.id,
        clientType: socket.data?.clientType,
        hasPayload: !!payload,
        payloadKeys: payload ? Object.keys(payload) : [],
        publicSeatId: payload?.publicSeatId},true);
      strapi.log.info(`[CustomerAppHandler] Received connection payload ${dd}`);

      // Validate and sanitize connection payload
      const validation = validateConnectionPayload(payload);
      
      if (!validation.valid) {
        socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
          success: false,
          error: validation.error || 'Invalid connection payload',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Connection rejected - Validation failed`, {
          socketId: socket.id,
          error: validation.error,
          reason: 'Validation failed'
        });
        return;
      }

      const { publicSeatId, fcmToken, deviceId, deviceName, platform } = validation.sanitized!;

      strapi.log.info(`[CustomerAppHandler] Connection request from socket ${socket.id}`, {
        publicSeatId,
        hasFcmToken: !!fcmToken
      });

      // Query seat with all necessary fields
      const seats = await strapi.documents('api::key-seat.key-seat').findMany({
        filters: {
          publicSeatId,
          isActive: true,
          allowCustomerApp: true
        },
        populate: {
          license: true
          // Don't populate customerFcmTokens to avoid component issues
        },
        status: 'published'
      });

      if (seats.length === 0) {
        socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
          success: false,
          error: 'Seat not found or customer app not enabled',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Connection rejected - Seat not found or customer app disabled`, {
          socketId: socket.id,
          publicSeatId,
          reason: 'Seat not found or customer app disabled'
        });
        return;
      }

      const seat = seats[0] as any;

      // Verify POS device is connected (isConnected is true)
      if (!seat.isConnected) {
        socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
          success: false,
          error: 'POS device is currently offline',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Connection rejected - POS device offline`, {
          socketId: socket.id,
          publicSeatId,
          seatDocumentId: seat.documentId,
          reason: 'POS offline'
        });
        return;
      }

      // Check connection limit
      const currentConnections = seat.currentCustomerConnections || 0;
      const maxConnections = seat.maxCustomerConnections || 50;

      if (currentConnections >= maxConnections) {
        socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
          success: false,
          error: 'Connection limit reached',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Connection rejected - Connection limit reached`, {
          socketId: socket.id,
          publicSeatId,
          seatDocumentId: seat.documentId,
          currentConnections,
          maxConnections,
          reason: 'Connection limit reached'
        });
        return;
      }

      // Join customer socket to seat-specific room
      const seatRoom = `seat:${seat.documentId}:customers`;
      socket.join(seatRoom);

      // Store seat information in socket data
      socket.data.connectedSeatId = seat.documentId;
      socket.data.publicSeatId = publicSeatId;
      socket.data.allowMenuBrowsing = seat.allowMenuBrowsing;
      socket.data.allowBarcodeScanning = seat.allowBarcodeScanning;
      socket.data.allowCustomerOrdering = seat.allowCustomerOrdering;
      socket.data.connectionStartTime = Date.now(); // Track connection start time for duration calculation
      socket.data.customerDeviceId = deviceId; // Store deviceId for notification lookup

      // Prepare update data
      const updateData: any = {
        currentCustomerConnections: currentConnections + 1
      };

      // Handle FCM token storage if provided (typically for mobile apps, not websites)
      if (fcmToken && deviceId) {
        try {
          // Fetch seat with customerFcmTokens populated
          const seatWithTokens = await strapi.documents('api::key-seat.key-seat').findOne({
            documentId: seat.documentId,
            populate: ['customerFcmTokens'],
            status: 'published'
          });

          const existingTokens = (seatWithTokens?.customerFcmTokens || []) as any[];
          const existingTokenIndex = existingTokens.findIndex(
            (t: any) => t.token === fcmToken || t.deviceId === deviceId
          );

          if (existingTokenIndex >= 0) {
            // Update existing token
            const updatedTokens = existingTokens.map((t: any, index: number) => {
              if (index === existingTokenIndex) {
                return {
                  // id: t.id, // Keep the component ID
                  token: fcmToken,
                  deviceId: t.deviceId,
                  platform: t.platform,
                  deviceName: t.deviceName || 'Unknown Device',
                  lastUpdatedAt: new Date().toISOString(),
                  isActive: true
                };
              }
              return t;
            });
            updateData.customerFcmTokens = updatedTokens;
            strapi.log.info(`[CustomerAppHandler] Updated existing FCM token for device: ${deviceId}`);
          } else {
            // Add new FCM token
            const newToken = {
              token: fcmToken,
              deviceId,
              platform: platform || 'web',
              deviceName: deviceName || 'Unknown Device',
              lastUpdatedAt: new Date().toISOString(),
              isActive: true
            };
            updateData.customerFcmTokens = [...existingTokens, newToken];
            strapi.log.info(`[CustomerAppHandler] Added new FCM token for device: ${deviceId}`);
          }
        } catch (fcmError) {
          // Log FCM token error but don't fail the connection
          strapi.log.warn(`[CustomerAppHandler] Failed to update FCM token, continuing without it`, {
            socketId: socket.id,
            deviceId,
            error: fcmError.message
          });
        }
      }

      // Update seat with connection count and optionally FCM tokens
      await strapi.documents('api::key-seat.key-seat').update({
        documentId: seat.documentId,
        status: 'published',
        data: updateData
      });

      // Notify POS device about customer connection
      const posRoom = `pos:${seat.documentId}`;
      io.to(posRoom).emit(SocketIOEvents.EmitPOSCustomerConnected, {
        publicSeatId,
        currentConnections: currentConnections + 1,
        maxConnections,
        timestamp: new Date().toISOString()
      });

      // Emit success with business info
      socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
        success: true,
        businessName: seat.businessName,
        businessType: seat.businessType,
        features: {
          allowMenuBrowsing: seat.allowMenuBrowsing,
          allowBarcodeScanning: seat.allowBarcodeScanning,
          allowCustomerOrdering: seat.allowCustomerOrdering
        },
        timestamp: new Date().toISOString()
      });

      strapi.log.info(`[CustomerAppHandler] Customer connected successfully`, {
        socketId: socket.id,
        publicSeatId,
        seatDocumentId: seat.documentId,
        businessName: seat.businessName,
        businessType: seat.businessType,
        currentConnections: currentConnections + 1,
        maxConnections,
        features: {
          allowMenuBrowsing: seat.allowMenuBrowsing,
          allowBarcodeScanning: seat.allowBarcodeScanning,
          allowCustomerOrdering: seat.allowCustomerOrdering
        }
      });

    } catch (error) {
      const errsaelog = safeLogger( {
        socketId: socket.id,
        publicSeatId: payload?.publicSeatId,
        clientType: socket.data?.clientType,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      },true);
      console.log('errsaelog',errsaelog);
      strapi.log.error(`[CustomerAppHandler] Error handling customer connection${errsaelog}`);
      socket.emit(SocketIOEvents.EmitCustomerConnectSuccess, {
        success: false,
        error: 'Failed to connect to seat',
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Handles explicit customer disconnection request (before socket closes)
 * Requirements: 12.1-12.6
 * @param socket - Socket instance for the customer
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handleExplicitDisconnection(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnCustomerDisconnect, async () => {
    try {
      const { connectedSeatId, publicSeatId, connectionStartTime } = socket.data;

      if (!connectedSeatId) {
        strapi.log.warn(`[CustomerAppHandler] Explicit disconnect request without seat connection`, {
          socketId: socket.id
        });
        return;
      }

      // Calculate connection duration
      const connectionDuration = connectionStartTime 
        ? Math.floor((Date.now() - connectionStartTime) / 1000) 
        : 0;

      // Retrieve current seat data
      const seat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId: connectedSeatId
      });

      if (!seat) {
        strapi.log.warn(`[CustomerAppHandler] Seat not found during explicit disconnection`, {
          socketId: socket.id,
          seatDocumentId: connectedSeatId,
          publicSeatId
        });
        return;
      }

      // Decrement currentCustomerConnections by 1
      const currentConnections = seat.currentCustomerConnections || 0;
      const newConnectionCount = Math.max(0, currentConnections - 1);

      // Persist updated connection count to database
      await strapi.documents('api::key-seat.key-seat').update({
        documentId: connectedSeatId,
        data: {
          currentCustomerConnections: newConnectionCount
        }
      });

      // Notify POS device about customer disconnection
      const posRoom = `pos:${connectedSeatId}`;
      io.to(posRoom).emit(SocketIOEvents.EmitPOSCustomerDisconnected, {
        publicSeatId,
        currentConnections: newConnectionCount,
        connectionDurationSeconds: connectionDuration,
        timestamp: new Date().toISOString()
      });

      // Remove socket from seat-specific rooms
      const seatRoom = `seat:${connectedSeatId}:customers`;
      socket.leave(seatRoom);

      // Clear any pending order timeout timers
      // Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
      let orderTimersCleared = 0;
      Object.keys(socket.data).forEach(key => {
        if (key.startsWith('timeout:order:')) {
          clearTimeout(socket.data[key]);
          delete socket.data[key];
          orderTimersCleared++;
        }
      });

      // Clear any other pending timeout timers (menu, barcode, etc.)
      Object.keys(socket.data).forEach(key => {
        if (key.startsWith('timeout:') && !key.startsWith('timeout:order:')) {
          clearTimeout(socket.data[key]);
          delete socket.data[key];
        }
      });

      // Log order timeout cleanup if any were cleared
      if (orderTimersCleared > 0) {
        strapi.log.info(`[CustomerAppHandler] Cleared pending order timeout timers`, {
          socketId: socket.id,
          orderTimersCleared
        });
      }

      // Clear socket data
      socket.data.connectedSeatId = undefined;
      socket.data.publicSeatId = undefined;
      socket.data.allowMenuBrowsing = undefined;
      socket.data.allowBarcodeScanning = undefined;
      socket.data.allowCustomerOrdering = undefined;
      socket.data.connectionStartTime = undefined;

      strapi.log.info(`[CustomerAppHandler] Customer explicitly disconnected`, {
        socketId: socket.id,
        publicSeatId,
        seatDocumentId: connectedSeatId,
        connectionDurationSeconds: connectionDuration,
        previousConnections: currentConnections,
        newConnections: newConnectionCount
      });

    } catch (error) {
      // During shutdown, database queries may fail - handle gracefully
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('Timeout') || errorMessage.includes('pool') || errorMessage.includes('aborted')) {
        strapi.log.debug(`[CustomerAppHandler] Database unavailable during explicit disconnect (likely shutting down)`);
      } else {
        strapi.log.error(`[CustomerAppHandler] Error handling explicit customer disconnection`, {
          socketId: socket.id,
          error: errorMessage,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
}

/**
 * Handles menu browsing requests from customers (restaurant/cafe)
 * Requirements: 8.1-8.9, 11.1-11.5
 * @param socket - Socket instance for the customer
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handleMenuBrowsing(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  // Handle menu categories request
  socket.on(SocketIOEvents.OnCustomerMenuCategories, async (payload: MenuCategoriesPayload) => {
    try {
      const { connectedSeatId, allowMenuBrowsing } = socket.data;

      // Verify customer is connected to a seat
      if (!connectedSeatId) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: 'Not connected to a seat',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request rejected - Not connected to a seat`, {
          socketId: socket.id,
          requestType: 'menu:categories',
          reason: 'Not connected'
        });
        return;
      }

      // Verify allowMenuBrowsing is true
      if (!allowMenuBrowsing) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: 'Menu browsing not enabled',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request rejected - Menu browsing not enabled`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'menu:categories',
          reason: 'Feature disabled'
        });
        return;
      }

      // Validate and sanitize menu request payload
      const validation = validateMenuRequest(payload);
      
      if (!validation.valid) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: validation.error || 'Invalid request payload',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request rejected - Invalid payload`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'menu:categories',
          error: validation.error,
          reason: 'Invalid payload'
        });
        return;
      }

      // Forward request to POS device via seat-specific room
      // POS devices join room: pos:${keySeatDocumentId}
      const posRoom = `pos:${connectedSeatId}`;
      const requestPayload = {
        customerSocketId: socket.id,
        ...validation.sanitized
      };

      io.to(posRoom).emit(SocketIOEvents.EmitPOSMenuCategoriesRequest, requestPayload);

      // Start 10-second timeout timer
      const timeoutId = setTimeout(() => {
        socket.emit(SocketIOEvents.EmitCustomerTimeout, {
          success: false,
          error: 'Menu categories request timed out',
          requestType: 'menu:categories',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request timeout - Menu categories`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'menu:categories',
          timeoutSeconds: 10
        });
      }, 10000);

      // Store timeout ID for cancellation when response arrives
      socket.data[`timeout:menu:categories:${socket.id}`] = timeoutId;
      const forwardLog = safeLogger({
        socketId: socket.id,
        seatId: connectedSeatId,
        requestType: 'menu:categories'
      },true)
      console.log(`[CustomerAppHandler] Forwarded request to POS`,forwardLog );

    } catch (error) {
      const erlog = safeLogger({
        socketId: socket.id,
        error: error.message,
        stack: error.stack,
        requestType: 'menu:categories',
        timestamp: new Date().toISOString()
      },true);
     console.log(`[CustomerAppHandler] Error handling menu categories request`,erlog);
      socket.emit(SocketIOEvents.EmitCustomerError, {
        success: false,
        error: 'Failed to request menu categories',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle menu products request
  socket.on(SocketIOEvents.OnCustomerMenuProducts, async (payload: MenuProductsPayload) => {
    try {
      const { connectedSeatId, allowMenuBrowsing } = socket.data;

      // Verify customer is connected to a seat
      if (!connectedSeatId) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: 'Not connected to a seat',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request rejected - Not connected to a seat`, {
          socketId: socket.id,
          requestType: 'menu:products',
          reason: 'Not connected'
        });
        return;
      }

      // Verify allowMenuBrowsing is true
      if (!allowMenuBrowsing) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: 'Menu browsing not enabled',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request rejected - Menu browsing not enabled`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'menu:products',
          reason: 'Feature disabled'
        });
        return;
      }

      // Validate and sanitize menu request payload
      const validation = validateMenuRequest(payload);
      
      if (!validation.valid) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: validation.error || 'Invalid request payload',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request rejected - Invalid payload`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'menu:products',
          error: validation.error,
          reason: 'Invalid payload'
        });
        return;
      }

      // Forward request to POS device via seat-specific room
      // POS devices join room: pos:${keySeatDocumentId}
      const posRoom = `pos:${connectedSeatId}`;
      const requestPayload = {
        customerSocketId: socket.id,
        ...validation.sanitized
      };

      io.to(posRoom).emit(SocketIOEvents.EmitPOSMenuProductsRequest, requestPayload);

      // Start 10-second timeout timer
      const timeoutId = setTimeout(() => {
        socket.emit(SocketIOEvents.EmitCustomerTimeout, {
          success: false,
          error: 'Menu products request timed out',
          requestType: 'menu:products',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request timeout - Menu products`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'menu:products',
          categoryId: payload.categoryId,
          timeoutSeconds: 10
        });
      }, 10000);

      // Store timeout ID for cancellation when response arrives
      socket.data[`timeout:menu:products:${socket.id}`] = timeoutId;

      strapi.log.info(`[CustomerAppHandler] Forwarded request to POS`, {
        socketId: socket.id,
        seatId: connectedSeatId,
        requestType: 'menu:products',
        categoryId: validation.sanitized?.categoryId
      });

    } catch (error) {
      strapi.log.error(`[CustomerAppHandler] Error handling menu products request`, {
        socketId: socket.id,
        error: error.message,
        stack: error.stack,
        requestType: 'menu:products',
        timestamp: new Date().toISOString()
      });
      socket.emit(SocketIOEvents.EmitCustomerError, {
        success: false,
        error: 'Failed to request menu products',
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Handles barcode scanning requests from customers (retail/pharmacy)
 * Requirements: 9.1-9.7, 11.1-11.5
 * @param socket - Socket instance for the customer
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handleBarcodeScanning(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnCustomerProductScan, async (payload: BarcodeScanPayload) => {
    try {
      const { connectedSeatId, allowBarcodeScanning } = socket.data;

      // Verify customer is connected to a seat
      if (!connectedSeatId) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: 'Not connected to a seat',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request rejected - Not connected to a seat`, {
          socketId: socket.id,
          requestType: 'product:scan',
          reason: 'Not connected'
        });
        return;
      }

      // Verify allowBarcodeScanning is true
      if (!allowBarcodeScanning) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: 'Barcode scanning not enabled',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request rejected - Barcode scanning not enabled`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'product:scan',
          reason: 'Feature disabled'
        });
        return;
      }

      // Validate and sanitize barcode scan payload
      const validation = validateBarcodeScanPayload(payload);
      
      if (!validation.valid) {
        socket.emit(SocketIOEvents.EmitCustomerError, {
          success: false,
          error: validation.error || 'Invalid barcode',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request rejected - Invalid barcode`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'product:scan',
          error: validation.error,
          reason: 'Invalid barcode format'
        });
        return;
      }

      // Forward request to POS device via seat-specific room
      // POS devices join room: pos:${keySeatDocumentId}
      const posRoom = `pos:${connectedSeatId}`;
      const requestPayload = {
        customerSocketId: socket.id,
        ...validation.sanitized
      };

      io.to(posRoom).emit(SocketIOEvents.EmitPOSProductScanRequest, requestPayload);

      // Start 10-second timeout timer
      const timeoutId = setTimeout(() => {
        socket.emit(SocketIOEvents.EmitCustomerTimeout, {
          success: false,
          error: 'Product scan request timed out',
          requestType: 'product:scan',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Request timeout - Product scan`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'product:scan',
          barcode: payload.barcode,
          timeoutSeconds: 10
        });
      }, 10000);

      // Store timeout ID for cancellation when response arrives
      socket.data[`timeout:product:scan:${socket.id}`] = timeoutId;

      strapi.log.info(`[CustomerAppHandler] Forwarded request to POS`, {
        socketId: socket.id,
        seatId: connectedSeatId,
        requestType: 'product:scan',
        barcode: validation.sanitized?.barcode
      });

    } catch (error) {
      strapi.log.error(`[CustomerAppHandler] Error handling barcode scan request`, {
        socketId: socket.id,
        error: error.message,
        stack: error.stack,
        requestType: 'product:scan',
        timestamp: new Date().toISOString()
      });
      socket.emit(SocketIOEvents.EmitCustomerError, {
        success: false,
        error: 'Failed to scan barcode',
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Handles customer order creation requests
 * Requirements: 3.1-3.15, 4.1-4.8, 5.1-5.6, 6.1-6.12, 7.1-7.12, 8.1-8.10, 11.1-11.10, 13.1-13.10, 14.1-14.11, 16.1-16.11, 20.1-20.10
 * @param socket - Socket instance for the customer
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handleCustomerOrderCreation(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on(SocketIOEvents.OnCustomerOrderCreate, async (payload: unknown) => {
    try {
      const { connectedSeatId, allowCustomerOrdering } = socket.data;

      // Verify customer is connected to a seat
      if (!connectedSeatId) {
        socket.emit(SocketIOEvents.EmitCustomerOrderResponse, {
          success: false,
          error: 'Not connected to a seat',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Order rejected - Not connected to a seat`, {
          socketId: socket.id,
          requestType: 'order:create',
          reason: 'NOT_CONNECTED'
        });
        return;
      }

      // Retrieve Key-Seat by connectedSeatId with populate for license
      const seat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId: connectedSeatId,
        populate: { license: true },
        status: 'published'
      });

      if (!seat) {
        socket.emit(SocketIOEvents.EmitCustomerOrderResponse, {
          success: false,
          error: 'Seat not found',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Order rejected - Seat not found`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'order:create',
          reason: 'Seat not found'
        });
        return;
      }

      // Verify allowCustomerOrdering feature flag is true
      if (!allowCustomerOrdering) {
        socket.emit(SocketIOEvents.EmitCustomerOrderResponse, {
          success: false,
          error: 'Customer ordering not enabled',
          code: 'FEATURE_DISABLED',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Order rejected - Feature disabled`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'order:create',
          reason: 'FEATURE_DISABLED'
        });
        return;
      }

      // Verify POS device is online (isConnected is true)
      if (!seat.isConnected) {
        socket.emit(SocketIOEvents.EmitCustomerOrderResponse, {
          success: false,
          error: 'Restaurant is currently offline',
          code: 'POS_OFFLINE',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Order rejected - POS offline`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          publicSeatId: seat.publicSeatId,
          requestType: 'order:create',
          reason: 'POS_OFFLINE'
        });
        return;
      }

      // Validate order payload using validateOrderPayload utility
      const validation = validateOrderPayload(payload);
      
      if (!validation.valid) {
        socket.emit(SocketIOEvents.EmitCustomerOrderResponse, {
          success: false,
          error: validation.error || 'Invalid order data',
          code: 'INVALID_PAYLOAD',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Order rejected - Invalid payload`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'order:create',
          error: validation.error,
          reason: 'INVALID_PAYLOAD'
        });
        return;
      }

      const sanitizedPayload = validation.sanitized!;

      // Check rate limit: last order timestamp must be > 60 seconds ago
      const lastOrderTimestamp = socket.data.lastOrderTimestamp || 0;
      const currentTime = Date.now();
      const timeSinceLastOrder = currentTime - lastOrderTimestamp;

      if (timeSinceLastOrder < 60000) {
        socket.emit(SocketIOEvents.EmitCustomerOrderResponse, {
          success: false,
          error: 'Please wait before placing another order',
          code: 'RATE_LIMIT_EXCEEDED',
          timestamp: new Date().toISOString()
        });
        strapi.log.warn(`[CustomerAppHandler] Order rejected - Rate limit exceeded`, {
          socketId: socket.id,
          seatId: connectedSeatId,
          requestType: 'order:create',
          timeSinceLastOrder: Math.floor(timeSinceLastOrder / 1000),
          reason: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }

      // Create Order_Request_Tracker with status "pending"
      const orderTracker = await strapi.documents('api::order-request.order-request').create({
        data: {
          requestId: sanitizedPayload.requestId,
          customerSocketId: socket.id,
          publicSeatId: sanitizedPayload.publicSeatId,
          customerName: sanitizedPayload.customer.name,
          customerPhone: sanitizedPayload.customer.phone,
          itemCount: sanitizedPayload.items.length,
          total: sanitizedPayload.total,
          deliveryType: sanitizedPayload.customer.deliveryType,
          status: 'pending'
        },
        status: 'published'
      });

      strapi.log.info(`[CustomerAppHandler] Order received`, {
        socketId: socket.id,
        seatId: connectedSeatId,
        requestId: sanitizedPayload.requestId,
        publicSeatId: sanitizedPayload.publicSeatId,
        customerName: sanitizedPayload.customer.name,
        itemCount: sanitizedPayload.items.length,
        total: sanitizedPayload.total,
        deliveryType: sanitizedPayload.customer.deliveryType
      });

      // Forward order to POS via io.to(pos:${keySeatDocumentId}) room
      const posRoom = `pos:${connectedSeatId}`;
      const orderRequestPayload = {
        customerSocketId: socket.id,
        requestId: sanitizedPayload.requestId,
        publicSeatId: sanitizedPayload.publicSeatId,
        customer: sanitizedPayload.customer,
        items: sanitizedPayload.items,
        orderNote: sanitizedPayload.orderNote,
        subtotal: sanitizedPayload.subtotal,
        tax: sanitizedPayload.tax,
        total: sanitizedPayload.total,
        timestamp: sanitizedPayload.timestamp
      };

      io.to(posRoom).emit(SocketIOEvents.EmitPOSOrderRequest, orderRequestPayload);

      strapi.log.info(`[CustomerAppHandler] Order forwarded to POS`, {
        socketId: socket.id,
        seatId: connectedSeatId,
        requestId: sanitizedPayload.requestId,
        publicSeatId: sanitizedPayload.publicSeatId,
        itemCount: sanitizedPayload.items.length,
        total: sanitizedPayload.total
      });

      // Store customer deviceId for notification lookup later
      socket.data[`order:${sanitizedPayload.requestId}:deviceId`] = sanitizedPayload.customer.deviceId || socket.data.customerDeviceId;

      // Start 60-second monitoring timer (for logging only, doesn't cancel order)
      const timeoutId = setTimeout(async () => {
        try {
          // Check if order is still pending
          const trackers = await strapi.documents('api::order-request.order-request').findMany({
            filters: { requestId: sanitizedPayload.requestId },
            status: 'published'
          });

          if (trackers.length > 0 && trackers[0].status === 'pending') {
            strapi.log.warn(`[CustomerAppHandler] Order still pending after 60s (not cancelled, just monitoring)`, {
              socketId: socket.id,
              seatId: connectedSeatId,
              requestId: sanitizedPayload.requestId,
              publicSeatId: sanitizedPayload.publicSeatId,
              elapsedSeconds: 60
            });

            // Emit informational message to customer (order still processing)
            socket.emit(SocketIOEvents.EmitCustomerOrderResponse, {
              success: true,
              pending: true,
              message: 'Your order is being processed by the cashier',
              requestId: sanitizedPayload.requestId,
              timestamp: new Date().toISOString()
            });
          }

          // Clear timeout from socket data
          delete socket.data[`timeout:order:${sanitizedPayload.requestId}`];
        } catch (error) {
          strapi.log.error(`[CustomerAppHandler] Error in order monitoring`, {
            socketId: socket.id,
            requestId: sanitizedPayload.requestId,
            error: error.message
          });
        }
      }, 60000);

      // Store timeout ID in socket.data
      socket.data[`timeout:order:${sanitizedPayload.requestId}`] = timeoutId;

      // Update socket.data.lastOrderTimestamp to current time
      socket.data.lastOrderTimestamp = currentTime;

    } catch (error) {
      strapi.log.error(`[CustomerAppHandler] Error handling customer order creation`, {
        socketId: socket.id,
        error: error.message,
        stack: error.stack,
        requestType: 'order:create',
        timestamp: new Date().toISOString()
      });
      socket.emit(SocketIOEvents.EmitCustomerOrderResponse, {
        success: false,
        error: 'Failed to process order',
        code: 'ROUTING_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Handles customer disconnection and cleanup
 * Requirements: 12.1-12.6
 * @param socket - Socket instance for the customer
 * @param strapi - Strapi instance
 * @param io - Socket.IO server instance
 */
function handleCustomerDisconnection(
  socket: Socket,
  strapi: Core.Strapi,
  io: SocketIOServer
): void {
  socket.on('disconnect', async () => {
    try {
      const { connectedSeatId, publicSeatId, connectionStartTime } = socket.data;

      // Calculate connection duration
      const connectionDuration = connectionStartTime 
        ? Math.floor((Date.now() - connectionStartTime) / 1000) 
        : 0;

      // Handle cleanup even if socket data is incomplete
      if (!connectedSeatId) {
        strapi.log.info(`[CustomerAppHandler] Customer disconnected without seat connection`, {
          socketId: socket.id,
          connectionDuration
        });
        return;
      }

      // Retrieve current seat data
      const seat = await strapi.documents('api::key-seat.key-seat').findOne({
        documentId: connectedSeatId
      });

      if (!seat) {
        strapi.log.warn(`[CustomerAppHandler] Seat not found during disconnection`, {
          socketId: socket.id,
          seatDocumentId: connectedSeatId,
          publicSeatId
        });
        return;
      }

      // Decrement currentCustomerConnections by 1
      const currentConnections = seat.currentCustomerConnections || 0;
      const newConnectionCount = Math.max(0, currentConnections - 1); // Ensure never negative

      // Persist updated connection count to database
      await strapi.documents('api::key-seat.key-seat').update({
        documentId: connectedSeatId,
        data: {
          currentCustomerConnections: newConnectionCount
        }
      });

      // Notify POS device about customer disconnection
      const posRoom = `pos:${connectedSeatId}`;
      io.to(posRoom).emit(SocketIOEvents.EmitPOSCustomerDisconnected, {
        publicSeatId,
        currentConnections: newConnectionCount,
        connectionDurationSeconds: connectionDuration,
        timestamp: new Date().toISOString()
      });

      // Remove socket from seat-specific rooms
      const seatRoom = `seat:${connectedSeatId}:customers`;
      socket.leave(seatRoom);

      // Clear any pending order timeout timers
      // Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
      let orderTimersCleared = 0;
      Object.keys(socket.data).forEach(key => {
        if (key.startsWith('timeout:order:')) {
          clearTimeout(socket.data[key]);
          delete socket.data[key];
          orderTimersCleared++;
        }
      });

      // Clear any other pending timeout timers (menu, barcode, etc.)
      Object.keys(socket.data).forEach(key => {
        if (key.startsWith('timeout:') && !key.startsWith('timeout:order:')) {
          clearTimeout(socket.data[key]);
          delete socket.data[key];
        }
      });

      // Log order timeout cleanup if any were cleared
      if (orderTimersCleared > 0) {
        strapi.log.info(`[CustomerAppHandler] Cleared pending order timeout timers`, {
          socketId: socket.id,
          orderTimersCleared
        });
      }

      strapi.log.info(`[CustomerAppHandler] Customer disconnected`, {
        socketId: socket.id,
        publicSeatId,
        seatDocumentId: connectedSeatId,
        connectionDurationSeconds: connectionDuration,
        previousConnections: currentConnections,
        newConnections: newConnectionCount
      });

    } catch (error) {
      // During shutdown, database queries may fail - handle gracefully
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('Timeout') || errorMessage.includes('pool') || errorMessage.includes('aborted')) {
        strapi.log.debug(`[CustomerAppHandler] Database unavailable during customer disconnect (likely shutting down)`);
      } else {
        strapi.log.error(`[CustomerAppHandler] Error handling customer disconnection`, {
          socketId: socket.id,
          error: errorMessage,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
}
