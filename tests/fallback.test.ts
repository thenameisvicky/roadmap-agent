import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ModelManager } from "../src/llm";
import { Context } from "../src/contextmanager";

describe("LLM Fallback & Retry Logic Tests", () => {
  let modelManager: ModelManager;

  beforeEach(() => {
    process.env.LLM_API_KEY = "dummy-key";
    modelManager = new ModelManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should retry exactly once on malformed JSON, and return deterministic fallback on consecutive failure", async () => {
    const mockContext: Context = {
      messages: [
        { role: "system", content: "You are an agent." },
        { role: "user", content: "Hello" }
      ],
      trace: {
        step_index: 0,
        tokens_used: 100,
        token_budget: 3500,
        context_included: [],
        context_evicted: [],
        context_decisions: []
      }
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "This is not JSON {" } }]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await modelManager.call_llm(mockContext);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const systemPrompt = secondCallBody.messages.find((m: any) => m.role === "system").content;
    expect(systemPrompt).toContain("RETRY WARNING");

    expect(result).toEqual({
      type: "finish",
      tool: "finish",
      args: {
        message: "Unable to process the request due to LLM connectivity issues."
      }
    });
  });

  it("should succeed on the second attempt after a first failure", async () => {
    const mockContext: Context = {
      messages: [
        { role: "system", content: "You are an agent." },
        { role: "user", content: "Hello" }
      ],
      trace: {
        step_index: 0,
        tokens_used: 100,
        token_budget: 3500,
        context_included: [],
        context_evicted: [],
        context_decisions: []
      }
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "invalid json" } }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                type: "finish",
                tool: "finish",
                args: { message: "Success on second attempt!" }
              })
            }
          }]
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await modelManager.call_llm(mockContext);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.type).toBe("finish");
    expect(result.args?.message).toBe("Success on second attempt!");
  });
});
