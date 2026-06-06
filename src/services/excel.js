import xlsx from "xlsx";
import crypto from "crypto";
import { log } from "./logger.js";

// ========================================
// 🔄 MAPEAMENTO DE COLUNAS
// ========================================
const columnMap = {
  Data_Inicial: "DT_INICIAL",
  Hora_Inicial: "HR_INICIAL",
  Motorista: "MOTORISTA",
  Placa_Cavalo: "PLACA_CAVALO",
  Placa_Sider: "PLACA_CARRETA",
  UF: "UF",
  Fornecedor: "FORNECEDOR",
  Transportadora: "TRANSPORTADOR",
  "Nº_Ord": "NUM_ORDEM",
  Material: "MATERIAL",
  Destino: "DESTINO",
  Data_Romaneio: "DT_ROMANEIO",
  Hora_Romaneio: "HR_ROMANEIO",
  Data_Entrada: "DT_ENTRADA",
  Hora_Entrada: "HR_ENTRADA",
  "Data_Saída": "DT_SAIDA",
  "Hora_Saída": "HR_SAIDA",
  Status: "STATUS",
  "T._Entrada": "TRANSPORTE_ENTRADA",
  "T._Saída": "TRANSPORTE_SAIDA",
  Observações: "OBSERVACAO",
};

// ========================================
// 🔒 COLUNAS PERMITIDAS
// ========================================
const allowedColumns = new Set([
  "DT_INICIAL",
  "HR_INICIAL",
  "MOTORISTA",
  "PLACA_CAVALO",
  "PLACA_CARRETA",
  "UF",
  "FORNECEDOR",
  "TRANSPORTADOR",
  "NUM_ORDEM",
  "MATERIAL",
  "DESTINO",
  "DT_ROMANEIO",
  "HR_ROMANEIO",
  "DT_ENTRADA",
  "HR_ENTRADA",
  "DT_SAIDA",
  "HR_SAIDA",
  "STATUS",
  "TRANSPORTE_ENTRADA",
  "TRANSPORTE_SAIDA",
  "OBSERVACAO",
  "CENTRO_ORIGEM",
  "DOCA",
  "PRIORIDADE",
  "DEDUPE_KEY",
  "ROW_HASH",
]);

// ========================================
// 🧠 NORMALIZA COLUNAS
// ========================================
function normalizeColumns(row) {
  const newRow = {};

  Object.keys(row).forEach((key) => {
    if (!key) return;

    if (
      key.startsWith("__EMPTY") ||
      key.includes("EMPTY") ||
      key.toUpperCase().includes("TIME1")
    ) {
      return;
    }

    const cleanKey = key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s_]+/g, "")
      .toUpperCase();

    const match = Object.keys(columnMap).find((k) => {
      const kClean = k
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s_]+/g, "")
        .toUpperCase();

      return kClean === cleanKey;
    });

    const finalKey = match
      ? columnMap[match]
      : cleanKey;

    if (!allowedColumns.has(finalKey)) {
      return;
    }

    newRow[finalKey] = row[key];
  });

  return newRow;
}

// ========================================
// 📅 DATA
// ========================================
function excelDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const v = value.trim().toLowerCase();

    if (
      v === "n/a" ||
      v === "na" ||
      v === "null" ||
      v === "-" ||
      v === "--" ||
      v === ""
    ) {
      return null;
    }

    const d = new Date(value);

    if (
      isNaN(d) ||
      d.getFullYear() < 2000 ||
      d.getFullYear() > 2100
    ) {
      return null;
    }

    return d.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const d = new Date(
      (value - 25569) * 86400 * 1000
    );

    if (
      isNaN(d) ||
      d.getFullYear() < 2000 ||
      d.getFullYear() > 2100
    ) {
      return null;
    }

    return d.toISOString().slice(0, 10);
  }

  return null;
}

// ========================================
// ⏱️ HORA
// ========================================
function excelTime(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const v = value.trim().toLowerCase();

    if (
      v === "n/a" ||
      v === "na" ||
      v === "null" ||
      v === "-" ||
      v === "--" ||
      v === ""
    ) {
      return null;
    }

    if (v.includes(":")) {
      return v.slice(0, 5);
    }

    return null;
  }

  if (typeof value === "number") {
    if (value < 0 || value > 1) {
      return null;
    }

    const total = Math.round(value * 86400);

    const h = String(
      Math.floor(total / 3600)
    ).padStart(2, "0");

    const m = String(
      Math.floor((total % 3600) / 60)
    ).padStart(2, "0");

    return `${h}:${m}`;
  }

  return null;
}

// ========================================
// 🚚 FORMATA PLACA
// ========================================
function formatPlaca(p) {
  if (!p) return null;

  const c = String(p)
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();

  return c.length === 7
    ? `${c.slice(0, 3)}-${c.slice(3)}`
    : c;
}

