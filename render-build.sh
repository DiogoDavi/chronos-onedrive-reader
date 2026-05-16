#!/usr/bin/env bash
# exit on error
set -o errexit

# Instala as dependências do projeto
npm install

# Define o diretório de cache local para o Puppeteer
export PUPPETEER_CACHE_DIR=$HOME/.cache/puppeteer

# Limpa o cache existente para evitar o erro de "folder exists but executable missing"
echo "Cleaning Puppeteer cache..."
rm -rf $PUPPETEER_CACHE_DIR

# Instala o Chrome para o Puppeteer
echo "Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome

# Note: Render standard environment might still lack some OS libraries.
# If you see "error while loading shared libraries", 
# you should consider using a Dockerfile.
