export async function doLogin(page, email, password) {
    log("🔐 Iniciando login Microsoft (headless)...");
    await setSessionStatus("pending");
    await setConfig("mfa_code", "");
    await setConfig("mfa_message", "");

    // 🔥 TIMEOUT GLOBAL (CRÍTICO)
    page.setDefaultTimeout(180000);
    page.setDefaultNavigationTimeout(180000);

    // ── PASSO 1: navega para login ────────────────────────────
    await page.goto("https://login.microsoftonline.com/", {
        waitUntil: "domcontentloaded",
        timeout: 180000
    });

    // ── PASSO 2: email ────────────────────────────────────────
    await page.waitForSelector('input[name="loginfmt"]', {
        timeout: 180000,
        visible: true
    });

    await new Promise(r => setTimeout(r, 800));

    await page.$eval('input[name="loginfmt"]', (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, email.trim());

    await page.click('#idSIButton9');
    log("📧 Email preenchido");

    // ── PASSO 3: senha ────────────────────────────────────────
    await page.waitForSelector(
        'input[name="passwd"], input[type="password"]',
        { timeout: 180000, visible: true }
    );

    await new Promise(r => setTimeout(r, 800));

    const senhaSelector = (await page.$('input[name="passwd"]'))
        ? 'input[name="passwd"]'
        : 'input[type="password"]';

    await page.$eval(senhaSelector, (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, password.trim());

    password = null;

    await page.click('#idSIButton9');
    log("🔑 Senha enviada");

    // ── PASSO 4: monitora login / MFA / fluxo ────────────────
    let autenticado = false;
    let mfaDetectado = false;

    for (let i = 0; i < 200; i++) { // 🔥 aumentado (10 min total)
        await new Promise(r => setTimeout(r, 3000));

        const url = page.url();

        // 🔥 login concluído (vários possíveis redirects Microsoft)
        if (
            url.includes("office.com") ||
            url.includes("outlook") ||
            url.includes("login.live.com") ||
            !url.includes("login.microsoftonline.com")
        ) {
            autenticado = true;
            break;
        }

        const pageText = await page.evaluate(
            () => document.body?.innerText || ""
        ).catch(() => "");

        // ── "Manter conectado?" ───────────────────────────────
        if (pageText.includes("Manter") || pageText.includes("Stay signed")) {
            await page.click('#idSIButton9').catch(() => { });
            log("✅ 'Manter conectado' confirmado");
            continue;
        }

        // ── MFA ────────────────────────────────────────────────
        try {
            const mfaCode = await page.$eval(
                '#idRichContext_DisplaySign',
                el => el.textContent.trim()
            );

            if (mfaCode) {
                if (!mfaDetectado) {
                    log(`📱 MFA detectado — código: ${mfaCode}`);
                    mfaDetectado = true;
                }

                await setSessionStatus("mfa_required");
                await setConfig("mfa_code", mfaCode);
                await setConfig(
                    "mfa_message",
                    "Aprove o login no Microsoft Authenticator"
                );
            }
        } catch { }

        // ── Senha incorreta ───────────────────────────────────
        if (
            pageText.includes("incorreta") ||
            pageText.includes("incorrect") ||
            pageText.includes("wrong")
        ) {
            log("❌ Senha incorreta");
            await setSessionStatus("expired");
            await setConfig("last_error", "Senha incorreta");
            throw new Error("Senha incorreta");
        }

        // ── Conta bloqueada ───────────────────────────────────
        if (
            pageText.includes("bloqueada") ||
            pageText.includes("locked")
        ) {
            log("❌ Conta bloqueada");
            await setSessionStatus("expired");
            await setConfig("last_error", "Conta bloqueada");
            throw new Error("Conta bloqueada");
        }
    }

    // ── TIMEOUT FINAL ────────────────────────────────────────
    if (!autenticado) {
        await setSessionStatus("expired");
        await setConfig("last_error", "Timeout no login");
        throw new Error("Timeout no login");
    }

    // ── SUCESSO ──────────────────────────────────────────────
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