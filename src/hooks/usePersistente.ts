import { useEffect, useState } from "react";

/* Igual ao useState, mas guarda o valor no navegador (localStorage).
   Provisório: quando o Supabase entrar, isso deixa de ser necessário. */
export function usePersistente<T>(chave: string, inicial: T) {
  const [valor, setValor] = useState<T>(() => {
    try {
      const salvo = localStorage.getItem(chave);
      return salvo ? (JSON.parse(salvo) as T) : inicial;
    } catch {
      return inicial; // storage bloqueado ou dado corrompido
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      /* sem espaço ou bloqueado: segue sem salvar */
    }
  }, [chave, valor]);

  return [valor, setValor] as const;
}
