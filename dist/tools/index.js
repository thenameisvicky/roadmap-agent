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
exports.getUserProfile = getUserProfile;
exports.getRoadmap = getRoadmap;
exports.searchKnowledgeBase = searchKnowledgeBase;
exports.updateRoadmapMonth = updateRoadmapMonth;
exports.finish = finish;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
async function readJsonFile(relativePath) {
    const filePath = path.resolve(process.cwd(), relativePath);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
}
async function getUserProfile(args, state) {
    if (state?.user_profile) {
        return state.user_profile;
    }
    return await readJsonFile("starter/data/profile.json");
}
async function getRoadmap(args, state) {
    if (state?.roadmap && state.roadmap.id === args.roadmap_id) {
        return state.roadmap;
    }
    try {
        const roadmaps = await readJsonFile("starter/data/roadmaps.json");
        const matched = roadmaps.find(r => r.id === args.roadmap_id);
        if (matched) {
            return matched;
        }
    }
    catch { }
    const roadmap = await readJsonFile("starter/data/roadmap.json");
    if (roadmap.id !== args.roadmap_id) {
        throw new Error(`Roadmap with ID ${args.roadmap_id} not found.`);
    }
    return roadmap;
}
async function searchKnowledgeBase(args) {
    const kb = await readJsonFile("starter/data/kb.json");
    const queryLower = args.query.toLowerCase();
    const matches = kb.chunks.filter(chunk => {
        const matchesKeyword = chunk.keywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
        const matchesText = chunk.text.toLowerCase().includes(queryLower);
        return matchesKeyword || matchesText;
    });
    return { chunks: matches };
}
async function updateRoadmapMonth(args, state) {
    if (!args.confirmed) {
        return {
            success: false,
            error: "Guardrail block: update_roadmap_month failed because confirmed=false."
        };
    }
    let roadmap = state.roadmap;
    if (!roadmap || roadmap.id !== args.roadmap_id) {
        roadmap = await getRoadmap({ roadmap_id: args.roadmap_id });
    }
    const updatedRoadmap = JSON.parse(JSON.stringify(roadmap));
    let monthObj = updatedRoadmap.months.find(m => m.month === args.month);
    if (!monthObj) {
        monthObj = { month: args.month, title: args.title, activities: args.activities };
        updatedRoadmap.months.push(monthObj);
    }
    else {
        monthObj.title = monthObj.title;
        const merged = new Set([...(monthObj.activities || []), ...(args.activities || [])]);
        monthObj.activities = Array.from(merged);
    }
    updatedRoadmap.months.sort((a, b) => a.month - b.month);
    const today = new Date().toISOString().split("T")[0];
    updatedRoadmap.revision_history.push({
        at: today,
        note: `Updated month ${args.month} activities`
    });
    state.roadmap = updatedRoadmap;
    try {
        const roadmapsPath = path.resolve(process.cwd(), "starter/data/roadmaps.json");
        const content = await fs.readFile(roadmapsPath, "utf-8");
        const roadmaps = JSON.parse(content);
        const idx = roadmaps.findIndex(r => r.id === args.roadmap_id);
        if (idx !== -1) {
            roadmaps[idx] = updatedRoadmap;
            await fs.writeFile(roadmapsPath, JSON.stringify(roadmaps, null, 2), "utf-8");
        }
    }
    catch {
        throw new Error(`Failed to update roadmap with ID ${args.roadmap_id}.`);
    }
    return {
        success: true,
        message: `Successfully updated month ${args.month} for roadmap ${args.roadmap_id}.`
    };
}
async function finish(args) {
    return { message: args.message };
}
//# sourceMappingURL=index.js.map