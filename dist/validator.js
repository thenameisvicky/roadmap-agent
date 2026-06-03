"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunResponseSchema = exports.StepReportSchema = exports.StepActionSchema = exports.ContextTraceSchema = exports.ContextDecisionSchema = exports.HttpRequestSchema = exports.SessionHistoryItemSchema = exports.LlmResponseSchema = exports.FinishSchema = exports.UpdateRoadmapMonthSchema = exports.SearchKbSchema = exports.GetRoadmapSchema = exports.GetUserProfileSchema = void 0;
exports.validateHttpRequest = validateHttpRequest;
exports.validateLlmResponse = validateLlmResponse;
exports.validateRunResponse = validateRunResponse;
const zod_1 = require("zod");
exports.GetUserProfileSchema = zod_1.z.object({}).strict();
exports.GetRoadmapSchema = zod_1.z.object({
    roadmap_id: zod_1.z.string(),
}).strict();
exports.SearchKbSchema = zod_1.z.object({
    query: zod_1.z.string(),
}).strict();
exports.UpdateRoadmapMonthSchema = zod_1.z.object({
    roadmap_id: zod_1.z.string(),
    month: zod_1.z.number().int().min(1).max(12),
    title: zod_1.z.string(),
    activities: zod_1.z.array(zod_1.z.string()),
    confirmed: zod_1.z.boolean(),
}).strict();
exports.FinishSchema = zod_1.z.object({
    message: zod_1.z.string(),
}).strict();
exports.LlmResponseSchema = zod_1.z.discriminatedUnion("type", [
    zod_1.z.object({
        type: zod_1.z.literal("tool"),
        tool: zod_1.z.enum(["get_user_profile", "get_roadmap", "search_kb", "update_roadmap_month"]),
        args: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
    }).strict(),
    zod_1.z.object({
        type: zod_1.z.literal("finish"),
        tool: zod_1.z.literal("finish"),
        args: zod_1.z.object({
            message: zod_1.z.string(),
        }).strict(),
    }).strict(),
]);
exports.SessionHistoryItemSchema = zod_1.z.object({
    role: zod_1.z.enum(["user", "assistant"]),
    content: zod_1.z.string(),
    estimated_tokens: zod_1.z.number().optional(),
});
exports.HttpRequestSchema = zod_1.z.object({
    user_message: zod_1.z.string(),
    user_id: zod_1.z.string().optional(),
    token_budget_per_model_call: zod_1.z.number().int().positive().default(3500),
    max_steps: zod_1.z.number().int().positive().default(8),
    session_history: zod_1.z.array(exports.SessionHistoryItemSchema).default([]),
});
function validateHttpRequest(data) {
    return exports.HttpRequestSchema.safeParse(data);
}
function validateLlmResponse(data) {
    const result = exports.LlmResponseSchema.safeParse(data);
    if (!result.success) {
        return result;
    }
    const { tool, args } = result.data;
    let argResult;
    switch (tool) {
        case "get_user_profile":
            argResult = exports.GetUserProfileSchema.safeParse(args);
            break;
        case "get_roadmap":
            argResult = exports.GetRoadmapSchema.safeParse(args);
            break;
        case "search_kb":
            argResult = exports.SearchKbSchema.safeParse(args);
            break;
        case "update_roadmap_month":
            argResult = exports.UpdateRoadmapMonthSchema.safeParse(args);
            break;
        case "finish":
            argResult = exports.FinishSchema.safeParse(args);
            break;
        default:
            return { success: false, error: new zod_1.z.ZodError([{
                        code: "custom",
                        path: ["tool"],
                        message: `Unknown tool name: ${tool}`,
                    }]) };
    }
    if (!argResult.success) {
        return { success: false, error: argResult.error };
    }
    return { success: true, data: result.data };
}
exports.ContextDecisionSchema = zod_1.z.object({
    reason: zod_1.z.string(),
    block: zod_1.z.string(),
});
exports.ContextTraceSchema = zod_1.z.object({
    step_index: zod_1.z.number().int().nonnegative(),
    tokens_used: zod_1.z.number().int().nonnegative(),
    token_budget: zod_1.z.number().int().positive(),
    context_included: zod_1.z.array(zod_1.z.string()),
    context_evicted: zod_1.z.array(zod_1.z.string()),
    context_decisions: zod_1.z.array(exports.ContextDecisionSchema),
});
exports.StepActionSchema = zod_1.z.object({
    type: zod_1.z.enum(["tool_call", "finish", "guardrail_block", "error"]),
    tool: zod_1.z.string(),
    arguments: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
    result_summary: zod_1.z.string(),
});
exports.StepReportSchema = zod_1.z.object({
    step_index: zod_1.z.number().int().nonnegative(),
    tokens_used: zod_1.z.number().int().nonnegative(),
    token_budget: zod_1.z.number().int().positive(),
    context_included: zod_1.z.array(zod_1.z.string()),
    context_evicted: zod_1.z.array(zod_1.z.string()),
    context_decisions: zod_1.z.array(exports.ContextDecisionSchema),
    action: exports.StepActionSchema,
});
exports.RunResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    final_message: zod_1.z.string(),
    roadmap_updated: zod_1.z.boolean(),
    slug: zod_1.z.string(),
    steps: zod_1.z.array(exports.StepReportSchema),
    context_trace: zod_1.z.array(exports.ContextTraceSchema),
    provider: zod_1.z.string(),
    model: zod_1.z.string(),
});
function validateRunResponse(data) {
    return exports.RunResponseSchema.safeParse(data);
}
//# sourceMappingURL=validator.js.map