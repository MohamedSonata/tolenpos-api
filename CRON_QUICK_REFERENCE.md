# Cron Jobs - Quick Reference Card

## 🎯 Problem & Solution

**Problem**: 3 Docker Swarm replicas = 3x duplicate cron job executions
**Solution**: Redis distributed locking = Only 1 replica executes

## 📋 Quick Commands

### Check Cron Job Execution

```bash
# Watch cron job logs
docker service logs -f tolen-pos_strapi | grep -E "(CronTasks|DistributedLock)"

# Check which replica is executing
docker service logs tolen-pos_strapi | grep "Lock acquired"
```

### Check Redis Locks

```bash
# Connect to Redis
docker exec -it $(docker ps -q -f name=tolenPosRedis) redis-cli

# List all cron locks
KEYS "cron:lock:*"

# Check specific lock
GET "cron:lock:daily-telemetry-snapshot"

# Check lock TTL (seconds remaining)
TTL "cron:lock:daily-telemetry-snapshot"

# Delete stuck lock (emergency only)
DEL "cron:lock:daily-telemetry-snapshot"
```

### Verify No Duplicates

```bash
# Check database for duplicate records
docker exec -it $(docker ps -q -f name=tolenPosDb) psql -U tolenpos -d tolen_pos_db

# Run query
SELECT 
  DATE(captured_at) as date,
  COUNT(*) as count
FROM seat_telemetry_history
WHERE captured_at > NOW() - INTERVAL '1 day'
GROUP BY DATE(captured_at);
```

## 🔍 What to Look For

### ✅ Healthy Execution

```
[DistributedLock] Lock acquired: daily-telemetry-snapshot
  hostname: strapi-replica-2

[DailySnapshotJob] Job skipped (lock not acquired)
  hostname: strapi-replica-1

[DailySnapshotJob] Job skipped (lock not acquired)
  hostname: strapi-replica-3

[DailySnapshotJob] Daily snapshot job completed
  duration: 45.23s
  success: 150
```

**Expected**: 1 "Lock acquired", 2 "Job skipped", 1 "completed"

### ❌ Issues to Watch

**All replicas skip**:
```
[DailySnapshotJob] Job skipped (lock not acquired)  # All 3 replicas
```
→ Lock is stuck. Delete it manually.

**Multiple "Lock acquired"**:
```
[DistributedLock] Lock acquired  # Multiple replicas
```
→ Redis connection issue. Check Redis health.

**No logs at all**:
→ Cron schedule might be wrong or service not running.

## 🚨 Emergency Procedures

### Stuck Lock (Job Not Running)

```bash
# 1. Check if lock exists
docker exec $(docker ps -q -f name=tolenPosRedis) redis-cli GET "cron:lock:daily-telemetry-snapshot"

# 2. Delete stuck lock
docker exec $(docker ps -q -f name=tolenPosRedis) redis-cli DEL "cron:lock:daily-telemetry-snapshot"

# 3. Wait for next cron trigger or restart service
docker service update --force tolen-pos_strapi
```

### Redis Connection Issues

```bash
# 1. Check Redis is running
docker ps | grep redis

# 2. Check Redis health
docker exec $(docker ps -q -f name=tolenPosRedis) redis-cli PING
# Should return: PONG

# 3. Restart Redis if needed
docker service update --force tolen-pos_tolenPosRedis
```

### Force Job Execution

```bash
# Restart all replicas (will trigger cron on next schedule)
docker service update --force tolen-pos_strapi

# Or scale down and up
docker service scale tolen-pos_strapi=0
docker service scale tolen-pos_strapi=3
```

## 📊 Monitoring Checklist

Daily:
- [ ] Check logs for "Lock acquired" (should see 1 per job)
- [ ] Verify no duplicate database records
- [ ] Check Redis is healthy (`PING` returns `PONG`)

Weekly:
- [ ] Review stuck lock incidents
- [ ] Check job completion times (adjust TTL if needed)
- [ ] Verify cleanup job ran (Sunday 3 AM)

## 🔧 Configuration

### Cron Schedules

```typescript
// config/cron-tasks.ts

// Daily snapshot: Every minute (testing) or every hour (production)
TELEMETRY_SNAPSHOT_SCHEDULE="*/1 * * * *"  // Testing
TELEMETRY_SNAPSHOT_SCHEDULE="55 * * * *"   // Production

// Cleanup: Sunday 3 AM
TELEMETRY_CLEANUP_SCHEDULE="0 3 * * 0"
```

### Lock TTLs

```typescript
// src/cron/jobs/daily-telemetry-snapshot.ts
ttl: 3600  // 1 hour (adjust if job takes longer)

// src/cron/jobs/cleanup-old-snapshots.ts
ttl: 7200  // 2 hours (cleanup can take longer)
```

## 📚 Documentation

- **Full Guide**: `src/cron/README.md`
- **Deployment**: `DOCKER_SWARM_CRON_FIX.md`
- **Code**: `src/cron/utils/distributed-lock.ts`

## 🆘 Quick Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No job runs | Stuck lock | Delete lock in Redis |
| 3x duplicates | Lock not working | Check Redis connection |
| Job timeout | TTL too short | Increase TTL in code |
| Lock expires during job | Job too slow | Optimize job or increase TTL |

## 💡 Tips

1. **Lock TTL**: Should be 2-3x longer than job duration
2. **Monitoring**: Set up alerts for stuck locks (TTL > 2 hours)
3. **Testing**: Always test after deployment
4. **Logs**: Keep logs for at least 7 days to track patterns
5. **Redis**: Monitor Redis memory usage (locks are small but check)

## 🎓 How It Works (Simple)

```
Cron triggers → All 3 replicas try to lock → Only 1 succeeds → That 1 runs the job → Others skip
```

That's it! Redis ensures only one winner.

---

**Need Help?** Check `src/cron/README.md` for detailed documentation.
