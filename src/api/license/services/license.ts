/**
 * license service
 */

import { factories } from '@strapi/strapi';

interface SeatInsight {
  seatId: string;
  machineUUID: string;
  isActive: boolean;
  isConnected: boolean;
  timezone: string;
  telemetry?: {
    os?: string;
    appVersion?: string;
    timestamp?: string;
    hostname?: string;
    platform?: string;
    osVersion?: string;
    lastActivated?: string;
  };
  networkStatus?: string;
  lastSyncTime?: string;
  lastOrder?: {
    receiptNumber: string;
    total: number;
    itemCount: number;
    paymentMethod: string;
    status: string;
    createdAt: string;
    items: Array<{
      productName: string;
      quantity: number;
      price: number;
    }>;
  };
  kpiSummary?: {
    totalSales: number;
    transactionCount: number;
    averageTransactionValue: number;
    period: string;
    lastUpdated: string;
  };
  expenses?: Array<{
    id: string;
    title: string;
    amount: number;
    category: string;
    paymentMethod: string;
    expenseDate: string;
    isUrgent: boolean;
  }>;
  lastUpdated?: string;
}

interface AggregatedInsights {
  licenseDocumentId: string;
  licenseKey: string;
  maxSeats: number;
  activeSeatsCount: number;
  connectedSeatsCount: number;
  totalSeatsCount: number;
  aggregatedKPIs: {
    totalSales: number;
    totalTransactions: number;
    totalExpenses: number;
    averageTransactionValue: number;
    period: string;
  };
  seats: SeatInsight[];
  generatedAt: string;
}

export default factories.createCoreService('api::license.license', ({ strapi }) => ({
  /**
   * Generates real-time insights for all seats belonging to a license
   * @param licenseDocumentId - Document ID of the license
   * @returns Aggregated insights across all seats
   */
  async generateSeatsInsights(licenseDocumentId: string): Promise<AggregatedInsights> {
    try {
      // Fetch license with all seats populated
      const license = await strapi.documents('api::license.license').findOne({
        documentId: licenseDocumentId,
        status: 'published',
        populate: {
          realtimeTelemetry:true,
          seats: {
            fields: ['documentId', 'machineUUID', 'isActive', 'isConnected', 'timezone', 'telemetry', ]
          }
        }
      });

      if (!license) {
        throw new Error(`License not found: ${licenseDocumentId}`);
      }

      // Initialize aggregated metrics
      let totalSales = 0;
      let totalTransactions = 0;
      let totalExpenses = 0;
      let activeSeatsCount = 0;
      let connectedSeatsCount = 0;

      // Process each seat's telemetry data
      const seatInsights: SeatInsight[] = (license.seats || []).map((seat: any) => {
        const realtimeTelemetry = seat.realtimeTelemetry || {};
        const activationTelemetry = seat.telemetry || {};
        
        // Count active and connected seats
        if (seat.isActive) activeSeatsCount++;
        if (seat.isConnected) connectedSeatsCount++;

        // Extract KPI data from realtime telemetry
        const kpiSummary = realtimeTelemetry.kpiSummary;
        if (kpiSummary) {
          totalSales += kpiSummary.totalSales || 0;
          totalTransactions += kpiSummary.transactionCount || 0;
        }

        // Calculate total expenses
        const expenses = realtimeTelemetry.expenses || [];
        const seatExpenses = expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);
        totalExpenses += seatExpenses;

        return {
          seatId: seat.documentId,
          machineUUID: seat.machineUUID,
          isActive: seat.isActive,
          isConnected: seat.isConnected || false,
          timezone: seat.timezone || 'UTC',
          telemetry: activationTelemetry, // Static device info from activation
          networkStatus: realtimeTelemetry.networkStatus,
          lastSyncTime: realtimeTelemetry.lastSyncTime,
          lastOrder: realtimeTelemetry.lastOrder,
          kpiSummary: realtimeTelemetry.kpiSummary,
          expenses: realtimeTelemetry.expenses,
          lastUpdated: realtimeTelemetry.lastUpdated
        };
      });

      // Calculate average transaction value
      const averageTransactionValue = totalTransactions > 0 
        ? totalSales / totalTransactions 
        : 0;

      const insights: AggregatedInsights = {
        licenseDocumentId: license.documentId,
        licenseKey: license.licenseKey,
        maxSeats: license.maxSeats,
        activeSeatsCount,
        connectedSeatsCount,
        totalSeatsCount: license.seats?.length || 0,
        aggregatedKPIs: {
          totalSales: parseFloat(totalSales.toFixed(2)),
          totalTransactions,
          totalExpenses: parseFloat(totalExpenses.toFixed(2)),
          averageTransactionValue: parseFloat(averageTransactionValue.toFixed(2)),
          period: 'today' // This matches the period from individual seats
        },
        seats: seatInsights,
        generatedAt: new Date().toISOString()
      };

      strapi.log.info('[LicenseService] Generated seats insights:', {
        licenseDocumentId,
        seatsCount: seatInsights.length,
        totalSales,
        totalTransactions
      });

      return insights;
    } catch (error) {
      strapi.log.error('[LicenseService] Error generating seats insights:', {
        licenseDocumentId,
        error: error.message
      });
      throw error;
    }
  }
}));
