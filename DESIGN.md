# Architecture overview

The system implements a lightweight AI agent runtime responsible for orchestrating LLM reasoning, tool execution, context management, validation, and response generation.
Components:

1. HTTP API Layer
   * Receives user requests.
   * Validates request schema.

2. Agent Runtime
   * Maintains execution state.
   * Controls the ReAct loop.
   * Tracks step count and token budget.

3. LLM Provider
   * Generates tool decisions.
   * Produces finish responses.

4. Tool Execution Layer
   * Executes requested tools.
   * Returns structured results.

5. Context Manager
   * Builds context before every model call.
   * Performs compaction.
   * Performs eviction when budget is exceeded.

6. Validation Layer
   * Validates tool arguments.
   * Validates final response schema.

7. Evaluation Layer
   * Used by tests and check scripts.
   * Verifies output against assignment rules.

# Agent Loop

1. Runtime receives the request.
2. Runtime initializes agent state and step counter.
3. Runtime builds context from:
   * System prompt
   * User request
   * Session history
   * Tool results
4. Context manager performs:
   * Compaction
   * Token estimation
   * Eviction (if required)

5. Runtime invokes the LLM.
6. LLM returns either:
   * Tool call
   * Finish instruction
7. Runtime validates tool arguments.
8. Runtime executes the tool.
9. Tool result is added to agent state.
10. Steps 3-9 repeat until:
    * finish is called
    * max_steps is reached
    * fatal error occurs
11. Final response is validated and returned.

# Context Management

* Context is rebuilt before every model invocation.
* Compaction will be happening first if limit exceeds then context priortization policy is applied.
* Priority Order:
   1. System Prompt
   2. Current User Request
   3. Latest Tool Results
   4. Recent Session History
   5. Older Session History
* Lower priority context is removed before higher priority context.

# Guardrail design

* The runtime prevents unsafe writes by requiring confirm=true before update_roadmap_month() tool.
* If missing or false the tool returns a structured response to the LLM, then LLM decides what to do next.

# Failure Modes

* Invalid LLM Output
  * If the LLM response fails schema validation, the runtime retries once using a stricter prompt.
  * If validation fails again, a deterministic fallback response is returned.
* Tool Failure
  * Tool execution errors are returned as structured tool results.
  * The agent may choose an alternative action or terminate gracefully.
* Timeout
  * LLM and tool execution are protected by timeout limits.
  * Timeout errors return structured error responses.
* Max Step Exceeded
  * Runtime terminates execution if max_steps is reached before finish().

# Intentionally Not Implemented

* Semantic retrieval ranking using embeddings.
* Multi-agent orchestration.
* Dynamic workflow graph execution.
* Long-term memory storage beyond the provided mock data.
* Advanced observability platforms such as OpenTelemetry.
* Distributed execution and horizontal scaling.
* These features were excluded to keep the implementation focused on the assignment requirements.

# HLD

* LLM gets called with system prompt & avaialble tools, description, states to be filled.
* LLM -> tool call with executeTool() runtime function, tool result -> LLM this is one step.
* LLM -> next tool call with executeTool() along with state to be updated and value, tool result-> LLM.
* Like this until the user's query answered max steps 8.
* states has confim_edit: boolean, user_profile, roadmap, etc...
* Before inference with LLM everytime compact runs & if token > limit run eviction -> infernce with agent.
* Return the response to user inteface by calling Finish tool.
* If LLM output failed at schema validation -> retried once , again failure -> reject the response with error.
