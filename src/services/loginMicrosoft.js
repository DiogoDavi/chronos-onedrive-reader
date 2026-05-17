// import { log } from "./logger.js";
// import { createClient } from "@supabase/supabase-js";

// const supabase = createClient(
//     process.env.SUPABASE_URL,
//     process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
// );

// // ─── Helpers Supabase ─────────────────────────────────────────
// export async function setConfig(key, value) {
//     await supabase.from("app_config").upsert({
//         key, value: value ?? "", updated_at: new Date().toISOString()
//     });
// }

// export async function setSessionStatus(status) {
//     await setConfig("session_status", status);
//     log(`💾 session_status = "${status}"`);
// }

// // ─── Salva cookies na tabela app_sessions ─────────────────────
// export async function saveSessionCookies(cookies) {
//     await supabase.from("app_sessions").upsert({
//         id: "microsoft_session",
//         cookies: JSON.stringify(cookies),
//         updated_at: new Date().toISOString()
//     });
//     log("💾 Cookies salvos no Supabase (app_sessions)");
// }

// // ─── Restaura cookies do Supabase para o browser ──────────────
// export async function restoreSessionCookies(page) {
//     const { data, error } = await supabase
//         .from("app_sessions")
//         .select("cookies, updated_at")
//         .eq("id", "microsoft_session")
//         .single();

//     if (error || !data?.cookies) {
//         log("⚠️ Nenhuma sessão salva encontrada");
//         return false;
//     }

//     const diasDesdeUpdate = (Date.now() - new Date(data.updated_at).getTime()) / (1000 * 60 * 60 * 24);
//     if (diasDesdeUpdate > 90) {
//         log(`⚠️ Sessão expirada há ${Math.floor(diasDesdeUpdate)} dias (limite: 90 dias)`);
//         return false;
//     }

//     let cookies;
//     try {
//         cookies = typeof data.cookies === "string" ? JSON.parse(data.cookies) : data.cookies;
//     } catch {
//         log("⚠️ Erro ao parsear cookies");
//         return false;
//     }

//     for (const cookie of cookies) {
//         try { await page.setCookie(cookie); } catch { }
//     }

//     log(`✅ Sessão restaurada (${Math.floor(diasDesdeUpdate)} dias de idade)`);
//     return true;
// }

// // ─── Verifica se sessão está ativa ────────────────────────────
// export async function checkSession(page) {
//     log("🔐 Verificando sessão Microsoft...");

//     await page.goto("https://login.microsoftonline.com/", {
//         waitUntil: "networkidle2",
//         timeout: 60000
//     });

//     try {
//         await page.waitForFunction(
//             () => !window.location.href.includes("login.microsoftonline.com"),
//             { timeout: 10000 }
//         );
//         log("✅ Sessão ativa");
//         await setSessionStatus("active");
//         return true;
//     } catch {
//         log("🔴 Sessão expirada");
//         await setSessionStatus("expired");
//         return false;
//     }
// }

// // ─── Login completo com email/senha + MFA ─────────────────────
// // email e senha vêm apenas via parâmetro — NUNCA são logados ou persistidos
// export async function doLogin(page, email, password) {
//     log("🔐 [STEP 7] Entrando em doLogin() para iniciar fluxo da Microsoft (headless)");
//     await setSessionStatus("pending");
//     await setConfig("mfa_code", "");
//     await setConfig("mfa_message", "");

//     // ── PASSO 1: navega para login ────────────────────────────
//     log("🌐 [STEP 7] Carregando tela de login https://login.microsoftonline.com/ ...");
//     await page.goto("https://login.microsoftonline.com/", {
//         waitUntil: "networkidle2",
//         timeout: 60000
//     });
//     log("🌐 [STEP 7] Tela de login carregada.");

//     // ── PASSO 2: email ────────────────────────────────────────
//     log("📧 [STEP 8] Procurando campo de email 'loginfmt'...");
//     await page.waitForSelector('input[name="loginfmt"]', { timeout: 30000 });
//     await new Promise(r => setTimeout(r, 800));

