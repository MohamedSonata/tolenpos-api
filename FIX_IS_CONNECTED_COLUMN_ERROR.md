# Fix: is_connected Column Already Exists Error

## Error Message
```
alter table "public"."up_users" add column "is_connected" boolean null 
- column "is_connected" of relation "up_users" already exists
```

## Root Cause
The `is_connected` column already exists in the production database, but Strapi's migration system is trying to add it again. This happens when:
- Manual database changes were made
- A previous migration partially completed
- Schema sync issues between environments

## Solution Options

### Option 1: Manual Database Fix (Recommended for Production)

**Step 1: Connect to your production database**

```bash
# SSH into your production server
ssh your-server

# Connect to PostgreSQL
docker exec -it tolenPosDb psql -U tolenpos -d tolen_pos_db
```

**Step 2: Check if column exists**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'up_users' 
  AND column_name = 'is_connected';
```

**Step 3: If column exists, check Strapi's metadata**

Strapi tracks schema changes in the `strapi_database_schema` table. The issue is that the column exists in the database but not in Strapi's metadata.

```sql
-- Check Strapi's schema metadata
SELECT * FROM strapi_database_schema 
WHERE name = 'plugin::users-permissions.user';
```

**Step 4: Fix the issue**

You have two approaches:

#### Approach A: Drop and let Strapi recreate (Safest)

```sql
-- ONLY if the column is not being used or has no important data
ALTER TABLE up_users DROP COLUMN IF EXISTS is_connected;
```

Then restart Strapi - it will recreate the column properly.

#### Approach B: Update Strapi's metadata (Advanced)

This tells Strapi that the column already exists:

```sql
-- Get the current schema JSON
SELECT schema FROM strapi_database_schema 
WHERE name = 'plugin::users-permissions.user';

-- You'll need to manually update the JSON to include is_connected
-- This is complex and error-prone, so Approach A is recommended
```

---

### Option 2: Temporary Workaround (Quick Fix)

If you can't access the database immediately, temporarily remove the field from the schema:

**Step 1: Comment out the field**

Edit `src/extensions/users-permissions/content-types/user/schema.json`:

```json
{
  "attributes": {
    // ... other fields ...
    
    // "isConnected": {
    //   "type": "boolean",
    //   "default": false
    // }
  }
}
```

**Step 2: Deploy and restart**

This will allow Strapi to start without the migration error.

**Step 3: Re-add the field later**

Once you've cleaned up the database, uncomment the field and redeploy.

---

### Option 3: Database Migration Script (Automated)

Create a migration script to handle this gracefully:

**Step 1: Create migration file**

```bash
# In your project root
mkdir -p database/migrations
```

**Step 2: Create migration script**

Create `database/migrations/fix-is-connected-column.js`:

```javascript
module.exports = {
  async up(knex) {
    // Check if column exists
    const hasColumn = await knex.schema.hasColumn('up_users', 'is_connected');
    
    if (!hasColumn) {
      // Only add if it doesn't exist
      await knex.schema.table('up_users', (table) => {
        table.boolean('is_connected').defaultTo(false);
      });
      console.log('✅ Added is_connected column');
    } else {
      console.log('⚠️  is_connected column already exists, skipping');
    }
  },

  async down(knex) {
    await knex.schema.table('up_users', (table) => {
      table.dropColumn('is_connected');
    });
  }
};
```

---

## Recommended Steps for Production

### Immediate Fix (Choose One):

**Option A: Drop the column** (if not critical)
```sql
ALTER TABLE up_users DROP COLUMN IF EXISTS is_connected;
```
Then restart Strapi.

**Option B: Keep the column** (if it has data)
1. Temporarily remove `isConnected` from schema.json
2. Deploy and restart
3. Manually sync the metadata later

### Long-term Prevention:

1. **Always use Strapi admin panel** to add fields (not manual SQL)
2. **Test schema changes** in development first
3. **Use database migrations** for complex changes
4. **Backup database** before schema changes

---

## Quick Command Reference

### Connect to Production Database:
```bash
# Via Docker
docker exec -it tolenPosDb psql -U tolenpos -d tolen_pos_db

# Direct connection
psql -h tolenPosDb -U tolenpos -d tolen_pos_db
```

### Check Column Exists:
```sql
\d up_users  -- Show table structure
```

### Drop Column (if safe):
```sql
ALTER TABLE up_users DROP COLUMN IF EXISTS is_connected;
```

### Restart Strapi:
```bash
# If using Docker Swarm
docker service update --force tolen-pos-backend

# If using docker-compose
docker-compose restart
```

---

## After Fix

Once fixed, verify:

1. ✅ Strapi starts without errors
2. ✅ `isConnected` field appears in admin panel
3. ✅ Database has `is_connected` column
4. ✅ No migration errors in logs

---

## Need Help?

If the issue persists:
1. Check Strapi logs: `docker logs <container-id>`
2. Check database schema: `\d up_users`
3. Check Strapi metadata: `SELECT * FROM strapi_database_schema;`
