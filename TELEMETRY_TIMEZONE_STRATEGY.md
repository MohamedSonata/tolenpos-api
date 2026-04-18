# Telemetry Snapshot Timezone Strategy

## Problem Statement

Our POS application serves international users across multiple timezones:
- **Jordan** (UTC+2/+3)
- **Egypt** (UTC+2)
- **Singapore** (UTC+8)
- **London** (UTC+0/+1)
- **USA East Coast** (UTC-5/-4)
- **USA West Coast** (UTC-8/-7)
- **South Africa** (UTC+2)
- **China** (UTC+8)

We need to ensure every user gets a daily telemetry snapshot, regardless of their timezone.

## Current Solution: Single Daily Run at 23:55 UTC

### How It Works

The cron job runs **once per day at 23:55 UTC**. This ensures:

1. **Universal Coverage**: When it's 23:55 UTC, it's already the next calendar day in most eastern timezones
2. **Consistent Timing**: All snapshots are taken at the same moment globally
3. **Simple Implementation**: No need to store or manage user timezones

### What Time Does It Run in Each Timezone?

When the cron runs at **23:55 UTC**:

| Location | Timezone | Local Time | Calendar Day |
|----------|----------|------------|--------------|
| Singapore | UTC+8 | 07:55 AM | Next day |
| China | UTC+8 | 07:55 AM | Next day |
| Jordan (Winter) | UTC+2 | 01:55 AM | Next day |
| Jordan (Summer) | UTC+3 | 02:55 AM | Next day |
| Egypt | UTC+2 | 01:55 AM | Next day |
| South Africa | UTC+2 | 01:55 AM | Next day |
| London (Winter) | UTC+0 | 23:55 PM | Same day |
| London (Summer) | UTC+1 | 00:55 AM | Next day |
| USA East (Winter) | UTC-5 | 18:55 PM | Same day |
| USA East (Summer) | UTC-4 | 19:55 PM | Same day |
| USA West (Winter) | UTC-8 | 15:55 PM | Same day |
| USA West (Summer) | UTC-7 | 16:55 PM | Same day |

### Trade-offs

**Pros:**
- ✅ Simple implementation
- ✅ No timezone data storage needed
- ✅ Guaranteed daily snapshot for all users
- ✅ Consistent global timing
- ✅ Easy to debug and monitor

**Cons:**
- ⚠️ USA users get snapshots in the afternoon (not end-of-day)
- ⚠️ Asian users get snapshots in the early morning (captures previous day)
- ⚠️ Not truly "end of day" for each user's local time

## Alternative Solution: Per-User Timezone Snapshots

If you need true "end of day" snapshots for each user, implement this approach:

### Step 1: Add Timezone Field to Data Model

Add timezone to the License or User model:

```json
// src/api/license/content-types/license/schema.json
{
  "attributes": {
    "timezone": {
      "type": "string",
      "default": "UTC",
      "required": true
    }
  }
}
```

### Step 2: Run Cron Job Hourly

Change the cron schedule to run every hour:

```typescript
// config/cron-tasks.ts
options: {
  rule: "55 * * * *", // Run at :55 of every hour
  tz: "UTC",
}
```

### Step 3: Modify Snapshot Logic

Update `src/cron/jobs/daily-telemetry-snapshot.ts`:

```typescript
export async function executeDailySnapshotJob(strapi: Core.Strapi): Promise<void> {
  const currentHourUTC = new Date().getUTCHours();
  
  // Find all active seats
  const seats = await strapi.documents('api::key-seat.key-seat').findMany({
    filters: { isActive: true },
    populate: ['license', 'license.user']
  });

  for (const seat of seats) {
    const userTimezone = seat.license?.timezone || 'UTC';
    
    // Calculate what hour it is in the user's timezone
    const userLocalHour = calculateLocalHour(currentHourUTC, userTimezone);
    
    // Only snapshot if it's 23:xx in the user's timezone
    if (userLocalHour === 23) {
      // Check if snapshot already exists for today
      const alreadySnapshotted = await checkIfSnapshotExistsToday(seat.documentId, userTimezone);
      
      if (!alreadySnapshotted) {
        await createSnapshot(seat);
      }
    }
  }
}
```

### Step 4: Collect Timezone from Users

Add timezone selection in your user registration/settings:

```typescript
// Example: Collect timezone during license creation
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Store in license.timezone field
```

## Recommendation

**For now, stick with the current solution (23:55 UTC daily)** because:

1. It's simple and reliable
2. You don't currently store user timezones
3. The snapshot captures "daily activity" which doesn't need to be exactly at midnight
4. Adding timezone support requires schema changes and migration

**Consider the per-user timezone approach if:**
- Users complain about snapshot timing
- You need precise "end of business day" snapshots
- You're willing to add timezone data collection to your onboarding flow
- You need timezone-aware reporting features

## Configuration

### Current Settings

**Development (`.env`):**
```bash
TZ=UTC
TELEMETRY_SNAPSHOT_SCHEDULE=*/1 * * * *  # Every minute for testing
```

**Production (`.env.production`):**
```bash
TZ=UTC
TELEMETRY_SNAPSHOT_SCHEDULE=55 23 * * *  # 23:55 UTC daily
```

### Monitoring

Check cron execution in logs:
```
[CronTasks] ⏰ CRON TRIGGERED at 2026-04-18T23:55:00.000Z
[DailySnapshotJob] Daily snapshot job completed { duration: '2.34s', total: 150, success: 150 }
```

## Future Enhancements

1. **Add timezone field** to License or User model
2. **Collect timezone** during user registration
3. **Implement hourly cron** with timezone-aware logic
4. **Add timezone selector** in admin dashboard
5. **Show local time** in telemetry reports
