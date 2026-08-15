# AgentSurgery_Skills

A downloadable package of three Hermes Agent "surgical" skills, each in its own
folder so they can be installed independently or as a bundle.

## Contents

| Folder | Skill | Purpose |
|---|---|---|
| `surgical-HermesDotHealth/` | Hermes Folder Health Diagnostic | Diagnose `.hermes` bloat, stale files, cache, SQLite integrity |
| `surgical-implementation/` | Surgical Implementation | Plan-driven, auditable implementation pipeline (G&L Auditor V2) |
| `surgical-orchestration/` | Surgical Orchestration | Multi-folder subagent build orchestration (Worker+Verifier, Playwright) |

## Install

The skills are plain directories with a `SKILL.md` each. Copy the folder(s) you
want into your Hermes skills directory (`~/.hermes/skills/<category>/`).

### One-shot installer

```bash
# installs all three into your local ~/.hermes/skills
chmod +x install.sh
./install.sh
```

`install.sh` places each skill under the category directory it belongs to:
- `surgical-HermesDotHealth`  ->  `devops/`
- `surgical-implementation`   ->  `software-development/`
- `surgical-orchestration`   ->  `software-development/`

To install into a different Hermes home, set `HERMES_HOME`:

```bash
HERMES_HOME=/path/to/.hermes ./install.sh
```

To install a single skill:

```bash
./install.sh surgical-orchestration
```

## Verify

After install, confirm a skill loads:

```bash
hermes skills view surgical-orchestration
```

## Notes

- `surgical-orchestration` ships a `references/` tree (TypeScript engine, schema
  JSON, benchmark fixtures). It is a library + conventions, not a standalone
  binary; the host agent supplies the subagent dispatcher.
- All skills are MIT-licensed unless otherwise noted in their `SKILL.md`.
