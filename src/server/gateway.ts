/**
 * Server-only: acesso ao Lovable AI Gateway. NUNCA importar por código de
 * cliente — o provider e a chave vivem exclusivamente no servidor; este módulo
 * só deve entrar na árvore via import dinâmico dentro do handler de uma server
 * function (PRD projeto 11, D2/D3).
 */
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./run-id.ts";

const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev/v1";
const DEFAULT_MODEL = "openai/gpt-6-astra";
const RETRY_DELAY_MS = 800;
/** Projeto 13 (D9): deadline TOTAL da chamada (inclui o retry de rate). */
export const GATEWAY_DEADLINE_MS = 15_000;

export type AiErrorCode = "credits" | "rate" | "network" | "invalid";

export type AiCallResult<T> =
  { ok: true; data: T } | { ok: false; code: AiErrorCode; message: string };

export interface GatewayObjectInput<S> {
  instructions: string;
  messages: ModelMessage[];
  schema: S;
}

/**
 * Projeto 13 (D9): mensagens públicas SANITIZADAS — o erro bruto do provider
 * nunca vaza para o cliente; detalhes ficam no log do servidor.
 */
const GENERIC_INVALID = "A IA não pôde responder a este pedido.";
const GENERIC_UNEXPECTED = "Falha inesperada na chamada de IA.";

/** Mapeia um erro do gateway/AI SDK para o código tipado consumido pelo cliente. */
export function classifyGatewayError(error: unknown): { code: AiErrorCode; message: string } {
  const detail = String(
    error != null && typeof error === "object" && "message" in error
      ? (error as { message?: unknown }).message
      : "",
  );
  console.error("[gateway]", detail.slice(0, 400));
  if (NoObjectGeneratedError.isInstance(error)) {
    return { code: "invalid", message: "Resposta da IA fora do formato esperado." };
  }
  const candidate = error as {
    statusCode?: unknown;
    status?: unknown;
    name?: unknown;
    message?: unknown;
  };
  const status =
    typeof candidate?.statusCode === "number"
      ? candidate.statusCode
      : typeof candidate?.status === "number"
        ? candidate.status
        : undefined;
  if (typeof status === "number") {
    if (status === 402) return { code: "credits", message: "Créditos de IA esgotados." };
    if (status === 429 || status >= 500)
      return { code: "rate", message: "Limite temporário da IA atingido." };
    return { code: "invalid", message: GENERIC_INVALID };
  }
  if (
    candidate?.name === "AbortError" ||
    /abort|timeout/i.test(String(candidate?.name) + " " + String(candidate?.message ?? ""))
  ) {
    return { code: "network", message: "A IA demorou para responder." };
  }
  if (
    error instanceof TypeError ||
    /fetch|network|ECONN|ENOTFOUND/i.test(
      String(candidate?.name) + " " + String(candidate?.message),
    )
  ) {
    return { code: "network", message: "Sem comunicação com a IA." };
  }
  return { code: "invalid", message: GENERIC_UNEXPECTED };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Uma chamada ao gateway com saída estruturada (strict json_schema via
 * /v1/responses). Cria o provider por requisição, streama a chamada e consome
 * o resultado final no servidor. 429/5xx recebem exatamente um retry com
 * backoff; os demais códigos são terminais (D3/D10).
 */
export async function callGatewayObject<S extends import("zod").ZodType>(
  input: GatewayObjectInput<S>,
): Promise<AiCallResult<import("zod").infer<S>>> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return { ok: false, code: "invalid", message: "Servidor sem chave de IA configurada." };
  }

  // Deadline total (D9): a primeira tentativa e o retry de rate dividem o
  // mesmo prazo — chamada sem fim nunca fica presa no Worker.
  const deadlineAt = Date.now() + GATEWAY_DEADLINE_MS;

  const runOnce = async (): Promise<import("zod").infer<S>> => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.max(0, deadlineAt - Date.now()));
    try {
      const runIdFetch = createLovableAiGatewayRunIdFetch();
      const provider = createOpenAI({
        baseURL: GATEWAY_BASE_URL,
        apiKey,
        headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        fetch: runIdFetch.fetch,
      });
      const result = streamText({
        model: provider.responses(DEFAULT_MODEL),
        instructions: input.instructions,
        messages: input.messages,
        output: Output.object({ schema: input.schema }),
        abortSignal: ac.signal,
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      return (await result.output) as import("zod").infer<S>;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return { ok: true, data: await runOnce() };
  } catch (error) {
    const first = classifyGatewayError(error);
    if (first.code === "rate" && Date.now() < deadlineAt) {
      await delay(Math.min(RETRY_DELAY_MS, Math.max(0, deadlineAt - Date.now())));
      try {
        return { ok: true, data: await runOnce() };
      } catch (retryError) {
        return { ok: false, ...classifyGatewayError(retryError) };
      }
    }
    return { ok: false, ...first };
  }
}