//     log("📧 [STEP 8] Inserindo email no campo...");
//     await page.$eval('input[name="loginfmt"]', (el, v) => {
//         el.value = v;
//         el.dispatchEvent(new Event('input', { bubbles: true }));
//         el.dispatchEvent(new Event('change', { bubbles: true }));
//     }, email.trim());

//     log("📧 [STEP 8] Clicando no botão Avançar ('#idSIButton9')...");
//     await page.click('#idSIButton9');
//     log("📧 [STEP 8] Email enviado. Aguardando campo de senha...");

//     // ── PASSO 3: senha ────────────────────────────────────────
//     log("🔑 [STEP 9] Aguardando campo de senha 'passwd'...");
//     try {
//         await page.waitForSelector('input[name="passwd"]', { timeout: 20000, visible: true });
//     } catch {
//         log("🔑 [STEP 9] Campo 'passwd' não encontrado, tentando seletor alternativo 'input[type=password]'...");
//         await page.waitForSelector('input[type="password"]', { timeout: 10000, visible: true });
//     }

//     await new Promise(r => setTimeout(r, 800));

//     const senhaSelector = await page.$('input[name="passwd"]') ? 'input[name="passwd"]' : 'input[type="password"]';
//     log(`🔑 [STEP 9] Preenchendo a senha usando o seletor '${senhaSelector}'...`);

//     await page.$eval(senhaSelector, (el, v) => {
//         el.value = v;
//         el.dispatchEvent(new Event('input', { bubbles: true }));
//         el.dispatchEvent(new Event('change', { bubbles: true }));
//     }, password.trim());

//     // senha usada — libera referência
//     password = null;

//     log("🔑 [STEP 9] Clicando no botão Entrar ('#idSIButton9')...");
//     await page.click('#idSIButton9');
//     log("🔑 [STEP 9] Senha enviada com sucesso.");

//     // ── PASSO 4: monitora resultado ───────────────────────────
//     log("🔄 [STEP 10] Iniciando loop de monitoramento da autenticação...");
//     let autenticado = false;
//     let mfaDetectado = false;

//     for (let i = 0; i < 100; i++) {
//         await new Promise(r => setTimeout(r, 3000));

//         const url = page.url();
//         log(`🔄 [STEP 10] URL atual do navegador: ${url} (Iteração ${i + 1}/100)`);

//         // saiu do login = sucesso
//         if (!url.includes("login.microsoftonline.com")) {
//             log("✅ [STEP 10] Navegador saiu de login.microsoftonline.com! Login bem-sucedido.");
//             autenticado = true;
//             break;
//         }

//         const pageText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");

//         // ── "Manter conectado?" ───────────────────────────────
//         if (pageText.includes("Manter") || pageText.includes("Stay signed")) {
//             log("✅ [STEP 10] Tela 'Manter conectado?' detectada. Confirmando...");
//             await page.click('#idSIButton9').catch(() => { });
//             continue;
//         }

//         // ── MFA numérico (Authenticator com número) ──────────────
//         try {
//             const mfaCode = await page.$eval(
//                 '#idRichContext_DisplaySign',
//                 el => el.textContent.trim()
//             ).catch(() => null);

//             if (mfaCode && mfaCode !== "") {
//                 if (!mfaDetectado) {
//                     log(`📱 [STEP 11] MFA numérico detectado! Código exibido: ${mfaCode}`);
//                     mfaDetectado = true;
//                 }
//                 await setSessionStatus("mfa_required");
//                 await setConfig("mfa_code", mfaCode);
//                 await setConfig("mfa_message", "Insira o código no Microsoft Authenticator");
//                 continue;
//             }
//         } catch { }

