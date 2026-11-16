import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { StatusEmprestimo } from "./datas";

type RGB = [number, number, number];

const AZUL_ESCURO: RGB = [15, 31, 77];
const AZUL: RGB = [47, 98, 224];
const CIANO: RGB = [34, 184, 207];
const VERMELHO: RGB = [179, 38, 30];
const TEXTO: RGB = [20, 32, 74];
const SUAVE: RGB = [93, 106, 138];
const BORDA: RGB = [227, 232, 244];
const FUNDO: RGB = [245, 247, 252];

const rgb = (hex: string): RGB => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Cores do selo de situação nas tabelas
const coresStatus: Record<StatusEmprestimo, { fundo: RGB; texto: RGB }> = {
  "em-dia": { fundo: [227, 246, 234], texto: [31, 122, 69] },
  "vence-hoje": { fundo: [255, 241, 214], texto: [154, 98, 0] },
  atrasado: { fundo: [253, 230, 228], texto: [179, 38, 30] },
  devolvido: { fundo: [236, 239, 246], texto: [93, 106, 138] },
};

export type DadosRelatorio = {
  biblioteca: string;
  periodo: string;
  geradoPor: string;
  kpis: {
    titulos: number;
    exemplares: number;
    ativos: number;
    atrasados: number;
    alunos: number;
    emprestimosNoPeriodo: number;
    novosNoPeriodo: number;
    circulacao: number; // %
  };
  situacao: { nome: string; valor: number; cor: string }[];
  semana: { dia: string; valor: number }[];
  top: { titulo: string; autor: string; total: number }[];
  atrasados: { livro: string; aluno: string; turma: string; email: string; prevista: string; dias: number }[];
  emprestimos: {
    livro: string; aluno: string; turma: string; saida: string;
    prevista: string; devolucao: string; status: StatusEmprestimo; rotulo: string;
  }[];
};

