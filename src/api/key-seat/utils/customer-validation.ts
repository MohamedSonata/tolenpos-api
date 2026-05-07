/**
 * Customer App Input Validation and Security Utilities
 * 
 * Provides validation functions for customer-facing inputs to prevent
 * injection attacks, ensure data integrity, and enforce security policies.
 */

/**
 * Validates Public Seat ID format
 * Must be 6-12 uppercase alphanumeric characters
 * 
 * @param publicSeatId - The public seat identifier to validate
 * @returns True if valid format
 */
export function isValidPublicSeatId(publicSeatId: unknown): boolean {
  if (typeof publicSeatId !== 'string') {
    return false;
  }

  // Must be 6-12 characters, uppercase alphanumeric only
  const regex = /^[A-Z0-9]{6,12}$/;
  return regex.test(publicSeatId);
}

/**
 * Sanitizes Public Seat ID by removing invalid characters
 * Converts to uppercase and removes non-alphanumeric characters
 * 
 * @param publicSeatId - The public seat identifier to sanitize
 * @returns Sanitized public seat ID or null if invalid
 */
export function sanitizePublicSeatId(publicSeatId: unknown): string | null {
  if (typeof publicSeatId !== 'string') {
    return null;
  }

  const sanitized = publicSeatId.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  if (sanitized.length < 6 || sanitized.length > 12) {
    return null;
  }

  return sanitized;
}

/**
 * Validates FCM token format
 * Must be a non-empty string with reasonable length
 * 
 * @param token - The FCM token to validate
 * @returns True if valid format
 */
export function isValidFcmToken(token: unknown): boolean {
  if (typeof token !== 'string') {
    return false;
  }

  // FCM tokens are typically 152-200 characters
  // Allow range of 50-500 to be flexible
  const trimmed = token.trim();
  return trimmed.length >= 50 && trimmed.length <= 500;
}

/**
 * Validates device ID format
 * Must be a non-empty string with reasonable length
 * 
 * @param deviceId - The device identifier to validate
 * @returns True if valid format
 */
export function isValidDeviceId(deviceId: unknown): boolean {
  if (typeof deviceId !== 'string') {
    return false;
  }

  const trimmed = deviceId.trim();
  // Device IDs should be 10-100 characters
  return trimmed.length >= 10 && trimmed.length <= 100;
}

/**
 * Validates barcode format
 * Must be a non-empty string with reasonable length
 * Common formats: UPC (12), EAN (13), Code128 (variable)
 * 
 * @param barcode - The barcode to validate
 * @returns True if valid format
 */
export function isValidBarcode(barcode: unknown): boolean {
  if (typeof barcode !== 'string') {
    return false;
  }

  const trimmed = barcode.trim();
  
  // Barcodes should be 4-50 characters (covers most formats)
  if (trimmed.length < 4 || trimmed.length > 50) {
    return false;
  }

  // Allow alphanumeric and common barcode characters (-, _, space)
  const regex = /^[A-Za-z0-9\-_ ]+$/;
  return regex.test(trimmed);
}

/**
 * Sanitizes barcode by removing potentially dangerous characters
 * 
 * @param barcode - The barcode to sanitize
 * @returns Sanitized barcode or null if invalid
 */
export function sanitizeBarcode(barcode: unknown): string | null {
  if (typeof barcode !== 'string') {
    return null;
  }

  // Remove all characters except alphanumeric, dash, underscore, space
  const sanitized = barcode.trim().replace(/[^A-Za-z0-9\-_ ]/g, '');
  
  if (sanitized.length < 4 || sanitized.length > 50) {
    return null;
  }

  return sanitized;
}

/**
 * Validates category ID format
 * Must be a non-empty string or positive integer
 * 
 * @param categoryId - The category identifier to validate
 * @returns True if valid format
 */
export function isValidCategoryId(categoryId: unknown): boolean {
  // Allow string IDs (UUIDs, custom IDs)
  if (typeof categoryId === 'string') {
    const trimmed = categoryId.trim();
    return trimmed.length > 0 && trimmed.length <= 100;
  }

  // Allow numeric IDs
  if (typeof categoryId === 'number') {
    return Number.isInteger(categoryId) && categoryId > 0;
  }

  return false;
}

/**
 * Sanitizes category ID
 * 
 * @param categoryId - The category identifier to sanitize
 * @returns Sanitized category ID or null if invalid
 */
export function sanitizeCategoryId(categoryId: unknown): string | number | null {
  if (typeof categoryId === 'string') {
    const trimmed = categoryId.trim();
    if (trimmed.length > 0 && trimmed.length <= 100) {
      return trimmed;
    }
    return null;
  }

  if (typeof categoryId === 'number') {
    if (Number.isInteger(categoryId) && categoryId > 0) {
      return categoryId;
    }
    return null;
  }

  return null;
}

