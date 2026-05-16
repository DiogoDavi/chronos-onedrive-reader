import fs from "fs";
import path from "path";

/**
 * Delay assíncrono (sleep)
 */
export const delay = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Verifica se arquivo existe
 */
export function fileExists(filePath) {
    if (!filePath || typeof filePath !== "string") return false;
    return fs.existsSync(filePath);
}

/**
 * Cria pasta se não existir
 */
export function ensureDir(dirPath) {
    if (!dirPath || typeof dirPath !== "string") return;

    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    } catch (err) {
        throw new Error("❌ Erro ao criar diretório: " + err.message);
    }
}

/**
 * Pega o arquivo mais recente de uma pasta
 */
export function getLatestFile(dirPath) {
    if (!dirPath || !fs.existsSync(dirPath)) return null;

    const files = fs.readdirSync(dirPath);
    if (!Array.isArray(files) || files.length === 0) return null;

    try {
        const latest = files
            .map((file) => {
                const full = path.join(dirPath, file);
                return {
                    file: full,
                    time: fs.statSync(full).mtime.getTime(),
                };
            })
            .filter((f) => fs.existsSync(f.file))
            .sort((a, b) => b.time - a.time)[0];

        return latest?.file || null;
    } catch {
        return null;
    }
}

/**
 * Retry genérico para funções async (versão production-safe)
 */
export async function retry(fn, attempts = 3, delayMs = 2000) {
    if (typeof fn !== "function") {
        throw new Error("❌ retry espera uma função");
    }

    let lastError;

    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;

            // último attempt não espera
            if (i < attempts - 1) {
                await delay(delayMs);
            }
        }
    }

    throw lastError;
}