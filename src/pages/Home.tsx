import { useState, type FormEvent } from "react";
import { Button, Table } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Camera,
  Plus,
  UpcScan,
  ChevronRight,
  BookHalf,
  BarChartFill,
  ArrowLeftRight,
  PeopleFill,
} from "react-bootstrap-icons";
import Layout from "../components/Layout";
import { CapaLivro, MenuLivro } from "../components/LivroUi";
import { useAcervo } from "../context/AcervoContext";
import { statusDoEmprestimo } from "../utils/datas";
import { useScannerDisponivel } from "../hooks/useScannerDisponivel";
import "./home.css";

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Home() {
  const scannerDisponivel = useScannerDisponivel();
  const { livros, abrirCadastro, disponiveisDoLivro, emprestimos } = useAcervo();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  function buscar(e: FormEvent) {
    e.preventDefault();
    const q = busca.trim();
    navigate(q ? `/acervo?q=${encodeURIComponent(q)}` : "/acervo");
  }

  const ativos = emprestimos.filter((e) => !e.dataDevolucao).length;
  const atrasados = emprestimos.filter((e) => statusDoEmprestimo(e) === "atrasado").length;
  const ultimos = livros.slice(0, 5);

  return (
    <Layout>
      {/* 1. Cabeçalho */}
      <section className="home-header">
        <p className="saudacao">{saudacao()}, bibliotecário.</p>
        <h1>O que você procura hoje?</h1>
      </section>

      {/* 2. Busca */}
      <form className="busca" onSubmit={buscar} role="search">
        <div className="busca-campo">
          <Search size={18} />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Título, autor ou ISBN"
            aria-label="Pesquisar no acervo"
          />
        </div>
        <Button type="submit" className="btn-buscar">
          Buscar
        </Button>
      </form>

      {/* 3. Cadastro + atalhos */}
      <section className="acoes">
        <div className="card-cadastro">
          <div className="card-cadastro-topo">
            <span className="icone-caixa">
              <UpcScan size={28} />
            </span>
            <div>
              <h2>Cadastrar livro</h2>
              <p>
                {scannerDisponivel
                  ? "Escaneie o código de barras e os dados do livro são preenchidos para você."
                  : "Preencha os dados do livro para adicionar ao acervo."}
              </p>
            </div>
          </div>

          {scannerDisponivel && (
            <>
              <Button as={Link as any} to="/cadastro/escanear" className="btn-escanear">
                <Camera size={20} /> Escanear ISBN
              </Button>
              <div className="divisor">
                <span>ou</span>
              </div>
            </>
          )}

          <Button variant="outline-light" className="btn-manual" onClick={abrirCadastro}>
            <Plus size={22} /> Cadastrar manualmente
          </Button>
        </div>

        <Link to="/acervo" className="card-atalho">
          <Search size={26} />
          <div>
            <strong>Consultar acervo</strong>
            <span>Pesquise e encontre livros e autores</span>
          </div>
          <ChevronRight />
        </Link>

        <Link to="/emprestimos" className="card-atalho">
          <ArrowLeftRight size={26} />
          <div>
            <strong>Empréstimos</strong>
            <span>
              {ativos} {ativos === 1 ? "ativo" : "ativos"}
              {atrasados > 0 && ` · ${atrasados} ${atrasados === 1 ? "atrasado" : "atrasados"}`}
            </span>
          </div>
          <ChevronRight />
        </Link>

        <Link to="/alunos" className="card-atalho">
          <PeopleFill size={26} />
          <div>
            <strong>Alunos</strong>
            <span>Cadastre quem pega livros</span>
          </div>
          <ChevronRight />
        </Link>

        <Link to="/relatorios" className="card-atalho">
          <BarChartFill size={26} />
          <div>
            <strong>Relatórios</strong>
            <span>Veja estatísticas do acervo</span>
          </div>
          <ChevronRight />
        </Link>
      </section>

      {/* 4. Últimos livros */}
      <section className="ultimos">
        <div className="ultimos-topo">
          <h2>
            <BookHalf size={22} /> Últimos livros cadastrados
          </h2>
          <Link to="/acervo">Ver todos</Link>
        </div>

        {ultimos.length === 0 ? (
          <div className="vazio">
            <p>Nenhum livro cadastrado ainda.</p>
            <Button className="btn-buscar" onClick={abrirCadastro}>
              <Plus size={20} /> Cadastrar o primeiro livro
            </Button>
          </div>
        ) : (
          <Table responsive borderless className="tabela">
            <thead>
              <tr>
                <th>Capa</th>
                <th>Título</th>
                <th className="d-none d-md-table-cell">Autor</th>
                <th className="d-none d-lg-table-cell">ISBN</th>
                <th className="d-none d-md-table-cell">Disponíveis</th>
                <th className="d-none d-md-table-cell">Cadastro</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {ultimos.map((l) => (
                <tr key={l.id}>
                  <td>
                    <CapaLivro livro={l} />
                  </td>
                  <td className="titulo">
                    {l.titulo}
                    <span className="sub-linha d-md-none">
                      {l.autor} · {disponiveisDoLivro(l.id)} de {l.quantidade} disponíveis
                    </span>
                  </td>
                  <td className="d-none d-md-table-cell">{l.autor}</td>
                  <td className="d-none d-lg-table-cell">{l.isbn}</td>
                  <td className="d-none d-md-table-cell">{disponiveisDoLivro(l.id)} de {l.quantidade}</td>
                  <td className="d-none d-md-table-cell">{l.data}</td>
                  <td className="text-end">
                    <MenuLivro livro={l} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </Layout>
  );
}
