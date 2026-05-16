import "dotenv/config";
import express from "express";
import cron from "node-cron";
import { runJob } from "./src/job/runJob.js";
import { doLogin, restoreSessionCookies, setSessionStatus, setConfig } from "./src/services/loginMicrosoft.js";
import { launchBrowser } from "./src/services/browser.js";
import { log } from "./src/services/logger.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";

// Timeout máximo para o frontend não ficar travado em "pending"
// Se o login não conclui em 8 min, marca como expired automaticamente
const LOGIN_TIMEOUT_MS = 8 * 60 * 1000;

app.use(express.json());

// ─── Health ───────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── POST /internal/start-login ───────────────────────────────
let loginEmAndamento = false;
let loginTimeoutHandle = null;

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

    // Responde imediatamente — login roda em background
    res.json({ success: true, message: "Login iniciado" });

    loginEmAndamento = true;

    // ── Atualiza status para "pending" imediatamente ──────────
    // Garante que o frontend sai de "expired" e vai para "Conectando..."
    await setSessionStatus("pending").catch(err =>
        log(`⚠️ Erro ao setar pending: ${err.message}`)
    );

    // ── Timeout de segurança ──────────────────────────────────
    // Evita que o frontend fique preso em "Conectando..." para sempre
    loginTimeoutHandle = setTimeout(async () => {
        if (loginEmAndamento) {
            log("⏰ Timeout do login — marcando como expired");
            await setSessionStatus("expired").catch(() => {});
            await setConfig("last_error", "Timeout: login não completou em 8 minutos").catch(() => {});
            loginEmAndamento = false;
        }
    }, LOGIN_TIMEOUT_MS);

    // ── Executa login em background ───────────────────────────
    ;(async () => {
        let browser;
        try {
            log("🔐 [start-login] Iniciando Chrome...");

            browser = await launchBrowser();

            const page = await browser.newPage();
            await page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36"
            );

            // Tenta restaurar cookies antes do login
            await restoreSessionCookies(page).catch(() => {});

            await doLogin(page, email, password);

            log("✅ [start-login] Login concluído com sucesso");

        } catch (err) {
            log(`❌ [start-login] Erro: ${err.message}`);
            await setConfig("last_error", err.message).catch(() => {});
            await setSessionStatus("expired").catch(() => {});
        } finally {
            if (browser) await browser.close().catch(() => {});
            if (loginTimeoutHandle) clearTimeout(loginTimeoutHandle);
            loginEmAndamento = false;
        }
    })();
});

// ─── Cron: a cada 2 minutos ───────────────────────────────────
let jobEmExecucao = false;

cron.schedule("*/2 * * * *", async () => {
    // Não executa download enquanto login está em andamento
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
    // Execução inicial — não trava o servidor se sessão estiver expirada
    runJob().catch(err => log(`❌ Erro inicial: ${err.message}`));
});