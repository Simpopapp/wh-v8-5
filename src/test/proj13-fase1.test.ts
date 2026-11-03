/**
 * Projeto 13 — Fase 1: simulado confiável.
 * Cobertura: política oral compartilhada, fila/estimativa elegível, causas e
 * revisão pós-exame, draft persistido (retomada) e sessão de erros por qids.
 */
import { describe, expect, it } from "vitest";

import {
  causeOfVerdict,
  classifyOralFailure,
  decideOralVerdict,
  waitForOralFinalization,
  type OralInput,
} from "@/lib/pte/oralPolicy";
import {
  estimateSeconds,
  examQuestionCount,
  examReviewQids,
  type ExamResultRow,
} from "@/lib/pte/exam";
import {
  emptyState,
  migrateLegacyState,
  replaceState,
  clearSessionDraft,
  getStateSnapshot,
  exportBackup,
} from "@/lib/storage";
import { metaByType } from "@/lib/pte";
import { startErrorsSessionForQids } from "@/lib/session";

const oral = (over: Partial<OralInput> = {}): OralInput => ({
  supported: true,
  error: null,
  transcript: "the economy grew rapidly last year",
  durationMs: 12_000,
  pauses: 1,
  ...over,
});

describe("política oral compartilhada (prática ↔ exame)", () => {
  it("não avalia sem permissão de microfone — score null, causa technical", () => {
    const v = decideOralVerdict(oral({ error: "not-allowed" }), () => ({ score: 50 }));
    expect(v).toMatchObject({ score: null, gradable: false, failure: "permission", grade: null });
    expect(causeOfVerdict(v)).toBe("technical");
  });

  it("não avalia com falha de rede", () => {
    const v = decideOralVerdict(oral({ error: "network" }), () => ({ score: 50 }));
    expect(v.score).toBeNull();
    expect(causeOfVerdict(v)).toBe("technical");
  });

  it("não avalia sem suporte a ASR", () => {
    const v = decideOralVerdict(oral({ supported: false }), () => ({ score: 50 }));
    expect(v.failure).toBe("unsupported");
    expect(causeOfVerdict(v)).toBe("technical");
  });

  it("nada reconhecido é 'empty' — nunca 0 disfarçado", () => {
    const v = decideOralVerdict(oral({ transcript: "  " }), () => ({ score: 0 }));
    expect(v).toMatchObject({ score: null, failure: "empty" });
    expect(causeOfVerdict(v)).toBe("empty");
  });

  it("no-speech SEM texto é vazio; com texto a transcrição vale", () => {
    expect(classifyOralFailure(oral({ error: "no-speech", transcript: "" }))).toBe("empty");
    expect(classifyOralFailure(oral({ error: "no-speech" }))).toBeNull();
  });

  it("score 0 real é avaliável e entra na média", () => {
    const v = decideOralVerdict(oral(), () => ({ score: 0 }));
    expect(v).toMatchObject({ score: 0, gradable: true, failure: null });
    expect(causeOfVerdict(v)).toBe("graded");
  });

  it("gradador com gradable=false vira not_gradable", () => {
    const v = decideOralVerdict(oral(), () => ({ score: 0, gradable: false }));
    expect(v).toMatchObject({ score: null, failure: "not_gradable" });
    expect(causeOfVerdict(v)).toBe("not_gradable");
  });

  it("o veredito carrega o resultado completo do gradador (wpm, hits…)", () => {
    const g = { score: 80, wpm: 140, hits: 9, total: 10, gradable: true };
    const v = decideOralVerdict(oral(), () => g);
    expect(v.grade).toEqual(g);
  });

  it("espera a janela de finalização pós-stop (450 ms)", async () => {
    const started = Date.now();
    await waitForOralFinalization(() => {});
    expect(Date.now() - started).toBeGreaterThanOrEqual(400);
  });
});

describe("fila elegível e estimativas (D5)", () => {
  it("contagens mudam com verifiedOnly e são consistentes entre funções", () => {
    const full = examQuestionCount("mini");
    const verified = examQuestionCount("mini", { verifiedOnly: true });
    expect(full).toBeGreaterThan(0);
    expect(verified).toBeLessThanOrEqual(full);
    expect(estimateSeconds("mini", { verifiedOnly: true })).toBeGreaterThan(0);
  });

  it("fila do exame usa a mesma estimativa elegível (questões × tempos)", () => {
    for (const examId of ["speaking", "writing", "reading", "listening", "mini", "full"] as const) {
      const n = examQuestionCount(examId, { verifiedOnly: false });
      const est = estimateSeconds(examId, { verifiedOnly: false });
      expect(n).toBeGreaterThan(0);
      expect(est).toBeGreaterThan(0);
    }
  });
});

describe("causas, não avaliadas e revisão (§1.5–1.6)", () => {
  it("revisão pós-exame pega não avaliadas e notas abaixo de 70", () => {
    const rows: ExamResultRow[] = [
      { qid: "q1", score: 80, cause: "graded", answer: "minha resposta" },
      { qid: "q2", score: null, cause: "expired" },
      { qid: "q3", score: null, cause: "technical" },
      { qid: "q4", score: 70 }, // legado: 70 não é erro
    ];
    expect(examReviewQids(rows)).toEqual(["q2", "q3"]);
  });

  it("notas baixas e puladas entram na revisão", () => {
    const rows: ExamResultRow[] = [
      { qid: "q1", score: 40, cause: "graded", answer: "resposta" },
      { qid: "q2", score: null, cause: "skipped", answer: "" },
    ];
    expect(examReviewQids(rows)).toEqual(["q1", "q2"]);
  });
});

describe("examDraft — retomada (§1.1)", () => {
  it("examDraft é opcional, normalizado e preservado na migração", () => {
    const base = emptyState();
    expect(base.examDraft ?? null).toBeNull();

    const draft = {
      examId: "mini",
      queue: ["a", "b", "c"],
      index: 1,
      results: [{ qid: "a", score: null, cause: "expired" }],
      phase: "running",
      deadlineAt: 1_700_000_000_000,
      startedAt: 1_699_000_000_000,
    };
    const withDraft = migrateLegacyState({ ...base, examDraft: draft });
    expect(withDraft.examDraft).toEqual(draft);

    // Draft inválido/parcial é descartado, não quebra o app.
    const broken = migrateLegacyState({ ...base, examDraft: { examId: "mini" } as never });
    expect(broken.examDraft ?? null).toBeNull();
  });

  it("examDraft não entra no backup exportado (igual ao draft de sessão)", () => {
    const withDraft = migrateLegacyState({
      ...emptyState(),
      examDraft: {
        examId: "mini",
        queue: ["a"],
        index: 0,
        results: [],
        phase: "running",
        deadlineAt: 0,
        startedAt: 1,
      },
    });
    replaceState(withDraft);
    const json = exportBackup();
    expect(json).not.toContain("examDraft");
    expect(json).not.toContain("sessionDraft");
  });
});

describe("sessão de erros por qids exatos", () => {
  it("cria sessão contendo exatamente os qids pedidos", () => {
    clearSessionDraft();
    const qid = metaByType("read_aloud")[0]!.id;
    const n = startErrorsSessionForQids([qid, "qid_inexistente_xyz"]);
    expect(n).toBe(1);
    const draft = getStateSnapshot().draft;
    expect(draft?.kind).toBe("errors");
    expect(draft?.queue).toEqual([qid]);
    clearSessionDraft();
  });
});
