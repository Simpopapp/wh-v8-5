import { describe, expect, it } from "vitest";

import { emptyState, type AppState, type Attempt, type QuestionSnapshot } from "@/lib/storage";
import { allMeta, firstIdOfType } from "@/lib/pte/manifest";
import { TYPE_META } from "@/lib/pte/types";
import { estimateSkill } from "@/lib/pte/estimate";
import {
  estimateBySkill,
  overallEstimate,
  readinessBySection,
  readinessLevel,
  weakestSection,
  type SectionReadiness,
} from "@/lib/pte/readiness";

const DAY = 86_400_000;
const TOTALS = { speaking: 100, writing: 50, reading: 50, listening: 100 };
// Fixtures com instante fixo — determinístico e independente do relógio.
const NOW = Date.UTC(2026, 9, 10, 12, 0, 0); // 2026-10-10T12:00Z

const SPEAKING_QIDS = allMeta
  .filter((m) => TYPE_META[m.taskType].section === "speaking")
  .map((m) => m.id);
const AI_SOURCES = new Set(["ai-generated-prediction", "pteracai-seed"]);
const NORMAL_SPEAKING_QIDS = allMeta
  .filter((m) => TYPE_META[m.taskType].section === "speaking" && !AI_SOURCES.has(m.source))
  .map((m) => m.id);
const AI_META = allMeta.find(
  (m) => m.source === "ai-generated-prediction" && TYPE_META[m.taskType].section === "speaking",
)!;

function attempt(
  partial: Partial<Attempt> & { qid: string; taskType: Attempt["taskType"] },
): Attempt {
  return {
    ts: NOW,
    mode: "manual",
    contentScore: null,
    score: null,
    wpm: null,
    durationMs: 0,
    ...partial,
  };
}

function snapshot(attempts: number): QuestionSnapshot {
  return {
    attempts,
    bestScore: null,
    bestWpm: null,
    lastScore: null,
    lastAttemptAt: 0,
    strongAttempts: 0,
    dueStrongAttempts: 0,
    prevStrong: false,
    lastAttemptDue: false,
    box: 0,
    dueAt: 0,
  };
}

function app(attempts: Attempt[], questions: Record<string, QuestionSnapshot> = {}): AppState {
  return { ...emptyState(), attempts, questions };
}

function bySection(rows: SectionReadiness[]): Map<string, SectionReadiness> {
  return new Map(rows.map((r) => [r.section, r]));
}

function bySkill(rows: ReturnType<typeof estimateBySkill>): Map<string, (typeof rows)[number]> {
  return new Map(rows.map((r) => [r.skill, r]));
}

describe("readinessLevel", () => {
  it("rotula por faixa: <40, <65, <85, ≥85", () => {
    expect(readinessLevel(0)).toBe("Iniciando");
    expect(readinessLevel(39)).toBe("Iniciando");
    expect(readinessLevel(40)).toBe("Em progresso");
    expect(readinessLevel(64)).toBe("Em progresso");
    expect(readinessLevel(65)).toBe("Quase pronto");
    expect(readinessLevel(84)).toBe("Quase pronto");
    expect(readinessLevel(85)).toBe("Pronto");
    expect(readinessLevel(100)).toBe("Pronto");
  });
});

describe("readinessBySection — núcleo (desempenho recente ponderado)", () => {
  it("app vazio: zeros, nulls, confiança baixa e sem dados", () => {
    const rows = readinessBySection(app([]), NOW, TOTALS);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.coverage).toBe(0);
      expect(r.recentScore).toBeNull();
      expect(r.recentPct).toBeNull();
      expect(r.trend).toBeNull();
      expect(r.score).toBe(0);
      expect(r.level).toBe("Iniciando");
      expect(r.confidence).toBe("low");
      expect(r.hasData).toBe(false);
      expect(r.attempted).toBe(0);
      expect(r.secondaryPenalty).toBe(0);
    }
    expect(weakestSection(rows)).toBeNull();
  });

  it("média ponderada pela recência: tentativa de 7 dias vale metade", () => {
    const rows = readinessBySection(
      app([
        attempt({ qid: SPEAKING_QIDS[0]!, taskType: "read_aloud", ts: NOW, score: 60 }),
        attempt({ qid: SPEAKING_QIDS[1]!, taskType: "read_aloud", ts: NOW - 7 * DAY, score: 100 }),
      ]),
      NOW,
      TOTALS,
    );
    const sp = bySection(rows).get("speaking")!;
    expect(sp.recentPct).toBe(73); // (60·1 + 100·0,5)/1,5 = 73,3
    expect(sp.recentScore).toBe(80); // média simples dos últimos 7d
    expect(sp.trend).toBeNull(); // janela anterior vazia
    expect(sp.hasData).toBe(true);
  });

  it("tentativas em itens de IA/seed pesam 0,7 (D4)", () => {
    const rows = readinessBySection(
      app([
        attempt({ qid: SPEAKING_QIDS[0]!, taskType: "read_aloud", ts: NOW, score: 60 }),
        attempt({ qid: AI_META.id, taskType: AI_META.taskType, ts: NOW, score: 100 }),
      ]),
      NOW,
      TOTALS,
    );
    const sp = bySection(rows).get("speaking")!;
    expect(sp.recentPct).toBe(76); // (60·1 + 100·0,7)/1,7 = 76,5
  });
});

