#!/usr/bin/env bash
# exit on error
set -o errexit

# Define o diretório de cache local para o Puppeteer
export PUPPETEER_CACHE_DIR=$HOME/.cache/puppeteer

# Pula o download automático do Puppeteer durante o 'npm install'
# Isso evita o erro de "folder exists but executable missing" no início
export PUPPETEER_SKIP_DOWNLOAD=true

# Limpa o cache existente para garantir que não haja arquivos corrompidos
echo "Cleaning Puppeteer cache..."
rm -rf $PUPPETEER_CACHE_DIR

# Instala as dependências sem baixar o browser ainda
npm install

# Agora instala o Chrome manualmente de forma limpa
echo "Installing Chrome manually..."
npx puppeteer browsers install chrome

# Note: Render standard environment might still lack some OS libraries.
# If you see "error while loading shared libraries", 
# you should consider using a Dockerfile.
