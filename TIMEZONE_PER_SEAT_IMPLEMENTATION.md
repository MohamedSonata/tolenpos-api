# Timezone Per-Seat Implementation Guide

## Overview

Each key-seat now stores its own timezone, allowing precise "end of day" snapshots for international users.

---

## 1. Schema Changes

### Key-Seat Schema (`src/api/key-seat/content-types/key-seat/schema.json`)

Added `timezone` field:

```json
{
  "timezone": {
    "type": "string",
    "default": "UTC",
    "required": false
  }
}
```

---

## 2. POS Desktop App Integration

### Timezone Format: IANA Timezone Database

**Use the IANA timezone format** (also called "Olson database" or "tz database")

### Examples of Valid Timezones:

```javascript
// Middle East
"Asia/Amman"      // Jordan
"Asia/Dubai"      // UAE
"Asia/Riyadh"     // Saudi Arabia

// Asia
"Asia/Singapore"  // Singapore
"Asia/Shanghai"   // China
"Asia/Hong_Kong"  // Hong Kong
"Asia/Tokyo"      // Japan

// Europe
"Europe/London"   // UK
"Europe/Paris"    // France
"Europe/Berlin"   // Germany

// Africa
"Africa/Cairo"    // Egypt
"Africa/Johannesburg"  // South Africa

// Americas
"America/New_York"     // USA East Coast
"America/Chicago"      // USA Central
"America/Denver"       // USA Mountain
"America/Los_Angeles"  // USA West Coast
"America/Toronto"      // Canada

// Default
"UTC"  // Universal Coordinated Time
```

### How to Get Timezone in Your POS App

#### JavaScript/Electron App:

```javascript
// Automatic detection (recommended)
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Returns: "Asia/Amman", "America/New_York", etc.

console.log(timezone); // e.g., "Asia/Singapore"
```

#### C#/.NET App:

```csharp
using System;

// Get system timezone
TimeZoneInfo localZone = TimeZoneInfo.Local;
string timezone = localZone.Id;

// Convert Windows timezone to IANA format (required!)
// You'll need a mapping library like TimeZoneConverter
using TimeZoneConverter;
string ianaTimezone = TZConvert.WindowsToIana(timezone);

Console.WriteLine(ianaTimezone); // e.g., "Asia/Singapore"
```

