import {
  getUserProfile,
  getRoadmap,
  searchKnowledgeBase,
  updateRoadmapMonth,
  finish,
} from "../tools";
import { AgentState } from "../runtime/types";

export class ToolDispatcher {
  public async execute(toolName: string, args: any, state: AgentState) {
    switch (toolName) {
      case "get_user_profile":
        return getUserProfile(args, state);

      case "get_roadmap":
        return getRoadmap(args, state);

      case "search_kb":
        return searchKnowledgeBase(args);

      case "update_roadmap_month":
        return updateRoadmapMonth(args, state);

      case "finish":
        return finish(args);

      default:
        throw new Error(`Unknown tool ${toolName}`);
    }
  }
}