//         // ── MFA Aprovação (Authenticator sem número / Notificação) ──
//         const isWaitingApproval = pageText.includes("Aprove") || pageText.includes("Approve") || pageText.includes("notificação");
//         if (isWaitingApproval && !mfaDetectado) {
//             log("📱 [STEP 11] MFA Aprovação (Authenticator) detectado! Aguardando aprovação no app...");
//             mfaDetectado = true;
//             await setSessionStatus("mfa_required");
//             await setConfig("mfa_code", "APP");
//             await setConfig("mfa_message", "Aprove a notificação no seu Microsoft Authenticator");
//             continue;
//         }

//         // ── MFA SMS / Outros ─────────────────────────────────
//         if (pageText.includes("Código") || pageText.includes("SMS") || pageText.includes("text message")) {
//              if (!mfaDetectado) {
//                 log("📱 [STEP 11] MFA via SMS/Email detectado! Aguardando código...");
//                 mfaDetectado = true;
//                 await setSessionStatus("mfa_required");
//                 await setConfig("mfa_code", "SMS");
//                 await setConfig("mfa_message", "Insira o código enviado por SMS/Email");
//              }
//              continue;
//         }

//         // ── Senha incorreta ───────────────────────────────────
//         if (pageText.includes("incorreta") || pageText.includes("incorrect") || pageText.includes("wrong")) {
//             log("❌ [STEP 11] Senha incorreta detectada!");
//             await setSessionStatus("expired");
//             await setConfig("last_error", "Senha incorreta");
//             throw new Error("Senha incorreta");
//         }

//         // ── Conta bloqueada ───────────────────────────────────
//         if (pageText.includes("bloqueada") || pageText.includes("locked")) {
//             log("❌ [STEP 11] Conta bloqueada detectada!");
//             await setSessionStatus("expired");
//             await setConfig("last_error", "Conta bloqueada");
//             throw new Error("Conta bloqueada");
//         }
//     }

//     if (!autenticado) {
//         log("❌ [STEP 11] Loop finalizado sem sucesso (Timeout)");
//         await setSessionStatus("expired");
//         await setConfig("last_error", "Timeout no login");
//         throw new Error("Timeout no login");
//     }

//     // ── Sucesso: salva cookies e limpa MFA ────────────────────
//     log("🍪 [STEP 11] Extraindo cookies da sessão para persistência...");
//     const cookies = await page.cookies();
//     await saveSessionCookies(cookies);

//     await setConfig("mfa_code", "");
//     await setConfig("mfa_message", "");
//     await setConfig("last_sync", new Date().toISOString());
//     await setConfig("last_error", "");
//     await setSessionStatus("active");

//     log("✅ [STEP 11] Login Microsoft concluído e sessão ativada — Sync OK!");
//     return true;
// }

import { log } from "./logger.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

export async function setConfig(key, value) {
    await supabase.from("app_config").upsert({
        key,
        value: value ?? "",
        updated_at: new Date().toISOString()
    });
}

export async function setSessionStatus(status) {
    await setConfig("session_status", status);
    log(`💾 session_status = "${status}"`);
}

// ─────────────────────────────────────────────────────────────
// SAVE COOKIES
// ─────────────────────────────────────────────────────────────

export async function saveSessionCookies(cookies) {
    await supabase.from("app_sessions").upsert({
        id: "microsoft_session",
        cookies: JSON.stringify(cookies),
        updated_at: new Date().toISOString()
    });

    log("💾 Cookies salvos no Supabase");
}

// ─────────────────────────────────────────────────────────────
// RESTORE COOKIES
// ─────────────────────────────────────────────────────────────

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

    const diasDesdeUpdate =
        (Date.now() - new Date(data.updated_at).getTime())
        / (1000 * 60 * 60 * 24);

    if (diasDesdeUpdate > 90) {
        log(`⚠️ Sessão expirada (${Math.floor(diasDesdeUpdate)} dias)`);
        return false;
    }

    let cookies;

    try {
        cookies =
            typeof data.cookies === "string"
                ? JSON.parse(data.cookies)
                : data.cookies;
    } catch {
        log("⚠️ Erro ao parsear cookies");
        return false;
    }

    for (const cookie of cookies) {
        try {
            await page.setCookie(cookie);
        } catch { }
    }

    log("✅ Cookies restaurados");
    return true;
}

