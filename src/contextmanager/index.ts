import { AgentState } from "../runtime/types";
import { ContextTrace, ContextDecision, ToolResult } from "../tools/types";

export interface Context {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  tokens_used: number;
  trace: ContextTrace;
}

export class ContextManager {
  private systemPrompt?: string;

  constructor(system_prompt?: string) {
    this.systemPrompt = system_prompt;
  }

  public estimateTokens(text: string): number {
    if (!text.trim()) return 0;
    return Math.ceil(text.length / 4);
  }

  public build(state: AgentState, max_tokens: number, step_index: number): Context {
    const context_included: string[] = [];
    const context_evicted: string[] = [];
    const context_decisions: ContextDecision[] = [];

    const activeSystemPrompt = state.system_prompt || this.systemPrompt || "";

    const systemPromptTokens = this.estimateTokens(activeSystemPrompt);
    context_included.push("System Prompt");

    const queryText = state.current_query;
    const queryTokens = this.estimateTokens(queryText);
    context_included.push(`Current User Query: "${queryText}"`);

    const toolMessages: string[] = [];
    let toolTokens = 0;

    for (const toolRes of state.tool_results) {
      let resultStr = "";
      if (toolRes.tool === "get_roadmap" && toolRes.result) {
        const originalText = JSON.stringify(toolRes.result);
        const compactedText = `Roadmap ID: ${toolRes.result.id}, slug: ${toolRes.result.slug}, title: "${toolRes.result.title}". Months loaded: ${toolRes.result.months.length}.`;
        resultStr = compactedText;

        context_decisions.push({
          reason: "After get_roadmap, full roadmap JSON should not remain at full size in every later model call to save token budget.",
          block: `Tool Result: get_roadmap (compacted from ${originalText.length} to ${compactedText.length} chars)`,
        });
      } else if (toolRes.tool === "update_roadmap_month" && toolRes.result) {
        resultStr = JSON.stringify(toolRes.result);
      } else {
        resultStr = JSON.stringify(toolRes.result || "");
      }

      const formatted = `Tool Call: ${toolRes.tool} with args: ${JSON.stringify(toolRes.args)} -> Result: ${resultStr}`;
      toolMessages.push(formatted);
      toolTokens += this.estimateTokens(formatted);
      context_included.push(`Tool Observation: ${toolRes.tool}`);
    }

    const processedHistory = state.session_history.map(item => {
      let content = item.content;
      let tokens = item.estimated_tokens ?? this.estimateTokens(content);
      let compacted = false;

      if (content.toLowerCase().includes("transfer learning")) {
        const originalContent = content;
        content = "Previous discussion about transfer learning.";
        tokens = this.estimateTokens(content);
        compacted = true;

        context_decisions.push({
          reason: "Convert large irrelevant history (transfer learning tutorial) into a short summary.",
          block: `Session History [${item.role}]: Compacted from "${originalContent.substring(0, 40)}..."`,
        });
      }

      return {
        role: item.role,
        content,
        tokens,
        compacted,
        originalContent: item.content,
      };
    });

    const activeHistoryIndices: number[] = [];
    let currentTotalTokens = systemPromptTokens + queryTokens + toolTokens;
    for (let i = processedHistory.length - 1; i >= 0; i--) {
      const item = processedHistory[i];
      if (currentTotalTokens + item.tokens <= max_tokens) {
        activeHistoryIndices.unshift(i);
        currentTotalTokens += item.tokens;
        context_included.push(`Session History [${item.role}]: "${item.content.substring(0, 30)}..."`);
      } else {
        context_evicted.push(`Session History [${item.role}]: "${item.originalContent.substring(0, 30)}..."`);
        context_decisions.push({
          reason: "Token budget exceeded, evicted oldest low-priority session history.",
          block: `Session History [${item.role}]: "${item.originalContent.substring(0, 40)}..."`,
        });
      }
    }

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
    messages.push({ role: "system", content: activeSystemPrompt });

    for (const idx of activeHistoryIndices) {
      const item = processedHistory[idx];
      messages.push({ role: item.role, content: item.content });
    }

    let trajectoryContent = `Current User Request: ${queryText}\n\n`;
    if (toolMessages.length > 0) {
      trajectoryContent += `Previous Steps Trajectory:\n` + toolMessages.join("\n") + `\n\n`;
    }
    trajectoryContent += `Determine the next action. Think step-by-step and call a tool or finish the task.`;
    
    messages.push({ role: "user", content: trajectoryContent });

    const trace: ContextTrace = {
      step_index,
      tokens_used: currentTotalTokens,
      token_budget: max_tokens,
      context_included,
      context_evicted,
      context_decisions,
    };

    return {
      messages,
      tokens_used: currentTotalTokens,
      trace,
    };
  }
}
