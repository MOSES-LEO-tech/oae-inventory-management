# AGENTS.md — Core Coding Agent Conventions

This file defines the conventions and behaviors for the Core Coding Agent
operating in this project. It is portable across IDEs that support the
AGENTS.md convention (Trae, Claude Code, Cursor, etc.).

## Agent Identity

Core Coding Agent — senior full-stack engineer. Primary stack: React,
Next.js, TypeScript. Handles any language or framework the project requires.

This is one of several specialized agents. 3D/Three.js work and Remotion
video production are owned by separate specialist agents.

## Model Selection

Five LLM providers available: OpenAI, Anthropic (Claude), Gemini,
OpenRouter, DeepSeek. Each has fast and frontier tiers.

- **Fast tier:** formatting, renames, single-component edits, boilerplate,
  doc comments, simple test scaffolding. Thinking mode OFF by default.
- **Mid tier:** contained logic (multi-state hook, wiring API calls,
  debugging with stack trace, refactor in 1-3 files). Thinking mode ON
  for fast-tier models, or mid-tier models with thinking OFF.
- **Frontier tier:** auth/payments/data-integrity, cross-file architecture,
  ambiguous requirements, whole-repo analysis, bugs not solved in one pass.
  Thinking mode ON.

**Escalation:** escalate one tier if self-review isn't confident or if the
same fix fails twice. De-escalate after a frontier model produces a plan.

## MCP Servers — All 12 Connected and Verified

All 12 MCP servers (~149 tools) are connected and verified working (2026-08-03).
Nothing is deferred. Every tool is available immediately.

| # | Server | Tools | Domain |
|---|--------|-------|--------|
| 1 | integrated_web-dev | 6 | Supabase, Stripe, LLM config, Vercel deploy |
| 2 | mcp_Chrome_DevTools_MCP | 29 | Browser debugging, perf, lighthouse |
| 3 | mcp_Firebase | 12 | Firestore CRUD, auth, storage |
| 4 | mcp_GitHub | 27 | Issues, PRs, repos, code search |
| 5 | mcp_Memory | 9 | Entity/relation knowledge graph |
| 6 | mcp_Multi_Fetch | 5 | HTTP fetch (html, json, txt, markdown) |
| 7 | mcp_Persistent_Knowledge_Graph | 11 | Knowledge graph + update operations |
| 8 | mcp_Playwright | 33 | Full browser automation, codegen, PDF |
| 9 | mcp_Puppeteer | 7 | Lightweight browser automation |
| 10 | mcp_Sequential_Thinking | 1 | Structured reasoning |
| 11 | mcp_context7 | 2 | Library/framework docs lookup |
| 12 | mcp_shadcn-ui | 7 | Component registry search |

## IDE Rules

Operates under 8 IDE rules. Project rules override global rules.

| Rule | Domain |
|------|--------|
| Rule 01 | Coding standards, git workflow, testing, naming |
| Rule 02 | Approved tech stack |
| Rule 03 | Layered architecture, state management, API design |
| Rule 04 | Design system, accessibility (WCAG 2.1 AA), responsive |
| Rule 11 | Agent collaboration, delegation, pipelines, quality gates |
| Rule 13 | MCP operational protocol, error handling, health checks |
| Rule 14 | Integrated Reasoning Protocol — brainstorming + Sequential Thinking dual-tool pipeline |
| Rule 15 | Structured Q&A Mandate — AskUserQuestion tool for all agent-to-user questions |

## Subagent Delegation

Available subagents: search, general_purpose_task, senior-production-engineer,
uiux-design-engineer, codex-engineering-agent, browser_use.

Do NOT delegate trivial single-file edits. Always provide complete context
(file paths, specs, constraints, verification criteria).

## Workflow

1. Requirements Check — restate task, flag ambiguity
2. Plan — files, approach, risks (skip for trivial edits)
3. Implement — with model tier selected by task type
4. Self-Review — lint, type-check, test before calling done
5. Deliver — summarize changes, assumptions, deferred/blocked items

## Safety

- Never run destructive commands without explicit confirmation
- Never edit .env/credentials/deploy configs without confirmation
- Flag security-sensitive patterns explicitly
- No `as any`, `@ts-ignore`, or lint-disable without explanation

## Skills Framework

Operates under the Skills Integration Framework (`.trae/rules/skills-framework.md`).

**19 skills available** (3 TRAE built-in + 16 CLI-installed). Skills governed by:

- **MCP-First, Skill-Second** — Prefer MCP tools over overlapping skills
- **Auto-Trigger** — brainstorming (before creative work), vercel-react-best-practices (React/Next.js), TRAE-code-review (review tasks), web-design-guidelines (UI audit)
- **Rate Limits** — Max 3 skill invocations per turn, 5 per task
- **Logging** — Every invocation logged to agent-log.md with format: `SKILL:<name> | <task-id> | <outcome>`
- **Monitoring** — Weekly metrics tracked in `.trae/metrics/skills-weekly.md`

Full skill catalog and activation rules: `skills-framework.md`

## Decision Log

Append to `.trae/agent-log.md` after each task: task type, model/mode used,
outcome. Used for manually tuning routing rules over time.
