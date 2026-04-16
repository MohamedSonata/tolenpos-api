/**
 * WaSender Controller
 * 
 * Controller for handling WhatsApp messaging API endpoints via WaSenderAPI.com
 * Implements authentication, rate limiting, and comprehensive error handling
 * 
 * @module wasender-controller
 * 
 * API Endpoints:
 * - POST /api/wasender/send-text - Send text message
 * - POST /api/wasender/send-image - Send image message
 * - POST /api/wasender/send-video - Send video message
 * - POST /api/wasender/send-document - Send document
 * - POST /api/wasender/send-voice - Send voice message
 * - POST /api/wasender/send-contact - Send contact information
 * - POST /api/wasender/send-location - Send location data
 * - POST /api/wasender/send-bulk - Send bulk messages
 * - GET /api/wasender/device-status - Check device status
 * - GET /api/wasender/message-status/:id - Check message status
 * - POST /api/wasender/validate-recipient - Validate phone number
 * 
 * @example
 * // Send text message
 * POST /api/wasender/send-text
 * {
 *   "recipient": "+1234567890",
 *   "message": "Hello World!",
 *   "senderType": "user"
 * }
 */
import *  as waSenderService from '../wasender/service';
import type { Core } from '@strapi/strapi';
import { BulkSendResult, DeviceStatus, KoaContext, SendTextRequest, ApiResponse, SendImageRequest, SendVideoRequest, SendDocumentRequest, SendVoiceRequest, SendContactRequest, SendLocationRequest, SendBulkRequest, ValidateRecipientRequest, HealthCheckResponse, AuthenticatedUser, ContactData, LocationData, MessageStatus, ValidationResult } from './interfaces';

// Declare strapi as available globally (injected by Strapi)
declare const strapi: Core.Strapi;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SenderType = 'user' | 'group' | 'channel';



interface WaSenderService {
  sendTextMessage: (recipient: string, message: string, options?: { senderType?: SenderType }) => Promise<any>;
  sendImage: (recipient: string, imageUrl: string, options?: { caption?: string; senderType?: SenderType }) => Promise<any>;
  sendVideo: (recipient: string, videoUrl: string, options?: { caption?: string; senderType?: SenderType }) => Promise<any>;
  sendDocument: (recipient: string, documentUrl: string, options?: { filename?: string; caption?: string; senderType?: SenderType }) => Promise<any>;
  sendVoice: (recipient: string, audioUrl: string, options?: { senderType?: SenderType }) => Promise<any>;
  sendContact: (recipient: string, contact: ContactData, options?: { senderType?: SenderType }) => Promise<any>;
  sendLocation: (recipient: string, location: LocationData, options?: { senderType?: SenderType }) => Promise<any>;
  sendBulkTextMessage: (recipients: string[], message: string, options?: { senderType?: SenderType; delayMs?: number }) => Promise<BulkSendResult[]>;
  checkDeviceStatus: () => Promise<DeviceStatus>;
  getMessageStatus: (messageId: string) => Promise<MessageStatus>;
  validateRecipient: (recipient: string) => Promise<ValidationResult>;
  getConfig: () => { apiToken?: string; deviceId?: string; [key: string]: any };
}

// ============================================================================
// RATE LIMITING STORAGE
// ============================================================================

/**
 * Rate limiting storage (in-memory)
 * In production, consider using Redis or database
 */
const rateLimitStore = new Map<string, number[]>();

// ============================================================================
// CONTROLLER IMPLEMENTATION
// ============================================================================

