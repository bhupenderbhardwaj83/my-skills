#!/usr/bin/env python3
"""Check text / background contrast (WCAG 2.x) for the calm-app-design tokens, or any pair.

    python3 contrast.py                 # check assets/tokens.css, both themes
    python3 contrast.py "#e6e9f0" "#0f1420"

Body text needs 4.5:1, large text (≥ 18 px, or 14 px bold) and icons 3:1.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def _lin(c: float) -> float:
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def ratio(fg: str, bg: str) -> float:
    a, b = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)


# (foreground, background, minimum) — what each token is used for.
CHECKS = [
    ("--text", "--bg", 4.5), ("--text", "--surface", 4.5), ("--text", "--surface-2", 4.5),
    ("--text-2", "--bg", 4.5), ("--text-2", "--surface", 4.5), ("--text-2", "--surface-2", 4.5),
    ("--text-3", "--bg", 4.5), ("--text-3", "--surface", 4.5), ("--text-3", "--surface-2", 4.5),
    ("--on-accent", "--accent", 4.5), ("--on-accent", "--accent-hover", 4.5),
    ("--accent-text", "--bg", 4.5), ("--accent-text", "--surface", 4.5),
    ("--success", "--surface", 4.5), ("--warning", "--surface", 4.5),
    ("--danger", "--surface", 4.5), ("--info", "--surface", 4.5),
    ("--border-strong", "--surface", 1.6), ("--focus", "--bg", 3.0),
    # chart series are graphics (3:1 against the card) — also used for legend text, so aim 4.5
    ("--chart-1", "--surface", 4.5), ("--chart-2", "--surface", 4.5),
    ("--chart-3", "--surface", 4.5), ("--chart-4", "--surface", 4.5),
    ("--sev-critical", "--surface", 4.5), ("--sev-high", "--surface", 4.5), ("--sev-medium", "--surface", 4.5),
    ("--sev-low", "--surface", 4.5), ("--sev-info", "--surface", 4.5),
]


def themes(css: str) -> dict[str, dict[str, str]]:
    out = {}
    for name, sel in (("dark", r':root\[data-theme="dark"\]'), ("light", r':root\[data-theme="light"\]')):
        block = re.search(sel + r"[^{]*\{(.*?)\n\}", css, re.S)
        if block:
            out[name] = dict(re.findall(r"(--[\w-]+):\s*(#[0-9a-fA-F]{6})", block.group(1)))
    return out


def main() -> int:
    if len(sys.argv) == 3:
        r = ratio(sys.argv[1], sys.argv[2])
        print(f"{r:.2f}:1  body {'ok' if r >= 4.5 else 'FAIL'} · large/icons {'ok' if r >= 3 else 'FAIL'}")
        return 0
    css = (Path(__file__).resolve().parent.parent / "assets" / "tokens.css").read_text()
    bad = 0
    for theme, t in themes(css).items():
        print(f"── {theme}")
        for fg, bg, need in CHECKS:
            if fg not in t or bg not in t:
                continue
            r = ratio(t[fg], t[bg])
            ok = r >= need
            bad += not ok
            print(f"  {'ok  ' if ok else 'FAIL'} {fg:15} on {bg:12} {r:5.2f}:1 (needs {need})")
    print("all pass" if not bad else f"{bad} failing pair(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
