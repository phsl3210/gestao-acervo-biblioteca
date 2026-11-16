// Tira espaços e hífens: "978-85-359-0278-3" -> "9788535902783"
export const limparIsbn = (v: string) => v.replace(/[\s-]/g, "").toUpperCase();

// ISBN-13 (13 números) ou ISBN-10 (9 números + dígito ou X)
export const isbnValido = (limpo: string) =>
  /^\d{13}$/.test(limpo) || /^\d{9}[\dX]$/.test(limpo);
