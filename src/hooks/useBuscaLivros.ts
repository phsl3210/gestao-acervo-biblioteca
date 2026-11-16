import { useEffect, useState } from "react";
import { buscarPorTitulo, type Sugestao } from "../utils/googleBooks";

export type { Sugestao } from "../utils/googleBooks";
export type StatusBusca = "ocioso" | "carregando" | "vazio" | "erro";

/* Busca livros enquanto a pessoa digita o título (Google Books, com Open Library de reserva) */
export function useBuscaLivros(termo: string) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [status, setStatus] = useState<StatusBusca>("ocioso");
  const [detalhe, setDetalhe] = useState(""); // motivo do erro, pra facilitar achar o problema

  useEffect(() => {
    if (termo.trim().length < 3) {
      setSugestoes([]);
      setStatus("ocioso");
      return;
    }
    const controle = new AbortController();
    let expirou = false;

    const espera = setTimeout(async () => {
      setStatus("carregando");
      // com as tentativas extras, damos mais tempo antes de desistir
      const limite = setTimeout(() => {
        expirou = true;
        controle.abort();
      }, 15000);

      try {
        const lista = await buscarPorTitulo(termo.trim(), controle.signal);
        setSugestoes(lista);
        setDetalhe("");
        setStatus(lista.length ? "ocioso" : "vazio");
      } catch (erro) {
        if (controle.signal.aborted && !expirou) return;
        console.error("Erro na busca de livros:", erro);
        setSugestoes([]);
        setDetalhe(expirou ? "demorou demais" : erro instanceof Error ? erro.message : "falha de rede");
        setStatus("erro");
      } finally {
        clearTimeout(limite);
      }
    }, 500);

    return () => {
      clearTimeout(espera);
      controle.abort();
    };
  }, [termo]);

  return { sugestoes, status, detalhe };
}
