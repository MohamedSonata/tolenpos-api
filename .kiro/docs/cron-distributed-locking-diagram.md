# Cron Job Distributed Locking - Visual Guide

## Before: The Problem (3x Duplicate Execution)

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Swarm Cluster                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Replica 1   │  │  Replica 2   │  │  Replica 3   │      │
│  │              │  │              │  │              │      │
│  │  Strapi      │  │  Strapi      │  │  Strapi      │      │
│  │  Instance    │  │  Instance    │  │  Instance    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         │ Cron: 2:00 AM   │ Cron: 2:00 AM   │ Cron: 2:00 AM│
│         │ ⏰              │ ⏰              │ ⏰           │
│         ▼                 ▼                 ▼               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Create       │  │ Create       │  │ Create       │      │
│  │ Snapshot     │  │ Snapshot     │  │ Snapshot     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │              │
                    │  ❌ Record 1 │
                    │  ❌ Record 2 │  ← DUPLICATES!
                    │  ❌ Record 3 │
                    └──────────────┘

PROBLEM: All 3 replicas execute the same job independently
RESULT: 3x duplicate database records
```

## After: The Solution (Distributed Locking)

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Swarm Cluster                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Replica 1   │  │  Replica 2   │  │  Replica 3   │      │
│  │              │  │              │  │              │      │
│  │  Strapi      │  │  Strapi      │  │  Strapi      │      │
│  │  Instance    │  │  Instance    │  │  Instance    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         │ Cron: 2:00 AM   │ Cron: 2:00 AM   │ Cron: 2:00 AM│
│         │ ⏰              │ ⏰              │ ⏰           │
│         │                 │                 │               │
│         │ Try Lock        │ Try Lock        │ Try Lock      │
│         └─────────────────┼─────────────────┘               │
│                           ▼                                 │
│                   ┌──────────────┐                          │
│                   │    Redis     │                          │
│                   │              │                          │
│                   │  Lock Store  │                          │
│                   └──────┬───────┘                          │
│                          │                                  │
│                   ✅ Lock Acquired                          │
│                   by Replica 2                              │
│                          │                                  │
│         ❌ Failed        │         ❌ Failed                │
│         (Skip)           │         (Skip)                   │
│         │                ▼                │                 │
│  ┌──────┴───────┐  ┌──────────────┐  ┌──┴───────────┐     │
│  │ Log:         │  │ Create       │  │ Log:         │     │
│  │ "Lock held"  │  │ Snapshot     │  │ "Lock held"  │     │
│  │ Skip job     │  │ Execute!     │  │ Skip job     │     │
│  └──────────────┘  └──────┬───────┘  └──────────────┘     │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │              │
                    │  ✅ Record 1 │  ← SINGLE RECORD!
                    │              │
                    └──────────────┘

SOLUTION: Redis distributed lock ensures only ONE replica executes
RESULT: Single database record, no duplicates
```

## Lock Acquisition Flow

```
┌─────────────┐
│  Replica 1  │
│  Tries Lock │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Redis: SET cron:lock:job-name       │
│        VALUE: replica-1-token       │
│        NX (only if not exists)      │
│        EX 3600 (expire in 1 hour)   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Is lock already held?               │
└──────┬──────────────────────────────┘
       │
       ├─── NO ──────────────────────┐
       │                             │
       ▼                             ▼
┌─────────────┐              ┌─────────────┐
│ Return OK   │              │ Return NULL │
│ Lock        │              │ Lock        │
│ Acquired ✅ │              │ Failed ❌   │
└──────┬──────┘              └──────┬──────┘
       │                            │
       ▼                            ▼
┌─────────────┐              ┌─────────────┐
│ Execute Job │              │  Skip Job   │
│             │              │  Log: Held  │
└──────┬──────┘              └─────────────┘
       │
       ▼
┌─────────────┐
│ Release     │
│ Lock        │
└─────────────┘
```

## Lock Lifecycle