// ========================================
// 🔑 CHAVE FIXA (DEVE SER IGUAL AO TRIGGER DO BANCO)
// ========================================
function createDedupeKey(record) {
  const centroOrigem = String(record.CENTRO_ORIGEM || "JPA").trim().toUpperCase();
  const dtInicial = String(record.DT_INICIAL || "").trim().toUpperCase();

  // O banco salva a hora como HH:MM:00, então precisamos adicionar :00
  let hrInicial = String(record.HR_INICIAL || "").trim().toUpperCase();
  if (hrInicial && hrInicial.length === 5) {
    hrInicial += ":00";
  }

  const placaCavalo = String(record.PLACA_CAVALO || "").trim().toUpperCase();

  return [centroOrigem, dtInicial, hrInicial, placaCavalo].join("|");
}

// ========================================
// 🔄 HASH DAS COLUNAS MONITORADAS
// ========================================
function createRowHash(record) {
  const monitoredFields = [
    "DT_INICIAL",
    "HR_INICIAL",
    "MOTORISTA",
    "PLACA_CAVALO",
    "PLACA_CARRETA",
    "UF",
    "FORNECEDOR",
    "TRANSPORTADOR",
    "NUM_ORDEM",
    "MATERIAL",
    "DESTINO",
    "DT_ROMANEIO",
    "HR_ROMANEIO",
    "DT_ENTRADA",
    "HR_ENTRADA",
    "DT_SAIDA",
    "HR_SAIDA",
    "STATUS",
  ];

  const raw = monitoredFields
    .map((field) =>
      String(record[field] || "")
        .trim()
        .toUpperCase()
    )
    .join("|");

  return crypto
    .createHash("md5")
    .update(raw)
    .digest("hex");
}

// ========================================
// ✅ VALIDAÇÃO
// ========================================
function isValid(r) {
  return (
    r.DT_INICIAL &&
    r.HR_INICIAL &&
    r.PLACA_CAVALO &&
    r.DESTINO &&
    r.STATUS
  );
}

// ========================================
// 📖 PRINCIPAL
// ========================================
export function readExcel(filePath, centroOrigem = "JPA") {
  if (!filePath) {
    throw new Error(
      "❌ Caminho do arquivo não informado"
    );
  }

  log("📖 Lendo Excel...");

  // const workbook = xlsx.readFile(filePath);

  log("📖 Abrindo arquivo...");

  const workbook = xlsx.readFile(filePath);

  log("✅ Arquivo aberto");

  const sheet =
    workbook.Sheets[workbook.SheetNames[0]];

  log(`📄 Nome Sheet: ${workbook.SheetNames[0]}`);
  log(`📏 Range: ${sheet["!ref"]}`);

  log("✅ Sheet encontrada");

  log("🔄 Convertendo planilha...");

  const raw = xlsx.utils.sheet_to_json(sheet, {
    range: 3,
    defval: null,
    raw: true,
  });

  log("✅ Conversão concluída");

  log(`📊 Linhas brutas: ${raw.length}`);

  const valid = [];
  const ignored = [];
  log(`📊 Linhas brutas: ${raw.length}`);

  raw.forEach((row, i) => {

    if (i % 500 === 0) {
      log(`🔄 Processando linha ${i}`);
    }

    const n = normalizeColumns(row);

    if (n.STATUS) {
      n.STATUS = n.STATUS
        .toString()
        .trim()
        .toUpperCase();
    }

    const record = {
      ...n,

      CENTRO_ORIGEM: centroOrigem,

      DOCA: n.DOCA || 1,

      PRIORIDADE:
        n.PRIORIDADE || "NORMAL",

      DT_INICIAL: excelDate(
        n.DT_INICIAL
      ),

      DT_ROMANEIO: excelDate(
        n.DT_ROMANEIO
      ),

      DT_ENTRADA: excelDate(
        n.DT_ENTRADA
      ),

      DT_SAIDA: excelDate(
        n.DT_SAIDA
      ),

      HR_INICIAL: excelTime(
        n.HR_INICIAL
      ),

      HR_ROMANEIO: excelTime(
        n.HR_ROMANEIO
      ),

      HR_ENTRADA: excelTime(
        n.HR_ENTRADA
      ),

      HR_SAIDA: excelTime(
        n.HR_SAIDA
      ),

      PLACA_CAVALO: formatPlaca(
        n.PLACA_CAVALO
      ),

      PLACA_CARRETA: formatPlaca(
        n.PLACA_CARRETA
      ),
    };

    // ========================================
    // 🔑 CHAVE FIXA
    // ========================================
    record.DEDUPE_KEY =
      createDedupeKey(record);

    // ========================================
    // 🔄 HASH ALTERAÇÕES
    // ========================================
    record.ROW_HASH =
      createRowHash(record);

    if (isValid(record)) {
      valid.push(record);
    } else {
      ignored.push(i + 4);
    }
  });

  log(`📊 TOTAL: ${raw.length}`);

  log(`✅ VÁLIDOS: ${valid.length}`);

  log(`❌ IGNORADOS: ${ignored.length}`);

  return valid;
}