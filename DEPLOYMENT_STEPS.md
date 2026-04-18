# Deployment Steps - Complete Guide

## Prerequisites

Make sure these files are on your server in the project directory:

```
/path/to/your/project/
├── docker-compose.swarm.yml  ✅ Required
├── .env.production            ✅ Required
├── redis.conf                 ⚠️  Optional (see below)
├── Dockerfile                 ✅ Required
├── package.json               ✅ Required
└── src/                       ✅ Required
```

## Option 1: Deploy WITH redis.conf (Recommended)

### Step 1: Create redis.conf on Server

```bash
# SSH to your server
ssh your-server

# Navigate to project directory
cd /path/to/your/project

# Create redis.conf
cat > redis.conf << 'EOF'
# Redis Configuration for Tolen POS Backend
bind 0.0.0.0
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

maxmemory 256mb
maxmemory-policy allkeys-lru
maxmemory-samples 5

appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

loglevel notice
logfile ""

slowlog-log-slower-than 10000
slowlog-max-len 128

maxclients 10000

rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
EOF

# Verify
ls -la redis.conf
```

### Step 2: Fix System Configuration

```bash
# Enable memory overcommit
sudo sysctl vm.overcommit_memory=1
echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf

# Increase TCP backlog
sudo sysctl -w net.core.somaxconn=511
echo "net.core.somaxconn = 511" | sudo tee -a /etc/sysctl.conf
```

### Step 3: Deploy

```bash
# Remove old stack
docker stack rm tolen-pos

# Wait for cleanup
sleep 30

# Deploy with redis.conf
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

## Option 2: Deploy WITHOUT redis.conf (Simpler)

If you don't want to create `redis.conf`, use the simpler version:

### Step 1: Use Simple Docker Compose

```bash
# SSH to your server
ssh your-server

# Navigate to project directory
cd /path/to/your/project

# Use the simple version (no redis.conf needed)
docker stack deploy -c docker-compose.swarm.simple.yml tolen-pos
```

**Note:** The simple version uses command-line arguments instead of a config file. It works fine but has fewer optimizations.

### Step 2: Fix System Configuration (Same as Option 1)

```bash
sudo sysctl vm.overcommit_memory=1
sudo sysctl -w net.core.somaxconn=511
```

## Verification Steps (Both Options)

### Step 1: Check Services

```bash
# Wait 1-2 minutes for services to start
docker service ls

# Expected output:
# NAME                      MODE         REPLICAS   IMAGE
# tolen-pos_strapi          replicated   3/3        mosonata/tolen-pos-api
# tolen-pos_tolenPosDb      replicated   1/1        postgres:latest
# tolen-pos_tolenPosRedis   replicated   1/1        redis:7-alpine
```

### Step 2: Check Redis Logs

```bash
docker service logs tolen-pos_tolenPosRedis

# Should see:
# ✅ Ready to accept connections tcp
# ✅ No "Memory overcommit" warning
```

### Step 3: Check Strapi Connection

```bash
docker service logs tolen-pos_strapi | grep -i redis

# Should see:
# ✅ [Redis Pub] Connected
# ✅ [Redis Sub] Connected
# ✅ [Redis State] Connected
# ✅ [SocketIO] Redis adapter configured successfully
```

### Step 4: Test Application

```bash
# Check Strapi is responding
curl http://localhost:1334/_health

# Or from outside
curl http://your-server-ip:1334/_health
```

## Troubleshooting

### Issue: redis.conf not found

**Error:**
```
bind source path does not exist: /path/to/your/project/redis.conf
```

**Solution 1:** Create redis.conf (see Option 1 above)

**Solution 2:** Use simple version without redis.conf:
```bash
docker stack deploy -c docker-compose.swarm.simple.yml tolen-pos
```

### Issue: Permission denied on redis.conf

**Error:**
```
permission denied
```

**Solution:**
```bash
# Fix permissions
chmod 644 redis.conf

# Verify
ls -la redis.conf
# Should show: -rw-r--r--
```

### Issue: Still getting ECONNREFUSED

**Check 1: Verify .env.production**
```bash
cat .env.production | grep REDIS

# Should show:
# REDIS_URL=redis://tolenPosRedis:6379
# ENABLE_REDIS_ADAPTER=true
```

**Check 2: Verify service is running**
```bash
docker service ps tolen-pos_tolenPosRedis

# Should show: Running
```

**Check 3: Test connection**
```bash
# Get Strapi container
STRAPI=$(docker ps | grep strapi | head -1 | awk '{print $1}')

# Test connection
docker exec $STRAPI nc -zv tolenPosRedis 6379

# Should show: Connection succeeded
```

## File Checklist

Before deploying, verify these files exist on your server:

```bash
cd /path/to/your/project

# Check required files
ls -la docker-compose.swarm.yml  # ✅ Must exist
ls -la .env.production            # ✅ Must exist
ls -la Dockerfile                 # ✅ Must exist
ls -la package.json               # ✅ Must exist

# Check optional file
ls -la redis.conf                 # ⚠️  Optional (use simple version if missing)
```

## Quick Commands Reference

```bash
# Deploy with redis.conf
docker stack deploy -c docker-compose.swarm.yml tolen-pos

# Deploy without redis.conf (simpler)
docker stack deploy -c docker-compose.swarm.simple.yml tolen-pos

# Check services
docker service ls

# Check logs
docker service logs tolen-pos_strapi
docker service logs tolen-pos_tolenPosRedis

# Remove stack
docker stack rm tolen-pos

# Check running containers
docker ps

# Follow Strapi logs
docker service logs -f tolen-pos_strapi
```

## Summary

**With redis.conf (Recommended):**
- Better performance
- More control
- Production-ready
- Requires creating redis.conf file

**Without redis.conf (Simpler):**
- Easier to deploy
- No extra files needed
- Good enough for most cases
- Use `docker-compose.swarm.simple.yml`

Choose the option that works best for you!