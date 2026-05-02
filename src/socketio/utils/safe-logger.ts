/**
 * Safe Logger Utility
 * Converts objects to JSON strings for proper logging
 */

/**
 * Safely converts any value to a loggable string
 * Handles circular references and complex objects
 * @param value - Any value to log
 * @param indent - Whether to pretty-print (default: false)
 * @returns String representation safe for logging
 */
export function safeLogger(value: any, indent: boolean = false): string {
  try {
    // Handle primitives
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value !== 'object') return String(value);

    // Handle objects with circular reference protection
    const seen = new WeakSet();
    return JSON.stringify(
      value,
      (key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) {
            return '[Circular]';
          }
          seen.add(val);
        }
        return val;
      },
      indent ? 2 : undefined
    );
  } catch (error) {
    return `[Logging Error: ${error.message}]`;
  }
}

/**
 * Logs an object safely with a label
 * @param strapi - Strapi instance
 * @param label - Label for the log entry
 * @param value - Value to log
 * @param level - Log level (default: 'info')
 */
export function logObject(
  strapi: any,
  label: string,
  value: any,
  level: 'info' | 'warn' | 'error' | 'debug' = 'info'
): void {
  const logMessage = `${label}: ${safeLogger(value,true)}`;
  strapi.log[level](logMessage);
}