const WaSenderController = {
  /**
   * Check if user is authenticated and authorized
   * @private
   */
  async checkAuth(ctx: KoaContext): Promise<AuthenticatedUser> {
    // Ensure user is authenticated
    if (!ctx.state.user) {
      ctx.throw(401, 'Authentication required');
    }

    // Optional: Check for specific role or permission
    // Uncomment and modify as needed
    // const hasPermission = await strapi.entityService.findMany(
    //   'plugin::users-permissions.role',
    //   { filters: { id: ctx.state.user.role.id, name: 'Authenticated' } }
    // );
    // if (!hasPermission) {
    //   ctx.throw(403, 'Insufficient permissions');
    // }

    return ctx.state.user;
  },

  /**
   * Rate limiting check
   * @private
   * @param ctx - Koa context
   * @param key - Rate limit key (usually user ID)
   * @param maxRequests - Maximum requests allowed
   * @param windowMs - Time window in milliseconds
   */
  checkRateLimit(ctx: KoaContext, key: string, maxRequests: number = 50, windowMs: number = 60000): void {
    const now = Date.now();
    const userKey = `${key}-${ctx.state.user?.id || ctx.ip}`;
    
    if (!rateLimitStore.has(userKey)) {
      rateLimitStore.set(userKey, []);
    }

    const requests = rateLimitStore.get(userKey)!;
    
    // Remove old requests outside the time window
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      ctx.throw(429, 'Rate limit exceeded. Please try again later.');
    }

    validRequests.push(now);
    rateLimitStore.set(userKey, validRequests);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      for (const [k, times] of rateLimitStore.entries()) {
        const valid = times.filter(t => now - t < windowMs);
        if (valid.length === 0) {
          rateLimitStore.delete(k);
        } else {
          rateLimitStore.set(k, valid);
        }
      }
    }
  },

  /**
   * Validate request body
   * @private
   */
  validateRequestBody<T = any>(ctx: KoaContext, requiredFields: string[] = []): T {
    const body = ctx.request.body;

    if (!body || typeof body !== 'object') {
      ctx.throw(400, 'Invalid request body');
    }

    for (const field of requiredFields) {
      if (!body[field]) {
        ctx.throw(400, `Missing required field: ${field}`);
      }
    }

    return body as T;
  },

  /**
   * Sanitize response data
   * @private
   */
  sanitizeResponse<T = any>(data: T): T {
    // Remove sensitive information if needed
    const sanitized = { ...data } as any;
    
    // Remove internal API tokens or sensitive data
    delete sanitized.api_token;
    delete sanitized.internal_id;
    
    return sanitized as T;
  },

  // ============================================================================
  // TEXT MESSAGE ENDPOINTS
  // ============================================================================

  /**
   * Send text message
   * POST /api/wasender/send-text
   * 
   * Body:
   * - recipient: Phone number (required)
   * - message: Text content (required)
   * - senderType: 'user', 'group', or 'channel' (optional, default: 'user')
   */
  async sendText(ctx: KoaContext): Promise<ApiResponse> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'send-text', 50, 60000);

      const { recipient, message, senderType } = this.validateRequestBody<SendTextRequest>(ctx, [
        'recipient',
        'message',
      ]);

       
      const result = await waSenderService.default({strapi}).sendTextMessage(recipient, message, {
        senderType,
      });

      ctx.body = {
        success: true,
        data: this.sanitizeResponse(result),
        message: 'Text message sent successfully',
      } as ApiResponse;