// ─────────────────────────────────────────────────────────────
// CHECK SESSION
// ─────────────────────────────────────────────────────────────

export async function checkSession(page) {

    log("🔐 Verificando sessão Microsoft...");

    await page.goto("https://login.microsoftonline.com/", {
        waitUntil: "domcontentloaded",
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

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────

export async function doLogin(page, email, password) {

    try {

        log("🔐 [STEP 7] Iniciando login Microsoft");

        await setSessionStatus("pending");

        await setConfig("mfa_code", "");
        await setConfig("mfa_message", "");
        await setConfig("last_error", "");

        // ─────────────────────────────────────────
        // ABRE LOGIN
        // ─────────────────────────────────────────

        log("🌐 [STEP 7] Abrindo Microsoft Login");

        await page.goto("https://login.microsoftonline.com/", {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        // ─────────────────────────────────────────
        // EMAIL
        // ─────────────────────────────────────────

        log("📧 [STEP 8] Aguardando campo email");

        await page.waitForSelector('input[name="loginfmt"]', {
            visible: true,
            timeout: 30000
        });

        await new Promise(r => setTimeout(r, 1500));

        log("📧 [STEP 8] Digitando email");

        await page.click('input[name="loginfmt"]', {
            clickCount: 3
        });

        await page.type(
            'input[name="loginfmt"]',
            email.trim(),
            { delay: 80 }
        );

        await new Promise(r => setTimeout(r, 1000));

        log("📧 [STEP 8] Clicando Avançar");

        await Promise.all([
            page.click('#idSIButton9'),
            page.waitForNavigation({
                waitUntil: 'domcontentloaded',
                timeout: 30000
            }).catch(() => { })
        ]);

        // ─────────────────────────────────────────
        // SENHA
        // ─────────────────────────────────────────

        log("🔑 [STEP 9] Aguardando campo senha");

        await page.waitForFunction(() => {
            return !!document.querySelector('input[type="password"]');
        }, {
            timeout: 30000
        });

        await new Promise(r => setTimeout(r, 2000));

        const passwordInput =
            await page.$('input[type="password"]');

        if (!passwordInput) {
            throw new Error("Campo de senha não encontrado");
        }

        log("🔑 [STEP 9] Digitando senha");

        await passwordInput.click({
            clickCount: 3
        });

        await passwordInput.type(
            password.trim(),
            { delay: 80 }
        );

        password = null;

        await new Promise(r => setTimeout(r, 1000));

        log("🔑 [STEP 9] Clicando Entrar");

        await Promise.all([
            page.click('#idSIButton9'),
            page.waitForNavigation({
                waitUntil: 'domcontentloaded',
                timeout: 30000
            }).catch(() => { })
        ]);

        log("🔑 [STEP 9] Senha enviada");

        // ─────────────────────────────────────────
        // LOOP LOGIN / MFA
        // ─────────────────────────────────────────

        log("🔄 [STEP 10] Monitorando autenticação");

        let autenticado = false;
        let mfaDetectado = false;

        for (let i = 0; i < 100; i++) {

            await new Promise(r => setTimeout(r, 3000));

            const url = page.url();

            log(`🌐 URL Atual: ${url}`);

            // LOGIN OK
            if (!url.includes("login.microsoftonline.com")) {

                log("✅ Login realizado com sucesso");

                autenticado = true;

                break;
            }

            let pageText = "";

            try {

                pageText = await page.evaluate(() => {
                    return document.body?.innerText || "";
                });

            } catch { }

            // ─────────────────────────────────────
            // MANTER CONECTADO
            // ─────────────────────────────────────

            const staySignedBtn =
                await page.$('#idSIButton9');

            if (
                staySignedBtn &&
                (
                    pageText.includes("Manter conectado") ||
                    pageText.includes("Stay signed in")
                )
            ) {

                log("✅ Tela 'Manter conectado' detectada");

                await staySignedBtn.click().catch(() => { });

                continue;
            }

            // ─────────────────────────────────────
            // MFA NUMÉRICO
            // ─────────────────────────────────────

            try {

                const mfaCode = await page.$eval(
                    '#idRichContext_DisplaySign',
                    el => el.textContent.trim()
                ).catch(() => null);

                if (mfaCode) {

                    if (!mfaDetectado) {

                        log(`📱 MFA numérico detectado: ${mfaCode}`);

                        mfaDetectado = true;
                    }

                    await setSessionStatus("mfa_required");

                    await setConfig("mfa_code", mfaCode);

                    await setConfig(
                        "mfa_message",
                        "Digite o código no Microsoft Authenticator"
                    );

                    continue;
                }

            } catch { }

            // ─────────────────────────────────────
            // MFA APPROVE
            // ─────────────────────────────────────

            const waitingApproval =
                pageText.includes("Aprove") ||
                pageText.includes("Approve") ||
                pageText.includes("notificação");

            if (waitingApproval) {

                if (!mfaDetectado) {

                    log("📱 MFA aprovação detectado");

                    mfaDetectado = true;
                }

                await setSessionStatus("mfa_required");

                await setConfig("mfa_code", "APP");

                await setConfig(
                    "mfa_message",
                    "Aprove a notificação no Authenticator"
                );

                continue;
            }

            // ─────────────────────────────────────
            // MFA SMS
            // ─────────────────────────────────────

            const smsDetected =
                pageText.includes("Código") ||
                pageText.includes("SMS") ||
                pageText.includes("text message");

            if (smsDetected) {

                if (!mfaDetectado) {

                    log("📱 MFA SMS detectado");

                    mfaDetectado = true;
                }

                await setSessionStatus("mfa_required");

                await setConfig("mfa_code", "SMS");

                await setConfig(
                    "mfa_message",
                    "Digite o código recebido"
                );

                continue;
            }

            // ─────────────────────────────────────
            // SENHA INCORRETA
            // ─────────────────────────────────────

            if (
                pageText.includes("incorreta") ||
                pageText.includes("incorrect") ||
                pageText.includes("wrong")
            ) {

                log("❌ Senha incorreta");

                await setSessionStatus("expired");

                await setConfig(
                    "last_error",
                    "Senha incorreta"
                );

                throw new Error("Senha incorreta");
            }

            // ─────────────────────────────────────
            // CONTA BLOQUEADA
            // ─────────────────────────────────────

            if (
                pageText.includes("bloqueada") ||
                pageText.includes("locked")
            ) {

                log("❌ Conta bloqueada");

                await setSessionStatus("expired");

                await setConfig(
                    "last_error",
                    "Conta bloqueada"
                );

                throw new Error("Conta bloqueada");
            }
        }

        // ─────────────────────────────────────────
        // TIMEOUT
        // ─────────────────────────────────────────

        if (!autenticado) {

            log("❌ Timeout no login");

            await setSessionStatus("expired");

            await setConfig(
                "last_error",
                "Timeout no login"
            );

            throw new Error("Timeout no login");
        }

        // ─────────────────────────────────────────
        // SALVA COOKIES
        // ─────────────────────────────────────────

        log("🍪 Salvando cookies");

        const cookies = await page.cookies();

        await saveSessionCookies(cookies);

        await setConfig("mfa_code", "");
        await setConfig("mfa_message", "");
        await setConfig("last_sync", new Date().toISOString());
        await setConfig("last_error", "");

        await setSessionStatus("active");

        log("✅ Login concluído com sucesso");

        return true;

    } catch (err) {

        log(`❌ Erro no login: ${err.message}`);

        try {

            await page.screenshot({
                path: `login-error-${Date.now()}.png`,
                fullPage: true
            });

            log("📸 Screenshot do erro salva");

        } catch (e) {

            log(`⚠️ Erro ao salvar screenshot: ${e.message}`);
        }

        await setSessionStatus("expired");

        await setConfig(
            "last_error",
            err.message || "Erro desconhecido"
        );

        throw err;
    }
}