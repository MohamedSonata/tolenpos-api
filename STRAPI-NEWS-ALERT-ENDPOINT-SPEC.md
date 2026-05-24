# Strapi News Alert Endpoint - AI Agent Prompt

## Overview

Create a Strapi content type and API endpoint for managing news alerts that will be displayed in the POS application. The system should support rich markdown content, priority levels, targeting, and analytics.

## Content Type: `news-alert`

### Collection Name
- **Singular**: `news-alert`
- **Plural**: `news-alerts`
- **API ID**: `news-alert`

### Fields Configuration

```json
{
  "fields": [
    {
      "name": "title",
      "type": "string",
      "required": true,
      "maxLength": 200,
      "description": "Alert title (supports i18n)"
    },
    {
      "name": "content",
      "type": "richtext",
      "required": true,
      "description": "Alert content in Markdown format (supports i18n)"
    },
    {
      "name": "priority",
      "type": "enumeration",
      "enum": ["low", "medium", "high", "critical"],
      "default": "medium",
      "required": true,
      "description": "Alert priority level affects UI styling and behavior"
    },
    {
      "name": "category",
      "type": "enumeration",
      "enum": ["feature", "maintenance", "security", "promotion", "announcement", "warning"],
      "default": "announcement",
      "required": true,
      "description": "Alert category for filtering and styling"
    },
    {
      "name": "startDate",
      "type": "datetime",
      "required": true,
      "description": "When the alert becomes active (UTC)"
    },
    {
      "name": "endDate",
      "type": "datetime",
      "required": false,
      "description": "When the alert expires (UTC). Null = no expiration"
    },
    {
      "name": "isActive",
      "type": "boolean",
      "default": true,
      "required": true,
      "description": "Manual toggle to enable/disable alert"
    },
    {
      "name": "targetAudience",
      "type": "enumeration",
      "enum": ["all", "retail", "restaurant", "cafe", "grocery", "pharmacy", "bakery"],
      "default": "all",
      "required": true,
      "description": "Target specific shop types or all"
    },
    {
      "name": "minVersion",
      "type": "string",
      "required": false,
      "description": "Minimum app version to show alert (e.g., '1.0.0')"
    },
    {
      "name": "maxVersion",
      "type": "string",
      "required": false,
      "description": "Maximum app version to show alert (e.g., '2.0.0')"
    },
    {
      "name": "actionButton",
      "type": "json",
      "required": false,
      "description": "Optional action button configuration"
    },
    {
      "name": "imageUrl",
      "type": "string",
      "required": false,
      "description": "Optional image/banner URL"
    },
    {
      "name": "videoUrl",
      "type": "string",
      "required": false,
      "description": "Optional video URL (YouTube, Vimeo, etc.)"
    },
    {
      "name": "dismissible",
      "type": "boolean",
      "default": true,
      "required": true,
      "description": "Can users dismiss this alert?"
    },
    {
      "name": "showOnce",
      "type": "boolean",
      "default": false,
      "required": true,
      "description": "Show only once per user (tracked by documentId)"
    },
    {
      "name": "viewCount",
      "type": "integer",
      "default": 0,
      "description": "Total number of views (analytics)"
    },
    {
      "name": "clickCount",
      "type": "integer",
      "default": 0,
      "description": "Total number of action button clicks (analytics)"
    },
    {
      "name": "dismissCount",
      "type": "integer",
      "default": 0,
      "description": "Total number of dismissals (analytics)"
    }
  ]
}
```

### Action Button JSON Schema

```json
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "description": "Button text (e.g., 'Learn More', 'Download', 'Watch Video')"
    },
    "url": {
      "type": "string",
      "description": "URL to open when clicked"
    },
    "style": {
      "type": "string",
      "enum": ["primary", "secondary", "success", "warning", "danger"],
      "default": "primary",
      "description": "Button style variant"
    },
    "openInBrowser": {
      "type": "boolean",
      "default": true,
      "description": "Open in external browser vs in-app"
    }
  }
}
```

**Example:**
```json
{
  "text": "Learn More",
  "url": "https://example.com/feature-guide",
  "style": "primary",
  "openInBrowser": true
}
```

## API Endpoints

### 1. Get Active Alerts (Public)

**Endpoint:** `GET /api/news-alerts/active`

