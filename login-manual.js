/**
 * Execute UMA VEZ para fazer login manual e salvar a sessão:
 * node login-manual.js
 */

import "dotenv/config";
import puppeteer from "puppeteer";

console.log("🚀 Abrindo browser para login manual...");
console.log("📋 Faça login normalmente na janela que abrir.");
console.log("✅ Após logar, aguarde a mensagem de conclusão aqui.");

// const browser = await puppeteer.launch({
//     headless: false,
//     defaultViewport: null,
//     args: ["--start-maximized", "--no-sandbox"],
//     userDataDir: "./session-data", // salva a sessão aqui
// });



const browser = await puppeteer.launch({
    headless: "new",
    args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1920,1080"
    ],
    defaultViewport: {
        width: 1920,
        height: 1080
    },
    userDataDir: "./session-data"
});









const page = await browser.newPage();

// preenche email automaticamente
await page.goto("https://login.microsoftonline.com/", {
    waitUntil: "networkidle2",
    timeout: 60000
});

// verifica se já está logado
if (!page.url().includes("login.microsoftonline.com")) {
    console.log("✅ Sessão já ativa! Nada a fazer.");
    await browser.close();
    process.exit(0);
}

// preenche email
await page.waitForSelector('input[name="loginfmt"]', { timeout: 15000 });
await page.$eval('input[name="loginfmt"]', (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
}, process.env.MICROSOFT_EMAIL.trim());

await page.click('#idSIButton9');
console.log("📧 Email preenchido! Agora DIGITE SUA SENHA na janela e clique Entrar.");

// aguarda você logar — até 5 minutos
console.log("⏳ Aguardando seu login (5 minutos)...");

try {
    await page.waitForFunction(
        () => !window.location.href.includes("login.microsoftonline.com"),
        { timeout: 300000 }
    );

    // confirma "manter conectado" se aparecer
    try {
        await page.waitForSelector('#idSIButton9', { timeout: 8000, visible: true });
        await page.click('#idSIButton9');
        console.log("✅ 'Manter conectado' confirmado");
    } catch { }

    await new Promise(r => setTimeout(r, 2000));
    console.log("✅ Login realizado com sucesso!");
    console.log("💾 Sessão salva em ./session-data");
    console.log("🚀 Agora rode normalmente: node src/index.js");

} catch {
    console.log("❌ Timeout — tente novamente");
}

await browser.close();
process.exit(0);