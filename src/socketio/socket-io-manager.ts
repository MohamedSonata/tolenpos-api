/**
 * Socket.IO Event Manager
 * 
 * A comprehensive utility for managing Socket.IO events with consistent naming,
 * better error handling, and improved maintainability.
 * 
 * Features:
 * - Consistent naming conventions
 * - Type safety with generics
 * - Comprehensive error handling
 * - Logging with context
 * - Location validation utilities
 * - Event validation system
 */


import { Server, Socket } from "socket.io";
import { SocketIOEvents } from "./events_constants";
import { SocketEventAction } from "./interfaces";

// ================================
// TYPES AND INTERFACES
// ================================

interface EventEmissionOptions {
  includeAction?: boolean;
  logLevel?: 'info' | 'debug' | 'warn' | 'error';
}

interface PeriodicTaskConfig {
  task: () => void;
  durationMs: number;
  intervalMs: number;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// ================================
// EVENT EMISSION UTILITIES
// ================================

/**
 * Socket.IO Event Manager Class
 * Provides a centralized way to manage socket events with consistent patterns
 */
export class SocketEventManager {
  private static instance: SocketEventManager;
  private logger: typeof console;

  private constructor() {
    this.logger = console;
  }

  public static getInstance(): SocketEventManager {
    if (!SocketEventManager.instance) {
      SocketEventManager.instance = new SocketEventManager();
    }
    return SocketEventManager.instance;
  }

  /**
   * Emits an event to the current socket
   */
  public emitToSocket<T>(
    socket: Socket,
    eventName: string,
    data: T,
    action?: SocketEventAction,
    options: EventEmissionOptions = {}
  ): void {
    this.validateEmissionData(data, eventName);
    
    const payload = this.buildPayload(data, action, options.includeAction);
    
    socket.emit(eventName, payload);
    this.logEmission('socket', eventName, socket.id, undefined, options.logLevel);
  }

  /**
   * Emits an event to a specific socket by ID
   */
  public emitToSocketById<T>(
    socket: Socket,
    targetSocketId: string,
    eventName: string,
    data: T,
    action?: SocketEventAction,
    options: EventEmissionOptions = {}
  ): void {
    this.validateEmissionData(data, eventName);
    
    const payload = this.buildPayload(data, action, options.includeAction);
    
    if (socket.id === targetSocketId) {
      socket.emit(eventName, payload);
    } else {
      socket.to(targetSocketId).emit(eventName, payload);
    }
    this.logEmission('socket-by-id', eventName, socket.id, targetSocketId, options.logLevel);
  }

  /**
   * Broadcasts an event to all sockets except the sender
   */
  public broadcastFromSocket<T>(
    socket: Socket,
    eventName: string,
    data: T,
    action?: SocketEventAction,
    options: EventEmissionOptions = {}
  ): void {
    this.validateEmissionData(data, eventName);
    
    const payload = this.buildPayload(data, action, options.includeAction);
    
    socket.broadcast.emit(eventName, payload);
    this.logEmission('broadcast', eventName, socket.id, undefined, options.logLevel);
  }

  /**
   * Emits an event to a specific room (excluding sender)
   */
  public emitToRoom<T>(
    socket: Socket,
    roomName: string,
    eventName: string,
    data: T,
    action?: SocketEventAction,
    options: EventEmissionOptions = {}
  ): void {
    this.validateEmissionData(data, eventName);
    
    const payload = this.buildPayload(data, action, options.includeAction);
    
    socket.to(roomName).emit(eventName, payload);
    this.logEmission('room', eventName, socket.id, roomName, options.logLevel);
  }

  /**
   * Emits an event to all sockets in a room (including sender if in room)
   */
  public emitToAllInRoom<T>(
    io: Server,
    roomName: string,
    eventName: string,
    data: T,
    action?: SocketEventAction,
    options: EventEmissionOptions = {}
  ): void {
    this.validateEmissionData(data, eventName);
    
    const payload = this.buildPayload(data, action, options.includeAction);
    
    io.to(roomName).emit(eventName, payload);
    this.logEmission('room-all', eventName, 'server', roomName, options.logLevel);
  }

