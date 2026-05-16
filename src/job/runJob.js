// import { downloadLatestFile } from "../services/downloader.js";
// import { readExcel } from "../services/excel.js";
// import { syncSupabase } from "../services/supabaseService.js";
// import { log, logError } from "../services/logger.js";
// import { retry, delay } from "../services/utils.js";

// let isRunning = false;

// export async function runJob() {
//   if (isRunning) {
//     log("⏳ Job já em execução");
//     return;
//   }

//   isRunning = true;

//   log("==================================");
//   log("🚀 JOB INICIADO");
//   log("==================================");

//   try {
//     // ========================================
//     // 1. DOWNLOAD COM RETRY
//     // ========================================
//     const file = await retry(
//       async () => {
//         const downloadedFile =
//           await downloadLatestFile();

//         if (!downloadedFile) {
//           throw new Error(
//             "❌ Falha no download do arquivo"
//           );
//         }

//         return downloadedFile;
//       },
//       3,
//       3000
//     );

//     log(`📄 Arquivo baixado: ${file}`);

//     await delay(2000);

//     // ========================================
//     // 2. LEITURA EXCEL
//     // ========================================
//     const data = readExcel(file);

//     if (
//       !Array.isArray(data) ||
//       data.length === 0
//     ) {
//       throw new Error(
//         "❌ Excel vazio ou inválido"
//       );
//     }

//     log(
//       `📊 Registros encontrados: ${data.length}`
//     );

//     // ========================================
//     // 3. SYNC SUPABASE
//     // INSERT + UPDATE + DELETE
//     // ========================================
//     await retry(
//       async () => {
//         await syncSupabase(data);
//       },
//       3,
//       3000
//     );

//     log("✅ JOB FINALIZADO COM SUCESSO");

//   } catch (err) {
//     logError(err);

//     log("❌ JOB FINALIZADO COM ERRO");
//   } finally {
//     isRunning = false;

//     log("==================================");
//   }
// }

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
        // não é erro crítico — aguarda reconexão via frontend
        log("⏸️ Sessão expirada — aguardando reconexão. Cron tentará novamente.");
        return; // sai limpo sem marcar erro
      }
      throw err; // outros erros propagam
    }

    if (!file) throw new Error("Download retornou vazio");
    log(`📄 Arquivo baixado: ${file}`);

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