return ctx.body;
    } catch (error: any) {
      strapi.log.error('Send text error:', error);
    const err =   ctx.throw(error.status || 500, error.message);
      ctx.body = err;
      return ctx.body;
    }
  },

  // ============================================================================
  // MEDIA MESSAGE ENDPOINTS
  // ============================================================================

  /**
   * Send image message
   * POST /api/wasender/send-image
   * 
   * Body:
   * - recipient: Phone number (required)
   * - imageUrl: Image URL or base64 (required)
   * - caption: Image caption (optional)
   * - senderType: 'user', 'group', or 'channel' (optional)
   */
  async sendImage(ctx: KoaContext): Promise<void> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'send-image', 30, 60000);

      const { recipient, imageUrl, caption, senderType } = 
        this.validateRequestBody<SendImageRequest>(ctx, ['recipient', 'imageUrl']);

      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      const result = await wasenderService.sendImage(recipient, imageUrl, {
        caption,
        senderType,
      });

      ctx.body = {
        success: true,
        data: this.sanitizeResponse(result),
        message: 'Image sent successfully',
      } as ApiResponse;
    } catch (error: any) {
      strapi.log.error('Send image error:', error);
      ctx.throw(error.status || 500, error.message);
    }
  },

  /**
   * Send video message
   * POST /api/wasender/send-video
   * 
   * Body:
   * - recipient: Phone number (required)
   * - videoUrl: Video URL or base64 (required)
   * - caption: Video caption (optional)
   * - senderType: 'user', 'group', or 'channel' (optional)
   */
  async sendVideo(ctx: KoaContext): Promise<void> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'send-video', 20, 60000);

      const { recipient, videoUrl, caption, senderType } = 
        this.validateRequestBody<SendVideoRequest>(ctx, ['recipient', 'videoUrl']);

      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      const result = await wasenderService.sendVideo(recipient, videoUrl, {
        caption,
        senderType,
      });

      ctx.body = {
        success: true,
        data: this.sanitizeResponse(result),
        message: 'Video sent successfully',
      } as ApiResponse;
    } catch (error: any) {
      strapi.log.error('Send video error:', error);
      ctx.throw(error.status || 500, error.message);
    }
  },

  /**
   * Send document message
   * POST /api/wasender/send-document
   * 
   * Body:
   * - recipient: Phone number (required)
   * - documentUrl: Document URL or base64 (required)
   * - filename: File name (optional)
   * - caption: Document caption (optional)
   * - senderType: 'user', 'group', or 'channel' (optional)
   */
  async sendDocument(ctx: KoaContext): Promise<void> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'send-document', 30, 60000);

      const { recipient, documentUrl, filename, caption, senderType } = 
        this.validateRequestBody<SendDocumentRequest>(ctx, ['recipient', 'documentUrl']);

      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      const result = await wasenderService.sendDocument(recipient, documentUrl, {
        filename,
        caption,
        senderType,
      });

      ctx.body = {
        success: true,
        data: this.sanitizeResponse(result),
        message: 'Document sent successfully',
      } as ApiResponse;
    } catch (error: any) {
      strapi.log.error('Send document error:', error);
      ctx.throw(error.status || 500, error.message);
    }
  },

  // ============================================================================
  // VOICE MESSAGE ENDPOINT
  // ============================================================================

  /**
   * Send voice message
   * POST /api/wasender/send-voice
   * 
   * Body:
   * - recipient: Phone number (required)
   * - audioUrl: Audio URL or base64 (required)
   * - senderType: 'user', 'group', or 'channel' (optional)
   */
  async sendVoice(ctx: KoaContext): Promise<void> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'send-voice', 30, 60000);

      const { recipient, audioUrl, senderType } = 
        this.validateRequestBody<SendVoiceRequest>(ctx, ['recipient', 'audioUrl']);

      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      const result = await wasenderService.sendVoice(recipient, audioUrl, {
        senderType,
      });

      ctx.body = {
        success: true,
        data: this.sanitizeResponse(result),
        message: 'Voice message sent successfully',
      } as ApiResponse;
    } catch (error: any) {
      strapi.log.error('Send voice error:', error);
      ctx.throw(error.status || 500, error.message);
    }
  },

  // ============================================================================
  // CONTACT ENDPOINT
  // ============================================================================

  /**
   * Send contact information
   * POST /api/wasender/send-contact
   * 
   * Body:
   * - recipient: Phone number (required)
   * - contact: Object with name, phone, email (required)
   * - senderType: 'user', 'group', or 'channel' (optional)
   */
  async sendContact(ctx: KoaContext): Promise<void> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'send-contact', 40, 60000);

      const { recipient, contact, senderType } = 
        this.validateRequestBody<SendContactRequest>(ctx, ['recipient', 'contact']);

      if (!contact.name || !contact.phone) {
        ctx.throw(400, 'Contact must include name and phone');
      }

      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      const result = await wasenderService.sendContact(recipient, contact, {
        senderType,
      });

      ctx.body = {
        success: true,
        data: this.sanitizeResponse(result),
        message: 'Contact sent successfully',
      } as ApiResponse;
    } catch (error: any) {
      strapi.log.error('Send contact error:', error);
      ctx.throw(error.status || 500, error.message);
    }
  },

  // ============================================================================
  // LOCATION ENDPOINT
  // ============================================================================

  /**
   * Send location data
   * POST /api/wasender/send-location
   * 
   * Body:
   * - recipient: Phone number (required)
   * - location: Object with latitude, longitude, name, address (required)
   * - senderType: 'user', 'group', or 'channel' (optional)
   */
  async sendLocation(ctx: KoaContext): Promise<void> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'send-location', 40, 60000);

      const { recipient, location, senderType } = 
        this.validateRequestBody<SendLocationRequest>(ctx, ['recipient', 'location']);

      if (
        typeof location.latitude !== 'number' ||
        typeof location.longitude !== 'number'
      ) {
        ctx.throw(400, 'Location must include valid latitude and longitude');
      }

      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      const result = await wasenderService.sendLocation(recipient, location, {
        senderType,
      });

      ctx.body = {
        success: true,
        data: this.sanitizeResponse(result),
        message: 'Location sent successfully',
      } as ApiResponse;
    } catch (error: any) {
      strapi.log.error('Send location error:', error);
      ctx.throw(error.status || 500, error.message);
    }
  },

  // ============================================================================
  // BULK OPERATIONS ENDPOINT
  // ============================================================================

  /**
   * Send bulk text messages
   * POST /api/wasender/send-bulk
   * 
   * Body:
   * - recipients: Array of phone numbers (required, max 100)
   * - message: Text content (required)
   * - senderType: 'user', 'group', or 'channel' (optional)
   * - delayMs: Delay between messages in ms (optional, default: 1000)
   */
  async sendBulk(ctx: KoaContext): Promise<void> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'send-bulk', 5, 300000); // 5 requests per 5 minutes

      const { recipients, message, senderType, delayMs } = 
        this.validateRequestBody<SendBulkRequest>(ctx, ['recipients', 'message']);

      if (!Array.isArray(recipients)) {
        ctx.throw(400, 'Recipients must be an array');
      }

      if (recipients.length > 100) {
        ctx.throw(400, 'Maximum 100 recipients allowed per request');
      }

      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      const results = await wasenderService.sendBulkTextMessage(
        recipients,
        message,
        { senderType, delayMs }
      );

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      ctx.body = {
        success: true,
        data: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          results: results.map(r => this.sanitizeResponse(r)),
        },
        message: `Bulk send completed: ${successCount} successful, ${failureCount} failed`,
      } as ApiResponse;
    } catch (error: any) {
      strapi.log.error('Send bulk error:', error);
      ctx.throw(error.status || 500, error.message);
    }
  },

  // ============================================================================
  // UTILITY ENDPOINTS
  // ============================================================================

  /**
   * Check device status
   * GET /api/wasender/device-status
   */
  async getDeviceStatus(ctx: KoaContext): Promise<void> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'device-status', 20, 60000);

      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      const status = await wasenderService.checkDeviceStatus();

      ctx.body = {
        success: true,
        data: this.sanitizeResponse(status),
      } as ApiResponse;
    } catch (error: any) {
      strapi.log.error('Get device status error:', error);
      ctx.throw(error.status || 500, error.message);
    }
  },

  /**
   * Get message status
   * GET /api/wasender/message-status/:id
   */
  async getMessageStatus(ctx: KoaContext): Promise<void> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'message-status', 100, 60000);

      const { id } = ctx.params;

      if (!id) {
        ctx.throw(400, 'Message ID is required');
      }

      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      const status = await wasenderService.getMessageStatus(id);

      ctx.body = {
        success: true,
        data: this.sanitizeResponse(status),
      } as ApiResponse;
    } catch (error: any) {
      strapi.log.error('Get message status error:', error);
      ctx.throw(error.status || 500, error.message);
    }
  },

  /**
   * Validate recipient phone number
   * POST /api/wasender/validate-recipient
   * 
   * Body:
   * - recipient: Phone number (required)
   */
  async validateRecipient(ctx: KoaContext): Promise<void> {
    try {
      await this.checkAuth(ctx);
      this.checkRateLimit(ctx, 'validate-recipient', 50, 60000);

      const { recipient } = this.validateRequestBody<ValidateRecipientRequest>(ctx, ['recipient']);

      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      const validation = await wasenderService.validateRecipient(recipient);

      ctx.body = {
        success: validation.valid,
        data: validation.data || null,
        error: validation.error || null,
      } as ApiResponse;
    } catch (error: any) {
      strapi.log.error('Validate recipient error:', error);
      ctx.throw(error.status || 500, error.message);
    }
  },

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  /**
   * Health check endpoint
   * GET /api/wasender/health
   */
  async healthCheck(ctx: KoaContext): Promise<void> {
    try {
      const wasenderService = strapi.service('api::wasender.wasender') as WaSenderService;
      
      // Check if config is valid
      const config = wasenderService.getConfig();
      
      ctx.body = {
        success: true,
        status: 'healthy',
        configured: !!(config.apiToken && config.deviceId),
        timestamp: new Date().toISOString(),
      } as HealthCheckResponse;
    } catch (error: any) {
      ctx.body = {
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      } as HealthCheckResponse;
    }
  },
};

export default WaSenderController;
