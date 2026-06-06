import { supabase } from "../config/supabase.js";
import { log, logError } from "./logger.js";

const CHUNK_SIZE = 500;

// ========================================
// 🔄 UPSERT EM LOTES
// ========================================
async function processUpsertChunks(
    table,
    records
) {
    for (
        let i = 0;
        i < records.length;
        i += CHUNK_SIZE
    ) {
        const chunk = records.slice(
            i,
            i + CHUNK_SIZE
        );

        try {
            const { error } = await supabase
                .from(table)
                .upsert(chunk, {
                    onConflict: "dedupe_key",
                });

            if (error) throw error;

            log(
                `✔ Lote processado: ${i + 1
                } até ${Math.min(
                    i + CHUNK_SIZE,
                    records.length
                )}`
            );
        } catch (err) {
            logError(err);
            throw err;
        }
    }
}

// ========================================
// 🗑️ DELETE EM LOTES
// ========================================
async function processDeleteChunks(
    table,
    keys,
    centroOrigem
) {
    for (
        let i = 0;
        i < keys.length;
        i += CHUNK_SIZE
    ) {
        const chunk = keys.slice(
            i,
            i + CHUNK_SIZE
        );

        try {
            const { error } = await supabase
                .from(table)
                .delete()
                .eq(
                    "CENTRO_ORIGEM",
                    centroOrigem
                )
                .in("dedupe_key", chunk);

            if (error) throw error;

            log(
                `✔ Lote deletado: ${i + 1
                } até ${Math.min(
                    i + CHUNK_SIZE,
                    keys.length
                )}`
            );
        } catch (err) {
            logError(err);
            throw err;
        }
    }
}

// ========================================
// 🔄 SINCRONIZAÇÃO INTELIGENTE
// ========================================
export async function syncSupabase(
    rows
) {
    if (!Array.isArray(rows)) {
        throw new Error(
            "❌ Dados inválidos"
        );
    }

    if (rows.length === 0) {
        log(
            "⚠️ Nenhum registro recebido"
        );
        return;
    }

    const table =
        process.env.SUPABASE_TABLE;

    if (!table) {
        throw new Error(
            "❌ SUPABASE_TABLE não configurada"
        );
    }

    const centroOrigem =
        rows[0]?.CENTRO_ORIGEM ||
        rows[0]?.centro_origem;

    log(
        `🏭 Centro origem: ${centroOrigem}`
    );

    log(
        `☁️ Iniciando sincronização inteligente de ${rows.length} registros...`
    );

    // ========================================
    // NORMALIZA
    // ========================================

    let normalizedRows = rows.map(
        (r) => {
            const {
                DEDUPE_KEY,
                ROW_HASH,
                ...rest
            } = r;

            return {
                ...rest,

                dedupe_key:
                    DEDUPE_KEY ||
                    r.dedupe_key,

                row_hash:
                    ROW_HASH ||
                    r.row_hash,
            };
        }
    );

    // ========================================
    // REMOVE DUPLICADOS
    // ========================================

    const uniqueMap = new Map();

    for (const row of normalizedRows) {
        if (!row.dedupe_key) continue;

        uniqueMap.set(
            row.dedupe_key,
            row
        );
    }

    normalizedRows = Array.from(
        uniqueMap.values()
    );

    // ========================================
    // BUSCA SOMENTE O CENTRO
    // ========================================

    log(
        `🔍 Buscando registros do centro ${centroOrigem}...`
    );

    let existingRecords = [];

    let from = 0;

    const limit = 1000;

    while (true) {
        const { data, error } =
            await supabase
                .from(table)
                .select(
                    "dedupe_key,row_hash,CENTRO_ORIGEM"
                )
                .eq(
                    "CENTRO_ORIGEM",
                    centroOrigem
                )
                .range(
                    from,
                    from + limit - 1
                );

        if (error) {
            throw new Error(
                `Erro ao buscar dados: ${error.message}`
            );
        }

        if (
            !data ||
            data.length === 0
        ) {
            break;
        }

        existingRecords =
            existingRecords.concat(data);

        if (data.length < limit) {
            break;
        }

        from += limit;
    }

    log(
        `✅ ${existingRecords.length} registros encontrados para ${centroOrigem}`
    );

    // ========================================
    // MAPA EXISTENTE
    // ========================================

    const existingMap = new Map();

    existingRecords.forEach((r) =>
        existingMap.set(
            r.dedupe_key,
            r.row_hash
        )
    );

    // ========================================
    // COMPARAÇÃO
    // ========================================

    const recordsToInsert = [];
    const recordsToUpdate = [];

    const excelKeys = new Set();

    for (const row of normalizedRows) {
        const key = row.dedupe_key;
        const hash = row.row_hash;

        excelKeys.add(key);

        if (!existingMap.has(key)) {
            recordsToInsert.push(row);
            continue;
        }

        const existingHash =
            existingMap.get(key);

        if (existingHash !== hash) {
            recordsToUpdate.push(row);
        }
    }

    // ========================================
    // DELETE APENAS DO CENTRO
    // ========================================

    const keysToDelete =
        existingRecords
            .filter(
                (r) =>
                    !excelKeys.has(
                        r.dedupe_key
                    )
            )
            .map((r) => r.dedupe_key);

    // ========================================
    // RESUMO
    // ========================================

    log(
        "=================================="
    );

    log(
        `🏭 SINCRONIZANDO ${centroOrigem}`
    );

    log(
        `➕ Novos: ${recordsToInsert.length}`
    );

    log(
        `🔄 Atualizar: ${recordsToUpdate.length}`
    );

    log(
        `🗑️ Remover: ${keysToDelete.length}`
    );

    log(
        `⏭️ Ignorados: ${normalizedRows.length -
        recordsToInsert.length -
        recordsToUpdate.length
        }`
    );

    log(
        "=================================="
    );

    // ========================================
    // INSERT
    // ========================================

    if (
        recordsToInsert.length > 0
    ) {
        log(
            "➕ Inserindo novos registros..."
        );

        await processUpsertChunks(
            table,
            recordsToInsert
        );
    }

    // ========================================
    // UPDATE
    // ========================================

    if (
        recordsToUpdate.length > 0
    ) {
        log(
            "🔄 Atualizando registros..."
        );

        await processUpsertChunks(
            table,
            recordsToUpdate
        );
    }

    // ========================================
    // DELETE
    // ========================================

    if (
        keysToDelete.length > 0
    ) {
        log(
            "🗑️ Removendo registros ausentes..."
        );

        await processDeleteChunks(
            table,
            keysToDelete,
            centroOrigem
        );
    }

    log(
        "✅ SINCRONIZAÇÃO FINALIZADA COM SUCESSO"
    );
}