export function gerarRelatorioPdf(d: DadosRelatorio) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14; // margem
  let y = 0;

  const agora = new Date();
  const geradoEm = agora.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  // ---------- faixa do topo ----------
  doc.setFillColor(...AZUL_ESCURO);
  doc.rect(0, 0, W, 36, "F");
  doc.setFillColor(...AZUL);
  doc.rect(0, 36, W, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(d.biblioteca, M, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(205, 214, 240);
  doc.text("Relatório do acervo e dos empréstimos", M, 22);
  doc.text(`Período: ${d.periodo}`, M, 28);
  doc.setFontSize(9);
  doc.text(`Gerado em ${geradoEm}`, W - M, 22, { align: "right" });
  doc.text(`por ${d.geradoPor}`, W - M, 28, { align: "right" });

  y = 48;

  // ---------- ajudantes ----------
  const garantirEspaco = (altura: number) => {
    if (y + altura > H - 18) {
      doc.addPage();
      y = 20;
    }
  };

  const tituloSecao = (texto: string, x = M, yy = y) => {
    doc.setFillColor(...AZUL);
    doc.rect(x, yy - 3.8, 1.3, 5.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...TEXTO);
    doc.text(texto, x + 3.5, yy);
  };

  const fimDaTabela = () => (doc as any).lastAutoTable.finalY as number;

  // ---------- cards com os números ----------
  const cards = [
    { rotulo: "Títulos no acervo", valor: d.kpis.titulos, sub: `${d.kpis.exemplares} exemplares`, cor: AZUL },
    { rotulo: "Empréstimos ativos", valor: d.kpis.ativos, sub: `${d.kpis.emprestimosNoPeriodo} no período`, cor: AZUL },
    { rotulo: "Alunos cadastrados", valor: d.kpis.alunos, sub: "limite de 4 livros", cor: AZUL },
    {
      rotulo: "Devoluções atrasadas",
      valor: d.kpis.atrasados,
      sub: d.kpis.ativos ? `${Math.round((d.kpis.atrasados / d.kpis.ativos) * 100)}% dos ativos` : "nenhum ativo",
      cor: d.kpis.atrasados > 0 ? VERMELHO : AZUL,
    },
  ];
  const gap = 4;
  const larguraCard = (W - 2 * M - gap * 3) / 4;
  cards.forEach((c, i) => {
    const x = M + i * (larguraCard + gap);
    doc.setFillColor(...FUNDO);
    doc.setDrawColor(...BORDA);
    doc.roundedRect(x, y, larguraCard, 25, 2.5, 2.5, "FD");
    doc.setFillColor(...c.cor);
    doc.roundedRect(x, y, 1.6, 25, 0.8, 0.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUAVE);
    doc.text(c.rotulo, x + 5, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...c.cor);
    doc.text(c.valor.toLocaleString("pt-BR"), x + 5, y + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SUAVE);
    doc.text(c.sub, x + 5, y + 22);
  });
  y += 25 + 12;

  // ---------- situação dos exemplares (esq.) e empréstimos da semana (dir.) ----------
  garantirEspaco(60);
  const larguraCol = (W - 2 * M - 10) / 2;
  const xDir = M + larguraCol + 10;

  // esquerda: barra empilhada
  tituloSecao("Situação dos exemplares", M, y);
  const totalExemplares = d.situacao.reduce((s, x) => s + x.valor, 0);
  const yBarra = y + 6;
  doc.setFillColor(...BORDA);
  doc.roundedRect(M, yBarra, larguraCol, 7, 2, 2, "F");
  if (totalExemplares > 0) {
    let xAtual = M;
    d.situacao.forEach((s) => {
      const largura = (s.valor / totalExemplares) * larguraCol;
      if (largura <= 0) return;
      doc.setFillColor(...rgb(s.cor));
      doc.rect(xAtual, yBarra, largura, 7, "F");
      xAtual += largura;
    });
  }
  let yLeg = yBarra + 15;
  doc.setFontSize(9);
  d.situacao.forEach((s) => {
    doc.setFillColor(...rgb(s.cor));
    doc.roundedRect(M, yLeg - 3, 3.4, 3.4, 0.8, 0.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SUAVE);
    doc.text(s.nome, M + 6, yLeg);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXTO);
    const pct = totalExemplares ? Math.round((s.valor / totalExemplares) * 100) : 0;
    doc.text(`${s.valor}  (${pct}%)`, M + larguraCol, yLeg, { align: "right" });
    yLeg += 7;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUAVE);
  doc.text(
    totalExemplares
      ? `Circulação: ${d.kpis.circulacao}% dos ${totalExemplares} exemplares estão emprestados.`
      : "Nenhum exemplar cadastrado ainda.",
    M,
    yLeg + 2
  );

  // direita: barras por dia da semana
  const totalSemana = d.semana.reduce((s, x) => s + x.valor, 0);
  tituloSecao(`Empréstimos da semana (${totalSemana})`, xDir, y);
  const maior = Math.max(...d.semana.map((x) => x.valor), 1);
  const baseY = y + 6 + 34;
  const gapBarra = 3;
  const larguraBarra = (larguraCol - gapBarra * 6) / 7;
  d.semana.forEach((dia, i) => {
    const x = xDir + i * (larguraBarra + gapBarra);
    const alt = Math.max((dia.valor / maior) * 28, dia.valor > 0 ? 1.5 : 0);
    doc.setFillColor(...(dia.valor === maior && dia.valor > 0 ? CIANO : AZUL));
    if (alt > 0) doc.roundedRect(x, baseY - alt, larguraBarra, alt, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TEXTO);
    doc.text(String(dia.valor), x + larguraBarra / 2, baseY - alt - 1.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SUAVE);
    doc.text(dia.dia, x + larguraBarra / 2, baseY + 5, { align: "center" });
  });
  doc.setDrawColor(...BORDA);
  doc.line(xDir, baseY + 0.5, xDir + larguraCol, baseY + 0.5);

  y += 60;

  // ---------- livros mais emprestados ----------
  garantirEspaco(40);
  tituloSecao("Livros mais emprestados no período");
  if (d.top.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...SUAVE);
    doc.text("Nenhum empréstimo no período.", M, y + 8);
    y += 18;
  } else {
    autoTable(doc, {
      startY: y + 4,
      margin: { left: M, right: M },
      head: [["#", "Livro", "Autor", "Empréstimos"]],
      body: d.top.map((t, i) => [String(i + 1), t.titulo, t.autor, `${t.total}x`]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2.2, textColor: TEXTO, lineColor: BORDA, lineWidth: { bottom: 0.2 } },
      headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: FUNDO },
      columnStyles: { 0: { cellWidth: 10, halign: "center" }, 3: { cellWidth: 28, halign: "center", fontStyle: "bold" } },
    });
    y = fimDaTabela() + 12;
  }

  // ---------- atrasados ----------
  if (d.atrasados.length > 0) {
    garantirEspaco(40);
    tituloSecao(`Atenção: devoluções em atraso (${d.atrasados.length})`);
    autoTable(doc, {
      startY: y + 4,
      margin: { left: M, right: M },
      head: [["Livro", "Aluno", "Turma", "E-mail", "Devolver até", "Atraso"]],
      body: d.atrasados.map((a) => [a.livro, a.aluno, a.turma, a.email, a.prevista, `${a.dias} ${a.dias === 1 ? "dia" : "dias"}`]),
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: 2.2, textColor: TEXTO, lineColor: BORDA, lineWidth: { bottom: 0.2 } },
      headStyles: { fillColor: VERMELHO, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [254, 246, 245] },
      columnStyles: { 4: { cellWidth: 24 }, 5: { cellWidth: 18, fontStyle: "bold", textColor: VERMELHO } },
    });
    y = fimDaTabela() + 12;
  }

  // ---------- todos os empréstimos do período ----------
  garantirEspaco(40);
  tituloSecao(`Empréstimos do período (${d.emprestimos.length})`);
  if (d.emprestimos.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...SUAVE);
    doc.text("Nenhum empréstimo no período.", M, y + 8);
  } else {
    autoTable(doc, {
      startY: y + 4,
      margin: { left: M, right: M },
      head: [["Livro", "Aluno", "Turma", "Retirada", "Devolver até", "Devolvido", "Situação"]],
      body: d.emprestimos.map((e) => [e.livro, e.aluno, e.turma, e.saida, e.prevista, e.devolucao || "-", e.rotulo]),
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 2, textColor: TEXTO, lineColor: BORDA, lineWidth: { bottom: 0.2 } },
      headStyles: { fillColor: AZUL_ESCURO, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: FUNDO },
      columnStyles: {
        3: { cellWidth: 19 }, 4: { cellWidth: 21 }, 5: { cellWidth: 19 }, 6: { cellWidth: 21, halign: "center", fontStyle: "bold" },
      },
      didParseCell: (dados) => {
        if (dados.section === "body" && dados.column.index === 6) {
          const cores = coresStatus[d.emprestimos[dados.row.index].status];
          dados.cell.styles.fillColor = cores.fundo;
          dados.cell.styles.textColor = cores.texto;
        }
      },
    });
  }

  // ---------- rodapé com número de página ----------
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDA);
    doc.line(M, H - 12, W - M, H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SUAVE);
    doc.text(`${d.biblioteca} · Relatório gerado em ${geradoEm}`, M, H - 7);
    doc.text(`Página ${p} de ${totalPaginas}`, W - M, H - 7, { align: "right" });
  }

  doc.save(`relatorio-biblioteca-${agora.toISOString().slice(0, 10)}.pdf`);
}
