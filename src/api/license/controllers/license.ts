/**
 * license controller
 */

import { factories } from '@strapi/strapi';
import { decryptLicenseKey } from '../utils/encryption';
import { generateLicenseKey, type LicenseKeyData } from '../utils/encryption';

export default factories.createCoreController('api::license.license', ({ strapi }) => ({
  /**
   * Override create method to handle API requests with userDocumentId
   * POST /api/licenses
   * Body: { data: { userDocumentId: string, expirationType: string, maxSeats: number, expiresAt?: string } }
   */
  async create(ctx) {
    const { data } = ctx.request.body;

    // Check if this is an API request with userDocumentId
    if (data && data.userDocumentId) {
      try {
        // Validate required fields
        const requiredFields = ['expirationType', 'maxSeats', 'userDocumentId'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
          return ctx.badRequest(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Validate expirationType
        if (data.expirationType !== 'perpetual' && data.expirationType !== 'expiring') {
          return ctx.badRequest('expirationType must be either "perpetual" or "expiring"');
        }

        // Validate expiresAt for expiring licenses
        if (data.expirationType === 'expiring') {
          if (!data.expiresAt) {
            return ctx.badRequest('expiresAt is required for expiring licenses');
          }
          
          const expireDate = new Date(data.expiresAt);
          const now = new Date();
          
          if (expireDate <= now) {
            return ctx.badRequest('expiresAt must be a future date');
          }
        }

        // Validate maxSeats
        if (typeof data.maxSeats !== 'number' || data.maxSeats <= 0 || !Number.isInteger(data.maxSeats)) {
          return ctx.badRequest('maxSeats must be a positive integer');
        }

        // Validate user exists by documentId
        const user = await strapi.documents('plugin::users-permissions.user').findOne({
        documentId: data.userDocumentId,
       
        });

        
        if (!user ) {
          return ctx.badRequest('User reference does not exist');
        }

        if (user.planType === "FreeTrial") {
          data.expirationType = "expiring";
          if (!data.expiresAt) {
            data.expiresAt = new Date(Date.now() + 1 * 60 * 60 * 60 * 1000).toISOString();
          }
        }
        if (user.planType === "Pro") {
          data.expirationType = "expiring";
          if (!data.expiresAt) {
            data.expiresAt = new Date(Date.now() + 365 * 60 * 60 * 60 * 1000).toISOString();
          }
        }

        if (user.planType === "Enterprise") {
          data.expirationType = "expiring";
          if (!data.expiresAt) {
            data.expiresAt = new Date(Date.now() + 365 * 120 * 60 * 60 * 1000).toISOString();
          }
        }

        // Generate license key
        const licenseKeyData: LicenseKeyData = {
          expirationType: data.expirationType,
          maxSeats: data.maxSeats,
       
          userId: data.userDocumentId,
          expiresAt: data.expiresAt,
          timestamp: Date.now()
        };

        const licenseKey = generateLicenseKey(licenseKeyData);

        // Create license using Document Service API
        const license = await strapi.documents('api::license.license').create({
         status:"published", 
          data: {
            expirationType: data.expirationType,
            maxSeats: data.maxSeats,
            expiresAt: data.expiresAt,
            planSubscriptionType: data.planType,
            user: data.userDocumentId,
            licenseKey,
            isActive: false
          }
        });

        return ctx.send({ data: license });
      } catch (error) {
        strapi.log.error('License creation failed', {
          error: error.message,
          stack: error.stack
        });

        if (error.message?.includes('ENCRYPTION_KEY')) {
          return ctx.internalServerError('License key generation failed: encryption key not configured');
        }

        return ctx.internalServerError('An error occurred while creating the license');
      }
    }

    // For admin panel requests, use default behavior (lifecycle hooks will handle it)
    return await super.create(ctx);
  },

  /**
   * Custom activate endpoint to activate a license
   * POST /api/licenses/activate
   * Body: { licenseKey: string, machineUUID: string }
   * 
   * This endpoint is called by desktop applications without user authentication.
   * It validates the license key by:
   * 1. Decrypting and verifying the key matches stored license data
   * 2. Checking the license hasn't expired
   * 3. Ensuring the number of active seats doesn't exceed maxSeats
   * 4. Checking if the machine is already activated
   * 5. Creating a new key-seat entry for the device
   * 6. Activating the license if all validations pass
   */
  async activate(ctx) {
    try {
      const { licenseKey, machineUUID, telemetry, timezone } = ctx.request.body;

      // Validate required fields
      if (!licenseKey) {
        return ctx.badRequest('License key is required');
      }

      if (!machineUUID) {
        return ctx.badRequest('Machine UUID is required');
      }

      // Validate and sanitize timezone (IANA timezone format)
      let validatedTimezone = 'UTC'; // Default to UTC
      if (timezone) {
        try {
          // Test if timezone is valid by trying to format a date with it
          new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
          validatedTimezone = timezone;
          strapi.log.info('Valid timezone provided', { timezone, machineUUID });
        } catch (error) {
          strapi.log.warn('Invalid timezone provided, defaulting to UTC', {
            providedTimezone: timezone,
            machineUUID
          });
          // Don't fail activation, just use UTC as fallback
        }
      }

      // Decrypt and validate the license key
      let decryptedData: LicenseKeyData | null;
      try {
        decryptedData = decryptLicenseKey(licenseKey);
      } catch (error) {
        strapi.log.error('License key decryption failed', {
          error: error.message,
          stack: error.stack
        });
        return ctx.badRequest('Failed to decrypt license key');
      }

      if (!decryptedData) {
        return ctx.badRequest('Invalid license key format or corrupted data');
      }

      // Query license by licenseKey using Document Service API
      const licenses = await strapi.documents('api::license.license').findMany({
        filters: { licenseKey },
        populate: {
          user: true,
          seats: true
        },
        status: 'published'
      });

      // Validate license exists
      if (!licenses || licenses.length === 0) {
        return ctx.notFound('License key not found');
      }

      const license = licenses[0];

      // Log the full license object for debugging
      console.log('=== FOUND LICENSE ===');
      console.log('documentId:', license.documentId);
      console.log('expirationType:', license.expirationType);
      console.log('maxSeats:', license.maxSeats);
      console.log('user:', JSON.stringify(license.user, null, 2));
      console.log('userType:', typeof license.user);
      console.log('isActive:', license.isActive);

      // Log decrypted data
      console.log('=== DECRYPTED DATA ===');
      console.log('expirationType:', decryptedData.expirationType);
      console.log('maxSeats:', decryptedData.maxSeats);
      console.log('userId:', decryptedData.userId);
      console.log('expiresAt:', decryptedData.expiresAt);
      console.log('timestamp:', decryptedData.timestamp);

          // Validate license not already active
      if (!license.isActive) {
        return ctx.badRequest('This License Deativated Back to your dashboard to reactivate it again .');
      }

      // Extract user documentId (handle both populated and non-populated cases)
      let userDocumentId: string | undefined;
      if (typeof license.user === 'object' && license.user !== null) {
        userDocumentId = license.user.documentId;
      } else if (typeof license.user === 'string') {
        userDocumentId = license.user;
      } else {
        // If user is not populated, fetch the license again with proper population
        strapi.log.warn('User relation not properly populated, refetching license');
        const refetchedLicenses = await strapi.documents('api::license.license').findMany({
          filters: { documentId: license.documentId },
          populate: {
            user: {
              fields: ['documentId']
            }
          },
          status: 'published'
        });
        
        if (refetchedLicenses && refetchedLicenses.length > 0 && refetchedLicenses[0].user) {
          userDocumentId = typeof refetchedLicenses[0].user === 'object' 
            ? refetchedLicenses[0].user.documentId 
            : refetchedLicenses[0].user;
        }
      }

      if (!userDocumentId) {
        strapi.log.error('Could not extract user documentId from license', {
          licenseUser: license.user,
          licenseDocumentId: license.documentId
        });
        return ctx.internalServerError('License data is corrupted - missing user reference');
      }

      console.log('=== EXTRACTED USER ID ===');
      console.log('userDocumentId:', userDocumentId);

      // Verify decrypted data matches stored license data
      const expirationTypeMatch = license.expirationType === decryptedData.expirationType;
      const maxSeatsMatch = license.maxSeats === decryptedData.maxSeats;
      const userIdMatch = userDocumentId === decryptedData.userId;

      console.log('=== VALIDATION CHECKS ===');
      console.log('expirationTypeMatch:', expirationTypeMatch, '(', license.expirationType, '===', decryptedData.expirationType, ')');
      console.log('maxSeatsMatch:', maxSeatsMatch, '(', license.maxSeats, '===', decryptedData.maxSeats, ')');
      console.log('userIdMatch:', userIdMatch, '(', userDocumentId, '===', decryptedData.userId, ')');

      if (!expirationTypeMatch || !maxSeatsMatch || !userIdMatch) {
        // Log mismatch details for debugging
        strapi.log.error('License validation mismatch', {
          stored: {
            expirationType: license.expirationType,
            maxSeats: license.maxSeats,
            userId: userDocumentId,
            userRaw: license.user
          },
          decrypted: {
            expirationType: decryptedData.expirationType,
            maxSeats: decryptedData.maxSeats,
            userId: decryptedData.userId
          },
          matches: {
            expirationTypeMatch,
            maxSeatsMatch,
            userIdMatch
          }
        });
        
        return ctx.badRequest('License key validation failed - data mismatch');
      }

      // Validate license not expired (for expiring type)
      if (license.expirationType === 'expiring' && license.expiresAt) {
        const expireDate = new Date(license.expiresAt);
        const now = new Date();
        
        if (now >= expireDate) {
          return ctx.badRequest('License has expired');
        }
      }

      // Check if this machine is already activated for THIS specific license
      const existingSeatForThisLicense = license.seats?.find(seat => seat.machineUUID === machineUUID);

      let keySeat: any;
      
      if (existingSeatForThisLicense) {
        // This machine is already registered for THIS license - reactivate it
        keySeat = await strapi.documents('api::key-seat.key-seat').update({
          documentId: existingSeatForThisLicense.documentId,
          status:'published',
          data: { 
            isActive: true,
            timezone: validatedTimezone, // Update timezone on reactivation
            telemetry: {
              ...telemetry,
              lastActivated: new Date().toISOString()
            }
          },
       
        });

        // Update license to active
        const updatedLicense = await strapi.documents('api::license.license').update({
          documentId: license.documentId,
          data: { isActive: true },
          status: 'published'
        });

        // Log reactivation
        strapi.log.info('License reactivated for existing machine', {
          licenseId: license.documentId,
          machineUUID,
          keySeatId: keySeat.documentId,
          timestamp: new Date().toISOString()
        });

        // Get updated active seats count
        const activeSeatsCount = license.seats?.filter(seat => seat.isActive).length || 0;

        return ctx.send({
          data: {
            message: 'License reactivated successfully',
            license: {
              documentId: updatedLicense.documentId,
              userDocumentId: userDocumentId,
              planSubscriptionType: license.planSubscriptionType,
              licenseKey: updatedLicense.licenseKey,
              isActive: updatedLicense.isActive,
              expirationType: updatedLicense.expirationType,
              expiresAt: updatedLicense.expiresAt,
              maxSeats: updatedLicense.maxSeats,
              activeSeats: activeSeatsCount
            },
            seat: {
              documentId: keySeat.documentId,
              machineUUID: keySeat.machineUUID,
              isActive: keySeat.isActive
            }
          }
        });
      }

      // Machine UUID doesn't exist for this license - create new seat
      // First check if we have available seats
      const activeSeatsCount = license.seats?.filter(seat => seat.isActive).length || 0;
      
      if (activeSeatsCount >= license.maxSeats) {
        return ctx.badRequest(`Maximum number of seats (${license.maxSeats}) already activated`);
      }

      // Create new key-seat entry
      keySeat = await strapi.documents('api::key-seat.key-seat').create({
        data: {
          machineUUID,
          isActive: true,
          timezone: validatedTimezone, // Store timezone for this seat
          license: license.documentId,
          telemetry: {
            ...telemetry,
            firstActivated: new Date().toISOString()
          }
        },
        status: 'published'
      });

      // Update license to active using Document Service API
      const updatedLicense = await strapi.documents('api::license.license').update({
        documentId: license.documentId,
        data: { isActive: true },
        status: 'published'
      });

      // Get updated active seats count
      const finalActiveSeatsCount = license.seats?.filter(seat => seat.isActive).length || 0;

      // Log successful activation
      strapi.log.info('License activated for new machine', {
        licenseId: license.documentId,
        userId: decryptedData.userId,
        machineUUID,
        keySeatId: keySeat.documentId,
        activeSeats: finalActiveSeatsCount + 1,
        maxSeats: license.maxSeats,
        timestamp: new Date().toISOString()
      });

      // Return success response with planSubscriptionType for offline POS apps
      return ctx.send({
        data: {
          message: 'License activated successfully',
          license: {
            documentId: updatedLicense.documentId,
            userDocumentId: userDocumentId,
            planSubscriptionType: license.planSubscriptionType,
            licenseKey: updatedLicense.licenseKey,
            isActive: updatedLicense.isActive,
            expirationType: updatedLicense.expirationType,
            expiresAt: updatedLicense.expiresAt,
            maxSeats: updatedLicense.maxSeats,
            activeSeats: finalActiveSeatsCount + 1
          },
          seat: {
            documentId: keySeat.documentId,
            machineUUID: keySeat.machineUUID,
            isActive: keySeat.isActive
          }
        }
      });
    } catch (error) {
      // Log detailed error with context
      strapi.log.error('License activation failed', {
        error: error.message,
        stack: error.stack,
        body: ctx.request.body,
        timestamp: new Date().toISOString()
      });

      // Check for specific error types
      if (error.message?.includes('ENCRYPTION_KEY')) {
        return ctx.internalServerError('License key decryption failed: encryption key not configured');
      }

      // Return error with more details in development
      if (process.env.NODE_ENV === 'development') {
        return ctx.internalServerError(`An error occurred while activating the license: ${error.message}`);
      }

      // Return generic error message in production
      return ctx.internalServerError('An error occurred while activating the license');
    }
  },

  /**
   * Custom endpoint to get real-time insights for all seats of a license
   * GET /api/licenses/:documentId/seats-insights
   * Returns aggregated KPIs and individual seat telemetry data
   */
  async getSeatsInsights(ctx) {
    try {
      const { documentId } = ctx.params;

      if (!documentId) {
        return ctx.badRequest('License documentId is required');
      }

      // Delegate to service for business logic
      const insights = await strapi.service('api::license.license').generateSeatsInsights(documentId);

      return ctx.send({
        data: insights
      });
    } catch (error) {
      strapi.log.error('Failed to generate seats insights:', {
        documentId: ctx.params.documentId,
        error: error.message,
        stack: error.stack
      });

      if (error.message.includes('not found')) {
        return ctx.notFound('License not found');
      }

      return ctx.internalServerError('Failed to generate insights');
    }
  },

  /**
   * Custom endpoint to regenerate license key for existing license
   * POST /api/licenses/:documentId/regenerate-key
   * This is useful when license data was updated but the key wasn't regenerated
   */
  async regenerateKey(ctx) {
    try {
      const { documentId } = ctx.params;

      if (!documentId) {
        return ctx.badRequest('License documentId is required');
      }

      // Fetch the license
      const licenses = await strapi.documents('api::license.license').findMany({
        filters: { documentId },
        populate: { user: true },
        status: 'published'
      });

      if (!licenses || licenses.length === 0) {
        return ctx.notFound('License not found');
      }

      const license = licenses[0];

      // Extract user documentId
      let userDocumentId: string;
      if (typeof license.user === 'object' && license.user !== null) {
        userDocumentId = license.user.documentId;
      } else if (typeof license.user === 'string') {
        userDocumentId = license.user;
      } else {
        return ctx.badRequest('License has no associated user');
      }

      // Generate new license key with current license data
      const licenseKeyData: LicenseKeyData = {
        expirationType: license.expirationType,
        maxSeats: license.maxSeats,
        userId: userDocumentId,
        expiresAt: license.expiresAt ? new Date(license.expiresAt).toISOString() : undefined,
        timestamp: Date.now()
      };

      const newLicenseKey = generateLicenseKey(licenseKeyData);

      // Update the license with new key
      const updatedLicense = await strapi.documents('api::license.license').update({
        documentId: license.documentId,
        data: { licenseKey: newLicenseKey },
        status: 'published'
      });

      console.log('License key regenerated successfully for:', documentId);

      return ctx.send({
        data: {
          message: 'License key regenerated successfully',
          license: {
            documentId: updatedLicense.documentId,
            licenseKey: updatedLicense.licenseKey,
            expirationType: updatedLicense.expirationType,
            maxSeats: updatedLicense.maxSeats,
            expiresAt: updatedLicense.expiresAt
          }
        }
      });
    } catch (error) {
      strapi.log.error('License key regeneration failed', {
        error: error.message,
        stack: error.stack
      });

      return ctx.internalServerError('An error occurred while regenerating the license key');
    }
  }
}));


// Great work, Now your new task is a diffrent we need to create an md file for ai agent how to using this apis end points and also for our web app that will excute some of crud operations fetch user data and populated relations and and fetch license key by document id and expected returned data and also hot wo populate the seats and also how to fetch his related seats and expected returned data json for all operations and also when to create new license key whats expected to passing in the body and also for activate route  and controller whats to passing , please read whoe apis dirs "schema.json" files to undrstand and then create the docs md file 