# Quick Fix Without Rebuilding Image

## If You Need Immediate Fix Without Rebuild

### Option A: Drop the Column in Database (Fastest)

```bash
# 1. Connect to production database
docker exec -it tolenPosDb psql -U tolenpos -d tolen_pos_db

# 2. Drop the problematic column
ALTER TABLE up_users DROP COLUMN IF EXISTS is_connected;

# 3. Exit
\q

# 4. Restart Strapi (no rebuild needed)
docker service update --force tolen-pos-backend
```

**Result:** Strapi will recreate the `is_connected` column properly with correct metadata.

---

### Option B: Edit Schema in Running Container (Temporary Hack)

**⚠️ Warning:** This is a temporary hack. Changes will be lost on next deployment!

```bash
# 1. Find the container ID
docker ps | grep tolen-pos-backend

# 2. Access the container
docker exec -it <container-id> sh

# 3. Edit the schema file
vi src/extensions/users-permissions/content-types/user/schema.json

# 4. Remove the isConnected field (delete these lines):
#    "isConnected": {
#      "type": "boolean",
#      "default": false
#    }

# 5. Save and exit (:wq in vi)

# 6. Restart from outside container
docker service update --force tolen-pos-backend
```

**Result:** Strapi starts without trying to create the column.

---

## Recommended Approach

**Use Option A (Drop Column)** - It's:
- ✅ Fastest (2 minutes)
- ✅ No rebuild needed
- ✅ Permanent fix
- ✅ Strapi recreates column properly

Then later, when you have time:
1. Apply the field rename changes (socketConnectionStatus)
2. Rebuild and deploy properly
3. The new field will coexist with the old one (no conflict)

---

## Why Rebuild is Normally Required

Changes that need rebuild:
- ✅ TypeScript files (`.ts`) - need compilation
- ✅ Schema files (`.json`) - need to be in image
- ✅ Configuration files
- ✅ Dependencies (package.json)

Changes that DON'T need rebuild:
- ❌ Environment variables (`.env`)
- ❌ Database data
- ❌ Uploaded files

---

## Quick Decision Tree

```
Need immediate fix?
├─ YES → Drop column in database (Option A)
│         Then rebuild later with proper fix
│
└─ NO → Rebuild image with socketConnectionStatus rename
         (Proper, permanent solution)
```

---

## Commands Summary

### Immediate Fix (No Rebuild):
```bash
docker exec -it tolenPosDb psql -U tolenpos -d tolen_pos_db
ALTER TABLE up_users DROP COLUMN IF EXISTS is_connected;
\q
docker service update --force tolen-pos-backend
```

### Proper Fix (With Rebuild):
```bash
# Build
docker build -t your-registry/tolen-pos-backend:latest .

# Push
docker push your-registry/tolen-pos-backend:latest

# Deploy
docker service update --image your-registry/tolen-pos-backend:latest tolen-pos-backend
```
