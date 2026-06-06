import { downloadLatestFile } from "../services/downloader.js";
import { readExcel } from "../services/excel.js";
import { syncSupabase } from "../services/supabaseService.js";
import { log, logError } from "../services/logger.js";
import { delay } from "../services/utils.js";

let isRunning = false;

function rebuildDedupeKey(record) {
  const centroOrigem = String(
    record.CENTRO_ORIGEM || ""
  )
    .trim()
    .toUpperCase();

  const dtInicial = String(
    record.DT_INICIAL || ""
  )
    .trim()
    .toUpperCase();

  let hrInicial = String(
    record.HR_INICIAL || ""
  )
    .trim()
    .toUpperCase();

  if (hrInicial && hrInicial.length === 5) {
    hrInicial += ":00";
  }

  const placa = String(
    record.PLACA_CAVALO || ""
  )
    .trim()
    .toUpperCase();

  return [
    centroOrigem,
    dtInicial,
    hrInicial,
    placa,
  ].join("|");
}

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
    // ==========================================
    // JPA
    // ==========================================

    log("🏭 PROCESSANDO JPA");

    let fileJPA;

    try {
      fileJPA = await downloadLatestFile(
        process.env.ONEDRIVE_URL_JPA
      );
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") {
        log(
          "⏸️ Sessão expirada — aguardando reconexão."
        );
        return;
      }
      throw err;
    }

    if (!fileJPA) {
      throw new Error(
        "Download JPA retornou vazio"
      );
    }

    log(
      `📄 Arquivo JPA baixado: ${fileJPA}`
    );

    await delay(2000);

    let dataJPA = readExcel(
      fileJPA,
      "JPA"
    );

    if (
      !Array.isArray(dataJPA) ||
      dataJPA.length === 0
    ) {
      throw new Error(
        "Excel JPA vazio ou inválido"
      );
    }

    dataJPA = dataJPA.map((row) => ({
      ...row,
      CENTRO_ORIGEM: "JPA",
      DEDUPE_KEY: rebuildDedupeKey({
        ...row,
        CENTRO_ORIGEM: "JPA",
      }),
    }));

    log(
      `📊 Registros JPA: ${dataJPA.length}`
    );

    await syncSupabase(dataJPA, "JPA");

    // ==========================================
    // CPG
    // ==========================================

    log("🏭 PROCESSANDO CPG");

    let fileCPG;

    try {
      fileCPG = await downloadLatestFile(
        process.env.ONEDRIVE_URL_CPG
      );
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") {
        log(
          "⏸️ Sessão expirada — aguardando reconexão."
        );
        return;
      }
      throw err;
    }

    if (!fileCPG) {
      throw new Error(
        "Download CPG retornou vazio"
      );
    }

    log(
      `📄 Arquivo CPG baixado: ${fileCPG}`
    );

    await delay(2000);

    let dataCPG = readExcel(
      fileCPG,
      "CPG"
    );

    if (
      !Array.isArray(dataCPG) ||
      dataCPG.length === 0
    ) {
      throw new Error(
        "Excel CPG vazio ou inválido"
      );
    }

    dataCPG = dataCPG.map((row) => ({
      ...row,
      CENTRO_ORIGEM: "CPG",
      DEDUPE_KEY: rebuildDedupeKey({
        ...row,
        CENTRO_ORIGEM: "CPG",
      }),
    }));

    log(
      `📊 Registros CPG: ${dataCPG.length}`
    );

    await syncSupabase(dataCPG, "CPG");

    log("==================================");
    log(
      "✅ JOB FINALIZADO COM SUCESSO"
    );
    log("==================================");
  } catch (err) {
    logError(err);

    log("==================================");
    log("❌ JOB FINALIZADO COM ERRO");
    log("==================================");
  } finally {
    isRunning = false;
  }
}