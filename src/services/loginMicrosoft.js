// // import { log } from "./logger.js";
// // import { saveSession, setSessionStatus } from "./sessionStorage.js";

// // export async function loginMicrosoft(page) {

// //     log("🔐 Verificando autenticação Microsoft...");

// //     // tenta acessar o SharePoint direto (sessão pode estar nos cookies restaurados)
// //     await page.goto("https://login.microsoftonline.com/", {
// //         waitUntil: "networkidle2",
// //         timeout: 60000
// //     });

// //     try {
// //         await page.waitForFunction(
// //             () => !window.location.href.includes("login.microsoftonline.com"),
// //             { timeout: 15000 }
// //         );
// //         log("✅ Sessão Microsoft já ativa");
// //         return true;
// //     } catch {
// //         log("🔑 Sessão expirada");
// //         await setSessionStatus("expired");
// //         return false;
// //     }
// // }

// // // =============================================
// // // login completo com salvamento de sessão
// // // chamado pelo endpoint /api/auth/login
// // // =============================================
// // export async function doLogin(page) {

// //     log("🔐 Iniciando login manual...");

// //     await page.goto("https://login.microsoftonline.com/", {
// //         waitUntil: "networkidle2",
// //         timeout: 60000
// //     });

// //     // preenche email automaticamente
// //     await page.waitForSelector('input[name="loginfmt"]', { timeout: 30000 });
// //     await new Promise(r => setTimeout(r, 800));

// //     await page.$eval('input[name="loginfmt"]', (el, v) => {
// //         el.value = v;
// //         el.dispatchEvent(new Event('input', { bubbles: true }));
// //         el.dispatchEvent(new Event('change', { bubbles: true }));
// //     }, process.env.MICROSOFT_EMAIL.trim());

// //     await page.click('#idSIButton9');
// //     log("📧 Email preenchido — aguardando senha manual...");

// //     // aguarda o usuário fazer o resto (senha + MFA se houver)
// //     await page.waitForFunction(
// //         () => !window.location.href.includes("login.microsoftonline.com"),
// //         { timeout: 300000 } // 5 minutos
// //     );

// //     // confirma "manter conectado"
// //     try {
// //         await page.waitForSelector('#idSIButton9', { timeout: 8000, visible: true });
// //         await page.click('#idSIButton9');
// //     } catch { }

// //     await new Promise(r => setTimeout(r, 3000));

// //     // salva cookies no Supabase
// //     const cookies = await page.cookies();
// //     await saveSession(cookies);

// //     log("✅ Login concluído e sessão salva!");
// //     return true;
// // }


// // import { log } from "./logger.js";
// // import { createClient } from "@supabase/supabase-js";

// // const supabase = createClient(
// //     process.env.SUPABASE_URL,
// //     process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
// // );

// // // ─── Atualiza status no Supabase ─────────────────────────────
// // async function setSessionStatus(status) {
// //     try {
// //         await supabase.from("app_config").upsert({
// //             key: "session_status",
// //             value: status,
// //             updated_at: new Date().toISOString()
// //         });
// //         log(`💾 session_status = "${status}" gravado no Supabase`);
// //     } catch (err) {
// //         log(`⚠️ Erro ao gravar status: ${err.message}`);
// //     }
// // }

// // // ─── Verifica se a sessão está ativa ─────────────────────────
// // export async function loginMicrosoft(page) {

// //     log("🔐 Verificando autenticação Microsoft...");

// //     await page.goto("https://login.microsoftonline.com/", {
// //         waitUntil: "networkidle2",
// //         timeout: 60000
// //     });

// //     // aguarda até 10s para sair do login
// //     try {
// //         await page.waitForFunction(
// //             () => !window.location.href.includes("login.microsoftonline.com"),
// //             { timeout: 10000 }
// //         );
// //     } catch {
// //         // ainda no login — sessão expirada
// //     }

// //     const currentUrl = page.url();
// //     const aindaNoLogin = currentUrl.includes("login.microsoftonline.com");

// //     if (!aindaNoLogin) {
// //         log("✅ Sessão Microsoft já ativa");
// //         await setSessionStatus("active");
// //         return true;
// //     }

// //     // sessão expirada
// //     log("🔑 Sessão expirada — iniciando login...");
// //     await setSessionStatus("expired");
// //     return false;
// // }

// // // ─── Login completo (chamado pelo login-manual.js) ────────────
// // export async function doLogin(page) {

// //     log("🔐 Iniciando login manual...");

// //     await page.goto("https://login.microsoftonline.com/", {
// //         waitUntil: "networkidle2",
// //         timeout: 60000
// //     });

// //     // preenche email automaticamente
// //     await page.waitForSelector('input[name="loginfmt"]', { timeout: 30000 });
// //     await new Promise(r => setTimeout(r, 800));

