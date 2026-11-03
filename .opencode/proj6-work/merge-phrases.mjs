// Fase 2 — merge dos retornos dos subagentes em src/data/plus/phrases/{type}.json.
// Uso: bun .opencode/proj6-work/merge-phrases.mjs
// Lê out/phrases-batches/in-NNN.json + out/phrases-batches/out-NNN.json.
// Alinhamento: cada tradução é casada de volta à posição da frase DENTRO da
// segmentação da questão (a MESMA splitSentences/stripBlanks da extração e da
// UI), por texto exato — o campo `index` dos lotes antigos (índice do texto,
// não da frase) não é usado. Resumível: out-NNN.json ausente/inválido →
// lote fica pendente (relatório). Nunca sobrescreve posição já preenchida.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { splitSentences, stripBlanks } from "../../src/lib/plus/sentences";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Fase 2: out/phrases-batches · Fase 4 (cobertura residual): out/phrases-batches-fase4
const BATCH_DIRS = [
  path.join(ROOT, ".opencode/proj6-work/out/phrases-batches"),
  path.join(ROOT, ".opencode/proj6-work/out/phrases-batches-fase4"),
];
const TARGET_DIR = path.join(ROOT, "src/data/plus/phrases");
const BANK = path.join(ROOT, "src/data/pte");

const TYPES = [
  "read_aloud",
  "reorder_paragraphs",
  "mcq_single",
  "mcq_multi",
  "read_fib",
  "wfd",
  "swt",
  "write_essay",
];

function mainTexts(type, q) {
  switch (type) {
    case "read_aloud":
    case "mcq_single":
    case "mcq_multi":
      return q.text ? [q.text] : [];
    case "read_fib":
      return q.text ? [stripBlanks(q.text)] : [];
    case "reorder_paragraphs":
      return Array.isArray(q.items) ? q.items.filter((s) => typeof s === "string" && s.trim()) : [];
    case "wfd":
      return q.text ? [q.text] : [];
    case "swt":
      // texto-fonte de leitura (sem blanks — verificado); a UI traduz splitSentences(text)
      return q.text ? [q.text] : [];
    case "write_essay":
      // a UI traduz o enunciado (prompt; fallback text)
      return q.prompt || q.text ? [q.prompt || q.text] : [];
    default:
      return [];
  }
}

/** type -> { qid -> { units: string[], t: (obj|null)[] } } */
const byType = {};
for (const type of TYPES) {
  const p = path.join(BANK, `${type}.json`);
  if (!fs.existsSync(p)) continue;
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  const list = Array.isArray(raw) ? raw : (raw.questions ?? []);
  const data = (byType[type] ??= {});
  for (const q of list) {
    const units =
      type === "reorder_paragraphs"
        ? mainTexts(type, q)
        : mainTexts(type, q).flatMap((t) => splitSentences(t));
    if (units.length > 0) data[q.id] = { units, t: units.map(() => null) };
  }
}

const used = new Set(); // "type|qid|pos" já preenchidos
let translated = 0;
let invalid = 0;
let unmatched = 0;
let pending = 0;

for (const BATCH_DIR of BATCH_DIRS) {
  if (!fs.existsSync(BATCH_DIR)) continue;
  const files = fs
    .readdirSync(BATCH_DIR)
    .filter((f) => /^in-\d+\.json$/.test(f))
    .sort();

  for (const inFile of files) {
    const n = inFile.match(/^in-(\d+)\.json$/)[1];
    const outPath = path.join(BATCH_DIR, `out-${n}.json`);
    if (!fs.existsSync(outPath)) {
      pending += 1;
      continue;
    }
    const items = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, inFile), "utf8"));
    let outs;
    try {
      outs = JSON.parse(fs.readFileSync(outPath, "utf8"));
    } catch (e) {
      console.error(`out-${n}.json inválido (${e.message}) — lote pendente`);
      pending += 1;
      continue;
    }
    const byIndex = new Map();
    for (const o of Array.isArray(outs) ? outs : []) {
      if (o && Number.isInteger(o.i)) byIndex.set(o.i, o);
    }
    let ok = 0;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const o = byIndex.get(i);
      if (!o || typeof o.l !== "string") {
        invalid += 1;
        continue;
      }
      const l = o.l.trim();
      if (l.length < 1 || l.length > 400) {
        invalid += 1;
        continue;
      }
      let c = null;
      if (typeof o.c === "string") {
        const cs = o.c.trim();
        if (cs.length > 0 && cs.length <= 200) c = cs;
      }
      const q = byType[item.type]?.[item.qid];
      if (!q) {
        invalid += 1;
        continue;
      }
      // casar o texto traduzido de volta à posição da frase na questão
      let pos = -1;
      for (let k = 0; k < q.units.length; k += 1) {
        if (q.units[k] === item.text && !used.has(`${item.type}|${item.qid}|${k}`)) {
          pos = k;
          break;
        }
      }
      if (pos < 0) {
        unmatched += 1;
        continue;
      }
      used.add(`${item.type}|${item.qid}|${pos}`);
      q.t[pos] = c ? { l, c } : { l };
      ok += 1;
      translated += 1;
    }
    console.log(`lote ${n}: ok=${ok} itens=${items.length}`);
  }
}

fs.mkdirSync(TARGET_DIR, { recursive: true });
let covered = 0;
let total = 0;
for (const [type, data] of Object.entries(byType)) {
  const out = {};
  for (const [qid, q] of Object.entries(data)) {
    if (q.t.some((x) => x !== null)) out[qid] = { t: q.t };
    covered += q.t.filter((x) => x !== null).length;
    total += q.t.length;
  }
  fs.writeFileSync(path.join(TARGET_DIR, `${type}.json`), JSON.stringify(out, null, 2));
  console.log(`${type}.json: ${Object.keys(out).length} questões`);
}
console.log(
  `RELATÓRIO: traduzidas=${translated} invalidas=${invalid} sem_casamento=${unmatched} lotes_pendentes=${pending} cobertura=${covered}/${total}`,
);
