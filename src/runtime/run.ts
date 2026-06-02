import * as fs from "fs/promises";
import * as path from "path";
import { ContextManager } from "../contextmanager";
import { ModelManager, toolResponse } from "../llm";
import { Userdetails } from "../schema";
import { ToolDispatcher } from "../tooldispatcher";
import { AgentState } from "./types";

export class AgentRuntime {
  private state: AgentState = {
    tool_results: [],
    context_trace: [],
    user_profile: undefined,
    session_history: [],
    roadmap: undefined,
    current_query: "",
  };
  private system_prompt: string = "";
  private current_step = 0;
  private readonly max_steps: number;
  private readonly max_tokens: number;

  constructor(
    max_steps: number,
    max_tokens: number,
    user: Userdetails,
    query: string,
    sessionHistory: Array<{ role: "user" | "assistant"; content: string; estimated_tokens?: number }> = []
  ) {
    this.max_steps = max_steps;
    this.max_tokens = max_tokens;
    this.state.user_profile = user;
    this.state.current_query = query;
    this.state.session_history = sessionHistory;
  }

  public getState(): AgentState {
    return this.state;
  }

  private getToolsDefinition(): string {
    return [
      {
        name: "get_user_profile",
        description: "Fetch the user profile containing active roadmap ID and details.",
        parameters: {}
      },
      {
        name: "get_roadmap",
        description: "Fetch a specific roadmap details by roadmap_id.",
        parameters: {
          type: "object",
          properties: {
            roadmap_id: { type: "string", description: "The ID of the roadmap to retrieve." }
          },
          required: ["roadmap_id"]
        }
      },
      {
        name: "search_kb",
        description: "Search the knowledge base for specific technical curriculum or roadmap topics.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query keyword or term." }
          },
          required: ["query"]
        }
      },
      {
        name: "update_roadmap_month",
        description: "Update the activities, title, and confirmation status of a specific month in a roadmap.",
        parameters: {
          type: "object",
          properties: {
            roadmap_id: { type: "string", description: "The ID of the roadmap." },
            month: { type: "number", description: "The integer month number to update (1-12)." },
            title: { type: "string", description: "The title or focus of the month." },
            activities: { type: "array", items: { type: "string" }, description: "List of activities or topics for this month." },
            confirmed: { type: "boolean", description: "Must set confirmed=true to persist updates, confirmed=false will only dry-run." }
          },
          required: ["roadmap_id", "month", "title", "activities", "confirmed"]
        }
      },
      {
        name: "finish",
        description: "Conclude the task and present the final user-facing response message.",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "A concise message explaining the results and active slug." }
          },
          required: ["message"]
        }
      }
    ].map(t => `- **${t.name}**: ${t.description}\n  Parameters schema: ${JSON.stringify(t.parameters)}`).join("\n");
  }

  private async loadSystemPrompt(): Promise<string> {
    const toolsDef = this.getToolsDefinition();
    try {
      const filePath = path.resolve(process.cwd(), "starter/prompts/system.md");
      const content = await fs.readFile(filePath, "utf-8");
      return content.replace("{{tools}}", toolsDef);
    } catch {
      return `You are a roadmap copilot on an education platform.
- Use tools to read state before writing.
- When updating a roadmap month, you must set confirmed=true only after the user has asked to save and you are ready to persist.
- Prefer short tool arguments; do not repeat entire large JSON objects in your reasoning.
- When done, call finish with a concise user-facing message including what changed and the roadmap slug.

Available Tools:
${toolsDef}`;
    }
  }

  public async run() {
    this.system_prompt = await this.loadSystemPrompt();
    const contextManager = new ContextManager(this.system_prompt);
    const toolDispatcher = new ToolDispatcher();
    const modelManager = new ModelManager();

    while (this.current_step < this.max_steps) {
      const context = contextManager.build(this.state, this.max_tokens, this.current_step);
      this.state.context_trace.push(context.trace);

      const llm_response: toolResponse = await modelManager.call_llm(context);

      if (llm_response.type === "tool") {
        const tool_result = await toolDispatcher.execute(
          llm_response.tool,
          llm_response.args,
          this.state
        );

        this.state.tool_results.push({
          type: "tool",
          tool: llm_response.tool,
          args: llm_response.args,
          result: tool_result
        });

        if (llm_response.tool === "finish") {
          return {
            success: true,
            final_message: tool_result.message || JSON.stringify(tool_result),
            roadmap_updated: !!this.state.roadmap,
            slug: this.state.roadmap?.slug || this.state.user_profile?.roadmap_slug || "",
            state: this.state
          };
        }

        this.current_step++;
        continue;
      } else if (llm_response.type === "finish") {
        const finishMsg = llm_response.args?.message || "Task complete.";
        return {
          success: true,
          final_message: finishMsg,
          roadmap_updated: !!this.state.roadmap,
          slug: this.state.roadmap?.slug || this.state.user_profile?.roadmap_slug || "",
          state: this.state
        };
      }
    }
    throw new Error("MAX_STEPS_EXCEEDED");
  }
}
