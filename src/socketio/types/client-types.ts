/**
 * Socket Client Types
 * Defines all possible client types that can connect via Socket.IO
 */

export enum SocketClientType {
  /** Desktop POS application - main point of sale system */
  POS_DESKTOP = 'pos_desktop',
  
  /** Mobile app for license/seat management and insights */
  ADMIN_MOBILE = 'admin_mobile',
  
  /** Mobile app for customers to scan products and browse catalog */
  CUSTOMER_MOBILE = 'customer_mobile',
  
  /** Web app for customers to scan products and browse catalog */
  CUSTOMER_WEB = 'customer_web',
}

/**
 * Type guard to check if a value is a valid SocketClientType
 */
export function isValidClientType(value: unknown): value is SocketClientType {
  return Object.values(SocketClientType).includes(value as SocketClientType);
}

/**
 * Maps legacy client type strings to new enum values
 * Also accepts new enum values directly for forward compatibility
 */
export function mapLegacyClientType(clientType: string): SocketClientType | null {
  // First check if it's already a valid enum value
  if (isValidClientType(clientType)) {
    return clientType as SocketClientType;
  }
  
  // Otherwise, map legacy values to new enum values
  const legacyMapping: Record<string, SocketClientType> = {
    'pos': SocketClientType.POS_DESKTOP,
    'mobile': SocketClientType.ADMIN_MOBILE,
    'customer': SocketClientType.CUSTOMER_MOBILE,
    'Website': SocketClientType.CUSTOMER_WEB,
    'website': SocketClientType.CUSTOMER_WEB,
  };
  
  return legacyMapping[clientType] || null;
}

/**
 * Checks if client type requires authentication
 */
export function requiresAuthentication(clientType: SocketClientType): boolean {
  return clientType === SocketClientType.POS_DESKTOP || 
         clientType === SocketClientType.ADMIN_MOBILE;
}

/**
 * Checks if client type is a customer-facing app
 */
export function isCustomerClient(clientType: SocketClientType): boolean {
  return clientType === SocketClientType.CUSTOMER_MOBILE || 
         clientType === SocketClientType.CUSTOMER_WEB;
}

/**
 * Gets human-readable name for client type
 */
export function getClientTypeName(clientType: SocketClientType): string {
  const names: Record<SocketClientType, string> = {
    [SocketClientType.POS_DESKTOP]: 'POS Desktop',
    [SocketClientType.ADMIN_MOBILE]: 'Admin Mobile',
    [SocketClientType.CUSTOMER_MOBILE]: 'Customer Mobile',
    [SocketClientType.CUSTOMER_WEB]: 'Customer Web',
  };
  
  return names[clientType] || 'Unknown';
}

/**
 * Extended socket data interface with typed client information
 */
export interface SocketData {
  userId?: string | number;
  documentId?: string;
  clientType: SocketClientType;
  machineUUID?: string;
  keySeatDocumentId?: string;
  customerSessionId?: string;
}

/**
 * CLIENT INTEGRATION GUIDE
 * ========================
 * 
 * How to connect from your client applications:
 * 
 * 1. POS DESKTOP APP
 * ------------------
 * Client Type: 'pos_desktop' (or legacy: 'pos')
 * Authentication: Required (API key + machineUUID)
 * 
 * Connection Example:
 * ```javascript
 * const socket = io('https://your-backend.com', {
 *   query: {
 *     clientType: 'pos_desktop',
 *     token: 'your-license-key',
 *     userDocumentId: 'user-doc-id',
 *     machineUUID: 'unique-machine-id'
 *   }
 * });
 * ```
 * 
 * 2. ADMIN MOBILE APP
 * -------------------
 * Client Type: 'admin_mobile' (or legacy: 'mobile')
 * Authentication: Required (JWT token)
 * 
 * Connection Example:
 * ```javascript
 * const socket = io('https://your-backend.com', {
 *   query: {
 *     clientType: 'admin_mobile',
 *     token: 'jwt-token-here'
 *   }
 * });
 * ```
 * 
 * 3. CUSTOMER MOBILE APP
 * ----------------------
 * Client Type: 'customer_mobile' (or legacy: 'customer')
 * Authentication: Not required
 * 
 * Connection Example:
 * ```javascript
 * const socket = io('https://your-backend.com', {
 *   query: {
 *     clientType: 'customer_mobile'
 *   }
 * });
 * 
 * // After connection, connect to a specific seat:
 * socket.emit('customer:connect', {
 *   publicSeatId: 'SEAT-12345',
 *   fcmToken: 'firebase-token',      // For push notifications
 *   deviceId: 'device-unique-id',    // Required for notifications
 *   deviceName: 'iPhone 13',         // Optional
 *   platform: 'ios'                  // 'ios' | 'android'
 * });
 * ```
 * 
 * 4. CUSTOMER WEB APP
 * -------------------
 * Client Type: 'customer_web' (or legacy: 'Website' or 'website')
 * Authentication: Not required
 * 
 * Connection Example:
 * ```javascript
 * const socket = io('https://your-backend.com', {
 *   query: {
 *     clientType: 'customer_web'
 *   }
 * });
 * 
 * // After connection, connect to a specific seat:
 * socket.emit('customer:connect', {
 *   publicSeatId: 'SEAT-12345',
 *   deviceId: 'browser-session-id',  // Optional but recommended
 *   deviceName: 'Chrome Browser',    // Optional
 *   platform: 'web'
 *   // Note: No fcmToken for web clients
 * });
 * ```
 * 
 * IMPORTANT NOTES:
 * ----------------
 * - Always pass clientType in the query parameters during connection
 * - Use the new enum values ('pos_desktop', 'admin_mobile', 'customer_mobile', 'customer_web')
 * - Legacy values still work but will be deprecated in future versions
 * - Customer apps (mobile/web) must emit 'customer:connect' after socket connection
 * - Only customer_mobile should provide fcmToken (for push notifications)
 * - customer_web clients work without FCM tokens
 * - deviceId is crucial for targeting specific customers in multi-device scenarios
 * 
 * BACKWARD COMPATIBILITY:
 * -----------------------
 * Legacy client type values are automatically mapped:
 * - 'pos' → 'pos_desktop'
 * - 'mobile' → 'admin_mobile'
 * - 'customer' → 'customer_mobile'
 * - 'Website' or 'website' → 'customer_web'
 */
