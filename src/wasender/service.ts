/**
 * WaSender Service
 * 
 * Service layer for integrating with WaSenderAPI.com
 * Handles all WhatsApp messaging operations with comprehensive error handling and validation
 * 
 * @module wasender-service
 * @requires node-fetch
 * 
 * Environment Variables Required:
 * - WASENDER_API_URL: Base URL for WaSender API (default: https://wasenderapi.com/api)
 * - WASENDER_API_TOKEN: Your WaSender API authentication token
 * - WASENDER_DEVICE_ID: Your registered device ID
 * 
 * @example
 * // In your controller
 * const wasenderService = strapi.service('api::wasender.wasender');
 * await wasenderService.sendTextMessage('+1234567890', 'Hello World');
 */

import type { Core } from '@strapi/strapi';
import  { getWasender } from './wasender-config';
import { TextOnlyMessage } from 'wasenderapi';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SenderType = 'user' | 'group' | 'channel';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiConfig {
  apiUrl: string;
  apiToken: string;
  deviceId: string;
}

interface SendTextOptions {
  senderType?: SenderType;
}

interface SendMediaOptions {
  caption?: string;
  senderType?: SenderType;
}

interface SendDocumentOptions {
  filename?: string;
  caption?: string;
  senderType?: SenderType;
}

interface SendVoiceOptions {
  senderType?: SenderType;
}

interface SendContactOptions {
  senderType?: SenderType;
}

interface SendLocationOptions {
  senderType?: SenderType;
}

interface SendBulkOptions {
  senderType?: SenderType;
  delayMs?: number;
}

