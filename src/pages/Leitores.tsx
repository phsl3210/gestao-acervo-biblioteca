import { useMemo, useState } from "react";
import { Button, Dropdown, Table } from "react-bootstrap";
import { PencilSquare, PersonPlusFill, Search, ThreeDotsVertical, Trash, X } from "react-bootstrap-icons";
import Layout from "../components/Layout";
import { LIMITE_EMPRESTIMOS, useAcervo, type Leitor } from "../context/AcervoContext";
import "./home.css";

export default function Leitores() {
  const { leitores, abrirLeitor, removerLeitor, emprestimosAtivosDoLeitor } = useAcervo();
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = [...leitores].sort((a, b) => a.nome.localeCompare(b.nome));
    if (!termo) return lista;
    return lista.filter(
      (l) =>
        l.nome.toLowerCase().includes(termo) ||
        l.turma.toLowerCase().includes(termo) ||
        l.matricula.toLowerCase().includes(termo) ||
        (l.email ?? "").toLowerCase().includes(termo)
    );
  }, [leitores, busca]);

  async function remover(l: Leitor) {
    if (!window.confirm(`Remover o aluno "${l.nome}"?`)) return;
    const r = await removerLeitor(l.id);
    if (!r.ok) window.alert(r.erro);
  }

  return (
    <Layout>
      <section className="home-header">
        <p className="saudacao">
          {leitores.length} {leitores.length === 1 ? "aluno cadastrado" : "alunos cadastrados"}
        </p>
        <h1>Alunos</h1>
      </section>

      <div className="busca" role="search">
        <div className="busca-campo">
          <Search size={18} />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, turma, matrícula ou e-mail"
            aria-label="Pesquisar alunos"
          />
          {busca && (
            <button type="button" className="busca-limpar" onClick={() => setBusca("")} aria-label="Limpar">
              <X size={20} />
            </button>
          )}
        </div>
        <Button className="btn-buscar" onClick={() => abrirLeitor()}>
          <PersonPlusFill size={20} /> Cadastrar aluno
        </Button>
      </div>

      <section className="ultimos">
        {leitores.length === 0 ? (
          <div className="vazio">
            <p>Nenhum aluno cadastrado ainda.</p>
            <Button className="btn-buscar" onClick={() => abrirLeitor()}>
              <PersonPlusFill size={20} /> Cadastrar o primeiro aluno
            </Button>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="vazio">
            <p>Nenhum aluno encontrado para "{busca}".</p>
          </div>
        ) : (
          <Table responsive borderless className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th className="d-none d-md-table-cell">Turma</th>
                <th className="d-none d-md-table-cell">Matrícula</th>
                <th className="d-none d-lg-table-cell">E-mail</th>
                <th className="d-none d-md-table-cell">Livros com o aluno</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => {
                const ativos = emprestimosAtivosDoLeitor(l.id);
                return (
                  <tr key={l.id}>
                    <td className="titulo">
                      {l.nome}
                      <span className="sub-linha d-md-none">
                        {l.turma}
                        {l.matricula && ` · ${l.matricula}`} · {ativos} {ativos === 1 ? "livro" : "livros"}
                      </span>
                    </td>
                    <td className="d-none d-md-table-cell">{l.turma}</td>
                    <td className="d-none d-md-table-cell">{l.matricula || "—"}</td>
                    <td className="d-none d-lg-table-cell">
                      {l.email || <span className="status atrasado">Sem e-mail</span>}
                    </td>
                    <td className="d-none d-md-table-cell">
                      {ativos} de {LIMITE_EMPRESTIMOS}
                    </td>
                    <td className="text-end">
                      <Dropdown align="end">
                        <Dropdown.Toggle variant="link" className="btn-menu" aria-label="Mais opções">
                          <ThreeDotsVertical />
                        </Dropdown.Toggle>
                        <Dropdown.Menu popperConfig={{ strategy: "fixed" }}>
                          <Dropdown.Item onClick={() => abrirLeitor(l)}>
                            <PencilSquare className="me-2" /> Editar
                          </Dropdown.Item>
                          <Dropdown.Item onClick={() => remover(l)}>
                            <Trash className="me-2" /> Remover
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
    </Layout>
  );
}
