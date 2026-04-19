# Cron Jobs - Docker Swarm Distributed Locking

## Problem

When running Strapi with Docker Swarm (3 replicas), each instance executes cron jobs independently, causing:
- **Duplicate database records** (3x for each scheduled job)
- **Wasted resources** (same work done 3 times)
- **Data inconsistency** (race conditions)

## Solution

**Distributed locking using Redis** ensures only one replica executes each cron job at a time.

### How It Works

1. **Lock Acquisition**: When a cron job triggers, the replica attempts to acquire a Redis lock
2. **Atomic Operation**: Uses Redis `SET NX EX` for atomic lock acquisition
3. **Single Execution**: Only the replica that acquires the lock executes the job
4. **Auto-Expiry**: Lock expires after TTL (prevents deadlocks if replica crashes)
5. **Safe Release**: Lua script ensures only the lock holder can release it

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Replica 1  │     │  Replica 2  │     │  Replica 3  │
│             │     │             │     │             │
│  Cron Job   │     │  Cron Job   │     │  Cron Job   │
│  Triggers   │     │  Triggers   │     │  Triggers   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ Try Lock          │ Try Lock          │ Try Lock
       └───────────────────┼───────────────────┘
                           ▼
                    ┌─────────────┐
                    │    Redis    │
                    │             │
                    │  Lock Store │
                    └─────────────┘
                           │
                    ✓ Lock Acquired
                           │
                    ┌──────▼──────┐
                    │  Replica 2  │
                    │  Executes   │
                    │  Job        │
                    └─────────────┘
```

## Implementation

### 1. Distributed Lock Utility

**File**: `src/cron/utils/distributed-lock.ts`

Provides three functions:
- `acquireLock()`: Attempts to acquire a Redis lock
- `releaseLock()`: Releases a lock (only by holder)
- `withLock()`: Wrapper that handles acquire/execute/release

### 2. Updated Cron Jobs

**Files**:
- `src/cron/jobs/daily-telemetry-snapshot.ts`
- `src/cron/jobs/cleanup-old-snapshots.ts`

Both jobs now use `withLock()` to ensure single execution.

### 3. Configuration

**File**: `config/cron-tasks.ts`

Cron jobs are configured with:
- Schedule (cron expression)
- Timezone
- Lock TTL (time-to-live)

## Usage Example

```typescript
import { withLock } from '../utils/distributed-lock';

export async function executeMyCronJob(strapi: Core.Strapi): Promise<void> {
  const result = await withLock(
    strapi,
    {
      key: 'my-cron-job',           // Unique lock key
      ttl: 3600,                    // 1 hour lock
      retryAttempts: 0              // Don't retry if locked
    },
    async () => {
      // Your job logic here
      await doWork();
      return { success: true };
    }
  );

  if (!result.success) {
    strapi.log.info('Job skipped (another replica is running it)');
  }
}
```

## Lock Configuration

### TTL (Time-To-Live)

Choose TTL based on expected job duration:
- **Short jobs** (< 5 min): `ttl: 300` (5 minutes)
- **Medium jobs** (< 1 hour): `ttl: 3600` (1 hour)
- **Long jobs** (< 2 hours): `ttl: 7200` (2 hours)

**Important**: TTL should be longer than the job's expected duration to prevent lock expiry during execution.

### Retry Strategy

- **No retries** (`retryAttempts: 0`): Skip if another replica is running
- **With retries** (`retryAttempts: 3`): Wait and retry if lock is held

Most cron jobs should use **no retries** since they run on a schedule.

## Monitoring

### Logs

Each lock operation is logged:

```
[DistributedLock] Lock acquired: daily-telemetry-snapshot
  token: replica-2-1234567890-0.123
  ttl: 3600
  hostname: strapi-replica-2

[DistributedLock] Lock released: daily-telemetry-snapshot
  token: replica-2-1234567890-0.123
  hostname: strapi-replica-2
```

### Redis Keys

Locks are stored in Redis with keys:
```
cron:lock:daily-telemetry-snapshot
cron:lock:cleanup-old-snapshots
```

You can inspect locks using Redis CLI:
```bash
# Check if lock exists
redis-cli GET "cron:lock:daily-telemetry-snapshot"

# Check lock TTL
redis-cli TTL "cron:lock:daily-telemetry-snapshot"

# List all cron locks
redis-cli KEYS "cron:lock:*"
```

## Fallback Behavior

If Redis is unavailable:
- Lock acquisition returns `acquired: true` with warning
- Job executes without distributed locking
- Useful for development/single-replica environments

## Testing

### Local Testing (Single Instance)

```bash
npm run dev
```

Jobs execute normally without Redis (fallback mode).

### Docker Swarm Testing (Multiple Replicas)

```bash
# Deploy with 3 replicas
docker stack deploy -c docker-compose.swarm.production.yml tolen-pos

# Watch logs from all replicas
docker service logs -f tolen-pos_strapi

# You should see only ONE replica executing each job
```

### Manual Lock Testing

```bash
# Acquire lock manually
redis-cli SET "cron:lock:test-job" "manual-test" EX 60 NX

# Try to run job - should skip
# Release lock
redis-cli DEL "cron:lock:test-job"
```

## Troubleshooting

### Jobs Not Running

**Symptom**: No replica executes the job

**Possible Causes**:
1. Lock is stuck (previous execution crashed)
2. Redis connection issues

**Solution**:
```bash
# Check for stuck locks
redis-cli KEYS "cron:lock:*"

# Delete stuck lock
redis-cli DEL "cron:lock:daily-telemetry-snapshot"

# Check Redis connectivity
redis-cli PING
```

### Multiple Executions

**Symptom**: Job still runs multiple times

**Possible Causes**:
1. Redis not configured
2. Lock TTL too short (expires during execution)

**Solution**:
1. Verify Redis is running: `docker ps | grep redis`
2. Check logs for Redis connection errors
3. Increase lock TTL if job takes longer than expected

### Lock Expiry During Execution

**Symptom**: Lock expires while job is still running

**Solution**:
- Increase TTL in job configuration
- Optimize job to run faster
- Consider implementing lock renewal for very long jobs

## Environment Variables

```env
# Redis connection
REDIS_URL=redis://tolenPosRedis:6379

# Redis retry configuration
REDIS_MAX_RETRIES=10
REDIS_RETRY_DELAY=3000

# Cron schedules
TELEMETRY_SNAPSHOT_SCHEDULE="*/1 * * * *"  # Every minute (testing)
TELEMETRY_CLEANUP_SCHEDULE="0 3 * * 0"     # Sunday 3 AM
```

## Best Practices

1. **Unique Lock Keys**: Each job should have a unique lock key
2. **Appropriate TTL**: Set TTL longer than job duration
3. **No Retries**: Most scheduled jobs should not retry
4. **Idempotent Jobs**: Design jobs to be safe if run multiple times
5. **Monitor Logs**: Watch for lock acquisition failures
6. **Health Checks**: Monitor Redis connectivity

## Related Files

- `src/cron/utils/distributed-lock.ts` - Lock implementation
- `src/cron/jobs/daily-telemetry-snapshot.ts` - Snapshot job
- `src/cron/jobs/cleanup-old-snapshots.ts` - Cleanup job
- `config/cron-tasks.ts` - Cron configuration
- `src/socketio/redis-adapter.ts` - Redis client setup
- `docker-compose.swarm.production.yml` - Swarm configuration
