#!/bin/bash

# Script to remove docker-compose files from Git tracking
# These files contain production secrets and should not be in the repository

echo "🔧 Removing docker-compose files from Git tracking..."
echo ""

# Remove from Git but keep locally
git rm --cached docker-compose.swarm.yml 2>/dev/null
git rm --cached docker-compose.swarm.simple.yml 2>/dev/null

echo ""
echo "✅ Files removed from Git tracking (but kept locally)"
echo ""
echo "📝 Next steps:"
echo "   1. git add .gitignore"
echo "   2. git commit -m 'chore: stop tracking docker-compose files (contain production secrets)'"
echo "   3. git push"
echo ""
echo "⚠️  Note: The files will be deleted from the remote repository"
echo "   but will remain on your local machine."
echo ""
echo "💡 Tip: Create docker-compose.example.yml files with placeholder values"
echo "   for documentation purposes."
