#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
npm install

# Install Chrome for Puppeteer
echo "Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome

# Note: Render standard environment might still lack some OS libraries.
# If you see "error while loading shared libraries", 
# you should consider using a Dockerfile.
