import {
  checkSession,
  setSessionStatus,
  restoreSessionCookies
} from "./loginMicrosoft.js";

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { log } from "./logger.js";

const DOWNLOAD_DIR = "./downloads";
const MAX_FILES = 10;

// ─────────────────────────────────────────────

function ensureDir(dir) {

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─────────────────────────────────────────────

function sleep(ms) {

  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────

function cleanupOldFiles() {

  try {

    const files = fs
      .readdirSync(DOWNLOAD_DIR)
      .filter(f => f.endsWith(".xlsx"))
      .map(f => ({
        name: f,
        path: path.join(DOWNLOAD_DIR, f),
        time: fs.statSync(path.join(DOWNLOAD_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    for (const file of files.slice(MAX_FILES)) {

      try {

        fs.unlinkSync(file.path);

        log(`🗑️ Removido: ${file.name}`);

      } catch { }
    }

  } catch { }
}

// ─────────────────────────────────────────────

async function getBrowserPath() {

  try {

    const { executablePath } = await import("puppeteer");

    return (
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      executablePath()
    );

  } catch {

    return undefined;

  }
}

// ─────────────────────────────────────────────

function convertToDirectDownloadUrl(url) {

  // REMOVE parâmetros
  url = url.split("?")[0];

  // transforma /:x:/g/ em download.aspx
  if (url.includes("/:x:/g/")) {

    return `${url}?download=1`;
  }

  return url;
}

// ─────────────────────────────────────────────

async function safeScreenshot(page, file) {

  try {

    if (!page.isClosed()) {

      await page.screenshot({
        path: file,
        fullPage: true
      });
    }

  } catch { }
}

// ─────────────────────────────────────────────

// export async function downloadLatestFile() {
export async function downloadLatestFile(targetUrl) {

  ensureDir(DOWNLOAD_DIR);
  ensureDir("./logs");

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
      "--disable-extensions"

    ],

    userDataDir: "./session-data"

  });

  let page;

  try {

    page = await browser.newPage();

    page.setDefaultTimeout(180000);

    page.setDefaultNavigationTimeout(180000);

    page.on("console", msg => {

      const text = msg.text();

      if (
        text.includes("BSSO") ||
        text.includes("Telemetry") ||
        text.includes("icons were re-registered")
      ) {
        return;
      }

      log(`🖥️ ${text}`);
    });

    // ─────────────────────────────────────────

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36"
    );

    // ─────────────────────────────────────────

    try {

      await restoreSessionCookies(page);
      log("🌐 Abrindo SharePoint...");

    } catch (err) {

      log(`⚠️ restoreSessionCookies: ${err.message}`);
    }

    // ─────────────────────────────────────────

    // const sessionOk = await checkSession(page);

    // if (!sessionOk) {

    //   await setSessionStatus("expired");

    //   throw new Error("SESSION_EXPIRED");
    // }

    // ─────────────────────────────────────────

    // const targetUrl =
    //   process.env.ONEDRIVE_URL ||
    //   process.env.SHAREPOINT_URL;

    if (!targetUrl) {
      throw new Error("URL não informada");
    }

    // ─────────────────────────────────────────

    log("🌐 Abrindo SharePoint...");

    await page.goto(targetUrl, {

      waitUntil: "networkidle2",

      timeout: 180000

    });

    // ─────────────────────────────────────────

    await sleep(5000);

    // ─────────────────────────────────────────

    const currentUrl = page.url();

    log(`📍 ${currentUrl}`);





    const html = await page.content();

    fs.writeFileSync(
      "./logs/cpg-page.html",
      html
    );




    // sessão morreu
    if (
      currentUrl.includes("login.microsoftonline.com")
    ) {

      const html = await page.content();

      if (
        html.includes("Sign in") ||
        html.includes("Entrar") ||
        html.includes("loginfmt")
      ) {

        await setSessionStatus("expired");
        throw new Error("SESSION_EXPIRED");
      }

      log("⚠️ Microsoft redirecionou mas a sessão ainda pode estar válida");
    }

    // ─────────────────────────────────────────

    await safeScreenshot(
      page,
      "./logs/sharepoint.png"
    );

    // ─────────────────────────────────────────

    const downloadUrl =
      convertToDirectDownloadUrl(currentUrl);

    log(`🔗 ${downloadUrl}`);

    // ─────────────────────────────────────────

    const cookies = await page.cookies();

    const cookieString = cookies
      .map(c => `${c.name}=${c.value}`)
      .join("; ");

    // ─────────────────────────────────────────

    log("⬇️ Baixando XLSX...");

    const response = await fetch(downloadUrl, {

      method: "GET",

      redirect: "follow",

      headers: {

        cookie: cookieString,

        "user-agent":
          "Mozilla/5.0",

        accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*"

      }
    });

    // ─────────────────────────────────────────

    if (!response.ok) {

      throw new Error(
        `Falha download: ${response.status()}`
      );
    }

    // ─────────────────────────────────────────

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    // XLSX é ZIP => começa com PK
    const signature =
      buffer.slice(0, 2).toString();



    // if (signature !== "PK") {

    //   fs.writeFileSync(
    //     "./logs/invalid-response.html",
    //     buffer
    //   );

    //   throw new Error(
    //     "Resposta não é XLSX válido"
    //   );
    // }


    if (signature !== "PK") {

      fs.writeFileSync(
        "./logs/invalid-response.html",
        buffer
      );

      log("⚠️ Resposta salva em logs/invalid-response.html");

      const texto = buffer.toString("utf8");

      const pos = texto.indexOf("FileGetUrl");

      if (pos > -1) {
        log(texto.substring(pos, pos + 3000));
      }

      throw new Error(
        "Resposta não é XLSX válido"
      );
    }


    // ─────────────────────────────────────────

    const filePath = path.join(
      DOWNLOAD_DIR,
      `arquivo_${Date.now()}.xlsx`
    );

    fs.writeFileSync(filePath, buffer);

    cleanupOldFiles();

    // ─────────────────────────────────────────

    await setSessionStatus("active");

    log(`📄 Arquivo salvo: ${filePath}`);

    return filePath;

  } catch (err) {

    const message =
      err?.message || "Erro desconhecido";

    log(`❌ ${message}`);

    if (page) {

      await safeScreenshot(
        page,
        "./logs/error.png"
      );
    }

    if (message !== "SESSION_EXPIRED") {

      await setSessionStatus("expired");
    }

    throw err;

  } finally {

    try {

      await browser.close();

    } catch { }
  }
}