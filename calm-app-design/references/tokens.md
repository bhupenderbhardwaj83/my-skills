# Tokens — colour, type, space

All values live in [../assets/tokens.css](../assets/tokens.css). Components never use raw hex.

## Colour roles

| Token | Use for | Never use for |
|---|---|---|
| `--bg` | the app background | cards |
| `--surface` | cards, panels, sections | the page itself |
| `--surface-2` | raised layers: popovers, dialogs, hovered rows | large areas |
| `--sunken` | side rail, inputs, wells, code | text backgrounds in light theme |
| `--border` / `--border-strong` | 1 px dividers / input outlines, focusable edges | text |
| `--border-subtle` | card edges and table row lines (paired with `--shadow-sm`) | inputs |
| `--chart-1…4`, `--chart-grid` | chart series (muted, AA-readable) and faint gridlines | UI chrome |
| `--text` | primary text, values | — |
| `--text-2` | secondary text, labels | long paragraphs of body copy |
| `--text-3` | hints, meta, timestamps (still AA) | anything the user must act on |
| `--text-disabled` | disabled controls only (not AA by design) | readable content |
| `--accent` | ONE primary action per view, selected state fills | decoration, large backgrounds |
| `--accent-text` | links, selected labels, active icons | body text |
| `--accent-soft` | selected row / chip background | — |
| `--success` `--warning` `--danger` `--info` | status meaning only (+ `-soft` tints) | branding |

Rules:
- At most **one accent hue per screen**; status colours only where they carry meaning.
- Meaning is never colour alone — pair it with an icon or word ("Low risk", ✓, ⚠).
- Elevation in dark mode = a lighter surface, not a heavier shadow. In light mode a soft shadow.
- Size/importance colour scales (like MVS Cleanup: green < 5 MB, yellow < 1 GB, amber < 5 GB,
  red above) use the status tokens, with a legend.

## Accent options (swap `--accent*` in both themes; re-run `scripts/contrast.py`)

| Name | Dark: accent / accent-text | Light: accent / accent-text | Feel |
|---|---|---|---|
| Orchid (default, MVS) | `#a64ab4` / `#e391e8` | `#9b3aa8` / `#8a2f97` | creative, warm |
| Teal | `#13827a` / `#5fd6c9` | `#0f766e` / `#0f6b64` | calm, utility |
| Indigo | `#5458d6` / `#a5a8ff` | `#4b4fd0` / `#4044bf` | focused, pro |
| Amber | `#a1620a` / `#f2bd55` | `#8f5600` / `#7f4c00` | friendly, energetic |

## Type

- Font: Inter (or the system UI font); mono: JetBrains Mono / SF Mono for code, times, sizes.
- Scale: 11 (tiny labels, badges) · 12.5 (hints) · **14 body** · 16 section · 20 page title.
  Dense desktop tools may use 13 px body — never smaller text the user must read.
- Weights: 400 body, 500 labels/buttons, 600 titles. Never 300 on dark backgrounds.
- `tabular-nums` for times, sizes, counters. Line length 60–80 characters for prose.

## Space and shape

- 8 px grid: 8 · 16 · 24 · 32 · 48 (4 px only for fine alignment inside controls). Cards 24 px
  inside; 24 px between cards and sections.
- Radius (standard Tailwind names): `rounded-md` 6 px inputs/chips · `rounded-lg` 8 px buttons/rows ·
  `rounded-xl` 12 px cards · `rounded-2xl` 16 px dialogs. One radius per component kind.
- Cards: 24 px padding (`p-6`), 24 px gaps (`gap-6`), `border-border-subtle` + `shadow-sm`.
- Hit targets ≥ 32 px tall on desktop, ≥ 44 px on touch.
- Motion 120–200 ms ease-out; nothing bounces; respect reduced motion.
