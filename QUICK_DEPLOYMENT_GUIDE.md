# Quick Deployment Guide - Telemetry Fixes

## 🚀 What Changed

### 1. Fixed Memory Leak (Session Lag Issue)
- **Issue**: Pending telemetry requests weren't cleaned up on disconnect
- **Fix**: Added automatic cleanup when sockets disconnect
- **Impact**: No more lag during session ended events

### 2. Migrated to Strapi Native Cron
- **Issue**: Using node-cron directly instead of Strapi's system
- **Fix**: Integrated cron jobs into `config/cron-tasks.ts`
- **Impact**: Better management and monitoring

---

## 📦 Files Changed

### Modified Files
1. `src/socketio/handlers/telemetry-query.handler.ts` - Added disconnect cleanup
2. `config/cron-tasks.ts` - Added telemetry cron jobs
3. `src/cron/jobs/daily-telemetry-snapshot.ts` - Removed node-cron registration
4. `src/cron/jobs/cleanup-old-snapshots.ts` - Removed node-cron registration
5. `src/cron/index.ts` - Deprecated manual initialization
6. `src/index.ts` - Removed manual cron initialization

### New Files
1. `TELEMETRY_FIXES_SUMMARY.md` - Detailed documentation
2. `QUICK_DEPLOYMENT_GUIDE.md` - This file

---

## ⚡ Deployment Steps

### 1. Review Changes (Optional)
```bash
# Check what changed
git diff src/socketio/handlers/telemetry-query.handler.ts
git diff config/cron-tasks.ts
```

### 2. Deploy
```bash
# Commit changes
git add .
git commit -m "fix: telemetry memory leak and migrate to Strapi native cron"

# Deploy (adjust for your deployment method)
git push origin main
```

### 3. Restart Strapi
```bash
# Development
npm run develop

# Production
npm run start
```

### 4. Verify Deployment
Check logs for these messages:
```
✅ [Bootstrap] Strapi cron jobs will be initialized automatically
✅ [CronTasks] Starting daily telemetry snapshot job (at scheduled time)
✅ [TelemetryQueryHandler] Cleaned up X pending requests (on disconnect)
```

---

## 🔍 Verification Checklist

### Immediate Checks (After Restart)
- [ ] Strapi starts without errors
- [ ] Socket.IO connections work
- [ ] Mobile app can query telemetry
- [ ] POS can send telemetry updates

### Within 24 Hours
- [ ] Cron jobs execute at scheduled times (check logs)
- [ ] Memory usage is stable (no growth)
- [ ] Disconnect events are fast (no lag)
- [ ] Cleanup logs appear on disconnect

### Within 1 Week
- [ ] Daily snapshots are created (check database)
- [ ] Old snapshots are deleted (Sunday 3 AM)
- [ ] No memory leak warnings
- [ ] Performance is stable

---

## 🛠️ Configuration (Optional)

### Customize Cron Schedules
Add to `.env` or `.env.production`:

```env
# Daily snapshot at 3 AM instead of 2 AM
TELEMETRY_SNAPSHOT_SCHEDULE="0 3 * * *"

# Cleanup on Saturday instead of Sunday
TELEMETRY_CLEANUP_SCHEDULE="0 3 * * 6"

# Keep snapshots for 60 days instead of 90
TELEMETRY_RETENTION_DAYS=60

# Use your timezone
TZ="America/New_York"
```

### Test Cron Jobs Manually
```typescript
// In Strapi console or create a test endpoint
await strapi.cron.jobs.dailyTelemetrySnapshot.task({ strapi });
await strapi.cron.jobs.cleanupOldSnapshots.task({ strapi });
```

---

## 🐛 Troubleshooting

### Cron Jobs Not Running
**Check**: Logs for cron registration
```
[CronTasks] Starting daily telemetry snapshot job
```

**Solution**: Verify `config/cron-tasks.ts` is properly formatted

### Memory Still Growing
**Check**: Disconnect cleanup logs
```
[TelemetryQueryHandler] Cleaned up X pending requests
```

**Solution**: Verify sockets are disconnecting properly

### Snapshots Not Created
**Check**: Daily snapshot job logs
```
[DailySnapshotJob] Daily snapshot job completed
```

**Solution**: Check for errors in logs, verify seats have `realtimeTelemetry`

---

## 📊 Monitoring Commands

### Check Active Cron Jobs
```bash
# In Strapi console
console.log(Object.keys(strapi.cron.jobs));
# Should show: ['dailyTelemetrySnapshot', 'cleanupOldSnapshots']
```

### Check Recent Snapshots
```sql
-- In database
SELECT COUNT(*), DATE(capturedAt) as date 
FROM seat_telemetry_histories 
WHERE snapshotType = 'daily'
GROUP BY DATE(capturedAt)
ORDER BY date DESC
LIMIT 7;
```

### Monitor Memory Usage
```bash
# Linux/Mac
ps aux | grep node

# Or use PM2
pm2 monit
```

---

## 🎯 Expected Results

### Before Fix
- ❌ Memory grows over time
- ❌ Lag during disconnect
- ❌ Pending requests accumulate
- ❌ Manual cron management

### After Fix
- ✅ Stable memory usage
- ✅ Fast disconnect handling
- ✅ Automatic cleanup
- ✅ Strapi-managed crons

---

## 📞 Support

### If Issues Occur
1. Check logs for error messages
2. Verify environment variables
3. Test socket connections manually
4. Review `TELEMETRY_FIXES_SUMMARY.md` for details

### Rollback (If Needed)
```bash
git revert HEAD
npm run start
```

---

## ✅ Success Indicators

After 24 hours of running:
- Memory usage is stable
- Cron jobs execute on schedule
- No disconnect lag
- Cleanup logs appear regularly
- Daily snapshots are created

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete

---

**Quick Links**:
- [Detailed Summary](./TELEMETRY_FIXES_SUMMARY.md)
- [Optimization Plan](./TELEMETRY_OPTIMIZATION_PLAN.md)
- [Cron Config](./config/cron-tasks.ts)
