import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ModelManager } from "../src/llm";
import { Context } from "../src/contextmanager";
import { roadmapRouter } from "../src/route";
import { Request, Response } from "express";
import { AgentRuntime } from "../src/runtime/run";

describe("Timeout Handling Tests", () => {
  beforeEach(() => {
    process.env.LLM_API_KEY = "dummy-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should trigger LLM timeout, retry, and return deterministic fallback on consecutive timeout", async () => {
    process.env.LLM_TIMEOUT_MS = "50";

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

    const fetchMock = vi.fn((url, options) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({ choices: [{ message: { content: "{}" } }] })
          });
        }, 2000);

        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            const err = new Error("The operation was aborted.");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const modelManager = new ModelManager();
    const result = await modelManager.call_llm(mockContext);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      type: "finish",
      tool: "finish",
      args: {
        message: "Unable to process the request due to LLM connectivity issues."
      }
    });
  });

  it("should return overall request timeout error if the agent run exceeds REQUEST_TIMEOUT_MS", async () => {
    process.env.REQUEST_TIMEOUT_MS = "50";

    vi.spyOn(AgentRuntime.prototype, "run").mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );

    const req = {
      body: {
        user_message: "Help me update my roadmap",
        user_id: "usr_8842",
        token_budget_per_model_call: 3500,
        max_steps: 8,
        session_history: []
      }
    } as unknown as Request;

    let statusVal = 0;
    let jsonVal: any = null;

    const res = {
      status: vi.fn((code: number) => {
        statusVal = code;
        return res;
      }),
      json: vi.fn((data: any) => {
        jsonVal = data;
        return res;
      })
    } as unknown as Response;

    const routeHandler = (roadmapRouter.stack.find(
      (layer) => layer.route && layer.route.path === "/ai/roadmap-copilot/run"
    )?.route?.stack[0] as any)?.handle;

    expect(routeHandler).toBeDefined();

    await routeHandler(req, res);

    expect(statusVal).toBe(500);
    expect(jsonVal).toEqual({
      success: false,
      error: "Request timeout"
    });
  });
});
