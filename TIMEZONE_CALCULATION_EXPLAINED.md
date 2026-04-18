# Timezone Calculation for Daily Snapshots - DETAILED EXPLANATION

## The Critical Question

**When should the cron run to capture "end of day" data for ALL users worldwide?**

## Understanding the Problem

Your users span from **USA West Coast (UTC-8)** to **Singapore/China (UTC+8)** - a **16-hour time difference**.

### Scenario 1: Run at 23:55 UTC ❌ WRONG

| Location | Local Time | Problem |
|----------|------------|---------|
| 🇸🇬 Singapore | 07:55 AM (April 19) | Already next day! Captures April 19 morning data, misses April 18 completely |
| 🇯🇴 Jordan | 01:55 AM (April 19) | Already next day! Captures April 19 early morning data |
| 🇬🇧 London | 23:55 PM (April 18) | ✅ Perfect timing |
| 🇺🇸 USA East | 18:55 PM (April 18) | Still same day, but misses evening hours (6 PM) |
| 🇺🇸 USA West | 15:55 PM (April 18) | Still same day, but misses evening hours (3 PM) |

**Result:** Singapore/Jordan users get WRONG data (next day's data), USA users get INCOMPLETE data.

---

## The Correct Solution: Run at 07:55 UTC ✅

When you run at **07:55 UTC**, here's what happens:

| Location | Timezone | Local Time | Status |
|----------|----------|------------|--------|
| 🇺🇸 USA West | UTC-8 | 23:55 PM (April 18) | ✅ Perfect! End of day |
| 🇺🇸 USA East | UTC-5 | 02:55 AM (April 19) | ✅ Just after midnight, captures full April 18 |
| 🇬🇧 London | UTC+0 | 07:55 AM (April 19) | ✅ Morning of next day, captures full April 18 |
| 🇪🇬 Egypt | UTC+2 | 09:55 AM (April 19) | ✅ Morning of next day, captures full April 18 |
| 🇯🇴 Jordan | UTC+2 | 09:55 AM (April 19) | ✅ Morning of next day, captures full April 18 |
| 🇿🇦 South Africa | UTC+2 | 09:55 AM (April 19) | ✅ Morning of next day, captures full April 18 |
| 🇸🇬 Singapore | UTC+8 | 15:55 PM (April 19) | ✅ Afternoon of next day, captures full April 18 |
| 🇨🇳 China | UTC+8 | 15:55 PM (April 19) | ✅ Afternoon of next day, captures full April 18 |

**Result:** ALL users get complete previous day's data! ✅

---

## Why 07:55 UTC Works

### The Logic:

1. **USA West Coast (UTC-8)** is the **latest timezone** among your users
2. When it's **23:55 in California**, it's **07:55 UTC the next day**
3. At this moment:
   - USA West: End of April 18 (23:55 PM)
   - Everyone else: Already April 19 (morning/afternoon)
4. The snapshot captures **April 18 data** for everyone

### The Key Insight:

**You must wait for the LATEST timezone to finish their day before taking the snapshot.**

Since USA West Coast (UTC-8) is your latest timezone, you wait until they reach 23:55, which is **07:55 UTC**.

---

## Visual Timeline

```
April 18, 23:55 PM in California (UTC-8)
         ↓
April 19, 07:55 AM in UTC
         ↓
April 19, 09:55 AM in Jordan (UTC+2)
         ↓
April 19, 15:55 PM in Singapore (UTC+8)
```

All these times are **THE SAME MOMENT** - just expressed in different timezones.

At this moment, **April 18 has ended everywhere in the world**.

---

## What Data Gets Captured?

When the cron runs at **07:55 UTC**:

### For Singapore User (15:55 PM April 19):
```
Snapshot captures: April 18, 00:00 to April 18, 23:59 (Singapore time)
Status: ✅ Complete day
```

### For Jordan User (09:55 AM April 19):
```
Snapshot captures: April 18, 00:00 to April 18, 23:59 (Jordan time)
Status: ✅ Complete day
```

### For USA West User (23:55 PM April 18):
```
Snapshot captures: April 18, 00:00 to April 18, 23:55 (California time)
Status: ✅ Almost complete day (missing last 5 minutes, but acceptable)
```

---

## Alternative: Run at 08:00 UTC (Safer)

If you want to ensure even USA West Coast users have their full day captured:

**Run at 08:00 UTC** (midnight in California becomes 08:00 UTC)

| Location | Local Time |
|----------|------------|
| 🇺🇸 USA West | 00:00 AM (April 19) - Just after midnight |
| 🇺🇸 USA East | 03:00 AM (April 19) |
| 🇬🇧 London | 08:00 AM (April 19) |
| 🇯🇴 Jordan | 10:00 AM (April 19) |
| 🇸🇬 Singapore | 16:00 PM (April 19) |

This gives a small buffer to ensure all data is captured.

---

## Recommended Configuration

### Option 1: 07:55 UTC (Recommended)
```bash
TELEMETRY_SNAPSHOT_SCHEDULE=55 7 * * *
TZ=UTC
```

**Pros:**
- Captures complete day for all users
- Runs at reasonable time (not middle of night for server)
- USA West gets snapshot at 23:55 (end of business day)

### Option 2: 08:00 UTC (Safest)
```bash
TELEMETRY_SNAPSHOT_SCHEDULE=0 8 * * *
TZ=UTC
```

**Pros:**
- Extra 5-minute buffer for USA West
- Cleaner time (on the hour)
- Guaranteed complete day for everyone

---

## Summary

### ❌ WRONG: 23:55 UTC
- Singapore/Jordan: Captures NEXT day's data (wrong!)
- USA: Captures INCOMPLETE day (wrong!)

### ✅ CORRECT: 07:55 UTC or 08:00 UTC
- ALL users: Captures COMPLETE previous day's data
- Works because you wait for the latest timezone (USA West) to finish their day

### The Rule:
**Run the cron when it's 23:55-00:00 in your LATEST timezone (westernmost users).**

For your users, that's USA West Coast (UTC-8), so:
- 23:55 in UTC-8 = 07:55 UTC
- 00:00 in UTC-8 = 08:00 UTC

Choose **08:00 UTC** for the safest option.
