import { useEffect, useState } from "react";

const consulta = "(pointer: coarse)";

function calcular() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(consulta).matches &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/* Scanner só existe em tela de toque (celular/tablet) com câmera disponível */
export function useScannerDisponivel() {
  const [ok, setOk] = useState(calcular);
  useEffect(() => {
    const toque = window.matchMedia(consulta);
    const atualizar = () => setOk(calcular());
    toque.addEventListener("change", atualizar);
    return () => toque.removeEventListener("change", atualizar);
  }, []);
  return ok;
}
