import { Roadmap, Userdetails } from "../schema";
import { ContextTrace, ToolResult } from "../tools/types";

export interface AgentState {
  user_profile?: Userdetails;
  roadmap?: Roadmap;
  tool_results: Array<ToolResult>;
  context_trace: Array<ContextTrace>;
  session_history: Array<{ role: "user" | "assistant"; content: string; estimated_tokens?: number }>;
  current_query: string;
  system_prompt?: string;
}
