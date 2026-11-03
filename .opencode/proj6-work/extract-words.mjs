// Fase 1 — extração de palavras do banco PTE (dev-time, sem rede).
// Uso: node .opencode/proj6-work/extract-words.mjs
// Varre src/data/pte/*.json, coleta strings de campos textuais, tokeniza,
// conta frequência e grava out/words.json [{ w, n }] ordenado por frequência.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BANK = path.join(ROOT, "src/data/pte");
const OUT_DIR = path.join(ROOT, ".opencode/proj6-work/out");

const FIELD_RE =
  /text|content|transcript|prompt|passage|option|answer|model|sample|summary|explanation|template/i;

function walk(value, key, sink) {
  if (typeof value === "string") {
    if (key && FIELD_RE.test(key) && value.length >= 8) sink.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walk(v, key, sink);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walk(v, k, sink);
  }
}

function tokenize(text) {
  const raw = text.match(/[A-Za-z][A-Za-z'\u2019-]*/g) ?? [];
  const out = [];
  for (const t of raw) {
    let w = t.toLowerCase().replace(/^['\u2019-]+|['\u2019-]+$/g, "");
    if (w.length < 2 || !/^[a-z]+$/.test(w.replace(/-/g, ""))) continue;
    if (w.length > 30) continue;
    out.push(w);
  }
  return out;
}

const files = fs.readdirSync(BANK).filter((f) => f.endsWith(".json") && f !== "manifest.json");
const freq = new Map();
let totalTokens = 0;
let totalStrings = 0;

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(BANK, f), "utf8"));
  const sink = [];
  walk(data, "", sink);
  totalStrings += sink.length;
  for (const s of sink) {
    for (const w of tokenize(s)) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
      totalTokens++;
    }
  }
}

const words = [...freq.entries()]
  .map(([w, n]) => ({ w, n }))
  .sort((a, b) => b.n - a.n || a.w.localeCompare(b.w))
  .slice(0, 6000);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "words.json"), JSON.stringify(words, null, 2));

console.log(
  `arquivos=${files.length} strings=${totalStrings} tokens=${totalTokens} unicas=${freq.size} gravadas=${words.length}`,
);
