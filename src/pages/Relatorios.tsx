import { useState, type ReactNode } from "react";
import { Button, Form } from "react-bootstrap";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowLeftRight, Book, Download, ExclamationTriangleFill, PeopleFill,
} from "react-bootstrap-icons";
import Layout from "../components/Layout";
import { useAcervo } from "../context/AcervoContext";
import { useAuth } from "../context/AuthContext";
import { diasEntre, formatarData, hojeISO, rotuloStatus, statusDoEmprestimo } from "../utils/datas";
import { gerarRelatorioPdf } from "../utils/relatorioPdf";
import {
  baixarCsv, emprestimosDaSemana, inicioDoPeriodo, livrosMaisEmprestados,
  rotuloPeriodo, serieEvolucao, type Periodo,
} from "../utils/relatorios";
import "./home.css";

const AZUL = "#2f62e0";
const CIANO = "#22b8cf";
const ROXO = "#7c5cdb";
const VERMELHO = "#e5534b";
const CINZA = "#e3e8f4";

function Kpi({ icone, cor, rotulo, valor, sub }: { icone: ReactNode; cor: string; rotulo: string; valor: number; sub: string }) {
  return (
    <div className="kpi">
      <span className="kpi-icone" style={{ background: `${cor}1f`, color: cor }}>
        {icone}
      </span>
      <div>
        <small>{rotulo}</small>
        <strong>{valor.toLocaleString("pt-BR")}</strong>
        <em>{sub}</em>
      </div>
    </div>
  );
}

