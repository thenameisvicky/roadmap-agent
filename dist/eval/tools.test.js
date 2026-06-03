"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const tools_1 = require("../tools");
(0, vitest_1.describe)("Tools Execution & Guardrails", () => {
    (0, vitest_1.it)("should retrieve the correct user profile", async () => {
        const profile = await (0, tools_1.getUserProfile)({});
        (0, vitest_1.expect)(profile.user_id).toBe("usr_8842");
        (0, vitest_1.expect)(profile.name).toBe("Priya Sharma");
        (0, vitest_1.expect)(profile.goal_track).toBe("data_science");
    });
    (0, vitest_1.it)("should retrieve the correct roadmap", async () => {
        const roadmap = await (0, tools_1.getRoadmap)({ roadmap_id: "rdmp_9f2a" });
        (0, vitest_1.expect)(roadmap.id).toBe("rdmp_9f2a");
        (0, vitest_1.expect)(roadmap.slug).toBe("priya-ds-2026");
        (0, vitest_1.expect)(roadmap.months.length).toBe(6);
    });
    (0, vitest_1.it)("should throw error for non-existent roadmap", async () => {
        await (0, vitest_1.expect)((0, tools_1.getRoadmap)({ roadmap_id: "invalid_id" })).rejects.toThrow();
    });
    (0, vitest_1.it)("should find relevant chunks in knowledge base search", async () => {
        const results = await (0, tools_1.searchKnowledgeBase)({ query: "MLOps month 4" });
        (0, vitest_1.expect)(results.chunks.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(results.chunks[0].id).toBe("mlops_month4");
        (0, vitest_1.expect)(results.chunks[0].text).toContain("MLflow");
    });
    (0, vitest_1.it)("should enforce the guardrail and fail updateRoadmapMonth when confirmed=false", async () => {
        const dummyState = {
            tool_results: [],
            context_trace: [],
            user_profile: undefined,
            roadmap: undefined,
            session_history: [],
            current_query: "Add MLOps",
        };
        const res = await (0, tools_1.updateRoadmapMonth)({
            roadmap_id: "rdmp_9f2a",
            month: 4,
            title: "Model tuning",
            activities: ["MLOps"],
            confirmed: false,
        }, dummyState);
        (0, vitest_1.expect)(res.success).toBe(false);
        (0, vitest_1.expect)(res.error).toContain("Guardrail block");
        (0, vitest_1.expect)(dummyState.roadmap).toBeUndefined(); // Verify in-memory state was not mutated
    });
    (0, vitest_1.it)("should succeed and update the roadmap state when confirmed=true", async () => {
        const dummyState = {
            tool_results: [],
            context_trace: [],
            user_profile: undefined,
            roadmap: undefined,
            session_history: [],
            current_query: "Add MLOps",
        };
        const res = await (0, tools_1.updateRoadmapMonth)({
            roadmap_id: "rdmp_9f2a",
            month: 4,
            title: "Model tuning",
            activities: ["MLOps"],
            confirmed: true,
        }, dummyState);
        (0, vitest_1.expect)(res.success).toBe(true);
        (0, vitest_1.expect)(dummyState.roadmap).toBeDefined();
        (0, vitest_1.expect)(dummyState.roadmap?.months.find(m => m.month === 4)?.activities).toContain("MLOps");
        (0, vitest_1.expect)(dummyState.roadmap?.revision_history.length).toBeGreaterThan(2); // Initial (2) + New
    });
});
//# sourceMappingURL=tools.test.js.map