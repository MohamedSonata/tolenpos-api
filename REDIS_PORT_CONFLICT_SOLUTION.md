# Redis Port Conflict Solution

## Problem
You already have a Redis instance running on port 6379 for another service, so we can't use the same port for this project.

## Solution
Create a **dedicated Redis instance** for this project with:
- **Unique service name**: `tolenPosRedis` (instead of `redis`)
- **Different external port**: `6380` (instead of `6379`)
- **Same internal port**: `6379` (Docker internal)

## How It Works

### Port Mapping Explained
```yaml
ports:
  - "6380:6379"
    ↑      ↑
    |      └─ Internal port (inside Docker container)
    └──────── External port (on host machine)
```

- **External port 6380**: Accessible from host machine (avoids conflict with existing Redis on 6379)
- **Internal port 6379**: Used by containers to communicate with each other

### Service Communication
```
┌─────────────────────────────────────────────────┐
│              Docker Swarm Network               │
│                                                 │
│  ┌──────────┐                  ┌─────────────┐ │
│  │  Strapi  │──────────────────▶│tolenPosRedis│ │
│  │ Replicas │  redis://        │   :6379     │ │
│  │  1,2,3   │  tolenPosRedis   │             │ │
│  └──────────┘  :6379            └─────────────┘ │
│                                        │         │
└────────────────────────────────────────┼─────────┘
                                         │
                                    Port 6380
                                         │
                                   Host Machine
                                   (External Access)
```

## Configuration Changes

### 1. docker-compose.swarm.yml

**Changed:**
- Service name: `redis` → `tolenPosRedis`
- External port: `6379` → `6380`
- Volume name: `redis-data` → `tolen-pos-redis-data`

```yaml
services:
  strapi:
    depends_on:
      - tolenPosRedis  # ✅ New service name

  tolenPosRedis:  # ✅ Unique name
    image: redis:7-alpine
    ports:
      - "6380:6379"  # ✅ External:Internal - avoids conflict
    volumes:
      - tolen-pos-redis-data:/data  # ✅ Unique volume name
```

### 2. .env.production

**Changed:**
- Redis URL: `redis://redis:6379` → `redis://tolenPosRedis:6379`

```env
REDIS_URL=redis://tolenPosRedis:6379  # ✅ Use service name
ENABLE_REDIS_ADAPTER=true
```

**Important:** Use internal port `6379` in the URL because Strapi communicates with Redis **inside** the Docker network.

## Deployment Steps

### Step 1: Fix System Configuration (One-time setup)

```bash
# On your Docker Swarm manager node
sudo sysctl vm.overcommit_memory=1
echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf

sudo sysctl -w net.core.somaxconn=511
echo "net.core.somaxconn = 511" | sudo tee -a /etc/sysctl.conf
```

### Step 2: Deploy Stack

```bash
# Remove old stack
docker stack rm tolen-pos

# Wait for cleanup
sleep 30

# Deploy new stack
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

### Step 3: Verify Deployment

```bash
# Check all services are running
docker service ls

# Should show:
# tolen-pos_strapi         replicated   3/3
# tolen-pos_tolenPosDb     replicated   1/1
# tolen-pos_tolenPosRedis  replicated   1/1
```

### Step 4: Check Redis Logs

```bash
# Check Redis logs (should have NO warnings)
docker service logs tolen-pos_tolenPosRedis

# Expected output:
# Ready to accept connections tcp
# No "Memory overcommit" warning
```

### Step 5: Check Strapi Connection

```bash
# Check Strapi logs for Redis connection
docker service logs tolen-pos_strapi | grep -i redis

# Expected output:
# [Redis] Connecting to Redis at redis://tolenPosRedis:6379
# [Redis Pub] Connected
# [Redis Sub] Connected
# [Redis State] Connected
# [SocketIO] Redis adapter configured successfully
```

## Verification Tests

### Test 1: Check Both Redis Instances

```bash
# Check existing Redis (other service) - should still be running
docker ps | grep redis

# Should show TWO Redis containers:
# 1. Your existing Redis on port 6379
# 2. New tolenPosRedis on port 6380
```

### Test 2: Test Connection from Host

```bash
# Test existing Redis (port 6379)
redis-cli -h localhost -p 6379 PING
# Should return: PONG

