"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolDispatcher = void 0;
const tools_1 = require("../tools");
class ToolDispatcher {
    async execute(toolName, args, state) {
        switch (toolName) {
            case "get_user_profile":
                return (0, tools_1.getUserProfile)(args, state);
            case "get_roadmap":
                return (0, tools_1.getRoadmap)(args, state);
            case "search_kb":
                return (0, tools_1.searchKnowledgeBase)(args);
            case "update_roadmap_month":
                return (0, tools_1.updateRoadmapMonth)(args, state);
            case "finish":
                return (0, tools_1.finish)(args);
            default:
                throw new Error(`Unknown tool ${toolName}`);
        }
    }
}
exports.ToolDispatcher = ToolDispatcher;
//# sourceMappingURL=index.js.map