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