# Test new Redis (port 6380)
redis-cli -h localhost -p 6380 PING
# Should return: PONG
```

### Test 3: Test Connection from Strapi Container

```bash
# Get Strapi container ID
STRAPI_CONTAINER=$(docker ps | grep strapi | head -1 | awk '{print $1}')

# Test connection to tolenPosRedis
docker exec $STRAPI_CONTAINER nc -zv tolenPosRedis 6379
# Should return: Connection to tolenPosRedis 6379 port [tcp/*] succeeded!
```

### Test 4: Verify No Interference

```bash
# Write to new Redis
docker exec $(docker ps | grep tolenPosRedis | awk '{print $1}') redis-cli SET test_tolen "hello"

# Read from new Redis
docker exec $(docker ps | grep tolenPosRedis | awk '{print $1}') redis-cli GET test_tolen
# Should return: "hello"

# Verify existing Redis is unaffected (if you have access)
# This should NOT have the test_tolen key
```

## Port Summary

| Service | Internal Port | External Port | Purpose |
|---------|--------------|---------------|---------|
| Existing Redis | 6379 | 6379 | Other service |
| tolenPosRedis | 6379 | 6380 | This project (Tolen POS) |
| Strapi | 1334 | 1334 | API Server |
| PostgreSQL | 5432 | 5439 | Database |

## Troubleshooting

### Issue: Still getting ECONNREFUSED

**Check 1: Verify service name**
```bash
docker service ps tolen-pos_tolenPosRedis
# Should show: Running
```

**Check 2: Verify environment variable**
```bash
docker exec $(docker ps | grep strapi | head -1 | awk '{print $1}') env | grep REDIS
# Should show: REDIS_URL=redis://tolenPosRedis:6379
```

**Check 3: Test DNS resolution**
```bash
docker exec $(docker ps | grep strapi | head -1 | awk '{print $1}') nslookup tolenPosRedis
# Should resolve to an IP address
```

### Issue: Port 6380 already in use

If port 6380 is also taken, change to another port:

```yaml
# In docker-compose.swarm.yml
tolenPosRedis:
  ports:
    - "6381:6379"  # Or any other available port
```

**Note:** You don't need to change the .env file because Strapi uses the internal port (6379).

### Issue: Can't access Redis from outside Docker

This is normal and expected. The Redis instance is only accessible:
- **Inside Docker network**: Using service name `tolenPosRedis:6379`
- **From host machine**: Using `localhost:6380`

If you need to access from host:
```bash
redis-cli -h localhost -p 6380
```

## Benefits of This Approach

✅ **No Conflicts**: Each service has its own Redis instance
✅ **Isolation**: Data is completely separate
✅ **Easy Management**: Clear service names
✅ **Scalable**: Can add more Redis instances if needed
✅ **No Impact**: Existing Redis service is unaffected

## Alternative: Shared Redis with Database Separation

If you want to use the existing Redis instead (not recommended):

```env
# In .env.production
REDIS_URL=redis://172.19.0.2:6379/1  # Use database 1 instead of 0
```

**Pros:**
- One less service to manage
- Saves memory

**Cons:**
- Shared resource (performance impact)
- Risk of key conflicts
- Harder to debug
- Not recommended for production

## Monitoring

### Check Redis Memory Usage

```bash
# For tolenPosRedis
docker exec $(docker ps | grep tolenPosRedis | awk '{print $1}') redis-cli INFO memory
```

### Check Connected Clients

```bash
# For tolenPosRedis
docker exec $(docker ps | grep tolenPosRedis | awk '{print $1}') redis-cli CLIENT LIST
```

### Check Keys

```bash
# For tolenPosRedis
docker exec $(docker ps | grep tolenPosRedis | awk '{print $1}') redis-cli KEYS "*"
```

## Summary

**What we did:**
1. Created a dedicated Redis instance named `tolenPosRedis`
2. Used external port `6380` to avoid conflict with existing Redis on `6379`
3. Updated Strapi to connect to `tolenPosRedis:6379` (internal port)

**Result:**
- ✅ No port conflicts
- ✅ Both Redis instances run independently
- ✅ Strapi connects successfully
- ✅ Multi-replica Socket.IO works across all replicas