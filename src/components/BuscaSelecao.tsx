import { useState, type ReactNode } from "react";
import { Form } from "react-bootstrap";

export type ItemBusca = { id: number; titulo: string; subtitulo?: string };

const normalizar = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/* Campo de busca com lista de resultados. Serve pra escolher livro ou aluno
   mesmo quando existem centenas deles. */
export default function BuscaSelecao({
  label,
  placeholder,
  itens,
  valor,
  onChange,
  erro,
  vazio,
}: {
  label: string;
  placeholder: string;
  itens: ItemBusca[];
  valor: number | null;
  onChange: (id: number | null) => void;
  erro?: string;
  vazio?: ReactNode;
}) {
  const [texto, setTexto] = useState("");
  const escolhido = itens.find((i) => i.id === valor);
  const termo = normalizar(texto.trim());
  const resultados = itens
    .filter((i) => !termo || normalizar(`${i.titulo} ${i.subtitulo ?? ""}`).includes(termo))
    .slice(0, 5);

  return (
    <Form.Group className="mb-3">
      <Form.Label>{label}</Form.Label>

      {escolhido ? (
        <div className="selecionado">
          <span>
            <strong>{escolhido.titulo}</strong>
            {escolhido.subtitulo && <small>{escolhido.subtitulo}</small>}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setTexto("");
            }}
          >
            Trocar
          </button>
        </div>
      ) : itens.length === 0 ? (
        <div className="aviso-vazio">{vazio}</div>
      ) : (
        <>
          <Form.Control
            placeholder={placeholder}
            value={texto}
            autoComplete="off"
            isInvalid={!!erro}
            onChange={(e) => setTexto(e.target.value)}
          />
          {erro && <div className="erro-campo">{erro}</div>}
          <ul className="sugestoes">
            {resultados.length === 0 && <li className="sem-resultado">Nada encontrado.</li>}
            {resultados.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => onChange(i.id)}>
                  <span>
                    <strong>{i.titulo}</strong>
                    {i.subtitulo && <small>{i.subtitulo}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Form.Group>
  );
}
