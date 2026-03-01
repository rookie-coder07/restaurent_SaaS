#!/bin/bash
# Build script that sets environment variables before Vite build
set -e

echo "🏗️  Building with environment variables..."
echo "VITE_FRONTEND_URL=${VITE_FRONTEND_URL:-not set}"
echo "VITE_API_BASE_URL=${VITE_API_BASE_URL:-not set}"

# Ensure environment variables are set
export VITE_FRONTEND_URL="${VITE_FRONTEND_URL:-https://resturant-saas-1.onrender.com}"
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://resturant-saas.onrender.com/api}"
export NODE_ENV=production

npm install
npm run build

echo "✅ Build complete"
