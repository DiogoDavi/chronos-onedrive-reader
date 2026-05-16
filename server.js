
import "dotenv/config";
import express from "express";
import cron from "node-cron";
import puppeteer from "puppeteer";
import { runJob } from "./src/job/runJob.js";
import { doLogin, restoreSessionCookies, setSessionStatus, setConfig } from "./src/services/loginMicrosoft.js";
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
let loginEmAndamento = false;

app.post("/internal/start-login", async (req, res) => {
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

  res.json({ success: true, message: "Login iniciado" });

  loginEmAndamento = true;

  // ── Atualiza status imediatamente para dar feedback ao Frontend ──
  await setSessionStatus("pending").catch(() => {});

  ; (async () => {
    let browser;
    try {
      log("🔐 [start-login] Iniciando Puppeteer...");
      
      const { launchBrowser } = await import("./src/services/browser.js");
      browser = await launchBrowser();

      const page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36");

      // Tenta restaurar cookies antes do login
      await restoreSessionCookies(page).catch(() => {});

      await doLogin(page, email, password);

      log("✅ [start-login] Login concluído");

    } catch (err) {
      log(`❌ [start-login] Erro: ${err.message}`);
      await setConfig("last_error", err.message).catch(() => {});
      await setSessionStatus("expired").catch(() => {});
    } finally {
      if (browser) await browser.close().catch(() => { });
      loginEmAndamento = false;
    }
  })();
});

// ─── Cron: a cada 2 minutos ───────────────────────────────────
let jobEmExecucao = false;

cron.schedule("*/2 * * * *", async () => {
  if (jobEmExecucao || loginEmAndamento) { 
    log(`⏳ Job ignorado — ${loginEmAndamento ? "Login em andamento" : "Já em execução"}`); 
    return; 
  }
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
  // execução inicial — não trava o servidor se sessão estiver expirada
  runJob().catch(err => log(`❌ Erro inicial: ${err.message}`));
});