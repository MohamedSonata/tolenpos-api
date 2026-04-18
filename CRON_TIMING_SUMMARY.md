# Daily Snapshot Cron Timing - Quick Reference

## ✅ CORRECT Configuration: 08:00 UTC

```bash
TELEMETRY_SNAPSHOT_SCHEDULE=0 8 * * *
TZ=UTC
```

## What Time Does It Run?

When the cron runs at **08:00 UTC**, here's the local time for each user:

| 🌍 Location | 🕐 Local Time | 📅 Date | ✅ Status |
|-------------|---------------|---------|-----------|
| 🇺🇸 USA West | 00:00 AM (midnight) | April 19 | Perfect! April 18 just ended |
| 🇺🇸 USA East | 03:00 AM | April 19 | April 18 ended 3 hours ago |
| 🇬🇧 London | 08:00 AM | April 19 | April 18 ended 8 hours ago |
| 🇪🇬 Egypt | 10:00 AM | April 19 | April 18 ended 10 hours ago |
| 🇯🇴 Jordan | 10:00 AM | April 19 | April 18 ended 10 hours ago |
| 🇿🇦 South Africa | 10:00 AM | April 19 | April 18 ended 10 hours ago |
| 🇸🇬 Singapore | 16:00 PM (4 PM) | April 19 | April 18 ended 16 hours ago |
| 🇨🇳 China | 16:00 PM (4 PM) | April 19 | April 18 ended 16 hours ago |

## What Data Gets Captured?

**For ALL users:** Complete data from **April 18, 00:00 to April 18, 23:59** (in their local timezone)

## Why 08:00 UTC?

1. **USA West Coast (UTC-8)** is your latest timezone
2. When it's **midnight (00:00)** in California, it's **08:00 UTC**
3. At this moment, **April 18 has ended everywhere**
4. The snapshot captures **complete April 18 data** for all users

## The Rule

**Wait for your westernmost users (latest timezone) to finish their day before taking the snapshot.**

---

## ❌ WRONG: 23:55 UTC (Previous Configuration)

| Location | Local Time | Problem |
|----------|------------|---------|
| Singapore | 07:55 AM (April 19) | ❌ Captures April 19 morning data! |
| Jordan | 01:55 AM (April 19) | ❌ Captures April 19 early morning data! |
| USA West | 15:55 PM (April 18) | ❌ Misses evening hours! |

**Result:** Wrong data for everyone!

---

## Testing vs Production

### Testing (`.env`):
```bash
TELEMETRY_SNAPSHOT_SCHEDULE=*/1 * * * *  # Every minute
```

### Production (`.env.production`):
```bash
TELEMETRY_SNAPSHOT_SCHEDULE=0 8 * * *  # 08:00 UTC daily
```

---

## Quick Conversion Table

| UTC Time | USA West | Jordan | Singapore |
|----------|----------|--------|-----------|
| 00:00 | 16:00 (prev day) | 02:00 | 08:00 |
| 04:00 | 20:00 (prev day) | 06:00 | 12:00 |
| **08:00** | **00:00** | **10:00** | **16:00** |
| 12:00 | 04:00 | 14:00 | 20:00 |
| 16:00 | 08:00 | 18:00 | 00:00 (next day) |
| 20:00 | 12:00 | 22:00 | 04:00 (next day) |
| 23:55 | 15:55 | 01:55 (next day) | 07:55 (next day) |

**Bold = Recommended cron time (08:00 UTC)**
