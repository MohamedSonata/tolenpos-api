# Redis Multi-Replica Deployment Checklist

## Pre-Deployment

### 1. System Configuration (Run on Docker Swarm Manager Node)

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

Or use the script:
```bash
bash fix-redis-warnings.sh
```

### 2. Verify Configuration Files

- [ ] `docker-compose.swarm.yml` - Redis port is `6379:6379`
- [ ] `.env.production` - `REDIS_URL=redis://redis:6379`
- [ ] `.env.production` - `ENABLE_REDIS_ADAPTER=true`
- [ ] `redis.conf` - Configuration file exists

### 3. Backup Current State

```bash
# Backup database
docker exec <postgres_container> pg_dump -U tolenpos tolen_pos_db > backup_$(date +%Y%m%d).sql

# Backup environment
cp .env.production .env.production.backup

# Backup docker-compose
cp docker-compose.swarm.yml docker-compose.swarm.yml.backup
```

## Deployment Steps

### Step 1: Remove Old Stack

```bash
# Remove existing stack
docker stack rm tolen-pos

# Wait for complete cleanup
sleep 30

# Verify removal
docker service ls
docker ps | grep tolen
```

### Step 2: Deploy New Stack

```bash
# Deploy with new configuration
docker stack deploy -c docker-compose.swarm.yml tolen-pos

# Watch deployment progress
watch docker service ls
```

Expected output:
```
NAME                MODE         REPLICAS   IMAGE
tolen-pos_redis     replicated   1/1        redis:7-alpine
tolen-pos_strapi    replicated   3/3        mosonata/tolen-pos-api
tolen-pos_tolenPosDb replicated  1/1        postgres:latest
```

### Step 3: Verify Services

```bash
# Check all services are running
docker service ls

# Check service details
docker service ps tolen-pos_redis
docker service ps tolen-pos_strapi
docker service ps tolen-pos_tolenPosDb
```

### Step 4: Check Redis Logs

```bash
# Check Redis logs (should have NO warnings)
docker service logs tolen-pos_redis

# Expected: No memory overcommit warning
# Expected: "Ready to accept connections"
```

✅ **Success criteria:**
- No "Memory overcommit must be enabled" warning
- Shows "Ready to accept connections tcp"
- No error messages

### Step 5: Check Strapi Logs

```bash
# Check Strapi logs for Redis connection
docker service logs tolen-pos_strapi | grep -i redis

# Or follow live logs
docker service logs -f tolen-pos_strapi | grep -i redis
```

✅ **Success criteria:**
```
[Redis] Connecting to Redis at redis://redis:6379
[Redis Pub] Connected
[Redis Pub] Ready
[Redis Sub] Connected
[Redis Sub] Ready
[Redis State] Connected
[Redis State] Ready
[SocketIO] Redis adapter configured successfully
[SocketIO] Multi-replica mode enabled with Redis
```

❌ **Failure indicators:**
```
[Redis] Error: connect ECONNREFUSED
[Redis] Reconnecting in Xms
```

### Step 6: Test Socket.IO Functionality

#### Test 1: Mobile App Connection
```bash
# Watch for mobile connections
docker service logs -f tolen-pos_strapi | grep "Mobile"

# Expected when mobile app connects:
# [ConnectionHandler] New connection User ID: <id>, Client Type: mobile
# [SocketManager] Socket <id> joined room user:<documentId>
# [SocketManager] Socket <id> joined seats room user:<documentId>:seats
```

#### Test 2: POS Connection
```bash
# Watch for POS connections
docker service logs -f tolen-pos_strapi | grep "POS"

# Expected when POS connects:
# [ConnectionHandler] New connection User ID: <id>, Client Type: pos
# [SocketManager] Socket <id> joined POS room pos:<keySeatId>
```

#### Test 3: Cross-Replica Event Delivery
```bash
# Have POS send seat update
# Watch mobile app receive it
# They might be on different replicas - should still work!

docker service logs -f tolen-pos_strapi | grep "SeatUpdate"

# Expected:
# [SeatUpdateHandler] Processing seat update for <keySeatId>
# [SeatUpdateHandler] Notified mobile apps in room user:<documentId>:seats
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Redis health
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli PING
# Expected: PONG

# Check Redis info
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli INFO server

# Check connected clients
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli CLIENT LIST
```

