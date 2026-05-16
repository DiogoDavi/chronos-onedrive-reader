// import { supabase } from "../config/supabase.js";
// import { log, logError } from "./logger.js";

// const CHUNK_SIZE = 500;

// export async function supabaseInsert(rows) {
//     if (!Array.isArray(rows)) {
//         throw new Error("❌ Dados inválidos: esperado array");
//     }

//     const table = process.env.SUPABASE_TABLE;

//     if (!table) {
//         throw new Error("❌ SUPABASE_TABLE não configurada no .env");
//     }

//     log(`☁️ Enviando ${rows.length} registros ao Supabase (${table})...`);

//     for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
//         const chunk = rows.slice(i, i + CHUNK_SIZE);

//         try {
//             const { error } = await supabase
//                 .from(table)
//                 .upsert(chunk, {
//                     onConflict: "dedupe_key",
//                     ignoreDuplicates: true,
//                 });

//             if (error) {
//                 logError(error);
//                 throw error;
//             }

//             log(`✔ Enviado lote ${i + 1} - ${i + chunk.length}`);
//         } catch (err) {
//             logError(err);
//             throw err;
//         }
//     }

//     log("✅ Todos os dados enviados ao Supabase");
// }



import { supabase } from "../config/supabase.js";
import { log, logError } from "./logger.js";

const CHUNK_SIZE = 500;

// ========================================
// 🔄 FUNÇÕES AUXILIARES DE LOTE (CHUNKS)
// ========================================
async function processUpsertChunks(table, records) {
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        try {
            const { error } = await supabase
                .from(table)
                .upsert(chunk, { onConflict: "dedupe_key" });

            if (error) throw error;
            log(`✔ Lote processado: ${i + 1} até ${Math.min(i + CHUNK_SIZE, records.length)}`);
        } catch (err) {
            logError(err);
            throw err;
        }
    }
}

async function processDeleteChunks(table, keys) {
    for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
        const chunk = keys.slice(i, i + CHUNK_SIZE);
        try {
            const { error } = await supabase
                .from(table)
                .delete()
                .in("dedupe_key", chunk);

            if (error) throw error;
            log(`✔ Lote deletado: ${i + 1} até ${Math.min(i + CHUNK_SIZE, keys.length)}`);
        } catch (err) {
            logError(err);
            throw err;
        }
    }
}

// ========================================
// 🔄 SYNC TOTAL INTELIGENTE
// ========================================
export async function syncSupabase(rows) {
    if (!Array.isArray(rows)) {
        throw new Error("❌ Dados inválidos");
    }

    const table = process.env.SUPABASE_TABLE;
    if (!table) {
        throw new Error("❌ SUPABASE_TABLE não configurada");
    }

    log(`☁️ Iniciando sincronização inteligente de ${rows.length} registros...`);

    // 1. Normalizar para garantir que as chaves fiquem lowercase (padrão DB)
    let normalizedRows = rows.map(r => {
        const { DEDUPE_KEY, ROW_HASH, ...rest } = r;
        return {
            ...rest,
            dedupe_key: DEDUPE_KEY || r.dedupe_key,
            row_hash: ROW_HASH || r.row_hash
        };
    });

    // 1.5 Remover duplicatas DENTRO do próprio Excel para não travar o banco
    const uniqueMap = new Map();
    for (const r of normalizedRows) {
        if (!r.dedupe_key) continue;
        // Se houver dois registros com o mesmo dedupe_key no Excel, mantemos o último
        uniqueMap.set(r.dedupe_key, r);
    }
    normalizedRows = Array.from(uniqueMap.values());

    // 2. Buscar registros existentes (com paginação para evitar limites)
    log("🔍 Buscando registros existentes no banco...");
    let existingRecords = [];
    let from = 0;
    const limit = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select("dedupe_key, row_hash")
            .range(from, from + limit - 1);
            
        if (error) {
            if (error.message.includes("row_hash")) {
                throw new Error("❌ COLUNA 'row_hash' NÃO ENCONTRADA: Você precisa criar a coluna 'row_hash' (tipo text) no Supabase!");
            }
            throw new Error(`Erro ao buscar dados: ${error.message}`);
        }
        
        if (!data || data.length === 0) break;
        existingRecords = existingRecords.concat(data);
        
        if (data.length < limit) break;
        from += limit;
    }

    log(`✅ ${existingRecords.length} registros encontrados no banco.`);

    // 3. Criar mapa para comparação rápida
    const existingMap = new Map();
    existingRecords.forEach(r => existingMap.set(r.dedupe_key, r.row_hash));

    // 4. Segregar operações: INSERT, UPDATE, DELETE
    const recordsToInsert = [];
    const recordsToUpdate = [];
    const excelKeys = new Set();

    for (const row of normalizedRows) {
        const key = row.dedupe_key;
        const hash = row.row_hash;
        excelKeys.add(key);

        if (!existingMap.has(key)) {
            // Não existe no DB -> INSERT
            recordsToInsert.push(row);
        } else {
            // Existe no DB, verificar se mudou -> UPDATE
            const existingHash = existingMap.get(key);
            if (existingHash !== hash) {
                recordsToUpdate.push(row);
            }
        }
    }

    // O que tem no DB mas não tem no Excel -> DELETE
    const keysToDelete = existingRecords
        .filter(r => !excelKeys.has(r.dedupe_key))
        .map(r => r.dedupe_key);

    // 5. Executar Operações
    log("==================================");
    log(`📊 RESUMO DA SINCRONIZAÇÃO`);
    log(`➕ Novos (INSERT): ${recordsToInsert.length}`);
    log(`🔄 Modificados (UPDATE): ${recordsToUpdate.length}`);
    log(`🗑️ Removidos (DELETE): ${keysToDelete.length}`);
    log(`⏭️ Sem alterações (IGNORADOS): ${normalizedRows.length - recordsToInsert.length - recordsToUpdate.length}`);
    log("==================================");

    if (recordsToInsert.length > 0) {
        log("➕ Inserindo novos registros...");
        await processUpsertChunks(table, recordsToInsert);
    }

    if (recordsToUpdate.length > 0) {
        log("🔄 Atualizando registros modificados...");
        await processUpsertChunks(table, recordsToUpdate);
    }

    if (keysToDelete.length > 0) {
        log("🗑️ Removendo registros ausentes...");
        await processDeleteChunks(table, keysToDelete);
    }

    log("✅ SINCRONIZAÇÃO FINALIZADA COM SUCESSO");
}