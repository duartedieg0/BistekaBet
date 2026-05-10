import { describe, it, expect } from "vitest";
import { formatWhatsappMask } from "@/lib/whatsapp/format";

describe("formatWhatsappMask", () => {
  it("vazio retorna vazio", () => {
    expect(formatWhatsappMask("")).toBe("");
  });

  it("1 dígito", () => {
    expect(formatWhatsappMask("1")).toBe("(1");
  });

  it("2 dígitos (DDD completo)", () => {
    expect(formatWhatsappMask("11")).toBe("(11");
  });

  it("3 dígitos abre o número", () => {
    expect(formatWhatsappMask("119")).toBe("(11) 9");
  });

  it("7 dígitos sem hífen ainda", () => {
    expect(formatWhatsappMask("1191234")).toBe("(11) 91234");
  });

  it("8 dígitos coloca o hífen", () => {
    expect(formatWhatsappMask("11912345")).toBe("(11) 91234-5");
  });

  it("11 dígitos (completo)", () => {
    expect(formatWhatsappMask("11912345678")).toBe("(11) 91234-5678");
  });

  it("ignora não-dígitos no input", () => {
    expect(formatWhatsappMask("(11) 91234-5678")).toBe("(11) 91234-5678");
    expect(formatWhatsappMask("a1b1c9")).toBe("(11) 9");
  });

  it("trunca em 11 dígitos", () => {
    expect(formatWhatsappMask("119123456789999")).toBe("(11) 91234-5678");
  });
});
