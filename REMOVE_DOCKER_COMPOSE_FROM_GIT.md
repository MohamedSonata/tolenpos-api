# Remove Docker Compose Files from Git

## Problem
Docker Compose files contain production secrets (database passwords, ports, etc.) and were accidentally pushed to Git.

## Solution

### Step 1: Update .gitignore

Already done! The `.gitignore` now includes:
```
docker-compose.swarm.yml
docker-compose.swarm.simple.yml
docker-compose*.yml
```

### Step 2: Remove from Git Tracking

Run the provided script:

```bash
# Make script executable
chmod +x remove-docker-compose-from-git.sh

# Run it
./remove-docker-compose-from-git.sh
```

**Or manually:**

```bash
# Remove from Git but keep locally
git rm --cached docker-compose.swarm.yml
git rm --cached docker-compose.swarm.simple.yml

# Commit the changes
git add .gitignore
git commit -m "chore: stop tracking docker-compose files (contain production secrets)"

# Push
git push
```

### Step 3: Verify

```bash
# Check Git status
git status

# Should NOT show docker-compose files as modified
```

---

## What This Does

✅ **Removes from Git** - Files won't be tracked anymore
✅ **Keeps local files** - Your files stay on your machine
✅ **Future changes ignored** - Git will ignore future changes
✅ **Removes from remote** - Files deleted from GitHub/GitLab

---

## Example Files for Documentation

Created `docker-compose.swarm.example.yml` with placeholder values:
- ✅ Safe to commit (no secrets)
- ✅ Documents the structure
- ✅ Helps team members set up their own

---

## For Team Members

To set up docker-compose files:

```bash
# 1. Copy example file
cp docker-compose.swarm.example.yml docker-compose.swarm.yml

# 2. Update with your values
nano docker-compose.swarm.yml

# 3. Update image name, passwords, ports, etc.
```

---

## Security Best Practices

### Files to NEVER commit:
- ❌ `docker-compose.swarm.yml` (production config)
- ❌ `.env.production` (production secrets)
- ❌ `.env` (local secrets)
- ❌ `*firebase-adminsdk*.json` (Firebase keys)

### Files SAFE to commit:
- ✅ `docker-compose.swarm.example.yml` (with placeholders)
- ✅ `.env.example` (with placeholders)
- ✅ `Dockerfile` (no secrets)
- ✅ Documentation files

---

## If Files Already Exposed

If the files were already pushed and contain real secrets:

### 1. Rotate All Secrets Immediately

```bash
# Database password
# Redis password (if any)
# API keys
# JWT secrets
```

### 2. Update .env.production

Generate new secrets:

```bash
# Generate new APP_KEYS
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"

# Generate new JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Update database password
# Update other secrets
```

### 3. Redeploy with New Secrets

```bash
# Update .env.production with new secrets
# Rebuild and redeploy
docker stack deploy -c docker-compose.swarm.yml tolen-pos
```

---

## Verification Checklist

After running the removal:

- [ ] `git status` shows no docker-compose files
- [ ] Files still exist locally
- [ ] `.gitignore` includes docker-compose patterns
- [ ] Example file created with placeholders
- [ ] Changes committed and pushed
- [ ] Remote repository no longer shows the files

---

## Future Prevention

### Before Committing:

```bash
# Always check what you're committing
git status
git diff

# Look for sensitive files
git diff --cached | grep -i "password\|secret\|key"
```

### Use Pre-commit Hooks:

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Check for sensitive files
if git diff --cached --name-only | grep -E "docker-compose\.swarm\.yml|\.env\.production"; then
    echo "❌ ERROR: Attempting to commit sensitive files!"
    echo "   docker-compose.swarm.yml or .env.production"
    echo ""
    echo "   These files contain production secrets."
    echo "   Use .example files instead."
    exit 1
fi
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

## Summary

1. ✅ Updated `.gitignore`
2. ✅ Removed files from Git tracking
3. ✅ Created example files
4. ✅ Files remain on local machine
5. ✅ Future changes ignored

Your production secrets are now protected! 🔒
