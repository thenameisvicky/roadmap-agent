import { Userdetails } from "../schema";

export interface ToolCallStrategyState {
  user_profile: Userdetails;
  system_prompt: string;
}

export interface ToolResult {
  type: "tool" | "finish";
  tool: string;
  args?: Record<string, any>;
  result?: any;
}

export interface ContextDecision {
  reason: string;
  block: string;
}

export interface ContextTrace {
  step_index: number;
  tokens_used: number;
  token_budget: number;
  context_included: string[];
  context_evicted: string[];
  context_decisions: ContextDecision[];
}
