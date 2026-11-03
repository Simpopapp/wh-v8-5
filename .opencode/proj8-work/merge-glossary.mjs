/**
 * Projeto 8 — Etapa C: valida (I1–I6) e mergear os lotes traduzidos.
 * Lê .opencode/proj8-work/in/batch-NNN.json (entrada) e
 * .opencode/proj8-work/out/glossary-batches/batch-NNN.json (saída dos subagentes).
 * Determinístico e resumível: lote sem out válido → pendente; conflito → mantém a 1ª.
 * Grava src/data/plus/glossary.json ordenado por chave.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = "/dev-server";
const IN_DIR = path.join(ROOT, ".opencode/proj8-work/in");
const OUT_DIR = path.join(ROOT, ".opencode/proj8-work/out/glossary-batches");
const TARGET = path.join(ROOT, "src/data/plus/glossary.json");

const KEY_RE = /^[a-z]+(-[a-z]+)*$/;
const discarded = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, I6: 0 };
const merged = new Map();
let okBatches = 0;
let pending = 0;

const inFiles = Array.from({ length: 30 }, (_, i) => String(i).padStart(3, "0"));
mkdirSync(OUT_DIR, { recursive: true });

for (const n of inFiles) {
  const inPath = path.join(IN_DIR, `batch-${n}.json`);
  const outPath = path.join(OUT_DIR, `batch-${n}.json`);
  if (!existsSync(inPath)) throw new Error(`entrada ausente: ${inPath}`);
  const inputWords = new Set(JSON.parse(readFileSync(inPath, "utf8")));

  if (!existsSync(outPath)) {
    pending++;
    continue;
  }
  let obj;
  try {
    obj = JSON.parse(readFileSync(outPath, "utf8"));
  } catch {
    pending++;
    continue;
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    pending++;
    continue;
  }

  let batchValid = true;
  for (const [key, entry] of Object.entries(obj)) {
    if (!inputWords.has(key)) {
      discarded["I1"]++;
      batchValid = false;
      continue;
    }
    if (!KEY_RE.test(key)) {
      discarded["I2"]++;
      batchValid = false;
      continue;
    }
    if (!entry || typeof entry !== "object") {
      discarded["I3"]++;
      batchValid = false;
      continue;
    }
    const { literal, contextual } = entry;
    if (
      typeof literal !== "string" ||
      literal.trim() === "" ||
      literal !== literal.trim() ||
      literal.includes("\n")
    ) {
      discarded["I3"]++;
      batchValid = false;
      continue;
    }
    const words = literal.split(/\s+/);
    if (words.length < 1 || words.length > 3 || literal.length > 60) {
      discarded["I4"]++;
      batchValid = false;
      continue;
    }
    if (contextual !== undefined) {
      if (
        typeof contextual !== "string" ||
        contextual.trim() === "" ||
        contextual.length > 80 ||
        contextual === literal
      ) {
        discarded["I5"]++;
        batchValid = false;
        continue;
      }
    }
    const isEnglishEcho = literal.toLowerCase() === key || (contextual ?? "").toLowerCase() === key;
    if (isEnglishEcho) {
      discarded["I6"]++;
      batchValid = false;
      continue;
    }
    if (!merged.has(key)) {
      merged.set(key, contextual === undefined ? { literal } : { literal, contextual });
    }
  }
  if (batchValid) okBatches++;
}

// Escrita ordenada por chave (diff estável)
const sorted = {};
for (const k of Array.from(merged.keys()).sort()) sorted[k] = merged.get(k);
writeFileSync(TARGET, JSON.stringify(sorted, null, 2) + "\n");

const coverage = merged.size / 6000;
console.log(
  `RELATÓRIO: entradas=${merged.size} lotes_ok=${okBatches}/30 pendentes=${pending} descartes=${JSON.stringify(discarded)}`,
);
console.log(`cobertura=${merged.size}/6000 (${(coverage * 100).toFixed(1)}%)`);
