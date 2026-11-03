import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TOTAL_ALL_QUESTIONS, allMeta, sectionCounts } from "@/lib/pte";

/**
 * Sincronização de métricas: a UI e o SEO derivam os números do manifesto
 * (fonte única). Nenhuma rota pode carregar uma contagem fixa — quando o
 * banco cresce, textos com número fixo envelhecem em silêncio (bug do
 * "2.164 questões"). Este teste fecha essa categoria.
 */

describe("sincronização de métricas do manifesto", () => {
  it("TOTAL_ALL_QUESTIONS é exatamente o tamanho do manifesto", () => {
    expect(TOTAL_ALL_QUESTIONS).toBe(allMeta.length);
    expect(TOTAL_ALL_QUESTIONS).toBeGreaterThan(0);
  });

  it("a soma das seções é igual ao total de questões", () => {
    const sum = Object.values(sectionCounts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(TOTAL_ALL_QUESTIONS);
  });
});

const FORBIDDEN = ["2.164", "1.165", "16 tipos", "16 task types", "2.000 questões"];
const routesDir = join(process.cwd(), "src", "routes");
const routeFiles = readdirSync(routesDir).filter((f) => f.endsWith(".tsx"));

describe("rotas sem contagens desatualizadas", () => {
  it("encontra arquivos de rota para varrer", () => {
    expect(routeFiles.length).toBeGreaterThan(5);
  });

  it.each(routeFiles)("nenhuma contagem fixa em %s", (file) => {
    const content = readFileSync(join(routesDir, file), "utf-8");
    for (const needle of FORBIDDEN) {
      expect(content.includes(needle), `"${needle}" encontrado em ${file}`).toBe(false);
    }
  });
});

describe("nenhuma tela mistura % com a escala 10–90 (Fase 4)", () => {
  it.each(routeFiles)("nenhuma linha junta 'alvo' com % em %s", (file) => {
    const content = readFileSync(join(routesDir, file), "utf-8");
    for (const line of content.split("\n")) {
      const mistura = /alvo/i.test(line) && line.includes("%");
      expect(mistura, `linha mistura alvo com %: ${line.trim()}`).toBe(false);
    }
  });
});
