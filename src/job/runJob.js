
// import { downloadLatestFile } from "../services/downloader.js";
// import { readExcel } from "../services/excel.js";
// import { syncSupabase } from "../services/supabaseService.js";
// import { log, logError } from "../services/logger.js";
// import { delay } from "../services/utils.js";

// let isRunning = false;

// export async function runJob() {
//   if (isRunning) {
//     log("⏳ Job já em execução — ignorado");
//     return;
//   }

//   isRunning = true;
//   log("==================================");
//   log("🚀 JOB INICIADO");
//   log("==================================");

//   try {
//     // ── 1. Download ────────────────────────────────────────
//     // SEM retry — SESSION_EXPIRED não deve ser retentado
//     let file;
//     try {
//       file = await downloadLatestFile();
//     } catch (err) {
//       if (err.message === "SESSION_EXPIRED") {
//         // não é erro crítico — aguarda reconexão via frontend
//         log("⏸️ Sessão expirada — aguardando reconexão. Cron tentará novamente.");
//         return; // sai limpo sem marcar erro
//       }
//       throw err; // outros erros propagam
//     }

//     if (!file) throw new Error("Download retornou vazio");
//     log(`📄 Arquivo baixado: ${file}`);

//     await delay(2000);

//     // ── 2. Leitura Excel ───────────────────────────────────
//     const data = readExcel(file);
//     if (!Array.isArray(data) || data.length === 0) {
//       throw new Error("Excel vazio ou inválido");
//     }
//     log(`📊 Registros: ${data.length}`);

//     // ── 3. Sync Supabase ───────────────────────────────────
//     await syncSupabase(data);

//     log("✅ JOB FINALIZADO COM SUCESSO");

//   } catch (err) {
//     logError(err);
//     log("❌ JOB FINALIZADO COM ERRO");
//   } finally {
//     isRunning = false;
//     log("==================================");
//   }
// }

/**
 * src/job/runJob.js
 */
import { downloadLatestFile } from "../services/downloader.js";
import { readExcel } from "../services/excel.js";
import { syncSupabase } from "../services/supabaseService.js";
import { log, logError } from "../services/logger.js";
import { delay } from "../services/utils.js";

let isRunning = false;

export async function runJob() {
  if (isRunning) {
    log("⏳ Job já em execução — ignorado");
    return;
  }

  isRunning = true;
  log("==================================");
  log("🚀 JOB INICIADO");
  log("==================================");

  try {
    // ── 1. Download ────────────────────────────────────────
    // SEM retry — SESSION_EXPIRED não deve ser retentado
    let file;
    try {
      file = await downloadLatestFile();
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") {
        log("⏸️ Sessão expirada — cron tentará no próximo ciclo");
        return; // sai limpo, sem erro
      }
      throw err;
    }

    if (!file) throw new Error("Download retornou vazio");
    log(`📄 Arquivo: ${file}`);

    await delay(2000);

    // ── 2. Leitura Excel ───────────────────────────────────
    const data = readExcel(file);
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Excel vazio ou inválido");
    }
    log(`📊 Registros: ${data.length}`);

    // ── 3. Sync Supabase ───────────────────────────────────
    await syncSupabase(data);

    log("✅ JOB FINALIZADO COM SUCESSO");

  } catch (err) {
    logError(err);
    log("❌ JOB FINALIZADO COM ERRO");
  } finally {
    isRunning = false;
    log("==================================");
  }
}