/**
 * Validates customer connection payload
 * Ensures required fields are present and valid
 * 
 * @param payload - The connection payload to validate
 * @returns Validation result with error message if invalid
 */
export function validateConnectionPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: {
    publicSeatId: string;
    fcmToken?: string;
    deviceId?: string;
    deviceName?: string;
    platform?: string;
  };
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload format' };
  }

  const data = payload as Record<string, unknown>;

  // Validate required publicSeatId
  if (!data.publicSeatId) {
    return { valid: false, error: 'Public Seat ID is required' };
  }

  const sanitizedSeatId = sanitizePublicSeatId(data.publicSeatId);
  if (!sanitizedSeatId) {
    return { valid: false, error: 'Invalid Public Seat ID format' };
  }

  const sanitized: {
    publicSeatId: string;
    fcmToken?: string;
    deviceId?: string;
    deviceName?: string;
    platform?: string;
  } = {
    publicSeatId: sanitizedSeatId
  };

  // Validate optional FCM token
  if (data.fcmToken) {
    if (!isValidFcmToken(data.fcmToken)) {
      return { valid: false, error: 'Invalid FCM token format' };
    }
    sanitized.fcmToken = (data.fcmToken as string).trim();

    // If FCM token provided, device ID is required
    if (!data.deviceId) {
      return { valid: false, error: 'Device ID is required with FCM token' };
    }

    if (!isValidDeviceId(data.deviceId)) {
      return { valid: false, error: 'Invalid device ID format' };
    }
    sanitized.deviceId = (data.deviceId as string).trim();

    // Optional device name and platform
    if (data.deviceName && typeof data.deviceName === 'string') {
      sanitized.deviceName = (data.deviceName as string).trim().substring(0, 100);
    }

    if (data.platform && typeof data.platform === 'string') {
      const platform = (data.platform as string).toLowerCase().trim();
      if (['ios', 'android', 'web'].includes(platform)) {
        sanitized.platform = platform;
      }
    }
  }

  return { valid: true, sanitized };
}

/**
 * Validates menu request payload
 * 
 * @param payload - The menu request payload to validate
 * @returns Validation result with error message if invalid
 */
export function validateMenuRequest(payload: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: {
    categoryId?: string | number;
  };
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: true, sanitized: {} }; // Empty payload is valid for categories request
  }

  const data = payload as Record<string, unknown>;
  const sanitized: { categoryId?: string | number } = {};

  // Validate optional categoryId (for products request)
  if (data.categoryId !== undefined) {
    const sanitizedCategoryId = sanitizeCategoryId(data.categoryId);
    if (!sanitizedCategoryId) {
      return { valid: false, error: 'Invalid category ID format' };
    }
    sanitized.categoryId = sanitizedCategoryId;
  }

  return { valid: true, sanitized };
}

/**
 * Validates barcode scan payload
 * 
 * @param payload - The barcode scan payload to validate
 * @returns Validation result with error message if invalid
 */
export function validateBarcodeScanPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: {
    barcode: string;
  };
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload format' };
  }

  const data = payload as Record<string, unknown>;

  if (!data.barcode) {
    return { valid: false, error: 'Barcode is required' };
  }

  const sanitizedBarcode = sanitizeBarcode(data.barcode);
  if (!sanitizedBarcode) {
    return { valid: false, error: 'Invalid barcode format' };
  }

  return {
    valid: true,
    sanitized: { barcode: sanitizedBarcode }
  };
}

/**
 * Strips sensitive fields from seat data before sending to customers
 * Removes internal identifiers and license owner information
 * 
 * @param seat - The seat data to sanitize
 * @returns Sanitized seat data safe for customer consumption
 */
export function sanitizeSeatDataForCustomer(seat: Record<string, unknown>): {
  publicSeatId: string;
  businessName: string;
  businessType: string;
  isOnline: boolean;
  currentConnections: number;
  maxConnections: number;
  features: {
    allowMenuBrowsing: boolean;
    allowBarcodeScanning: boolean;
    allowCustomerOrdering: boolean;
  };
} {
  return {
    publicSeatId: seat.publicSeatId as string,
    businessName: seat.businessName as string,
    businessType: seat.businessType as string,
    isOnline: seat.isConnected as boolean,
    currentConnections: seat.currentCustomerConnections as number,
    maxConnections: seat.maxCustomerConnections as number,
    features: {
      allowMenuBrowsing: seat.allowMenuBrowsing as boolean,
      allowBarcodeScanning: seat.allowBarcodeScanning as boolean,
      allowCustomerOrdering: seat.allowCustomerOrdering as boolean
    }
  };
}