describe("readinessBySection — tendência e confiança", () => {
  it("tendência (7d vs. 7d anteriores) ajusta o índice, com teto de ±5", () => {
    const rows = readinessBySection(
      app([
        attempt({ qid: SPEAKING_QIDS[0]!, taskType: "read_aloud", ts: NOW - 1 * DAY, score: 80 }),
        attempt({ qid: SPEAKING_QIDS[1]!, taskType: "read_aloud", ts: NOW - 2 * DAY, score: 60 }),
        attempt({ qid: SPEAKING_QIDS[2]!, taskType: "read_aloud", ts: NOW - 10 * DAY, score: 40 }),
      ]),
      NOW,
      TOTALS,
    );
    const sp = bySection(rows).get("speaking")!;
    expect(sp.recentScore).toBe(70);
    expect(sp.trend).toBe(30); // 70 vs. 40 → +30
    expect(sp.recentPct).toBe(65); // ponderada pela recência
    // 65 + 5 (tendência no teto) − 10 (cobertura 0 + variedade 0) = 60
    expect(sp.score).toBe(60);
    expect(sp.level).toBe("Em progresso");
  });

  it("n do snapshot define a confiança: 9 → baixa, 10 → média, 25 → alta", () => {
    const mk = (n: number, each = 1) => {
      const questions: Record<string, QuestionSnapshot> = {};
      let i = 0;
      for (const m of allMeta) {
        if (TYPE_META[m.taskType].section !== "speaking" || i >= n) continue;
        questions[m.id] = snapshot(each);
        i++;
      }
      return questions;
    };
    const rows9 = readinessBySection(app([], mk(9)), NOW, TOTALS);
    const rows10 = readinessBySection(app([], mk(10)), NOW, TOTALS);
    const rows25 = readinessBySection(app([], mk(5, 5)), NOW, TOTALS);
    expect(bySection(rows9).get("speaking")!.confidence).toBe("low");
    expect(bySection(rows10).get("speaking")!.confidence).toBe("medium");
    expect(bySection(rows25).get("speaking")!.confidence).toBe("high");
  });
});

describe("readinessBySection — cobertura/variedade são secundárias", () => {
  it("cobertura e variedade boas não reduzem o índice", () => {
    // 20 questões distintas de speaking cobrindo os 4 tipos prontos → cobertura 20%, variedade 100%.
    const questions: Record<string, QuestionSnapshot> = {};
    const perType: Record<string, number> = {};
    for (const m of allMeta) {
      if (TYPE_META[m.taskType].section !== "speaking") continue;
      if ((perType[m.taskType] ?? 0) >= 5) continue;
      perType[m.taskType] = (perType[m.taskType] ?? 0) + 1;
      questions[m.id] = snapshot(1);
      if (Object.keys(questions).length >= 20) break;
    }
    const rows = readinessBySection(
      app(
        [attempt({ qid: SPEAKING_QIDS[0]!, taskType: "read_aloud", ts: NOW, score: 80 })],
        questions,
      ),
      NOW,
      TOTALS,
    );
    const sp = bySection(rows).get("speaking")!;
    expect(sp.secondaryPenalty).toBe(0);
    expect(sp.coverage).toBe(20);
    expect(sp.score).toBe(80);
    expect(sp.level).toBe("Quase pronto");
  });

  it("redução secundária tem teto de 10 pontos (cobertura e variedade zeradas)", () => {
    // Tentativa com qid fora do banco: cobertura 0 e variedade 0, duas reduções somam 10.
    const rows = readinessBySection(
      app([attempt({ qid: "fora-do-banco", taskType: "read_aloud", ts: NOW, score: 60 })]),
      NOW,
      TOTALS,
    );
    const sp = bySection(rows).get("speaking")!;
    expect(sp.hasData).toBe(true);
    expect(sp.recentPct).toBe(60);
    expect(sp.secondaryPenalty).toBe(10);
    expect(sp.score).toBe(50);
  });

  it("cobertura baixa com variedade no limite não adiciona variedade", () => {
    // 2 questões de tipos distintos tentadas (via snapshot): cobertura 2% <10 (−5)
    // e variedade 2/7 ≈ 29% ≥ 25 (não reduz — speaking agora tem 7 tipos prontos).
    const qRa = allMeta.find((m) => m.taskType === "read_aloud")!.id;
    const qAsq = allMeta.find((m) => m.taskType === "answer_short")!.id;
    const rows = readinessBySection(
      app([], { [qRa]: snapshot(1), [qAsq]: snapshot(1) }),
      NOW,
      TOTALS,
    );
    const sp = bySection(rows).get("speaking")!;
    expect(sp.hasData).toBe(true);
    expect(sp.recentPct).toBeNull();
    expect(sp.secondaryPenalty).toBe(5);
    expect(sp.score).toBe(0);
    expect(sp.level).toBe("Iniciando");
  });
});

