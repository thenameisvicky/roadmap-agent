import { describe, it, expect } from "vitest";
import { AgentRuntime } from "../runtime/run";
import { Userdetails } from "../schema";

describe("Agent Runtime Loop & ReAct Execution", () => {
  it("should successfully run the full ReAct loop offline using the mock model manager", async () => {
    const user: Userdetails = {
      user_id: "usr_8842",
      name: "Priya Sharma",
      goal_track: "data_science",
      active_roadmap_id: "rdmp_9f2a",
      roadmap_slug: "priya-ds-2026",
      graduation_year: 2027,
    };

    const sessionHistory = [
      { role: "user" as const, content: "Help me build a data science roadmap.", estimated_tokens: 30 },
      { role: "assistant" as const, content: "I'll use your profile and create a six-month plan.", estimated_tokens: 40 },
      { role: "user" as const, content: "What is transfer learning?", estimated_tokens: 25 },
      { role: "assistant" as const, content: "Transfer learning is a machine learning technique where a model developed for one task is reused... (Long off-topic tutorial text)", estimated_tokens: 480 },
      { role: "user" as const, content: "Show me month 3 topics.", estimated_tokens: 35 },
      { role: "assistant" as const, content: "Month 3 covers regression, classification, and model evaluation.", estimated_tokens: 90 }
    ];

    const runtime = new AgentRuntime(
      8,
      3500,
      user,
      "Add MLOps to month 4 of my data science roadmap and save it.",
      sessionHistory
    );

    const report = await runtime.run();
    expect(report.success).toBe(true);

    const state = runtime.getState();
    expect(state.roadmap).toBeDefined();
    expect(state.roadmap?.id).toBe("rdmp_9f2a");

    const month4 = state.roadmap?.months.find(m => m.month === 4);
    expect(month4).toBeDefined();
    expect(month4?.activities).toContain("MLOps");
    expect(month4?.title).toBe("Model tuning & ensembles");
  });
});
