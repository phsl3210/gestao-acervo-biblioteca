import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import "./home.css";

export default function EmBreve({ titulo }: { titulo: string }) {
  return (
    <Layout>
      <section className="home-header">
        <p className="saudacao">Em construção</p>
        <h1>{titulo}</h1>
      </section>
      <section className="ultimos">
        <div className="vazio">
          <p>Essa página ainda vai ser feita.</p>
          <Link to="/" className="btn btn-buscar text-white">
            Voltar ao início
          </Link>
        </div>
      </section>
    </Layout>
  );
}
