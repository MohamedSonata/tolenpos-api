# News Alert API - Implementation Guide

## Overview

The News Alert API provides endpoints for managing and displaying news alerts, announcements, and notifications in POS applications. Built with Strapi v5 Document Service API with full draft/publish support.

## Content Type: `news-alert`

### Schema Location
`src/api/news-alert/content-types/news-alert/schema.json`

### Features
- ✅ Draft & Publish workflow
- ✅ Rich text content (Markdown support)
- ✅ Priority levels (low, medium, high, critical)
- ✅ Category-based filtering
- ✅ Date range scheduling
- ✅ Target audience filtering (shop types)
- ✅ Version compatibility filtering
- ✅ Analytics tracking (views, clicks, dismissals)
- ✅ Action buttons with custom URLs
- ✅ Media support (images, videos)

---

## API Endpoints

### Base URL
```
http://localhost:1337/api
```

---

## 1. Get Active Alerts (Public)

Fetch all currently active alerts based on filters.

### Endpoint
```http
GET /api/news-alerts/active
```

### Authentication
❌ Not required (public endpoint)

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `shopType` | string | No | Filter by shop type | `restaurant`, `retail`, `cafe` |
| `appVersion` | string | No | Filter by app version compatibility | `1.0.40` |
| `locale` | string | No | Language code (future i18n support) | `en`, `ar` |

### Business Logic

An alert is returned if ALL conditions are met:
1. `isActive === true`
2. `publishedAt !== null` (published status)
3. Current date >= `startDate`
4. Current date <= `endDate` OR `endDate` is null
5. `targetAudience === 'all'` OR matches `shopType` parameter
6. If `minVersion` is set: `appVersion >= minVersion`
7. If `maxVersion` is set: `appVersion <= maxVersion`

### Example Request

```bash
# Get all active alerts
curl http://localhost:1337/api/news-alerts/active

# Get alerts for restaurants
curl "http://localhost:1337/api/news-alerts/active?shopType=restaurant"

# Get alerts for specific app version
curl "http://localhost:1337/api/news-alerts/active?appVersion=1.0.40"

# Combined filters
curl "http://localhost:1337/api/news-alerts/active?shopType=cafe&appVersion=1.0.50"
```

### Example Response

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "abc123xyz",
      "title": "🎉 New Feature: Table Management",
      "content": "# Exciting Update!\n\nWe've added table management for restaurants...",
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
      "updatedAt": "2026-05-24T15:30:00.000Z",
      "publishedAt": "2026-05-20T10:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 1,
      "pageCount": 1,
      "total": 1
    }
  }
}
```

---

## 2. Track Alert View

Increment view count when an alert is displayed to a user.

### Endpoint
```http
POST /api/news-alerts/:documentId/track-view
```

### Authentication
❌ Not required (public endpoint)

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | Yes | Alert document ID |

### Example Request

```bash
curl -X POST http://localhost:1337/api/news-alerts/abc123xyz/track-view
```

### Example Response

```json
{
  "success": true,
  "viewCount": 1251
}
```

### Error Responses

```json
// Alert not found
{
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "Alert not found"
  }
}
```

---

## 3. Track Alert Click

Increment click count when a user clicks the action button.

### Endpoint
```http
POST /api/news-alerts/:documentId/track-click
```

### Authentication
❌ Not required (public endpoint)

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | Yes | Alert document ID |

### Example Request

```bash
curl -X POST http://localhost:1337/api/news-alerts/abc123xyz/track-click
```

### Example Response

```json
{
  "success": true,
  "clickCount": 341
}
```

---

## 4. Track Alert Dismiss

Increment dismiss count when a user dismisses an alert.

### Endpoint
```http
POST /api/news-alerts/:documentId/track-dismiss
```

### Authentication
❌ Not required (public endpoint)

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | Yes | Alert document ID |

### Example Request

```bash
curl -X POST http://localhost:1337/api/news-alerts/abc123xyz/track-dismiss
```

### Example Response

```json
{
  "success": true,
  "dismissCount": 121
}
```

---

## 5. Standard CRUD Operations (Admin)

These endpoints require authentication and are used by the Strapi admin panel or authenticated API clients.

### Get All Alerts (with draft support)

```http
GET /api/news-alerts
```

**Authentication:** ✅ Required (JWT token)

**Query Parameters:**
- `filters[isActive][$eq]=true` - Filter by active status
- `filters[category][$eq]=feature` - Filter by category
- `filters[priority][$eq]=high` - Filter by priority
- `sort=createdAt:desc` - Sort by creation date
- `pagination[page]=1&pagination[pageSize]=25` - Pagination
- `status=draft` or `status=published` - Filter by publish status

**Example:**
```bash
# Get all published alerts
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:1337/api/news-alerts?status=published"

