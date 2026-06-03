# Roadmap Copilot Agent

This is a dynamic, token-optimized Roadmap Copilot Agent. It uses a structured ReAct (Reasoning and Action) loop to read active user profiles, retrieve curriculum guides, search a technical knowledge base, and dynamically update user roadmap paths based on conversational requests.

---

## Architecture

Below is the execution flow and system architecture:

```mermaid
graph TD
    User([User Request]) --> Route[Express Route /ai/roadmap-copilot/run]
    Route --> ProfileLookup[profiles.json Lookup]
    ProfileLookup --> AgentRuntime[AgentRuntime Instantiation]
    
    subgraph ReAct Loop
        AgentRuntime --> CM[ContextManager]
        CM --> TokenCheck{Token Budget Check}
        TokenCheck -- Exceeded --> Evict[Evict/Compact Irrelevant Context]
        Evict --> SystemPrompt[Load System Prompt + Dynamic Tool Schemas]
        TokenCheck -- Within Budget --> SystemPrompt
        
        SystemPrompt --> CallLLM[ModelManager: Groq API Call]
        CallLLM --> ZodValid{Strict Zod Validator}
        
        ZodValid -- Fail (First Time) --> Retry[Retry Once with Strict Prompt]
        Retry --> CallLLM
        ZodValid -- Fail (Second Time) --> Fallback[Deterministic Fallback]
        
        ZodValid -- Success --> ToolDispatch[ToolDispatcher]
        
        ToolDispatch --> get_user_profile[get_user_profile]
        ToolDispatch --> get_roadmap[get_roadmap]
        ToolDispatch --> search_kb[search_kb]
        ToolDispatch --> update_roadmap_month[update_roadmap_month]
        ToolDispatch --> finish[finish]
    end
    
    update_roadmap_month --> Merge[Merge Activities & Sort]
    Merge --> FS[Persist back to roadmaps.json / roadmap.json]
    finish --> Client[Return Execution Trajectory & Final Output]
```

---

## High-Level Design (HLD) in Plain Words

Here is how the copilot actually works:

### 1. The Core Loop (ReAct)
When you ask the copilot to do something (like "Add Express to month 4 and save it"), it doesn't just make a single LLM call. It enters a loop. It thinks (Reasoning) and decides to execute a tool (Action), checks the outcome, and continues until it is finished/max steps reached.

### 2. Guarding the Token Budget (Context Compaction)
LLM calls have limit budgets. If the conversation history is long (e.g. off-topic chat or massive roadmap payloads), the `ContextManager` steps in. It analyzes token counts. If the budget is exceeded, it evicts or summarizes large blocks of chat history (like long off-topic tutorial text) to ensure the system prompt and core task goals are preserved.

### 3. Absolute Type-Safety & Self-Correction
We use strict Zod schemas to validate every single tool call from the LLM. If the model outputs the wrong keys (e.g., mixing up `"activities"` with `"topics"`), it is caught.
* **Auto-Resolution**: The system prompt is dynamically populated with parameters schemas during load time so the model knows exactly what to output.
* **Smart Retry**: If the model still makes a mistake, the agent automatically retries exactly once with a stricter instruction detailing the exact schema mismatch. If it fails a second time, it yields a deterministic fallback.

### 4. Smart Data Merging & Persistence
When modifying a roadmap:
* **Merge, Don't Overwrite**: If you update month 4, it merges the new activities with the existing ones using a Set (preventing duplicate items) rather than replacing them.
* **File System Persistence**: The changes are written directly back to the database files (`profiles.json`, `roadmaps.json`, `roadmap.json`) in the filesystem, making them permanent.

---

## Getting Started

### Prerequisites
* **Node.js**: `v18+` or later.
* **API Key**: A valid Groq API key.

### Setup Environment
1. Set up your `.vscode/launch.json` or `.env` file with your Groq credentials:
```env
LLM_PROVIDER=groq
LLM_API_KEY=your-groq-api-key
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile
```

2. Install dependencies:
```bash
npm install
```

### Running the App
* Run the dev server:
```bash
npm run dev
```
* Visit `http://localhost:3000` to interact with the visual web panel, select active users (Priya, Vicky, or Ash), and trigger the ReAct copilot loop!

### Testing
We cover multiple integration scenarios offline using robust Vitest mocked/spied environments:
```bash
npm test
```
The test suite validates:
1. **Scenario 1**: Priya Sharma's Data Science track (MLOps addition, unconfirmed guardrails, and confirmed updates).
2. **Scenario 2**: Vicky B's AI Engineering track (Backend/Express addition and confirmed merges).
3. **Scenario 3**: Ash's Cybersecurity track (Knowledge base search, pentesting tool lookups, and confirmed updates).
4. **Fallback & Retry Policies**: Handles malformed LLM responses with warnings and single retries.
5. **Timeout Handling**: Validates system resilience under slow LLM APIs and route execution hangs.

---

## Environment Variables

The application is configured using the following environment variables (which can be defined in a `.env` file at the project root):

* `LLM_PROVIDER`: The LLM hosting platform (e.g. `groq`, `openai`).
* `LLM_API_KEY`: API credential key for the chosen LLM provider.
* `LLM_MODEL`: Model identifier to use (e.g. `llama-3.3-70b-versatile`, `gpt-4.1-mini`).
* `LLM_TIMEOUT_MS`: Timeout for direct model API completion requests. Defaults to `30000`.
* `REQUEST_TIMEOUT_MS`: Overall request timeout for the `/ai/roadmap-copilot/run` route. Defaults to `60000`.

---

## Validation & Checker Script

The schema of the agent run trajectories is strictly validated on output. You can run the validation checker script to parse and validate the saved execution payload against the expected run response schema:

```bash
npm run check
```

This command runs `scripts/check.ts` which loads `examples/response.json`, validates it using the Zod response schema, and exits with `0` (or `1` + validation logs on errors).

---

## Reliability & Resiliency Strategies

### Fallback Strategy
1. **Initial LLM Call**: The agent sends the ReAct prompt and dynamic tool definitions to the LLM.
2. **Strict Retry Prompt**: If the response is malformed or violates the schema, the system catches the error and executes a single retry call, appending a warning instructing the model to strictly follow the expected JSON schema.
3. **Deterministic Fallback**: If the retry attempt also fails or encounters network problems, the runtime yields a hardcoded deterministic fallback action to gracefully finish the loop:
   ```json
   { "type": "finish", "tool": "finish", "args": { "message": "Unable to process the request due to LLM connectivity issues." } }
   ```

### Timeout Strategy
* **LLM Timeout**: Direct chat completion requests are wrapped in an `AbortController` signal timed to `LLM_TIMEOUT_MS`. If breached, the network request is aborted, throwing a timeout error that participates in the fallback retry mechanism.
* **Request Timeout**: The Express endpoint wraps the entire ReAct loop run. If execution takes longer than `REQUEST_TIMEOUT_MS`, the promise is rejected, and a structured `{ "success": false, "error": "Request timeout" }` payload is returned without crashing the server.

---

## Time Spent

Roughly 6-7 hours were spent on implementation, testing, debugging, and documentation.

---

## Hardest Tradeoffs

The hardest tradeoff was to build a dynamic ReAct, JSON based workflow engine instead of deterministic hardcoded ReAct loop. I built hardcoded ReAct loop under very little time.