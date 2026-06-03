import { Router, Request, Response } from "express";
import * as fs from "fs/promises";
import * as path from "path";
import { AgentRuntime } from "./runtime/run";
import { Userdetails } from "./schema";
import { validateHttpRequest, validateRunResponse } from "./validator";

export const roadmapRouter = Router();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg = "Request timeout"): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

roadmapRouter.post("/ai/roadmap-copilot/run", async (req: Request, res: Response) => {
  try {
    const validation = validateHttpRequest(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Invalid request payload",
        details: validation.error.format(),
      });
      return;
    }

    const { user_message, user_id, token_budget_per_model_call, max_steps, session_history } = validation.data;

    let userProfile: Userdetails;
    try {
      const profilesPath = path.resolve(process.cwd(), "starter/data/profiles.json");
      const profilesContent = await fs.readFile(profilesPath, "utf-8");
      const profiles = JSON.parse(profilesContent) as Userdetails[];
      const matchedProfile = profiles.find(p => p.user_id === user_id);
      if (matchedProfile) {
        userProfile = matchedProfile;
      } else {
        const profilePath = path.resolve(process.cwd(), "starter/data/profile.json");
        const profileContent = await fs.readFile(profilePath, "utf-8");
        userProfile = JSON.parse(profileContent) as Userdetails;
      }
    } catch (err) {
      console.log(`Error fetching user details ${err}`);
      res.status(500).json({
        success: false,
        error: "Error fetching user details",
      });
      return;
    }

    const runtime = new AgentRuntime(
      max_steps,
      token_budget_per_model_call,
      userProfile,
      user_message,
      session_history
    );

    const requestTimeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS || "60000", 10);
    let result;
    try {
      result = await withTimeout(runtime.run(), requestTimeoutMs, "Request timeout");
    } catch (err: any) {
      if (err.message === "Request timeout") {
        res.status(500).json({
          success: false,
          error: "Request timeout"
        });
        return;
      }
      throw err;
    }

    const state = runtime.getState();

    const stepsReport = state.context_trace.map((trace, index) => {
      const toolRes = state.tool_results[index];
      
      let action: any;
      if (toolRes) {
        let actionType: "tool_call" | "finish" | "guardrail_block" | "error" = "tool_call";
        let resultSummary = "";

        if (toolRes.result && typeof toolRes.result === "object") {
          if (toolRes.result.error && toolRes.result.error.includes("Guardrail block")) {
            actionType = "guardrail_block";
            resultSummary = toolRes.result.error;
          } else {
            resultSummary = toolRes.result.message || JSON.stringify(toolRes.result);
          }
        } else {
          resultSummary = String(toolRes.result || "");
        }

        if (toolRes.tool === "finish") {
          actionType = "finish";
        }

        action = {
          type: actionType,
          tool: toolRes.tool,
          arguments: toolRes.args || {},
          result_summary: resultSummary,
        };
      } else {
        action = {
          type: "finish",
          tool: "finish",
          arguments: { message: result.final_message },
          result_summary: "Task finished.",
        };
      }

      return {
        step_index: trace.step_index,
        tokens_used: trace.tokens_used,
        token_budget: trace.token_budget,
        context_included: trace.context_included,
        context_evicted: trace.context_evicted,
        context_decisions: trace.context_decisions,
        action,
      };
    });

    const runReport = {
      success: result.success,
      final_message: result.final_message,
      roadmap_updated: result.roadmap_updated,
      slug: result.slug,
      steps: stepsReport,
      context_trace: state.context_trace,
      provider: process.env.LLM_PROVIDER || "google",
      model: process.env.LLM_MODEL || "gemini-2.5-flash",
    };

    const responseValidation = validateRunResponse(runReport);
    if (!responseValidation.success) {
      console.error("HTTP Response validation failed details:", responseValidation.error.format());
      res.status(500).json({
        success: false,
        error: "Response validation failed",
      });
      return;
    }

    res.status(200).json(responseValidation.data);
  } catch (error: any) {
    console.error("Route execution error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});
