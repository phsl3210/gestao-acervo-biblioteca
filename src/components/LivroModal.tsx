import { useEffect, useState, type FormEvent } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Check, Plus, X } from "react-bootstrap-icons";
import { useAcervo } from "../context/AcervoContext";
import { useBuscaLivros, type Sugestao } from "../hooks/useBuscaLivros";
import { isbnValido, limparIsbn } from "../utils/isbn";

const formVazio = { titulo: "", autor: "", isbn: "", quantidade: "1", capa: "" };

export default function LivroModal() {
  const { modal, fecharModal, adicionarLivro, editarLivro, isbnJaCadastrado, emprestadosDoLivro } =
    useAcervo();
  const editando = modal.livro;

  const [form, setForm] = useState(formVazio);
  const [termoBusca, setTermoBusca] = useState("");
  const [mostrarErros, setMostrarErros] = useState(false);
  const [erroServidor, setErroServidor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { sugestoes, status, detalhe } = useBuscaLivros(termoBusca);

  // Sempre que o modal abre, começa limpo (cadastro) ou preenchido (edição)
  useEffect(() => {
    if (!modal.aberto) return;
    setTermoBusca("");
    setMostrarErros(false);
    setErroServidor("");
    setForm(
      editando
        ? {
            titulo: editando.titulo,
            autor: editando.autor,
            isbn: editando.isbn,
            quantidade: String(editando.quantidade),
            capa: editando.capa ?? "",
          }
        : formVazio
    );
  }, [modal.aberto, editando]);

  // ---- validação ----
  const erros: Partial<Record<"titulo" | "autor" | "isbn" | "quantidade", string>> = {};
  if (!form.titulo.trim()) erros.titulo = "Informe o título.";
  if (!form.autor.trim()) erros.autor = "Informe o autor.";
  const isbnLimpo = limparIsbn(form.isbn);
  if (!isbnLimpo) erros.isbn = "O ISBN é obrigatório. Ele fica na contracapa do livro.";
  else if (!isbnValido(isbnLimpo)) erros.isbn = "ISBN inválido. Use 10 ou 13 números.";
  else if (isbnJaCadastrado(isbnLimpo, editando?.id))
    erros.isbn = "Esse ISBN já está cadastrado. Edite o livro no acervo pra mudar a quantidade.";
  const quantidade = Number(form.quantidade);
  if (!Number.isInteger(quantidade) || quantidade < 1)
    erros.quantidade = "Informe uma quantidade de 1 ou mais.";
  else if (editando && quantidade < emprestadosDoLivro(editando.id))
    erros.quantidade = `Há ${emprestadosDoLivro(editando.id)} exemplar(es) emprestado(s). A quantidade não pode ser menor que isso.`;

  const invalido = (campo: keyof typeof erros) => mostrarErros && !!erros[campo];

  function escolherSugestao(s: Sugestao) {
    setForm({ ...form, titulo: s.titulo, autor: s.autor, isbn: s.isbn, capa: s.capa });
    setTermoBusca("");
    // Se a base do Google não trouxe ISBN, já avisa que precisa digitar
    if (!s.isbn) setMostrarErros(true);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMostrarErros(true);
    if (Object.keys(erros).length > 0) return;

    const dados = {
      titulo: form.titulo.trim(),
      autor: form.autor.trim(),
      isbn: form.isbn.trim(),
      quantidade,
      capa: form.capa || undefined,
    };
    setSalvando(true);
    const r = editando ? await editarLivro(editando.id, dados) : await adicionarLivro(dados);
    setSalvando(false);
    if (!r.ok) {
      setErroServidor(r.erro);
      return;
    }
    fecharModal();
  }

  return (
    <Modal
      show={modal.aberto}
      onHide={fecharModal}
      centered
      contentClassName="modal-livro"
      backdropClassName="modal-livro-fundo"
    >
      <Form onSubmit={salvar} noValidate>
        <div className="modal-topo">
          <h2>{editando ? "Editar livro" : "Cadastrar novo livro"}</h2>
          <button type="button" className="btn-fechar" onClick={fecharModal} aria-label="Fechar">
            <X size={26} />
          </button>
        </div>

        <Form.Group className="mb-3" controlId="livro-titulo">
          <Form.Label>Título</Form.Label>
          <Form.Control
            autoFocus={!editando}
            autoComplete="off"
            placeholder="Ex.: Grande Sertão: Veredas"
            value={form.titulo}
            isInvalid={invalido("titulo")}
            onChange={(e) => {
              if (editando) {
                setForm({ ...form, titulo: e.target.value });
              } else {
                setForm({ ...form, titulo: e.target.value, capa: "" });
                setTermoBusca(e.target.value);
              }
            }}
          />

          {status === "carregando" && <small className="busca-status">Buscando livros...</small>}
          {status === "vazio" && (
            <small className="busca-status">Nenhum livro encontrado. Pode preencher na mão.</small>
          )}
          {status === "erro" && (
            <small className="busca-status busca-erro">
              Não consegui buscar agora{detalhe ? ` (${detalhe})` : ""}. Confira a internet ou preencha na mão.
            </small>
          )}

          {sugestoes.length > 0 && (
            <ul className="sugestoes">
              {sugestoes.map((s, i) => (
                <li key={i}>
                  <button type="button" onClick={() => escolherSugestao(s)}>
                    {s.capa ? <img src={s.capa} alt="" /> : <span className="sem-capa" />}
                    <span>
                      <strong>{s.titulo}</strong>
                      <small>{s.autor || "Autor desconhecido"}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {form.capa && (
            <div className="capa-escolhida">
              <img src={form.capa} alt="Capa selecionada" />
              <small>Capa encontrada</small>
            </div>
          )}
          <Form.Control.Feedback type="invalid">{erros.titulo}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3" controlId="livro-autor">
          <Form.Label>Autor</Form.Label>
          <Form.Control
            placeholder="Nome do autor"
            value={form.autor}
            isInvalid={invalido("autor")}
            onChange={(e) => setForm({ ...form, autor: e.target.value })}
          />
          <Form.Control.Feedback type="invalid">{erros.autor}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3" controlId="livro-isbn">
          <Form.Label>ISBN</Form.Label>
          <Form.Control
            inputMode="numeric"
            placeholder="978-00-000-0000-0"
            value={form.isbn}
            isInvalid={invalido("isbn")}
            onChange={(e) => setForm({ ...form, isbn: e.target.value })}
          />
          <Form.Control.Feedback type="invalid">{erros.isbn}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-4" controlId="livro-quantidade">
          <Form.Label>Quantidade de exemplares</Form.Label>
          <Form.Control
            type="number"
            min={1}
            inputMode="numeric"
            value={form.quantidade}
            isInvalid={invalido("quantidade")}
            onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
          />
          <Form.Control.Feedback type="invalid">{erros.quantidade}</Form.Control.Feedback>
        </Form.Group>

        {erroServidor && <p className="busca-erro scan-msg">{erroServidor}</p>}

        <Button type="submit" className="btn-adicionar" disabled={salvando}>
          {editando ? (
            <>
              <Check size={26} /> Salvar alterações
            </>
          ) : (
            <>
              <Plus size={24} /> Adicionar ao acervo
            </>
          )}
        </Button>
      </Form>
    </Modal>
  );
}