interface ContactData {
  name: string;
  phone: string;
  email?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

interface MessageLogData {
  type: string;
  recipient: string;
  senderType: SenderType;
  status: string;
  timestamp: Date;
  [key: string]: any;
}

interface ApiPayload {
  recipient: string;
  type: string;
  message?: string;
  media_url?: string;
  filename?: string;
  caption?: string;
  contact?: {
    name: string;
    phone: string;
    email?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  sender_type: SenderType;
  device_id?: string;
  [key: string]: any;
}

interface ApiResponse {
  [key: string]: any;
}

interface BulkSendResult {
  recipient: string;
  success: boolean;
  result?: ApiResponse;
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  data?: ApiResponse;
  error?: string;
}

interface DeviceStatus {
  [key: string]: any;
}

interface MessageStatus {
  [key: string]: any;
}

interface RequestOptions {
  method: HttpMethod;
  headers: {
    'Content-Type': string;
    'Authorization': string;
    [key: string]: string;
  };
  body?: string;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export default ({ strapi }: { strapi: Core.Strapi }) => ({


    wasnder:getWasender(),
  /**
   * Get API configuration from environment variables
   * @private
   * @returns {ApiConfig} Configuration object
   * @throws {Error} If required environment variables are missing
   */


  getConfig(): ApiConfig {
    const config: ApiConfig = {
      apiUrl: process.env.WASENDER_API_URL || 'https://wasenderapi.com/api',
      apiToken: process.env.WASENDER_API_TOKEN || '',
      deviceId: process.env.WASENDER_DEVICE_ID || '',
    };

    if (!config.apiToken) {
      throw new Error('WASENDER_API_TOKEN environment variable is required');
    }

    if (!config.deviceId) {
      throw new Error('WASENDER_DEVICE_ID environment variable is required');
    }

    return config;
  },

  /**
   * Validate phone number format
   * @private
   * @param phoneNumber - Phone number to validate
   * @returns True if valid
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // Remove common formatting characters
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Check if it's a valid international format (with or without +)
    const phoneRegex = /^\+?[1-9]\d{7,14}$/;
    return phoneRegex.test(cleaned);
  },

  /**
   * Sanitize phone number to standard format
   * @private
   * @param phoneNumber - Phone number to sanitize
   * @returns Sanitized phone number
   */
  sanitizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except leading +
    let cleaned = phoneNumber.trim();
    if (cleaned.startsWith('+')) {
      cleaned = '+' + cleaned.slice(1).replace(/\D/g, '');
    } else {
      cleaned = cleaned.replace(/\D/g, '');
    }
    return cleaned;
  },

  /**
   * Validate file URL or base64 data
   * @private
   * @param data - URL or base64 string
   * @returns True if valid
   */
  validateMediaData(data: string): boolean {
    if (!data || typeof data !== 'string') return false;
    
    // Check if it's a valid URL
    try {
      new URL(data);
      return true;
    } catch {
      // Check if it's base64
      return /^data:.*?;base64,/.test(data);
    }
  },

  /**
   * Make API request to WaSender
   * @private
   * @param endpoint - API endpoint
   * @param method - HTTP method
   * @param data - Request payload
   * @returns API response
   * @throws {Error} If request fails
   */
  async makeRequest(endpoint: string, method: HttpMethod = 'POST', data: any = null): Promise<ApiResponse> {
    const config = this.getConfig();
    const url = `${config.apiUrl}${endpoint}`;

    const options: RequestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`,
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify({
        ...data,
        device_id: config.deviceId,
      });
    }

    try {
      const response = await fetch(url, options);
      const responseData: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message || 
          `API request failed with status ${response.status}`
        );
      }

      return responseData;
    } catch (error: any) {
      strapi.log.error('WaSender API request failed:', error);
      throw new Error(`WaSender API Error: ${error.message}`);
    }
  },

  /**
   * Log message to database for tracking
   * @private
   * @param messageData - Message details to log
   */
  async logMessage(messageData: MessageLogData): Promise<void> {
    try {
      // Optional: Create a content type to store message logs
      // await strapi.entityService.create('api::wasender-log.wasender-log', {
      //   data: messageData
      // });
      strapi.log.info('WaSender message sent:', messageData);
    } catch (error: any) {
      strapi.log.error('Failed to log message:', error);
    }
  },

  // ============================================================================
  // TEXT MESSAGES
  // ============================================================================

  /**
   * Send a text message
   * @param recipient - Phone number with country code (e.g., +1234567890)
   * @param message - Text message content
   * @param options - Additional options
   * @param options.senderType - Type: 'user', 'group', or 'channel' (default: 'user')
   * @returns API response
   * @throws {Error} If validation fails or API request fails
   * 
   * @example
   * await sendTextMessage('+1234567890', 'Hello World!');
   * await sendTextMessage('groupId@g.us', 'Hello Group!', { senderType: 'group' });
   */
  async sendTextMessage(recipient: string, message: string, options: SendTextOptions = {}): Promise<ApiResponse> {
    // Validation
    if (!recipient || typeof recipient !== 'string') {
      throw new Error('Recipient phone number is required');
    }

    if (!message || typeof message !== 'string') {
      throw new Error('Message text is required');
    }

    if (message.length > 4096) {
      throw new Error('Message exceeds maximum length of 4096 characters');
    }

    const senderType: SenderType = options.senderType || 'user';
    if (!['user', 'group', 'channel'].includes(senderType)) {
      throw new Error('Invalid sender type. Must be: user, group, or channel');
    }

    // Sanitize phone number for users
    const cleanRecipient = senderType === 'user' 
      ? this.sanitizePhoneNumber(recipient)
      : recipient;

    if (senderType === 'user' && !this.validatePhoneNumber(cleanRecipient)) {
      throw new Error('Invalid phone number format');
    }

    const payload: TextOnlyMessage  = {
        messageType: "text",
        to:cleanRecipient,// "+1234567890", // Recipient's JID
        text: message,
    //   recipient: cleanRecipient,
    //   type: 'text',
    //   message: message,
    //   sender_type: senderType,
    };
    const result = await this.wasnder.send(payload);
    console.log("Message sent:", result.response.message);
    console.log("Rate limit remaining:", result.rateLimit.remaining);
    // const response = await this.makeRequest('/send', 'POST', payload);
    
    await this.logMessage({
      type: 'text',
      recipient: cleanRecipient,
      senderType,
      status: 'sent',
      timestamp: new Date(),
    });

    // return response;
    return  {
        success: true,
        data: {
            
                type: 'text',
                recipient: cleanRecipient,
                senderType,
                status: 'sent',
                timestamp: new Date(),
              
        },
        message: message,
      } as ApiResponse;
  },

  // ============================================================================
  // MEDIA MESSAGES (Image, Video, Document)
  // ============================================================================

  /**
   * Send an image message
   * @param recipient - Phone number or group/channel ID
   * @param imageUrl - Image URL or base64 data
   * @param options - Additional options
   * @param options.caption - Optional caption for the image
   * @param options.senderType - Type: 'user', 'group', or 'channel' (default: 'user')
   * @returns API response
   * 
   * @example
   * await sendImage('+1234567890', 'https://example.com/image.jpg', { caption: 'Check this out!' });
   */
  async sendImage(recipient: string, imageUrl: string, options: SendMediaOptions = {}): Promise<ApiResponse> {
    if (!recipient || typeof recipient !== 'string') {
      throw new Error('Recipient is required');
    }

    if (!this.validateMediaData(imageUrl)) {
      throw new Error('Invalid image URL or base64 data');
    }

    const senderType: SenderType = options.senderType || 'user';
    const cleanRecipient = senderType === 'user' 
      ? this.sanitizePhoneNumber(recipient)
      : recipient;

    const payload: ApiPayload = {
      recipient: cleanRecipient,
      type: 'image',
      media_url: imageUrl,
      sender_type: senderType,
    };

    if (options.caption) {
      payload.caption = options.caption.substring(0, 1024); // Limit caption length
    }

    const response = await this.makeRequest('/send', 'POST', payload);
    
    await this.logMessage({
      type: 'image',
      recipient: cleanRecipient,
      senderType,
      status: 'sent',
      timestamp: new Date(),
    });

    return response;
  },

  /**
   * Send a video message
   * @param recipient - Phone number or group/channel ID
   * @param videoUrl - Video URL or base64 data
   * @param options - Additional options
   * @param options.caption - Optional caption for the video
   * @param options.senderType - Type: 'user', 'group', or 'channel' (default: 'user')
   * @returns API response
   * 
   * @example
   * await sendVideo('+1234567890', 'https://example.com/video.mp4');
   */
  async sendVideo(recipient: string, videoUrl: string, options: SendMediaOptions = {}): Promise<ApiResponse> {
    if (!recipient || typeof recipient !== 'string') {
      throw new Error('Recipient is required');
    }

    if (!this.validateMediaData(videoUrl)) {
      throw new Error('Invalid video URL or base64 data');
    }

    const senderType: SenderType = options.senderType || 'user';
    const cleanRecipient = senderType === 'user' 
      ? this.sanitizePhoneNumber(recipient)
      : recipient;

    const payload: ApiPayload = {
      recipient: cleanRecipient,
      type: 'video',
      media_url: videoUrl,
      sender_type: senderType,
    };

    if (options.caption) {
      payload.caption = options.caption.substring(0, 1024);
    }

    const response = await this.makeRequest('/send', 'POST', payload);
    
    await this.logMessage({
      type: 'video',
      recipient: cleanRecipient,
      senderType,
      status: 'sent',
      timestamp: new Date(),
    });

    return response;
  },

  /**
   * Send a document/file message
   * @param recipient - Phone number or group/channel ID
   * @param documentUrl - Document URL or base64 data
   * @param options - Additional options
   * @param options.filename - Name of the file
   * @param options.caption - Optional caption
   * @param options.senderType - Type: 'user', 'group', or 'channel' (default: 'user')
   * @returns API response
   * 
   * @example
   * await sendDocument('+1234567890', 'https://example.com/doc.pdf', { 
   *   filename: 'report.pdf',
   *   caption: 'Monthly report'
   * });
   */
  async sendDocument(recipient: string, documentUrl: string, options: SendDocumentOptions = {}): Promise<ApiResponse> {
    if (!recipient || typeof recipient !== 'string') {
      throw new Error('Recipient is required');
    }

    if (!this.validateMediaData(documentUrl)) {
      throw new Error('Invalid document URL or base64 data');
    }

    const senderType: SenderType = options.senderType || 'user';
    const cleanRecipient = senderType === 'user' 
      ? this.sanitizePhoneNumber(recipient)
      : recipient;

    const payload: ApiPayload = {
      recipient: cleanRecipient,
      type: 'document',
      media_url: documentUrl,
      sender_type: senderType,
    };

    if (options.filename) {
      payload.filename = options.filename;
    }

    if (options.caption) {
      payload.caption = options.caption.substring(0, 1024);
    }

    const response = await this.makeRequest('/send', 'POST', payload);
    
    await this.logMessage({
      type: 'document',
      recipient: cleanRecipient,
      senderType,
      status: 'sent',
      timestamp: new Date(),
    });

    return response;
  },

  // ============================================================================
  // VOICE MESSAGES
  // ============================================================================

  /**
   * Send a voice message
   * @param recipient - Phone number or group/channel ID
   * @param audioUrl - Audio file URL or base64 data (OGG/OPUS format preferred)
   * @param options - Additional options
   * @param options.senderType - Type: 'user', 'group', or 'channel' (default: 'user')
   * @returns API response
   * 
   * @example
   * await sendVoice('+1234567890', 'https://example.com/audio.ogg');
   */
  async sendVoice(recipient: string, audioUrl: string, options: SendVoiceOptions = {}): Promise<ApiResponse> {
    if (!recipient || typeof recipient !== 'string') {
      throw new Error('Recipient is required');
    }

    if (!this.validateMediaData(audioUrl)) {
      throw new Error('Invalid audio URL or base64 data');
    }

    const senderType: SenderType = options.senderType || 'user';
    const cleanRecipient = senderType === 'user' 
      ? this.sanitizePhoneNumber(recipient)
      : recipient;

    const payload: ApiPayload = {
      recipient: cleanRecipient,
      type: 'voice',
      media_url: audioUrl,
      sender_type: senderType,
    };

    const response = await this.makeRequest('/send', 'POST', payload);
    
    await this.logMessage({
      type: 'voice',
      recipient: cleanRecipient,
      senderType,
      status: 'sent',
      timestamp: new Date(),
    });

    return response;
  },

  // ============================================================================
  // CONTACT MESSAGES
  // ============================================================================

  /**
   * Send contact information
   * @param recipient - Phone number or group/channel ID
   * @param contactData - Contact information
   * @param contactData.name - Contact's full name
   * @param contactData.phone - Contact's phone number
   * @param contactData.email - Contact's email (optional)
   * @param options - Additional options
   * @param options.senderType - Type: 'user', 'group', or 'channel' (default: 'user')
   * @returns API response
   * 
   * @example
   * await sendContact('+1234567890', {
   *   name: 'John Doe',
   *   phone: '+9876543210',
   *   email: 'john@example.com'
   * });
   */
  async sendContact(recipient: string, contactData: ContactData, options: SendContactOptions = {}): Promise<ApiResponse> {
    if (!recipient || typeof recipient !== 'string') {
      throw new Error('Recipient is required');
    }

    if (!contactData || typeof contactData !== 'object') {
      throw new Error('Contact data is required');
    }

    if (!contactData.name || !contactData.phone) {
      throw new Error('Contact name and phone are required');
    }

    if (!this.validatePhoneNumber(contactData.phone)) {
      throw new Error('Invalid contact phone number format');
    }

    const senderType: SenderType = options.senderType || 'user';
    const cleanRecipient = senderType === 'user' 
      ? this.sanitizePhoneNumber(recipient)
      : recipient;

    const payload: ApiPayload = {
      recipient: cleanRecipient,
      type: 'contact',
      contact: {
        name: contactData.name,
        phone: this.sanitizePhoneNumber(contactData.phone),
        email: contactData.email || undefined,
      },
      sender_type: senderType,
    };

    const response = await this.makeRequest('/send', 'POST', payload);
    
    await this.logMessage({
      type: 'contact',
      recipient: cleanRecipient,
      senderType,
      status: 'sent',
      timestamp: new Date(),
    });

    return response;
  },

  // ============================================================================
  // LOCATION MESSAGES
  // ============================================================================

  /**
   * Send location data
   * @param recipient - Phone number or group/channel ID
   * @param locationData - Location information
   * @param locationData.latitude - Latitude coordinate
   * @param locationData.longitude - Longitude coordinate
   * @param locationData.name - Location name (optional)
   * @param locationData.address - Location address (optional)
   * @param options - Additional options
   * @param options.senderType - Type: 'user', 'group', or 'channel' (default: 'user')
   * @returns API response
   * 
   * @example
   * await sendLocation('+1234567890', {
   *   latitude: 37.7749,
   *   longitude: -122.4194,
   *   name: 'San Francisco',
   *   address: 'San Francisco, CA, USA'
   * });
   */
  async sendLocation(recipient: string, locationData: LocationData, options: SendLocationOptions = {}): Promise<ApiResponse> {
    if (!recipient || typeof recipient !== 'string') {
      throw new Error('Recipient is required');
    }

    if (!locationData || typeof locationData !== 'object') {
      throw new Error('Location data is required');
    }

    if (
      typeof locationData.latitude !== 'number' ||
      typeof locationData.longitude !== 'number'
    ) {
      throw new Error('Valid latitude and longitude are required');
    }

    // Validate coordinate ranges
    if (
      locationData.latitude < -90 ||
      locationData.latitude > 90 ||
      locationData.longitude < -180 ||
      locationData.longitude > 180
    ) {
      throw new Error('Invalid coordinate values');
    }

    const senderType: SenderType = options.senderType || 'user';
    const cleanRecipient = senderType === 'user' 
      ? this.sanitizePhoneNumber(recipient)
      : recipient;

    const payload: ApiPayload = {
      recipient: cleanRecipient,
      type: 'location',
      location: {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        name: locationData.name || undefined,
        address: locationData.address || undefined,
      },
      sender_type: senderType,
    };

    const response = await this.makeRequest('/send', 'POST', payload);
    
    await this.logMessage({
      type: 'location',
      recipient: cleanRecipient,
      senderType,
      status: 'sent',
      timestamp: new Date(),
    });

    return response;
  },

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Send message to multiple recipients
   * @param recipients - Array of phone numbers or IDs
   * @param message - Message text
   * @param options - Additional options
   * @param options.senderType - Type: 'user', 'group', or 'channel' (default: 'user')
   * @param options.delayMs - Delay between messages in milliseconds (default: 1000)
   * @returns Array of results
   * 
   * @example
   * const results = await sendBulkTextMessage(
   *   ['+1234567890', '+0987654321'],
   *   'Bulk message',
   *   { delayMs: 2000 }
   * );
   */
  async sendBulkTextMessage(recipients: string[], message: string, options: SendBulkOptions = {}): Promise<BulkSendResult[]> {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients array is required');
    }

    if (recipients.length > 100) {
      throw new Error('Maximum 100 recipients allowed per bulk operation');
    }

    const delayMs = options.delayMs || 1000;
    const results: BulkSendResult[] = [];

    for (const recipient of recipients) {
      try {
        const result = await this.sendTextMessage(recipient, message, options);
        results.push({ recipient, success: true, result });
        
        // Delay to avoid rate limiting
        if (delayMs > 0) {
          await new Promise<void>(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error: any) {
        results.push({ 
          recipient, 
          success: false, 
          error: error.message 
        });
        strapi.log.error(`Failed to send to ${recipient}:`, error);
      }
    }

    return results;
  },

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check device status
   * @returns Device status information
   */
  async checkDeviceStatus(): Promise<DeviceStatus> {
    return await this.makeRequest('/device/status', 'GET');
  },

  /**
   * Get message delivery status
   * @param messageId - Message ID returned from send operation
   * @returns Message status
   */
  async getMessageStatus(messageId: string): Promise<MessageStatus> {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    return await this.makeRequest(`/message/${messageId}/status`, 'GET');
  },

  /**
   * Validate recipient before sending
   * @param recipient - Phone number to validate
   * @returns Validation result
   */
  async validateRecipient(recipient: string): Promise<ValidationResult> {
    const cleanRecipient = this.sanitizePhoneNumber(recipient);
    
    if (!this.validatePhoneNumber(cleanRecipient)) {
      return { valid: false, error: 'Invalid phone number format' };
    }

    try {
      const response = await this.makeRequest('/validate', 'POST', {
        phone: cleanRecipient,
      });
      return { valid: true, data: response };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  },
});
