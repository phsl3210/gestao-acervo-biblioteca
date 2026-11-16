import { useEffect, useState, type FormEvent } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Check, PersonPlusFill, X } from "react-bootstrap-icons";
import { useAcervo } from "../context/AcervoContext";

const formVazio = { nome: "", turma: "", matricula: "", email: "" };
const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export default function LeitorModal() {
  const { modalLeitor, fecharLeitor, adicionarLeitor, editarLeitor, matriculaJaCadastrada } =
    useAcervo();
  const editando = modalLeitor.leitor;
  const [form, setForm] = useState(formVazio);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [erroServidor, setErroServidor] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!modalLeitor.aberto) return;
    setMostrarErros(false);
    setErroServidor("");
    setForm(
      editando
        ? {
            nome: editando.nome,
            turma: editando.turma,
            matricula: editando.matricula,
            email: editando.email ?? "",
          }
        : formVazio
    );
  }, [modalLeitor.aberto, editando]);

  const erros: Partial<Record<"nome" | "turma" | "matricula" | "email", string>> = {};
  if (!form.nome.trim()) erros.nome = "Informe o nome.";
  if (!form.turma.trim()) erros.turma = "Informe a turma.";
  if (!form.email.trim()) erros.email = "O e-mail é obrigatório (é pra onde vão os avisos).";
  else if (!emailValido(form.email.trim())) erros.email = "E-mail inválido. Ex.: nome@gmail.com";
  if (form.matricula.trim() && matriculaJaCadastrada(form.matricula, editando?.id))
    erros.matricula = "Já existe um aluno com essa matrícula.";
  const invalido = (c: keyof typeof erros) => mostrarErros && !!erros[c];

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMostrarErros(true);
    if (Object.keys(erros).length > 0) return;
    const dados = {
      nome: form.nome.trim(),
      turma: form.turma.trim(),
      matricula: form.matricula.trim(),
      email: form.email.trim().toLowerCase(),
    };
    setSalvando(true);
    const r = editando ? await editarLeitor(editando.id, dados) : await adicionarLeitor(dados);
    setSalvando(false);
    if (!r.ok) {
      setErroServidor(r.erro);
      return;
    }
    fecharLeitor();
  }

  return (
    <Modal
      show={modalLeitor.aberto}
      onHide={fecharLeitor}
      centered
      contentClassName="modal-livro"
      backdropClassName="modal-livro-fundo"
    >
      <Form onSubmit={salvar} noValidate>
        <div className="modal-topo">
          <h2>{editando ? "Editar aluno" : "Cadastrar aluno"}</h2>
          <button type="button" className="btn-fechar" onClick={fecharLeitor} aria-label="Fechar">
            <X size={26} />
          </button>
        </div>

        <Form.Group className="mb-3" controlId="leitor-nome">
          <Form.Label>Nome completo</Form.Label>
          <Form.Control
            autoFocus={!editando}
            placeholder="Nome do aluno"
            value={form.nome}
            isInvalid={invalido("nome")}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
          <Form.Control.Feedback type="invalid">{erros.nome}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3" controlId="leitor-turma">
          <Form.Label>Turma</Form.Label>
          <Form.Control
            placeholder="Ex.: 3ºDB"
            value={form.turma}
            isInvalid={invalido("turma")}
            onChange={(e) => setForm({ ...form, turma: e.target.value })}
          />
          <Form.Control.Feedback type="invalid">{erros.turma}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3" controlId="leitor-email">
          <Form.Label>E-mail do aluno</Form.Label>
          <Form.Control
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="aluno@email.com"
            value={form.email}
            isInvalid={invalido("email")}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Form.Control.Feedback type="invalid">{erros.email}</Form.Control.Feedback>
          <small className="prazo-info">Ele recebe aviso de empréstimo, devolução e atraso.</small>
        </Form.Group>

        <Form.Group className="mb-4" controlId="leitor-matricula">
          <Form.Label>Matrícula / RA (opcional)</Form.Label>
          <Form.Control
            placeholder="Número de matrícula"
            value={form.matricula}
            isInvalid={invalido("matricula")}
            onChange={(e) => setForm({ ...form, matricula: e.target.value })}
          />
          <Form.Control.Feedback type="invalid">{erros.matricula}</Form.Control.Feedback>
        </Form.Group>

        {erroServidor && <p className="busca-erro scan-msg">{erroServidor}</p>}

        <Button type="submit" className="btn-adicionar" disabled={salvando}>
          {editando ? (
            <>
              <Check size={26} /> Salvar alterações
            </>
          ) : (
            <>
              <PersonPlusFill size={22} /> Cadastrar aluno
            </>
          )}
        </Button>
      </Form>
    </Modal>
  );
}
