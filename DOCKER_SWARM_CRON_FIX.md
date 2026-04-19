# Docker Swarm Cron Job Fix - Distributed Locking

## Problem Summary

With Docker Swarm running 3 replicas of Strapi, each instance executes cron jobs independently, causing:
- ❌ **Triple database records** (each job creates 3x records)
- ❌ **Wasted resources** (same work done 3 times)
- ❌ **Potential race conditions** and data inconsistency

## Solution

✅ **Distributed locking using Redis** ensures only ONE replica executes each cron job.

## Changes Made

### 1. New Files Created

```
src/cron/utils/distributed-lock.ts          # Core locking utility
src/cron/utils/test-distributed-lock.ts     # Testing utilities
src/cron/README.md                          # Comprehensive documentation
DOCKER_SWARM_CRON_FIX.md                    # This file
```

### 2. Modified Files

```
src/cron/jobs/daily-telemetry-snapshot.ts   # Added distributed locking
src/cron/jobs/cleanup-old-snapshots.ts      # Added distributed locking
config/cron-tasks.ts                        # Updated documentation
```

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Replica 1  │     │  Replica 2  │     │  Replica 3  │
│  (tries)    │     │  (WINS!)    │     │  (tries)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
                    ┌─────────────┐
                    │    Redis    │
                    │  Lock Store │
                    └─────────────┘
                           │
                    Only Replica 2
                    executes the job
```

1. **Cron triggers** on all 3 replicas simultaneously
2. **Each replica tries** to acquire a Redis lock
3. **Only ONE succeeds** (atomic Redis operation)
4. **Winner executes** the job
5. **Others skip** and log "lock not acquired"
6. **Lock auto-expires** after TTL (prevents deadlocks)

## Deployment Steps

### Prerequisites

✅ Redis is already configured in your Docker Swarm setup:
- Service: `tolenPosRedis`
- Port: `6380:6379`
- Already used for Socket.IO adapter

### Step 1: Deploy Updated Code

```bash
# Build new image with distributed locking
docker build -t mosonata/tolen-pos-api:latest .

# Push to registry (if using remote registry)
docker push mosonata/tolen-pos-api:latest

# Update the stack
docker stack deploy -c docker-compose.swarm.production.yml tolen-pos
```

### Step 2: Verify Deployment

```bash
# Check all services are running
docker service ls

# Watch logs from all replicas
docker service logs -f tolen-pos_strapi

# You should see logs like:
# [DistributedLock] Lock acquired: daily-telemetry-snapshot (from ONE replica)
# [DistributedLock] Job skipped (lock not acquired) (from OTHER replicas)
```

### Step 3: Monitor First Execution

Wait for the next cron trigger and verify:

```bash
# Watch logs in real-time
docker service logs -f tolen-pos_strapi | grep -E "(DistributedLock|CronTasks)"

# Expected output:
# Replica 1: [DistributedLock] Lock acquired: daily-telemetry-snapshot
# Replica 2: [DailySnapshotJob] Job skipped (lock not acquired)
# Replica 3: [DailySnapshotJob] Job skipped (lock not acquired)
```

### Step 4: Verify Database

Check that only ONE set of records is created per cron execution:

```sql
-- Check recent telemetry snapshots
SELECT 
  DATE(captured_at) as date,
  COUNT(*) as snapshot_count
FROM seat_telemetry_history
WHERE captured_at > NOW() - INTERVAL '1 day'
GROUP BY DATE(captured_at)
ORDER BY date DESC;

-- Should show normal counts, not 3x
```

## Testing

### Local Testing (Development)

```bash
# Start Strapi locally
npm run dev

# Jobs will run without Redis (fallback mode)
# This is normal for single-instance development
```

### Docker Swarm Testing

```bash
# Deploy with 3 replicas
docker stack deploy -c docker-compose.swarm.production.yml tolen-pos

# Trigger a test cron job manually (if needed)
# Or wait for scheduled execution

# Monitor logs
docker service logs -f tolen-pos_strapi | grep "DistributedLock"
```

### Manual Lock Testing

```bash
# Connect to Redis
docker exec -it $(docker ps -q -f name=tolenPosRedis) redis-cli

# Check for cron locks
KEYS "cron:lock:*"

# Check specific lock
GET "cron:lock:daily-telemetry-snapshot"

# Check lock TTL (time remaining)
TTL "cron:lock:daily-telemetry-snapshot"

