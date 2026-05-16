// // /**
// //  * server.js — endpoints de autenticação + status
// //  * Adicione estas rotas no seu server.js existente
// //  */

// // import express from "express";
// // import puppeteer from "puppeteer";
// // import { doLogin } from "./src/services/loginMicrosoft.js";
// // import { getSessionStatus, saveSession } from "./src/services/sessionStorage.js";

// // const app = express();
// // const PORT = process.env.PORT || 3333;

// // app.use(express.json());

// // // =============================================
// // // GET /api/auth/status
// // // Frontend consulta se sessão está ok
// // // =============================================
// // app.get("/api/auth/status", async (_req, res) => {
// //   const status = await getSessionStatus();
// //   res.json({
// //     status,           // "active" | "expired"
// //     needsLogin: status === "expired"
// //   });
// // });

// // // =============================================
// // // GET /api/auth/login
// // // Abre browser, preenche email, aguarda senha manual
// // // Redireciona para /api/auth/login/done ao terminar
// // // =============================================
// // let loginInProgress = false;

// // app.get("/api/auth/login", async (req, res) => {

// //   if (loginInProgress) {
// //     return res.json({ message: "Login já em andamento" });
// //   }

// //   loginInProgress = true;

// //   // responde imediatamente para não travar o browser
// //   res.json({ message: "Login iniciado — siga as instruções na janela" });

// //   try {
// //     const browser = await puppeteer.launch({
// //       headless: false,
// //       defaultViewport: null,
// //       args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
// //     });

// //     const page = await browser.newPage();
// //     await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36");

// //     await doLogin(page);

// //     await browser.close();
// //     console.log("✅ Login concluído via endpoint");

// //   } catch (err) {
// //     console.error("❌ Erro no login:", err.message);
// //   } finally {
// //     loginInProgress = false;
// //   }
// // });

// // // =============================================
// // // GET /api/auth/login/status
// // // Frontend faz polling para saber se login terminou
// // // =============================================
// // app.get("/api/auth/login/status", async (_req, res) => {
// //   const status = await getSessionStatus();
// //   res.json({
// //     loginInProgress,
// //     sessionActive: status === "active"
// //   });
// // });

// // app.listen(PORT, "0.0.0.0", () => {
// //   console.log(`[Backend] Rodando na porta ${PORT}`);
// // });



// /**
//  * ONEDRIVE-READER — server.js
//  * Substitui o server.js atual na raiz do projeto
//  */

// import "dotenv/config";
// import express from "express";
// import cron from "node-cron";
// import { runJob } from "./src/job/runJob.js";
// import { doLogin } from "./src/services/loginMicrosoft.js";
// import { log } from "./src/services/logger.js";
// import puppeteer from "puppeteer";

// const app = express();
// const PORT = Number(process.env.PORT) || 4000;
// const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";

// app.use(express.json());

// // ─── Health Check ─────────────────────────────────────────────
// app.get("/health", (_req, res) => {
//   res.json({ status: "ok", timestamp: new Date().toISOString() });
// });

// // ─── POST /internal/start-login ───────────────────────────────
// // Chamado pelo Chronos Backend quando o frontend clica "Reconectar"
// // Inicia o Puppeteer em headless e faz login com MFA
// let loginEmAndamento = false;

// app.post("/internal/start-login", async (req, res) => {

//   // proteção básica com secret
//   if (INTERNAL_SECRET && req.body?.secret !== INTERNAL_SECRET) {
//     return res.status(401).json({ error: "Não autorizado" });
//   }

//   if (loginEmAndamento) {
//     return res.json({ message: "Login já em andamento" });
//   }

//   // responde imediatamente — login roda em background
//   res.json({ success: true, message: "Login iniciado" });

//   loginEmAndamento = true;

//   try {
//     log("🔐 [/internal/start-login] Iniciando login via Puppeteer...");

//     const browser = await puppeteer.launch({
//       executablePath:
//         process.env.PUPPETEER_EXECUTABLE_PATH ||
//         "/usr/bin/google-chrome-stable",