// //     await page.$eval('input[name="loginfmt"]', (el, v) => {
// //         el.value = v;
// //         el.dispatchEvent(new Event('input', { bubbles: true }));
// //         el.dispatchEvent(new Event('change', { bubbles: true }));
// //     }, process.env.MICROSOFT_EMAIL.trim());

// //     await page.click('#idSIButton9');
// //     log("📧 Email preenchido — aguardando senha manual...");

// //     // aguarda você fazer o login (senha + MFA se houver)
// //     await page.waitForFunction(
// //         () => !window.location.href.includes("login.microsoftonline.com"),
// //         { timeout: 300000 } // 5 minutos
// //     );

// //     // confirma "manter conectado"
// //     try {
// //         await page.waitForSelector('#idSIButton9', { timeout: 8000, visible: true });
// //         await page.click('#idSIButton9');
// //         log("✅ 'Manter conectado' confirmado");
// //     } catch { }

// //     await new Promise(r => setTimeout(r, 3000));

// //     // ✅ GRAVA STATUS ATIVO NO SUPABASE
// //     await setSessionStatus("active");

// //     log(`📍 URL final: ${page.url()}`);
// //     log("✅ Login concluído — Sync OK ativado!");
// //     return true;
// // }



// import { log } from "./logger.js";
// import { createClient } from "@supabase/supabase-js";

// const supabase = createClient(
//     process.env.SUPABASE_URL,
//     process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
// );

// // ─── Helpers Supabase ─────────────────────────────────────────
// export async function setConfig(key, value) {
//     await supabase.from("app_config").upsert({ key, value, updated_at: new Date().toISOString() });
// }

// export async function setSessionStatus(status) {
//     await setConfig("session_status", status);
//     log(`💾 session_status = "${status}"`);
// }

// // ─── Verifica sessão ativa (usado pelo downloader no loop) ────
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

// // ─── Login completo com MFA ───────────────────────────────────
// // Chamado pelo endpoint /internal/start-login do ONEDRIVE-READER
// export async function doLogin(page) {
//     log("🔐 Iniciando login Microsoft...");
//     await setSessionStatus("pending");

//     await page.goto("https://login.microsoftonline.com/", {
//         waitUntil: "networkidle2",
//         timeout: 60000
//     });

//     // ── PASSO 1: email ────────────────────────────────────────
//     await page.waitForSelector('input[name="loginfmt"]', { timeout: 30000 });
//     await new Promise(r => setTimeout(r, 800));

//     await page.$eval('input[name="loginfmt"]', (el, v) => {
//         el.value = v;
//         el.dispatchEvent(new Event('input', { bubbles: true }));
//         el.dispatchEvent(new Event('change', { bubbles: true }));
//     }, process.env.MICROSOFT_EMAIL.trim());

//     await page.click('#idSIButton9');
//     log("📧 Email preenchido");

//     // ── PASSO 2: senha ────────────────────────────────────────
//     await page.waitForSelector('input[name="passwd"]', { timeout: 20000, visible: true });
//     await new Promise(r => setTimeout(r, 800));

//     await page.$eval('input[name="passwd"]', (el, v) => {
//         el.value = v;
//         el.dispatchEvent(new Event('input', { bubbles: true }));
//         el.dispatchEvent(new Event('change', { bubbles: true }));
//     }, process.env.MICROSOFT_PASSWORD.trim());

//     await page.click('#idSIButton9');
//     log("🔑 Senha enviada — aguardando MFA ou redirect...");

//     // ── PASSO 3: monitora MFA ou sucesso ─────────────────────
//     let autenticado = false;

//     for (let i = 0; i < 100; i++) {
//         await new Promise(r => setTimeout(r, 3000));

//         const url = page.url();

//         // saiu do login = sucesso
//         if (!url.includes("login.microsoftonline.com")) {
//             autenticado = true;
//             break;
//         }

//         const pageText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");

//         // ── Tela "Manter conectado?" ──────────────────────────
//         if (pageText.includes("Manter") || pageText.includes("Stay signed")) {
//             await page.click('#idSIButton9').catch(() => { });
//             log("✅ 'Manter conectado' confirmado");
//             continue;
//         }

//         // ── MFA com código numérico (Authenticator) ───────────
//         // Microsoft mostra um número que o usuário deve aprovar no app
//         try {
//             const mfaCode = await page.$eval(
//                 '#idRichContext_DisplaySign',
//                 el => el.textContent.trim()
//             );

//             if (mfaCode) {
//                 log(`📱 MFA código: ${mfaCode}`);
//                 await setConfig("session_status", "mfa_required");
//                 await setConfig("mfa_code", mfaCode);
//                 await setConfig("mfa_message", "Aprove o login no Microsoft Authenticator");

