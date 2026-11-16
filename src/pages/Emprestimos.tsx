import { useMemo, useState } from "react";
import { Button, Table } from "react-bootstrap";
import { ArrowLeftRight, Envelope, Search, X } from "react-bootstrap-icons";
import Layout from "../components/Layout";
import { CapaLivro } from "../components/LivroUi";
import { useAcervo } from "../context/AcervoContext";
import { formatarData, rotuloStatus, statusDoEmprestimo } from "../utils/datas";
import "./home.css";

type Filtro = "ativos" | "atrasados" | "devolvidos";

export default function Emprestimos() {
  const { emprestimos, livros, leitores, devolver, abrirEmprestimo, avisarAtrasados } = useAcervo();
  const [enviando, setEnviando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("ativos");
  const [busca, setBusca] = useState("");

  const linhas = useMemo(
    () =>
      emprestimos
        .map((e) => ({
          e,
          livro: livros.find((l) => l.id === e.livroId),
          leitor: leitores.find((l) => l.id === e.leitorId),
          status: statusDoEmprestimo(e),
        }))
        .filter((l) => l.livro && l.leitor),
    [emprestimos, livros, leitores]
  );

  const qtd = {
    ativos: linhas.filter((l) => l.status !== "devolvido").length,
    atrasados: linhas.filter((l) => l.status === "atrasado").length,
    devolvidos: linhas.filter((l) => l.status === "devolvido").length,
  };

  const termo = busca.trim().toLowerCase();
  const filtradas = linhas
    .filter((l) =>
      filtro === "ativos"
        ? l.status !== "devolvido"
        : filtro === "atrasados"
        ? l.status === "atrasado"
        : l.status === "devolvido"
    )
    .filter(
      (l) =>
        !termo ||
        l.livro!.titulo.toLowerCase().includes(termo) ||
        l.leitor!.nome.toLowerCase().includes(termo) ||
        l.leitor!.matricula.toLowerCase().includes(termo)
    )
    .sort((a, b) =>
      filtro === "devolvidos"
        ? (b.e.dataDevolucao ?? "").localeCompare(a.e.dataDevolucao ?? "")
        : a.e.dataPrevista.localeCompare(b.e.dataPrevista)
    );

  function confirmarDevolucao(id: number, titulo: string, aluno: string) {
    if (window.confirm(`Registrar a devolução de "${titulo}" por ${aluno}?`)) devolver(id);
  }

  async function avisar() {
    setEnviando(true);
    await avisarAtrasados();
    setEnviando(false);
  }

  const chips: { id: Filtro; rotulo: string }[] = [
    { id: "ativos", rotulo: `Ativos (${qtd.ativos})` },
    { id: "atrasados", rotulo: `Atrasados (${qtd.atrasados})` },
    { id: "devolvidos", rotulo: `Devolvidos (${qtd.devolvidos})` },
  ];

  return (
    <Layout>
      <section className="home-header">
        <p className="saudacao">
          {qtd.ativos} {qtd.ativos === 1 ? "livro fora" : "livros fora"} da biblioteca
        </p>
        <h1>Empréstimos</h1>
      </section>

      <div className="busca" role="search">
        <div className="busca-campo">
          <Search size={18} />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Livro ou aluno"
            aria-label="Pesquisar empréstimos"
          />
          {busca && (
            <button type="button" className="busca-limpar" onClick={() => setBusca("")} aria-label="Limpar">
              <X size={20} />
            </button>
          )}
        </div>
        <Button className="btn-buscar" onClick={() => abrirEmprestimo()}>
          <ArrowLeftRight size={20} /> Novo empréstimo
        </Button>
      </div>

      <section className="ultimos">
        <div className="filtros">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              className={filtro === c.id ? "ativo" : ""}
              onClick={() => setFiltro(c.id)}
            >
              {c.rotulo}
            </button>
          ))}
        </div>

        {filtro === "atrasados" && qtd.atrasados > 0 && (
          <div className="acao-atrasados">
            <Button variant="outline-primary" disabled={enviando} onClick={avisar}>
              <Envelope className="me-2" />
              {enviando ? "Enviando..." : "Avisar atrasados por e-mail"}
            </Button>
            <small>Cada aluno recebe no máximo 1 aviso por dia.</small>
          </div>
        )}

        {filtradas.length === 0 ? (
          <div className="vazio">
            <p>
              {emprestimos.length === 0
                ? "Nenhum empréstimo registrado ainda."
                : "Nada por aqui com esse filtro."}
            </p>
            {emprestimos.length === 0 && (
              <Button className="btn-buscar" onClick={() => abrirEmprestimo()}>
                <ArrowLeftRight size={20} /> Registrar o primeiro
              </Button>
            )}
          </div>
        ) : (
          <Table responsive borderless className="tabela">
            <thead>
              <tr>
                <th>Capa</th>
                <th>Livro</th>
                <th className="d-none d-md-table-cell">Aluno</th>
                <th className="d-none d-lg-table-cell">Saída</th>
                <th className="d-none d-md-table-cell">{filtro === "devolvidos" ? "Devolvido em" : "Devolver até"}</th>
                <th className="d-none d-md-table-cell">Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map(({ e, livro, leitor, status }) => (
                <tr key={e.id}>
                  <td>
                    <CapaLivro livro={livro!} />
                  </td>
                  <td className="titulo">
                    {livro!.titulo}
                    <span className="sub-linha d-md-none">
                      {leitor!.nome} · até {formatarData(e.dataPrevista)}
                    </span>
                    <span className={`status ${status} d-md-none`}>{rotuloStatus[status]}</span>
                  </td>
                  <td className="d-none d-md-table-cell">
                    {leitor!.nome}
                    <span className="sub-linha">{leitor!.turma}</span>
                  </td>
                  <td className="d-none d-lg-table-cell">{formatarData(e.dataSaida)}</td>
                  <td className="d-none d-md-table-cell">
                    {formatarData(e.dataDevolucao ?? e.dataPrevista)}
                  </td>
                  <td className="d-none d-md-table-cell">
                    <span className={`status ${status}`}>{rotuloStatus[status]}</span>
                  </td>
                  <td className="text-end">
                    {!e.dataDevolucao && (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="btn-devolver"
                        onClick={() => confirmarDevolucao(e.id, livro!.titulo, leitor!.nome)}
                      >
                        Devolver
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </Layout>
  );
}
