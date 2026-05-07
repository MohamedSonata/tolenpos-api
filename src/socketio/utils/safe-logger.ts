/**
 * Safe Logger Utility
 * Removes sensitive data from log objects
 */

/**
 * Sanitizes log data by removing sensitive fields
 * @param data - Log data object
 * @param deep - Whether to perform deep sanitization
 * @returns Sanitized log data
 */
export function safeLogger(data: any, deep: boolean = false): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'token', 'fcmToken', 'licenseKey', 'password', 'apiKey',
    'encryptionKey', 'secret', 'authorization', 'auth',
    'machineUUID', 'userDocumentId', 'documentId'
  ];

  const sanitized = { ...data };

  // Remove sensitive fields
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      delete sanitized[field];
    }
  });

  // Deep sanitization if requested
  if (deep) {
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] && typeof sanitized[key] === 'object') {
        sanitized[key] = safeLogger(sanitized[key], true);
      }
    });
  }

  return sanitized;
}
