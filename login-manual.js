/**
 * Execute UMA VEZ para fazer login manual e salvar a sessão:
 * node login-manual.js
 */

import "dotenv/config";
import { saveSessionCookies } from "./src/services/loginMicrosoft.js";
import puppeteer from "puppeteer";

console.log("🚀 Abrindo browser para login manual...");
console.log("📋 Faça login normalmente na janela que abrir.");
console.log("✅ Após logar, aguarde a mensagem de conclusão aqui.");

const browser = await puppeteer.launch({
    headless: false, // IMPORTANTE: login manual precisa aparecer
    args: [
        "--start-maximized",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
    ],
    defaultViewport: null,
    userDataDir: "./session-data"
});

const page = await browser.newPage();

// ─────────────────────────────────────────────
// Abre login Microsoft
// ─────────────────────────────────────────────
await page.goto("https://login.microsoftonline.com/", {
    waitUntil: "networkidle2",
    timeout: 60000
});

// ─────────────────────────────────────────────
// Verifica sessão já ativa
// ─────────────────────────────────────────────
if (!page.url().includes("login.microsoftonline.com")) {
    console.log("✅ Sessão já ativa! Nada a fazer.");
    const cookies = await page.cookies(
        "https://login.microsoftonline.com",
        "https://www.office.com",
        "https://portal.office.com"
    );

    console.log("COOKIES CAPTURADOS:");
    console.log(cookies.map(c => c.name));

    await saveSessionCookies(cookies);

    console.log(`💾 ${cookies.length} cookies enviados para o Supabase`);

    await browser.close();
    process.exit(0);
}

// ─────────────────────────────────────────────
// Aguarda campo de email
// ─────────────────────────────────────────────
console.log("📧 Aguardando campo de email...");

await page.waitForSelector('input[name="loginfmt"]', {
    timeout: 30000,
    visible: true
});

await new Promise(r => setTimeout(r, 1500));

// ─────────────────────────────────────────────
// Preenche email
// ─────────────────────────────────────────────
console.log("📧 Inserindo email...");

await page.$eval(
    'input[name="loginfmt"]',
    (el, value) => {
        el.value = value;

        el.dispatchEvent(
            new Event("input", {
                bubbles: true
            })
        );

        el.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );
    },
    process.env.MICROSOFT_EMAIL.trim()
);

// ─────────────────────────────────────────────
// Clica botão avançar (CORRIGIDO)
// ─────────────────────────────────────────────
console.log("➡️ Clicando em Avançar...");

await page.waitForSelector('#idSIButton9', {
    timeout: 30000,
    visible: true
});

await new Promise(r => setTimeout(r, 2000));

// CLICK VIA DOM (evita erro clickablePoint)
await page.evaluate(() => {
    const btn = document.querySelector('#idSIButton9');

    if (btn) {
        btn.click();
    }
});

console.log("📧 Email preenchido!");
console.log("🔑 Agora DIGITE SUA SENHA manualmente.");
console.log("📱 Aprove MFA/Auth no celular se aparecer.");

// ─────────────────────────────────────────────
// Aguarda login manual
// ─────────────────────────────────────────────
console.log("⏳ Aguardando login manual (5 minutos)...");

try {

    await page.waitForFunction(
        () => !window.location.href.includes("login.microsoftonline.com"),
        {
            timeout: 300000
        }
    );

    console.log("✅ Login detectado com sucesso!");

    // ─────────────────────────────────────────
    // Verifica "Manter conectado?"
    // ─────────────────────────────────────────
    try {

        console.log("🔄 Verificando tela 'Manter conectado?'...");

        await page.waitForSelector('#idSIButton9', {
            timeout: 10000,
            visible: true
        });

        await new Promise(r => setTimeout(r, 2000));

        await page.evaluate(() => {
            const btn = document.querySelector('#idSIButton9');

            if (btn) {
                btn.click();
            }
        });

        console.log("✅ 'Manter conectado' confirmado");

    } catch {
        console.log("ℹ️ Tela 'Manter conectado?' não apareceu");
    }

    // Aguarda cookies estabilizarem
    // ─────────────────────────────────────────
    await new Promise(r => setTimeout(r, 3000));

    // Salva cookies no Supabase
    // Salva cookies no Supabase
    const cookies = await page.cookies(
        "https://login.microsoftonline.com",
        "https://www.office.com",
        "https://portal.office.com"
    );

    console.log("COOKIES CAPTURADOS:");
    console.log(cookies.map(c => c.name));

    await saveSessionCookies(cookies);

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ LOGIN REALIZADO COM SUCESSO");
    console.log("💾 Sessão salva em ./session-data");
    console.log(`☁️ ${cookies.length} cookies enviados para o Supabase`);
    console.log("🚀 Agora rode normalmente:");
    console.log("node src/index.js");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

} catch (err) {

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("❌ TIMEOUT NO LOGIN");
    console.log("⚠️ Você demorou mais de 5 minutos");
    console.log("🔄 Execute novamente:");
    console.log("node login-manual.js");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    console.error(err);
}

await browser.close();
process.exit(0);