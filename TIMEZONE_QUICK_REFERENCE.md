# Timezone Per-Seat - Quick Reference

## For POS App Developers

### What to Send During License Activation

```javascript
POST /api/licenses/activate

{
  "licenseKey": "your-license-key",
  "machineUUID": "unique-machine-id",
  "timezone": "Asia/Singapore",  // ← ADD THIS
  "telemetry": { ... }
}
```

### How to Get Timezone

**JavaScript/Electron (Recommended):**
```javascript
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Returns: "Asia/Singapore", "America/New_York", etc.
```

**C#/.NET:**
```csharp
// Install: TimeZoneConverter NuGet package
using TimeZoneConverter;

string windowsTimezone = TimeZoneInfo.Local.Id;
string ianaTimezone = TZConvert.WindowsToIana(windowsTimezone);
// Returns: "Asia/Singapore", "America/New_York", etc.
```

### Valid Timezone Examples

| Region | Timezone String |
|--------|----------------|
| 🇯🇴 Jordan | `"Asia/Amman"` |
| 🇪🇬 Egypt | `"Africa/Cairo"` |
| 🇸🇬 Singapore | `"Asia/Singapore"` |
| 🇨🇳 China | `"Asia/Shanghai"` |
| 🇬🇧 London | `"Europe/London"` |
| 🇿🇦 South Africa | `"Africa/Johannesburg"` |
| 🇺🇸 USA East | `"America/New_York"` |
| 🇺🇸 USA West | `"America/Los_Angeles"` |
| Default | `"UTC"` |

---

## How It Works

### 1. Cron Schedule
- Runs **every hour** at :55 minutes (e.g., 00:55, 01:55, 02:55, etc.)
- Production: `"55 * * * *"`
- Testing: `"*/1 * * * *"` (every minute)

### 2. Snapshot Logic
For each active seat:
1. Get seat's timezone (e.g., `"Asia/Singapore"`)
2. Calculate current local time in that timezone
3. If local time is **23:55-23:59**, create snapshot
4. If not, skip this seat

### 3. Example Timeline

| UTC Time | Singapore (UTC+8) | Jordan (UTC+2) | USA West (UTC-8) | Action |
|----------|-------------------|----------------|------------------|--------|
| 15:55 | **23:55** ✅ | 17:55 | 07:55 | Snapshot Singapore seats |
| 21:55 | 05:55 (next day) | **23:55** ✅ | 13:55 | Snapshot Jordan seats |
| 07:55 | 15:55 | 09:55 | **23:55** ✅ | Snapshot USA West seats |

---

## Configuration Files

### Schema: `src/api/key-seat/content-types/key-seat/schema.json`
```json
{
  "timezone": {
    "type": "string",
    "default": "UTC",
    "required": false
  }
}
```

### Cron: `config/cron-tasks.ts`
```typescript
rule: "55 * * * *",  // Every hour at :55
tz: "UTC"
```

### Environment: `.env.production`
```bash
TELEMETRY_SNAPSHOT_SCHEDULE=55 * * * *
TZ=UTC
```

---

## Testing

### 1. Activate with Timezone
```bash
curl -X POST http://localhost:1334/api/licenses/activate \
  -H "Content-Type: application/json" \
  -d '{
    "licenseKey": "your-key",
    "machineUUID": "test-001",
    "timezone": "Asia/Singapore"
  }'
```

### 2. Check Response
```json
{
  "seat": {
    "timezone": "Asia/Singapore"  // ← Should be stored
  }
}
```

### 3. Monitor Cron Logs
```
[CronTasks] ⏰ TIMEZONE-AWARE CRON TRIGGERED at 2026-04-18T15:55:00.000Z
[KeySeatService] Daily snapshot created {
  seatId: "abc123",
  timezone: "Asia/Singapore",
  localTime: "23:55",
  utcTime: "2026-04-18T15:55:00.000Z"
}
```

---

## Benefits

✅ **Accurate** - Each user gets snapshot at their local end-of-day
✅ **Automatic** - POS app auto-detects timezone
✅ **Flexible** - Supports any timezone worldwide
✅ **Efficient** - Only snapshots seats at their end-of-day
✅ **No data loss** - Captures complete business day

---

## Fallback

- If timezone not provided → defaults to `"UTC"`
- If timezone invalid → logs warning, defaults to `"UTC"`
- Activation never fails due to timezone issues

---

## Full Documentation

See `TIMEZONE_PER_SEAT_IMPLEMENTATION.md` for complete details.
