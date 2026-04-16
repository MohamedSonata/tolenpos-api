/**
 * WaSender Routes Configuration
 * 
 * Defines all API routes for the WaSender integration
 * All routes require authentication by default
 * 
 * @module wasender-routes
 */

'use strict';

module.exports = {
  routes: [
    // ============================================================================
    // HEALTH & STATUS
    // ============================================================================
    {
      method: 'GET',
      path: '/wasender/health',
      handler: 'wasender.healthCheck',
      config: {
        auth: false, // Public endpoint
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wasender/device-status',
      handler: 'wasender.getDeviceStatus',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // ============================================================================
    // TEXT MESSAGES
    // ============================================================================
    {
      method: 'POST',
      path: '/wasender/send-text',
      handler: 'wasender.sendText',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // ============================================================================
    // MEDIA MESSAGES
    // ============================================================================
    {
      method: 'POST',
      path: '/wasender/send-image',
      handler: 'wasender.sendImage',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/wasender/send-video',
      handler: 'wasender.sendVideo',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/wasender/send-document',
      handler: 'wasender.sendDocument',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // ============================================================================
    // VOICE MESSAGES
    // ============================================================================
    {
      method: 'POST',
      path: '/wasender/send-voice',
      handler: 'wasender.sendVoice',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // ============================================================================
    // CONTACT & LOCATION
    // ============================================================================
    {
      method: 'POST',
      path: '/wasender/send-contact',
      handler: 'wasender.sendContact',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/wasender/send-location',
      handler: 'wasender.sendLocation',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // ============================================================================
    // BULK OPERATIONS
    // ============================================================================
    {
      method: 'POST',
      path: '/wasender/send-bulk',
      handler: 'wasender.sendBulk',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // ============================================================================
    // UTILITIES
    // ============================================================================
    {
      method: 'GET',
      path: '/wasender/message-status/:id',
      handler: 'wasender.getMessageStatus',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/wasender/validate-recipient',
      handler: 'wasender.validateRecipient',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};