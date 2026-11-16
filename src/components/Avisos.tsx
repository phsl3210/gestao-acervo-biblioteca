import { Toast, ToastContainer } from "react-bootstrap";
import { useAcervo } from "../context/AcervoContext";

/* Mensagenzinha que aparece embaixo da tela (e some sozinha) */
export default function Avisos() {
  const { aviso, limparAviso } = useAcervo();
  return (
    <ToastContainer position="bottom-center" className="avisos p-3">
      {aviso && (
        <Toast
          key={aviso.id}
          onClose={limparAviso}
          autohide
          delay={6000}
          className={`aviso aviso-${aviso.tipo}`}
        >
          <Toast.Body>{aviso.texto}</Toast.Body>
        </Toast>
      )}
    </ToastContainer>
  );
}
