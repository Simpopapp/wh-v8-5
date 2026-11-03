import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { lookupWord, type Glossary } from "@/lib/plus/glossary";

/** Carrega o glossário real gerado pelo merge (I1–I6 já filtradas no pipeline). */
function loadGlossary(): Glossary {
  const p = path.resolve(process.cwd(), "src/data/plus/glossary.json");
  return JSON.parse(readFileSync(p, "utf8")) as Glossary;
}

/** Candidatas originais (6.000, em 30 lotes do projeto 8) — base do cálculo de cobertura. */
function loadCandidateWords(): string[] {
  const dir = path.resolve(process.cwd(), ".opencode/proj8-work/in");
  const words: string[] = [];
  for (let i = 0; i < 30; i++) {
    const p = path.join(dir, `batch-${String(i).padStart(3, "0")}.json`);
    const batch = JSON.parse(readFileSync(p, "utf8")) as unknown[];
    for (const w of batch) {
      if (typeof w !== "string") throw new Error(`lote ${i} inválido`);
      words.push(w);
    }
  }
  if (words.length !== 6000) throw new Error(`esperado 6.000 candidatas, got ${words.length}`);
  return words;
}

const KEY_RE = /^[a-z]+(-[a-z]+)*$/;

describe("glossário real (src/data/plus/glossary.json)", () => {
  const glossary = loadGlossary();
  const entries = Object.entries(glossary);

  it("não está vazio e tem entradas bem formadas", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it("I2: chaves minúsculas, só letras/hífens", () => {
    for (const [key] of entries) {
      expect(KEY_RE.test(key), `chave inválida: ${key}`).toBe(true);
      expect(key, `chave não minúscula: ${key}`).toBe(key.toLowerCase());
    }
  });

  it("I3: literal é string não vazia, sem quebras, sem espaços nas pontas", () => {
    for (const [key, entry] of entries) {
      expect(typeof entry.literal === "string", `literal inválido: ${key}`).toBe(true);
      expect(entry.literal.trim().length, `literal vazio: ${key}`).toBeGreaterThan(0);
      expect(entry.literal, `literal com espaços nas pontas: ${key}`).toBe(entry.literal.trim());
      expect(entry.literal.includes("\n"), `literal com quebra de linha: ${key}`).toBe(false);
    }
  });

  it("I4: literal tem 1–3 palavras e até 60 caracteres", () => {
    for (const [key, entry] of entries) {
      const words = entry.literal.split(/\s+/);
      expect(words.length, `literal longo demais: ${key}`).toBeLessThanOrEqual(3);
      expect(entry.literal.length, `literal >60 chars: ${key}`).toBeLessThanOrEqual(60);
    }
  });

  it("I5: contextual opcional, não vazia, ≤80 chars, ≠ literal", () => {
    for (const [key, entry] of entries) {
      if (entry.contextual === undefined) continue;
      expect(typeof entry.contextual === "string", `contextual inválida: ${key}`).toBe(true);
      expect(entry.contextual.trim().length, `contextual vazia: ${key}`).toBeGreaterThan(0);
      expect(entry.contextual.length, `contextual >80 chars: ${key}`).toBeLessThanOrEqual(80);
      expect(entry.contextual, `contextual igual ao literal: ${key}`).not.toBe(entry.literal);
    }
  });

  it("I6: tradução nunca é o eco exato da palavra inglesa", () => {
    for (const [key, entry] of entries) {
      expect(entry.literal.toLowerCase() === key, `literal ecoa a chave: ${key}`).toBe(false);
      if (entry.contextual !== undefined) {
        expect(entry.contextual.toLowerCase() === key, `contextual ecoa a chave: ${key}`).toBe(
          false,
        );
      }
    }
  });

  it("cobertura ≥ 95% das 6.000 candidatas", () => {
    const words = loadCandidateWords();
    expect(words.length).toBe(6000);
    const covered = words.filter((w) => glossary[w] !== undefined).length;
    expect(covered / words.length).toBeGreaterThanOrEqual(0.95);
  });

  it("amostras reais via lookupWord", () => {
    expect(lookupWord(glossary, "photosynthesis")).toMatchObject({ literal: "fotossíntese" });
    expect(lookupWord(glossary, "equivalent")).toMatchObject({ literal: "equivalente" });
    expect(lookupWord(glossary, "sentence")).toMatchObject({ literal: "frase, sentença" });
    // normalização de caixa/pontuação sobre dado real
    expect(lookupWord(glossary, "Photosynthesis,")).toMatchObject({ literal: "fotossíntese" });
  });

  it("entrada com nota contextual chega íntegra", () => {
    const hit = lookupWord(glossary, "takeaway");
    expect(hit).not.toBeNull();
    expect(hit?.["literal"]).toBe("conclusão");
    expect(typeof hit?.["contextual"]).toBe("string");
  });

  it("miss → null (nunca tradução inventada)", () => {
    expect(lookupWord(glossary, "zzzpalavrainexistente")).toBeNull();
  });
});
