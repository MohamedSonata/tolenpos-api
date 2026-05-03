/**
 * subscription-plan service
 */

import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';

interface CustomerAppFeatures {
  allowCustomerApp: boolean;
  allowMenuBrowsing: boolean;
  allowBarcodeScanning: boolean;
  allowCustomerOrdering: boolean;
  maxCustomerConnectionsPerSeat: number;
}

export default factories.createCoreService('api::subscription-plan.subscription-plan', ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Gets customer app features for a specific plan
   * @param planDocumentId - The plan's document ID
   * @returns Feature configuration or null if plan not found
   */
  async getCustomerAppFeatures(planDocumentId: string): Promise<CustomerAppFeatures | null> {
    try {
      const plan = await strapi.documents('api::subscription-plan.subscription-plan').findOne({
        documentId: planDocumentId,
        status: 'published'
      });

      if (!plan) {
        return null;
      }

      return {
        allowCustomerApp: plan.allowCustomerApp ?? false,
        allowMenuBrowsing: plan.allowMenuBrowsing ?? false,
        allowBarcodeScanning: plan.allowBarcodeScanning ?? false,
        allowCustomerOrdering: plan.allowCustomerOrdering ?? false,
        maxCustomerConnectionsPerSeat: plan.maxCustomerConnectionsPerSeat ?? 50
      };
    } catch (error) {
      strapi.log.error('[SubscriptionPlan] Failed to get customer app features:', { planDocumentId, error });
      return null;
    }
  },

  /**
   * Gets customer app features by user document ID
   * @param userDocumentId - The user's document ID
   * @returns Feature configuration or null if user has no plan
   */
  async getCustomerAppFeaturesByUser(userDocumentId: string): Promise<CustomerAppFeatures | null> {
    try {
      const user = await strapi.documents('plugin::users-permissions.user').findOne({
        documentId: userDocumentId,
        populate: { subscriptionPlan: true },
        status: 'published'
      });

      if (!user || !user.subscriptionPlan) {
        return null;
      }

      const planDocumentId = typeof user.subscriptionPlan === 'object' 
        ? user.subscriptionPlan.documentId 
        : user.subscriptionPlan;

      return this.getCustomerAppFeatures(planDocumentId);
    } catch (error) {
      strapi.log.error('[SubscriptionPlan] Failed to get customer app features by user:', { userDocumentId, error });
      return null;
    }
  }
}));
