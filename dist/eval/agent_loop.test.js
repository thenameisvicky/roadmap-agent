"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const run_1 = require("../runtime/run");
const llm_1 = require("../llm");
(0, vitest_1.describe)("Agent Runtime Loop & ReAct Execution Scenarios", () => {
    let callLlmSpy;
    (0, vitest_1.beforeEach)(() => {
        callLlmSpy = vitest_1.vi.spyOn(llm_1.ModelManager.prototype, "call_llm");
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)("should successfully run Scenario 1: Data Science MLOps Update", async () => {
        const user = {
            user_id: "usr_8842",
            name: "Priya Sharma",
            goal_track: "data_science",
            active_roadmap_id: "rdmp_9f2a",
            roadmap_slug: "priya-ds-2026",
            graduation_year: 2027,
        };
        callLlmSpy
            .mockResolvedValueOnce({
            type: "tool",
            tool: "get_user_profile",
            args: {},
        })
            .mockResolvedValueOnce({
            type: "tool",
            tool: "get_roadmap",
            args: { roadmap_id: "rdmp_9f2a" },
        })
            .mockResolvedValueOnce({
            type: "tool",
            tool: "update_roadmap_month",
            args: {
                roadmap_id: "rdmp_9f2a",
                month: 4,
                title: "Model tuning & ensembles",
                activities: ["MLOps"],
                confirmed: false,
            },
        })
            .mockResolvedValueOnce({
            type: "tool",
            tool: "update_roadmap_month",
            args: {
                roadmap_id: "rdmp_9f2a",
                month: 4,
                title: "Model tuning & ensembles",
                activities: ["MLOps"],
                confirmed: true,
            },
        })
            .mockResolvedValueOnce({
            type: "finish",
            tool: "finish",
            args: { message: "Successfully updated month 4 of priya-ds-2026." },
        });
        const runtime = new run_1.AgentRuntime(8, 3500, user, "Add MLOps to month 4 of my data science roadmap and save it.", []);
        const report = await runtime.run();
        (0, vitest_1.expect)(report.success).toBe(true);
        const state = runtime.getState();
        (0, vitest_1.expect)(state.roadmap).toBeDefined();
        (0, vitest_1.expect)(state.roadmap?.id).toBe("rdmp_9f2a");
        const month4 = state.roadmap?.months.find((m) => m.month === 4);
        (0, vitest_1.expect)(month4).toBeDefined();
        (0, vitest_1.expect)(month4?.activities).toContain("MLOps");
    });
    (0, vitest_1.it)("should successfully run Scenario 2: AI Engineering Web/Express Update", async () => {
        const user = {
            user_id: "usr_9910",
            name: "Vicky B",
            goal_track: "ai_engineering",
            active_roadmap_id: "rdmp_aie2027",
            roadmap_slug: "vicky-aie-2027",
            graduation_year: 2027,
        };
        callLlmSpy
            .mockResolvedValueOnce({
            type: "tool",
            tool: "get_user_profile",
            args: {},
        })
            .mockResolvedValueOnce({
            type: "tool",
            tool: "get_roadmap",
            args: { roadmap_id: "rdmp_aie2027" },
        })
            .mockResolvedValueOnce({
            type: "tool",
            tool: "update_roadmap_month",
            args: {
                roadmap_id: "rdmp_aie2027",
                month: 4,
                title: "RAG & Agent Architectures",
                activities: ["Express Framework"],
                confirmed: true,
            },
        })
            .mockResolvedValueOnce({
            type: "finish",
            tool: "finish",
            args: { message: "Added Express Framework to month 4 of vicky-aie-2027." },
        });
        const runtime = new run_1.AgentRuntime(6, 3500, user, "Add Express Framework to month 4 of my AI engineering roadmap and save it.", []);
        const report = await runtime.run();
        (0, vitest_1.expect)(report.success).toBe(true);
        const state = runtime.getState();
        (0, vitest_1.expect)(state.roadmap).toBeDefined();
        (0, vitest_1.expect)(state.roadmap?.id).toBe("rdmp_aie2027");
        const month4 = state.roadmap?.months.find((m) => m.month === 4);
        (0, vitest_1.expect)(month4).toBeDefined();
        (0, vitest_1.expect)(month4?.activities).toContain("Express Framework");
    });
    (0, vitest_1.it)("should successfully run Scenario 3: Cybersecurity Search & Update", async () => {
        const user = {
            user_id: "usr_7720",
            name: "Ash",
            goal_track: "cybersecurity",
            active_roadmap_id: "rdmp_cyber2028",
            roadmap_slug: "ash-cyber-2028",
            graduation_year: 2028,
        };
        callLlmSpy
            .mockResolvedValueOnce({
            type: "tool",
            tool: "get_user_profile",
            args: {},
        })
            .mockResolvedValueOnce({
            type: "tool",
            tool: "get_roadmap",
            args: { roadmap_id: "rdmp_cyber2028" },
        })
            .mockResolvedValueOnce({
            type: "tool",
            tool: "search_kb",
            args: { query: "kali linux labs" },
        })
            .mockResolvedValueOnce({
            type: "tool",
            tool: "update_roadmap_month",
            args: {
                roadmap_id: "rdmp_cyber2028",
                month: 3,
                title: "Ethical Hacking & Penetration Testing",
                activities: ["Kali Linux Labs"],
                confirmed: true,
            },
        })
            .mockResolvedValueOnce({
            type: "finish",
            tool: "finish",
            args: { message: "Added Kali Linux Labs to month 3 of ash-cyber-2028." },
        });
        const runtime = new run_1.AgentRuntime(8, 3500, user, "Search for ethical hacking labs and add Kali Linux Labs to month 3 of my cybersecurity roadmap.", []);
        const report = await runtime.run();
        (0, vitest_1.expect)(report.success).toBe(true);
        const state = runtime.getState();
        (0, vitest_1.expect)(state.roadmap).toBeDefined();
        (0, vitest_1.expect)(state.roadmap?.id).toBe("rdmp_cyber2028");
        const month3 = state.roadmap?.months.find((m) => m.month === 3);
        (0, vitest_1.expect)(month3).toBeDefined();
        (0, vitest_1.expect)(month3?.activities).toContain("Kali Linux Labs");
    });
});
//# sourceMappingURL=agent_loop.test.js.map