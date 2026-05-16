import "dotenv/config"; // 🔥 garante ENV antes de tudo

import cron from "node-cron";
import { runJob } from "./job/runJob.js";
import { log, logError } from "./services/logger.js";


/**
 * trava global de execução
 */
let isRunning = false;

/**
 * executor seguro (evita concorrência e crash silencioso)
 */
async function safeRun(source = "manual") {
    if (isRunning) {
        log(`⏳ Job ignorado (${source}) - já em execução`);
        return;
    }

    isRunning = true;

    try {
        log("==================================");
        log(`🚀 EXECUÇÃO INICIADA (${source})`);
        log("==================================");

        await runJob();

        log(`✅ EXECUÇÃO FINALIZADA (${source})`);
    } catch (err) {
        logError(err);
        log(`❌ ERRO NA EXECUÇÃO (${source})`);
    } finally {
        isRunning = false;
    }
}

/**
 * bootstrap do sistema
 */
async function start() {
    try {
        log("🚀 SISTEMA INICIADO (BLINDADO)");

        // execução inicial
        await safeRun("startup");

        // cron job
        cron.schedule(
            "*/2 * * * *",
            async () => {
                await safeRun("cron");
            },
            {
                timezone: "America/Sao_Paulo",
            }
        );

        log("⏱️ Cron ativo (a cada 1 minuto)");
    } catch (err) {
        logError(err);
        log("❌ FALHA AO INICIAR SISTEMA");
        process.exit(1);
    }
}

start();