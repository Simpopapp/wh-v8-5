// Fase 1 — geração do glossário EN → pt-BR via Lovable AI Gateway (dev-time).
// Uso: node .opencode/proj6-work/generate-glossary.mjs [--start N] [--batches M]
// Lê out/words.json (frequência desc) em lotes de 60 palavras, chama
// openai/gpt-6-astra em /v1/responses (SSE, reasoning low, JSON estrito),
// valida cada tradução e faz merge sem sobrescrever entradas já válidas.
// Sempre resumível: reexecutar com --start avançando por lotes concluídos.
// 402/403 → encerra imediatamente (crédito/conta), sem retries.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORDS = path.join(ROOT, ".opencode/proj6-work/out/words.json");
const TARGET = path.join(ROOT, "src/data/plus/glossary.json");
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";
const BATCH = 60;
const MAX_ATTEMPTS = 3;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : def;
};
const startBatch = opt("--start", 0);
const batchCount = opt("--batches", 10);

const words = JSON.parse(fs.readFileSync(WORDS, "utf8"));
fs.mkdirSync(path.dirname(TARGET), { recursive: true });

let glossary = {};
if (fs.existsSync(TARGET)) {
  const prev = JSON.parse(fs.readFileSync(TARGET, "utf8"));
  if (prev && typeof prev === "object" && !Array.isArray(prev)) glossary = prev;
}
const already = new Set(Object.keys(glossary));

const SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          literal: { type: "string" },
          contextual: { type: ["string", "null"] },
        },
        required: ["word", "literal", "contextual"],
        additionalProperties: false,
      },
    },
  },
  required: ["translations"],
  additionalProperties: false,
};

const SYSTEM = [
  "Você é um dicionário EN → pt-BR para estudantes de inglês (exame PTE).",
  "Para cada palavra recebida, devolva: 'literal' (tradução mais comum, 1–3 palavras, minúsculas, ≤ 60 chars)",
  "e 'contextual' (nota curta ≤ 80 chars sobre uso/nuance típica em inglês acadêmico; null se trivial).",
  "Responda SOMENTE com JSON válido no schema pedido. Português do Brasil.",
].join(" ");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callBatch(batch) {
  const user = [
    "Traduza estas palavras de inglês para português do Brasil.",
    "Devolva uma entrada para CADA palavra, na mesma ordem.",
    "Palavras:",
    JSON.stringify(batch),
  ].join("\n");

  const body = {
    model: MODEL,
    input: [
      { role: "system", content: [{ type: "input_text", text: SYSTEM }] },
      { role: "user", content: [{ type: "input_text", text: user }] },
    ],
    stream: true,
    store: false,
    reasoning: { effort: "low", summary: "auto" },
    include: ["reasoning.encrypted_content"],
    text: { format: { type: "json_schema", name: "glossary_batch", strict: true, schema: SCHEMA } },
  };

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": process.env["LOVABLE_API_KEY"] ?? "",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 402 || res.status === 403) {
      const msg = (await res.text()).slice(0, 200);
      throw new Error(`HALT ${res.status}: ${msg}`);
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`HTTP ${res.status}`);
      await sleep(attempt * 4000);
      continue;
    }
    if (!res.ok) throw new Error(`HALT HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

    // SSE: acumula deltas de response.output_text.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let acc = "";
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      if (d) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const ev of events) {
        for (const line of ev.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          let j;
          try {
            j = JSON.parse(data);
          } catch {
            continue;
          }
          if (j.type === "response.output_text.delta" && typeof j.delta === "string")
            acc += j.delta;
          if (j.type === "response.completed") done = true;
          if (j.type === "response.failed" || j.type === "error") {
            throw new Error(`HALT stream: ${JSON.stringify(j).slice(0, 200)}`);
          }
        }
      }
    }
    return JSON.parse(acc);
  }
  throw lastErr ?? new Error("unreachable");
}

function validEntry(literal, contextual) {
  if (typeof literal !== "string") return null;
  const lit = literal.trim();
  if (lit.length < 1 || lit.length > 80) return null;
  let ctx = null;
  if (typeof contextual === "string") {
    const c = contextual.trim();
    if (c.length > 0 && c.length <= 80) ctx = c;
  }
  return ctx ? { literal: lit, contextual: ctx } : { literal: lit };
}

let translated = 0;
let invalid = 0;
let missing = 0;
const totalBatches = Math.min(batchCount, Math.ceil((words.length - startBatch * BATCH) / BATCH));

for (let b = 0; b < totalBatches; b++) {
  const idx = (startBatch + b) * BATCH;
  const batch = words
    .slice(idx, idx + BATCH)
    .map((x) => x.w)
    .filter((w) => !already.has(w));
  if (batch.length === 0) {
    console.log(`lote ${startBatch + b}: já completo`);
    continue;
  }
  try {
    const out = await callBatch(batch);
    const byWord = new Map();
    for (const t of Array.isArray(out.translations) ? out.translations : []) {
      if (!t || typeof t.word !== "string") continue;
      const key = t.word.toLowerCase().trim();
      if (!batch.includes(key)) continue;
      const entry = validEntry(t.literal, t.contextual);
      if (entry) byWord.set(key, entry);
      else invalid++;
    }
    for (const w of batch) {
      const e = byWord.get(w);
      if (e) {
        glossary[w] = e;
        already.add(w);
        translated++;
      } else missing++;
    }
  } catch (e) {
    console.error(`lote ${startBatch + b} falhou: ${e.message}`);
    if (String(e.message).startsWith("HALT")) {
      console.error("EXECUÇÃO ENCERRADA — corrigir o bloqueio antes de retomar.");
      process.exit(2);
    }
    continue;
  }
  // grava a cada lote (resumível)
  fs.writeFileSync(TARGET, JSON.stringify(glossary, null, 2));
  console.log(
    `lote ${startBatch + b} ok — traduzidas=${translated} faltando=${missing} inválidas=${invalid} total=${Object.keys(glossary).length}`,
  );
}

console.log(
  `RELATÓRIO: traduzidas=${translated} faltando=${missing} inválidas=${invalid} entradas_no_arquivo=${Object.keys(glossary).length}`,
);
