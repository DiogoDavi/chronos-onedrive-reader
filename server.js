import "dotenv/config";
import express from "express";
import cron from "node-cron";
import fs from "fs";
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
    log("📥 [STEP 5] Reader recebeu requisição em /internal/start-login");
    log(`📧 Email recebido: ${req.body?.email}`);
    
    const secretCorrect = !INTERNAL_SECRET || req.body?.secret === INTERNAL_SECRET;
    log(`🛡️ Chave secreta coincide? ${secretCorrect}`);

    if (INTERNAL_SECRET && req.body?.secret !== INTERNAL_SECRET) {
        log("❌ [STEP 5] Rejeitado por segredo inválido!");
        return res.status(401).json({ error: "Não autorizado" });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        log("⚠️ [STEP 5] Rejeitado: Email ou senha ausentes na payload.");
        return res.status(400).json({ error: "email e password são obrigatórios" });
    }

    log(`⏳ Login em andamento? ${loginEmAndamento}`);
    if (loginEmAndamento) {
        log("🔄 [STEP 5] Login já em andamento, abortando nova execução.");
        return res.json({ success: true, message: "Login já em andamento" });
    }

    loginEmAndamento = true;

    // ── Atualiza status para "pending" imediatamente ──────────
    // Garante que o frontend sai de "expired" e vai para "Conectando..."
    log("💾 [STEP 5] Atualizando session_status no Supabase para 'pending'...");
    await setSessionStatus("pending").catch(err =>
        log(`⚠️ [STEP 5] Erro ao salvar 'pending' no Supabase: ${err.message}`)
    );

    // Responde agora — status já está como pending no Supabase
    log("📤 [STEP 5] Enviando resposta HTTP 200 de sucesso imediato ao backend.");
    res.json({ success: true, message: "Login iniciado" });

    // ── Timeout de segurança ──────────────────────────────────
    // Evita que o frontend fique preso em "Conectando..." para sempre
    loginTimeoutHandle = setTimeout(async () => {
        if (loginEmAndamento) {
            log("⏰ [STEP 5] Timeout de segurança do login atingido (8min) — marcando como expired");
            await setSessionStatus("expired").catch(() => {});
            await setConfig("last_error", "Timeout: login não completou em 8 minutos").catch(() => {});
            loginEmAndamento = false;
        }
    }, LOGIN_TIMEOUT_MS);

    // ── Executa login em background ───────────────────────────
    ;(async () => {
        let browser;
        try {
            log("🔐 [STEP 6] Iniciando navegador Chrome Headless...");

            browser = await launchBrowser();

            log("🚀 [STEP 6] Chrome aberto com sucesso. Criando nova aba...");
            const page = await browser.newPage();
            await page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36"
            );

            // Tenta restaurar cookies antes do login
            log("🍪 [STEP 6] Tentando restaurar cookies de sessões salvas...");
            await restoreSessionCookies(page).catch(() => {});

            log("🔐 [STEP 6] Disparando rotina doLogin() em loginMicrosoft.js");
            await doLogin(page, email, password);

            log("✅ [STEP 6] Processo de login concluído com sucesso!");

        } catch (err) {
            log(`❌ [STEP 6] Ocorreu uma exceção no fluxo de login: ${err.message}`);
            try {
                if (!fs.existsSync("./logs")) fs.mkdirSync("./logs", { recursive: true });
                await page.screenshot({ path: "./logs/login-error.png", fullPage: true });
                log("📸 Screenshot do erro salvo em ./logs/login-error.png");
            } catch (screenshotErr) {
                log(`⚠️ Falha ao salvar screenshot do erro: ${screenshotErr.message}`);
            }
            await setConfig("last_error", err.message).catch(() => {});
            await setSessionStatus("expired").catch(() => {});
        } finally {
            if (browser) {
                log("🧹 [STEP 6] Fechando navegador Chrome...");
                await browser.close().catch(() => {});
            }
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