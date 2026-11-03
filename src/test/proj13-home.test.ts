// Projeto 13 — Fase 4 / S5: modelo da Home de retorno (§4.4.2).
// Retorno = atividade persistida · prioridade de retomada · ação do plano real.

import { beforeEach, describe, expect, it } from "vitest";

import { metaByType } from "@/lib/pte";
import { buildHomeDailyAction, hasStudyActivity, selectHomeResume } from "@/lib/home";
import { emptyState, type Attempt, type AppState } from "@/lib/storage";

const DAY = 86_400_000;
const T0 = Date.now() - 200 * DAY;
const id = (t: Parameters<typeof metaByType>[0], i = 0) => metaByType(t)[i]!.id;

function attempt(qid: string, taskType: Attempt["taskType"], ts: number): Attempt {
  return {
    qid,
    ts,
    taskType,
    mode: "manual",
    contentScore: 70,
    score: 70,
    wpm: null,
    durationMs: 1000,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("S5 · Home de retorno — atividade e retomada", () => {
  it("estado vazio = 1ª visita: sem retomada, mas com plano do dia", () => {
    const app = emptyState();
    expect(hasStudyActivity(app)).toBe(false);
    expect(selectHomeResume(app, Date.now())).toBeNull();
    const action = buildHomeDailyAction(app, Date.now());
    expect(action).not.toBeNull(); // a rotina já aparece na 1ª visita (§4.4.2)
    expect(action?.count ?? 0).toBeGreaterThan(0);
  });

  it("tentativa registrada = retorno; retomada aponta a última questão válida", () => {
    const good = id("wfd", 0);
    const gone = "q-inexistente";
    const app: AppState = {
      ...emptyState(),
      attempts: [attempt(gone, "wfd", T0 + 5000), attempt(good, "wfd", T0)],
    };
    expect(hasStudyActivity(app)).toBe(true);
    const resume = selectHomeResume(app, Date.now());
    expect(resume?.kind).toBe("question");
    if (resume?.kind === "question") {
      expect(resume.qid).toBe(good); // qid removido do catálogo é pulado
    }
  });

  it("vocabulário salvo também caracteriza retorno", () => {
    const app: AppState = {
      ...emptyState(),
      vocabulary: {
        words: {
          k1: {
            word: "apple",
            literal: "maçã",
            savedAt: T0,
            lastSeenAt: T0,
            seenCount: 0,
            box: 0,
            dueAt: T0,
            sources: [],
          },
        },
        phrases: {},
      },
    };
    expect(hasStudyActivity(app)).toBe(true);
  });

  it("prioridade: sessão em andamento vence; exame running vem depois", () => {
    const q = id("read_aloud", 0);
    const withSession: AppState = {
      ...emptyState(),
      draft: {
        kind: "mixed",
        label: "Sessão mista",
        queue: [q],
        index: 0,
        startedAt: T0,
        results: [],
      },
      examDraft: {
        examId: "mini",
        queue: [id("wfd", 0)],
        index: 0,
        results: [],
        phase: "running",
        deadlineAt: 0,
        startedAt: T0,
      },
    };
    const resume = selectHomeResume(withSession, Date.now());
    expect(resume?.kind).toBe("session");

    const examOnly: AppState = {
      ...emptyState(),
      examDraft: {
        examId: "mini",
        queue: [id("wfd", 0), id("wfd", 1)],
        index: 1,
        results: [],
        phase: "running",
        deadlineAt: 0,
        startedAt: T0,
      },
    };
    const r2 = selectHomeResume(examOnly, Date.now());
    expect(r2?.kind).toBe("exam");
    if (r2?.kind === "exam") expect(r2.remaining).toBe(1);
  });

  it("exame em 'summary' não disputa retomada; vocabDue assume quando não há draft", () => {
    const app: AppState = {
      ...emptyState(),
      examDraft: {
        examId: "mini",
        queue: [id("wfd", 0)],
        index: 1,
        results: [],
        phase: "summary",
        deadlineAt: 0,
        startedAt: T0,
      },
      vocabulary: {
        words: {
          k1: {
            word: "apple",
            literal: "maçã",
            savedAt: T0,
            lastSeenAt: T0,
            seenCount: 0,
            box: 0,
            dueAt: Date.now() - DAY,
            sources: [],
          },
        },
        phrases: {},
      },
    };
    const resume = selectHomeResume(app, Date.now());
    expect(resume?.kind).toBe("vocabDue");
    if (resume?.kind === "vocabDue") expect(resume.count).toBe(1);
  });

  it("draft de vocabulário com cartões restantes vence o vocabDue", () => {
    const app: AppState = {
      ...emptyState(),
      vocabulary: {
        words: {
          k1: {
            word: "apple",
            literal: "maçã",
            savedAt: T0,
            lastSeenAt: T0,
            seenCount: 0,
            box: 0,
            dueAt: Date.now() - DAY,
            sources: [],
          },
        },
        phrases: {},
      },
      vocabDraft: {
        startedAt: T0,
        queue: [{ kind: "word", key: "k1" }],
        index: 0,
        sim: 0,
        nao: 0,
        requeued: [],
      },
    };
    const resume = selectHomeResume(app, Date.now());
    expect(resume?.kind).toBe("vocabDraft");
    if (resume?.kind === "vocabDraft") expect(resume.remaining).toBe(1);
  });

  it("sessão em andamento vence o plano: sem sobrescrever trabalho ativo", () => {
    const q = id("wfd", 0);
    const app: AppState = {
      ...emptyState(),
      draft: {
        kind: "due",
        label: "Fila do dia",
        queue: [q, id("wfd", 1)],
        index: 0,
        startedAt: T0,
        results: [],
      },
    };
    const resume = selectHomeResume(app, Date.now());
    expect(resume?.kind).toBe("session");
    if (resume?.kind === "session") {
      expect(resume.qid).toBe(q);
      expect(resume.remaining).toBe(2);
    }
  });
});
