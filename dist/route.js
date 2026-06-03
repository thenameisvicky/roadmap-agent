"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.roadmapRouter = void 0;
const express_1 = require("express");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const run_1 = require("./runtime/run");
const validator_1 = require("./validator");
exports.roadmapRouter = (0, express_1.Router)();
function withTimeout(promise, timeoutMs, errorMsg = "Request timeout") {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMsg));
        }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}
exports.roadmapRouter.post("/ai/roadmap-copilot/run", async (req, res) => {
    try {
        const validation = (0, validator_1.validateHttpRequest)(req.body);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                error: "Invalid request payload",
                details: validation.error.format(),
            });
            return;
        }
        const { user_message, user_id, token_budget_per_model_call, max_steps, session_history } = validation.data;
        let userProfile;
        try {
            const profilesPath = path.resolve(process.cwd(), "starter/data/profiles.json");
            const profilesContent = await fs.readFile(profilesPath, "utf-8");
            const profiles = JSON.parse(profilesContent);
            const matchedProfile = profiles.find(p => p.user_id === user_id);
            if (matchedProfile) {
                userProfile = matchedProfile;
            }
            else {
                const profilePath = path.resolve(process.cwd(), "starter/data/profile.json");
                const profileContent = await fs.readFile(profilePath, "utf-8");
                userProfile = JSON.parse(profileContent);
            }
        }
        catch (err) {
            console.log(`Error fetching user details ${err}`);
            res.status(500).json({
                success: false,
                error: "Error fetching user details",
            });
            return;
        }
        const runtime = new run_1.AgentRuntime(max_steps, token_budget_per_model_call, userProfile, user_message, session_history);
        const requestTimeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS || "60000", 10);
        let result;
        try {
            result = await withTimeout(runtime.run(), requestTimeoutMs, "Request timeout");
        }
        catch (err) {
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
            let action;
            if (toolRes) {
                let actionType = "tool_call";
                let resultSummary = "";
                if (toolRes.result && typeof toolRes.result === "object") {
                    if (toolRes.result.error && toolRes.result.error.includes("Guardrail block")) {
                        actionType = "guardrail_block";
                        resultSummary = toolRes.result.error;
                    }
                    else {
                        resultSummary = toolRes.result.message || JSON.stringify(toolRes.result);
                    }
                }
                else {
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
            }
            else {
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
        const responseValidation = (0, validator_1.validateRunResponse)(runReport);
        if (!responseValidation.success) {
            console.error("HTTP Response validation failed details:", responseValidation.error.format());
            res.status(500).json({
                success: false,
                error: "Response validation failed",
            });
            return;
        }
        res.status(200).json(responseValidation.data);
    }
    catch (error) {
        console.error("Route execution error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Internal Server Error",
        });
    }
});
//# sourceMappingURL=route.js.map