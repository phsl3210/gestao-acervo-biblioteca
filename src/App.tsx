import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AcervoProvider } from "./context/AcervoContext";
import RotaProtegida from "./components/RotaProtegida";
import LivroModal from "./components/LivroModal";
import EmprestimoModal from "./components/EmprestimoModal";
import LeitorModal from "./components/LeitorModal";
import Avisos from "./components/Avisos";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Acervo from "./pages/Acervo";
import Emprestimos from "./pages/Emprestimos";
import Leitores from "./pages/Leitores";
import Escanear from "./pages/Escanear";
import Relatorios from "./pages/Relatorios";
import EmBreve from "./pages/EmBreve";

// Tudo aqui dentro só abre pra quem está logado
function AreaRestrita() {
  return (
    <RotaProtegida>
      <AcervoProvider>
        <Outlet />
        {/* Modais únicos: funcionam em qualquer página */}
        <LivroModal />
        <EmprestimoModal />
        <LeitorModal />
        <Avisos />
      </AcervoProvider>
    </RotaProtegida>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AreaRestrita />}>
            <Route path="/" element={<Home />} />
            <Route path="/acervo" element={<Acervo />} />
            <Route path="/emprestimos" element={<Emprestimos />} />
            <Route path="/alunos" element={<Leitores />} />
            <Route path="/cadastro/escanear" element={<Escanear />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="*" element={<EmBreve titulo="Página não encontrada" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
