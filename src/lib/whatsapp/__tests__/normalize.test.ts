import { describe, it, expect } from "vitest";
import { normalizeWhatsapp } from "@/lib/whatsapp/normalize";

describe("normalizeWhatsapp", () => {
  it("aceita máscara completa e retorna E.164 sem o 9", () => {
    expect(normalizeWhatsapp("(11) 91234-5678")).toEqual({
      ok: true,
      e164: "+551112345678",
    });
  });

  it("aceita dígitos crus", () => {
    expect(normalizeWhatsapp("11912345678")).toEqual({
      ok: true,
      e164: "+551112345678",
    });
  });

  it("ignora espaços e pontuação", () => {
    expect(normalizeWhatsapp("+55 (11) 9 1234-5678")).toEqual({
      ok: true,
      e164: "+551112345678",
    });
  });

  it("rejeita menos de 11 dígitos", () => {
    expect(normalizeWhatsapp("1112345678")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejeita mais de 11 dígitos", () => {
    expect(normalizeWhatsapp("119123456789")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejeita ausência do nono dígito", () => {
    expect(normalizeWhatsapp("11812345678")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejeita DDD começando com 0", () => {
    expect(normalizeWhatsapp("01912345678")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejeita número começando com 0 após o 9", () => {
    expect(normalizeWhatsapp("11901234567")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejeita número começando com 1 após o 9", () => {
    expect(normalizeWhatsapp("11911234567")).toEqual({ ok: false, reason: "invalid" });
  });

  it("aceita primeiro dígito 2-9 após o 9", () => {
    expect(normalizeWhatsapp("11922345678")).toEqual({ ok: true, e164: "+551122345678" });
    expect(normalizeWhatsapp("11992345678")).toEqual({ ok: true, e164: "+551192345678" });
  });

  it("vazio é inválido", () => {
    expect(normalizeWhatsapp("")).toEqual({ ok: false, reason: "invalid" });
  });
});
