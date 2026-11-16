import { Button, Form, Table } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, X } from "react-bootstrap-icons";
import Layout from "../components/Layout";
import { CapaLivro, MenuLivro } from "../components/LivroUi";
import { useAcervo } from "../context/AcervoContext";
import { usePersistente } from "../hooks/usePersistente";
import { limparIsbn } from "../utils/isbn";
import "./home.css";

type Ordem = "az" | "za" | "recentes" | "antigos" | "mais-disp" | "menos-disp";

const opcoesOrdem: { valor: Ordem; rotulo: string }[] = [
  { valor: "recentes", rotulo: "Mais recentes primeiro" },
  { valor: "antigos", rotulo: "Mais antigos primeiro" },
  { valor: "az", rotulo: "Alfabética (A a Z)" },
  { valor: "za", rotulo: "Alfabética (Z a A)" },
  { valor: "mais-disp", rotulo: "Mais disponíveis primeiro" },
  { valor: "menos-disp", rotulo: "Menos disponíveis primeiro" },
];

export default function Acervo() {
  const { livros, abrirCadastro, disponiveisDoLivro } = useAcervo();
  const [ordem, setOrdem] = usePersistente<Ordem>("biblio:ordem-acervo", "recentes");
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";

  const termo = q.trim().toLowerCase();
  const digitos = limparIsbn(termo);
  const comBusca = termo
    ? livros.filter(
        (l) =>
          l.titulo.toLowerCase().includes(termo) ||
          l.autor.toLowerCase().includes(termo) ||
          l.isbn.toLowerCase().includes(termo) ||
          (digitos !== "" && limparIsbn(l.isbn).includes(digitos))
      )
    : livros;

  const porTitulo = (x: (typeof livros)[number], y: (typeof livros)[number]) =>
    x.titulo.localeCompare(y.titulo, "pt-BR", { sensitivity: "base" });

  // id = momento do cadastro, então serve pra ordenar por data
  const filtrados = [...comBusca].sort((x, y) => {
    switch (ordem) {
      case "az":
        return porTitulo(x, y);
      case "za":
        return porTitulo(y, x);
      case "antigos":
        return x.id - y.id;
      case "mais-disp":
        return disponiveisDoLivro(y.id) - disponiveisDoLivro(x.id) || porTitulo(x, y);
      case "menos-disp":
        return disponiveisDoLivro(x.id) - disponiveisDoLivro(y.id) || porTitulo(x, y);
      default:
        return y.id - x.id; // recentes
    }
  });

  const totalExemplares = livros.reduce((soma, l) => soma + l.quantidade, 0);

  function atualizarBusca(valor: string) {
    setParams(valor ? { q: valor } : {}, { replace: true });
  }

  return (
    <Layout>
      {/* Cabeçalho */}
      <section className="home-header">
        <p className="saudacao">
          {livros.length} {livros.length === 1 ? "título" : "títulos"} · {totalExemplares}{" "}
          {totalExemplares === 1 ? "exemplar" : "exemplares"}
        </p>
        <h1>Acervo da biblioteca</h1>
      </section>

      {/* Busca (filtra enquanto digita) */}
      <div className="busca" role="search">
        <div className="busca-campo">
          <Search size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => atualizarBusca(e.target.value)}
            placeholder="Título, autor ou ISBN"
            aria-label="Pesquisar no acervo"
          />
          {q && (
            <button
              type="button"
              className="busca-limpar"
              onClick={() => atualizarBusca("")}
              aria-label="Limpar busca"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <Button className="btn-buscar" onClick={abrirCadastro}>
          <Plus size={20} /> Cadastrar livro
        </Button>
      </div>

      {/* Lista */}
      <section className="ultimos">
        {livros.length === 0 ? (
          <div className="vazio">
            <p>Seu acervo ainda está vazio.</p>
            <Button className="btn-buscar" onClick={abrirCadastro}>
              <Plus size={20} /> Cadastrar o primeiro livro
            </Button>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="vazio">
            <p>Nenhum livro encontrado para "{q}".</p>
          </div>
        ) : (
          <>
          <div className="ordenar">
            <label htmlFor="ordem-acervo">Organizar por</label>
            <Form.Select
              id="ordem-acervo"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
            >
              {opcoesOrdem.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Form.Select>
          </div>
          <Table responsive borderless className="tabela">
            <thead>
              <tr>
                <th>Capa</th>
                <th>Título</th>
                <th className="d-none d-md-table-cell">Autor</th>
                <th className="d-none d-lg-table-cell">ISBN</th>
                <th className="d-none d-md-table-cell">Disponíveis</th>
                <th className="d-none d-lg-table-cell">Cadastro</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id}>
                  <td>
                    <CapaLivro livro={l} />
                  </td>
                  <td className="titulo">
                    {l.titulo}
                    <span className="sub-linha d-md-none">
                      {l.autor} · {disponiveisDoLivro(l.id)} de {l.quantidade} disponíveis
                    </span>
                  </td>
                  <td className="d-none d-md-table-cell">{l.autor}</td>
                  <td className="d-none d-lg-table-cell">{l.isbn}</td>
                  <td className="d-none d-md-table-cell">{disponiveisDoLivro(l.id)} de {l.quantidade}</td>
                  <td className="d-none d-lg-table-cell">{l.data}</td>
                  <td className="text-end">
                    <MenuLivro livro={l} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          </>
        )}
      </section>
    </Layout>
  );
}
