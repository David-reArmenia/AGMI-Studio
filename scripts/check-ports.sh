#!/bin/bash
# scripts/check-ports.sh

echo "Checking ports 3001 (Backend) and 5173 (Frontend)..."
lsof -i :3001,:5173
