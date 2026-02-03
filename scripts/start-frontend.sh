#!/bin/bash
# scripts/start-frontend.sh

# Get the absolute path to the project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Starting Frontend..."
cd "$PROJECT_ROOT"
npm run dev
