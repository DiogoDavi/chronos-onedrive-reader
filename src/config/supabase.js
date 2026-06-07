import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || typeof supabaseUrl !== "string") {
  throw new Error(
    "❌ SUPABASE_URL inválida ou não configurada"
  );
}

if (!supabaseKey || typeof supabaseKey !== "string") {
  throw new Error(
    "❌ SUPABASE_SERVICE_ROLE_KEY inválida"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);