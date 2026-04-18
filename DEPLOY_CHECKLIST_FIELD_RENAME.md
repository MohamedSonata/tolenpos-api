# Deployment Checklist: socketConnectionStatus Field Rename

## Pre-Deployment

- [x] Updated user schema: `isConnected` → `socketConnectionStatus`
- [x] Updated connection.handler.ts: All user references updated
- [x] Verified key-seat `isConnected` unchanged (no conflict)
- [x] Created documentation

## Deployment Steps

### 1. Commit and Push
```bash
git status
# Should show:
# - src/extensions/users-permissions/content-types/user/schema.json
# - src/socketio/connection.handler.ts

git add src/extensions/users-permissions/content-types/user/schema.json
git add src/socketio/connection.handler.ts
git commit -m "fix: rename user isConnected to socketConnectionStatus to avoid migration conflict"
git push origin main
```

### 2. Deploy to Production
```bash
# If using Docker Swarm
docker service update --force tolen-pos-backend

# If using docker-compose
docker-compose up -d --build
```

### 3. Monitor Deployment
```bash
# Watch logs for startup
docker service logs -f tolen-pos-backend

# Look for:
# ✅ "Strapi started successfully"
# ❌ Should NOT see "column already exists" error
```

### 4. Verify Database
```bash
# Connect to database
docker exec -it tolenPosDb psql -U tolenpos -d tolen_pos_db

# Check new column exists
\d up_users

# Should see:
# socket_connection_status | boolean | default false
```

### 5. Test Functionality
- [ ] Mobile app can connect via Socket.IO
- [ ] User `socketConnectionStatus` updates to `true` on connection
- [ ] User `socketConnectionStatus` updates to `false` on disconnection
- [ ] No errors in Strapi logs

## Post-Deployment (Optional)

### Cleanup Old Column (After Verification)
```sql
-- Only after confirming everything works
ALTER TABLE up_users DROP COLUMN IF EXISTS is_connected;
```

## Rollback Plan

If deployment fails:

```bash
# Revert commit
git revert HEAD
git push origin main

# Redeploy
docker service update --force tolen-pos-backend
```

Then investigate using `FIX_IS_CONNECTED_COLUMN_ERROR.md`.

## Success Criteria

✅ Strapi starts without migration errors
✅ New `socket_connection_status` column exists in database
✅ Socket connections work correctly
✅ User connection status updates properly
✅ No errors in production logs

## Timeline

- **Estimated downtime:** ~2-3 minutes (during restart)
- **Rollback time:** ~2 minutes if needed

## Contacts

- **Developer:** [Your name]
- **Date:** April 19, 2026
- **Issue:** Migration conflict with `is_connected` column
- **Solution:** Renamed to `socketConnectionStatus`
