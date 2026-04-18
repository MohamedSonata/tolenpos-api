# Solution: Renamed isConnected to socketConnectionStatus

## Problem
The `isConnected` field in the `up_users` table already existed in production, causing a migration conflict:
```
column "is_connected" of relation "up_users" already exists
```

## Solution
Renamed the field from `isConnected` to `socketConnectionStatus` in the **User** schema only.

**Note:** The `isConnected` field in the **Key-Seat** schema remains unchanged (no conflict there).

---

## Changes Made

### 1. User Schema Updated
**File:** `src/extensions/users-permissions/content-types/user/schema.json`

```json
{
  "socketConnectionStatus": {
    "type": "boolean",
    "default": false
  }
}
```

**Database column:** `socket_connection_status` (will be created fresh)

### 2. Connection Handler Updated
**File:** `src/socketio/connection.handler.ts`

Updated all references from `isConnected` to `socketConnectionStatus` for **user** updates only:

- `updateUserSocketId()` - Sets `socketConnectionStatus: true` on connection
- `clearUserSocketId()` - Sets `socketConnectionStatus: false` on disconnection

**Key-seat's `isConnected` field remains unchanged** (no conflict).

---

## What Happens on Deploy

1. **Old column ignored:** The existing `is_connected` column in `up_users` will be ignored
2. **New column created:** Strapi will create `socket_connection_status` column
3. **No migration conflict:** Fresh column, no errors
4. **Clean start:** All users will have `socketConnectionStatus: false` initially

---

## Database Changes

### Before (Conflicting):
```sql
-- up_users table
is_connected BOOLEAN  -- Already exists, causing conflict
```

### After (Clean):
```sql
-- up_users table
is_connected BOOLEAN  -- Old column (ignored, can be dropped later)
socket_connection_status BOOLEAN  -- New column (created by Strapi)
```

---

## Optional Cleanup (Later)

Once deployed and verified working, you can optionally drop the old column:

```sql
-- Connect to production database
docker exec -it tolenPosDb psql -U tolenpos -d tolen_pos_db

-- Drop old column (optional)
ALTER TABLE up_users DROP COLUMN IF EXISTS is_connected;
```

This is **optional** - the old column won't cause any issues.

---

## Verification Steps

After deployment:

### 1. Check Strapi Starts Successfully
```bash
docker logs <container-id>
# Should see: "Strapi started successfully"
# Should NOT see: "column already exists" error
```

### 2. Check Database Schema
```sql
\d up_users
# Should see: socket_connection_status column
```

### 3. Test Socket Connection
- Connect a mobile app
- Check user record has `socketConnectionStatus: true`
- Disconnect
- Check user record has `socketConnectionStatus: false`

---

## Summary

✅ **User schema:** `isConnected` → `socketConnectionStatus`
✅ **Key-seat schema:** `isConnected` (unchanged, no conflict)
✅ **Connection handler:** Updated to use new field name
✅ **No migration conflict:** Fresh column name avoids existing column
✅ **Backward compatible:** Old column ignored, can be dropped later

---

## Deploy Instructions

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "fix: rename user isConnected to socketConnectionStatus to avoid migration conflict"
   git push
   ```

2. **Deploy to production:**
   ```bash
   # Your deployment process
   docker service update --force tolen-pos-backend
   ```

3. **Monitor logs:**
   ```bash
   docker service logs -f tolen-pos-backend
   ```

4. **Verify:** Should start without errors ✅

---

## Rollback Plan (If Needed)

If issues occur, revert the changes:

```bash
git revert HEAD
git push
# Redeploy
```

Then use the database fix approach from `FIX_IS_CONNECTED_COLUMN_ERROR.md`.
