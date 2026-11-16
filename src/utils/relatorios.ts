import type { Emprestimo, Livro } from "../context/AcervoContext";
import { hojeISO, somarDias } from "./datas";

export type Periodo = "7d" | "30d" | "6m";

export const rotuloPeriodo: Record<Periodo, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "6m": "Últimos 6 meses",
};

const dois = (n: number) => String(n).padStart(2, "0");
const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Primeiro dia (AAAA-MM-DD) do período escolhido
export function inicioDoPeriodo(periodo: Periodo) {
  if (periodo === "7d") return somarDias(hojeISO(), -6);
  if (periodo === "30d") return somarDias(hojeISO(), -29);
  const d = new Date();
  const inicio = new Date(d.getFullYear(), d.getMonth() - 5, 1);
  return `${inicio.getFullYear()}-${dois(inicio.getMonth() + 1)}-01`;
}

export type PontoEvolucao = { rotulo: string; livros: number; emprestimos: number };

// Livros cadastrados e empréstimos feitos, por dia (7 e 30 dias) ou por mês (6 meses)
export function serieEvolucao(periodo: Periodo, livros: Livro[], emprestimos: Emprestimo[]): PontoEvolucao[] {
  if (periodo === "6m") {
    const hoje = new Date();
    const pontos: PontoEvolucao[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = `${d.getFullYear()}-${dois(d.getMonth() + 1)}`;
      pontos.push({
        rotulo: meses[d.getMonth()],
        livros: livros.filter((l) => l.cadastradoEm.startsWith(chave)).length,
        emprestimos: emprestimos.filter((e) => e.dataSaida.startsWith(chave)).length,
      });
    }
    return pontos;
  }

  const dias = periodo === "7d" ? 7 : 30;
  const pontos: PontoEvolucao[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const iso = somarDias(hojeISO(), -i);
    const [, m, d] = iso.split("-");
    pontos.push({
      rotulo: `${d}/${m}`,
      livros: livros.filter((l) => l.cadastradoEm === iso).length,
      emprestimos: emprestimos.filter((e) => e.dataSaida === iso).length,
    });
  }
  return pontos;
}

// Empréstimos feitos em cada dia da semana atual (segunda a domingo)
export function emprestimosDaSemana(emprestimos: Emprestimo[]) {
  const nomes = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const diaDaSemana = (new Date().getDay() + 6) % 7; // segunda = 0
  const segunda = somarDias(hojeISO(), -diaDaSemana);
  return nomes.map((dia, i) => {
    const iso = somarDias(segunda, i);
    return { dia, valor: emprestimos.filter((e) => e.dataSaida === iso).length };
  });
}

// Livros mais emprestados no período
export function livrosMaisEmprestados(livros: Livro[], emprestimos: Emprestimo[], inicio: string, limite = 5) {
  const contagem = new Map<number, number>();
  for (const e of emprestimos) {
    if (e.dataSaida >= inicio) contagem.set(e.livroId, (contagem.get(e.livroId) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([livroId, total]) => ({ livro: livros.find((l) => l.id === livroId), total }))
    .filter((x): x is { livro: Livro; total: number } => Boolean(x.livro))
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

// Baixa um CSV que abre certinho no Excel em português
export function baixarCsv(nomeArquivo: string, linhas: string[][]) {
  const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const conteudo = "\uFEFF" + linhas.map((l) => l.map(escapar).join(";")).join("\r\n");
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
