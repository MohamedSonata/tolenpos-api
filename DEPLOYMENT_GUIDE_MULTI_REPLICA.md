# Multi-Replica Socket.IO Deployment Guide

## Overview

This guide walks you through deploying the multi-replica Socket.IO architecture with Redis adapter.

## Prerequisites

- Docker Swarm cluster set up
- Redis service available
- Understanding of your current architecture

## Step-by-Step Deployment

### Step 1: Install Dependencies

```bash
npm install @socket.io/redis-adapter@^8.3.0 redis@^4.7.0
```

### Step 2: Update Environment Variables

Add to your `.env.production`:

```env
# Redis Configuration
REDIS_URL=redis://redis:6379
ENABLE_REDIS_ADAPTER=true

# Optional: Redis retry configuration
REDIS_MAX_RETRIES=10
REDIS_RETRY_DELAY=3000

# Optional: Telemetry timeout
TELEMETRY_QUERY_TIMEOUT=10000
```

### Step 3: Deploy Redis Service

The `docker-compose.swarm.yml` already includes Redis. Deploy it:

```bash
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

### Step 4: Verify Redis Connection

Check Redis logs:

```bash
docker service logs tolen-pos_redis
```

Check Strapi logs for Redis connection:

```bash
docker service logs tolen-pos_strapi | grep Redis
```

You should see:
```
[Redis] Connecting to Redis at redis://redis:6379
[Redis Pub] Connected
[Redis Sub] Connected
[Redis State] Connected
[SocketIO] Redis adapter configured successfully
```

### Step 5: Test Cross-Replica Communication

#### Test 1: Connect Mobile App to Different Replicas

1. Connect mobile app (it will connect to one replica)
2. Trigger a seat update from POS (might be on different replica)
3. Verify mobile app receives the update

#### Test 2: Telemetry Query Across Replicas

1. Mobile app sends telemetry query (replica A)
2. POS responds (replica B)
3. Mobile app receives response (works across replicas)

#### Test 3: Plan Update Broadcast

1. Update user plan via API (any replica)
2. Verify all POS machines receive update (all replicas)

### Step 6: Monitor Health

#### Check Socket Connections Per Replica

```bash
# Get replica IDs
docker service ps tolen-pos_strapi

# Check logs for each replica
docker logs <container_id> | grep "Socket connected"
```

#### Check Redis Health

```bash
# Connect to Redis
docker exec -it <redis_container_id> redis-cli

# Check connected clients
CLIENT LIST

# Check pub/sub channels
PUBSUB CHANNELS

# Check keys (pending requests)
KEYS pending_request:*
```

#### Monitor Event Delivery

Look for these log patterns:

```
[SocketManager] Socket <id> joined room user:<documentId>
[TelemetryQueryHandler] Forwarded query to POS room pos:<keySeatId>
[SeatUpdateHandler] Notified mobile apps in room user:<documentId>:seats
```

## Troubleshooting

### Issue: Redis Connection Fails

**Symptoms:**
```
[Redis] Error: connect ECONNREFUSED
```

**Solutions:**
1. Check Redis service is running: `docker service ls`
2. Verify Redis URL in environment variables
3. Check network connectivity between services

### Issue: Events Not Delivered Across Replicas

**Symptoms:**
- Mobile app doesn't receive updates
- POS doesn't receive queries

**Solutions:**
1. Verify Redis adapter is enabled: Check logs for "Redis adapter configured"
2. Check room membership: Add debug logs in `joinUserRooms`
3. Verify event names match between emit and listen

### Issue: Pending Requests Not Cleaned Up

**Symptoms:**
- Redis keys accumulate: `KEYS pending_request:*` shows many keys
- Memory usage increases

**Solutions:**
1. Check TTL is set: `TTL pending_request:<id>` should show ~30 seconds
2. Verify cleanup on disconnect is working
3. Manually clean: `DEL pending_request:<id>`

### Issue: High Redis Latency

**Symptoms:**
- Slow event delivery
- Timeouts

**Solutions:**
1. Check Redis memory: `INFO memory`
2. Monitor Redis CPU: `INFO cpu`
3. Consider Redis cluster for high load
4. Adjust `REDIS_MAX_RETRIES` and `REDIS_RETRY_DELAY`

## Performance Optimization

### 1. Redis Configuration

Add to Redis service in docker-compose:

```yaml
redis:
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --appendonly yes
```

### 2. Connection Pooling

Already implemented in the Redis adapter setup.

### 3. Event Batching

For high-frequency updates, consider batching:

```typescript
// Instead of emitting every update
socket.emit('seat:update', data);

// Batch updates every 100ms
const batchedUpdates = [];
setInterval(() => {
  if (batchedUpdates.length > 0) {
    socket.emit('seat:updates:batch', batchedUpdates);
    batchedUpdates.length = 0;
  }
}, 100);
```

## Rollback Plan

If you need to rollback to single-replica:

### Step 1: Disable Redis Adapter

Update `.env.production`:
```env
ENABLE_REDIS_ADAPTER=false
```

### Step 2: Scale Down to 1 Replica

```bash
docker service scale tolen-pos_strapi=1
```

### Step 3: Verify Single Replica Works

Test all socket functionality with single replica.

## Migration Checklist

- [ ] Redis service deployed and healthy
- [ ] Environment variables updated
- [ ] Dependencies installed
- [ ] All replicas show Redis connection in logs
- [ ] Mobile app can connect and receive updates
- [ ] POS can send updates and receive queries
- [ ] Telemetry queries work across replicas
- [ ] Plan updates broadcast to all POS machines
- [ ] Pending requests are cleaned up properly
- [ ] No socket ID errors in logs
- [ ] Performance is acceptable (< 50ms event latency)
- [ ] Monitoring and alerts configured

## Monitoring Metrics

### Key Metrics to Track

1. **Socket Connection Count**
   - Per replica
   - Total across all replicas
   - By client type (mobile vs POS)

2. **Event Delivery Rate**
   - Events/second
   - Success rate
   - Latency (p50, p95, p99)

3. **Redis Metrics**
   - Connection count
   - Memory usage
   - Command latency
   - Pub/sub channel count

4. **Pending Request Metrics**
   - Active pending requests
   - Timeout rate
   - Average response time

### Alerting Thresholds

- Redis connection failures > 0
- Event delivery latency > 100ms (p95)
- Pending request timeout rate > 5%
- Redis memory usage > 80%
- Socket connection failures > 10/minute

## Best Practices

1. **Always Use Rooms for Communication**
   - Never use socket IDs directly
   - Use `io.to(roomName).emit()` pattern

2. **Store Minimal State in Redis**
   - Only pending requests and critical state
   - Use TTL for automatic cleanup

3. **Handle Redis Failures Gracefully**
   - Fallback to in-memory for development
   - Log errors but don't crash

4. **Monitor Everything**
   - Socket connections
   - Event delivery
   - Redis health
   - Application errors

5. **Test Replica Failures**
   - Kill one replica and verify others work
   - Test reconnection behavior
   - Verify no data loss

## Support

For issues or questions:
1. Check logs: `docker service logs tolen-pos_strapi`
2. Check Redis: `docker exec -it <redis_container> redis-cli`
3. Review this guide
4. Check Socket.IO documentation: https://socket.io/docs/v4/redis-adapter/