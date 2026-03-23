import type { Schema, Struct } from '@strapi/strapi';

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

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'plan-features.plan-features': PlanFeaturesPlanFeatures;
      'release-change-log-i-tems.release-change-log-i-tems': ReleaseChangeLogITemsReleaseChangeLogITems;
    }
  }
}
