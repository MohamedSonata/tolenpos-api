# Architecture Diagram - Redis Setup

## Current Setup (After Fix)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Host Machine                              │
│                                                                  │
│  Port 6379 (Existing)          Port 6380 (New)                  │
│       │                              │                           │
│       ▼                              ▼                           │
│  ┌─────────────┐              ┌──────────────┐                  │
│  │   Redis     │              │tolenPosRedis │                  │
│  │ (Other App) │              │ (This App)   │                  │
│  └─────────────┘              └──────────────┘                  │
│                                      ▲                           │
│                                      │                           │
│                              Internal Port 6379                  │
│                                      │                           │
│  ┌───────────────────────────────────┴──────────────────────┐   │
│  │           Docker Swarm Network                           │   │
│  │                                                           │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │  Strapi Service (3 replicas)                     │    │   │
│  │  │                                                   │    │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │    │   │
│  │  │  │ Replica 1│  │ Replica 2│  │ Replica 3│       │    │   │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘       │    │   │
│  │  │       │             │             │              │    │   │
│  │  │       └─────────────┼─────────────┘              │    │   │
│  │  │                     │                            │    │   │
│  │  │         redis://tolenPosRedis:6379               │    │   │
│  │  │                     │                            │    │   │
│  │  └─────────────────────┼────────────────────────────┘    │   │
│  │                        │                                  │   │
│  │                        ▼                                  │   │
│  │              ┌──────────────────┐                         │   │
│  │              │  tolenPosRedis   │                         │   │
│  │              │  Internal: 6379  │                         │   │
│  │              │  External: 6380  │                         │   │
│  │              └──────────────────┘                         │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## How Communication Works

### Internal Communication (Inside Docker Network)
```
Strapi Replica 1 ──┐
                   │
Strapi Replica 2 ──┼──▶ redis://tolenPosRedis:6379 ──▶ tolenPosRedis
                   │                                     (Internal Port)
Strapi Replica 3 ──┘
```

### External Access (From Host Machine)
```
Your Terminal ──▶ localhost:6380 ──▶ tolenPosRedis
                                      (External Port)
```

## Port Mapping Explained

```
tolenPosRedis:
  ports:
    - "6380:6379"
       ↑      ↑
       |      └─── Internal Port (Docker network)
       |           - Used by Strapi containers
       |           - URL: redis://tolenPosRedis:6379
       |
       └────────── External Port (Host machine)
                   - Used for debugging/monitoring
                   - Access: redis-cli -h localhost -p 6380
```

## Why This Works

### 1. No Port Conflict
```
Host Machine Ports:
├── 6379 → Existing Redis (Other App) ✅
├── 6380 → tolenPosRedis (This App)   ✅
└── No Conflict! Both can run simultaneously
```

### 2. Service Isolation
```
Docker Network:
├── Existing Redis
│   └── Used by: Other App
│
└── tolenPosRedis
    └── Used by: Tolen POS Strapi
    
No data mixing, complete isolation ✅
```

### 3. Multi-Replica Communication
```
Event Flow Example:

1. POS (Replica 1) sends seat update
   └──▶ Strapi Replica 1 processes
        └──▶ Emits to Redis: tolenPosRedis:6379
             └──▶ Redis broadcasts to all replicas
                  ├──▶ Replica 1 ✅
                  ├──▶ Replica 2 ✅
                  └──▶ Replica 3 ✅
                       └──▶ Mobile App receives update ✅
```

## Service Names in Docker Swarm

```
Stack Name: tolen-pos

Services:
├── tolen-pos_strapi         (3 replicas)
├── tolen-pos_tolenPosDb     (1 replica)
└── tolen-pos_tolenPosRedis  (1 replica)

DNS Resolution:
├── strapi         → Resolves to all 3 Strapi replicas (load balanced)
├── tolenPosDb     → Resolves to PostgreSQL
└── tolenPosRedis  → Resolves to Redis
```

## Data Flow: Telemetry Query Example

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Mobile App sends telemetry query                          │
│    └──▶ Connects to Strapi (Replica 2)                       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Replica 2 stores pending request in Redis                 │
│    └──▶ redis://tolenPosRedis:6379                           │
│         SET pending_request:abc123 {...}                      │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Replica 2 emits query to POS room                         │
│    └──▶ io.to('pos:keySeatId').emit(...)                     │
│         └──▶ Redis broadcasts to all replicas                │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. POS receives query (connected to Replica 1)               │
│    └──▶ Processes and sends response                         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Replica 1 receives POS response                           │
│    └──▶ Gets pending request from Redis                      │
│         GET pending_request:abc123                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Replica 1 emits response to mobile room                   │
│    └──▶ io.to('mobile:socketId').emit(...)                   │
│         └──▶ Redis broadcasts to all replicas                │
│              └──▶ Replica 2 delivers to Mobile App ✅         │
└──────────────────────────────────────────────────────────────┘
```

## Key Takeaways

1. **Service Name**: `tolenPosRedis` is unique and won't conflict
2. **Internal Port**: Always `6379` (used in .env file)
3. **External Port**: `6380` (for host machine access)
4. **Redis Adapter**: Synchronizes events across all 3 Strapi replicas
5. **Room-Based**: Communication uses rooms, not socket IDs
6. **Shared State**: Pending requests stored in Redis, accessible by all replicas

## Comparison: Before vs After

### Before (Broken)
```
Strapi Replica 1 ──▶ Stores socket ID in DB
                     Tries to emit to socket ID
                     ❌ Fails if socket on different replica
```

### After (Fixed)
```
Strapi Replica 1 ──▶ Emits to room
                     └──▶ Redis broadcasts
                          └──▶ All replicas receive
                               └──▶ Correct replica delivers
                                    ✅ Always works!
```

## Network Diagram

```
                    Internet
                       │
                       ▼
                 Load Balancer
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   Replica 1      Replica 2      Replica 3
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ▼
                 tolenPosRedis
                  (Port 6379)
                       │
                       ▼
              Redis Pub/Sub Channels
              ├── socket.io#/#
              ├── socket.io-adapter#/#
              └── Pending Requests (Keys)
```

## Summary

✅ **Isolated**: Each app has its own Redis
✅ **No Conflicts**: Different ports (6379 vs 6380)
✅ **Scalable**: Add more replicas without code changes
✅ **Reliable**: Events work across all replicas
✅ **Simple**: Standard Docker networking