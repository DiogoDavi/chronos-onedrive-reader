// import puppeteer from 'puppeteer';
// import { log } from './logger.js';

// /**
//  * Lança o browser Puppeteer com configurações robustas para Docker/Render.
//  * Inclui retry automático em caso de falha ao iniciar.
//  */
// export async function launchBrowser({ userDataDir = null } = {}) {
//     const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (() => {
//         try { return puppeteer.executablePath(); } catch { return undefined; }
//     })();

//     log(`🚀 Lançando Chrome (path: ${executablePath || 'auto'})...`);

//     const launchOptions = {
//         headless: 'new',
//         executablePath,
//         args: [
//             '--no-sandbox',
//             '--disable-setuid-sandbox',
//             '--disable-dev-shm-usage',   // evita crash por /dev/shm pequeno no Docker
//             '--disable-gpu',
//             '--no-zygote',
//             '--single-process',
//             '--disable-extensions',
//             '--disable-background-networking',
//             '--disable-default-apps',
//             '--disable-sync',
//             '--no-first-run',
//             '--disable-features=TranslateUI',
//         ],
//         timeout: 60000,
//         protocolTimeout: 120000,
//     };

//     // userDataDir apenas se explicitamente passado
//     if (userDataDir) {
//         launchOptions.userDataDir = userDataDir;
//     }

//     // Retry até 2 vezes se falhar ao iniciar
//     for (let attempt = 1; attempt <= 2; attempt++) {
//         try {
//             const browser = await puppeteer.launch(launchOptions);
//             log(`✅ Chrome iniciado (tentativa ${attempt})`);
//             return browser;
//         } catch (err) {
//             log(`⚠️ Tentativa ${attempt} falhou ao iniciar Chrome: ${err.message}`);
//             if (attempt === 2) throw err;
//             await new Promise(r => setTimeout(r, 2000));
//         }
//     }
// }
/**
 * src/services/browser.js
 * Lança o Chrome com fallback robusto para Docker/Render.
 */
import puppeteer from 'puppeteer';
import { log } from './logger.js';

function getChromePath() {
    // 1. Variável explícita (Dockerfile seta PUPPETEER_EXECUTABLE_PATH)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        log(`🔍 Chrome via ENV: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // 2. Chrome baixado pelo puppeteer (render-build.sh)
    try {
        const p = puppeteer.executablePath();
        if (p) {
            log(`🔍 Chrome via puppeteer.executablePath: ${p}`);
            return p;
        }
    } catch { }

    // 3. Caminhos fixos do Linux
    log("🔍 Chrome: usando caminho padrão do sistema");
    return '/usr/bin/google-chrome-stable';
}

export async function launchBrowser() {
    const executablePath = getChromePath();

    log(`🚀 Lançando Chrome (${executablePath})...`);

    const options = {
        headless: 'new',
        executablePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
            '--disable-extensions',
            '--no-first-run',
        ],
        timeout: 60000,
        protocolTimeout: 120000,
    };

    // Retry 2x se falhar
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const browser = await puppeteer.launch(options);
            log(`✅ Chrome iniciado (tentativa ${attempt})`);
            return browser;
        } catch (err) {
            log(`⚠️ Tentativa ${attempt} falhou: ${err.message}`);
            if (attempt === 2) throw new Error(`Chrome não iniciou: ${err.message}`);
            await new Promise(r => setTimeout(r, 3000));
        }
    }
}