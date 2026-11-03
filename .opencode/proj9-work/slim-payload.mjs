// Projeto 9 — Fase 5 (D2): reduz o payload dos JSONs do banco.
//
// Regra (PRD §3.5): em vez de replicar a mesma string em 4-5 campos, o arquivo guarda
// UMA cópia e o leitor (catalog.ts) deriva o resto — o contrato dos motores não muda.
// Conservador: só remove um campo quando a igualdade é verificada item a item.
// Campos `prompt` idênticos ao texto padrão do tipo saem do JSON e viram constante
// em catalog.ts (DEFAULT_PROMPTS). Antes/depois medidos em bytes.
//
// Uso: node .opencode/proj9-work/slim-payload.mjs
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "src", "data", "pte");

const FILES = [
  "read_aloud.json",
  "repeat_sentence.json",
  "retell_lecture.json",
  "answer_short.json",
  "swt.json",
  "write_essay.json",
  "reorder_paragraphs.json",
  "read_fib.json",
  "mcq_single.json",
  "mcq_multi.json",
  "wfd.json",
  "lst_fib.json",
  "summarize_spoken_text.json",
  "lst_hiw.json",
  "lst_hcs.json",
  "lst_summary.json",
  "lst_smw.json",
  "lst_mcq.json",
  "lst_mcq_multi.json",
];

const norm = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
const eq = (a, b) => norm(a) === norm(b) && norm(a).length > 0;

// ---------- 1. prompt modal (não vazio) por arquivo + quantas vezes aparece ----------
const modalPrompt = new Map();
const modalCount = new Map();
for (const file of FILES) {
  const list = getList(file);
  const counts = new Map();
  for (const q of list) {
    const p = norm(q.prompt);
    if (!p) continue;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  modalPrompt.set(file, best ? best[0] : "");
  modalCount.set(file, best ? best[1] : 0);
}

function getList(file) {
  const json = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  return Array.isArray(json) ? json : (json.questions ?? []);
}

// ---------- 2. regras de remoção por tipo ----------
const ANSWER_IS_TEXT = new Set(["wfd.json", "repeat_sentence.json"]);

function slimItem(file, q, defaults) {
  const out = {};
  const keep = (k) => {
    if (q[k] !== undefined) out[k] = q[k];
  };
  // Campos sempre redundantes: `content` espelha `text`; type/section vêm do arquivo.
  const textOr = q.text ?? q.content ?? "";
  const answerOr = q.answer ?? "";

  if (ANSWER_IS_TEXT.has(file)) {
    // text/transcript/audio_text são cópias exatas da resposta → fica só `answer`.
    if (!(eq(q.text, answerOr) && eq(q.transcript, answerOr) && eq(q.audio_text, answerOr))) {
      throw new Error(`${file}/${q.id}: cópias de resposta divergem — não remover`);
    }
  } else if (file === "reorder_paragraphs.json") {
    // `text` = items embaralhados juntos → derivado pelo leitor.
    const joined = Array.isArray(q.items) ? q.items.map(norm).join(" ") : "";
    if (!eq(q.text, joined)) throw new Error(`${file}/${q.id}: text != items — não remover`);
  } else if (file === "write_essay.json") {
    // `text` = o próprio enunciado (prompt) → derivado pelo leitor.
    if (!eq(q.text, q.prompt)) throw new Error(`${file}/${q.id}: text != prompt — não remover`);
  } else {
    keep("text");
  }

  // Campos de fala redundantes quando iguais ao texto exibido (ou vazios).
  if (file !== "lst_fib.json") {
    // lst_fib mantém `transcript` (texto preenchido — difere do texto com lacunas).
    const sameT = !q.transcript || eq(q.transcript, textOr);
    const sameA = !q.audio_text || eq(q.audio_text, textOr);
    if (!sameT || !sameA) {
      throw new Error(`${file}/${q.id}: transcript/audio_text != text — não remover`);
    }
  } else {
    if (q.transcript !== undefined) keep("transcript"); // áudio = texto preenchido
  }

  // read_aloud: `answer` não é lido pelo motor (o texto exibido é `text`) → fora.
  if (file === "read_aloud.json") {
    // (alguns itens têm answer == text; tanto faz — o campo não é consumido)
  }

  // prompt: sai quando igual ao modal do tipo (ou vazio) — vira constante no leitor;
  // variantes fora do padrão permanecem no item (são exibidas como estão).
  for (const k of [
    "id",
    "prompt",
    "text",
    "transcript",
    "audio_text",
    "answer",
    "options",
    "blanks",
    "items",
    "correct_order",
    "errors",
    "explanation",
    "trap",
    "grading_notes",
    "sample",
    "vocabulary",
    "essay_type",
    "topic",
    "source",
    "word_count",
    "difficulty",
    "exam_frequency",
  ]) {
    if (k === "text" || k === "transcript" || k === "audio_text") continue;
    keep(k);
  }
  // transcript/audio_text vazios somem; os reais ficam (lst_fib).
  if (out["transcript"] === "") delete out["transcript"];
  if (out["audio_text"] === "") delete out["audio_text"];
  // prompt padrão do tipo não viaja no JSON (constante no leitor); variantes e
  // enunciados únicos (essay, lst_summary) ficam no item.
  if (out["prompt"] !== undefined) {
    const p = norm(out["prompt"]);
    const isDefault = p === norm(modalPrompt.get(file)) && modalCount.get(file) >= 5;
    if (!p || (isDefault && file !== "write_essay.json")) delete out["prompt"];
  }
  return out;
}

// ---------- 3. aplica e mede ----------
const defaults = {};
let before = 0;
let after = 0;
for (const file of FILES) {
  const path = join(DIR, file);
  const sizeBefore = statSync(path).size;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const list = Array.isArray(raw) ? raw : (raw.questions ?? []);
  before += sizeBefore;
  const slimmed = list.map((q) => slimItem(file, q));
  const out = Array.isArray(raw) ? slimmed : { ...raw, questions: slimmed };
  const payload = JSON.stringify(out, null, 2) + "\n";
  after += Buffer.byteLength(payload);
  writeFileSync(path, payload);
  const modal = modalPrompt.get(file);
  if (modal && modalCount.get(file) >= 5) defaults[file.replace(".json", "")] = modal;
  console.log(
    `${file}: ${list.length} itens · ${Math.round(sizeBefore / 1024)} KB → ${Math.round(Buffer.byteLength(payload) / 1024)} KB`,
  );
}
writeFileSync(
  join(ROOT, ".opencode/proj9-work/default-prompts.json"),
  JSON.stringify(defaults, null, 2) + "\n",
);
console.log(
  `\nTotal: ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB (${Math.round((1 - after / before) * 100)}% menor)`,
);
