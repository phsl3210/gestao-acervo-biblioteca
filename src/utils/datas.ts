// Datas guardadas como "AAAA-MM-DD" (texto), sempre no horário local do aparelho.
const dois = (n: number) => String(n).padStart(2, "0");
const paraISO = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

export const hojeISO = () => paraISO(new Date());

export function somarDias(iso: string, dias: number) {
  const [a, m, d] = iso.split("-").map(Number);
  return paraISO(new Date(a, m - 1, d + dias));
}

export function formatarData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export type StatusEmprestimo = "devolvido" | "atrasado" | "vence-hoje" | "em-dia";

export function statusDoEmprestimo(e: {
  dataPrevista: string;
  dataDevolucao: string | null;
}): StatusEmprestimo {
  if (e.dataDevolucao) return "devolvido";
  const hoje = hojeISO();
  if (e.dataPrevista < hoje) return "atrasado"; // texto AAAA-MM-DD compara certo
  if (e.dataPrevista === hoje) return "vence-hoje";
  return "em-dia";
}

export const rotuloStatus: Record<StatusEmprestimo, string> = {
  devolvido: "Devolvido",
  atrasado: "Atrasado",
  "vence-hoje": "Vence hoje",
  "em-dia": "Em dia",
};

// Quantos dias de uma data até a outra (ambas AAAA-MM-DD)
export function diasEntre(deISO: string, ateISO: string) {
  const [a1, m1, d1] = deISO.split("-").map(Number);
  const [a2, m2, d2] = ateISO.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

// Data local do aparelho (AAAA-MM-DD) a partir de um Date
export const dataParaISO = paraISO;
