import { describe, expect, it } from "vitest";

import { classifyGatewayError } from "@/server/gateway";

function withStatus(statusCode: number, message = "erro"): unknown {
  return Object.assign(new Error(message), { statusCode });
}

describe("classifyGatewayError", () => {
  it("402 → credits (créditos esgotados)", () => {
    const r = classifyGatewayError(withStatus(402, "sem créditos"));
    expect(r.code).toBe("credits");
  });

  it("429 e 5xx → rate (com retry único no chamador)", () => {
    expect(classifyGatewayError(withStatus(429)).code).toBe("rate");
    expect(classifyGatewayError(withStatus(503)).code).toBe("rate");
  });

  it("400 e 403 → invalid (terminal, sem retry)", () => {
    expect(classifyGatewayError(withStatus(400)).code).toBe("invalid");
    expect(classifyGatewayError(withStatus(403)).code).toBe("invalid");
  });

  it("falha de rede → network", () => {
    expect(classifyGatewayError(new TypeError("fetch failed")).code).toBe("network");
  });

  it("NoObjectGeneratedError → invalid", async () => {
    const { NoObjectGeneratedError } = await import("ai");
    const error = new NoObjectGeneratedError({
      message: "no object",
      text: "{}",
      response: {} as never,
      usage: undefined,
      finishReason: "stop",
    } as never);
    expect(classifyGatewayError(error).code).toBe("invalid");
  });

  it("erro desconhecido → invalid", () => {
    expect(classifyGatewayError(new Error("boom")).code).toBe("invalid");
  });
});
