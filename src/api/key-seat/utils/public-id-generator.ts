import type { Core } from '@strapi/strapi';

/**
 * Business type to prefix mapping
 */
const BUSINESS_TYPE_PREFIXES: Record<string, string> = {
  restaurant: 'REST',
  retail: 'RETL',
  cafe: 'CAFE',
  pharmacy: 'PHRM',
  other: 'SEAT',
};

/**
 * Generates a random alphanumeric string of specified length
 * @param length - Length of the random string
 * @returns Uppercase alphanumeric string
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a public seat ID with business type prefix
 * @param businessType - Type of business (restaurant, retail, cafe, pharmacy, other)
 * @returns Public seat ID (e.g., "REST42A", "CAFE001")
 */
export function generatePublicSeatId(businessType?: string): string {
  const prefix = BUSINESS_TYPE_PREFIXES[businessType || 'other'] || 'SEAT';
  const randomLength = Math.floor(Math.random() * 7) + 6 - prefix.length; // 6-12 total chars
  const randomPart = generateRandomString(randomLength);
  return `${prefix}${randomPart}`;
}

/**
 * Validates public seat ID format
 * @param id - The ID to validate
 * @returns True if valid format (6-12 uppercase alphanumeric)
 */
export function isValidPublicSeatId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  // Must be 6-12 characters, uppercase alphanumeric only
  const regex = /^[A-Z0-9]{6,12}$/;
  return regex.test(id);
}

/**
 * Generates unique public seat ID by checking database for collisions
 * @param strapi - Strapi instance
 * @param businessType - Type of business
 * @param maxAttempts - Maximum generation attempts (default: 10)
 * @returns Unique public seat ID
 * @throws Error if unable to generate unique ID after maxAttempts
 */
export async function generateUniquePublicSeatId(
  strapi: Core.Strapi,
  businessType?: string,
  maxAttempts: number = 10
): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const publicSeatId = generatePublicSeatId(businessType);
    
    // Check if this ID already exists
    const existingSeats = await strapi.documents('api::key-seat.key-seat').findMany({
      filters: { publicSeatId },
      status: 'published',
    });
    
    if (existingSeats.length === 0) {
      return publicSeatId;
    }
    
    strapi.log.debug(`Public seat ID collision detected: ${publicSeatId} (attempt ${attempt}/${maxAttempts})`);
  }
  
  throw new Error(`Failed to generate unique public seat ID after ${maxAttempts} attempts`);
}
