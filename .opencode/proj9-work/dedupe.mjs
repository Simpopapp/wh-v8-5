// Projeto 9 — Fase 5 (C3/D7): detecção de quase-duplicatas em TODOS os task types.
//
// Regra (PRD §3.5): normaliza o texto de comparação (texto principal, ou a resposta
// quando o texto é a resposta), agrupa por prefixo normalizado de 200 caracteres e
// mede similaridade de trigramas (Jaccard ≥ 0,85). Grupos → canonical-map.json
// (`qid → canonicalId`, o menor id lexicográfico vence — proxy determinístico de
// "o mais antigo"). As duplicatas PERMANECEM no banco com selo "repetida" e saem
// das filas; o progresso é fundido pelo canonicalId na migração (storage v6).
//
// Uso: node .opencode/proj9-work/dedupe.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "src", "data", "pte");

const FILES = {
  "read_aloud.json": "read_aloud",
  "repeat_sentence.json": "repeat_sentence",
  "retell_lecture.json": "retell_lecture",
  "answer_short.json": "answer_short",
  "swt.json": "swt",
  "write_essay.json": "write_essay",
  "reorder_paragraphs.json": "reorder_paragraphs",
  "read_fib.json": "read_fib",
  "mcq_single.json": "mcq_single",
  "mcq_multi.json": "mcq_multi",
  "wfd.json": "wfd",
  "lst_fib.json": "lst_fib",
  "summarize_spoken_text.json": "summarize_spoken_text",
  "lst_hiw.json": "lst_hiw",
  "lst_hcs.json": "lst_hcs",
  "lst_summary.json": "lst_summary",
  "lst_smw.json": "lst_smw",
  "lst_mcq.json": "lst_mcq",
  "lst_mcq_multi.json": "lst_mcq_multi",
};

/** Tipos em que a RESPOSTA é o texto dito/escrito — compara pela resposta. */
const ANSWER_IS_TEXT = new Set(["wfd", "repeat_sentence", "answer_short"]);

const normalize = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function trigrams(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return inter / (a.size + b.size - inter);
}

const SIM_THRESHOLD = 0.85;

const rows = []; // { id, type, norm }
for (const [file, type] of Object.entries(FILES)) {
  const json = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  const list = Array.isArray(json) ? json : (json.questions ?? []);
  for (const q of list) {
    if (!q?.id) continue;
    const cmp = ANSWER_IS_TEXT.has(type) ? (q.answer ?? q.text ?? "") : (q.text ?? q.content ?? "");
    rows.push({ id: q.id, type, norm: normalize(cmp) });
  }
}

// Bucket por prefixo de 100 chars dentro do mesmo tipo (evita O(n²) global).
// 100 chars: os pares conhecidos de SWT dividem o início e divergem depois.
const PREFIX_LEN = 100;
const buckets = new Map();
for (const r of rows) {
  if (r.norm.length < 40) continue; // frases curtas demais: sem comparação confiável
  const key = `${r.type}|${r.norm.slice(0, PREFIX_LEN)}`;
  const b = buckets.get(key) ?? [];
  b.push(r);
  buckets.set(key, b);
}

// Union-find dentro de cada bucket.
const parent = new Map();
const find = (x) => {
  const p = parent.get(x);
  if (p === undefined || p === x) return x;
  const root = find(p);
  parent.set(x, root);
  return root;
};
const union = (a, b) => {
  const ra = find(a);
  const rb = find(b);
  if (ra !== rb) parent.set(ra, rb);
};
for (const r of rows) parent.set(r.id, r.id);

const groups = [];
/** Critério do PRD (C3): mesmo início de ≥ 200 caracteres normalizados = quase-duplicata,
 *  mesmo que o texto divirja depois (similaridade plena ≥ 0,85 também une). */
const MIN_COMMON_PREFIX = 200;
function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}
for (const b of buckets.values()) {
  if (b.length < 2) continue;
  const tri = b.map((r) => trigrams(r.norm));
  for (let i = 0; i < b.length; i++) {
    for (let j = i + 1; j < b.length; j++) {
      const sameStart = commonPrefixLen(b[i].norm, b[j].norm) >= MIN_COMMON_PREFIX;
      if (sameStart || b[i].norm === b[j].norm || jaccard(tri[i], tri[j]) >= SIM_THRESHOLD) {
        union(b[i].id, b[j].id);
      }
    }
  }
}

const byRoot = new Map();
for (const r of rows) {
  if (r.norm.length < 40) continue;
  const root = find(r.id);
  const g = byRoot.get(root) ?? [];
  g.push(r);
  byRoot.set(root, g);
}

const canonicalMap = {};
const report = [];
let dupCount = 0;
for (const g of byRoot.values()) {
  if (g.length < 2) continue;
  const ids = g.map((r) => r.id).sort();
  const canon = ids[0];
  for (const id of ids) canonicalMap[id] = canon;
  dupCount += ids.length - 1;
  report.push({ type: g[0].type, canonical: canon, duplicates: ids.slice(1) });
}
report.sort((a, b) => a.type.localeCompare(b.type) || a.canonical.localeCompare(b.canonical));

mkdirSync(join(ROOT, "src", "data", "pte"), { recursive: true });
writeFileSync(
  join(DIR, "canonical-map.json"),
  JSON.stringify(canonicalMap, Object.keys(canonicalMap).sort(), 1) + "\n",
);

console.log(`Grupos de duplicatas: ${report.length} · ids duplicados: ${dupCount}`);
for (const r of report) {
  console.log(`${r.type}: ${r.canonical} <- ${r.duplicates.join(", ")}`);
}
