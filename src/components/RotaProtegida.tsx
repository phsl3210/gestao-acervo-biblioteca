import type { ReactNode } from "react";
import { Button } from "react-bootstrap";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* Só deixa passar quem está logado e é bibliotecário */
export default function RotaProtegida({ children }: { children: ReactNode }) {
  const { sessao, perfil, carregando, sair } = useAuth();

  if (carregando) return <div className="tela-central">Carregando...</div>;
  if (!sessao) return <Navigate to="/login" replace />;

  if (perfil?.papel !== "bibliotecario") {
    return (
      <div className="tela-central">
        <h2>Sem acesso</h2>
        <p>Sua conta ainda não tem permissão para usar a área da biblioteca.</p>
        <Button className="btn-buscar" onClick={sair}>
          Sair
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
