import puppeteer from 'puppeteer';
import { log } from './logger.js';

/**
 * Lança o browser Puppeteer com configurações robustas para Docker/Render.
 * Inclui retry automático em caso de falha ao iniciar.
 */
export async function launchBrowser({ userDataDir = null } = {}) {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (() => {
        try { return puppeteer.executablePath(); } catch { return undefined; }
    })();

    log(`🚀 Lançando Chrome (path: ${executablePath || 'auto'})...`);

    const launchOptions = {
        headless: 'new',
        executablePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',   // evita crash por /dev/shm pequeno no Docker
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--no-first-run',
            '--disable-features=TranslateUI',
        ],
        timeout: 60000,
        protocolTimeout: 120000,
    };

    // userDataDir apenas se explicitamente passado
    if (userDataDir) {
        launchOptions.userDataDir = userDataDir;
    }

    // Retry até 2 vezes se falhar ao iniciar
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const browser = await puppeteer.launch(launchOptions);
            log(`✅ Chrome iniciado (tentativa ${attempt})`);
            return browser;
        } catch (err) {
            log(`⚠️ Tentativa ${attempt} falhou ao iniciar Chrome: ${err.message}`);
            if (attempt === 2) throw err;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}
