import { checkSession, setSessionStatus, restoreSessionCookies } from "./loginMicrosoft.js";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { log } from "./logger.js";

const DOWNLOAD_DIR = "./downloads";
const MAX_FILES = 10;

function cleanupOldFiles() {
  const files = fs
    .readdirSync(DOWNLOAD_DIR)
    .filter(f => f.endsWith(".xlsx"))
    .map(f => ({ name: f, path: path.join(DOWNLOAD_DIR, f), time: fs.statSync(path.join(DOWNLOAD_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);
  for (const file of files.slice(MAX_FILES)) {
    try { fs.unlinkSync(file.path); log(`🗑️ Removido: ${file.name}`); } catch { }
  }
}

// ─── Detecta caminho do Chromium instalado pelo puppeteer ─────
async function getBrowserPath() {
  try {
    const { executablePath } = await import('puppeteer');
    const p = executablePath();
    log(`🔍 Chromium encontrado em: ${p}`);
    return p;
  } catch {
    return undefined; // deixa puppeteer decidir
  }
}

export async function downloadLatestFile() {

  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const executablePath = await getBrowserPath();

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--single-process",
      "--no-zygote",
      "--disable-extensions"
    ],
    userDataDir: "./session-data",
  });

  const page = await browser.newPage();
  
  // Tenta restaurar cookies do Supabase antes de verificar a sessão
  try {
    await restoreSessionCookies(page);
  } catch (err) {
    log(`⚠️ Erro ao restaurar cookies: ${err.message}`);
  }

  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36");

  try {
    const sessaoAtiva = await checkSession(page);
    if (!sessaoAtiva) throw new Error("SESSION_EXPIRED");

    const targetUrl = process.env.ONEDRIVE_URL || process.env.SHAREPOINT_URL;
    if (!targetUrl) throw new Error("ONEDRIVE_URL não definida");

    log("🌐 Acessando SharePoint...");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 180000 });

    if (page.url().includes("login.microsoftonline.com")) {
      await setSessionStatus("expired");
      throw new Error("SESSION_EXPIRED");
    }

    log(`📍 URL: ${page.url()}`);

    if (!fs.existsSync("./logs")) fs.mkdirSync("./logs", { recursive: true });
    await page.screenshot({ path: "./logs/sharepoint-loaded.png", fullPage: true });

    log("⏳ Aguardando frames...");
    await page.waitForFunction(() => window.frames.length > 0, { timeout: 120000, polling: 2000 });
    await new Promise(r => setTimeout(r, 8000));

    const frames = page.frames();
    log(`🧩 Frames: ${frames.length}`);

    let fileUrl = null;
    for (const frame of frames) {
      try {
        const url = await frame.evaluate(() =>
          window._wopiContextJson?.FileGetUrl || window.docProps?.FileGetUrl || null
        );
        if (url) { fileUrl = url; break; }
      } catch { }
    }

    if (!fileUrl) {
      const html = await page.content();
      const match = html.match(/https:\/\/[^"]+download[^"]+/i);
      if (match) fileUrl = match[0];
    }

    if (!fileUrl) {
      await page.screenshot({ path: "./logs/wopi-not-found.png", fullPage: true });
      throw new Error("FileGetUrl não encontrado");
    }

    log("✅ URL encontrada — baixando...");

    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const response = await fetch(fileUrl, {
      headers: { cookie: cookieString, "user-agent": "Mozilla/5.0" }
    });

    if (!response.ok) throw new Error(`Falha download: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const filePath = path.join(DOWNLOAD_DIR, `arquivo_${Date.now()}.xlsx`);
    fs.writeFileSync(filePath, buffer);
    cleanupOldFiles();

    await setSessionStatus("active");
    log(`📄 Arquivo salvo: ${filePath}`);
    return filePath;

  } catch (err) {
    if (err.message === "SESSION_EXPIRED") {
      log("🔴 Sessão expirada — aguardando reconexão via frontend");
    } else {
      log(`❌ Erro: ${err.message}`);
      try { await page.screenshot({ path: "./logs/error-final.png", fullPage: true }); } catch { }
      await setSessionStatus("expired");
    }
    throw err;
  } finally {
    await browser.close();
  }
}