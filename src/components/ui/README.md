# UI Components

Reusable Strapi components for common UI elements across content types.

## Components

### 1. Action Button (`ui.action-button`)

**File:** `action-button.json`

A reusable button component with configurable style, URL, and browser behavior.

#### Schema

```json
{
  "text": "string (required, max 50 chars)",
  "url": "string (required)",
  "style": "enum (primary|secondary|success|warning|danger)",
  "openInBrowser": "boolean (default: true)"
}
```

#### Usage in Content Types

```json
{
  "attributes": {
    "actionButton": {
      "type": "component",
      "repeatable": false,
      "component": "ui.action-button"
    }
  }
}
```

#### Example Data

```json
{
  "actionButton": {
    "text": "Learn More",
    "url": "https://docs.example.com/feature",
    "style": "primary",
    "openInBrowser": true
  }
}
```

#### Style Variants

| Style | Use Case | Color Theme |
|-------|----------|-------------|
| `primary` | Main actions, CTAs | Blue |
| `secondary` | Secondary actions | Gray |
| `success` | Positive actions (confirm, proceed) | Green |
| `warning` | Caution actions (review, check) | Orange |
| `danger` | Destructive actions (delete, cancel) | Red |

---

### 2. Media Asset (`ui.media-asset`)

**File:** `media-asset.json`

A comprehensive media component for images, videos, audio, and documents with metadata.

#### Schema

```json
{
  "url": "string (required)",
  "type": "enum (image|video|audio|document)",
  "altText": "string (max 200 chars)",
  "caption": "text",
  "thumbnailUrl": "string",
  "width": "integer",
  "height": "integer",
  "fileSize": "integer (bytes)",
  "duration": "integer (seconds)"
}
```

#### Usage in Content Types

```json
{
  "attributes": {
    "media": {
      "type": "component",
      "repeatable": true,
      "component": "ui.media-asset"
    }
  }
}
```

#### Example Data

**Image:**
```json
{
  "media": {
    "url": "https://cdn.example.com/images/feature.jpg",
    "type": "image",
    "altText": "New feature screenshot",
    "caption": "Advanced reporting dashboard",
    "width": 1920,
    "height": 1080,
    "fileSize": 245760
  }
}
```

**Video:**
```json
{
  "media": {
    "url": "https://youtube.com/watch?v=abc123",
    "type": "video",
    "altText": "Feature tutorial video",
    "caption": "Learn how to use the new reporting feature",
    "thumbnailUrl": "https://img.youtube.com/vi/abc123/maxresdefault.jpg",
    "duration": 180
  }
}
```

---

### 3. Link (`ui.link`)

**File:** `link.json`

A simple link component with text, URL, and target configuration.

#### Schema

```json
{
  "text": "string (required, max 100 chars)",
  "url": "string (required)",
  "openInNewTab": "boolean (default: true)",
  "icon": "string (max 50 chars)",
  "isExternal": "boolean (default: false)"
}
```

#### Usage in Content Types

```json
{
  "attributes": {
    "relatedLinks": {
      "type": "component",
      "repeatable": true,
      "component": "ui.link"
    }
  }
}
```

#### Example Data

```json
{
  "relatedLinks": [
    {
      "text": "Documentation",
      "url": "https://docs.example.com",
      "openInNewTab": true,
      "icon": "📚",
      "isExternal": true
    },
    {
      "text": "Support Center",
      "url": "https://support.example.com",
      "openInNewTab": true,
      "icon": "💬",
      "isExternal": true
    }
  ]
}
```

---

## Best Practices

### Action Button

1. **Keep text concise** - Max 2-3 words for mobile display
2. **Use appropriate styles** - Match button style to action severity
3. **Validate URLs** - Ensure URLs are safe and accessible
4. **Consider deep links** - Use `app://` scheme for in-app navigation
5. **Test browser behavior** - Verify `openInBrowser` works as expected

**Good Examples:**
- ✅ "Learn More" (primary)
- ✅ "Download Now" (success)
- ✅ "View Details" (secondary)
- ✅ "Delete Account" (danger)

