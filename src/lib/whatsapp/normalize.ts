const DIGITS_RE = /\D/g;

export type NormalizeResult =
  | { ok: true; e164: string }
  | { ok: false; reason: "invalid" };

/**
 * Recebe input bruto ou mascarado e retorna E.164 BR sem o nono dígito.
 * Esperado: 11 dígitos (DDD + 9 + 8). Saída: +55 + DDD + 8 (13 chars).
 */
export function normalizeWhatsapp(input: string): NormalizeResult {
  let digits = input.replace(DIGITS_RE, "");

  // Strip leading 55 (country code) if present
  if (digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length !== 11) return { ok: false, reason: "invalid" };
  if (digits[2] !== "9") return { ok: false, reason: "invalid" };
  const ddd = digits.slice(0, 2);
  const eight = digits.slice(3);
  if (ddd[0] === "0") return { ok: false, reason: "invalid" };
  if (eight[0] === "0") return { ok: false, reason: "invalid" };
  if (eight[0] === "1" && eight[1] === "1") return { ok: false, reason: "invalid" };
  return { ok: true, e164: `+55${ddd}${eight}` };
}
