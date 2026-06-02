import { Router, Request, Response } from "express";
import * as fs from "fs/promises";
import * as path from "path";
import { AgentRuntime } from "./runtime/run";
import { Userdetails } from "./schema";
import { validateHttpRequest } from "./validator";

export const roadmapRouter = Router();

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

    const result = await runtime.run();
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
      scenario_id: req.body.scenario_id || "roadmap_mlops_save",
      mode: "live",
      provider: process.env.LLM_PROVIDER || "google",
      model: process.env.LLM_MODEL || "gemini-2.5-flash",
      success: result.success,
      final_message: result.final_message,
      roadmap_updated: result.roadmap_updated,
      slug: result.slug,
      steps: stepsReport,
    };

    res.status(200).json(runReport);
  } catch (error: any) {
    console.error("Route execution error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});