**Bad Examples:**
- ❌ "Click here to learn more about this amazing feature" (too long)
- ❌ "OK" (too vague)

### Media Asset

1. **Optimize file sizes** - Compress images/videos before uploading
2. **Provide alt text** - Essential for accessibility
3. **Use thumbnails** - For videos and large images
4. **Set dimensions** - Helps with layout calculations
5. **Track file size** - Monitor bandwidth usage

**Recommended Sizes:**
- Images: < 500KB (use WebP format)
- Videos: < 10MB (or use external hosting)
- Thumbnails: < 50KB

### Link

1. **Use descriptive text** - Avoid "click here"
2. **Mark external links** - Set `isExternal: true`
3. **Add icons** - Visual indicators improve UX
4. **Group related links** - Use repeatable component
5. **Test accessibility** - Ensure keyboard navigation works

---

## Component Reusability

These components can be used across multiple content types:

### News Alerts
```json
{
  "actionButton": { "component": "ui.action-button" },
  "media": { "component": "ui.media-asset", "repeatable": true }
}
```

### Product Announcements
```json
{
  "ctaButton": { "component": "ui.action-button" },
  "productImages": { "component": "ui.media-asset", "repeatable": true },
  "relatedLinks": { "component": "ui.link", "repeatable": true }
}
```

### Help Articles
```json
{
  "videoTutorial": { "component": "ui.media-asset" },
  "relatedArticles": { "component": "ui.link", "repeatable": true }
}
```

### Promotional Banners
```json
{
  "primaryAction": { "component": "ui.action-button" },
  "secondaryAction": { "component": "ui.action-button" },
  "bannerImage": { "component": "ui.media-asset" }
}
```

---

## TypeScript Types

For client-side TypeScript projects:

```typescript
// Action Button
interface ActionButton {
  text: string;
  url: string;
  style: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  openInBrowser: boolean;
}

// Media Asset
interface MediaAsset {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document';
  altText?: string;
  caption?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  duration?: number;
}

// Link
interface Link {
  text: string;
  url: string;
  openInNewTab: boolean;
  icon?: string;
  isExternal: boolean;
}
```

---

## Migration Guide

### From JSON to Component

If you have existing content types using JSON fields for buttons:

**Before:**
```json
{
  "actionButton": {
    "type": "json"
  }
}
```

**After:**
```json
{
  "actionButton": {
    "type": "component",
    "repeatable": false,
    "component": "ui.action-button"
  }
}
```

**Benefits:**
- ✅ Type safety in admin panel
- ✅ Validation built-in
- ✅ Consistent data structure
- ✅ Better documentation
- ✅ Reusable across content types

---

## Testing

### Validate Component Data

```typescript
// Example validation function
function validateActionButton(button: any): boolean {
  if (!button.text || button.text.length > 50) return false;
  if (!button.url) return false;
  if (!['primary', 'secondary', 'success', 'warning', 'danger'].includes(button.style)) return false;
  if (typeof button.openInBrowser !== 'boolean') return false;
  return true;
}
```

### Test Cases

1. **Action Button**
   - ✅ Text within 50 characters
   - ✅ Valid URL format
   - ✅ Style is one of allowed values
   - ✅ openInBrowser is boolean

2. **Media Asset**
   - ✅ URL is accessible
   - ✅ Type matches actual media
   - ✅ Dimensions are positive integers
   - ✅ File size is reasonable

3. **Link**
   - ✅ Text is descriptive
   - ✅ URL is valid
   - ✅ External links marked correctly

---

## Future Enhancements

Potential additions to UI components:

1. **Badge Component** - Status indicators, labels
2. **Alert Component** - Inline notifications
3. **Card Component** - Content containers
4. **Icon Component** - Icon library integration
5. **Progress Bar** - Loading/completion indicators
6. **Tooltip Component** - Contextual help text

---

## Support

For questions or issues with UI components:
- Check component JSON files in `src/components/ui/`
- Review Strapi component documentation
- Test in admin panel before deploying
