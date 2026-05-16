import fs from "fs";
import path from "path";

const LOG_DIR = "./logs";
const LOG_FILE = path.join(LOG_DIR, "system.log");

// garante pasta (evita ENOTDIR e crash)
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Serializa qualquer tipo de erro/dado com segurança
 */
function safeStringify(data) {
  if (data instanceof Error) {
    return data.stack || data.message;
  }

  if (typeof data === "object") {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  return String(data);
}

/**
 * Escrita central de log
 */
function write(level, msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${safeStringify(msg)}`;

  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch (err) {
    console.error("❌ Falha ao escrever log:", err);
  }

  console.log(line);
}

/**
 * INFO
 */
export function log(msg) {
  write("INFO", msg);
}

/**
 * ERROR (corrigido para não virar [object Object])
 */
export function logError(error) {
  write("ERROR", error);
}