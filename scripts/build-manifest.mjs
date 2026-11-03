// Gera src/data/pte/manifest.json — índice leve (id, tipo, tópico, fonte, nº de palavras, dificuldade)
// de todas as questões, para Home/listas/sessões não precisarem carregar os JSONs completos.
// Uso: node scripts/build-manifest.mjs   (rode sempre que src/data/pte/*.json mudar; o teste bank-integrity avisa se estiver velho)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "pte");

// arquivo → [taskType, seção] (espelha TYPE_META em src/lib/pte/types.ts; o teste garante a paridade)
const FILES = {
  "read_aloud.json": ["read_aloud", "speaking"],
  "repeat_sentence.json": ["repeat_sentence", "speaking"],
  "retell_lecture.json": ["retell_lecture", "speaking"],
  "answer_short.json": ["answer_short", "speaking"],
  "swt.json": ["swt", "writing"],
  "write_essay.json": ["write_essay", "writing"],
  "reorder_paragraphs.json": ["reorder_paragraphs", "reading"],
  "read_fib.json": ["read_fib", "reading"],
  "mcq_single.json": ["mcq_single", "reading"],
  "mcq_multi.json": ["mcq_multi", "reading"],
  "wfd.json": ["wfd", "listening"],
  "lst_fib.json": ["lst_fib", "listening"],
  "summarize_spoken_text.json": ["summarize_spoken_text", "listening"],
  "lst_hiw.json": ["lst_hiw", "listening"],
  "lst_hcs.json": ["lst_hcs", "listening"],
  "lst_summary.json": ["lst_summary", "listening"],
  "lst_smw.json": ["lst_smw", "listening"],
  "lst_mcq.json": ["lst_mcq", "listening"],
  "lst_mcq_multi.json": ["lst_mcq_multi", "listening"],
  // Fase 7 (projeto 9): os 3 tipos novos do formato 2025.
  "summarize_group_discussion.json": ["summarize_group_discussion", "speaking"],
  "respond_to_situation.json": ["respond_to_situation", "speaking"],
  "describe_image.json": ["describe_image", "speaking"],
};
const SECTION_ORDER = ["speaking", "writing", "reading", "listening"];

const str = (v) => (typeof v === "string" ? v.trim() : "");
const tokenize = (t) =>
  t
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

const rows = [];
for (const [file, [taskType, section]] of Object.entries(FILES)) {
  const json = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  const list = Array.isArray(json) ? json : (json.questions ?? []);
  for (const q of list) {
    const id = str(q.id);
    // Fase 5 (D2): arquivo enxuto guarda uma única cópia do texto — mesma cadeia
    // de fallback do leitor (src/lib/pte/catalog.ts → baseOf).
    const ANSWER_IS_TEXT = file === "wfd.json" || file === "repeat_sentence.json";
    let text = str(q.text) || str(q.content);
    if (!text && ANSWER_IS_TEXT) text = str(q.answer);
    if (!text && file === "write_essay.json") text = str(q.prompt);
    // Fase 7: SGD deriva o texto dos turnos; DI usa a descrição de referência
    // (mesma cadeia de fallback de src/lib/pte/catalog.ts → baseOf).
    if (!text && file === "summarize_group_discussion.json" && Array.isArray(q.turns)) {
      text = q.turns
        .map((t) => str(t.text))
        .filter(Boolean)
        .join(" ");
    }
    if (!text && file === "describe_image.json") text = str(q.text) || str(q.description);
    if (!text && file === "reorder_paragraphs.json" && Array.isArray(q.items)) {
      text = q.items.map(str).filter(Boolean).join(" ");
    }
    if (!id || !text) continue;
    const row = {
      id,
      t: taskType,
      s: section,
      topic: str(q.topic) || "sem tópico",
      src: str(q.source),
      wc:
        typeof q.word_count === "number" && Number.isFinite(q.word_count)
          ? q.word_count
          : tokenize(text).length,
    };
    if (["easy", "medium", "hard"].includes(q.difficulty)) row.d = q.difficulty;
    rows.push(row);
  }
}
rows.sort(
  (a, b) => SECTION_ORDER.indexOf(a.s) - SECTION_ORDER.indexOf(b.s) || a.id.localeCompare(b.id),
);
writeFileSync(join(DIR, "manifest.json"), JSON.stringify(rows) + "\n");
console.log(`manifest.json: ${rows.length} questões`);

// Fase 6: descrição do webmanifest derivada do banco (nada de "16 task types" fixo).
const WM = join(DIR, "..", "..", "..", "public", "manifest.webmanifest");
const wm = JSON.parse(readFileSync(WM, "utf8"));
const types = new Set(rows.map((r) => r.t)).size;
wm.description = `Treino interativo para PTE Academic com ${types} task types e ${rows.length} questões, correção em tempo real e uso offline.`;
writeFileSync(WM, JSON.stringify(wm, null, 2) + "\n");
console.log(`manifest.webmanifest: ${wm.description}`);
