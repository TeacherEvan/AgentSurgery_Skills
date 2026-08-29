# Comprehensive Code Review

This document provides a comprehensive code review of the `AgentSurgery_Skills` repository, with a primary focus on the underlying implementation details found within the `surgical-orchestration` skill and the installation script.

## 1. Architecture and Design Patterns

The `surgical-orchestration` skill employs a robust, multi-agent state machine architecture designed to manage complex code transformations across directory boundaries.

*   **Orchestration Engine:** The `OrchestrationEngine` acts as the central state machine. It effectively groups changes by parent directories, spawning dedicated `Worker` and `Verifier` subagents for each scope. This approach minimizes context bloat and enforces a separation of concerns.
*   **Subagent Manager:** The `SubagentManager` handles the lifecycle of these subagents, enforcing a strict concurrency cap (`MAX_CONCURRENCY: 2`) and managing timeouts (`SUBAGENT_TIMEOUT_MS: 180_000`). This prevents runaway processes and API rate limit exhaustion.
*   **Inversion of Control:** A standout architectural decision is the use of an injected `SubagentDispatcher`. The library itself does not contain the runtime for executing LLM calls. Instead, it relies on the host (e.g., the Hermes agent via `delegate_task`) to inject the execution strategy. This makes the orchestration logic highly testable (via `dryRunDispatcher`) and decoupled from any specific LLM provider.
*   **Context Compaction:** Before spawning any subagent, the `ContextCompactor` distills the orchestrator's state down to a minimal ledger. This is a critical pattern for preventing token limit exceedances during long-running, multi-step agent workflows.

## 2. Security and Scope Sandboxing

Security is handled meticulously at the tool layer, preventing subagents (which are prone to hallucination) from corrupting out-of-scope files.

*   **`assertScopeBoundary` (in `security.ts`):** This is the core security mechanism. It uses `fs.realpathSync` to resolve symlinks before comparing paths. Crucially, it handles the edge case where a target file does not yet exist by resolving the nearest existing parent directory.
*   **Fail-Closed Design:** If a boundary violation is detected, the function throws a hard `[SECURITY_VIOLATION]` exception rather than returning a boolean, ensuring that the host tool immediately halts execution.
*   **Segment-Aware Path Matching:** The orchestrator correctly uses `path.relative` to determine folder containment (`isInsideFolder`). It avoids naive string prefix matching (`startsWith`), which would incorrectly allow access to `src/authz` when the locked scope is `src/auth`.

## 3. Anti-Looping Protocols

A common failure mode in agentic workflows is the infinite loop (e.g., a worker repeatedly proposing the same flawed code, and a verifier repeatedly rejecting it).

*   **Debrief Hashing:** The orchestrator computes a SHA-256 hash of the *canonical payload* (directory scope, sorted modified files, and the debrief text) after each worker execution.
*   **Registry and Collision Detection:** These hashes are stored in the `JobCard`. Before spawning a worker for a retry, the system checks for a hash collision. If a match is found, it proves the worker is stuck in a deterministic loop proposing the exact same solution. The orchestration engine correctly catches this, immediately terminates the loop branch, and escalates the job status to prevent further API waste.

## 4. Testing and Verification Approaches

Verification is baked into multiple tiers of the system.

*   **Verifier Subagent:** Every worker's output is immediately reviewed by an independent `Verifier` subagent scoped to the exact same directory.
*   **Playwright Integration:** Once all folder scopes are marked `VERIFIED`, the orchestrator natively attempts to run `npx playwright test` to ensure cross-boundary integration hasn't broken.
*   **Test-Fixer Subagent:** If Playwright fails, the system parses the failure log (extracting the failing specs using regex) and prepares a highly constrained context (the stack trace, failing spec paths, and the `README`/`ARCHITECTURE` diagrams) to spawn a specialized `Test-Fixer` subagent. This "need-to-know" scoping prevents the fixer from getting distracted by the entire codebase.

## 5. Code Quality, Type Safety, and Error Handling

The codebase (specifically the TypeScript implementation) exhibits high quality and strictness.

*   **Type Safety:** The code makes excellent use of TypeScript features, defining clear interfaces (`SubagentPayload`, `SubagentResult`, `JobCard`) and literal types (`AgentRole`, `JobStatus`). This ensures that the state machine transitions are type-checked at compile time.
*   **JSON Parsing Robustness:** In `surgical-orchestration.ts`, `parseSubagentResult` handles the reality of LLM outputs by using regex (`/```(?:json)?\s*([\s\S]*?)```/`) to extract the last balanced JSON object from markdown-fenced prose, rather than naively running `JSON.parse` on the raw output.
*   **Meaningful Errors:** Exceptions thrown by the system (e.g., `[NO_DISPATCHER]`, `[SCOPE_INVALID]`, `[SECURITY_VIOLATION]`) are highly descriptive and prefixed with clear tags, making debugging significantly easier.

## 6. Installation Script (`install.sh`)

The installation script is a straightforward, functional bash script.

*   **Safety Options:** It uses `set -euo pipefail` to ensure the script exits immediately if a command fails or an unset variable is referenced.
*   **Flexibility:** It respects the `HERMES_HOME` environment variable, allowing users to install skills into custom directories without hardcoding `~/.hermes`. It also supports installing a single skill via a command-line argument.
*   **Idempotency:** It safely creates directories (`mkdir -p`) and forcefully removes existing destinations (`rm -rf`) before copying, ensuring that re-running the script results in a clean, updated installation without leaving stale files behind.