import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Só em desenvolvimento: faz a pasta /api responder no `npm run dev`,
// do mesmo jeito que a Vercel faz depois de publicado.
function apiLocal(): Plugin {
  return {
    name: "api-local",
    configureServer(server) {
      Object.assign(process.env, loadEnv("development", process.cwd(), ""));

      server.middlewares.use("/api/enviar-email", async (req: any, res: any) => {
        try {
          const partes: Buffer[] = [];
          for await (const parte of req) partes.push(parte as Buffer);
          const corpo = partes.length ? JSON.parse(Buffer.concat(partes).toString()) : {};

          const modulo = await server.ssrLoadModule("/api/enviar-email.ts");
          const resposta: any = {
            status(codigo: number) {
              res.statusCode = codigo;
              return resposta;
            },
            json(obj: unknown) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(obj));
            },
          };
          await modulo.default({ method: req.method, body: corpo, headers: req.headers }, resposta);
        } catch (erro) {
          console.error(erro);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, erro: "Erro no servidor de e-mail local." }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiLocal()],
  server: {
    allowedHosts: true,
  },
});
