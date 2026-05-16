FROM ghcr.io/puppeteer/puppeteer:22.6.0

USER root

# Instalar dependências extras se necessário (geralmente a imagem da puppeteer já tem o básico)
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala dependências
# PUPPETEER_SKIP_DOWNLOAD=true porque usaremos o Chrome instalado pela imagem ou via npx
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install

# Copia o resto do código
COPY . .

# Expõe a porta
EXPOSE 4000

# Comando para rodar
CMD ["node", "server.js"]