  /**
   * Emits an event to all connected sockets
   */
  public emitToAll<T>(
    io: Server,
    eventName: string,
    data: T,
    action?: SocketEventAction,
    options: EventEmissionOptions = {}
  ): void {
    this.validateEmissionData(data, eventName);
    
    const payload = this.buildPayload(data, action, options.includeAction);
    
    io.emit(eventName, payload);
    this.logEmission('all', eventName, 'server', undefined, options.logLevel);
  }

  // ================================
  // EVENT LISTENING UTILITIES
  // ================================

  /**
   * Attaches an event listener to a socket with error handling
   */
  public attachListener<T>(
    socket: Socket,
    eventName: string,
    handler: (data: T) => void | Promise<void>,
    options: { validateEvent?: boolean } = {}
  ): void {
    if (options.validateEvent && !this.isEventSupported(eventName)) {
      this.logger.warn(`Attaching listener for unsupported event: ${eventName}`);
    }

    socket.on(eventName, async (data: T) => {
      try {
        await handler(data);
        this.logger.debug(`Successfully handled event '${eventName}' from socket ${socket.id}`);
      } catch (error) {
        this.logger.error(`Error handling event '${eventName}' from socket ${socket.id}:`, error);
        this.emitError(socket, 'event_handler_error', {
          originalEvent: eventName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  /**
   * Attaches a one-time event listener
   */
  public attachOnceListener<T>(
    socket: Socket,
    eventName: string,
    handler: (data: T) => void | Promise<void>
  ): void {
    socket.once(eventName, async (data: T) => {
      try {
        await handler(data);
        this.logger.debug(`Successfully handled one-time event '${eventName}' from socket ${socket.id}`);
      } catch (error) {
        this.logger.error(`Error handling one-time event '${eventName}' from socket ${socket.id}:`, error);
      }
    });
  }

  // ================================
  // VALIDATION UTILITIES
  // ================================

  /**
  //  * Validates if a city is supported
  //  */
  // public validateCity(city: string): ValidationResult {
  //   const supportedCities = Object.values(SupportedCities);
  //   const isValid = supportedCities.includes(city as SupportedCities);
    
  //   return {
  //     isValid,
  //     error: isValid ? undefined : `Unsupported city: ${city}. Supported cities: ${supportedCities.join(', ')}`
  //   };
  // }

  /**
   * Validates if coordinates are within Jordan boundaries
   */
  public validateJordanCoordinates(latitude: number | string, longitude: number | string): ValidationResult {
    const lat = parseFloat(latitude.toString());
    const lng = parseFloat(longitude.toString());

    // More precise Jordan boundaries
    const jordanBounds = {
      minLat: 29.183401,
      maxLat: 33.367668,
      minLng: 34.882382,
      maxLng: 39.301818
    };

    const isLatValid = lat >= jordanBounds.minLat && lat <= jordanBounds.maxLat;
    const isLngValid = lng >= jordanBounds.minLng && lng <= jordanBounds.maxLng;
    const isValid = isLatValid && isLngValid;

    return {
      isValid,
      error: isValid ? undefined : `Coordinates (${lat}, ${lng}) are outside Jordan boundaries`
    };
  }

  /**
   * Validates if an event is supported
   */
  public isEventSupported(eventName: string): boolean {
    return Object.values(SocketIOEvents).includes(eventName);
  }

  /**
   * Sets up event validation middleware for a socket
   */
  public setupEventValidation(socket: Socket): void {
    socket.onAny((eventName: string, ...args: any[]) => {
      if (!this.isEventSupported(eventName)) {
        this.emitError(socket, 'unsupported_event', {
          eventName,
          message: `Event '${eventName}' is not supported`,
          supportedEvents: Object.values(SocketIOEvents)
        });
        this.logger.warn(`Unsupported event '${eventName}' received from socket ${socket.id}`);
      }
    });
  }

  // ================================
  // UTILITY FUNCTIONS
  // ================================

  /**
   * Creates a deep copy of data for safe transmission
   */
  public deepClone<T>(data: T): T {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (error) {
      this.logger.error('Failed to deep clone data:', error);
      return data;
    }
  }

  /**
   * Runs a periodic task with proper cleanup
   */
  public startPeriodicTask(config: PeriodicTaskConfig): () => void {
    let isRunning = true;
    
    const intervalId = setInterval(() => {
      if (!isRunning) return;
      
      try {
        config.task();
      } catch (error) {
        this.logger.error('Periodic task error:', error);
        if (config.onError) {
          config.onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }, config.intervalMs);

    const timeoutId = setTimeout(() => {
      isRunning = false;
      clearInterval(intervalId);
      if (config.onComplete) {
        config.onComplete();
      }
      this.logger.debug('Periodic task completed');
    }, config.durationMs);

    // Return cleanup function
    return () => {
      isRunning = false;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      this.logger.debug('Periodic task stopped manually');
    };
  }

  // ================================
  // PRIVATE HELPER METHODS
  // ================================

  private validateEmissionData<T>(data: T, eventName: string): void {
    if (data === null || data === undefined) {
      throw new Error(`Cannot emit event '${eventName}': data is required and cannot be null or undefined`);
    }
  }

  private buildPayload<T>(data: T, action?: SocketEventAction, includeAction = false): T | (T & { eventAction: SocketEventAction }) {
    if (action && includeAction) {
      return { ...data as any, eventAction: action };
    }
    return data;
  }

  private logEmission(
    type: string,
    eventName: string,
    sourceId: string,
    target?: string,
    level: 'info' | 'debug' | 'warn' | 'error' = 'info'
  ): void {
    const targetInfo = target ? ` -> ${target}` : '';
    const message = `[${type.toUpperCase()}] Event '${eventName}' from ${sourceId}${targetInfo}`;
    
    this.logger[level](message);
  }

  private emitError(socket: Socket, errorType: string, errorData: any): void {
    socket.emit('error_event', {
      type: errorType,
      timestamp: new Date().toISOString(),
      ...errorData
    });
  }
}

// ================================
// CONVENIENCE EXPORTS
// ================================

// Export singleton instance for easy access
export const socketEventManager =  SocketEventManager.getInstance();

// Legacy function exports for backward compatibility (deprecated)
/**
 * @deprecated Use socketEventManager.emitToSocket() instead
 */
export function emitEventToSocket<T>(socket: Socket, event: string, result: T): void {
  socketEventManager.emitToSocket(socket, event, result);
}

/**
 * @deprecated Use socketEventManager.attachListener() instead
 */
export function listenToSocketEvent<T>(socket: Socket, event: string, onData: (data: T) => void): void {
  socketEventManager.attachListener(socket, event, onData);
}

/**
 * @deprecated Use socketEventManager.deepClone() instead
 */
export function socketIoJsonResponse<T>(data: T): T {
  return socketEventManager.deepClone(data);
}

/**
 * @deprecated Use socketEventManager.validateCity() instead
 */
// export function validateSupportedCities(city: string): boolean {
//   return socketEventManager.validateCity(city).isValid;
// }

/**
 * @deprecated Use socketEventManager.validateJordanCoordinates() instead
 */
export function validateLatLantude(latitude: number | string, longitude: number | string): boolean {
  return socketEventManager.validateJordanCoordinates(latitude, longitude).isValid;
}

/**
 * @deprecated Use socketEventManager.startPeriodicTask() instead
 */
export function runPeriodicCode(
  triggerEvent: () => void,
  durationInMilliseconds: number,
  eventEmitDelayDuration: number
): () => void {
  return socketEventManager.startPeriodicTask({
    task: triggerEvent,
    durationMs: durationInMilliseconds,
    intervalMs: eventEmitDelayDuration
  });
}

/**
 * @deprecated Use socketEventManager.isEventSupported() instead
 */
export function isEventImplemented(eventName: string): boolean {
  return socketEventManager.isEventSupported(eventName);
}