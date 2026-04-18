# Redis Connection Troubleshooting Guide

## Issue: Connection Refused Error

### Error Message
```
[Redis] Error: connect ECONNREFUSED 10.0.7.15:6371
```

### Root Cause
The port mapping in `docker-compose.swarm.yml` was incorrect, and the Redis service name resolution might have issues.

## Solution Steps

### Step 1: Fix Port Configuration

The issue was in `docker-compose.swarm.yml`:

**Before (WRONG):**
```yaml
redis:
  ports:
    - "6371:6379"  # External:Internal - WRONG PORT
```

**After (CORRECT):**
```yaml
redis:
  ports:
    - "6379:6379"  # Consistent port mapping
```

**In `.env.production`:**
```env
REDIS_URL=redis://redis:6379  # Use service name 'redis' and port 6379
```

### Step 2: Fix Memory Overcommit Warning

Run this on your Docker Swarm manager node:

```bash
# Enable memory overcommit
sudo sysctl vm.overcommit_memory=1
echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf

# Increase TCP backlog
sudo sysctl -w net.core.somaxconn=511
echo "net.core.somaxconn = 511" | sudo tee -a /etc/sysctl.conf

# Disable Transparent Huge Pages
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/defrag
```

Or use the provided script:
```bash
bash fix-redis-warnings.sh
```

### Step 3: Redeploy Stack

```bash
# Remove old stack
docker stack rm tolen-pos

# Wait for cleanup (30 seconds)
sleep 30

# Deploy new stack
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

### Step 4: Verify Redis Connection

```bash
# Check Redis service status
docker service ls | grep redis

# Check Redis logs
docker service logs tolen-pos_redis

# Check Strapi logs for Redis connection
docker service logs tolen-pos_strapi | grep Redis
```

You should see:
```
[Redis Pub] Connected
[Redis Sub] Connected
[Redis State] Connected
[SocketIO] Redis adapter configured successfully
```

## Common Issues and Solutions

### Issue 1: Service Name Resolution

**Problem:** Can't resolve 'redis' hostname

**Solution:** In Docker Swarm, services communicate via overlay network. Ensure:
```yaml
# In docker-compose.swarm.yml
services:
  strapi:
    depends_on:
      - redis  # This ensures network connectivity
```

**Test connection:**
```bash
# Get Strapi container ID
docker ps | grep strapi

# Test Redis connection from Strapi container
docker exec <strapi_container_id> ping redis
docker exec <strapi_container_id> nc -zv redis 6379
```

### Issue 2: Wrong IP Address

**Problem:** Connecting to `10.0.7.15:6371` instead of `redis:6379`

**Cause:** Environment variable not loaded or cached

**Solution:**
```bash
# Verify environment variable in running container
docker exec <strapi_container_id> env | grep REDIS

# Should show:
# REDIS_URL=redis://redis:6379
# ENABLE_REDIS_ADAPTER=true

# If not, rebuild and redeploy
docker stack rm tolen-pos
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

### Issue 3: Redis Not Ready

**Problem:** Redis service exists but not accepting connections

**Solution:**
```bash
# Check Redis service status
docker service ps tolen-pos_redis

# Check if Redis is listening
docker exec <redis_container_id> redis-cli ping
# Should return: PONG

# Check Redis info
docker exec <redis_container_id> redis-cli INFO server
```

### Issue 4: Network Issues

**Problem:** Services can't communicate

**Solution:**
```bash
# List networks
docker network ls

# Inspect overlay network
docker network inspect <network_name>

# Ensure both services are on same network
docker service inspect tolen-pos_strapi | grep -A 10 Networks
docker service inspect tolen-pos_redis | grep -A 10 Networks
```

## Verification Checklist

After deployment, verify:

- [ ] Redis service is running: `docker service ls | grep redis`
- [ ] Redis is healthy: `docker service ps tolen-pos_redis`
- [ ] No warnings in Redis logs: `docker service logs tolen-pos_redis`
- [ ] Strapi connects to Redis: `docker service logs tolen-pos_strapi | grep "Redis.*Connected"`
- [ ] Redis adapter configured: `docker service logs tolen-pos_strapi | grep "Redis adapter configured"`
- [ ] No connection errors: `docker service logs tolen-pos_strapi | grep ECONNREFUSED`

## Testing Redis Connection

### Test 1: Direct Connection
```bash
# Get Redis container ID
REDIS_CONTAINER=$(docker ps | grep redis | awk '{print $1}')

# Connect to Redis CLI
docker exec -it $REDIS_CONTAINER redis-cli

# Test commands
> PING
PONG
> SET test "hello"
OK
> GET test
"hello"
> DEL test
(integer) 1
> QUIT
```

### Test 2: From Strapi Container
```bash
# Get Strapi container ID
STRAPI_CONTAINER=$(docker ps | grep strapi | head -1 | awk '{print $1}')

# Test DNS resolution
docker exec $STRAPI_CONTAINER nslookup redis

# Test port connectivity
docker exec $STRAPI_CONTAINER nc -zv redis 6379
```

### Test 3: Application Level
```bash
# Watch Strapi logs for Redis events
docker service logs -f tolen-pos_strapi | grep -i redis

# You should see:
# [Redis] Connecting to Redis at redis://redis:6379
# [Redis Pub] Connected
# [Redis Sub] Connected
# [Redis State] Connected
# [SocketIO] Redis adapter configured successfully
```

## Monitoring Redis

### Check Redis Memory Usage
```bash
docker exec <redis_container_id> redis-cli INFO memory
```

### Check Connected Clients
```bash
docker exec <redis_container_id> redis-cli CLIENT LIST
```

### Check Pub/Sub Channels
```bash
docker exec <redis_container_id> redis-cli PUBSUB CHANNELS
```

### Check Pending Requests
```bash
docker exec <redis_container_id> redis-cli KEYS "pending_request:*"
```

## Emergency Rollback

If Redis causes issues, you can temporarily disable it:

### Option 1: Disable Redis Adapter
```bash
# Edit .env.production
ENABLE_REDIS_ADAPTER=false

# Redeploy
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

### Option 2: Scale to Single Replica
```bash
# Scale down to 1 replica (no Redis needed)
docker service scale tolen-pos_strapi=1
```

## Getting Help

If issues persist:

1. **Collect logs:**
   ```bash
   docker service logs tolen-pos_redis > redis.log
   docker service logs tolen-pos_strapi > strapi.log
   ```

2. **Check service status:**
   ```bash
   docker service ps tolen-pos_redis --no-trunc
   docker service ps tolen-pos_strapi --no-trunc
   ```

3. **Inspect services:**
   ```bash
   docker service inspect tolen-pos_redis
   docker service inspect tolen-pos_strapi
   ```

4. **Check network:**
   ```bash
   docker network ls
   docker network inspect <network_name>
   ```

## Quick Fix Commands

```bash
# Complete reset and redeploy
docker stack rm tolen-pos
sleep 30
docker stack deploy -c docker-compose.swarm.yml tolen-pos

# Watch deployment
watch docker service ls

# Follow logs
docker service logs -f tolen-pos_strapi
```