//                 // aguarda aprovação no celular — o loop continua até sair do login
//                 continue;
//             }
//         } catch { }

//         // ── Senha incorreta ───────────────────────────────────
//         if (pageText.includes("incorreta") || pageText.includes("incorrect")) {
//             log("❌ Senha incorreta");
//             await setSessionStatus("expired");
//             throw new Error("Senha incorreta");
//         }
//     }

//     if (!autenticado) {
//         await setSessionStatus("expired");
//         throw new Error("Timeout no login");
//     }

//     // ── Sucesso: limpa MFA e marca ativo ─────────────────────
//     await setConfig("mfa_code", "");
//     await setConfig("mfa_message", "");
//     await setSessionStatus("active");

//     log("✅ Login Microsoft concluído!");
//     return true;
// }
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
    if (diasDesdeUpdate > 25) {
        log(`⚠️ Sessão expirada há ${Math.floor(diasDesdeUpdate)} dias`);
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
    log("🔐 Iniciando login Microsoft (headless)...");
    await setSessionStatus("pending");
    await setConfig("mfa_code", "");
    await setConfig("mfa_message", "");

    // ── PASSO 1: navega para login ────────────────────────────
    await page.goto("https://login.microsoftonline.com/", {
        waitUntil: "networkidle2",
        timeout: 60000
    });

    // ── PASSO 2: email ────────────────────────────────────────
    await page.waitForSelector('input[name="loginfmt"]', { timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));

    await page.$eval('input[name="loginfmt"]', (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, email.trim());

    await page.click('#idSIButton9');
    log("📧 Email preenchido");

    // ── PASSO 3: senha ────────────────────────────────────────
    try {
        await page.waitForSelector('input[name="passwd"]', { timeout: 20000, visible: true });
    } catch {
        // tenta seletor alternativo
        await page.waitForSelector('input[type="password"]', { timeout: 10000, visible: true });
    }

    await new Promise(r => setTimeout(r, 800));

    const senhaSelector = await page.$('input[name="passwd"]') ? 'input[name="passwd"]' : 'input[type="password"]';

    await page.$eval(senhaSelector, (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, password.trim());

    // senha usada — libera referência
    password = null;

    await page.click('#idSIButton9');
    log("🔑 Senha enviada");

    // ── PASSO 4: monitora resultado ───────────────────────────
    let autenticado = false;
    let mfaDetectado = false;

    for (let i = 0; i < 100; i++) {
        await new Promise(r => setTimeout(r, 3000));

        const url = page.url();

        // saiu do login = sucesso
        if (!url.includes("login.microsoftonline.com")) {
            autenticado = true;
            break;
        }

        const pageText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");

        // ── "Manter conectado?" ───────────────────────────────
        if (pageText.includes("Manter") || pageText.includes("Stay signed")) {
            await page.click('#idSIButton9').catch(() => { });
            log("✅ 'Manter conectado' confirmado");
            continue;
        }

        // ── MFA numérico (Authenticator) ──────────────────────
        try {
            const mfaCode = await page.$eval(
                '#idRichContext_DisplaySign',
                el => el.textContent.trim()
            );
            if (mfaCode && mfaCode !== "") {
                if (!mfaDetectado) {
                    log(`📱 MFA detectado — código: ${mfaCode}`);
                    mfaDetectado = true;
                }
                await setSessionStatus("mfa_required");
                await setConfig("mfa_code", mfaCode);
                await setConfig("mfa_message", "Aprove o login no Microsoft Authenticator");
                continue;
            }
        } catch { }

        // ── Senha incorreta ───────────────────────────────────
        if (pageText.includes("incorreta") || pageText.includes("incorrect") || pageText.includes("wrong")) {
            log("❌ Senha incorreta");
            await setSessionStatus("expired");
            await setConfig("last_error", "Senha incorreta");
            throw new Error("Senha incorreta");
        }

        // ── Conta bloqueada ───────────────────────────────────
        if (pageText.includes("bloqueada") || pageText.includes("locked")) {
            log("❌ Conta bloqueada");
            await setSessionStatus("expired");
            await setConfig("last_error", "Conta bloqueada");
            throw new Error("Conta bloqueada");
        }
    }

    if (!autenticado) {
        await setSessionStatus("expired");
        await setConfig("last_error", "Timeout no login");
        throw new Error("Timeout no login");
    }

    // ── Sucesso: salva cookies e limpa MFA ────────────────────
    const cookies = await page.cookies();
    await saveSessionCookies(cookies);

    await setConfig("mfa_code", "");
    await setConfig("mfa_message", "");
    await setConfig("last_sync", new Date().toISOString());
    await setConfig("last_error", "");
    await setSessionStatus("active");

    log("✅ Login Microsoft concluído — Sync OK!");
    return true;
}