### 2. Application Tests

- [ ] Mobile app can connect
- [ ] POS can connect
- [ ] Seat updates are received by mobile app
- [ ] Telemetry queries work
- [ ] Plan updates broadcast to all POS machines
- [ ] No errors in logs

### 3. Performance Checks

```bash
# Check Redis latency
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli --latency

# Check memory usage
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli INFO memory

# Check Strapi memory usage
docker stats --no-stream | grep strapi
```

### 4. Monitoring Setup

```bash
# Set up log monitoring
docker service logs -f tolen-pos_strapi > /var/log/strapi.log &
docker service logs -f tolen-pos_redis > /var/log/redis.log &

# Set up alerts (example with simple script)
cat > /usr/local/bin/check-redis.sh << 'EOF'
#!/bin/bash
if ! docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli PING > /dev/null 2>&1; then
  echo "ALERT: Redis is down!" | mail -s "Redis Alert" admin@example.com
fi
EOF
chmod +x /usr/local/bin/check-redis.sh

# Add to crontab (check every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/check-redis.sh") | crontab -
```

## Rollback Plan

If something goes wrong:

### Quick Rollback (Disable Redis)

```bash
# Edit .env.production
nano .env.production
# Change: ENABLE_REDIS_ADAPTER=false

# Redeploy
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

### Full Rollback (Restore Backup)

```bash
# Remove current stack
docker stack rm tolen-pos
sleep 30

# Restore backup files
cp .env.production.backup .env.production
cp docker-compose.swarm.yml.backup docker-compose.swarm.yml

# Redeploy old version
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

## Troubleshooting

### Issue: Connection Refused

```bash
# Check Redis is running
docker service ps tolen-pos_redis

# Check Redis logs
docker service logs tolen-pos_redis

# Test connection from Strapi
docker exec $(docker ps | grep strapi | head -1 | awk '{print $1}') nc -zv redis 6379
```

See `REDIS_TROUBLESHOOTING.md` for detailed troubleshooting steps.

### Issue: High Memory Usage

```bash
# Check Redis memory
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli INFO memory

# Check pending requests
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli KEYS "pending_request:*"

# Clear if needed (only in emergency)
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli FLUSHDB
```

### Issue: Events Not Delivered

```bash
# Check room membership
docker service logs tolen-pos_strapi | grep "joined room"

# Check event emissions
docker service logs tolen-pos_strapi | grep "Notified"

# Verify Redis adapter is active
docker service logs tolen-pos_strapi | grep "Redis adapter configured"
```

## Success Criteria

✅ All checks passed:

- [ ] No Redis warnings in logs
- [ ] All 3 Strapi replicas running
- [ ] Redis connected to all replicas
- [ ] Mobile app can connect
- [ ] POS can connect
- [ ] Events delivered across replicas
- [ ] No ECONNREFUSED errors
- [ ] Memory usage stable
- [ ] Latency < 50ms

## Maintenance

### Daily Checks

```bash
# Check service health
docker service ls

# Check for errors
docker service logs --since 24h tolen-pos_strapi | grep -i error
docker service logs --since 24h tolen-pos_redis | grep -i error
```

### Weekly Checks

```bash
# Check Redis memory usage
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli INFO memory

# Check connected clients
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli CLIENT LIST | wc -l

# Check pending requests (should be low)
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli KEYS "pending_request:*" | wc -l
```

### Monthly Checks

```bash
# Review logs for patterns
docker service logs --since 720h tolen-pos_strapi | grep -i redis > redis_monthly.log

# Check Redis persistence
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli LASTSAVE

# Backup Redis data
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli BGSAVE
```

## Contact

For issues or questions, refer to:
- `REDIS_TROUBLESHOOTING.md` - Detailed troubleshooting
- `SOLUTION_SUMMARY.md` - Architecture overview
- `DEPLOYMENT_GUIDE_MULTI_REPLICA.md` - Comprehensive deployment guide