import { useEffect, useState, type FormEvent } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { ArrowLeftRight, X } from "react-bootstrap-icons";
import { LIMITE_EMPRESTIMOS, useAcervo } from "../context/AcervoContext";
import { formatarData, hojeISO, somarDias } from "../utils/datas";
import BuscaSelecao from "./BuscaSelecao";

const prazos = [7, 14, 21];

export default function EmprestimoModal() {
  const {
    modalEmprestimo, fecharEmprestimo, livros, leitores,
    disponiveisDoLivro, emprestar, abrirLeitor, emprestimosAtivosDoLeitor,
  } = useAcervo();

  const [livroId, setLivroId] = useState<number | null>(null);
  const [leitorId, setLeitorId] = useState<number | null>(null);
  const [dias, setDias] = useState(7);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!modalEmprestimo.aberto) return;
    setLivroId(modalEmprestimo.livroId);
    setLeitorId(null);
    setDias(7);
    setTentou(false);
    setErro("");
  }, [modalEmprestimo.aberto, modalEmprestimo.livroId]);

  const itensLivros = livros
    .filter((l) => disponiveisDoLivro(l.id) > 0)
    .map((l) => ({
      id: l.id,
      titulo: l.titulo,
      subtitulo: `${l.autor} · ${disponiveisDoLivro(l.id)} de ${l.quantidade} disponíveis`,
    }));

  const itensLeitores = [...leitores]
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((l) => ({
      id: l.id,
      titulo: l.nome,
      subtitulo: [
        l.turma,
        `${emprestimosAtivosDoLeitor(l.id)} de ${LIMITE_EMPRESTIMOS} livros`,
        l.email ? "" : "sem e-mail",
      ]
        .filter(Boolean)
        .join(" · "),
    }));

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (livroId === null || leitorId === null) return;
    setSalvando(true);
    const r = await emprestar(livroId, leitorId, dias);
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    fecharEmprestimo();
  }

  return (
    <Modal
      show={modalEmprestimo.aberto}
      onHide={fecharEmprestimo}
      centered
      contentClassName="modal-livro"
      backdropClassName="modal-livro-fundo"
    >
      <Form onSubmit={confirmar} noValidate>
        <div className="modal-topo">
          <h2>Novo empréstimo</h2>
          <button type="button" className="btn-fechar" onClick={fecharEmprestimo} aria-label="Fechar">
            <X size={26} />
          </button>
        </div>

        <BuscaSelecao
          label="Livro"
          placeholder="Buscar por título ou autor"
          itens={itensLivros}
          valor={livroId}
          onChange={setLivroId}
          erro={tentou && livroId === null ? "Escolha o livro." : undefined}
          vazio={
            livros.length === 0
              ? "Cadastre um livro no acervo primeiro."
              : "Todos os exemplares estão emprestados."
          }
        />

        <BuscaSelecao
          label="Aluno"
          placeholder="Buscar por nome ou matrícula"
          itens={itensLeitores}
          valor={leitorId}
          onChange={setLeitorId}
          erro={tentou && leitorId === null ? "Escolha o aluno." : undefined}
          vazio={
            <>
              Nenhum aluno cadastrado.{" "}
              <button
                type="button"
                className="link-botao"
                onClick={() => {
                  fecharEmprestimo();
                  abrirLeitor();
                }}
              >
                Cadastrar aluno
              </button>
            </>
          }
        />

        <Form.Group className="mb-4">
          <Form.Label>Prazo de devolução</Form.Label>
          <div className="prazos">
            {prazos.map((p) => (
              <button
                key={p}
                type="button"
                className={dias === p ? "ativo" : ""}
                onClick={() => setDias(p)}
              >
                {p} dias
              </button>
            ))}
          </div>
          <small className="prazo-info">
            Devolver até {formatarData(somarDias(hojeISO(), dias))}
          </small>
        </Form.Group>

        {erro && <p className="busca-erro scan-msg">{erro}</p>}

        <Button type="submit" className="btn-adicionar" disabled={salvando}>
          <ArrowLeftRight size={22} /> {salvando ? "Registrando..." : "Confirmar empréstimo"}
        </Button>
      </Form>
    </Modal>
  );
}
