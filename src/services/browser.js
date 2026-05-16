import puppeteer from 'puppeteer';
import { log } from './logger.js';

/**
 * Lança o browser Puppeteer com as configurações otimizadas para Docker/Render.
 */
export async function launchBrowser() {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';
    
    log(`🚀 Lançando browser (path: ${executablePath})...`);
    
    return await puppeteer.launch({
        executablePath,
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process'
        ],
        timeout: 60000
    });
}
