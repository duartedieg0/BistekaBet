# Plano Macro — Conformidade com o Regulamento BistekaBet

**Data:** 2026-05-09
**Fonte da verdade:** [`docs/regulamento.md`](../../regulamento.md)
**Objetivo:** Garantir que o webapp BistekaBet implemente integralmente o Regulamento Oficial do bolão Copa 2026.

> Este é um plano **macro**. Cada sub-projeto listado abaixo terá seu próprio ciclo `spec → plan → implementação` em arquivos separados nesta pasta.

---

## 1. Mapeamento Regulamento × Status atual

| § | Regra | Status | Observação |
|---|---|---|---|
| §2 | Inscrição R$ 75,00 + controle de pago | ✅ Implementado | `profiles.paid` + admin toggle |
| §3 | Bloqueio automático no kickoff | ✅ Backend (RLS) | Validar UX no front |
| §4 | Horário oficial de referência | ⚠️ Validar | Confirmar timezone/fonte única |
| §5 | Apenas tempo normal pontua | ✅ Modelo | Admin separa `result`, ET, pênaltis |
| §6 | Tabela de pontuação por fase | ❌ Falta | Sem engine de cálculo |
| §7 | Pontuação em jogos com vencedor (3 níveis) | ❌ Falta | |
| §8 | Pontuação em jogos empatados (2 níveis) | ❌ Falta | |
| §9 | Jogo de 3º lugar | ❌ Falta | Linha própria na tabela |
| §10 | Jogos adiados/suspensos/remarcados | ❌ Falta | Sem operação admin de reabertura |
| §11 | Classificação automática | ❌ Falta | Sem página de ranking |
| §12 | Critérios de desempate (6 níveis) | ❌ Falta | Algoritmo determinístico |
| §13 | Premiação (camisas + 50/35/15) | ❌ Falta | Display informativo |
| §14 | Aumento de premiados | ❌ Falta | Configuração admin |
| §15 | Casos omissos | n/a | Decisão humana |
| §16 | Resumo | n/a | Documento |
| — | Regulamento acessível ao usuário | ❌ Falta | Render de `regulamento.md` |

---

## 2. Decomposição em sub-projetos

A ordem reflete dependências técnicas. Cada item é entregue de forma independente, com sua própria spec/plan/PR.

### SP-01 · Scoring engine (fundação)
**Cobre:** §5, §6, §7, §8, §9
**Escopo:** Função pura `scorePrediction(prediction, regulationResult, stage) → points` aderente à tabela do regulamento. Sem efeitos colaterais. Suíte de testes cobrindo todos os exemplos do regulamento e casos de borda (0 gols, empate ≠ placar exato, fases distintas).
**Por que primeiro:** É a fundação de SP-02, SP-03 e SP-04. É puramente algorítmico, fechável de forma definitiva contra o regulamento.
**Saída:** módulo TS testado + ADR mapeando cada caso à cláusula correspondente.

### SP-02 · Materialização de pontos
**Cobre:** §11 (cálculo automático)
**Escopo:** Persistir os pontos por palpite (coluna ou tabela `prediction_scores`). Recalcular ao salvar/editar resultado de partida no admin. Idempotente. Recálculo em massa via action administrativa. RLS adequada.
**Depende de:** SP-01.

### SP-03 · Classificação (ranking) com desempate
**Cobre:** §11, §12
**Escopo:** Página de classificação (lista ordenada de participantes por pontos, com critérios §12.1 a §12.6 aplicados de forma determinística). View/query SQL ou função Postgres. Atualização automática.
**Depende de:** SP-02.

### SP-04 · Meus palpites com pontuação visível
**Cobre:** §3 (UX), §5, §11
**Escopo:** Após a partida ter resultado oficial, o participante vê seu palpite, o resultado considerado (tempo normal) e os pontos ganhos por jogo. Inclusive 0 pontos por palpite não enviado (§3).
**Depende de:** SP-02.

### SP-05 · Operações de jogos remarcados
**Cobre:** §10
**Escopo:** Admin pode reabrir palpites de uma partida remarcada (alterar kickoff e/ou resetar bloqueio). Auditoria mínima da decisão. Comunicação aos participantes (out of scope técnico — pode ser flag visual).
**Depende de:** nenhum hard, mas ergonômico após SP-03.

### SP-06 · Página pública de Regulamento
**Cobre:** §1–§16 (acesso)
**Escopo:** Rota `/regulamento` renderizando `docs/regulamento.md` (ou cópia versionada). Link no header/footer. Snapshot da versão vigente preservado.
**Depende de:** nada.

### SP-07 · Premiação
**Cobre:** §13, §14
**Escopo:** Configuração admin para custo da camisa, número de premiados e percentuais. Display público do bolo (arrecadado, descontos, líquido, distribuição). Cálculo derivado de inscritos pagos (§2 + §13).
**Depende de:** SP-02 (para arrecadação) e SP-03 (para classificação).

---

## 3. Ordem de execução recomendada

```
SP-01 → SP-02 → SP-03 → SP-04 → SP-06 (pode ser feito em paralelo a qualquer momento)
                                  ↘ SP-05 (após SP-03)
                                  ↘ SP-07 (após SP-03)
```

**Caminho crítico:** SP-01 → SP-02 → SP-03. Tudo o mais é folha.

---

## 4. Princípios transversais

- **Tempo normal é a fonte de verdade da pontuação** (§5). ET/pênaltis ficam armazenados mas não influenciam scoring.
- **Determinismo no desempate** (§12): nenhum critério aleatório antes do último; o sorteio (§12.6) só é acionado manualmente pela organização.
- **Idempotência** em recálculos: salvar o mesmo resultado N vezes produz os mesmos pontos.
- **Regulamento como contrato testável**: cada exemplo do regulamento (§7.1, §7.2, §7.3, §8 ex.1, §8 ex.2) vira teste automatizado em SP-01.
- **Versionamento do regulamento**: alterações futuras devem ser rastreáveis (commit + display da versão vigente).

---

## 5. Riscos e questões em aberto

1. **§4 Horário de referência** — qual é a fonte oficial e em qual timezone os kickoffs estão armazenados? Confirmar antes de SP-01/SP-04.
2. **§10 Reabertura de palpites** — escopo da auditoria (log simples vs. histórico completo de palpites).
3. **§12.6 Sorteio** — interface manual para a organização registrar o resultado do sorteio.
4. **§14 Aumento de premiados** — quando isso é decidido (antes do início do bolão, conforme regulamento) e como a config é travada após o início.
5. **Estado do palpite ausente** — gerar registros sintéticos de 0 pontos ou apenas calcular na hora do ranking?

---

## 6. Próximos passos

1. Aprovação deste plano macro.
2. Início do brainstorming detalhado de **SP-01 · Scoring engine** (própria spec em `2026-05-09-sp01-scoring-engine-design.md`).
3. Demais sub-projetos serão abertos um a um após conclusão dos anteriores.