# Get draft alerts only
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:1337/api/news-alerts?status=draft"

# Get high priority alerts
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:1337/api/news-alerts?filters[priority][$eq]=high"
```

### Get Single Alert by Document ID

```http
GET /api/news-alerts/:documentId
```

**Authentication:** ✅ Required

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:1337/api/news-alerts/abc123xyz
```

### Create New Alert (Draft)

```http
POST /api/news-alerts
```

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "data": {
    "title": "New Feature Announcement",
    "content": "# Exciting News!\n\nWe've added a new feature...",
    "priority": "high",
    "category": "feature",
    "startDate": "2026-05-25T00:00:00.000Z",
    "endDate": "2026-06-25T00:00:00.000Z",
    "isActive": true,
    "targetAudience": "all",
    "dismissible": true,
    "showOnce": false
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:1337/api/news-alerts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "title": "New Feature",
      "content": "Feature description...",
      "priority": "medium",
      "category": "feature",
      "startDate": "2026-05-25T00:00:00.000Z",
      "isActive": true,
      "targetAudience": "all",
      "dismissible": true,
      "showOnce": false
    }
  }'
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "documentId": "xyz789abc",
    "title": "New Feature",
    "content": "Feature description...",
    "priority": "medium",
    "category": "feature",
    "isActive": true,
    "publishedAt": null,
    "createdAt": "2026-05-24T10:00:00.000Z",
    "updatedAt": "2026-05-24T10:00:00.000Z"
  }
}
```

### Publish an Alert

```http
POST /api/news-alerts/:documentId/publish
```

**Authentication:** ✅ Required

**Example:**
```bash
curl -X POST http://localhost:1337/api/news-alerts/xyz789abc/publish \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Alert

```http
PUT /api/news-alerts/:documentId
```

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "data": {
    "title": "Updated Title",
    "isActive": false
  }
}
```

**Example:**
```bash
curl -X PUT http://localhost:1337/api/news-alerts/abc123xyz \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "isActive": false
    }
  }'
```

### Delete Alert

```http
DELETE /api/news-alerts/:documentId
```

**Authentication:** ✅ Required

**Example:**
```bash
curl -X DELETE http://localhost:1337/api/news-alerts/abc123xyz \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Field Reference

### Core Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | Yes | - | Alert title (max 200 chars) |
| `content` | richtext | Yes | - | Alert content (Markdown) |
| `priority` | enum | Yes | `medium` | `low`, `medium`, `high`, `critical` |
| `category` | enum | Yes | `announcement` | `feature`, `maintenance`, `security`, `promotion`, `announcement`, `warning` |
| `startDate` | datetime | Yes | - | When alert becomes active (UTC) |
| `endDate` | datetime | No | null | When alert expires (UTC) |
| `isActive` | boolean | Yes | `true` | Manual toggle |

### Targeting Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `targetAudience` | enum | Yes | `all` | `all`, `retail`, `restaurant`, `cafe`, `grocery`, `pharmacy`, `bakery` |
| `minVersion` | string | No | null | Minimum app version (e.g., `1.0.0`) |
| `maxVersion` | string | No | null | Maximum app version (e.g., `2.0.0`) |

### UI Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `actionButton` | json | No | null | Button configuration object |
| `imageUrl` | string | No | null | Image/banner URL |
| `videoUrl` | string | No | null | Video URL |
| `dismissible` | boolean | Yes | `true` | Can users dismiss? |
| `showOnce` | boolean | Yes | `false` | Show only once per user? |

### Analytics Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `viewCount` | integer | No | `0` | Total views |
| `clickCount` | integer | No | `0` | Total clicks |
| `dismissCount` | integer | No | `0` | Total dismissals |

### Action Button Component

The `actionButton` field uses the reusable `ui.action-button` Strapi component.

**Component Schema:**
```typescript
{
  text: string;           // Button text (max 50 chars)
  url: string;            // Target URL
  style: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  openInBrowser: boolean; // Open in external browser
}
```

