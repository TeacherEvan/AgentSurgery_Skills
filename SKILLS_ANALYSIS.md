# Skills Analysis

This document provides an investigation of the three individual skills in the repository: `surgical-HermesDotHealth`, `surgical-implementation`, and `surgical-orchestration`.

## 1. surgical-HermesDotHealth

*   **Goal:** Diagnose `.hermes` folder health, size, bloat, cache issues, and stale files.
*   **Method:** Utilizes standard Unix utilities (such as `du`, `find`, `grep`) and `sqlite3` to measure directory sizes, identify large or stale files (>90 days), check database integrity (`PRAGMA integrity_check`), and find orphaned processes. It also runs `hermes doctor` to capture connectivity and configuration errors.
*   **Accuracy:** High. By relying on native file system tools and database pragmas, the metrics and health statuses retrieved are exact and authoritative representations of the system state.
*   **Practicality:** Very high. It offers immediate value by addressing common issues like disk space exhaustion and cache bloat on platforms ranging from Linux to Termux, with clear reporting templates.
*   **Recommendations:**
    1.  **Automated Safe Cleanup:** Introduce an interactive wizard or an `--auto-fix` flag to automatically execute safe cleanup actions (e.g., clearing cache, old logs) rather than relying purely on manual copy-pasting of commands.
    2.  **Backup Integration:** Automatically generate a backup archive of configuration files (`.yaml`, `.json`) before any cleanup action is taken.
    3.  **Structured Log Parsing:** Implement a parser for the `hermes doctor` output that extracts and highlights only the actionable warnings and errors, reducing noise for the user.

## 2. surgical-implementation

*   **Goal:** Provide a plan-driven, evidence-backed, and auditable software implementation pipeline wrapping the G&L Auditor V2 governance model.
*   **Method:** Scans the `docs/` folder for plan files. If found, it uses the plan as the execution prompt for the `surgical-orchestration` skill (Worker+Verifier loop). Upon completion, it runs `code-review` and feeds critical findings back into orchestration as new tasks.
*   **Accuracy:** High. The workflow enforces strict approval gates, requires traceability of every objective to evidence (e.g., tests), and utilizes an independent final audit to ensure objectives are genuinely met without regressions.
*   **Practicality:** High for complex, multi-agent builds requiring high reliability and traceability. However, it is deliberately heavy-handed and not intended (or practical) for simple one-line bug fixes.
*   **Recommendations:**
    1.  **Enhanced Markdown Parsing:** Improve the plan file parser to seamlessly handle a wider variety of Markdown checkboxes (e.g., Unicode checkmarks like ✅ or ☑) in a single pass to avoid missing objectives.
    2.  **Configurable Governance Strictness:** Allow users to define a "mode" (e.g., `strict`, `relaxed`) to bypass certain approval gates when developing locally or in non-production environments.
    3.  **CI/CD Artifact Export:** Build in native support to export the generated evidence artifacts (e.g., `TRACEABILITY.md`, `SECURITY.md`) in formats readily consumable by CI/CD pipeline summary pages.

## 3. surgical-orchestration

*   **Goal:** Coordinate code changes across multiple directory boundaries using strict scope locking, bounded concurrency, loop prevention, and verification.
*   **Method:** Parses a build plan into directory-scoped jobs. It spawns Worker and Verifier subagents (max 2 concurrent) that are hard-locked to their assigned paths. It uses SHA-256 debrief hashing to prevent infinite loops and runs a Playwright test suite to validate the final orchestrated output.
*   **Accuracy:** High. The architecture strictly isolates scope at the tool layer (preventing hallucinations from corrupting external files) and employs cryptographic hashing to guarantee loop detection and deduplication.
*   **Practicality:** Very high for large refactors. By compacting the orchestrator's context window before each subagent spawn and enforcing "need-to-know" scopes, it saves token limits and prevents context collapse.
*   **Recommendations:**
    1.  **Dynamic Concurrency Limits:** Allow the maximum active subagent concurrency (currently hardcoded to 2) to be dynamically adjusted based on available system resources or API rate limits.
    2.  **Pluggable Test Runners:** Expand the final verification step beyond Playwright to support other test runners (e.g., Jest, PyTest, Cargo) dynamically based on the repository's native stack.
    3.  **Visual Progress Dashboard:** Implement an interactive terminal UI (TUI) or web-based dashboard to visualize the state machine (JobCard), active workers, and folder scopes in real-time.
