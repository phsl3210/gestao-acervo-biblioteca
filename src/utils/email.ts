import { supabase } from "../lib/supabase";

export type TipoEmail = "emprestimo" | "devolucao" | "atraso";

export type DadosEmail = {
  tipo: TipoEmail;
  para: string;
  nomeAluno: string;
  tituloLivro: string;
  autor: string;
  dataSaida: string; // AAAA-MM-DD
  dataPrevista: string; // AAAA-MM-DD
  dataDevolucao?: string; // só na devolução
  diasAtraso?: number; // só no atraso
};

export type ResultadoEmail = { ok: true } | { ok: false; erro: string };

export async function enviarEmail(dados: DadosEmail): Promise<ResultadoEmail> {
  try {
    // O servidor só manda e-mail pra quem está logado como bibliotecário
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, erro: "você precisa estar logado" };

    const resp = await fetch("/api/enviar-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(dados),
    });
    // Se o servidor de e-mail não existir, o Vite devolve uma página HTML: não é JSON.
    const json = await resp.json().catch(() => null);
    if (!json) return { ok: false, erro: "servidor de e-mail indisponível" };
    if (resp.ok && json.ok) return { ok: true };
    return { ok: false, erro: json.erro ?? `erro ${resp.status}` };
  } catch {
    return { ok: false, erro: "sem conexão com o servidor de e-mail" };
  }
}
