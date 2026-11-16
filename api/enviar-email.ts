// Função de servidor (Vercel). Roda fora do navegador, então a senha do e-mail fica segura.
// Não importa nada de ../src de propósito: tem que ser autossuficiente.
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

type Req = { method?: string; body?: any; headers?: Record<string, string | string[] | undefined> };
type Res = { status: (codigo: number) => Res; json: (corpo: unknown) => void };

const TIPOS = ["emprestimo", "devolucao", "atraso"] as const;
type Tipo = (typeof TIPOS)[number];

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const fmt = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

const texto = (v: unknown, max = 200) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null;
const data = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

function montar(tipo: Tipo, d: Record<string, any>, biblioteca: string) {
  const livro = esc(d.tituloLivro);
  const nome = esc(d.nomeAluno);

  const linhas = [
    ["Livro", `<strong>${livro}</strong>`],
    ["Autor", esc(d.autor)],
    ["Retirado em", fmt(d.dataSaida)],
    ["Devolver até", fmt(d.dataPrevista)],
  ];
  if (tipo === "devolucao") linhas.push(["Devolvido em", fmt(d.dataDevolucao)]);

  const tabela = `<table style="width:100%;border-collapse:collapse;margin:12px 0">${linhas
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#5d6a8a;width:38%">${k}</td><td style="padding:6px 0">${v}</td></tr>`
    )
    .join("")}</table>`;

  let assunto = "";
  let titulo = "";
  let intro = "";
  let fecho = "";

  if (tipo === "emprestimo") {
    assunto = `Empréstimo registrado: ${d.tituloLivro}`;
    titulo = "Empréstimo registrado";
    intro = `Olá, ${nome}! Você pegou um livro emprestado na biblioteca.`;
    fecho = "Lembre-se de devolver até a data combinada para que outros colegas também possam ler.";
  } else if (tipo === "devolucao") {
    const atrasou = d.dataDevolucao > d.dataPrevista;
    assunto = `Devolução registrada: ${d.tituloLivro}`;
    titulo = "Devolução registrada";
    intro = `Olá, ${nome}! Recebemos a devolução do seu livro.`;
    fecho = atrasou
      ? "Obrigado por devolver! Da próxima vez, procure respeitar o prazo combinado."
      : "Obrigado por devolver no prazo! Volte sempre.";
  } else {
    assunto = `Livro em atraso: ${d.tituloLivro}`;
    titulo = "Devolução em atraso";
    intro = `Olá, ${nome}! O prazo para devolver este livro já passou${
      d.diasAtraso ? ` (${d.diasAtraso} ${d.diasAtraso === 1 ? "dia" : "dias"} de atraso)` : ""
    }.`;
    fecho = "Por favor, devolva o quanto antes na biblioteca. Se já devolveu, desconsidere este aviso.";
  }

  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#14204a">
  <div style="background:#0f1f4d;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-size:18px;font-weight:bold">${esc(biblioteca)}</div>
  <div style="border:1px solid #e3e8f4;border-top:0;padding:20px;border-radius:0 0 12px 12px">
    <h2 style="margin:0 0 12px;font-size:18px">${titulo}</h2>
    <p style="margin:0 0 8px">${intro}</p>
    ${tabela}
    <p style="margin:12px 0 0">${fecho}</p>
  </div>
  <p style="color:#8a94b0;font-size:12px;text-align:center">Mensagem automática. Não responda este e-mail.</p>
</div>`;

  const plano = [
    `${titulo} - ${biblioteca}`,
    "",
    intro.replace(/&[a-z#0-9]+;/g, ""),
    `Livro: ${d.tituloLivro}`,
    `Autor: ${d.autor}`,
    `Retirado em: ${fmt(d.dataSaida)}`,
    `Devolver até: ${fmt(d.dataPrevista)}`,
    tipo === "devolucao" ? `Devolvido em: ${fmt(d.dataDevolucao)}` : "",
    "",
    fecho,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { assunto, html, plano };
}

// Só deixa passar quem está logado e é bibliotecário
async function autorizado(req: Req): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const chave = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const cabecalho = req.headers?.authorization;
  const token = typeof cabecalho === "string" && cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;
  if (!url || !chave || !token) return false;

  const cliente = createClient(url, chave, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: usuario, error } = await cliente.auth.getUser(token);
  if (error || !usuario.user) return false;
  const { data: perfil } = await cliente.from("perfis").select("papel").eq("id", usuario.user.id).maybeSingle();
  return perfil?.papel === "bibliotecario";
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido." });
  if (!(await autorizado(req))) {
    return res.status(401).json({ ok: false, erro: "Não autorizado. Entre no sistema novamente." });
  }

  const b = req.body ?? {};
  const tipo = b.tipo as Tipo;
  const dados = {
    tipo,
    para: texto(b.para),
    nomeAluno: texto(b.nomeAluno),
    tituloLivro: texto(b.tituloLivro),
    autor: texto(b.autor) ?? "Autor não informado",
    dataSaida: data(b.dataSaida),
    dataPrevista: data(b.dataPrevista),
    dataDevolucao: tipo === "devolucao" ? data(b.dataDevolucao) : null,
    diasAtraso: Number.isInteger(b.diasAtraso) && b.diasAtraso > 0 ? b.diasAtraso : 0,
  };

  const faltando =
    !TIPOS.includes(tipo) ||
    !dados.para || !emailValido(dados.para) ||
    !dados.nomeAluno || !dados.tituloLivro || !dados.dataSaida || !dados.dataPrevista ||
    (tipo === "devolucao" && !dados.dataDevolucao);
  if (faltando) return res.status(400).json({ ok: false, erro: "Dados do e-mail inválidos." });

  const usuario = process.env.GMAIL_USER;
  const senha = process.env.GMAIL_APP_PASSWORD;
  const biblioteca = process.env.NOME_BIBLIOTECA || "Biblioteca da escola";
  if (!usuario || !senha) {
    return res.status(500).json({ ok: false, erro: "Servidor de e-mail não configurado (GMAIL_USER / GMAIL_APP_PASSWORD)." });
  }

  try {
    const transporte = nodemailer.createTransport({ service: "gmail", auth: { user: usuario, pass: senha } });
    const { assunto, html, plano } = montar(tipo, dados, biblioteca);
    await transporte.sendMail({
      from: `"${biblioteca.replace(/"/g, "")}" <${usuario}>`,
      to: dados.para!,
      subject: assunto,
      text: plano,
      html,
    });
    return res.status(200).json({ ok: true });
  } catch (erro) {
    console.error("Falha ao enviar e-mail:", erro);
    return res.status(502).json({ ok: false, erro: "Não consegui enviar o e-mail. Confira a senha de app do Gmail." });
  }
}
