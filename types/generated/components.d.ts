import type { Schema, Struct } from '@strapi/strapi';

export interface AppsReleasesReleaseConfig extends Struct.ComponentSchema {
  collectionName: 'components_apps_releases_release_configs';
  info: {
    displayName: 'Release-Config';
  };
  attributes: {
    customMessage: Schema.Attribute.String;
    customTitle: Schema.Attribute.String;
    latestAppVersion: Schema.Attribute.String;
    minimumSupportedVersion: Schema.Attribute.String;
    storeUrl: Schema.Attribute.String;
    updateType: Schema.Attribute.Enumeration<['mandatory', 'optional', 'none']>;
  };
}

export interface PlanFeaturesPlanFeatures extends Struct.ComponentSchema {
  collectionName: 'components_plan_features_plan_features';
  info: {
    displayName: 'PlanFeatures';
  };
  attributes: {
    category: Schema.Attribute.Enumeration<
      [
        'core',
        'reporting',
        'support',
        'payment',
        'inventory',
        'employee',
        'security',
        'integration',
        'deployment',
      ]
    >;
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    icon: Schema.Attribute.String;
    isIncluded: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface ReleaseChangeLogITemsReleaseChangeLogITems
  extends Struct.ComponentSchema {
  collectionName: 'components_release_change_log_i_tems_release_change_log_i_tems';
  info: {
    displayName: 'releaseChangeLogITems';
  };
  attributes: {
    description: Schema.Attribute.Text &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        i18n: {
          localized: true;
        };
      }>;
    type: Schema.Attribute.Enumeration<
      ['feature', 'bugfix', 'improvement', 'security', 'breaking']
    > &
      Schema.Attribute.Required;
  };
}

export interface TelemetryCategoryPerformance extends Struct.ComponentSchema {
  collectionName: 'components_telemetry_category_performances';
  info: {
    description: 'Sales performance by product category';
    displayName: 'Category Performance';
  };
  attributes: {
    categoryId: Schema.Attribute.String & Schema.Attribute.Required;
    categoryName: Schema.Attribute.String & Schema.Attribute.Required;
    totalQuantitySold: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    totalRevenue: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    transactionCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface TelemetryExpense extends Struct.ComponentSchema {
  collectionName: 'components_telemetry_expenses';
  info: {
    description: 'Business expense record';
    displayName: 'Expense';
  };
  attributes: {
    amount: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    category: Schema.Attribute.Enumeration<
      [
        'KITCHEN_SUPPLIES',
        'UTILITIES',
        'RENT',
        'SALARIES',
        'MAINTENANCE',
        'MARKETING',
        'OTHER',
      ]
    > &
      Schema.Attribute.Required;
    expenseDate: Schema.Attribute.DateTime & Schema.Attribute.Required;
    expenseId: Schema.Attribute.String & Schema.Attribute.Required;
    isUrgent: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    paymentMethod: Schema.Attribute.Enumeration<
      ['CASH', 'CARD', 'BANK_TRANSFER', 'DIGITAL_WALLET']
    > &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface TelemetryHistoricalKpiSummary extends Struct.ComponentSchema {
  collectionName: 'components_telemetry_historical_kpi_summaries';
  info: {
    description: 'Historical KPI data across multiple time periods';
    displayName: 'Historical KPI Summary';
  };
  attributes: {
    cachedAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    thisMonth: Schema.Attribute.Component<'telemetry.period-kpi', false>;
    thisWeek: Schema.Attribute.Component<'telemetry.period-kpi', false>;
    yesterday: Schema.Attribute.Component<'telemetry.period-kpi', false>;
  };
}

export interface TelemetryKpiSummary extends Struct.ComponentSchema {
  collectionName: 'components_telemetry_kpi_summaries';
  info: {
    description: 'Key performance indicators summary';
    displayName: 'KPI Summary';
  };
  attributes: {
    averageTransactionValue: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    lastUpdated: Schema.Attribute.DateTime & Schema.Attribute.Required;
    period: Schema.Attribute.Enumeration<['today', 'week', 'month', 'year']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'today'>;
    totalSales: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    transactionCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface TelemetryLastOrder extends Struct.ComponentSchema {
  collectionName: 'components_telemetry_last_orders';
  info: {
    description: 'Most recent order details';
    displayName: 'Last Order';
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    itemCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    items: Schema.Attribute.Component<'telemetry.order-item', true> &
      Schema.Attribute.Required;
    paymentMethod: Schema.Attribute.Enumeration<
      ['CASH', 'CARD', 'DIGITAL_WALLET', 'CREDIT']
    > &
      Schema.Attribute.Required;
    receiptNumber: Schema.Attribute.String & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<
      ['PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'PENDING'>;
    total: Schema.Attribute.Decimal & Schema.Attribute.Required;
  };
}

export interface TelemetryOrderItem extends Struct.ComponentSchema {
  collectionName: 'components_telemetry_order_items';
  info: {
    description: 'Individual item in an order';
    displayName: 'Order Item';
  };
  attributes: {
    price: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    productName: Schema.Attribute.String & Schema.Attribute.Required;
    quantity: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
  };
}

export interface TelemetryPeriodKpi extends Struct.ComponentSchema {
  collectionName: 'components_telemetry_period_kpis';
  info: {
    description: 'KPI metrics for a specific time period with category breakdown';
    displayName: 'Period KPI';
  };
  attributes: {
    averageTransactionValue: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    categories: Schema.Attribute.Component<
      'telemetry.category-performance',
      true
    >;
    grossProfit: Schema.Attribute.Decimal & Schema.Attribute.Required;
    marginPercentage: Schema.Attribute.Decimal & Schema.Attribute.Required;
    totalSales: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    transactionCount: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface TelemetryRealtimeTelemetry extends Struct.ComponentSchema {
  collectionName: 'components_telemetry_realtime_telemetries';
  info: {
    description: 'POS realtime telemetry data structure';
    displayName: 'Realtime Telemetry';
  };
  attributes: {
    expenses: Schema.Attribute.Component<'telemetry.expense', true>;
    kpiSummary: Schema.Attribute.Component<'telemetry.kpi-summary', false> &
      Schema.Attribute.Required;
    lastOrder: Schema.Attribute.Component<'telemetry.last-order', false>;
    lastSyncTime: Schema.Attribute.DateTime & Schema.Attribute.Required;
    lastUpdated: Schema.Attribute.DateTime & Schema.Attribute.Required;
    networkStatus: Schema.Attribute.Enumeration<['online', 'offline']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'offline'>;
  };
}

export interface UserFcmToken extends Struct.ComponentSchema {
  collectionName: 'components_user_fcm_tokens';
  info: {
    description: 'Firebase Cloud Messaging token for push notifications';
    displayName: 'FCM-Token';
  };
  attributes: {
    deviceId: Schema.Attribute.String & Schema.Attribute.Required;
    deviceName: Schema.Attribute.String;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    lastUpdatedAt: Schema.Attribute.DateTime;
    platform: Schema.Attribute.Enumeration<['ios', 'android', 'web']> &
      Schema.Attribute.Required;
    token: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'apps-releases.release-config': AppsReleasesReleaseConfig;
      'plan-features.plan-features': PlanFeaturesPlanFeatures;
      'release-change-log-i-tems.release-change-log-i-tems': ReleaseChangeLogITemsReleaseChangeLogITems;
      'telemetry.category-performance': TelemetryCategoryPerformance;
      'telemetry.expense': TelemetryExpense;
      'telemetry.historical-kpi-summary': TelemetryHistoricalKpiSummary;
      'telemetry.kpi-summary': TelemetryKpiSummary;
      'telemetry.last-order': TelemetryLastOrder;
      'telemetry.order-item': TelemetryOrderItem;
      'telemetry.period-kpi': TelemetryPeriodKpi;
      'telemetry.realtime-telemetry': TelemetryRealtimeTelemetry;
      'user.fcm-token': UserFcmToken;
    }
  }
}
