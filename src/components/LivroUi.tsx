import { Dropdown } from "react-bootstrap";
import { ArrowLeftRight, PencilSquare, ThreeDotsVertical, Trash } from "react-bootstrap-icons";
import { useAcervo, type Livro } from "../context/AcervoContext";

// Cor da capa gerada a partir do título (quando o livro não tem imagem)
const coresCapa = ["#2f4a2a", "#7a4a24", "#2a2a2e", "#8a6f4d", "#1f3a7a", "#5b2a4a"];
function corDaCapa(titulo: string) {
  let soma = 0;
  for (const c of titulo) soma += c.charCodeAt(0);
  return coresCapa[soma % coresCapa.length];
}

export function CapaLivro({ livro }: { livro: Pick<Livro, "titulo" | "capa"> }) {
  if (livro.capa) {
    return <img className="capa" src={livro.capa} alt={`Capa de ${livro.titulo}`} />;
  }
  return (
    <div className="capa" style={{ background: corDaCapa(livro.titulo) }}>
      {livro.titulo}
    </div>
  );
}

export function MenuLivro({ livro }: { livro: Livro }) {
  const { abrirEdicao, abrirEmprestimo, removerLivro, disponiveisDoLivro } = useAcervo();

  async function remover() {
    if (!window.confirm(`Remover "${livro.titulo}" do acervo?`)) return;
    const r = await removerLivro(livro.id);
    if (!r.ok) window.alert(r.erro);
  }

  return (
    <Dropdown align="end">
      <Dropdown.Toggle variant="link" className="btn-menu" aria-label="Mais opções">
        <ThreeDotsVertical />
      </Dropdown.Toggle>
      <Dropdown.Menu popperConfig={{ strategy: "fixed" }}>
        <Dropdown.Item
          disabled={disponiveisDoLivro(livro.id) < 1}
          onClick={() => abrirEmprestimo(livro.id)}
        >
          <ArrowLeftRight className="me-2" /> Emprestar
        </Dropdown.Item>
        <Dropdown.Item onClick={() => abrirEdicao(livro)}>
          <PencilSquare className="me-2" /> Editar
        </Dropdown.Item>
        <Dropdown.Item onClick={remover}>
          <Trash className="me-2" /> Remover
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
