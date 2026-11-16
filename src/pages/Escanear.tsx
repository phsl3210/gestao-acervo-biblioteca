import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Form } from "react-bootstrap";
import { Link } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ArrowRepeat, CheckCircleFill, Dash, Plus } from "react-bootstrap-icons";
import Layout from "../components/Layout";
import { useAcervo } from "../context/AcervoContext";
import { useScannerDisponivel } from "../hooks/useScannerDisponivel";
import { buscarPorIsbn } from "../utils/googleBooks";
import { isbnValido, limparIsbn } from "../utils/isbn";
import "./home.css";

type Etapa = "camera" | "buscando" | "confirmar" | "sucesso";
const formVazio = { titulo: "", autor: "", capa: "", quantidade: "1" };
const ID_LEITOR = "leitor-isbn";

export default function Escanear() {
  const disponivel = useScannerDisponivel();
  const { livros, adicionarLivro, editarLivro } = useAcervo();

  const [etapa, setEtapa] = useState<Etapa>("camera");
  const [isbn, setIsbn] = useState("");
  const [form, setForm] = useState(formVazio);
  const [erroCamera, setErroCamera] = useState("");
  const [dica, setDica] = useState("");
  const [avisoBusca, setAvisoBusca] = useState("");
  const [isbnManual, setIsbnManual] = useState("");
  const [mostrarErros, setMostrarErros] = useState(false);
  const [somou, setSomou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");

  // Livro já cadastrado com esse ISBN? Aí a gente só soma exemplares.
  const existente = isbn ? livros.find((l) => limparIsbn(l.isbn) === isbn) : undefined;

  // Consulta o livro pelo ISBN e vai pra tela de confirmação
  const processarIsbn = useCallback(async (codigo: string) => {
    setIsbn(codigo);
    setEtapa("buscando");
    setAvisoBusca("");
    setMostrarErros(false);
    setForm(formVazio);
    try {
      const achado = await buscarPorIsbn(codigo);
      if (achado) {
        setForm({ titulo: achado.titulo, autor: achado.autor, capa: achado.capa, quantidade: "1" });
      } else {
        setAvisoBusca("Não encontrei esse livro na base do Google. Preencha o título e o autor.");
      }
    } catch (erro) {
      console.error("Erro ao consultar ISBN:", erro);
      setAvisoBusca("Não consegui consultar a base agora. Preencha o título e o autor na mão.");
    }
    setEtapa("confirmar");
  }, []);

  // Liga a câmera enquanto estiver na etapa "camera"
  useEffect(() => {
    if (etapa !== "camera" || !disponivel) return;

    let ativo = true;
    let leitor: Html5Qrcode | null = null;
    let iniciando: Promise<unknown> | null = null;

    // pequeno atraso: evita iniciar duas vezes no modo de desenvolvimento do React
    const timer = setTimeout(() => {
      leitor = new Html5Qrcode(ID_LEITOR, {
        formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13],
        verbose: false,
      });
      iniciando = leitor
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          (texto) => {
            if (!ativo) return;
            const codigo = limparIsbn(texto);
            // ISBN-13 sempre começa com 978 ou 979
            if (/^97[89]\d{10}$/.test(codigo)) {
              ativo = false;
              processarIsbn(codigo);
            } else {
              setDica("Esse não é o código do livro. Use o que começa com 978 ou 979.");
            }
          },
          () => {} // erros de "não achei código neste quadro" são normais
        )
        .catch((erro) => {
          console.error("Erro ao abrir a câmera:", erro);
          setErroCamera(
            "Não consegui abrir a câmera. Libere a permissão no navegador e tente de novo, ou digite o ISBN abaixo."
          );
        });
    }, 150);

    return () => {
      ativo = false;
      clearTimeout(timer);
      if (leitor && iniciando) {
        const l = leitor;
        iniciando
          .then(() => l.stop())
          .catch(() => {})
          .then(() => {
            try {
              l.clear();
            } catch {
              /* já limpo */
            }
          });
      }
    };
  }, [etapa, disponivel, processarIsbn]);

  function buscarManual(e: FormEvent) {
    e.preventDefault();
    const codigo = limparIsbn(isbnManual);
    if (!isbnValido(codigo)) {
      setDica("ISBN inválido. Use 10 ou 13 números.");
      return;
    }
    setDica("");
    processarIsbn(codigo);
  }

  function ajustarQuantidade(delta: number) {
    const atual = Number(form.quantidade) || 0;
    setForm({ ...form, quantidade: String(Math.max(1, atual + delta)) });
  }

  const quantidade = Number(form.quantidade);
  const quantidadeInvalida = !Number.isInteger(quantidade) || quantidade < 1;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMostrarErros(true);
    setErroSalvar("");
    if (quantidadeInvalida) return;
    if (!existente && (!form.titulo.trim() || !form.autor.trim())) return;

    setSalvando(true);
    const r = existente
      ? await editarLivro(existente.id, {
          titulo: existente.titulo,
          autor: existente.autor,
          isbn: existente.isbn,
          capa: existente.capa,
          quantidade: existente.quantidade + quantidade,
        })
      : await adicionarLivro({
          titulo: form.titulo.trim(),
          autor: form.autor.trim(),
          isbn,
          quantidade,
          capa: form.capa || undefined,
        });
    setSalvando(false);

    if (!r.ok) {
      setErroSalvar(r.erro);
      return;
    }
    setSomou(Boolean(existente));
    setEtapa("sucesso");
  }

  function escanearOutro() {
    setIsbn("");
    setForm(formVazio);
    setErroCamera("");
    setDica("");
    setAvisoBusca("");
    setIsbnManual("");
    setMostrarErros(false);
    setErroSalvar("");
    setEtapa("camera");
  }

  const titulo = existente?.titulo ?? form.titulo;
  const autor = existente?.autor ?? form.autor;
  const capa = existente?.capa ?? form.capa;

  return (
    <Layout>
      <section className="home-header">
        <p className="saudacao">Cadastro por ISBN</p>
        <h1>Escanear código de barras</h1>
      </section>

      {!disponivel ? (
        <section className="ultimos">
          <div className="vazio">
            <p>O scanner só está disponível no celular, com a câmera liberada (site em HTTPS).</p>
            <Link to="/" className="btn btn-buscar text-white">
              Voltar ao início
            </Link>
          </div>
        </section>
      ) : (
        <section className="ultimos scan">
          {/* 1. Câmera */}
          {etapa === "camera" && (
            <>
              <div id={ID_LEITOR} className="leitor" />
              {erroCamera ? (
                <p className="scan-msg busca-erro">{erroCamera}</p>
              ) : (
                <p className="scan-msg">Aponte para o código de barras do verso do livro.</p>
              )}
              {dica && <p className="scan-msg busca-erro">{dica}</p>}

              <Form className="isbn-manual" onSubmit={buscarManual}>
                <Form.Control
                  inputMode="numeric"
                  placeholder="Ou digite o ISBN"
                  value={isbnManual}
                  onChange={(e) => setIsbnManual(e.target.value)}
                  aria-label="Digitar ISBN"
                />
                <Button type="submit" className="btn-buscar">
                  Buscar
                </Button>
              </Form>
            </>
          )}

          {/* 2. Consultando */}
          {etapa === "buscando" && (
            <div className="vazio">
              <p>Código lido: {isbn}</p>
              <p>Buscando o livro...</p>
            </div>
          )}

          {/* 3. Confirmar + quantidade */}
          {etapa === "confirmar" && (
            <Form onSubmit={salvar} noValidate>
              <div className="scan-livro">
                {capa ? (
                  <img className="scan-capa" src={capa} alt={`Capa de ${titulo}`} />
                ) : (
                  <div className="scan-capa sem-capa-grande">Sem capa</div>
                )}
                <div className="scan-dados">
                  <small>ISBN {isbn}</small>
                  {existente ? (
                    <>
                      <strong>{existente.titulo}</strong>
                      <span>{existente.autor}</span>
                    </>
                  ) : null}
                </div>
              </div>

              {existente && (
                <p className="scan-msg scan-aviso">
                  Esse livro já está no acervo com {existente.quantidade}{" "}
                  {existente.quantidade === 1 ? "exemplar" : "exemplares"}. Os novos serão somados.
                </p>
              )}
              {avisoBusca && !existente && <p className="scan-msg scan-aviso">{avisoBusca}</p>}

              {!existente && (
                <>
                  <Form.Group className="mb-3" controlId="scan-titulo">
                    <Form.Label>Título</Form.Label>
                    <Form.Control
                      value={form.titulo}
                      isInvalid={mostrarErros && !form.titulo.trim()}
                      onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    />
                    <Form.Control.Feedback type="invalid">Informe o título.</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="scan-autor">
                    <Form.Label>Autor</Form.Label>
                    <Form.Control
                      value={form.autor}
                      isInvalid={mostrarErros && !form.autor.trim()}
                      onChange={(e) => setForm({ ...form, autor: e.target.value })}
                    />
                    <Form.Control.Feedback type="invalid">Informe o autor.</Form.Control.Feedback>
                  </Form.Group>
                </>
              )}

              <Form.Group className="mb-4" controlId="scan-quantidade">
                <Form.Label>{existente ? "Quantos exemplares chegaram?" : "Quantos exemplares?"}</Form.Label>
                <div className="stepper">
                  <button type="button" onClick={() => ajustarQuantidade(-1)} aria-label="Diminuir">
                    <Dash size={24} />
                  </button>
                  <Form.Control
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={form.quantidade}
                    isInvalid={mostrarErros && quantidadeInvalida}
                    onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                  />
                  <button type="button" onClick={() => ajustarQuantidade(1)} aria-label="Aumentar">
                    <Plus size={24} />
                  </button>
                </div>
              </Form.Group>

              {erroSalvar && <p className="scan-msg busca-erro">{erroSalvar}</p>}
              <Button type="submit" className="btn-adicionar" disabled={salvando}>
                <Plus size={24} /> {existente ? "Somar ao acervo" : "Adicionar ao acervo"}
              </Button>
              <Button variant="link" className="btn-refazer" onClick={escanearOutro}>
                <ArrowRepeat /> Escanear de novo
              </Button>
            </Form>
          )}

          {/* 4. Sucesso */}
          {etapa === "sucesso" && (
            <div className="vazio sucesso">
              <CheckCircleFill size={48} />
              <p>
                {somou ? "Exemplares somados" : "Livro adicionado"}: <strong>{titulo}</strong>
              </p>
              <Button className="btn-adicionar" onClick={escanearOutro}>
                <ArrowRepeat size={22} /> Escanear outro livro
              </Button>
              <Link to="/acervo" className="btn btn-link">
                Ver no acervo
              </Link>
            </div>
          )}
        </section>
      )}
    </Layout>
  );
}
