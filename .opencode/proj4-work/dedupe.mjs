// Dedupe + merge infra para o projeto 4 (expansão do banco PTE).
// Uso: node .opencode/proj4-work/dedupe.mjs <type> <candidates.json> [...more.json]
// - candidates: array de questões no schema raw aceito por src/lib/pte/catalog.ts
// - normaliza (lowercase, NFKC, sem pontuação/espaços extras), hash exato,
//   e similaridade Jaccard de tokens ≥ 0.85 contra TODO o banco do tipo
//   (existentes + novos de outras fontes) → descarta.
// Saída: imprime relatório (encontrados, inválidos, duplicatas, integrados)
// e grava .opencode/proj4-work/out/<type>.merged.json (JSON final do tipo).

import fs from "node:fs";
import path from "node:path";

const ROOT = "/dev-server";

export function normText(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenSet(s) {
  return new Set(normText(s).split(" ").filter(Boolean));
}

export function jaccard(a, b) {
  const A = tokenSet(a),
    B = tokenSet(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Texto-chave de comparação por tipo (passagem/pergunta/transcript). */
export function keyText(q) {
  return (
    [q.text, q.content, q.transcript, q.prompt]
      .filter((s) => typeof s === "string" && s.trim())
      .join(" ") || normText(q.answer ?? "")
  );
}

export function existingOf(type) {
  const p = path.join(ROOT, "src/data/pte", `${type}.json`);
  if (!fs.existsSync(p)) return [];
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  return Array.isArray(d) ? d : (d.questions ?? []);
}

export function run(type, candidateFiles, threshold = 0.85) {
  const existing = existingOf(type);
  const seenHashes = new Set(existing.map((q) => normText(keyText(q))));
  const existingTexts = existing.map((q) => keyText(q));

  let found = 0,
    invalid = 0,
    dupExact = 0,
    dupNear = 0,
    kept = [];
  for (const f of candidateFiles) {
    let list;
    try {
      list = JSON.parse(fs.readFileSync(f, "utf8"));
      if (!Array.isArray(list)) list = list.questions ?? [];
    } catch (e) {
      console.error(`parse fail: ${f}: ${e.message}`);
      continue;
    }
    for (const q of list) {
      found++;
      if (!q || !q.id || !keyText(q) || normText(keyText(q)).length < 20) {
        invalid++;
        continue;
      }
      const h = normText(keyText(q));
      if (seenHashes.has(h)) {
        dupExact++;
        continue;
      }
      const kt = keyText(q);
      let near = false;
      for (const t of existingTexts) {
        if (jaccard(kt, t) >= threshold) {
          near = true;
          break;
        }
      }
      if (!near) {
        for (const k of kept) {
          if (jaccard(kt, keyText(k)) >= threshold) {
            near = true;
            break;
          }
        }
      }
      if (near) {
        dupNear++;
        continue;
      }
      seenHashes.add(h);
      existingTexts.push(kt);
      kept.push(q);
    }
  }
  console.log(
    `[${type}] encontrados=${found} inválidos=${invalid} dupExatas=${dupExact} dupProximas=${dupNear} integrados=${kept.length} (banco atual=${existing.length})`,
  );
  const outDir = path.join(ROOT, ".opencode/proj4-work/out");
  fs.mkdirSync(outDir, { recursive: true });
  const merged = [...existing, ...kept];
  fs.writeFileSync(path.join(outDir, `${type}.merged.json`), JSON.stringify(merged, null, 2));
  fs.writeFileSync(path.join(outDir, `${type}.new.json`), JSON.stringify(kept, null, 2));
  return { type, found, invalid, dupExact, dupNear, kept: kept.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [type, ...files] = process.argv.slice(2);
  if (!type || files.length === 0) {
    console.error("uso: node dedupe.mjs <type> <candidates.json> [...]");
    process.exit(1);
  }
  run(type, files);
}