# Manually delete a stuck lock (if needed)
DEL "cron:lock:daily-telemetry-snapshot"
```

## Monitoring

### What to Watch

1. **Lock Acquisition Logs**
   ```
   [DistributedLock] Lock acquired: daily-telemetry-snapshot
   token: strapi-replica-2-1234567890-0.123
   hostname: strapi-replica-2
   ```

2. **Job Skipped Logs**
   ```
   [DailySnapshotJob] Job skipped or failed
   reason: Lock held by another instance
   hostname: strapi-replica-1
   ```

3. **Job Completion Logs**
   ```
   [DailySnapshotJob] Daily snapshot job completed
   duration: 45.23s
   total: 150
   success: 150
   ```

### Redis Health Check

```bash
# Check Redis is running
docker ps | grep redis

# Check Redis connectivity
docker exec $(docker ps -q -f name=tolenPosRedis) redis-cli PING
# Should return: PONG

# Check Redis memory usage
docker exec $(docker ps -q -f name=tolenPosRedis) redis-cli INFO memory
```

## Troubleshooting

### Issue: Jobs Not Running at All

**Symptoms**: No replica executes the job

**Possible Causes**:
1. Lock is stuck from previous crashed execution
2. Redis connection issues

**Solution**:
```bash
# Check for stuck locks
docker exec $(docker ps -q -f name=tolenPosRedis) redis-cli KEYS "cron:lock:*"

# Delete stuck lock
docker exec $(docker ps -q -f name=tolenPosRedis) redis-cli DEL "cron:lock:daily-telemetry-snapshot"

# Check Redis connectivity
docker service logs tolen-pos_tolenPosRedis
```

### Issue: Still Getting Duplicate Records

**Symptoms**: Database still shows 3x records

**Possible Causes**:
1. Old code still running (deployment not complete)
2. Redis not connected

**Solution**:
```bash
# Force update all replicas
docker service update --force tolen-pos_strapi

# Check logs for Redis connection
docker service logs tolen-pos_strapi | grep -i redis

# Should see: [Redis State] Connected
```

### Issue: Lock Expires During Execution

**Symptoms**: Job takes longer than lock TTL

**Solution**:
Increase TTL in the job file:

```typescript
// In src/cron/jobs/daily-telemetry-snapshot.ts
await withLock(
  strapi,
  {
    key: 'daily-telemetry-snapshot',
    ttl: 7200, // Increase from 3600 to 7200 (2 hours)
    retryAttempts: 0
  },
  // ...
);
```

## Rollback Plan

If issues occur, rollback to previous version:

```bash
# Deploy previous image
docker service update --image mosonata/tolen-pos-api:previous tolen-pos_strapi

# Or rollback the entire stack
docker stack rm tolen-pos
docker stack deploy -c docker-compose.swarm.production.yml tolen-pos
```

**Note**: Without distributed locking, you'll get 3x duplicate records again.

## Environment Variables

No new environment variables required! The solution uses existing Redis configuration:

```env
# Already configured in your .env.production
REDIS_URL=redis://tolenPosRedis:6379
REDIS_MAX_RETRIES=10
REDIS_RETRY_DELAY=3000
```

## Performance Impact

- **Minimal overhead**: Single Redis SET operation per cron trigger
- **No blocking**: Replicas that don't get the lock skip immediately
- **Auto-cleanup**: Locks expire automatically (no manual cleanup needed)
- **Fallback safe**: Works without Redis in development

## Benefits

✅ **No duplicate records** - Only one replica executes each job
✅ **Resource efficient** - Work done once, not 3x
✅ **Data consistency** - No race conditions
✅ **Automatic failover** - If lock holder crashes, lock expires and another replica can take over
✅ **Zero configuration** - Uses existing Redis setup
✅ **Development friendly** - Works without Redis in single-instance mode

## Next Steps

1. ✅ Deploy the updated code
2. ✅ Monitor first few cron executions
3. ✅ Verify database records are not duplicated
4. ✅ Set up alerts for stuck locks (optional)
5. ✅ Document for team (this file!)

## Additional Resources

- **Full Documentation**: `src/cron/README.md`
- **Lock Implementation**: `src/cron/utils/distributed-lock.ts`
- **Test Utilities**: `src/cron/utils/test-distributed-lock.ts`
- **Redis Adapter**: `src/socketio/redis-adapter.ts`

## Support

If you encounter issues:

1. Check logs: `docker service logs -f tolen-pos_strapi`
2. Check Redis: `docker exec $(docker ps -q -f name=tolenPosRedis) redis-cli PING`
3. Review documentation: `src/cron/README.md`
4. Test manually: Use test utilities in `src/cron/utils/test-distributed-lock.ts`

---

**Status**: ✅ Ready for deployment
**Impact**: High (fixes critical duplicate record issue)
**Risk**: Low (graceful fallback, uses existing Redis)
**Testing**: Required (monitor first few executions)