```
Time: 00:00:00 - Lock doesn't exist
          │
          ▼
Time: 02:00:00 - Cron triggers on all 3 replicas
          │
          ├─── Replica 1 tries: SET lock NX EX 3600
          ├─── Replica 2 tries: SET lock NX EX 3600  ← WINS!
          └─── Replica 3 tries: SET lock NX EX 3600
          │
          ▼
Time: 02:00:01 - Lock held by Replica 2
          │
          │     Replica 1: Skip (lock held)
          │     Replica 2: Execute job
          │     Replica 3: Skip (lock held)
          │
          ▼
Time: 02:00:45 - Job completes (45 seconds)
          │
          │     Replica 2: Release lock
          │
          ▼
Time: 02:00:46 - Lock released
          │
          ▼
Time: 03:00:00 - Next cron trigger (cycle repeats)
```

## Lock Expiry Protection

```
Scenario: Replica crashes during job execution

Time: 02:00:00 - Replica 2 acquires lock
          │
          ▼
Time: 02:15:00 - Replica 2 crashes! 💥
          │
          │     Lock still exists in Redis
          │     TTL: 45 minutes remaining
          │
          ▼
Time: 03:00:00 - Next cron trigger
          │
          │     All replicas try to acquire lock
          │     Lock still held (not expired yet)
          │     All replicas skip
          │
          ▼
Time: 03:00:00 - Lock expires (TTL reached)
          │
          │     Lock automatically deleted by Redis
          │
          ▼
Time: 04:00:00 - Next cron trigger
          │
          │     Replica 1 acquires lock ✅
          │     Job executes normally
          │
          ▼
System recovered automatically!
```

## Redis Lock Structure

```
Key:   cron:lock:daily-telemetry-snapshot
Value: strapi-replica-2-1234567890-0.123456
TTL:   3600 seconds (1 hour)

┌─────────────────────────────────────────────────────┐
│ Key Components:                                     │
│                                                     │
│ cron:lock:          ← Namespace (all cron locks)   │
│ daily-telemetry-    ← Job identifier               │
│ snapshot                                            │
│                                                     │
│ Value Components:                                   │
│                                                     │
│ strapi-replica-2    ← Hostname (which replica)     │
│ 1234567890          ← Timestamp (when acquired)    │
│ 0.123456            ← Random (uniqueness)          │
│                                                     │
│ TTL:                                                │
│                                                     │
│ 3600 seconds        ← Auto-expire after 1 hour     │
│                     ← Prevents deadlocks           │
└─────────────────────────────────────────────────────┘
```

## Comparison: Before vs After

```
┌──────────────────────┬─────────────────┬─────────────────┐
│      Metric          │     Before      │      After      │
├──────────────────────┼─────────────────┼─────────────────┤
│ Job Executions       │        3        │        1        │
│ Database Records     │        3        │        1        │
│ CPU Usage            │      300%       │      100%       │
│ Database Load        │      300%       │      100%       │
│ Duplicate Risk       │      High       │      None       │
│ Race Conditions      │    Possible     │   Prevented     │
│ Resource Waste       │      200%       │        0%       │
└──────────────────────┴─────────────────┴─────────────────┘
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              config/cron-tasks.ts                    │   │
│  │  Defines cron schedules and triggers                 │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         src/cron/jobs/daily-telemetry-snapshot.ts    │   │
│  │         src/cron/jobs/cleanup-old-snapshots.ts       │   │
│  │  Job implementations with lock protection            │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         src/cron/utils/distributed-lock.ts           │   │
│  │  Lock acquisition, release, and management           │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         src/socketio/redis-adapter.ts                │   │
│  │  Redis client setup and connection management        │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Redis Server                      │   │
│  │  Stores locks with automatic expiry                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Benefits Visualized

```
┌─────────────────────────────────────────────────────────────┐
│                    Benefits Summary                          │
│                                                              │
│  ✅ No Duplicates                                           │
│     ████████████████████████████████████████████ 100%       │
│                                                              │
│  ✅ Resource Efficiency                                     │
│     ████████████████████████████████████████████ 66% saved  │
│                                                              │
│  ✅ Data Consistency                                        │
│     ████████████████████████████████████████████ 100%       │
│                                                              │
│  ✅ Automatic Failover                                      │
│     ████████████████████████████████████████████ Yes        │
│                                                              │
│  ✅ Zero Configuration                                      │
│     ████████████████████████████████████████████ Uses Redis │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

This visual guide helps understand how distributed locking solves the Docker Swarm cron job duplication problem.
