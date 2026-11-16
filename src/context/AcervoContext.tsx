import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { limparIsbn } from "../utils/isbn";
import { dataParaISO, diasEntre, hojeISO, somarDias } from "../utils/datas";
import { enviarEmail, type DadosEmail } from "../utils/email";

// Máximo de livros emprestados ao mesmo tempo por aluno (o banco também confere isso)
export const LIMITE_EMPRESTIMOS = 4;

export type Livro = {
  id: number;
  titulo: string;
  autor: string;
  isbn: string;
  quantidade: number;
  data: string; // dd/mm/aaaa, pra mostrar
  cadastradoEm: string; // AAAA-MM-DD, pros relatórios
  capa?: string;
};
export type DadosLivro = Omit<Livro, "id" | "data" | "cadastradoEm">;

// Quem pega livro emprestado. Hoje a bibliotecária cadastra; depois o aluno
// vai poder ter conta própria (é só ligar um usuário a esse leitor).
export type Leitor = { id: number; nome: string; turma: string; matricula: string; email: string };
export type DadosLeitor = Omit<Leitor, "id">;

export type Emprestimo = {
  id: number;
  livroId: number;
  leitorId: number;
  dataSaida: string; // AAAA-MM-DD
  dataPrevista: string; // AAAA-MM-DD
  dataDevolucao: string | null; // null = ainda emprestado
  avisoAtrasoEm?: string; // último dia em que o aviso de atraso foi enviado
};

export type Resultado = { ok: true } | { ok: false; erro: string };
export type Aviso = { id: number; texto: string; tipo: "sucesso" | "erro" | "info" };

// ---------- linhas do banco (snake_case) <-> app (camelCase) ----------
type LivroRow = {
  id: number; titulo: string; autor: string; isbn: string;
  quantidade: number; capa: string | null; criado_em: string;
};
type LeitorRow = {
  id: number; nome: string; turma: string; matricula: string | null; email: string;
};
type EmprestimoRow = {
  id: number; livro_id: number; leitor_id: number; data_saida: string;
  data_prevista: string; data_devolucao: string | null; aviso_atraso_em: string | null;
};

const paraLivro = (r: LivroRow): Livro => ({
  id: r.id,
  titulo: r.titulo,
  autor: r.autor,
  isbn: r.isbn,
  quantidade: r.quantidade,
  capa: r.capa ?? undefined,
  data: new Date(r.criado_em).toLocaleDateString("pt-BR"),
  cadastradoEm: dataParaISO(new Date(r.criado_em)),
});
const paraLeitor = (r: LeitorRow): Leitor => ({
  id: r.id, nome: r.nome, turma: r.turma, matricula: r.matricula ?? "", email: r.email,
});
const paraEmprestimo = (r: EmprestimoRow): Emprestimo => ({
  id: r.id,
  livroId: r.livro_id,
  leitorId: r.leitor_id,
  dataSaida: r.data_saida,
  dataPrevista: r.data_prevista,
  dataDevolucao: r.data_devolucao,
  avisoAtrasoEm: r.aviso_atraso_em ?? undefined,
});

// Mensagens do banco em português simples
function traduzirErro(erro: { message: string; code?: string }) {
  if (erro.code === "23505") {
    if (erro.message.includes("isbn")) return "Esse ISBN já está cadastrado.";
    if (erro.message.includes("matricula")) return "Já existe um aluno com essa matrícula.";
    return "Esse registro já existe.";
  }
  if (erro.code === "42501") return "Você não tem permissão para fazer isso.";
  if (erro.code === "P0001") return erro.message; // regras que escrevemos no banco
  if (erro.message.toLowerCase().includes("failed to fetch")) return "Sem conexão com o servidor.";
  return erro.message || "Erro inesperado.";
}

