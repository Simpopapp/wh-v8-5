import { describe, expect, it } from "vitest";

import {
  SECTION_META,
  TYPE_META,
  allMeta,
  getMeta,
  loadAllQuestions,
  loadQuestion,
  loadTypeQuestions,
  metaBySection,
  metaByType,
  nextIdInType,
  prevIdInType,
  sectionCounts,
  TOTAL_ALL_QUESTIONS,
  typeCounts,
} from "@/lib/pte";

const EXPECTED_COUNTS: Record<string, number> = {
  read_aloud: 195,
  repeat_sentence: 586,
  retell_lecture: 81,
  answer_short: 141,
  swt: 79,
  write_essay: 43,
  mcq_single: 106,
  mcq_multi: 18,
  reorder_paragraphs: 57,
  read_fib: 62,
  wfd: 934,
  lst_fib: 96,
  summarize_spoken_text: 115,
  lst_hiw: 3,
  lst_hcs: 3,
  lst_summary: 5,
  lst_smw: 3,
  lst_mcq: 6,
  lst_mcq_multi: 3,
  // Fase 7 do projeto 9 — os 3 tipos novos do formato 2025.
  summarize_group_discussion: 13,
  respond_to_situation: 63,
  describe_image: 6,
};
const TOTAL = Object.values(EXPECTED_COUNTS).reduce((a, b) => a + b, 0);

const all = await loadAllQuestions();

describe("Catálogo (22 task types, carregamento sob demanda)", () => {
  it("manifesto e conteúdo completo têm o mesmo total", () => {
    expect(TOTAL_ALL_QUESTIONS).toBe(TOTAL);
    expect(allMeta.length).toBe(TOTAL);
    expect(all.length).toBe(TOTAL);
  });

  it("contagens por task type batem com o inventário", () => {
    for (const [t, n] of Object.entries(EXPECTED_COUNTS)) {
      expect(typeCounts[t as keyof typeof typeCounts]).toBe(n);
    }
  });

  it("soma das seções = total e metadados coerentes", () => {
    const sum = Object.values(sectionCounts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(TOTAL);
    for (const q of all) {
      expect(q.section).toBe(TYPE_META[q.taskType].section);
      expect(SECTION_META[q.section]).toBeDefined();
      expect(q.wordCount).toBeGreaterThan(0);
      expect(q.topic.length).toBeGreaterThan(0);
    }
  });

  it("ids únicos e carregamento por id funciona", async () => {
    expect(new Set(all.map((q) => q.id)).size).toBe(TOTAL);
    const first = allMeta[0]!;
    expect((await loadQuestion(first.id))?.id).toBe(first.id);
    expect(await loadQuestion("id-inexistente")).toBeUndefined();
    expect(getMeta("id-inexistente")).toBeUndefined();
  });

  it("manifesto está em dia com os JSONs (rode `node scripts/build-manifest.mjs`)", () => {
    const byId = new Map(all.map((q) => [q.id, q]));
    for (const m of allMeta) {
      const q = byId.get(m.id);
      expect(q, `manifesto referencia ${m.id} que não existe nos dados`).toBeDefined();
      expect(q!.taskType).toBe(m.taskType);
      expect(q!.topic).toBe(m.topic);
      expect(q!.wordCount).toBe(m.wordCount);
    }
  });

  it("questões de escolha têm opções e respostas normalizadas", async () => {
    const choice = all.filter((q) => "options" in q);
    expect(choice.length).toBe(106 + 18 + 6 + 3 + 3 + 3);
    for (const q of choice) {
      expect(q.options.length).toBeGreaterThan(0);
      expect(Array.isArray(q.answer)).toBe(true);
    }
    const multi = await loadTypeQuestions("mcq_multi");
    expect(multi[0] && "answer" in multi[0] && multi[0].answer.length).toBeGreaterThan(1);
  });

  it("ditado e lacunas têm gabarito", async () => {
    for (const q of await loadTypeQuestions("wfd")) {
      if (!("answer" in q)) throw new Error("wfd sem answer");
      expect((q.answer as string).length).toBeGreaterThan(0);
    }
    for (const q of await loadTypeQuestions("lst_fib")) {
      if (!("answers" in q)) throw new Error("fib sem answers");
      expect((q.answers as string[]).length).toBeGreaterThan(0);
    }
    for (const q of await loadTypeQuestions("lst_hiw")) {
      if (!("errorIndexes" in q)) throw new Error("hiw sem errors");
      expect((q.errorIndexes as number[]).length).toBeGreaterThan(0);
    }
  });

  it("metaBySection / metaByType agrupam conforme TYPE_META", () => {
    for (const s of ["speaking", "writing", "reading", "listening"] as const) {
      const list = metaBySection(s);
      expect(list.length).toBe(sectionCounts[s]);
      for (const q of list) expect(q.section).toBe(s);
    }
    expect(metaByType("wfd").length).toBe(934);
  });

  it("navegação anterior/próxima é circular dentro do task type", () => {
    const list = metaByType("answer_short");
    const first = list[0]!.id;
    const last = list[list.length - 1]!.id;
    expect(nextIdInType(last)).toBe(first);
    expect(prevIdInType(first)).toBe(last);
    expect(nextIdInType(first)).toBe(list[1]!.id);
  });
});
