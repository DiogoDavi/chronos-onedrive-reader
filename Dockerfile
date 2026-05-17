# # ─── Imagem base com Chrome pré-instalado ────────────────────────────────────
# # Usar a imagem oficial do Puppeteer é a forma mais confiável no Render/Docker
# # pois já vem com todas as dependências de sistema necessárias.
# FROM ghcr.io/puppeteer/puppeteer:22.6.0

# # Puppeteer já está instalado na imagem base — não baixar de novo
# ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# # Caminho do Chrome instalado pela imagem base
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# WORKDIR /home/pptruser/app

# # Copia dependências primeiro (cache layer)
# COPY package*.json ./

# # Instala dependências como root, depois muda owner
# USER root
# RUN npm install --omit=dev

# # Copia código fonte
# COPY . .

# # Cria diretórios necessários com permissão correta para o usuário pptruser
# RUN mkdir -p downloads logs session-data \
#     && chown -R pptruser:pptruser /home/pptruser/app

# # Volta para usuário não-root (segurança e conformidade com a imagem base)
# USER pptruser

# EXPOSE 4000

# CMD ["node", "server.js"]


# Imagem base com Puppeteer + Chrome já instalados e configurados
FROM ghcr.io/puppeteer/puppeteer:22.6.0

# Não baixar Chrome novamente (já vem na imagem)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /home/pptruser/app

COPY package*.json ./

USER root
RUN npm install --omit=dev

COPY . .

RUN mkdir -p downloads logs session-data \
    && chown -R pptruser:pptruser /home/pptruser/app

USER pptruser

EXPOSE 4000

# Inicia o server.js — não o src/index.js
CMD ["node", "server.js"]