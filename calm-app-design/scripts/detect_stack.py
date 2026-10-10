#!/usr/bin/env python3
"""Detect an app's stack and say how calm-app-design plugs into it.

    python3 scripts/detect_stack.py <project-folder>          # human summary
    python3 scripts/detect_stack.py <project-folder> --json   # for tools

Existing projects keep their stack. An empty / new folder prints the defaults to choose from
(see references/stacks.md).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SKIP = {"node_modules", ".git", "dist", "build", ".next", "target", "venv", ".venv", "__pycache__"}


def find(root: Path, name: str, depth: int = 3) -> list[Path]:
    out: list[Path] = []

    def walk(d: Path, level: int) -> None:
        if level > depth:
            return
        try:
            entries = list(d.iterdir())
        except OSError:
            return
        for e in entries:
            if e.name in SKIP:
                continue
            if e.name == name:
                out.append(e)
            if e.is_dir():
                walk(e, level + 1)

    walk(root, 0)
    return out


def node_deps(root: Path) -> dict[str, str]:
    deps: dict[str, str] = {}
    for pj in find(root, "package.json", 2):
        try:
            data = json.loads(pj.read_text())
        except (OSError, ValueError):
            continue
        for k in ("dependencies", "devDependencies"):
            deps.update(data.get(k) or {})
    return deps


def python_deps(root: Path) -> set[str]:
    names: set[str] = set()
    for fname in ("pyproject.toml", "requirements.txt", "requirements-dev.txt", "Pipfile", "setup.py"):
        for f in find(root, fname, 3):
            text = f.read_text(errors="ignore").lower()
            for pkg in ("fastapi", "flask", "django", "litestar", "starlette", "pywebview", "streamlit", "uvicorn"):
                if re.search(rf"\b{pkg}\b", text):
                    names.add(pkg)
    return names


def detect(root: Path) -> dict:
    deps = node_deps(root)
    py = python_deps(root)
    tauri = find(root, "tauri.conf.json", 3)
    has = lambda *names: any(n in deps for n in names)  # noqa: E731
    html_only = not deps and any(root.glob("*.html"))

    if tauri:
        conf = tauri[0].read_text(errors="ignore")
        kind, target = ("Tauri 2" if '"$schema": "https://schema.tauri.app/config/2' in conf or '"app"' in conf else "Tauri 1 (consider upgrading)"), "desktop"
        ui = "Next.js (static export)" if has("next") else "Vite + React" if has("react") else "web front end"
    elif has("electron"):
        kind, target, ui = "Electron", "desktop", "Vite + React" if has("react") else "web front end"
    elif "pywebview" in py:
        kind, target, ui = "pywebview (Python desktop window)", "desktop", "React build" if has("react") else "plain HTML"
    elif has("next"):
        kind, target, ui = "Next.js", "web", "React (App Router)" if find(root, "app", 2) else "React (Pages Router)"
    elif has("vite") and has("react"):
        kind, target, ui = "Vite + React SPA", "web", "React"
    elif has("react"):
        kind, target, ui = "React app", "web", "React"
    elif has("vue", "nuxt", "svelte", "@sveltejs/kit", "@angular/core", "solid-js"):
        fw = next(n for n in ("nuxt", "vue", "@sveltejs/kit", "svelte", "@angular/core", "solid-js") if n in deps)
        kind, target, ui = f"{fw} app", "web", "non-React"
    elif html_only:
        kind, target, ui = "plain HTML", "web", "vanilla"
    elif "streamlit" in py:
        kind, target, ui = "Streamlit", "web", "Streamlit (tokens only)"
    else:
        kind, target, ui = "new project", "unknown", ""

    backend = next((b for b in ("fastapi", "litestar", "flask", "django") if b in py), None)
    tailwind = has("tailwindcss")

    steps: list[str] = []
    if kind == "new project":
        steps += [
            "Decide the target from the request (references/stacks.md §2):",
            "  desktop → Tauri 2 + Vite + React + TS + Tailwind (Electron only if Node libraries are needed)",
            "  web     → Next.js App Router + TS + Tailwind (Vite SPA for internal tools; plain HTML for tiny pages)",
            "  Python backend → FastAPI (assets/fastapi/app.py); desktop: as a 127.0.0.1 sidecar with APP_TOKEN",
        ]
    elif ui in ("non-React", "Streamlit (tokens only)"):
        steps += ["Use assets/tokens.css (+ tailwind.preset.js if Tailwind) and port the patterns; React components don't drop in."]
    elif ui in ("vanilla", "plain HTML"):
        steps += ["Copy assets/vanilla/calm.css + calm.js and assets/tokens.css; use the data-* markup."]
    else:
        steps += [
            "Copy assets/react → src/components/calm and import from its index.ts.",
            "Add assets/tokens.css to the global CSS" + ("; add tailwind.preset.js to presets." if tailwind else "; install Tailwind 3 and add tailwind.preset.js."),
        ]
    if target == "desktop":
        steps.append("Read references/stacks.md §3–4 (desktop conventions). Use TitleBar, useShortcut, openExternal.")
        if kind.startswith("Tauri"):
            steps.append("Compare src-tauri config with assets/desktop/tauri (CSP, minimal capabilities, Overlay title bar).")
        if kind == "Electron":
            steps.append("Compare main/preload with assets/desktop/electron (contextIsolation, sandbox, no nodeIntegration, CSP).")
    elif target == "web":
        steps.append("Read references/stacks.md §3 and §5 (web conventions: URLs hold state, responsive, CSP headers).")
    if backend:
        steps.append(f"Backend: {backend} — read references/backend-fastapi.md; call it through createApi() / useApi.")
    steps.append("Finish: references/checklist.md + scripts/security_check.py " + str(root))

    return {"root": str(root), "stack": kind, "target": target, "ui": ui, "tailwind": tailwind, "python_backend": backend, "next_steps": steps}


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    root = Path(args[0] if args else ".").resolve()
    if not root.is_dir():
        print(f"Not a folder: {root}")
        return 2
    info = detect(root)
    if "--json" in sys.argv:
        print(json.dumps(info, indent=2))
        return 0
    print(f"Stack:   {info['stack']}  ({info['target']})")
    if info["ui"]:
        print(f"UI:      {info['ui']}{' · Tailwind' if info['tailwind'] else ''}")
    if info["python_backend"]:
        print(f"Backend: {info['python_backend']}")
    print("Next:")
    for s in info["next_steps"]:
        print(f"  {s}" if s.startswith("  ") else f"  • {s}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