export default function Relatorios() {
  const { livros, leitores, emprestimos } = useAcervo();
  const { perfil, sessao } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("30d");

  const inicio = inicioDoPeriodo(periodo);

  // ---- números gerais ----
  const exemplares = livros.reduce((soma, l) => soma + l.quantidade, 0);
  const ativos = emprestimos.filter((e) => !e.dataDevolucao);
  const atrasados = ativos.filter((e) => statusDoEmprestimo(e) === "atrasado");
  const disponiveis = Math.max(exemplares - ativos.length, 0);
  const emDia = ativos.length - atrasados.length;
  const circulacao = exemplares > 0 ? Math.round((ativos.length / exemplares) * 100) : 0;

  const novosNoPeriodo = livros.filter((l) => l.cadastradoEm >= inicio).length;
  const emprestimosNoPeriodo = emprestimos.filter((e) => e.dataSaida >= inicio).length;

  // ---- gráficos ----
  const evolucao = serieEvolucao(periodo, livros, emprestimos);
  const semana = emprestimosDaSemana(emprestimos);
  const totalSemana = semana.reduce((s, d) => s + d.valor, 0);
  const maiorDia = Math.max(...semana.map((d) => d.valor), 0);
  const topLivros = livrosMaisEmprestados(livros, emprestimos, inicio);

  const situacao = [
    { nome: "Disponíveis", valor: disponiveis, cor: AZUL },
    { nome: "Emprestados em dia", valor: emDia, cor: CIANO },
    { nome: "Atrasados", valor: atrasados.length, cor: VERMELHO },
  ];
  const situacaoDados = exemplares > 0 ? situacao : [{ nome: "Sem dados", valor: 1, cor: CINZA }];

  const circulacaoDados =
    exemplares > 0
      ? [
          { nome: "Emprestados", valor: ativos.length, cor: AZUL },
          { nome: "Na estante", valor: disponiveis, cor: CINZA },
        ]
      : [{ nome: "Sem dados", valor: 1, cor: CINZA }];

  // ---- exportar ----
  const emprestimosDoPeriodo = emprestimos
    .filter((e) => e.dataSaida >= inicio)
    .sort((a, b) => b.dataSaida.localeCompare(a.dataSaida));

  function exportarCsv() {
    const linhas: string[][] = [
      ["Livro", "Autor", "ISBN", "Aluno", "Turma", "Retirada", "Devolver até", "Devolvido em", "Situação"],
    ];
    emprestimosDoPeriodo.forEach((e) => {
      const livro = livros.find((l) => l.id === e.livroId);
      const leitor = leitores.find((l) => l.id === e.leitorId);
      if (!livro || !leitor) return;
      linhas.push([
        livro.titulo, livro.autor, livro.isbn, leitor.nome, leitor.turma,
        formatarData(e.dataSaida), formatarData(e.dataPrevista),
        e.dataDevolucao ? formatarData(e.dataDevolucao) : "",
        rotuloStatus[statusDoEmprestimo(e)],
      ]);
    });
    baixarCsv(`relatorio-emprestimos-${new Date().toISOString().slice(0, 10)}.csv`, linhas);
  }

  function exportarPdf() {
    const hoje = hojeISO();
    gerarRelatorioPdf({
      biblioteca: (import.meta.env.VITE_NOME_BIBLIOTECA as string | undefined) || "BiblioGestão",
      periodo: rotuloPeriodo[periodo],
      geradoPor: perfil?.nome ?? sessao?.user.email ?? "Bibliotecário",
      kpis: {
        titulos: livros.length,
        exemplares,
        ativos: ativos.length,
        atrasados: atrasados.length,
        alunos: leitores.length,
        emprestimosNoPeriodo,
        novosNoPeriodo,
        circulacao,
      },
      situacao,
      semana,
      top: topLivros.map((t) => ({ titulo: t.livro.titulo, autor: t.livro.autor, total: t.total })),
      atrasados: atrasados
        .map((e) => {
          const livro = livros.find((l) => l.id === e.livroId);
          const leitor = leitores.find((l) => l.id === e.leitorId);
          if (!livro || !leitor) return null;
          return {
            livro: livro.titulo, aluno: leitor.nome, turma: leitor.turma, email: leitor.email,
            prevista: formatarData(e.dataPrevista), dias: diasEntre(e.dataPrevista, hoje),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => b.dias - a.dias),
      emprestimos: emprestimosDoPeriodo
        .map((e) => {
          const livro = livros.find((l) => l.id === e.livroId);
          const leitor = leitores.find((l) => l.id === e.leitorId);
          if (!livro || !leitor) return null;
          const status = statusDoEmprestimo(e);
          return {
            livro: livro.titulo, aluno: leitor.nome, turma: leitor.turma,
            saida: formatarData(e.dataSaida), prevista: formatarData(e.dataPrevista),
            devolucao: e.dataDevolucao ? formatarData(e.dataDevolucao) : "",
            status, rotulo: rotuloStatus[status],
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    });
  }

  return (
    <Layout>
      <section className="home-header rel-topo">
        <div>
          <p className="saudacao">Visão geral</p>
          <h1>Relatórios do acervo</h1>
        </div>
        <div className="rel-controles">
          <Form.Select
            aria-label="Período"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
          >
            {(Object.keys(rotuloPeriodo) as Periodo[]).map((p) => (
              <option key={p} value={p}>
                {rotuloPeriodo[p]}
              </option>
            ))}
          </Form.Select>
          <Button className="btn-buscar" onClick={exportarPdf}>
            <Download size={18} /> Baixar PDF
          </Button>
          <Button variant="outline-primary" className="btn-planilha" onClick={exportarCsv}>
            Planilha (CSV)
          </Button>
        </div>
      </section>

      {/* Números principais */}
      <section className="rel-kpis">
        <Kpi
          icone={<Book size={24} />} cor={AZUL} rotulo="Títulos no acervo" valor={livros.length}
          sub={`${exemplares.toLocaleString("pt-BR")} exemplares · +${novosNoPeriodo} no período`}
        />
        <Kpi
          icone={<ArrowLeftRight size={24} />} cor={ROXO} rotulo="Empréstimos ativos" valor={ativos.length}
          sub={`${emprestimosNoPeriodo} feitos no período`}
        />
        <Kpi
          icone={<PeopleFill size={24} />} cor="#2e9e5b" rotulo="Alunos cadastrados" valor={leitores.length}
          sub="limite de 4 livros por aluno"
        />
        <Kpi
          icone={<ExclamationTriangleFill size={22} />} cor="#e8912d" rotulo="Devoluções atrasadas" valor={atrasados.length}
          sub={ativos.length ? `${Math.round((atrasados.length / ativos.length) * 100)}% dos ativos` : "nenhum empréstimo ativo"}
        />
      </section>

      <section className="rel-grid rel-grid-1">
        {/* Evolução */}
        <div className="card-rel">
          <div className="card-rel-topo">
            <div>
              <h2>Evolução do acervo</h2>
              <p>Livros cadastrados e empréstimos realizados · {rotuloPeriodo[periodo].toLowerCase()}</p>
            </div>
            <div className="legenda">
              <span><i style={{ background: AZUL }} /> Livros cadastrados</span>
              <span><i className="tracejado" style={{ borderColor: ROXO }} /> Empréstimos</span>
            </div>
          </div>
          <div className="grafico">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={evolucao} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradLivros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AZUL} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={AZUL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eef1f8" />
                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a94b0" }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a94b0" }} />
                <Tooltip />
                <Area type="monotone" name="Livros cadastrados" dataKey="livros" stroke={AZUL} strokeWidth={2.5} fill="url(#gradLivros)" />
                <Area type="monotone" name="Empréstimos" dataKey="emprestimos" stroke={ROXO} strokeWidth={2} strokeDasharray="5 4" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Situação dos exemplares */}
        <div className="card-rel">
          <div className="card-rel-topo">
            <div>
              <h2>Situação dos exemplares</h2>
              <p>Onde estão os livros agora</p>
            </div>
          </div>
          <div className="donut">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={situacaoDados} dataKey="valor" nameKey="nome" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                  {situacaoDados.map((s) => (
                    <Cell key={s.nome} fill={s.cor} />
                  ))}
                </Pie>
                {exemplares > 0 && <Tooltip />}
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-centro">
              <strong>{exemplares.toLocaleString("pt-BR")}</strong>
              <span>exemplares</span>
            </div>
          </div>
          <ul className="legenda-lista">
            {situacao.map((s) => (
              <li key={s.nome}>
                <i style={{ background: s.cor }} />
                <span>{s.nome}</span>
                <strong>{s.valor}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rel-grid rel-grid-2">
        {/* Taxa de circulação */}
        <div className="card-rel">
          <div className="card-rel-topo">
            <div>
              <h2>Taxa de circulação</h2>
              <p>Exemplares que estão fora da estante</p>
            </div>
          </div>
          <div className="circulacao">
            <div className="donut donut-pequeno">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={circulacaoDados} dataKey="valor" nameKey="nome" innerRadius={48} outerRadius={68} startAngle={90} endAngle={-270} stroke="none">
                    {circulacaoDados.map((s) => (
                      <Cell key={s.nome} fill={s.cor} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-centro">
                <strong>{circulacao}%</strong>
                <span>do acervo</span>
              </div>
            </div>
            <div className="circulacao-texto">
              <strong>{ativos.length} de {exemplares} exemplares</strong>
              <span>estão emprestados agora.</span>
              <em>{emprestimosNoPeriodo} empréstimos no período</em>
            </div>
          </div>
        </div>

        {/* Empréstimos por dia */}
        <div className="card-rel">
          <div className="card-rel-topo">
            <div>
              <h2>Empréstimos por dia</h2>
              <p>Movimentação desta semana</p>
            </div>
            <div className="total-semana">
              <strong>{totalSemana}</strong>
              <span>na semana</span>
            </div>
          </div>
          <div className="grafico">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={semana} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a94b0" }} />
                <YAxis hide allowDecimals={false} domain={[0, Math.max(maiorDia, 1)]} />
                <Tooltip cursor={{ fill: "#f2f5fc" }} />
                <Bar dataKey="valor" name="Empréstimos" radius={[6, 6, 0, 0]}>
                  {semana.map((d) => (
                    <Cell key={d.dia} fill={d.valor === maiorDia && maiorDia > 0 ? CIANO : AZUL} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mais emprestados */}
        <div className="card-rel">
          <div className="card-rel-topo">
            <div>
              <h2>Mais emprestados</h2>
              <p>{rotuloPeriodo[periodo]}</p>
            </div>
          </div>
          {topLivros.length === 0 ? (
            <p className="rel-vazio">Nenhum empréstimo no período.</p>
          ) : (
            <ol className="top-lista">
              {topLivros.map(({ livro, total }, i) => (
                <li key={livro.id}>
                  <span className="posicao">{i + 1}</span>
                  <span className="top-info">
                    <strong>{livro.titulo}</strong>
                    <small>{livro.autor}</small>
                  </span>
                  <span className="top-total">{total}x</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </Layout>
  );
}
