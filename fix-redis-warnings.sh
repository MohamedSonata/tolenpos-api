#!/bin/bash

# Fix Redis Warnings Script
# Run this on your Docker Swarm manager node to fix Redis warnings

echo "==================================="
echo "Fixing Redis Configuration Warnings"
echo "==================================="

# Fix 1: Enable memory overcommit
echo ""
echo "1. Enabling memory overcommit..."
sudo sysctl vm.overcommit_memory=1
echo "vm.overcommit_memory = 1" | sudo tee -a /etc/sysctl.conf

# Fix 2: Increase TCP backlog
echo ""
echo "2. Increasing TCP backlog..."
sudo sysctl -w net.core.somaxconn=511
echo "net.core.somaxconn = 511" | sudo tee -a /etc/sysctl.conf

# Fix 3: Disable Transparent Huge Pages (THP)
echo ""
echo "3. Disabling Transparent Huge Pages..."
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/defrag

# Make THP changes persistent
cat << 'EOF' | sudo tee /etc/rc.local
#!/bin/sh
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag
exit 0
EOF
sudo chmod +x /etc/rc.local

echo ""
echo "==================================="
echo "✅ Redis configuration fixed!"
echo "==================================="
echo ""
echo "Changes applied:"
echo "  - Memory overcommit enabled"
echo "  - TCP backlog increased to 511"
echo "  - Transparent Huge Pages disabled"
echo ""
echo "These changes are now persistent across reboots."
echo ""
echo "Next steps:"
echo "  1. Redeploy your stack: docker stack deploy -c docker-compose.swarm.yml tolen-pos"
echo "  2. Check Redis logs: docker service logs tolen-pos_redis"
echo "  3. Verify no warnings appear"
echo ""