**Query Parameters:**
- `shopType` (optional): Filter by shop type (retail, restaurant, etc.)
- `appVersion` (optional): Filter by app version compatibility
- `locale` (optional): Language code (en, ar)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "documentId": "abc123xyz",
      "title": "New Feature: Table Management",
      "content": "# Exciting Update!\n\nWe've added table management...",
      "priority": "high",
      "category": "feature",
      "startDate": "2026-05-20T00:00:00.000Z",
      "endDate": "2026-06-20T00:00:00.000Z",
      "isActive": true,
      "targetAudience": "restaurant",
      "minVersion": "1.0.40",
      "maxVersion": null,
      "actionButton": {
        "text": "Learn More",
        "url": "https://docs.example.com/table-management",
        "style": "primary",
        "openInBrowser": true
      },
      "imageUrl": "https://cdn.example.com/images/table-management.jpg",
      "videoUrl": null,
      "dismissible": true,
      "showOnce": false,
      "viewCount": 1250,
      "clickCount": 340,
      "dismissCount": 120,
      "createdAt": "2026-05-20T10:00:00.000Z",
      "updatedAt": "2026-05-24T15:30:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 1
    }
  }
}
```

### 2. Track Alert View (Public)

**Endpoint:** `POST /api/news-alerts/:documentId/track-view`

**Purpose:** Increment view count when alert is displayed

**Response:**
```json
{
  "success": true,
  "viewCount": 1251
}
```

### 3. Track Alert Click (Public)

**Endpoint:** `POST /api/news-alerts/:documentId/track-click`

**Purpose:** Increment click count when action button is clicked

**Response:**
```json
{
  "success": true,
  "clickCount": 341
}
```

### 4. Track Alert Dismiss (Public)

**Endpoint:** `POST /api/news-alerts/:documentId/track-dismiss`

**Purpose:** Increment dismiss count when alert is dismissed

**Response:**
```json
{
  "success": true,
  "dismissCount": 121
}
```

## Business Logic Rules

### Alert Visibility Rules

An alert is visible if ALL conditions are met:

1. **Active Status**: `isActive === true`
2. **Date Range**: Current date is between `startDate` and `endDate` (or `endDate` is null)
3. **Target Audience**: `targetAudience === 'all'` OR matches user's shop type
4. **Version Compatibility**:
   - If `minVersion` is set: `appVersion >= minVersion`
   - If `maxVersion` is set: `appVersion <= maxVersion`
5. **Show Once**: If `showOnce === true`, check if user has seen it before (tracked client-side)

### Priority Levels

- **critical**: Red theme, auto-expand, cannot be dismissed if `dismissible === false`
- **high**: Orange theme, prominent display
- **medium**: Blue theme, standard display
- **low**: Gray theme, subtle display

### Category Icons

- **feature**: ✨ Sparkles
- **maintenance**: 🔧 Wrench
- **security**: 🔒 Lock
- **promotion**: 🎉 Party Popper
- **announcement**: 📢 Megaphone
- **warning**: ⚠️ Warning

## Implementation Steps

### Step 1: Create Content Type

1. Go to Strapi Admin → Content-Type Builder
2. Create new Collection Type: `news-alert`
3. Add all fields as specified above
4. Enable i18n plugin for `title` and `content` fields
5. Save and restart Strapi

### Step 2: Configure Permissions

1. Go to Settings → Roles → Public
2. Enable permissions for `news-alert`:
   - `find` (GET /api/news-alerts)
   - `findOne` (GET /api/news-alerts/:id)

### Step 3: Create Custom Controller

Create custom routes for analytics tracking:

**File:** `src/api/news-alert/routes/custom-news-alert.js`

```javascript
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/news-alerts/active',
      handler: 'news-alert.findActive',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/news-alerts/:documentId/track-view',
      handler: 'news-alert.trackView',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/news-alerts/:documentId/track-click',
      handler: 'news-alert.trackClick',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/news-alerts/:documentId/track-dismiss',
      handler: 'news-alert.trackDismiss',
      config: {
        auth: false,
      },
    },
  ],
};
```

**File:** `src/api/news-alert/controllers/news-alert.js`

```javascript
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::news-alert.news-alert', ({ strapi }) => ({
  async findActive(ctx) {
    const { shopType, appVersion, locale } = ctx.query;
    const now = new Date().toISOString();

    // Build filters
    const filters = {
      isActive: true,
      startDate: { $lte: now },
      $or: [
        { endDate: { $gte: now } },
        { endDate: null }
      ]
    };

    // Filter by shop type
    if (shopType && shopType !== 'all') {
      filters.$or = [
        { targetAudience: 'all' },
        { targetAudience: shopType }
      ];
    }

    // Filter by version (simplified - implement proper semver comparison)
    if (appVersion) {
      filters.$and = [];
      filters.$and.push({
        $or: [
          { minVersion: null },
          { minVersion: { $lte: appVersion } }
        ]
      });
      filters.$and.push({
        $or: [
          { maxVersion: null },
          { maxVersion: { $gte: appVersion } }
        ]
      });
    }

    const alerts = await strapi.entityService.findMany('api::news-alert.news-alert', {
      filters,
      sort: { priority: 'desc', createdAt: 'desc' },
      locale: locale || 'en',
    });

    return { data: alerts };
  },

  async trackView(ctx) {
    const { documentId } = ctx.params;

    const alert = await strapi.db.query('api::news-alert.news-alert').findOne({
      where: { documentId }
    });

    if (!alert) {
      return ctx.notFound('Alert not found');
    }

    const updated = await strapi.entityService.update('api::news-alert.news-alert', alert.id, {
      data: {
        viewCount: alert.viewCount + 1
      }
    });

    return { success: true, viewCount: updated.viewCount };
  },

  async trackClick(ctx) {
    const { documentId } = ctx.params;

    const alert = await strapi.db.query('api::news-alert.news-alert').findOne({
      where: { documentId }
    });

    if (!alert) {
      return ctx.notFound('Alert not found');
    }

    const updated = await strapi.entityService.update('api::news-alert.news-alert', alert.id, {
      data: {
        clickCount: alert.clickCount + 1
      }
    });

    return { success: true, clickCount: updated.clickCount };
  },

  async trackDismiss(ctx) {
    const { documentId } = ctx.params;

    const alert = await strapi.db.query('api::news-alert.news-alert').findOne({
      where: { documentId }
    });

    if (!alert) {
      return ctx.notFound('Alert not found');
    }

    const updated = await strapi.entityService.update('api::news-alert.news-alert', alert.id, {
      data: {
        dismissCount: alert.dismissCount + 1
      }
    });

    return { success: true, dismissCount: updated.dismissCount };
  },
}));
```

### Step 4: Test Endpoints

1. Create sample news alerts in Strapi admin
2. Test GET `/api/news-alerts/active`
3. Test POST tracking endpoints
4. Verify analytics counters increment

## Example News Alert Data

### Feature Announcement
```json
{
  "title": "🎉 New Feature: Advanced Reporting",
  "content": "# Advanced Reporting is Here!\n\nWe're excited to announce our new advanced reporting feature:\n\n- 📊 Custom date ranges\n- 📈 Visual charts and graphs\n- 📥 Export to Excel/PDF\n- 🔍 Detailed product analytics\n\n[Learn more in our documentation](https://docs.example.com/reporting)",
  "priority": "high",
  "category": "feature",
  "startDate": "2026-05-24T00:00:00.000Z",
  "endDate": "2026-06-24T00:00:00.000Z",
  "isActive": true,
  "targetAudience": "all",
  "actionButton": {
    "text": "View Documentation",
    "url": "https://docs.example.com/reporting",
    "style": "primary",
    "openInBrowser": true
  },
  "imageUrl": "https://cdn.example.com/reporting-feature.jpg",
  "dismissible": true,
  "showOnce": false
}
```

### Maintenance Warning
```json
{
  "title": "⚠️ Scheduled Maintenance",
  "content": "# Scheduled Maintenance Notice\n\nOur servers will undergo maintenance:\n\n**Date:** June 1, 2026\n**Time:** 2:00 AM - 4:00 AM UTC\n**Duration:** ~2 hours\n\nDuring this time:\n- ❌ Cloud sync will be unavailable\n- ✅ Local operations will continue normally\n- ✅ Data will sync automatically after maintenance\n\nWe apologize for any inconvenience.",
  "priority": "critical",
  "category": "maintenance",
  "startDate": "2026-05-25T00:00:00.000Z",
  "endDate": "2026-06-01T06:00:00.000Z",
  "isActive": true,
  "targetAudience": "all",
  "dismissible": false,
  "showOnce": false
}
```

### Promotion
```json
{
  "title": "🎁 Limited Time Offer: 20% Off Premium",
  "content": "# Upgrade to Premium and Save!\n\nFor a limited time, get **20% off** our Premium plan:\n\n✨ **Premium Features:**\n- Advanced inventory management\n- Multi-location support\n- Priority support\n- Custom branding\n\n**Offer ends:** June 30, 2026\n\nUse code: **SUMMER2026**",
  "priority": "medium",
  "category": "promotion",
  "startDate": "2026-05-24T00:00:00.000Z",
  "endDate": "2026-06-30T23:59:59.000Z",
  "isActive": true,
  "targetAudience": "all",
  "actionButton": {
    "text": "Upgrade Now",
    "url": "https://example.com/upgrade?code=SUMMER2026",
    "style": "success",
    "openInBrowser": true
  },
  "dismissible": true,
  "showOnce": true
}
```

## Best Practices

1. **Keep content concise** - Users should understand the alert in 10 seconds
2. **Use markdown formatting** - Headers, lists, bold, links for readability
3. **Set appropriate priority** - Don't overuse "critical" priority
4. **Target specific audiences** - Only show relevant alerts to relevant users
5. **Set expiration dates** - Clean up old alerts automatically
6. **Monitor analytics** - Track view/click/dismiss rates to improve messaging
7. **Test on both themes** - Ensure alerts look good in light and dark mode
8. **Use i18n** - Provide translations for multi-language support
9. **Optimize images** - Use compressed images for faster loading
10. **A/B test** - Try different messaging and track engagement

## Security Considerations

1. **Sanitize markdown** - Prevent XSS attacks in markdown content
2. **Validate URLs** - Ensure action button URLs are safe
3. **Rate limit tracking** - Prevent analytics spam
4. **CORS configuration** - Only allow requests from your POS app
5. **Content moderation** - Review alerts before publishing

## Monitoring & Analytics

Track these metrics in Strapi admin:

- **View Rate**: `viewCount / total_active_users`
- **Click-Through Rate**: `clickCount / viewCount`
- **Dismiss Rate**: `dismissCount / viewCount`
- **Engagement Score**: `(clickCount * 2 + viewCount - dismissCount) / viewCount`

Use these metrics to optimize alert content and timing.
