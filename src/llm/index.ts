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
    this.provider = process.env.LLM_PROVIDER;
    this.token = process.env.LLM_API_KEY;
    this.base_url = process.env.LLM_BASE_URL;
  }

  public async call_llm(context: Context): Promise<toolResponse> {
    try {
      return await this.call_real_llm(context, false);
    } catch (error) {
      console.warn("LLM Call failed or failed validation, retrying once with strict instructions...", error);
      try {
        return await this.call_real_llm(context, true);
      } catch (retryError) {
        console.error("LLM retry failed. Returning deterministic fallback response.", retryError);
        return {
          type: "finish",
          tool: "finish",
          args: {
            message: "Unable to process the request due to LLM connectivity issues."
          }
        };
      }
    }
  }

  private async call_real_llm(context: Context, strict: boolean): Promise<toolResponse> {
    const token = this.token;
    if (!token) {
      throw new Error("LLM_API_KEY environment variable is not defined");
    }
    const model = process.env.LLM_MODEL || "llama-3.3-70b-versatile";
    const url = `${this.base_url || "https://api.groq.com/openai/v1"}/chat/completions`;

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
}