// O Supabase devolve no máximo 1000 linhas por pedido, então buscamos em páginas
async function buscarTudo<T>(tabela: string): Promise<T[]> {
  const tamanho = 1000;
  const todos: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await supabase
      .from(tabela)
      .select("*")
      .order("id", { ascending: false })
      .range(de, de + tamanho - 1);
    if (error) throw error;
    todos.push(...((data ?? []) as T[]));
    if (!data || data.length < tamanho) break;
  }
  return todos;
}

type AcervoContextType = {
  // livros
  livros: Livro[];
  adicionarLivro: (dados: DadosLivro) => Promise<Resultado>;
  editarLivro: (id: number, dados: DadosLivro) => Promise<Resultado>;
  removerLivro: (id: number) => Promise<Resultado>;
  isbnJaCadastrado: (isbn: string, ignorarId?: number) => boolean;
  emprestadosDoLivro: (livroId: number) => number;
  disponiveisDoLivro: (livroId: number) => number;
  // leitores
  leitores: Leitor[];
  adicionarLeitor: (dados: DadosLeitor) => Promise<Resultado>;
  editarLeitor: (id: number, dados: DadosLeitor) => Promise<Resultado>;
  removerLeitor: (id: number) => Promise<Resultado>;
  matriculaJaCadastrada: (matricula: string, ignorarId?: number) => boolean;
  emprestimosAtivosDoLeitor: (leitorId: number) => number;
  // empréstimos
  emprestimos: Emprestimo[];
  emprestar: (livroId: number, leitorId: number, dias: number) => Promise<Resultado>;
  devolver: (emprestimoId: number) => Promise<void>;
  avisarAtrasados: () => Promise<void>;
  // avisos na tela
  aviso: Aviso | null;
  limparAviso: () => void;
  // modais
  modal: { aberto: boolean; livro: Livro | null };
  abrirCadastro: () => void;
  abrirEdicao: (livro: Livro) => void;
  fecharModal: () => void;
  modalEmprestimo: { aberto: boolean; livroId: number | null };
  abrirEmprestimo: (livroId?: number) => void;
  fecharEmprestimo: () => void;
  modalLeitor: { aberto: boolean; leitor: Leitor | null };
  abrirLeitor: (leitor?: Leitor) => void;
  fecharLeitor: () => void;
};

const AcervoContext = createContext<AcervoContextType | null>(null);

