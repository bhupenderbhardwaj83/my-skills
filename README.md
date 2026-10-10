# My agent skills

Two [Agent Skills](https://agentskills.io) — folders with a `SKILL.md` plus references, templates and
scripts — that work in Claude Code, Codex, Cursor and Antigravity.

| Skill | What it does |
|---|---|
| [`calm-app-design`](calm-app-design/) | House style and stack guide for desktop and web apps: calm, minimal, readable light/dark UI, keyboard-first, progressive disclosure. Picks Tauri / Electron for desktop and Next.js / Vite / plain HTML for web, with ready-made React components (tables, ⌘K palette, filter chips, charts, graphs, detail sub-window, AI assistant), a typed FastAPI client with a tested example backend, and stack-detection and security-check scripts. |
| [`epub-kepub-production-mastery`](epub-kepub-production-mastery/) | Plan, write, revise, package and verify reflowable EPUB / KePUB books for Kobo and Kindle, including modular production of long books, with coverage tracking and EPUB verification scripts. |

## Install

Copy a skill folder into your agent's skills directory, then restart the agent.

| Agent | Folder |
|---|---|
| Claude Code | `~/.claude/skills/<skill>/` (Cursor reads this folder too) |
| Codex | `~/.codex/skills/<skill>/` |
| Antigravity | `~/.gemini/config/skills/<skill>/` (older builds: `~/.gemini/antigravity/skills/`) |
| Cursor | `~/.cursor/skills/<skill>/` (only if you don't use `~/.claude/skills`) |

```bash
git clone <this-repo-url> my_skills
cp -R my_skills/calm-app-design ~/.claude/skills/
cp -R my_skills/epub-kepub-production-mastery ~/.claude/skills/
```

`calm-app-design/scripts/sync_to_agents.sh` copies an installed skill to Codex and Antigravity.

## Use

Just ask for the work — the skills load from their descriptions:

- "Build a small Mac app to track my invoices" → `calm-app-design` (desktop, Tauri)
- "Make the admin web page for my FastAPI service" → `calm-app-design` (web, Next.js)
- "Turn these three books into a 40,000-word EPUB for Kobo" → `epub-kepub-production-mastery`

## Requirements

Scripts need Python 3.10+. `calm-app-design`'s React components need React 18+, TypeScript and
Tailwind 3; the example backend needs FastAPI. The ebook skill uses its own Python scripts.

## Licence

[MIT](LICENSE) © Bhupender Bhardwaj
