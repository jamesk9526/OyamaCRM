import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultStewardAiConfig, runStewardAiChat, runStewardAiChatStream } from "../../server/src/services/steward-ai-ollama.js";
afterEach(() => vi.unstubAllGlobals());
describe("Steward private thinking", () => {
  it("completes once when a reasoning budget produces no final answer", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify(bodies.length === 1 ? { message: { content: "", thinking: "private chain" } } : { message: { content: "The verified total is $50." }, model: "qwen3.5:9b" }), { status: 200 });
    }));
    const result = await runStewardAiChat({ ...defaultStewardAiConfig(), reasoningMode: "thinking" }, [{ role: "user", content: "Sum 20 and 30." }]);
    expect(result.content).toBe("The verified total is $50.");
    expect(bodies.map(body => body.think)).toEqual([true, false]);
    expect(JSON.stringify(bodies[1])).not.toContain("private chain");
  });
  it("keeps streamed reasoning private and emits only final answer text", async () => {
    let count = 0; const deltas: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => {
      count++;
      return new Response(count === 1 ? JSON.stringify({ message: { thinking: "private chain", content: "" }, done: true }) + "\n" : JSON.stringify({ message: { content: "Verified answer." } }), { status: 200 });
    }));
    const result = await runStewardAiChatStream({ ...defaultStewardAiConfig(), reasoningMode: "thinking" }, [{ role: "user", content: "Answer" }], { onDelta: delta => deltas.push(delta) });
    expect(result.content).toBe("Verified answer.");
    expect(deltas.join("")).toBe("Verified answer.");
    expect(count).toBe(2);
  });
});