**Important for .NET:** Windows uses different timezone names than IANA. You MUST convert them using a library like [TimeZoneConverter](https://github.com/mattjohnsonpint/TimeZoneConverter).

#### Python App:

```python
import datetime
import pytz

# Get local timezone
local_tz = datetime.datetime.now(datetime.timezone.utc).astimezone().tzinfo
timezone = str(local_tz)

print(timezone)  # e.g., "Asia/Singapore"
```

---

## 3. License Activation API

### Endpoint: `POST /api/licenses/activate`

### Request Body:

```json
{
  "licenseKey": "your-encrypted-license-key",
  "machineUUID": "unique-machine-identifier",
  "timezone": "Asia/Singapore",  // ← NEW FIELD (optional, defaults to UTC)
  "telemetry": {
    "osVersion": "Windows 11",
    "appVersion": "1.0.0",
    "machineName": "POS-STORE-01"
  }
}
```

### Response (Success):

```json
{
  "data": {
    "message": "License activated successfully",
    "license": {
      "documentId": "abc123",
      "userDocumentId": "user456",
      "planSubscriptionType": "Pro",
      "licenseKey": "...",
      "isActive": true,
      "expirationType": "expiring",
      "expiresAt": "2027-04-18T00:00:00.000Z",
      "maxSeats": 5,
      "activeSeats": 1
    },
    "seat": {
      "documentId": "seat789",
      "machineUUID": "09c9e360a47442387069f005cde8cc17",
      "isActive": true,
      "timezone": "Asia/Singapore"  // ← Stored timezone
    }
  }
}
```

### Validation:

- If `timezone` is invalid, the API will log a warning and default to `"UTC"`
- Activation will NOT fail due to invalid timezone
- Valid timezones are tested using `Intl.DateTimeFormat`

---

## 4. How the Cron Job Works

### Cron Schedule: Every Hour

```bash
# config/cron-tasks.ts
rule: "55 * * * *"  # Runs at :55 of every hour
tz: "UTC"
```

### Logic Flow:

1. **Cron runs every hour at :55 minutes**
2. **For each active seat:**
   - Get the seat's timezone (e.g., `"Asia/Singapore"`)
   - Calculate current local time in that timezone
   - Check if local time is between **23:55 and 23:59**
   - If yes, create a daily snapshot
   - If no, skip this seat

3. **Duplicate prevention:**
   - Check if a snapshot already exists for today (in seat's local date)
   - Skip if snapshot already created

### Example Timeline:

| UTC Time | Singapore (UTC+8) | Jordan (UTC+2) | USA West (UTC-8) | Action |
|----------|-------------------|----------------|------------------|--------|
| 15:55 | 23:55 | 17:55 | 07:55 | ✅ Snapshot Singapore seats |
| 21:55 | 05:55 (next day) | 23:55 | 13:55 | ✅ Snapshot Jordan seats |
| 07:55 | 15:55 | 09:55 | 23:55 | ✅ Snapshot USA West seats |

---

## 5. Testing Your Integration

### Step 1: Activate License with Timezone

```bash
curl -X POST http://localhost:1334/api/licenses/activate \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "your-license-key",
    "machineUUID": "test-machine-001",
    "timezone": "Asia/Singapore",
    "telemetry": {
      "osVersion": "Windows 11",
      "appVersion": "1.0.0"
    }
  }'
```

### Step 2: Verify Timezone Stored

Check the response - it should include:

```json
{
  "seat": {
    "timezone": "Asia/Singapore"
  }
}
```

### Step 3: Test Snapshot Creation

The cron job will automatically create snapshots when it's 23:55-23:59 in the seat's local timezone.

---

## 6. Timezone Detection Code Examples

### Electron/JavaScript (Recommended):

```javascript
// In your POS app activation code
async function activateLicense(licenseKey, machineUUID) {
  // Auto-detect timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const response = await fetch('http://your-api.com/api/licenses/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      machineUUID,
      timezone,  // Automatically detected
      telemetry: {
        osVersion: process.platform,
        appVersion: app.getVersion()
      }
    })
  });
  
  return await response.json();
}
```

### C#/.NET with TimeZoneConverter:

```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using TimeZoneConverter;

public async Task<string> ActivateLicense(string licenseKey, string machineUUID)
{
    // Get Windows timezone and convert to IANA
    TimeZoneInfo localZone = TimeZoneInfo.Local;
    string ianaTimezone = TZConvert.WindowsToIana(localZone.Id);
    
    var requestBody = new
    {
        licenseKey = licenseKey,
        machineUUID = machineUUID,
        timezone = ianaTimezone,  // IANA format
        telemetry = new
        {
            osVersion = Environment.OSVersion.ToString(),
            appVersion = "1.0.0"
        }
    };
    
    var json = JsonSerializer.Serialize(requestBody);
    var content = new StringContent(json, Encoding.UTF8, "application/json");
    
    using var client = new HttpClient();
    var response = await client.PostAsync(
        "http://your-api.com/api/licenses/activate",
        content
    );
    
    return await response.Content.ReadAsStringAsync();
}
```

---

## 7. Common Timezones by Region

### Middle East:
- Jordan: `Asia/Amman`
- UAE: `Asia/Dubai`
- Saudi Arabia: `Asia/Riyadh`
- Egypt: `Africa/Cairo`

### Asia:
- Singapore: `Asia/Singapore`
- China: `Asia/Shanghai`
- Hong Kong: `Asia/Hong_Kong`
- Japan: `Asia/Tokyo`
- India: `Asia/Kolkata`

### Europe:
- UK: `Europe/London`
- France: `Europe/Paris`
- Germany: `Europe/Berlin`

### Africa:
- South Africa: `Africa/Johannesburg`
- Egypt: `Africa/Cairo`

### Americas:
- USA East: `America/New_York`
- USA Central: `America/Chicago`
- USA Mountain: `America/Denver`
- USA West: `America/Los_Angeles`
- Canada: `America/Toronto`

---

## 8. Fallback Behavior

If timezone is:
- **Not provided**: Defaults to `"UTC"`
- **Invalid format**: Logs warning, defaults to `"UTC"`
- **Empty string**: Defaults to `"UTC"`

The activation will NEVER fail due to timezone issues.

---

## 9. Benefits of This Approach

✅ **Accurate end-of-day snapshots** for each user's local timezone
✅ **No data loss** - captures complete business day
✅ **Automatic detection** - POS app can auto-detect timezone
✅ **Flexible** - users in different timezones get snapshots at their local midnight
✅ **Efficient** - cron runs hourly, only snapshots seats at their end-of-day
✅ **Scalable** - works for any number of international users

---

## 10. Migration for Existing Seats

Existing seats without timezone will default to `"UTC"`. To update them:

1. **Option 1:** Users reactivate their license (timezone will be captured)
2. **Option 2:** Add timezone update endpoint (future enhancement)
3. **Option 3:** Manual update via admin panel

---

## Summary for POS App Developers

### What to Send:

```javascript
{
  "licenseKey": "...",
  "machineUUID": "...",
  "timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,  // ← Add this
  "telemetry": { ... }
}
```

### Timezone Format:

- **Use IANA format**: `"Asia/Singapore"`, `"America/New_York"`, etc.
- **Auto-detect**: `Intl.DateTimeFormat().resolvedOptions().timeZone` (JavaScript)
- **For .NET**: Use TimeZoneConverter library to convert Windows → IANA
- **Optional**: If not provided, defaults to `"UTC"`

### Testing:

```bash
# Test with your timezone
curl -X POST http://localhost:1334/api/licenses/activate \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"...","machineUUID":"...","timezone":"Asia/Singapore"}'
```

That's it! Your POS app will now have timezone-aware daily snapshots. 🎉
