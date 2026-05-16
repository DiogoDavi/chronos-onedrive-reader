/**
 * Salva e restaura cookies da sessão Microsoft no Supabase
 * Assim a sessão persiste mesmo quando o Render reinicia
 */

import { createClient } from "@supabase/supabase-js";
import { log } from "./logger.js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =============================================
// salva cookies no Supabase
// =============================================
export async function saveSession(cookies) {
    const { error } = await supabase
        .from("app_sessions")
        .upsert({
            id: "microsoft_session",
            cookies: cookies,
            updated_at: new Date().toISOString()
        });

    if (error) {
        log(`⚠️ Erro ao salvar sessão: ${error.message}`);
        return false;
    }

    await setSessionStatus("active");
    log("💾 Sessão salva no Supabase");
    return true;
}

// =============================================
// restaura cookies do Supabase para o browser
// =============================================
export async function restoreSession(page) {
    const { data, error } = await supabase
        .from("app_sessions")
        .select("cookies, updated_at")
        .eq("id", "microsoft_session")
        .single();

    if (error || !data?.cookies?.length) {
        log("⚠️ Nenhuma sessão salva encontrada");
        return false;
    }

    // verifica se sessão tem menos de 25 dias
    const updatedAt = new Date(data.updated_at);
    const diasDesdeUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (diasDesdeUpdate > 25) {
        log(`⚠️ Sessão expirada (${Math.floor(diasDesdeUpdate)} dias)`);
        await setSessionStatus("expired");
        return false;
    }

    // restaura cookies no browser
    for (const cookie of data.cookies) {
        try {
            await page.setCookie(cookie);
        } catch (e) { }
    }

    log(`✅ Sessão restaurada (${Math.floor(diasDesdeUpdate)} dias de idade)`);
    return true;
}

// =============================================
// atualiza status da sessão
// =============================================
export async function setSessionStatus(status) {
    await supabase
        .from("app_config")
        .upsert({
            key: "session_status",
            value: status,
            updated_at: new Date().toISOString()
        });
}

// =============================================
// retorna status atual
// =============================================
export async function getSessionStatus() {
    const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "session_status")
        .single();

    return data?.value || "expired";
}