/**
 * Validates that a response object doesn't contain sensitive fields
 * Throws error if sensitive fields are detected
 * 
 * @param data - The data object to check
 * @throws Error if sensitive fields are present
 */
export function ensureNoSensitiveData(data: unknown): void {
  if (!data || typeof data !== 'object') {
    return;
  }

  const sensitiveFields = [
    'documentId',
    'machineUUID',
    'licenseKey',
    'license',
    'user',
    'userId',
    'ownerId',
    'encryptionKey',
    'apiKey',
    'token',
    'password',
    'telemetry',
    'fcmTokens',
    'customerFcmTokens'
  ];

  const checkObject = (obj: Record<string, unknown>, path = ''): void => {
    for (const key of Object.keys(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      
      if (sensitiveFields.includes(key.toLowerCase())) {
        throw new Error(`Sensitive field detected in customer response: ${fullPath}`);
      }

      if (obj[key] && typeof obj[key] === 'object') {
        checkObject(obj[key] as Record<string, unknown>, fullPath);
      }
    }
  };

  checkObject(data as Record<string, unknown>);
}

/**
 * Order Payload TypeScript Interfaces
 */
export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  addons?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  notes?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  deliveryAddress?: string;
  deliveryType: 'pickup' | 'delivery';
  deviceId?: string;
}

export interface OrderPayload {
  requestId: string;
  publicSeatId: string;
  customer: CustomerInfo;
  items: OrderItem[];
  orderNote?: string;
  subtotal: number;
  tax: number;
  total: number;
  timestamp: string;
}

/**
 * Sanitizes a string by removing HTML/script tags and trimming
 * 
 * @param value - The string to sanitize
 * @returns Sanitized string
 */
