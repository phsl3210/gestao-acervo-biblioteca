import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type Perfil = { id: string; nome: string; papel: "bibliotecario" | "aluno" };

type AuthContextType = {
  sessao: Session | null;
  perfil: Perfil | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<string | null>; // devolve o erro, ou null se deu certo
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [perfilDe, setPerfilDe] = useState<string | null>(null); // de qual usuário é o perfil carregado

  // Descobre se já tem alguém logado e acompanha entradas e saídas
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setSessaoPronta(true);
    });
    const { data: inscricao } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSessao(nova);
      setSessaoPronta(true);
    });
    return () => inscricao.subscription.unsubscribe();
  }, []);

  // Busca o perfil (nome e papel) de quem entrou
  const userId = sessao?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      setPerfil(null);
      setPerfilDe(null);
      return;
    }
    let cancelado = false;
    supabase
      .from("perfis")
      .select("id, nome, papel")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado) return;
        setPerfil((data as Perfil | null) ?? null);
        setPerfilDe(userId);
      });
    return () => {
      cancelado = true;
    };
  }, [userId]);

  const carregando = !sessaoPronta || (userId !== null && perfilDe !== userId);

  async function entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (!error) return null;
    if (error.message.toLowerCase().includes("invalid login")) return "E-mail ou senha incorretos.";
    if (error.message.toLowerCase().includes("failed to fetch")) return "Sem conexão com o servidor. Confira a internet.";
    return error.message;
  }

  async function sair() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ sessao, perfil, carregando, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro do AuthProvider");
  return ctx;
}
