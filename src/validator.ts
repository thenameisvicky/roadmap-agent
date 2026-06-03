import { z } from "zod";

export const GetUserProfileSchema = z.object({}).strict();

export const GetRoadmapSchema = z.object({
  roadmap_id: z.string(),
}).strict();

export const SearchKbSchema = z.object({
  query: z.string(),
}).strict();

export const UpdateRoadmapMonthSchema = z.object({
  roadmap_id: z.string(),
  month: z.number().int().min(1).max(12),
  title: z.string(),
  activities: z.array(z.string()),
  confirmed: z.boolean(),
}).strict();

export const FinishSchema = z.object({
  message: z.string(),
}).strict();

export const LlmResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool"),
    tool: z.enum(["get_user_profile", "get_roadmap", "search_kb", "update_roadmap_month"]),
    args: z.record(z.string(), z.any()),
  }).strict(),
  z.object({
    type: z.literal("finish"),
    tool: z.literal("finish"),
    args: z.object({
      message: z.string(),
    }).strict(),
  }).strict(),
]);

export const SessionHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  estimated_tokens: z.number().optional(),
});

export const HttpRequestSchema = z.object({
  user_message: z.string(),
  user_id: z.string().optional(),
  token_budget_per_model_call: z.number().int().positive().default(3500),
  max_steps: z.number().int().positive().default(8),
  session_history: z.array(SessionHistoryItemSchema).default([]),
});

export function validateHttpRequest(data: unknown) {
  return HttpRequestSchema.safeParse(data);
}

export function validateLlmResponse(data: unknown) {
  const result = LlmResponseSchema.safeParse(data);
  if (!result.success) {
    return result;
  }

  const { tool, args } = result.data;
  let argResult;
  switch (tool) {
    case "get_user_profile":
      argResult = GetUserProfileSchema.safeParse(args);
      break;
    case "get_roadmap":
      argResult = GetRoadmapSchema.safeParse(args);
      break;
    case "search_kb":
      argResult = SearchKbSchema.safeParse(args);
      break;
    case "update_roadmap_month":
      argResult = UpdateRoadmapMonthSchema.safeParse(args);
      break;
    case "finish":
      argResult = FinishSchema.safeParse(args);
      break;
    default:
      return { success: false as const, error: new z.ZodError([{
        code: "custom",
        path: ["tool"],
        message: `Unknown tool name: ${tool}`,
      }]) };
  }

  if (!argResult.success) {
    return { success: false as const, error: argResult.error };
  }

  return { success: true as const, data: result.data };
}

export const ContextDecisionSchema = z.object({
  reason: z.string(),
  block: z.string(),
});

export const ContextTraceSchema = z.object({
  step_index: z.number().int().nonnegative(),
  tokens_used: z.number().int().nonnegative(),
  token_budget: z.number().int().positive(),
  context_included: z.array(z.string()),
  context_evicted: z.array(z.string()),
  context_decisions: z.array(ContextDecisionSchema),
});

export const StepActionSchema = z.object({
  type: z.enum(["tool_call", "finish", "guardrail_block", "error"]),
  tool: z.string(),
  arguments: z.record(z.string(), z.any()),
  result_summary: z.string(),
});

export const StepReportSchema = z.object({
  step_index: z.number().int().nonnegative(),
  tokens_used: z.number().int().nonnegative(),
  token_budget: z.number().int().positive(),
  context_included: z.array(z.string()),
  context_evicted: z.array(z.string()),
  context_decisions: z.array(ContextDecisionSchema),
  action: StepActionSchema,
});

export const RunResponseSchema = z.object({
  success: z.boolean(),
  final_message: z.string(),
  roadmap_updated: z.boolean(),
  slug: z.string(),
  steps: z.array(StepReportSchema),
  context_trace: z.array(ContextTraceSchema),
  provider: z.string(),
  model: z.string(),
});

export function validateRunResponse(data: unknown) {
  return RunResponseSchema.safeParse(data);
}

