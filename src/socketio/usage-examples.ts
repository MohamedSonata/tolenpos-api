// /**
//  * Usage Examples for Multi-Replica Socket.IO
//  * 
//  * This file demonstrates how to use the new socket management system
//  * that works across multiple replicas with Redis adapter.
//  */

// import { multiReplicaSocketManager } from './socket-manager';
// import { socketEventManager } from './socket-io-manager';
// import type { Core } from '@strapi/strapi';

// // ================================
// // USAGE EXAMPLES
// // ================================

// /**
//  * Example 1: Emit to a specific user (works across replicas)
//  */
// export async function notifyUserExample(userDocumentId: string, message: string): Promise<void> {
//   // This will work even if the user is connected to a different replica
//   await multiReplicaSocketManager.emitToUser(
//     userDocumentId,
//     'notification:new',
//     {
//       message,
//       timestamp: new Date().toISOString(),
//       type: 'info'
//     }
//   );
// }

// /**
//  * Example 2: Emit to a specific POS machine
//  */
// export async function notifyPOSMachine(keySeatDocumentId: string, data: any): Promise<void> {
//   await multiReplicaSocketManager.emitToPOSMachine(
//     keySeatDocumentId,
//     'pos:update',
//     data
//   );
// }

// /**
//  * Example 3: Emit to all POS machines for a license
//  */
// export async function notifyAllLicensePOSMachines(
//   licenseDocumentId: string,
//   planUpdate: any
// ): Promise<void> {
//   await multiReplicaSocketManager.emitToLicensePOSMachines(
//     licenseDocumentId,
//     'plan:updated',
//     planUpdate
//   );
// }

// /**
//  * Example 4: Check if user is connected (across all replicas)
//  */
// export async function checkUserConnection(userDocumentId: string): Promise<boolean> {
//   const isMobileConnected = await multiReplicaSocketManager.isUserConnected(userDocumentId, 'mobile');
//   const isPOSConnected = await multiReplicaSocketManager.isUserConnected(userDocumentId, 'pos');
  
//   return isMobileConnected || isPOSConnected;
// }

// /**
//  * Example 5: Service method that handles plan updates
//  */
// export async function handlePlanUpgrade(
//   strapi: Core.Strapi,
//   userDocumentId: string,
//   newPlanType: string
// ): Promise<void> {
//   try {
//     // Update user plan in database
//     await strapi.documents('plugin::users-permissions.user').update({
//       documentId: userDocumentId,
//       data: { planType: newPlanType },
//     });

//     // Notify mobile app
//     await multiReplicaSocketManager.emitToUser(
//       userDocumentId,
//       'plan:upgraded',
//       {
//         newPlan: newPlanType,
//         effectiveDate: new Date().toISOString()
//       },
//       'mobile'
//     );

//     // Find and update all licenses for this user
//     const licenses = await strapi.documents('api::license.license').findMany({
//       filters: {
//         user: { documentId: userDocumentId },
//         isActive: true,
//       },
//     });

//     // Notify all POS machines for each license
//     for (const license of licenses) {
//       await multiReplicaSocketManager.emitToLicensePOSMachines(
//         license.documentId,
//         'plan:updated',
//         {
//           planType: newPlanType,
//           features: getPlanFeatures(newPlanType),
//           effectiveDate: new Date().toISOString()
//         }
//       );
//     }

//     strapi.log.info(`[PlanUpgrade] Successfully notified all devices for user ${userDocumentId}`);
//   } catch (error) {
//     strapi.log.error(`[PlanUpgrade] Error handling plan upgrade:`, error);
//     throw error;
//   }
// }

// /**
//  * Example 6: Broadcast system maintenance notification
//  */
// export async function broadcastMaintenanceNotification(
//   io: any,
//   message: string,
//   scheduledTime: string
// ): Promise<void> {
//   // This broadcasts to ALL connected sockets across ALL replicas
//   socketEventManager.emitToAll(
//     io,
//     'system:maintenance',
//     {
//       message,
//       scheduledTime,
//       timestamp: new Date().toISOString()
//     }
//   );
// }

// /**
//  * Helper function to get plan features
//  */
// function getPlanFeatures(planType: string): Record<string, any> {
//   const features: Record<string, Record<string, any>> = {
//     'FreeTrial': {
//       maxProducts: 100,
//       maxRegisters: 1,
//       advancedReporting: false,
//       multiLocation: false,
//       inventoryManagement: true,
//       basicReports: true,
//       duration: '30 days'
//     },
//     'Pro': {
//       maxProducts: 5000,
//       maxRegisters: 3,
//       advancedReporting: true,
//       multiLocation: false,
//       inventoryManagement: true,
//       basicReports: true,
//       customerManagement: true,
//       emailSupport: true
//     },
//     'Enterprise': {
//       maxProducts: -1,  // unlimited
//       maxRegisters: -1,  // unlimited
//       advancedReporting: true,
//       multiLocation: true,
//       inventoryManagement: true,
//       basicReports: true,
//       customerManagement: true,
//       prioritySupport: true,
//       customIntegrations: true,
//       dedicatedAccountManager: true
//     }
//   };

//   return features[planType] || features['FreeTrial'];
// }

// // ================================
// // MIGRATION HELPERS
// // ================================

// /**
//  * Helper to migrate from old socket ID based system to new room-based system
//  */
// export async function migrateFromSocketIdToRooms(strapi: Core.Strapi): Promise<void> {
//   try {
//     strapi.log.info('[Migration] Starting migration from socket ID to room-based system');

//     // Clear all stored socket IDs since they're no longer needed
//     await strapi.db.query('plugin::users-permissions.user').updateMany({
//       data: { socketId: null },
//     });

//     await strapi.db.query('api::key-seat.key-seat').updateMany({
//       data: { userSocketId: null },
//     });

//     strapi.log.info('[Migration] Successfully cleared all socket IDs from database');
//   } catch (error) {
//     strapi.log.error('[Migration] Error during migration:', error);
//     throw error;
//   }
// }