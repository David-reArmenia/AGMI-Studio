#!/bin/bash
# scripts/start-backend.sh

# Get the absolute path to the project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Starting Backend Server..."
cd "$PROJECT_ROOT/server"
npm run dev
