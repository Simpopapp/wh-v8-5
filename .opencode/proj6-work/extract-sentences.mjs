// Fase 2 — extração de frases do banco PTE para tradução (dev-time, sem rede).
// Uso (roda com bun para importar o TS puro): bun .opencode/proj6-work/extract-sentences.mjs
// - segmenta o texto principal de cada questão com a MESMA splitSentences de
//   src/lib/plus/sentences.ts (alinhamento por índice garantido),
// - grava out/sentences.json: [{ type, qid, index, text }] (frases preparadas),
//   out/phrases-batches/in-NNN.json (lotes de ~80 frases) e imprime contagens.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { splitSentences, stripBlanks } from "../../src/lib/plus/sentences";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BANK = path.join(ROOT, "src/data/pte");
const OUT_DIR = path.join(ROOT, ".opencode/proj6-work/out");
const BATCH_DIR = path.join(ROOT, ".opencode/proj6-work/out/phrases-batches");
const BATCH_SIZE = 80;

// Cobertura inicial do PRD (Fase 2): tipos de leitura/escrita mais usados.
const TYPES = ["read_aloud", "reorder_paragraphs", "mcq_single", "mcq_multi", "read_fib", "wfd"];

/** Texto principal por tipo, na MESMA fonte que a UI usa. */
function mainTexts(type, q) {
  switch (type) {
    case "read_aloud":
    case "mcq_single":
    case "mcq_multi":
      return q.text ? [q.text] : [];
    case "read_fib":
      // passage com lacunas: mesmo texto preparado que a UI exibe/traduz
      return q.text ? [stripBlanks(q.text)] : [];
    case "reorder_paragraphs":
      // cada item é uma unidade de tradução (índice = índice do item)
      return Array.isArray(q.items) ? q.items.filter((s) => typeof s === "string" && s.trim()) : [];
    case "wfd":
      return q.text ? [q.text] : [];
    default:
      return [];
  }
}

const all = [];
const counts = {};

for (const type of TYPES) {
  const p = path.join(BANK, `${type}.json`);
  if (!fs.existsSync(p)) {
    counts[type] = { questions: 0, phrases: 0 };
    continue;
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  const list = Array.isArray(raw) ? raw : (raw.questions ?? []);
  let phrases = 0;
  for (const q of list) {
    const texts = mainTexts(type, q);
    for (let i = 0; i < texts.length; i += 1) {
      const sentences = type === "reorder_paragraphs" ? [texts[i]] : splitSentences(texts[i]);
      for (const s of sentences) {
        if (s.length < 12) continue; // fragmento irrelevante para tradução
        all.push({ type, qid: q.id, index: i, text: s });
        phrases += 1;
      }
    }
  }
  counts[type] = { questions: list.length, phrases };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(BATCH_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "sentences.json"), JSON.stringify(all, null, 2));

// lotes resumíveis
let batchIndex = 0;
for (let i = 0; i < all.length; i += BATCH_SIZE) {
  fs.writeFileSync(
    path.join(BATCH_DIR, `in-${String(batchIndex).padStart(3, "0")}.json`),
    JSON.stringify(all.slice(i, i + BATCH_SIZE), null, 2),
  );
  batchIndex += 1;
}

for (const [type, c] of Object.entries(counts)) {
  console.log(`${type}: questoes=${c.questions} frases=${c.phrases}`);
}
console.log(`total frases=${all.length} lotes=${batchIndex} (tamanho=${BATCH_SIZE})`);
