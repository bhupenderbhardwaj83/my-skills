#!/usr/bin/env python3
"""Quick security scan for an app built with calm-app-design (front end + Python backend).

    python3 scripts/security_check.py <app-folder>            # report; exit 1 if anything HIGH
    python3 scripts/security_check.py <app-folder> --all      # also show LOW (advice) findings

It is a fast pattern check, not a full audit: it catches the usual ways UI code and FastAPI apps
open holes (HTML injection, leaked secrets, tokens in localStorage, wide-open CORS, SQL built from
strings, unsafe iframes / links, spreadsheet formulas in CSV). Fix every HIGH; read every MEDIUM.
A line can opt out with a trailing comment `security-ok: <reason>` when it is a reviewed exception.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SKIP_DIRS = {"node_modules", ".next", "dist", "build", "out", ".git", "venv", ".venv", "__pycache__", "coverage", ".turbo", "target"}
WEB = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html", ".vue", ".svelte"}
PY = {".py"}
ENV = {".env", ".env.local", ".env.production", ".env.development"}

# (severity, regex, message) — regexes run per line
WEB_RULES = [
    ("HIGH", r"dangerouslySetInnerHTML(?!\s*=\s*\{\{\s*__html:\s*themeInitScript\b)", "dangerouslySetInnerHTML with something other than the constant themeInitScript — render text, or sanitise with DOMPurify first"),
    ("HIGH", r"\.(innerHTML|outerHTML)\s*\+?=\s*(?![\"'][^\"'$]*[\"']\s*;?\s*$)", "innerHTML / outerHTML from a variable or template — use textContent or build nodes"),
    ("HIGH", r"insertAdjacentHTML\s*\(|document\.write\s*\(", "HTML string injection — build DOM nodes or use textContent"),
    ("HIGH", r"(?<![\w.])eval\s*\(|new\s+Function\s*\(|set(Timeout|Interval)\s*\(\s*[\"'`]", "code from strings (eval / new Function / string timers)"),
    ("HIGH", r"(local|session)Storage\.setItem\s*\(\s*[\"'`][^\"'`]*(token|jwt|secret|password|passwd|api[_-]?key|auth|bearer|session|credential)", "credentials in Web Storage are readable by any injected script — use an HttpOnly cookie session or keep tokens in memory"),
    ("HIGH", r"NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PRIVATE|PASSWORD|API_KEY|TOKEN)", "NEXT_PUBLIC_ variables are shipped to every browser — keep secrets server-side"),
    ("HIGH", r"href\s*=\s*[\"'{`]\s*javascript:", "javascript: URL"),
    ("MEDIUM", r"target\s*=\s*[\"'{]_blank", "target=_blank — make sure rel=\"noopener noreferrer\" is on the same element"),
    ("MEDIUM", r"<iframe\b(?![^>]*\bsandbox\b)", "iframe without sandbox — use VideoTip (allow-listed hosts) or add sandbox + a host allow-list"),
    ("MEDIUM", r"postMessage\s*\([^)]*,\s*[\"']\*[\"']", "postMessage to any origin ('*') — name the target origin"),
    ("MEDIUM", r"addEventListener\s*\(\s*[\"']message[\"']", "message listener — check event.origin before using event.data"),
    ("MEDIUM", r"credentials\s*:\s*[\"']include[\"']", "cookies sent cross-origin — the backend must list exact origins (no '*') and check CSRF on writes"),
    # Electron
    ("HIGH", r"nodeIntegration\s*:\s*true|contextIsolation\s*:\s*false|sandbox\s*:\s*false|webSecurity\s*:\s*false|allowRunningInsecureContent\s*:\s*true", "unsafe Electron webPreferences — keep contextIsolation + sandbox on, nodeIntegration off (assets/desktop/electron)"),
    ("HIGH", r"exposeInMainWorld\([^)]*ipcRenderer\s*[,)]|exposeInMainWorld\([^)]*require\b", "preload exposes ipcRenderer / require — expose named functions on fixed channels only"),
    ("MEDIUM", r"^(?!.*[sS]afe).*shell\.openExternal\(", "shell.openExternal — allow only https / mailto URLs"),
    ("LOW", r"[\"'`]http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|www\.w3\.org)", "plain http:// URL — use https outside local development"),
    ("LOW", r"console\.(log|debug)\([^)]*(token|password|secret|authorization)", "logging something that looks secret"),
]
PY_RULES = [
    ("HIGH", r"allow_origins\s*=\s*\[\s*[\"']\*[\"']\s*\]", "CORS allow_origins=['*'] — list the real front-end origins (required with credentials)"),
    ("HIGH", r"allow_origin_regex\s*=\s*[\"']\.\*", "CORS regex matching every origin"),
    ("HIGH", r"\.(execute|exec_driver_sql|raw|text)\s*\(\s*f[\"']|\.(execute|raw)\s*\([^)]*%\s*\(|\.(execute|raw)\s*\([^)]*\.format\(", "SQL built from strings — bind parameters (SQLAlchemy where(), :name params)"),
    ("HIGH", r"subprocess\.\w+\([^)]*shell\s*=\s*True|os\.system\s*\(", "shell command — pass an argument list, never user input to a shell"),
    ("HIGH", r"pickle\.loads?\s*\(|yaml\.load\s*\((?![^)]*SafeLoader)|marshal\.loads", "unsafe deserialisation"),
    ("HIGH", r"verify\s*=\s*False", "TLS verification turned off"),
    ("HIGH", r"(?<![\w.])eval\s*\(|(?<![\w.])exec\s*\(", "eval / exec"),
    ("MEDIUM", r"\bdebug\s*=\s*True|uvicorn\.run\([^)]*reload\s*=\s*True", "debug / reload on — keep it to development"),
    ("MEDIUM", r"set_cookie\((?![^)]*samesite)", "cookie without samesite= (and secure=True in production; httponly=True for sessions)"),
    ("MEDIUM", r"(FileResponse|open)\s*\([^)]*(request\.|path_param|filename)", "file path from the request — resolve it and check it stays inside the allowed folder"),
    ("MEDIUM", r"HTMLResponse\s*\(\s*f[\"']", "HTML built from an f-string — escape values (html.escape) or use a template engine with autoescape"),
    ("LOW", r"except\s+Exception[^:]*:\s*\n?\s*return[^\n]*(str\(e\)|repr\(e\)|traceback)", "error details returned to the client"),
]
TAURI_RULES = [
    ("HIGH", r'"csp"\s*:\s*null', "Tauri CSP disabled — set app.security.csp (assets/desktop/tauri/tauri.conf.json)"),
    ("HIGH", r'"dangerous[A-Za-z]*"\s*:\s*true', "a Tauri 'dangerous…' option is on"),
    ("HIGH", r'"shell:allow-execute"|"shell:default"', "shell execute permission — use a sidecar with fixed args instead"),
    ("HIGH", r'"\$HOME/\*\*"|"fs:default"|"fs:allow-[a-z-]*-recursive"|"\*\*"', "broad file-system scope — limit fs to the app's own folders"),
    ("MEDIUM", r'"withGlobalTauri"\s*:\s*true', "withGlobalTauri exposes the API to every script — import @tauri-apps/api instead"),
]
SECRET_RULES = [
    ("HIGH", r"sk-(live|proj|ant)?-?[A-Za-z0-9_-]{20,}", "API key in source"),
    ("HIGH", r"AKIA[0-9A-Z]{16}", "AWS access key in source"),
    ("HIGH", r"gh[pousr]_[A-Za-z0-9]{30,}", "GitHub token in source"),
    ("HIGH", r"xox[abpr]-[A-Za-z0-9-]{10,}", "Slack token in source"),
    ("HIGH", r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----", "private key in source"),
    ("HIGH", r"(?i)(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*[\"'][^\"'\s]{12,}[\"']", "hard-coded secret — load it from the environment"),
]


def files(root: Path):
    for p in root.rglob("*"):
        if any(part in SKIP_DIRS for part in p.parts) or not p.is_file() or p.resolve() == Path(__file__).resolve():
            continue  # (and not this checker: its rule patterns would match themselves)
        if p.suffix in WEB | PY or p.name in ENV or is_tauri_json(p):
            yield p


def is_tauri_json(p: Path) -> bool:
    return p.suffix == ".json" and (p.name.startswith("tauri.") or "capabilities" in p.parts or p.name.startswith("capabilities"))


def scan(root: Path) -> list[tuple[str, Path, int, str, str]]:
    found = []
    csv_files: list[Path] = []
    guarded = False
    for p in files(root):
        try:
            text = p.read_text(errors="ignore")
        except OSError:
            continue
        if p.name in ENV:
            found.append(("MEDIUM", p, 1, f"{p.name} exists — make sure it is in .gitignore and never bundled", ""))
            continue
        rules = (TAURI_RULES if p.suffix == ".json" else WEB_RULES if p.suffix in WEB else PY_RULES) + SECRET_RULES
        lines = text.splitlines()
        for n, line in enumerate(lines, 1):
            if "security-ok" in line or line.lstrip().startswith(("//", "#", "*")) and "eval" not in line:
                continue
            for sev, rx, msg in rules:
                if re.search(rx, line):
                    near = " ".join(lines[max(0, n - 3): n + 3])
                    if ("target" in rx and "noopener" in near) or ("iframe" in rx and "sandbox" in near):
                        continue  # the attribute is on a neighbouring line of the same element
                    found.append((sev, p, n, msg, line.strip()[:120]))
        if re.search(r"text/csv|\.csv[\"'`]", text):
            csv_files.append(p)
        if re.search(r"\[=\+\\?-@|=\+\\-@|formula", text, re.I):
            guarded = True
    # CSV exports should neutralise formulas (=, +, -, @) — see DataTable.toCsv / csv_cell.
    # The guard may live in a shared helper, so look across the whole project.
    if csv_files and not guarded:
        found += [("MEDIUM", p, 1, "CSV export without a formula-injection guard (prefix = + - @ cells with ')", "") for p in csv_files]
    return found


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2
    root = Path(args[0]).resolve()
    show_low = "--all" in sys.argv
    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    found = sorted(scan(root), key=lambda f: (order[f[0]], str(f[1]), f[2]))
    shown = [f for f in found if show_low or f[0] != "LOW"]
    for sev, p, n, msg, src in shown:
        print(f"{sev:6} {p.relative_to(root)}:{n}  {msg}" + (f"\n         {src}" if src else ""))
    counts = {s: sum(1 for f in found if f[0] == s) for s in order}
    print(f"\n{counts['HIGH']} high · {counts['MEDIUM']} medium · {counts['LOW']} low" + ("" if show_low else " (--all shows low)"))
    if not found:
        print("No known risky patterns found. Still review auth, authorisation and input limits by hand.")
    return 1 if counts["HIGH"] else 0


if __name__ == "__main__":
    sys.exit(main())