function sanitizeString(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Validates UUID format
 * 
 * @param value - The value to check
 * @returns True if valid UUID
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validates phone number format (10-15 digits)
 * 
 * @param value - The phone number to validate
 * @returns True if valid phone format
 */
function isValidPhone(value: string): boolean {
  const digitsOnly = value.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

/**
 * Validates order payload for customer order creation
 * Ensures all required fields are present, valid, and sanitized
 * 
 * @param payload - The order payload to validate
 * @returns Validation result with error message if invalid, sanitized payload if valid
 */
export function validateOrderPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: OrderPayload;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload format' };
  }

  const data = payload as Record<string, unknown>;

  // Validate requestId (UUID format)
  if (!data.requestId || typeof data.requestId !== 'string') {
    return { valid: false, error: 'Request ID is required' };
  }
  if (!isValidUUID(data.requestId)) {
    return { valid: false, error: 'Invalid request ID format (must be UUID)' };
  }

  // Validate publicSeatId
  if (!data.publicSeatId || typeof data.publicSeatId !== 'string') {
    return { valid: false, error: 'Public Seat ID is required' };
  }
  const sanitizedSeatId = sanitizePublicSeatId(data.publicSeatId);
  if (!sanitizedSeatId) {
    return { valid: false, error: 'Invalid Public Seat ID format (6-12 uppercase alphanumeric)' };
  }

  // Validate customer object
  if (!data.customer || typeof data.customer !== 'object') {
    return { valid: false, error: 'Customer information is required' };
  }
  const customer = data.customer as Record<string, unknown>;

  // Validate customer.name (2-100 characters)
  if (!customer.name || typeof customer.name !== 'string') {
    return { valid: false, error: 'Customer name is required' };
  }
  const sanitizedName = sanitizeString(customer.name);
  if (sanitizedName.length < 2 || sanitizedName.length > 100) {
    return { valid: false, error: 'Customer name must be 2-100 characters' };
  }

  // Validate customer.phone (10-15 digits)
  if (!customer.phone || typeof customer.phone !== 'string') {
    return { valid: false, error: 'Customer phone is required' };
  }
  const sanitizedPhone = sanitizeString(customer.phone);
  if (!isValidPhone(sanitizedPhone)) {
    return { valid: false, error: 'Customer phone must be 10-15 digits' };
  }

  // Validate deliveryType
  if (!customer.deliveryType || typeof customer.deliveryType !== 'string') {
    return { valid: false, error: 'Delivery type is required' };
  }
  const deliveryType = customer.deliveryType.toLowerCase();
  if (deliveryType !== 'pickup' && deliveryType !== 'delivery') {
    return { valid: false, error: 'Delivery type must be "pickup" or "delivery"' };
  }

  // Validate deliveryAddress if deliveryType is "delivery"
  let sanitizedAddress: string | undefined;
  if (deliveryType === 'delivery') {
    if (!customer.deliveryAddress || typeof customer.deliveryAddress !== 'string') {
      return { valid: false, error: 'Delivery address is required for delivery orders' };
    }
    sanitizedAddress = sanitizeString(customer.deliveryAddress);
    if (sanitizedAddress.length < 10 || sanitizedAddress.length > 500) {
      return { valid: false, error: 'Delivery address must be 10-500 characters' };
    }
  }

  // Validate items array (1-50 items)
  if (!Array.isArray(data.items)) {
    return { valid: false, error: 'Items array is required' };
  }
  if (data.items.length < 1 || data.items.length > 50) {
    return { valid: false, error: 'Order must contain 1-50 items' };
  }

  // Validate each item
  const sanitizedItems: OrderItem[] = [];
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Item ${i + 1} has invalid format` };
    }

    const itemData = item as Record<string, unknown>;

    // Validate productId
    if (!itemData.productId || typeof itemData.productId !== 'string') {
      return { valid: false, error: `Item ${i + 1} missing product ID` };
    }

    // Validate name
    if (!itemData.name || typeof itemData.name !== 'string') {
      return { valid: false, error: `Item ${i + 1} missing name` };
    }
    const sanitizedItemName = sanitizeString(itemData.name);
    if (sanitizedItemName.length === 0) {
      return { valid: false, error: `Item ${i + 1} has invalid name` };
    }

    // Validate price (positive number)
    if (typeof itemData.price !== 'number' || itemData.price <= 0) {
      return { valid: false, error: `Item ${i + 1} must have positive price` };
    }

    // Validate quantity (1-99)
    if (typeof itemData.quantity !== 'number' || !Number.isInteger(itemData.quantity)) {
      return { valid: false, error: `Item ${i + 1} quantity must be an integer` };
    }
    if (itemData.quantity < 1 || itemData.quantity > 99) {
      return { valid: false, error: `Item ${i + 1} quantity must be 1-99` };
    }

    const sanitizedItem: OrderItem = {
      productId: sanitizeString(itemData.productId),
      name: sanitizedItemName,
      price: itemData.price,
      quantity: itemData.quantity
    };

    // Validate optional addons
    if (itemData.addons) {
      if (!Array.isArray(itemData.addons)) {
        return { valid: false, error: `Item ${i + 1} addons must be an array` };
      }
      sanitizedItem.addons = itemData.addons
        .filter((addon: unknown) => addon && typeof addon === 'object')
        .map((addon: unknown) => {
          const addonData = addon as Record<string, unknown>;
          return {
            id: typeof addonData.id === 'string' ? sanitizeString(addonData.id) : String(addonData.id || ''),
            name: typeof addonData.name === 'string' ? sanitizeString(addonData.name) : String(addonData.name || ''),
            price: typeof addonData.price === 'number' ? addonData.price : 0
          };
        });
    }

    // Validate optional notes
    if (itemData.notes && typeof itemData.notes === 'string') {
      sanitizedItem.notes = sanitizeString(itemData.notes);
    }

    sanitizedItems.push(sanitizedItem);
  }

  // Validate subtotal (positive number)
  if (typeof data.subtotal !== 'number' || data.subtotal <= 0) {
    return { valid: false, error: 'Subtotal must be a positive number' };
  }

  // Validate tax (positive number or zero)
  if (typeof data.tax !== 'number' || data.tax < 0) {
    return { valid: false, error: 'Tax must be a positive number or zero' };
  }

  // Validate total (positive number)
  if (typeof data.total !== 'number' || data.total <= 0) {
    return { valid: false, error: 'Total must be a positive number' };
  }

  // Validate timestamp
  if (!data.timestamp || typeof data.timestamp !== 'string') {
    return { valid: false, error: 'Timestamp is required' };
  }

  // Build sanitized payload
  const sanitized: OrderPayload = {
    requestId: data.requestId,
    publicSeatId: sanitizedSeatId,
    customer: {
      name: sanitizedName,
      phone: sanitizedPhone,
      deliveryType: deliveryType as 'pickup' | 'delivery'
    },
    items: sanitizedItems,
    subtotal: data.subtotal,
    tax: data.tax,
    total: data.total,
    timestamp: data.timestamp
  };

  // Add optional deviceId
  if (customer.deviceId && typeof customer.deviceId === 'string') {
    sanitized.customer.deviceId = sanitizeString(customer.deviceId);
  }

  // Add optional deliveryAddress
  if (sanitizedAddress) {
    sanitized.customer.deliveryAddress = sanitizedAddress;
  }

  // Add optional orderNote
  if (data.orderNote && typeof data.orderNote === 'string') {
    sanitized.orderNote = sanitizeString(data.orderNote);
  }

  return { valid: true, sanitized };
}
