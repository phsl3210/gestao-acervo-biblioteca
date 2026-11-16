import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && chave);

// Valores falsos evitam quebrar a página quando o .env.local ainda não foi preenchido
export const supabase = createClient(url || "http://localhost:54321", chave || "chave-nao-configurada");
