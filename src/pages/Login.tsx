import { useState, type FormEvent } from "react";
import { Button, Form } from "react-bootstrap";
import { Navigate } from "react-router-dom";
import { Eye, EyeSlash, JournalBookmarkFill } from "react-bootstrap-icons";
import { useAuth } from "../context/AuthContext";
import { supabaseConfigurado } from "../lib/supabase";
import "./home.css";

export default function Login() {
  const { sessao, carregando, entrar } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!carregando && sessao) return <Navigate to="/" replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!email.trim() || !senha) {
      setErro("Preencha o e-mail e a senha.");
      return;
    }
    setEnviando(true);
    const resultado = await entrar(email, senha);
    setEnviando(false);
    if (resultado) setErro(resultado);
  }

  return (
    <div className="login">
      <aside className="login-lado">
        <div className="brand">
          <JournalBookmarkFill size={30} />
          <span>BiblioGestão</span>
        </div>
        <div className="login-texto">
          <h2>Bem-vindo de volta</h2>
          <p>Entre para cuidar do acervo, dos alunos e dos empréstimos da biblioteca.</p>
        </div>
      </aside>

      <main className="login-area">
        <Form className="login-form" onSubmit={enviar} noValidate>
          <h1>Entrar</h1>
          <p className="login-sub">Use o e-mail e a senha da sua conta.</p>

          {!supabaseConfigurado && (
            <p className="scan-aviso scan-msg">
              O Supabase ainda não foi configurado. Confira o arquivo .env.local.
            </p>
          )}

          <Form.Group className="mb-3" controlId="login-email">
            <Form.Label>E-mail</Form.Label>
            <Form.Control
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="login-senha">
            <Form.Label>Senha</Form.Label>
            <div className="campo-senha">
              <Form.Control
                type={verSenha ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
              >
                {verSenha ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </Form.Group>

          {erro && <p className="busca-erro scan-msg login-erro">{erro}</p>}

          <Button type="submit" className="btn-adicionar" disabled={enviando}>
            {enviando ? "Entrando..." : "Entrar"}
          </Button>
        </Form>
      </main>
    </div>
  );
}
