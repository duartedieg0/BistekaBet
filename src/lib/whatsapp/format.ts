const DIGITS_RE = /\D/g;

/**
 * Formata uma sequência arbitrária em máscara BR (DD) 9XXXX-XXXX.
 * Trunca em 11 dígitos. Aceita string parcial (formatação progressiva enquanto digita).
 */
export function formatWhatsappMask(input: string): string {
  const digits = input.replace(DIGITS_RE, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
