#!/bin/bash
set -e

export VITE_FRONTEND_URL="${VITE_FRONTEND_URL:-https://resturant-saas-1.onrender.com}"
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://resturant-saas.onrender.com/api}"
export NODE_ENV=production

echo "Building frontend..."
npm install
npm run build

if [ ! -f dist/index.html ]; then
  echo "ERROR: Build failed - dist/index.html not found"
  exit 1
fi

echo "✅ Build complete - dist/index.html ready"
