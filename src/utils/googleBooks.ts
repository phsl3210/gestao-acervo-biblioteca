export type Sugestao = { titulo: string; autor: string; isbn: string; capa: string };

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Tenta de novo (até 3x) quando o servidor está instável (erro 5xx) ou limitando (429)
async function fetchComTentativas(url: string, signal?: AbortSignal) {
  let resp!: Response;
  for (let i = 0; i < 3; i++) {
    resp = await fetch(url, { signal });
    if (resp.status < 500 && resp.status !== 429) return resp;
    await esperar(600 * (i + 1));
  }
  return resp;
}

async function erroDoGoogle(resp: Response) {
  const corpo = await resp.json().catch(() => null);
  const motivo = corpo?.error?.status ? ` ${corpo.error.status}` : "";
  return new Error(`Google HTTP ${resp.status}${motivo}`);
}

const chaveGoogle = () => import.meta.env.VITE_GOOGLE_BOOKS_KEY as string | undefined;

// ---------- Google Books ----------
export function mapearVolume(item: any, isbnPadrao = ""): Sugestao {
  const info = item?.volumeInfo ?? {};
  const ids: { type: string; identifier: string }[] = info.industryIdentifiers ?? [];
  const isbn =
    ids.find((i) => i.type === "ISBN_13")?.identifier ??
    ids.find((i) => i.type === "ISBN_10")?.identifier ??
    isbnPadrao;
  const capa: string = info.imageLinks?.thumbnail ?? "";
  return {
    titulo: info.title ?? "",
    autor: (info.authors ?? []).join(", "),
    isbn,
    capa: capa.replace("http://", "https://"),
  };
}

async function buscarTituloGoogle(termo: string, signal?: AbortSignal): Promise<Sugestao[]> {
  const chave = chaveGoogle();
  const url =
    "https://www.googleapis.com/books/v1/volumes?maxResults=5&printType=books" +
    `&q=intitle:${encodeURIComponent(termo)}` +
    (chave ? `&key=${chave}` : "");
  const resp = await fetchComTentativas(url, signal);
  if (!resp.ok) throw await erroDoGoogle(resp);
  const dados = await resp.json();
  return (dados.items ?? []).map((item: any) => mapearVolume(item));
}

// ---------- Open Library (plano B, sem chave) ----------
function mapearOpenLibrary(doc: any): Sugestao {
  const isbns: string[] = doc.isbn ?? [];
  const isbn =
    isbns.find((i) => /^97[89]\d{10}$/.test(i)) ?? isbns.find((i) => /^\d{9}[\dX]$/.test(i)) ?? "";
  return {
    titulo: doc.title ?? "",
    autor: (doc.author_name ?? []).join(", "),
    isbn,
    capa: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : "",
  };
}

async function buscarTituloOpenLibrary(termo: string, signal?: AbortSignal): Promise<Sugestao[]> {
  const url =
    `https://openlibrary.org/search.json?title=${encodeURIComponent(termo)}` +
    "&limit=5&fields=title,author_name,isbn,cover_i";
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`Open Library HTTP ${resp.status}`);
  const dados = await resp.json();
  return (dados.docs ?? []).map(mapearOpenLibrary);
}

async function buscarIsbnOpenLibrary(isbn: string): Promise<Sugestao | null> {
  const resp = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
  );
  if (!resp.ok) throw new Error(`Open Library HTTP ${resp.status}`);
  const dados = await resp.json();
  const livro = dados[`ISBN:${isbn}`];
  if (!livro) return null;
  return {
    titulo: livro.title ?? "",
    autor: (livro.authors ?? []).map((a: any) => a.name).join(", "),
    isbn,
    capa: livro.cover?.medium ?? livro.cover?.large ?? "",
  };
}

// ---------- o que o resto do sistema usa ----------

// Busca por título: Google primeiro; se falhar, Open Library
export async function buscarPorTitulo(termo: string, signal?: AbortSignal): Promise<Sugestao[]> {
  try {
    return await buscarTituloGoogle(termo, signal);
  } catch (erroGoogle) {
    if (signal?.aborted) throw erroGoogle;
    console.warn("Google Books falhou, tentando Open Library:", erroGoogle);
    try {
      return await buscarTituloOpenLibrary(termo, signal);
    } catch (erroOpen) {
      if (signal?.aborted) throw erroOpen;
      const g = erroGoogle instanceof Error ? erroGoogle.message : "falha";
      const o = erroOpen instanceof Error ? erroOpen.message : "falha";
      throw new Error(`${g} / ${o}`);
    }
  }
}

// Busca pelo ISBN (usada no scanner). Devolve null se nenhuma base tiver o livro.
export async function buscarPorIsbn(isbn: string): Promise<Sugestao | null> {
  let falhaGoogle: unknown = null;
  try {
    const chave = chaveGoogle();
    const url =
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1` +
      (chave ? `&key=${chave}` : "");
    const resp = await fetchComTentativas(url);
    if (!resp.ok) throw await erroDoGoogle(resp);
    const dados = await resp.json();
    if (dados.items?.[0]) return mapearVolume(dados.items[0], isbn);
  } catch (erro) {
    falhaGoogle = erro;
  }

  try {
    return await buscarIsbnOpenLibrary(isbn);
  } catch (erro) {
    if (falhaGoogle) throw falhaGoogle; // as duas bases falharam: avisa
    return null; // Google respondeu "não achei" e a Open Library está fora
  }
}
