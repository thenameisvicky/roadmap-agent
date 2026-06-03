# Prompt Version History & Registry

This registry tracks the versions and changes for the LLM prompts used throughout the Roadmap Copilot Agent lifecycle.

---

## 1. System Prompt

* **Active File Reference**: `src/llm/system_prompt.ts`
* **Versioned Copy**: `src/prompts/system_prompt_v1.1.0.txt`

### Version History
* **v1.0.0 (Initial Release)**
  * Core agent personality instructions: Zyra's Roadmap Copilot Agent.
  * Basic description of active tools (`get_user_profile`, `get_roadmap`, `search_kb`, `update_roadmap_month`, `finish`).
* **v1.1.0 (Current Version - Guardrail & Logic Hardening)**
  * Emphasized rule: *Never perform a write operation unless confirmed=true*.
  * Added constraint: *Always inspect user state before making modifications*.
  * Added constraint: *Read relevant roadmap information before performing updates*.
  * Added constraint: *Use tool results as the source of truth*.

---

## 2. JSON Formatting Prompt

* **Active Code Reference**: `src/llm/index.ts` (lines 51-67)
* **Versioned Copy**: `src/prompts/formatting_rule_v1.1.0.txt`

### Version History
* **v1.0.0 (Initial Release)**
  * Instructed the model to output valid JSON.
* **v1.1.0 (Current Version - Schema Coercion)**
  * Added explicit markdown block prohibition (e.g. no ` ```json ` wraps).
  * Outlined strict JSON shapes for both `"tool"` and `"finish"` response types to prevent parsing failures under Zod verification.

---

## 3. Retry / Self-Correction Prompt

* **Active Code Reference**: `src/llm/index.ts` (lines 71-73)
* **Versioned Copy**: `src/prompts/retry_prompt_v1.1.0.txt`

### Version History
* **v1.0.0 (Initial Release)**
  * General error message request asking the model to try again on errors.
* **v1.1.0 (Current Version - Stricter Schema Warning)**
  * Upgraded prompt message to explicitly warn the model: `"RETRY WARNING: Your previous response failed schema validation. You MUST return ONLY the raw JSON conforming strictly to the defined schema. Double check properties and arguments."`
