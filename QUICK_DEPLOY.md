# Quick Deploy Guide - Redis Port Conflict Fixed

## The Fix (30 seconds to understand)

**Problem:** Port 6379 already used by another Redis
**Solution:** New Redis on port 6380 with unique name `tolenPosRedis`

## Deploy Now (5 minutes)

### Step 1: System Config (one-time, on server)
```bash
sudo sysctl vm.overcommit_memory=1
sudo sysctl -w net.core.somaxconn=511
```

### Step 2: Deploy
```bash
docker stack rm tolen-pos
sleep 30
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

### Step 3: Verify (wait 1-2 minutes for services to start)
```bash
# Check services
docker service ls

# Check Redis connection
docker service logs tolen-pos_strapi | grep -i redis
```

## Expected Output

✅ **Success looks like:**
```
[Redis Pub] Connected
[Redis Sub] Connected
[Redis State] Connected
[SocketIO] Redis adapter configured successfully
```

❌ **Failure looks like:**
```
Error: connect ECONNREFUSED
```

## What Changed

| Before | After |
|--------|-------|
| Service: `redis` | Service: `tolenPosRedis` |
| Port: `6379:6379` | Port: `6380:6379` |
| URL: `redis://redis:6379` | URL: `redis://tolenPosRedis:6379` |

## Key Points

1. **Service Name**: `tolenPosRedis` (unique, won't conflict)
2. **External Port**: `6380` (host machine access)
3. **Internal Port**: `6379` (Docker network - used in .env)
4. **No Conflict**: Your existing Redis on 6379 is unaffected

## Files Changed

- ✅ `docker-compose.swarm.yml` - New service name and port
- ✅ `.env.production` - Updated Redis URL
- ✅ `redis.conf` - Redis configuration (already created)

## Quick Troubleshooting

**Still getting connection errors?**

```bash
# 1. Check service is running
docker service ps tolen-pos_tolenPosRedis

# 2. Check logs
docker service logs tolen-pos_tolenPosRedis

# 3. Test connection
docker exec $(docker ps | grep strapi | head -1 | awk '{print $1}') nc -zv tolenPosRedis 6379
```

**Need more help?**
- See `REDIS_PORT_CONFLICT_SOLUTION.md` for detailed explanation
- See `REDIS_TROUBLESHOOTING.md` for comprehensive troubleshooting

## That's It!

Your Strapi app now has its own Redis instance that won't conflict with your existing Redis service.