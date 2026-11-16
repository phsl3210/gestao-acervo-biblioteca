import type { ReactNode } from "react";
import { Dropdown } from "react-bootstrap";
import { NavLink } from "react-router-dom";
import {
  HouseDoorFill,
  BookFill,
  JournalPlus,
  ArrowLeftRight,
  PeopleFill,
  BarChartFill,
  JournalBookmarkFill,
  BoxArrowRight,
} from "react-bootstrap-icons";
import { useAcervo } from "../context/AcervoContext";
import { useAuth } from "../context/AuthContext";

type Item = {
  label: string;
  icon: typeof HouseDoorFill;
  to?: string; // vira link
  acao?: "cadastro"; // ou vira botão que abre o modal
};

const links: Item[] = [
  { label: "Início", to: "/", icon: HouseDoorFill },
  { label: "Acervo", to: "/acervo", icon: BookFill },
  { label: "Cadastro", acao: "cadastro", icon: JournalPlus },
  { label: "Empréstimos", to: "/emprestimos", icon: ArrowLeftRight },
  { label: "Alunos", to: "/alunos", icon: PeopleFill },
  { label: "Relatórios", to: "/relatorios", icon: BarChartFill },
];

function iniciais(nome: string) {
  return nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Layout({ children }: { children: ReactNode }) {
  const { abrirCadastro } = useAcervo();
  const { perfil, sessao, sair } = useAuth();
  const usuario = {
    nome: perfil?.nome ?? sessao?.user.email ?? "Bibliotecário",
    cargo: "Bibliotecário(a)",
  };

  function renderItem(item: Item, mobile: boolean) {
    const { label, icon: Icon, to } = item;
    const conteudo = mobile ? (
      <>
        <Icon size={20} />
        <small>{label}</small>
      </>
    ) : (
      <>
        <Icon size={18} />
        {label}
      </>
    );

    if (to) {
      return (
        <NavLink
          key={label}
          to={to}
          end={to === "/"}
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          {conteudo}
        </NavLink>
      );
    }
    return (
      <button key={label} type="button" onClick={abrirCadastro}>
        {conteudo}
      </button>
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar (desktop) */}
      <aside className="sidebar">
        <div className="brand">
          <JournalBookmarkFill size={26} />
          <span>BiblioGestão</span>
        </div>
        <nav>{links.map((item) => renderItem(item, false))}</nav>
      </aside>

      {/* Topbar */}
      <header className="topbar">
        <div className="brand brand-mobile">
          <JournalBookmarkFill size={22} />
          <span>BiblioGestão</span>
        </div>

        <Dropdown align="end">
          <Dropdown.Toggle variant="link" className="conta" aria-label="Conta">
            <span className="avatar">{iniciais(usuario.nome)}</span>
            <span className="conta-info">
              <strong>{usuario.nome}</strong>
              <small>{usuario.cargo}</small>
            </span>
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={sair}>
              <BoxArrowRight className="me-2" />
              Sair
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </header>

      <main className="content">{children}</main>

      {/* Barra inferior (mobile) */}
      <nav className="bottom-nav">{links.map((item) => renderItem(item, true))}</nav>
    </div>
  );
}