**Component Location:** `src/components/ui/action-button.json`

**Example:**
```json
{
  "text": "Learn More",
  "url": "https://docs.example.com/feature",
  "style": "primary",
  "openInBrowser": true
}
```

**Benefits of Component:**
- ✅ Type-safe validation in admin panel
- ✅ Reusable across multiple content types
- ✅ Consistent data structure
- ✅ Built-in field validation

---

## Priority Levels

| Priority | UI Theme | Behavior | Use Case |
|----------|----------|----------|----------|
| `critical` | Red | Auto-expand, may block dismissal | System outages, security alerts |
| `high` | Orange | Prominent display | Important features, urgent updates |
| `medium` | Blue | Standard display | Regular announcements |
| `low` | Gray | Subtle display | Minor updates, tips |

---

## Category Icons

| Category | Icon | Use Case |
|----------|------|----------|
| `feature` | ✨ | New features, improvements |
| `maintenance` | 🔧 | Scheduled maintenance, downtime |
| `security` | 🔒 | Security updates, patches |
| `promotion` | 🎉 | Sales, discounts, offers |
| `announcement` | 📢 | General announcements |
| `warning` | ⚠️ | Warnings, deprecations |

---

## Example Use Cases

### 1. Feature Announcement

```json
{
  "data": {
    "title": "🎉 New Feature: Advanced Reporting",
    "content": "# Advanced Reporting is Here!\n\nWe're excited to announce:\n\n- 📊 Custom date ranges\n- 📈 Visual charts\n- 📥 Export to Excel/PDF",
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
    "dismissible": true,
    "showOnce": false
  }
}
```

### 2. Maintenance Warning

```json
{
  "data": {
    "title": "⚠️ Scheduled Maintenance",
    "content": "# Maintenance Notice\n\n**Date:** June 1, 2026\n**Time:** 2:00 AM - 4:00 AM UTC\n\nCloud sync will be unavailable.",
    "priority": "critical",
    "category": "maintenance",
    "startDate": "2026-05-25T00:00:00.000Z",
    "endDate": "2026-06-01T06:00:00.000Z",
    "isActive": true,
    "targetAudience": "all",
    "dismissible": false,
    "showOnce": false
  }
}
```

### 3. Restaurant-Only Promotion

```json
{
  "data": {
    "title": "🍽️ Table Management Now Available",
    "content": "Manage your restaurant tables efficiently with our new feature!",
    "priority": "medium",
    "category": "feature",
    "startDate": "2026-05-24T00:00:00.000Z",
    "endDate": null,
    "isActive": true,
    "targetAudience": "restaurant",
    "minVersion": "1.0.40",
    "actionButton": {
      "text": "Try It Now",
      "url": "app://features/table-management",
      "style": "success",
      "openInBrowser": false
    },
    "dismissible": true,
    "showOnce": true
  }
}
```

---

## Client Implementation Guide

### 1. Fetch Active Alerts on App Launch

