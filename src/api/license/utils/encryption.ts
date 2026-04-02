import crypto from 'crypto';

/**
 * Interface for license key data that will be encrypted
 */
export interface LicenseKeyData {
  expirationType: 'perpetual' | 'expiring';
  maxSeats: number;
  // planSubscriptionType: 'FreeTrial'|'Pro' | 'Enterprise';
  userId: string;
  expiresAt?: string;
  timestamp: number;
}

/**
 * Get the encryption key from environment variables
 * @throws Error if ENCRYPTION_KEY is not configured
 */
export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not configured');
  }
  
  return key;
}

/**
 * Generate an encrypted license key from license metadata
 * Uses AES-256-GCM for authenticated encryption
 * 
 * @param data - License metadata to encrypt
 * @returns Base64-encoded encrypted license key (IV + encrypted data + auth tag)
 */
export function generateLicenseKey(data: LicenseKeyData): string {
  const encryptionKey = getEncryptionKey();
  
  // Create a 32-byte key from the encryption key (AES-256 requires 32 bytes)
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  
  // Generate random 16-byte initialization vector
  const iv = crypto.randomBytes(16);
  
  // Create cipher with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  // Convert data to JSON and encrypt
  const jsonData = JSON.stringify(data);
  let encrypted = cipher.update(jsonData, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get authentication tag for integrity verification
  const authTag = cipher.getAuthTag();
  
  // Combine IV + encrypted data + auth tag and encode as base64
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    authTag
  ]);
  
  return combined.toString('base64');
}

/**
 * Decrypt and validate a license key
 * 
 * @param licenseKey - Base64-encoded encrypted license key
 * @returns Decrypted license data or null if decryption fails
 */
export function decryptLicenseKey(licenseKey: string): LicenseKeyData | null {
  try {
    const encryptionKey = getEncryptionKey();
    
    // Create a 32-byte key from the encryption key
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    
    // Decode base64 license key
    const combined = Buffer.from(licenseKey, 'base64');
    
    // Extract IV (first 16 bytes)
    const iv = combined.subarray(0, 16);
    
    // Extract auth tag (last 16 bytes)
    const authTag = combined.subarray(combined.length - 16);
    
    // Extract encrypted data (everything in between)
    const encrypted = combined.subarray(16, combined.length - 16);
    
    // Create decipher with AES-256-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse JSON and return
    return JSON.parse(decrypted) as LicenseKeyData;
  } catch (error) {
    // Return null if decryption fails (invalid key, corrupted data, etc.)
    return null;
  }
}
