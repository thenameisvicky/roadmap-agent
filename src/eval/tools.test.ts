import { describe, it, expect } from "vitest";
import { getUserProfile, getRoadmap, searchKnowledgeBase, updateRoadmapMonth } from "../tools";
import { AgentState } from "../runtime/types";

describe("Tools Execution & Guardrails", () => {
  it("should retrieve the correct user profile", async () => {
    const profile = await getUserProfile({});
    expect(profile.user_id).toBe("usr_8842");
    expect(profile.name).toBe("Priya Sharma");
    expect(profile.goal_track).toBe("data_science");
  });

  it("should retrieve the correct roadmap", async () => {
    const roadmap = await getRoadmap({ roadmap_id: "rdmp_9f2a" });
    expect(roadmap.id).toBe("rdmp_9f2a");
    expect(roadmap.slug).toBe("priya-ds-2026");
    expect(roadmap.months.length).toBe(6);
  });

  it("should throw error for non-existent roadmap", async () => {
    await expect(getRoadmap({ roadmap_id: "invalid_id" })).rejects.toThrow();
  });

  it("should find relevant chunks in knowledge base search", async () => {
    const results = await searchKnowledgeBase({ query: "MLOps month 4" });
    expect(results.chunks.length).toBeGreaterThan(0);
    expect(results.chunks[0].id).toBe("mlops_month4");
    expect(results.chunks[0].text).toContain("MLflow");
  });

  it("should enforce the guardrail and fail updateRoadmapMonth when confirmed=false", async () => {
    const dummyState: AgentState = {
      tool_results: [],
      context_trace: [],
      user_profile: undefined,
      roadmap: undefined,
      session_history: [],
      current_query: "Add MLOps",
    };

    const res = await updateRoadmapMonth({
      roadmap_id: "rdmp_9f2a",
      month: 4,
      title: "Model tuning",
      activities: ["MLOps"],
      confirmed: false,
    }, dummyState);

    expect(res.success).toBe(false);
    expect(res.error).toContain("Guardrail block");
    expect(dummyState.roadmap).toBeUndefined(); // Verify in-memory state was not mutated
  });

  it("should succeed and update the roadmap state when confirmed=true", async () => {
    const dummyState: AgentState = {
      tool_results: [],
      context_trace: [],
      user_profile: undefined,
      roadmap: undefined,
      session_history: [],
      current_query: "Add MLOps",
    };

    const res = await updateRoadmapMonth({
      roadmap_id: "rdmp_9f2a",
      month: 4,
      title: "Model tuning",
      activities: ["MLOps"],
      confirmed: true,
    }, dummyState);

    expect(res.success).toBe(true);
    expect(dummyState.roadmap).toBeDefined();
    expect(dummyState.roadmap?.months.find(m => m.month === 4)?.activities).toContain("MLOps");
    expect(dummyState.roadmap?.revision_history.length).toBeGreaterThan(2); // Initial (2) + New
  });
});
