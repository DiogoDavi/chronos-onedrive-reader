import { log } from "./logger.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// ─── Helpers Supabase ─────────────────────────────────────────
export async function setConfig(key, value) {
    await supabase.from("app_config").upsert({
        key, value: value ?? "", updated_at: new Date().toISOString()
    });
}

export async function setSessionStatus(status) {
    await setConfig("session_status", status);
    log(`💾 session_status = "${status}"`);
}

// ─── Salva cookies na tabela app_sessions ─────────────────────
export async function saveSessionCookies(cookies) {
    await supabase.from("app_sessions").upsert({
        id: "microsoft_session",
        cookies: JSON.stringify(cookies),
        updated_at: new Date().toISOString()
    });
    log("💾 Cookies salvos no Supabase (app_sessions)");
}

// ─── Restaura cookies do Supabase para o browser ──────────────
export async function restoreSessionCookies(page) {
    const { data, error } = await supabase
        .from("app_sessions")
        .select("cookies, updated_at")
        .eq("id", "microsoft_session")
        .single();

    if (error || !data?.cookies) {
        log("⚠️ Nenhuma sessão salva encontrada");
        return false;
    }

    const diasDesdeUpdate = (Date.now() - new Date(data.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (diasDesdeUpdate > 90) {
        log(`⚠️ Sessão expirada há ${Math.floor(diasDesdeUpdate)} dias (limite: 90 dias)`);
        return false;
    }

    let cookies;
    try {
        cookies = typeof data.cookies === "string" ? JSON.parse(data.cookies) : data.cookies;
    } catch {
        log("⚠️ Erro ao parsear cookies");
        return false;
    }

    for (const cookie of cookies) {
        try { await page.setCookie(cookie); } catch { }
    }

    log(`✅ Sessão restaurada (${Math.floor(diasDesdeUpdate)} dias de idade)`);
    return true;
}

// ─── Verifica se sessão está ativa ────────────────────────────
export async function checkSession(page) {
    log("🔐 Verificando sessão Microsoft...");

    await page.goto("https://login.microsoftonline.com/", {
        waitUntil: "networkidle2",
        timeout: 60000
    });

    try {
        await page.waitForFunction(
            () => !window.location.href.includes("login.microsoftonline.com"),
            { timeout: 10000 }
        );
        log("✅ Sessão ativa");
        await setSessionStatus("active");
        return true;
    } catch {
        log("🔴 Sessão expirada");
        await setSessionStatus("expired");
        return false;
    }
}

// ─── Login completo com email/senha + MFA ─────────────────────
// email e senha vêm apenas via parâmetro — NUNCA são logados ou persistidos
export async function doLogin(page, email, password) {
    log("🔐 [STEP 7] Entrando em doLogin() para iniciar fluxo da Microsoft (headless)");
    await setSessionStatus("pending");
    await setConfig("mfa_code", "");
    await setConfig("mfa_message", "");

    // ── PASSO 1: navega para login ────────────────────────────
    log("🌐 [STEP 7] Carregando tela de login https://login.microsoftonline.com/ ...");
    await page.goto("https://login.microsoftonline.com/", {
        waitUntil: "networkidle2",
        timeout: 60000
    });
    log("🌐 [STEP 7] Tela de login carregada.");

    // ── PASSO 2: email ────────────────────────────────────────
    log("📧 [STEP 8] Procurando campo de email 'loginfmt'...");
    await page.waitForSelector('input[name="loginfmt"]', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));

    log("📧 [STEP 8] Inserindo email no campo...");
    await page.$eval('input[name="loginfmt"]', (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, email.trim());

    log("📧 [STEP 8] Clicando no botão Avançar ('#idSIButton9')...");
    await page.click('#idSIButton9');
    log("📧 [STEP 8] Email enviado. Aguardando campo de senha...");

    // ── PASSO 3: senha ────────────────────────────────────────
    log("🔑 [STEP 9] Aguardando campo de senha 'passwd'...");
    try {
        await page.waitForSelector('input[name="passwd"]', { timeout: 20000, visible: true });
    } catch {
        log("🔑 [STEP 9] Campo 'passwd' não encontrado, tentando seletor alternativo 'input[type=password]'...");
        await page.waitForSelector('input[type="password"]', { timeout: 10000, visible: true });
    }

    await new Promise(r => setTimeout(r, 800));

    const senhaSelector = await page.$('input[name="passwd"]') ? 'input[name="passwd"]' : 'input[type="password"]';
    log(`🔑 [STEP 9] Preenchendo a senha usando o seletor '${senhaSelector}'...`);

    await page.$eval(senhaSelector, (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, password.trim());

    // senha usada — libera referência
    password = null;

    log("🔑 [STEP 9] Clicando no botão Entrar ('#idSIButton9')...");
    await page.click('#idSIButton9');
    log("🔑 [STEP 9] Senha enviada com sucesso.");

    // ── PASSO 4: monitora resultado ───────────────────────────
    log("🔄 [STEP 10] Iniciando loop de monitoramento da autenticação...");
    let autenticado = false;
    let mfaDetectado = false;

    for (let i = 0; i < 100; i++) {
        await new Promise(r => setTimeout(r, 3000));

        const url = page.url();
        log(`🔄 [STEP 10] URL atual do navegador: ${url} (Iteração ${i + 1}/100)`);

        // saiu do login = sucesso
        if (!url.includes("login.microsoftonline.com")) {
            log("✅ [STEP 10] Navegador saiu de login.microsoftonline.com! Login bem-sucedido.");
            autenticado = true;
            break;
        }

        const pageText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");

        // ── "Manter conectado?" ───────────────────────────────
        if (pageText.includes("Manter") || pageText.includes("Stay signed")) {
            log("✅ [STEP 10] Tela 'Manter conectado?' detectada. Confirmando...");
            await page.click('#idSIButton9').catch(() => { });
            continue;
        }

        // ── MFA numérico (Authenticator com número) ──────────────
        try {
            const mfaCode = await page.$eval(
                '#idRichContext_DisplaySign',
                el => el.textContent.trim()
            ).catch(() => null);

            if (mfaCode && mfaCode !== "") {
                if (!mfaDetectado) {
                    log(`📱 [STEP 11] MFA numérico detectado! Código exibido: ${mfaCode}`);
                    mfaDetectado = true;
                }
                await setSessionStatus("mfa_required");
                await setConfig("mfa_code", mfaCode);
                await setConfig("mfa_message", "Insira o código no Microsoft Authenticator");
                continue;
            }
        } catch { }

        // ── MFA Aprovação (Authenticator sem número / Notificação) ──
        const isWaitingApproval = pageText.includes("Aprove") || pageText.includes("Approve") || pageText.includes("notificação");
        if (isWaitingApproval && !mfaDetectado) {
            log("📱 [STEP 11] MFA Aprovação (Authenticator) detectado! Aguardando aprovação no app...");
            mfaDetectado = true;
            await setSessionStatus("mfa_required");
            await setConfig("mfa_code", "APP");
            await setConfig("mfa_message", "Aprove a notificação no seu Microsoft Authenticator");
            continue;
        }

        // ── MFA SMS / Outros ─────────────────────────────────
        if (pageText.includes("Código") || pageText.includes("SMS") || pageText.includes("text message")) {
             if (!mfaDetectado) {
                log("📱 [STEP 11] MFA via SMS/Email detectado! Aguardando código...");
                mfaDetectado = true;
                await setSessionStatus("mfa_required");
                await setConfig("mfa_code", "SMS");
                await setConfig("mfa_message", "Insira o código enviado por SMS/Email");
             }
             continue;
        }

        // ── Senha incorreta ───────────────────────────────────
        if (pageText.includes("incorreta") || pageText.includes("incorrect") || pageText.includes("wrong")) {
            log("❌ [STEP 11] Senha incorreta detectada!");
            await setSessionStatus("expired");
            await setConfig("last_error", "Senha incorreta");
            throw new Error("Senha incorreta");
        }

        // ── Conta bloqueada ───────────────────────────────────
        if (pageText.includes("bloqueada") || pageText.includes("locked")) {
            log("❌ [STEP 11] Conta bloqueada detectada!");
            await setSessionStatus("expired");
            await setConfig("last_error", "Conta bloqueada");
            throw new Error("Conta bloqueada");
        }
    }

    if (!autenticado) {
        log("❌ [STEP 11] Loop finalizado sem sucesso (Timeout)");
        await setSessionStatus("expired");
        await setConfig("last_error", "Timeout no login");
        throw new Error("Timeout no login");
    }

    // ── Sucesso: salva cookies e limpa MFA ────────────────────
    log("🍪 [STEP 11] Extraindo cookies da sessão para persistência...");
    const cookies = await page.cookies();
    await saveSessionCookies(cookies);

    await setConfig("mfa_code", "");
    await setConfig("mfa_message", "");
    await setConfig("last_sync", new Date().toISOString());
    await setConfig("last_error", "");
    await setSessionStatus("active");

    log("✅ [STEP 11] Login Microsoft concluído e sessão ativada — Sync OK!");
    return true;
}