import { describe, expect, it } from "vitest";

import { plusAudioFields, plusAudioFor, plusAudioText } from "@/lib/plus/plusAudio";
import type {
  AnswerShortQuestion,
  DictationQuestion,
  Question,
  ReorderQuestion,
  SstQuestion,
  SwtQuestion,
  WriteEssayQuestion,
} from "@/lib/pte/types";

const base = {
  id: "q1",
  section: "reading" as const,
  audioText: "",
  transcript: "",
  wordCount: 10,
  topic: "t",
  source: "s",
};

const mcq: Question = {
  ...base,
  taskType: "mcq_single",
  prompt: "Escolha a melhor opção.",
  text: "The passage discusses renewable energy policy.",
  options: ["Option A", "Option B"],
  answer: [0],
  explanation: "porque A é sustentada pelo parágrafo 2",
} as Question;

const reorder: ReorderQuestion = {
  ...base,
  taskType: "reorder_paragraphs",
  prompt: "",
  text: "",
  items: ["Primeiro trecho.", "Segundo trecho."],
  correctOrder: [0, 1],
} as ReorderQuestion;

const essay: WriteEssayQuestion = {
  ...base,
  taskType: "write_essay",
  section: "writing",
  prompt: "Some people think that children should learn a second language early.",
  text: "Some people think that children should learn a second language early.",
  sample: "Learning a language early brings cognitive benefits.",
  essayType: "Agree/Disagree",
  vocabulary: [],
  gradingNotes: "Use examples.",
} as WriteEssayQuestion;

const wfd: DictationQuestion = {
  ...base,
  taskType: "wfd",
  section: "listening",
  prompt: "",
  text: "",
  answer: "The lecture covers climate change.",
  explanation: "Palavra-chave: covers.",
} as DictationQuestion;

const sst: SstQuestion = {
  ...base,
  taskType: "summarize_spoken_text",
  section: "listening",
  prompt: "",
  text: "Transcrição da fala.",
  sample: "The speaker discusses climate.",
  gradingNotes: "",
} as SstQuestion;

const readAloud: Question = {
  ...base,
  taskType: "read_aloud",
  section: "speaking",
  prompt: "",
  text: "A passage to read aloud.",
  gradingNotes: "",
} as Question;

describe("plusAudioFor — matriz campo × task type", () => {
  it("nunca oferta áudio para campo de áudio nativo (transcrição)", () => {
    // transcrição é gabarito: campo proibido em qualquer tipo
    expect(plusAudioFor(sst, "text")).toBe(false);
    expect(plusAudioFor(wfd, "answer")).toBe(false);
    expect(plusAudioFor(readAloud, "text")).toBe(false);
  });

  it("não duplica áudio nativo: campo nativo → false, campo vizinho → true", () => {
    expect(plusAudioFor(wfd, "explanation", wfd.explanation)).toBe(true);
    expect(plusAudioFor(sst, "sample", sst.sample)).toBe(true);
  });

  it("reading: passage, opções e itens têm áudio do pack", () => {
    expect(plusAudioFor(mcq, "text", mcq.text)).toBe(true);
    expect(plusAudioFor(mcq, "options", "a. b")).toBe(true);
    expect(plusAudioFor(reorder, "items", "trechos")).toBe(true);
  });

  it("writing: prompt e sample têm áudio do pack", () => {
    expect(plusAudioFor(essay, "prompt", essay.prompt)).toBe(true);
    expect(plusAudioFor(essay, "sample", essay.sample)).toBe(true);
  });

  it("campo fora da matriz do tipo → false", () => {
    expect(plusAudioFor(mcq, "sample")).toBe(false);
    expect(plusAudioFor(reorder, "options")).toBe(false);
    expect(plusAudioFor(readAloud, "sample")).toBe(false);
  });

  it("texto vazio → false (nada para falar)", () => {
    expect(plusAudioFor(mcq, "text", "  ")).toBe(false);
    expect(plusAudioFor(essay, "prompt", "")).toBe(false);
  });
});

describe("plusAudioFields / plusAudioText", () => {
  it("plusAudioFields exclui nativos e mantém ordem estável", () => {
    expect(plusAudioFields(mcq)).toEqual(["text", "options", "explanation"]);
    expect(plusAudioFields(readAloud)).toEqual([]);
    expect(plusAudioFields(wfd)).toEqual(["explanation"]);
  });

  it("plusAudioText extrai o texto correto por campo", () => {
    expect(plusAudioText(mcq, "options")).toBe("Option A. Option B");
    expect(plusAudioText(reorder, "items")).toBe("Primeiro trecho. Segundo trecho.");
    expect(plusAudioText(essay, "prompt")).toBe(essay.prompt);
    expect(plusAudioText(mcq, "text")).toBe(mcq.text);
  });
});
