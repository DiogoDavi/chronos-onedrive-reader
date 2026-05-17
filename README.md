# 🚀 Chronos OneDrive Reader

Serviço de automação responsável por:

* autenticação Microsoft
* leitura SharePoint / OneDrive
* download automático de arquivos Excel
* sincronização com Supabase
* heartbeat de sessão
* integração com Chronos Backend

---

# 🏗️ Arquitetura

```txt
Frontend (Vercel)
    ↓
Chronos Backend (Render)
    ↓
Chronos OneDrive Reader (Render)
    ↓
Microsoft / SharePoint
    ↓
Supabase
```

---

# ⚙️ Tecnologias

* Node.js
* Express
* Puppeteer
* Supabase
* Microsoft SharePoint
* Render

---

# 📦 Instalação

```bash
git clone https://github.com/diogodavi/chronos-onedrive-reader.git

cd chronos-onedrive-reader

npm install
```

---

# 🔐 Variáveis de Ambiente

Criar arquivo `.env`

```env
PORT=3000

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

MICROSOFT_EMAIL=

CHRONOS_BACKEND_URL=
```

---

# ▶️ Executar Localmente

```bash
npm start
```

ou

```bash
node server.js
```

---

# 🤖 Funcionalidades

## ✅ Sessão Microsoft Persistida

O sistema:

* salva cookies Microsoft
* restaura sessão automaticamente
* evita login frequente
* sincroniza status no Supabase

---

## ✅ MFA Microsoft

Compatível com:

* Microsoft Authenticator
* MFA numérico
* aprovação via celular

O código MFA é extraído automaticamente via Puppeteer e enviado ao frontend.

---

## ✅ SharePoint Sync

O serviço:

* acessa SharePoint
* baixa planilhas Excel
* processa arquivos
* envia dados ao Supabase

---

# 📡 Endpoints

## Health Check

```http
GET /api/health
```

---

## Iniciar Login Microsoft

```http
POST /internal/start-login
```

---

## Status da Sessão

```http
GET /api/session/status
```

---

# 🔄 Fluxo de Autenticação

```txt
Frontend
↓
Reconectar
↓
Chronos Backend
↓
OneDrive Reader
↓
Microsoft Login
↓
MFA
↓
Sessão salva
↓
Supabase active
↓
Sync OK
```

---

# 🗂️ Estrutura

```txt
src/
├── auth/
├── services/
├── utils/
├── downloads/
├── logs/
└── session/

server.js
package.json
```

---

# ☁️ Deploy

## Render

Configurações recomendadas:

* Environment: Node
* Build Command:

```bash
npm install
```

* Start Command:

```bash
node server.js
```

---

# 🔒 Segurança

Nunca subir:

* `.env`
* `session-data`
* `token.json`
* logs
* cookies Microsoft

Todos protegidos via `.gitignore`.

---

# 📌 Observações

* O sistema utiliza Puppeteer headless
* Não utiliza browser visual
* Não utiliza GUI remota
* MFA é aprovado pelo celular do usuário
* Sessões são persistidas no Supabase

---

# 👨‍💻 Projeto

Chronos Logistics Platform

Sistema de automação logística com:

* dashboard operacional
* sincronização SharePoint
* monitoramento em tempo real
* integração Supabase
* automação Microsoft

---

```
```
git add .
git commit --allow-empty -m "chore: trigger sistema"
git push origin main