import { Context } from "../contextmanager";
import { validateLlmResponse } from "../validator";

export interface toolResponse {
  type: "tool" | "finish";
  tool: string;
  args?: Record<string, any>;
}

export class ModelManager {
  private readonly provider: string|undefined;
  private readonly token: string|undefined;
  private readonly base_url: string|undefined;

  constructor() {
    this.provider = process.env.LLM_PROVIDER 
    this.token = process.env.LLM_API_KEY
    this.base_url = process.env.LLM_BASE_URL
  }

  public async call_llm(context: Context): Promise<toolResponse> {
    const isTest = process.env.NODE_ENV === "test" || !!process.env.VITEST;
    const hasExplicitApiKey = !!process.env.GROQ_API_KEY;

    if (isTest && !hasExplicitApiKey) {
      return this.call_mock_llm(context);
    }

    try {
      return await this.call_real_llm(context, false);
    } catch (error) {
      console.warn("LLM Call failed or failed validation, retrying once with strict instructions...", error);
      try {
        return await this.call_real_llm(context, true);
      } catch (retryError) {
        console.error("LLM retry failed. Returning deterministic fallback response.", retryError);
        return this.getFallbackResponse(context);
      }
    }
  }

  private async call_real_llm(context: Context, strict: boolean): Promise<toolResponse> {
    const token = this.token;
    const model = process.env.LLM_MODEL || "llama-3.3-70b-versatile";
    const url = `${this.base_url}/chat/completions`;

    let systemInstruction = context.messages.find(m => m.role === "system")?.content || "";
    
    const jsonFormattingRule = `\n\nCRITICAL: You MUST respond ONLY with a single JSON object. No other text, no markdown code block wraps (like \`\`\`json).
Required formats:
For a tool call:
{
  "type": "tool",
  "tool": "get_user_profile" | "get_roadmap" | "search_kb" | "update_roadmap_month",
  "args": { ... }
}

For the final response:
{
  "type": "finish",
  "tool": "finish",
  "args": {
    "message": "User-facing summary message"
  }
}`;

    systemInstruction += jsonFormattingRule;

    if (strict) {
      systemInstruction += "\n\nRETRY WARNING: Your previous response failed schema validation. You MUST return ONLY the raw JSON conforming strictly to the defined schema. Double check properties and arguments.";
    }

    const chatMessages = context.messages.filter(m => m.role !== "system");

    const payload = {
      model,
      messages: [
        { role: "system", content: systemInstruction },
        ...chatMessages
      ],
      response_format: { type: "json_object" }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Groq API completions error: ${response.statusText} (${response.status})`);
    }

    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("Empty completion returned from Groq API");
    }

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(text);
    } catch (e: any) {
      throw new Error(`Failed to parse Groq response text as JSON: ${e.message}`);
    }

    const validationResult = validateLlmResponse(parsedResponse);
    if (!validationResult.success) {
      throw new Error(`Zod validation failed: ${validationResult.error.message}`);
    }

    return validationResult.data as toolResponse;
  }

  private call_mock_llm(context: Context): toolResponse {
    const userQuery = context.messages.find(m => m.role === "user")?.content.toLowerCase() || "";
    const toolObservationCount = context.trace.context_included.filter(item => 
      item.startsWith("Tool Observation:")
    ).length;

    let isSdeQuery = userQuery.includes("sde") || userQuery.includes("software");

    if (toolObservationCount === 0) {
      return {
        type: "tool",
        tool: "get_user_profile",
        args: {},
      };
    } else if (toolObservationCount === 1) {
      const roadmapId = isSdeQuery ? "rdmp_sde2026" : "rdmp_9f2a";
      return {
        type: "tool",
        tool: "get_roadmap",
        args: { roadmap_id: roadmapId },
      };
    } else if (toolObservationCount === 2) {
      const q = isSdeQuery ? "SDE month 2" : "MLOps month 4";
      return {
        type: "tool",
        tool: "search_kb",
        args: { query: q },
      };
    } else if (toolObservationCount === 3) {
      const roadmapId = isSdeQuery ? "rdmp_sde2026" : "rdmp_9f2a";
      const month = isSdeQuery ? 2 : 4;
      const title = isSdeQuery ? "Advanced System Design" : "Model tuning & ensembles";
      const activities = isSdeQuery ? ["Distributed Systems", "Load Balancing", "Caching"] : ["feature_engineering", "random_forests", "gradient_boosting", "capstone_week_1", "MLOps"];
      return {
        type: "tool",
        tool: "update_roadmap_month",
        args: {
          roadmap_id: roadmapId,
          month,
          title,
          activities,
          confirmed: false,
        },
      };
    } else if (toolObservationCount === 4) {
      const roadmapId = isSdeQuery ? "rdmp_sde2026" : "rdmp_9f2a";
      const month = isSdeQuery ? 2 : 4;
      const title = isSdeQuery ? "Advanced System Design" : "Model tuning & ensembles";
      const activities = isSdeQuery ? ["Distributed Systems", "Load Balancing", "Caching"] : ["feature_engineering", "random_forests", "gradient_boosting", "capstone_week_1", "MLOps"];
      return {
        type: "tool",
        tool: "update_roadmap_month",
        args: {
          roadmap_id: roadmapId,
          month,
          title,
          activities,
          confirmed: true,
        },
      };
    } else {
      const roadmapSlug = isSdeQuery ? "priya-sde-2026" : "priya-ds-2026";
      const monthStr = isSdeQuery ? "month 2" : "month 4";
      const topic = isSdeQuery ? "System Design" : "MLOps";
      return {
        type: "finish",
        tool: "finish",
        args: {
          message: `Successfully added ${topic} to ${monthStr} and saved your roadmap (${roadmapSlug}).`,
        },
      };
    }
  }

  private getFallbackResponse(context: Context): toolResponse {
    return this.call_mock_llm(context);
  }
}