describe("readinessBySection — contagens", () => {
  it("tentativas sem score são ignoradas (hasData continua false)", () => {
    const rows = readinessBySection(
      app([attempt({ qid: SPEAKING_QIDS[0]!, taskType: "read_aloud", ts: NOW, score: null })]),
      NOW,
      TOTALS,
    );
    const sp = bySection(rows).get("speaking")!;
    expect(sp.hasData).toBe(false);
    expect(sp.score).toBe(0);
    expect(weakestSection(rows)).toBeNull();
  });

  it("tentativas de outras seções não vazam para a seção errada", () => {
    const rows = readinessBySection(
      app([attempt({ qid: SPEAKING_QIDS[0]!, taskType: "read_aloud", ts: NOW, score: 80 })]),
      NOW,
      TOTALS,
    );
    const m = bySection(rows);
    expect(m.get("speaking")!.hasData).toBe(true);
    for (const s of ["writing", "reading", "listening"] as const) {
      expect(m.get(s)!.hasData).toBe(false);
    }
  });

  it("qids repetidos contam uma vez na cobertura (snapshot)", () => {
    const qid = SPEAKING_QIDS[0]!;
    const rows = readinessBySection(
      app(
        [
          attempt({ qid, taskType: "read_aloud", ts: NOW - 1 * DAY, score: 70 }),
          attempt({ qid, taskType: "read_aloud", ts: NOW - 2 * DAY, score: 90 }),
        ],
        { [qid]: snapshot(2) },
      ),
      NOW,
      TOTALS,
    );
    const sp = bySection(rows).get("speaking")!;
    expect(sp.attempted).toBe(1);
    expect(sp.n).toBe(2);
    expect(sp.recentScore).toBe(80); // (70+90)/2 — as duas estão nos últimos 7 dias
  });
});

describe("weakestSection", () => {
  it("aponta a seção de menor índice entre as com dados", () => {
    const rows = readinessBySection(
      app([
        attempt({ qid: SPEAKING_QIDS[0]!, taskType: "read_aloud", ts: NOW, score: 80 }),
        attempt({ qid: firstIdOfType("wfd")!, taskType: "wfd", ts: NOW, score: 60 }),
      ]),
      NOW,
      TOTALS,
    );
    expect(weakestSection(rows)).toBe("listening");
  });

  it("empate resolve pela ordem canônica das seções", () => {
    const rows = readinessBySection(
      app([
        attempt({ qid: SPEAKING_QIDS[0]!, taskType: "read_aloud", ts: NOW, score: 80 }),
        attempt({ qid: firstIdOfType("swt")!, taskType: "swt", ts: NOW, score: 80 }),
      ]),
      NOW,
      { speaking: 1, writing: 1, reading: 1, listening: 1 },
    );
    expect(weakestSection(rows)).toBe("speaking");
  });

  it("ignora seções sem dados mesmo com índice 0", () => {
    const rows = readinessBySection(
      app([attempt({ qid: SPEAKING_QIDS[0]!, taskType: "read_aloud", ts: NOW, score: 80 })]),
      NOW,
      TOTALS,
    );
    expect(weakestSection(rows)).toBe("speaking");
  });
});

describe("estimateBySkill (10–90, D3)", () => {
  it("app vazio → estimativas null e confiança baixa", () => {
    const est = estimateBySkill(app([]), NOW);
    expect(est).toHaveLength(4);
    for (const e of est) {
      expect(e.estimate).toBeNull();
      expect(e.recentPct).toBeNull();
      expect(e.confidence).toBe("low");
    }
    expect(overallEstimate(app([]), NOW)).toBeNull();
  });

  it("WFD conta para Listening e Writing; Read Aloud só para Speaking", () => {
    const wfdQid = firstIdOfType("wfd")!;
    const raQid = firstIdOfType("read_aloud")!;
    const est = estimateBySkill(
      app(
        [
          attempt({ qid: wfdQid, taskType: "wfd", ts: NOW, score: 80 }),
          attempt({ qid: raQid, taskType: "read_aloud", ts: NOW, score: 50 }),
        ],
        { [wfdQid]: snapshot(3) },
      ),
      NOW,
    );
    const m = bySkill(est);
    expect(m.get("listening")!.estimate).toBe(74); // estimateSkill(80)
    expect(m.get("writing")!.estimate).toBe(74);
    expect(m.get("speaking")!.estimate).toBe(50); // estimateSkill(50)
    expect(m.get("reading")!.estimate).toBeNull();
    expect(m.get("listening")!.n).toBe(3); // n vem do snapshot
    expect(m.get("speaking")!.n).toBe(0);
    expect(m.get("speaking")!.confidence).toBe("low");
  });

  it("overallEstimate usa todas as tentativas com score", () => {
    const est = overallEstimate(
      app([
        attempt({ qid: NORMAL_SPEAKING_QIDS[0]!, taskType: "read_aloud", ts: NOW, score: 80 }),
        attempt({ qid: NORMAL_SPEAKING_QIDS[1]!, taskType: "read_aloud", ts: NOW, score: 50 }),
      ]),
      NOW,
    );
    expect(est).toBe(estimateSkill(65)); // média simples 65 → 62
  });
});