export function AcervoProvider({ children }: { children: ReactNode }) {
  const [livros, setLivros] = useState<Livro[]>([]);
  const [leitores, setLeitores] = useState<Leitor[]>([]);
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const [modal, setModal] = useState<{ aberto: boolean; livro: Livro | null }>({ aberto: false, livro: null });
  const [modalEmprestimo, setModalEmprestimo] = useState<{ aberto: boolean; livroId: number | null }>({
    aberto: false,
    livroId: null,
  });
  const [modalLeitor, setModalLeitor] = useState<{ aberto: boolean; leitor: Leitor | null }>({
    aberto: false,
    leitor: null,
  });

  // ---------- carregar do banco ----------
  const carregar = useCallback(async (silencioso = false) => {
    try {
      const [l, p, e] = await Promise.all([
        buscarTudo<LivroRow>("livros"),
        buscarTudo<LeitorRow>("leitores"),
        buscarTudo<EmprestimoRow>("emprestimos"),
      ]);
      setLivros(l.map(paraLivro));
      setLeitores(p.map(paraLeitor));
      setEmprestimos(e.map(paraEmprestimo));
      setErroCarga("");
    } catch (erro) {
      console.error("Erro ao carregar os dados:", erro);
      if (!silencioso) setErroCarga("Não consegui carregar os dados. Confira a internet e o Supabase.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Ao voltar pra aba/aplicativo, atualiza (assim o que foi cadastrado no celular aparece no PC)
  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState === "visible") void carregar(true);
    };
    window.addEventListener("focus", atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      window.removeEventListener("focus", atualizar);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, [carregar]);

  // ---------- avisos e e-mails ----------
  const notificar = (texto: string, tipo: Aviso["tipo"]) => setAviso({ id: Date.now(), texto, tipo });

  const dispararEmail = async (dados: DadosEmail, textoSucesso: string, textoFalha: string) => {
    const r = await enviarEmail(dados);
    if (r.ok) notificar(textoSucesso, "sucesso");
    else notificar(`${textoFalha} (${r.erro}).`, "erro");
  };

  // ---------- livros ----------
  const emprestadosDoLivro = (livroId: number) =>
    emprestimos.filter((e) => e.livroId === livroId && !e.dataDevolucao).length;

  const disponiveisDoLivro = (livroId: number) => {
    const livro = livros.find((l) => l.id === livroId);
    return livro ? livro.quantidade - emprestadosDoLivro(livroId) : 0;
  };

  const adicionarLivro = async (dados: DadosLivro): Promise<Resultado> => {
    const { data, error } = await supabase
      .from("livros")
      .insert({
        titulo: dados.titulo,
        autor: dados.autor,
        isbn: limparIsbn(dados.isbn),
        quantidade: dados.quantidade,
        capa: dados.capa ?? null,
      })
      .select()
      .single();
    if (error) return { ok: false, erro: traduzirErro(error) };
    setLivros((atual) => [paraLivro(data as LivroRow), ...atual]);
    return { ok: true };
  };

  const editarLivro = async (id: number, dados: DadosLivro): Promise<Resultado> => {
    const { data, error } = await supabase
      .from("livros")
      .update({
        titulo: dados.titulo,
        autor: dados.autor,
        isbn: limparIsbn(dados.isbn),
        quantidade: dados.quantidade,
        capa: dados.capa ?? null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) return { ok: false, erro: traduzirErro(error) };
    setLivros((atual) => atual.map((l) => (l.id === id ? paraLivro(data as LivroRow) : l)));
    return { ok: true };
  };

  const removerLivro = async (id: number): Promise<Resultado> => {
    const fora = emprestadosDoLivro(id);
    if (fora > 0) {
      return {
        ok: false,
        erro: `Esse livro tem ${fora} ${fora === 1 ? "exemplar emprestado" : "exemplares emprestados"}. Registre a devolução antes de remover.`,
      };
    }
    const { error } = await supabase.from("livros").delete().eq("id", id);
    if (error) return { ok: false, erro: traduzirErro(error) };
    setLivros((atual) => atual.filter((l) => l.id !== id));
    setEmprestimos((atual) => atual.filter((e) => e.livroId !== id));
    return { ok: true };
  };

  const isbnJaCadastrado = (isbn: string, ignorarId?: number) =>
    livros.some((l) => l.id !== ignorarId && limparIsbn(l.isbn) === limparIsbn(isbn));

  // ---------- leitores ----------
  const emprestimosAtivosDoLeitor = (leitorId: number) =>
    emprestimos.filter((e) => e.leitorId === leitorId && !e.dataDevolucao).length;

  const adicionarLeitor = async (dados: DadosLeitor): Promise<Resultado> => {
    const { data, error } = await supabase
      .from("leitores")
      .insert({
        nome: dados.nome,
        turma: dados.turma,
        matricula: dados.matricula.trim() || null,
        email: dados.email,
      })
      .select()
      .single();
    if (error) return { ok: false, erro: traduzirErro(error) };
    setLeitores((atual) => [paraLeitor(data as LeitorRow), ...atual]);
    return { ok: true };
  };

  const editarLeitor = async (id: number, dados: DadosLeitor): Promise<Resultado> => {
    const { data, error } = await supabase
      .from("leitores")
      .update({
        nome: dados.nome,
        turma: dados.turma,
        matricula: dados.matricula.trim() || null,
        email: dados.email,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) return { ok: false, erro: traduzirErro(error) };
    setLeitores((atual) => atual.map((l) => (l.id === id ? paraLeitor(data as LeitorRow) : l)));
    return { ok: true };
  };

  const removerLeitor = async (id: number): Promise<Resultado> => {
    const ativos = emprestimosAtivosDoLeitor(id);
    if (ativos > 0) {
      return {
        ok: false,
        erro: `Esse aluno está com ${ativos} ${ativos === 1 ? "livro" : "livros"} emprestado${ativos === 1 ? "" : "s"}. Registre a devolução antes de remover.`,
      };
    }
    const { error } = await supabase.from("leitores").delete().eq("id", id);
    if (error) return { ok: false, erro: traduzirErro(error) };
    setLeitores((atual) => atual.filter((l) => l.id !== id));
    setEmprestimos((atual) => atual.filter((e) => e.leitorId !== id));
    return { ok: true };
  };

  const matriculaJaCadastrada = (matricula: string, ignorarId?: number) =>
    leitores.some(
      (l) => l.id !== ignorarId && l.matricula.trim().toLowerCase() === matricula.trim().toLowerCase()
    );

  // ---------- empréstimos ----------
  const emprestar = async (livroId: number, leitorId: number, dias: number): Promise<Resultado> => {
    const livro = livros.find((l) => l.id === livroId);
    const leitor = leitores.find((l) => l.id === leitorId);
    if (!livro) return { ok: false, erro: "Livro não encontrado." };
    if (!leitor) return { ok: false, erro: "Aluno não encontrado." };
    if (!leitor.email) {
      return { ok: false, erro: "Esse aluno não tem e-mail cadastrado. Edite o cadastro dele antes de emprestar." };
    }
    if (emprestimosAtivosDoLeitor(leitorId) >= LIMITE_EMPRESTIMOS) {
      return {
        ok: false,
        erro: `Esse aluno já está com ${LIMITE_EMPRESTIMOS} livros emprestados (o limite). Registre uma devolução antes.`,
      };
    }
    if (disponiveisDoLivro(livroId) < 1) return { ok: false, erro: "Não há exemplares disponíveis desse livro." };
    if (emprestimos.some((e) => !e.dataDevolucao && e.livroId === livroId && e.leitorId === leitorId)) {
      return { ok: false, erro: "Esse aluno já está com um exemplar desse livro." };
    }

    const saida = hojeISO();
    const { data, error } = await supabase
      .from("emprestimos")
      .insert({
        livro_id: livroId,
        leitor_id: leitorId,
        data_saida: saida,
        data_prevista: somarDias(saida, dias),
      })
      .select()
      .single();
    if (error) {
      void carregar(true); // pode ser que outra pessoa tenha emprestado antes: atualiza a tela
      return { ok: false, erro: traduzirErro(error) };
    }
    const novo = paraEmprestimo(data as EmprestimoRow);
    setEmprestimos((atual) => [novo, ...atual]);

    void dispararEmail(
      {
        tipo: "emprestimo",
        para: leitor.email,
        nomeAluno: leitor.nome,
        tituloLivro: livro.titulo,
        autor: livro.autor,
        dataSaida: novo.dataSaida,
        dataPrevista: novo.dataPrevista,
      },
      `Empréstimo registrado. E-mail enviado para ${leitor.email}.`,
      "Empréstimo registrado, mas o e-mail não foi enviado"
    );
    return { ok: true };
  };

  const devolver = async (emprestimoId: number) => {
    const emp = emprestimos.find((e) => e.id === emprestimoId);
    if (!emp || emp.dataDevolucao) return;
    const hoje = hojeISO();

    const { error } = await supabase.from("emprestimos").update({ data_devolucao: hoje }).eq("id", emprestimoId);
    if (error) {
      notificar(`Não consegui registrar a devolução (${traduzirErro(error)}).`, "erro");
      return;
    }
    setEmprestimos((atual) => atual.map((e) => (e.id === emprestimoId ? { ...e, dataDevolucao: hoje } : e)));

    const livro = livros.find((l) => l.id === emp.livroId);
    const leitor = leitores.find((l) => l.id === emp.leitorId);
    if (livro && leitor?.email) {
      void dispararEmail(
        {
          tipo: "devolucao",
          para: leitor.email,
          nomeAluno: leitor.nome,
          tituloLivro: livro.titulo,
          autor: livro.autor,
          dataSaida: emp.dataSaida,
          dataPrevista: emp.dataPrevista,
          dataDevolucao: hoje,
        },
        `Devolução registrada. E-mail enviado para ${leitor.email}.`,
        "Devolução registrada, mas o e-mail não foi enviado"
      );
    }
  };

  // Aviso de atraso pra todo mundo atrasado (no máx. 1 por dia por empréstimo)
  const avisarAtrasados = async () => {
    const hoje = hojeISO();
    const atrasados = emprestimos.filter((e) => !e.dataDevolucao && e.dataPrevista < hoje);
    if (atrasados.length === 0) return notificar("Nenhum empréstimo atrasado.", "info");

    const pendentes = atrasados.filter((e) => e.avisoAtrasoEm !== hoje);
    if (pendentes.length === 0) return notificar("Todos os atrasados já foram avisados hoje.", "info");

    let enviados = 0;
    let falhas = 0;
    for (const e of pendentes) {
      const livro = livros.find((l) => l.id === e.livroId);
      const leitor = leitores.find((l) => l.id === e.leitorId);
      if (!livro || !leitor?.email) {
        falhas++;
        continue;
      }
      const r = await enviarEmail({
        tipo: "atraso",
        para: leitor.email,
        nomeAluno: leitor.nome,
        tituloLivro: livro.titulo,
        autor: livro.autor,
        dataSaida: e.dataSaida,
        dataPrevista: e.dataPrevista,
        diasAtraso: diasEntre(e.dataPrevista, hoje),
      });
      if (r.ok) {
        enviados++;
        await supabase.from("emprestimos").update({ aviso_atraso_em: hoje }).eq("id", e.id);
        setEmprestimos((atual) => atual.map((x) => (x.id === e.id ? { ...x, avisoAtrasoEm: hoje } : x)));
      } else {
        falhas++;
      }
    }
    if (falhas === 0) notificar(`${enviados} ${enviados === 1 ? "aviso enviado" : "avisos enviados"}.`, "sucesso");
    else notificar(`${enviados} enviado(s) e ${falhas} com falha. Confira o e-mail dos alunos e o servidor de e-mail.`, "erro");
  };

  // ---------- telas de espera ----------
  if (carregando) return <div className="tela-central">Carregando o acervo...</div>;
  if (erroCarga) {
    return (
      <div className="tela-central">
        <h2>Ops</h2>
        <p>{erroCarga}</p>
        <button className="btn btn-buscar text-white" onClick={() => void carregar()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const value: AcervoContextType = {
    livros,
    adicionarLivro,
    editarLivro,
    removerLivro,
    isbnJaCadastrado,
    emprestadosDoLivro,
    disponiveisDoLivro,
    leitores,
    adicionarLeitor,
    editarLeitor,
    removerLeitor,
    matriculaJaCadastrada,
    emprestimosAtivosDoLeitor,
    emprestimos,
    emprestar,
    devolver,
    avisarAtrasados,
    aviso,
    limparAviso: () => setAviso(null),
    modal,
    abrirCadastro: () => setModal({ aberto: true, livro: null }),
    abrirEdicao: (livro) => setModal({ aberto: true, livro }),
    fecharModal: () => setModal((m) => ({ ...m, aberto: false })),
    modalEmprestimo,
    abrirEmprestimo: (livroId) => setModalEmprestimo({ aberto: true, livroId: livroId ?? null }),
    fecharEmprestimo: () => setModalEmprestimo((m) => ({ ...m, aberto: false })),
    modalLeitor,
    abrirLeitor: (leitor) => setModalLeitor({ aberto: true, leitor: leitor ?? null }),
    fecharLeitor: () => setModalLeitor((m) => ({ ...m, aberto: false })),
  };

  return <AcervoContext.Provider value={value}>{children}</AcervoContext.Provider>;
}

export function useAcervo() {
  const ctx = useContext(AcervoContext);
  if (!ctx) throw new Error("useAcervo precisa estar dentro do AcervoProvider");
  return ctx;
}