//       headless: "new",

//       args: [
//         "--no-sandbox",
//         "--disable-setuid-sandbox",
//         "--disable-dev-shm-usage",
//         "--disable-gpu"
//       ],

//       userDataDir: "./session-data",
//     });

//     const page = await browser.newPage();
//     await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36");

//     await doLogin(page);
//     await browser.close();

//     log("✅ Login concluído via /internal/start-login");

//   } catch (err) {
//     log(`❌ Erro no login: ${err.message}`);
//   } finally {
//     loginEmAndamento = false;
//   }
// });

// // ─── Cron: executa o job a cada 2 minutos ─────────────────────
// let jobEmExecucao = false;

// cron.schedule("*/2 * * * *", async () => {
//   if (jobEmExecucao) {
//     log("⏳ Job ignorado — já em execução");
//     return;
//   }

//   jobEmExecucao = true;

//   try {
//     log("⏱️ Cron: executando job...");
//     await runJob();
//   } catch (err) {
//     log(`❌ Erro no cron: ${err.message}`);
//   } finally {
//     jobEmExecucao = false;
//   }
// }, { timezone: "America/Sao_Paulo" });

// // ─── Execução inicial ─────────────────────────────────────────
// app.listen(PORT, "0.0.0.0", async () => {
//   log(`🚀 ONEDRIVE-READER rodando na porta ${PORT}`);

//   try {
//     await runJob();
//   } catch (err) {
//     log(`❌ Erro na execução inicial: ${err.message}`);
//   }
// });
/**
 * ONEDRIVE-READER — server.js (raiz do projeto)
 */
import "dotenv/config";
import express from "express";
import cron from "node-cron";
import puppeteer from "puppeteer";
import { runJob } from "./src/job/runJob.js";
import { doLogin } from "./src/services/loginMicrosoft.js";
import { log } from "./src/services/logger.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";

app.use(express.json());

// ─── Health ───────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── POST /internal/start-login ───────────────────────────────
// Recebe email/senha do Chronos Backend e inicia login headless
let loginEmAndamento = false;

app.post("/internal/start-login", async (req, res) => {

  // validação do secret
  if (INTERNAL_SECRET && req.body?.secret !== INTERNAL_SECRET) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email e password são obrigatórios" });
  }

  if (loginEmAndamento) {
    return res.json({ success: true, message: "Login já em andamento" });
  }

  // responde imediatamente — roda em background
  res.json({ success: true, message: "Login iniciado" });

  loginEmAndamento = true;

  // executa login em background
  ; (async () => {
    let browser;
    try {
      log("🔐 [start-login] Iniciando Puppeteer...");

      const { executablePath } = await import("puppeteer");
      browser = await puppeteer.launch({
        headless: "new",
        executablePath: executablePath(),
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--single-process"
        ],
        userDataDir: "./session-data",
      });

      const page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36");

      // email e senha passados apenas em memória — nunca logados
      await doLogin(page, email, password);

      log("✅ [start-login] Login concluído");

    } catch (err) {
      log(`❌ [start-login] Erro: ${err.message}`);
    } finally {
      if (browser) await browser.close().catch(() => { });
      loginEmAndamento = false;
    }
  })();
});

// ─── Cron: job a cada 2 minutos ───────────────────────────────
let jobEmExecucao = false;

cron.schedule("*/2 * * * *", async () => {
  if (jobEmExecucao) { log("⏳ Job ignorado — já em execução"); return; }
  jobEmExecucao = true;
  try {
    await runJob();
  } catch (err) {
    log(`❌ Erro no cron: ${err.message}`);
  } finally {
    jobEmExecucao = false;
  }
}, { timezone: "America/Sao_Paulo" });

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", async () => {
  log(`🚀 ONEDRIVE-READER rodando na porta ${PORT}`);
  try {
    await runJob();
  } catch (err) {
    log(`❌ Erro na execução inicial: ${err.message}`);
  }
});