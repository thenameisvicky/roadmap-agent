"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const contextmanager_1 = require("../contextmanager");
(0, vitest_1.describe)("ContextManager Compaction & Eviction", () => {
    const contextManager = new contextmanager_1.ContextManager();
    (0, vitest_1.it)("should compact transfer learning session history items", () => {
        const state = {
            user_profile: undefined,
            roadmap: undefined,
            tool_results: [],
            context_trace: [],
            session_history: [
                { role: "user", content: "Help me." },
                { role: "assistant", content: "Transfer learning is a machine learning technique... (extremely long explanation about transfer learning)." }
            ],
            current_query: "Add MLOps to month 4.",
        };
        // Budget of 1000 is plenty, so no eviction, only compaction
        const context = contextManager.build(state, 1000, 0);
        // The compacted list should show the change
        const hasCompactedDecision = context.trace.context_decisions.some(d => d.reason.includes("transfer learning"));
        (0, vitest_1.expect)(hasCompactedDecision).toBe(true);
        const assistantMsg = context.messages.find(m => m.role === "assistant");
        (0, vitest_1.expect)(assistantMsg?.content).toBe("Previous discussion about transfer learning.");
    });
    (0, vitest_1.it)("should compact roadmap loaded in tool results", () => {
        const state = {
            user_profile: undefined,
            roadmap: undefined,
            tool_results: [
                {
                    type: "tool",
                    tool: "get_roadmap",
                    args: { roadmap_id: "rdmp_9f2a" },
                    result: {
                        id: "rdmp_9f2a",
                        slug: "priya-ds-2026",
                        title: "6-month Data Science Path",
                        months: [
                            { month: 1, title: "Python basics", activities: ["pandas"] }
                        ],
                        revision_history: []
                    }
                }
            ],
            context_trace: [],
            session_history: [],
            current_query: "Update roadmap.",
        };
        const context = contextManager.build(state, 1000, 0);
        const decision = context.trace.context_decisions.find(d => d.block.includes("get_roadmap"));
        (0, vitest_1.expect)(decision).toBeDefined();
        (0, vitest_1.expect)(decision?.reason).toContain("After get_roadmap, full roadmap JSON should not remain at full size");
        const userMsg = context.messages.find(m => m.role === "user");
        (0, vitest_1.expect)(userMsg?.content).toContain("Roadmap ID: rdmp_9f2a");
    });
    (0, vitest_1.it)("should evict oldest low-priority session history when budget is tight", () => {
        const state = {
            user_profile: undefined,
            roadmap: undefined,
            tool_results: [],
            context_trace: [],
            session_history: [
                { role: "user", content: "First old message", estimated_tokens: 100 },
                { role: "assistant", content: "Second old message", estimated_tokens: 100 },
                { role: "user", content: "Third message", estimated_tokens: 100 },
            ],
            current_query: "Current request", // estimated ~ 4 tokens
        };
        // If max_tokens is very low (e.g. 180 tokens), it can only fit system (~120) + query (~4) + newest history (~100)
        // The system prompt is ~120 tokens, current query is ~4 tokens, tool results = 0.
        // Total is ~124 tokens.
        // Remaining budget: 180 - 124 = 56 tokens.
        // So the manager must evict history. Only the newest surviving item(s) that fit will remain.
        const context = contextManager.build(state, 250, 0);
        (0, vitest_1.expect)(context.trace.context_evicted.length).toBeGreaterThan(0);
        // Oldest message "First old message" must be evicted first
        const isOldestEvicted = context.trace.context_evicted.some(ev => ev.includes("First old message"));
        (0, vitest_1.expect)(isOldestEvicted).toBe(true);
    });
});
//# sourceMappingURL=context_manager.test.js.map