```typescript
async function fetchActiveAlerts() {
  const shopType = 'restaurant'; // From user settings
  const appVersion = '1.0.40';   // From app config
  
  const response = await fetch(
    `https://api.example.com/api/news-alerts/active?shopType=${shopType}&appVersion=${appVersion}`
  );
  
  const { data } = await response.json();
  return data;
}
```

### 2. Track Alert View

```typescript
async function trackAlertView(documentId: string) {
  await fetch(
    `https://api.example.com/api/news-alerts/${documentId}/track-view`,
    { method: 'POST' }
  );
}
```

### 3. Track Action Button Click

```typescript
async function trackAlertClick(documentId: string) {
  await fetch(
    `https://api.example.com/api/news-alerts/${documentId}/track-click`,
    { method: 'POST' }
  );
}
```

### 4. Track Alert Dismiss

```typescript
async function trackAlertDismiss(documentId: string) {
  await fetch(
    `https://api.example.com/api/news-alerts/${documentId}/track-dismiss`,
    { method: 'POST' }
  );
  
  // Store dismissed alert ID locally if showOnce is true
  if (alert.showOnce) {
    localStorage.setItem(`alert_dismissed_${documentId}`, 'true');
  }
}
```

### 5. Check if Alert Should Be Shown

```typescript
function shouldShowAlert(alert: NewsAlert): boolean {
  // Check if already dismissed (for showOnce alerts)
  if (alert.showOnce) {
    const dismissed = localStorage.getItem(`alert_dismissed_${alert.documentId}`);
    if (dismissed) return false;
  }
  
  return true;
}
```

---

## Analytics Dashboard Queries

### Get Alert Performance

```bash
# Get all alerts with analytics
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:1337/api/news-alerts?sort=viewCount:desc&pagination[pageSize]=10"
```

### Calculate Engagement Metrics

```typescript
function calculateEngagement(alert: NewsAlert) {
  const viewRate = alert.viewCount;
  const clickThroughRate = alert.viewCount > 0 
    ? (alert.clickCount / alert.viewCount) * 100 
    : 0;
  const dismissRate = alert.viewCount > 0 
    ? (alert.dismissCount / alert.viewCount) * 100 
    : 0;
  const engagementScore = alert.viewCount > 0
    ? ((alert.clickCount * 2 + alert.viewCount - alert.dismissCount) / alert.viewCount)
    : 0;
  
  return {
    viewRate,
    clickThroughRate: clickThroughRate.toFixed(2) + '%',
    dismissRate: dismissRate.toFixed(2) + '%',
    engagementScore: engagementScore.toFixed(2)
  };
}
```

---

## Best Practices

### Content Guidelines
1. **Keep titles under 50 characters** for mobile display
2. **Use markdown formatting** for readability
3. **Include emojis** for visual appeal (✨ 🎉 ⚠️ 🔒)
4. **Add clear call-to-action** in action buttons
5. **Test on both light and dark themes**

### Targeting Strategy
1. **Use targetAudience wisely** - don't spam all users
2. **Set appropriate priority levels** - reserve "critical" for emergencies
3. **Define version ranges** for feature-specific alerts
4. **Set expiration dates** to auto-cleanup old alerts

### Analytics Optimization
1. **Monitor click-through rates** - improve low-performing alerts
2. **Track dismiss rates** - high dismissals indicate poor targeting
3. **A/B test different messages** using multiple alerts
4. **Review engagement scores** weekly

### Performance Tips
1. **Limit active alerts** to 3-5 at a time
2. **Use pagination** for admin queries
3. **Cache active alerts** on client for 5-10 minutes
4. **Compress images** before uploading

---

## Troubleshooting

### Alert Not Showing

**Check:**
1. `isActive === true`
2. `publishedAt !== null` (alert is published)
3. Current date is within `startDate` and `endDate`
4. `targetAudience` matches or is `all`
5. App version is within `minVersion` and `maxVersion` range

### Analytics Not Updating

**Check:**
1. Tracking endpoints are being called
2. `documentId` is correct
3. Network requests are successful
4. Alert is published (not draft)

### Version Filtering Not Working

**Note:** Current implementation uses basic string comparison. For semantic versioning (1.0.0 < 1.0.1), implement a semver library on the client or server.

---

## Security Considerations

1. **Sanitize markdown content** - Prevent XSS attacks
2. **Validate URLs** - Ensure action button URLs are safe
3. **Rate limit tracking endpoints** - Prevent analytics spam
4. **Use HTTPS** - Encrypt data in transit
5. **Review content** - Moderate alerts before publishing

---

## Migration from Spec Document

The implementation follows the original spec with these changes:

1. ✅ **i18n removed** - Can be added later by installing `@strapi/plugin-i18n`
2. ✅ **Document Service API** - Uses Strapi v5 best practices
3. ✅ **Draft/Publish support** - Full workflow enabled
4. ✅ **TypeScript** - Strongly typed controllers and services
5. ✅ **Error handling** - Comprehensive logging and error responses

---

## Next Steps

1. **Install i18n plugin** (optional):
   ```bash
   npm install @strapi/plugin-i18n
   ```

2. **Configure permissions** in Strapi Admin:
   - Settings → Roles → Public
   - Enable `find` and `findOne` for news-alerts

3. **Create sample alerts** in admin panel

4. **Test endpoints** with Postman or curl

5. **Integrate with POS app** using client implementation guide

---

## Support

For issues or questions:
- Check Strapi v5 documentation: https://docs.strapi.io/dev-docs/api/document-service
- Review implementation files in `src/api/news-alert/`
- Check server logs for detailed error messages
