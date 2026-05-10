// Mapeia código FIFA (3 letras, usado em public.teams.code) para ISO 3166-1
// alpha-2 lowercase, formato esperado pelo FlagCDN. Inglaterra/Escócia usam
// subdivisões do GB suportadas pelo FlagCDN.
const FIFA_TO_ISO2: Record<string, string> = {
  MEX: "mx",
  RSA: "za",
  KOR: "kr",
  CZE: "cz",
  CAN: "ca",
  BIH: "ba",
  QAT: "qa",
  SUI: "ch",
  BRA: "br",
  MAR: "ma",
  HAI: "ht",
  SCO: "gb-sct",
  USA: "us",
  PAR: "py",
  AUS: "au",
  TUR: "tr",
  GER: "de",
  CUW: "cw",
  CIV: "ci",
  ECU: "ec",
  NED: "nl",
  JPN: "jp",
  SWE: "se",
  TUN: "tn",
  BEL: "be",
  EGY: "eg",
  IRN: "ir",
  NZL: "nz",
  ESP: "es",
  CPV: "cv",
  KSA: "sa",
  URU: "uy",
  FRA: "fr",
  SEN: "sn",
  IRQ: "iq",
  NOR: "no",
  ARG: "ar",
  ALG: "dz",
  AUT: "at",
  JOR: "jo",
  POR: "pt",
  COD: "cd",
  UZB: "uz",
  COL: "co",
  ENG: "gb-eng",
  CRO: "hr",
  GHA: "gh",
  PAN: "pa",
};

export type FlagWidth = 20 | 40 | 80 | 160 | 320;

export function flagSrc(code: string | null | undefined, width: FlagWidth = 80): string | null {
  if (!code) return null;
  const iso = FIFA_TO_ISO2[code.toUpperCase()];
  if (!iso) return null;
  return `https://flagcdn.com/w${width}/${iso}.png`;
}
