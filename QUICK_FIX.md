# Quick Fix for Redis Connection Issue

## Problem
```
Error: connect ECONNREFUSED 10.0.7.15:6371
```

## Root Cause
Port mismatch in `docker-compose.swarm.yml` - was using port `6371` instead of `6379`.

## Solution (5 Minutes)

### Step 1: Fix System Configuration (On Docker Swarm Manager Node)

```bash
# Run these commands on your server
sudo sysctl vm.overcommit_memory=1
echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf

sudo sysctl -w net.core.somaxconn=511
echo "net.core.somaxconn = 511" | sudo tee -a /etc/sysctl.conf
```

### Step 2: Verify Configuration Files

Your files have been updated:
- ✅ `docker-compose.swarm.yml` - Redis port fixed to `6379:6379`
- ✅ `redis.conf` - Created with optimal settings
- ✅ `.env.production` - Already has correct `REDIS_URL=redis://redis:6379`

### Step 3: Redeploy

```bash
# Remove old stack
docker stack rm tolen-pos

# Wait for cleanup
sleep 30

# Deploy new stack
docker stack deploy -c docker-compose.swarm.yml tolen-pos

# Watch deployment
watch docker service ls
```

### Step 4: Verify (2 Minutes)

```bash
# Check Redis logs (should have NO warnings)
docker service logs tolen-pos_redis

# Check Strapi connection to Redis
docker service logs tolen-pos_strapi | grep -i redis
```

**Expected output:**
```
[Redis Pub] Connected
[Redis Sub] Connected
[Redis State] Connected
[SocketIO] Redis adapter configured successfully
```

## What Changed

### Before (Broken)
```yaml
redis:
  ports:
    - "6371:6379"  # ❌ Wrong port
```

### After (Fixed)
```yaml
redis:
  ports:
    - "6379:6379"  # ✅ Correct port
  volumes:
    - ./redis.conf:/usr/local/etc/redis/redis.conf:ro  # ✅ Added config
  command: redis-server /usr/local/etc/redis/redis.conf  # ✅ Use config
```

## Verification Commands

```bash
# 1. Check Redis is running
docker service ps tolen-pos_redis

# 2. Test Redis connection
docker exec $(docker ps | grep redis | awk '{print $1}') redis-cli PING
# Should return: PONG

# 3. Check Strapi logs for errors
docker service logs tolen-pos_strapi | grep -i "error\|refused"
# Should be empty or minimal

# 4. Test Socket.IO (connect mobile app or POS)
docker service logs -f tolen-pos_strapi | grep "ConnectionHandler"
# Should show successful connections
```

## If Still Having Issues

See detailed troubleshooting: `REDIS_TROUBLESHOOTING.md`

Or quick rollback:
```bash
# Disable Redis temporarily
# Edit .env.production: ENABLE_REDIS_ADAPTER=false
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

## Files Created/Updated

- ✅ `docker-compose.swarm.yml` - Fixed Redis port and added config
- ✅ `redis.conf` - Redis configuration file
- ✅ `fix-redis-warnings.sh` - System configuration script
- ✅ `REDIS_TROUBLESHOOTING.md` - Detailed troubleshooting guide
- ✅ `DEPLOYMENT_CHECKLIST.md` - Complete deployment checklist
- ✅ `QUICK_FIX.md` - This file

## Next Steps

1. Run the commands above
2. Verify Redis connection works
3. Test your mobile app and POS
4. Monitor logs for 24 hours
5. Set up monitoring (see `DEPLOYMENT_CHECKLIST.md`)

## Support

If you encounter any issues:
1. Check `REDIS_TROUBLESHOOTING.md`
2. Review logs: `docker service logs tolen-pos_strapi`
3. Check Redis: `docker service logs tolen-pos_redis`