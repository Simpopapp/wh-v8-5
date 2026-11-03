/**
 * Projeto 8 — Etapa A: fatia as 6.000 candidatas em 30 lotes de 200.
 * Lê .opencode/proj6-work/out/words.json [{w,n}] (ordem de frequência) e grava
 * .opencode/proj8-work/in/batch-NNN.json = ["word", ...] (só as palavras).
 * Idempotente: regravar produz as mesmas entradas.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = "/dev-server";
const IN = path.join(ROOT, ".opencode/proj6-work/out/words.json");
const OUT_DIR = path.join(ROOT, ".opencode/proj8-work/in");
const BATCH_SIZE = 200;

const words = JSON.parse(readFileSync(IN, "utf8")).map((x) => x["w"]);
if (words.length !== 6000) throw new Error(`esperado 6000 candidatas, got ${words.length}`);

const seen = new Set();
for (const w of words) {
  if (seen.has(w)) throw new Error(`duplicada em words.json: ${w}`);
  seen.add(w);
}

mkdirSync(OUT_DIR, { recursive: true });
const batches = [];
for (let i = 0; i < words.length; i += BATCH_SIZE) {
  batches.push(words.slice(i, i + BATCH_SIZE));
}
batches.forEach((batch, i) => {
  writeFileSync(
    path.join(OUT_DIR, `batch-${String(i).padStart(3, "0")}.json`),
    JSON.stringify(batch),
  );
});

// Relatório
const union = new Set(batches.flat());
console.log(`TOTAL=${words.length} LOTES=${batches.length} TAMANHO=${BATCH_SIZE}`);
console.log(`UNIAO=${union.size} (deve ser 6000, sem repetição e sem perda)`);
batches.forEach((b, i) => {
  const first = path.basename(b[0]);
  console.log(`batch-${String(i).padStart(3, "0")}: ${b.length} palavras (primeira: ${first})`);
});
