import * as fs from "fs/promises";
import * as path from "path";
import { Userdetails, Roadmap } from "../schema";
import { AgentState } from "../runtime/types";

async function readJsonFile<T>(relativePath: string): Promise<T> {
  const filePath = path.resolve(process.cwd(), relativePath);
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

export async function getUserProfile(args: any, state?: AgentState): Promise<Userdetails> {
  if (state?.user_profile) {
    return state.user_profile;
  }
  return await readJsonFile<Userdetails>("starter/data/profile.json");
}

export async function getRoadmap(args: { roadmap_id: string }, state?: AgentState): Promise<Roadmap> {
  if (state?.roadmap && state.roadmap.id === args.roadmap_id) {
    return state.roadmap;
  }
  try {
    const roadmaps = await readJsonFile<Roadmap[]>("starter/data/roadmaps.json");
    const matched = roadmaps.find(r => r.id === args.roadmap_id);
    if (matched) {
      return matched;
    }
  } catch {}
  const roadmap = await readJsonFile<Roadmap>("starter/data/roadmap.json");
  if (roadmap.id !== args.roadmap_id) {
    throw new Error(`Roadmap with ID ${args.roadmap_id} not found.`);
  }
  return roadmap;
}

export async function searchKnowledgeBase(args: { query: string }): Promise<any> {
  const kb = await readJsonFile<{ chunks: Array<{ id: string; keywords: string[]; estimated_tokens: number; text: string }> }>(
    "starter/data/kb.json"
  );
  const queryLower = args.query.toLowerCase();
  
  const matches = kb.chunks.filter(chunk => {
    const matchesKeyword = chunk.keywords.some(keyword => queryLower.includes(keyword.toLowerCase()));
    const matchesText = chunk.text.toLowerCase().includes(queryLower);
    return matchesKeyword || matchesText;
  });

  return { chunks: matches };
}

export async function updateRoadmapMonth(
  args: { roadmap_id: string; month: number; title: string; activities: string[]; confirmed: boolean },
  state: AgentState
): Promise<{ success: boolean; message?: string; error?: string }> {
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

  const updatedRoadmap = JSON.parse(JSON.stringify(roadmap)) as Roadmap;
  
  let monthObj = updatedRoadmap.months.find(m => m.month === args.month);
  if (!monthObj) {
    monthObj = { month: args.month, title: args.title, activities: args.activities };
    updatedRoadmap.months.push(monthObj);
  } else {
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
    const roadmaps = JSON.parse(content) as Roadmap[];
    const idx = roadmaps.findIndex(r => r.id === args.roadmap_id);
    if (idx !== -1) {
      roadmaps[idx] = updatedRoadmap;
      await fs.writeFile(roadmapsPath, JSON.stringify(roadmaps, null, 2), "utf-8");
    }
  } catch {
    throw new Error(`Failed to update roadmap with ID ${args.roadmap_id}.`);
  }

  return {
    success: true,
    message: `Successfully updated month ${args.month} for roadmap ${args.roadmap_id}.`
  };
}

export async function finish(args: { message: string }): Promise<{ message: string }> {
  return { message: args.message };
}
