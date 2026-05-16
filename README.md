Puppeteer - biblioteca Node.js (automatizar tarefas)

ONEDRIVE-READER-v5/
│
├── server.js                  # 🔵 ENTRY POINT (só dispara job + cron)
│
├── job/
│   └── runJob.js             # 🧠 ORQUESTRADOR DO PIPELINE (REGRA PRINCIPAL)
│
├── services/
│   ├── downloader.js         # 📥 Puppeteer + SharePoint download
│   ├── excel.js              # 📊 leitura XLSX
│   ├── supabaseService.js    # ☁️ insert/upsert Supabase
│   ├── logger.js             # 🪵 logs
│   ├── utils.js              # ⏱ delay, retry etc
│
├── config/
│   └── supabase.js           # ☁️ client Supabase
│
├── session-data/             # 🔐 login persistente (Puppeteer)
├── downloads/                # 📁 arquivos baixados
├── logs/                     # 🪵 logs do sistema
│
├── token.json                # 🔐 auth (se você usa Google/SharePoint auth)
│
├── package.json
├── package-lock.json
├── .env
├── README.md
│
└── node_modules/


1. Primeira acesso node login-manual.js
2. Apos login:
rm -rf ./session-data
node src/index.js