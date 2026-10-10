# Patterns — layout and components

Recipes drawn from Mizu Video Studio. Class names assume the Tailwind preset; plain CSS works the
same with the variables.

## App shell

The ready-made versions live in `assets/react` and `assets/vanilla` — see components.md.

- **Left rail** (64–76 px, `bg-sunken`): icon + short label per workspace; active item
  `bg-surface-2` + accent-coloured icon. Utilities (Cleanup, Setup) pinned to the bottom.
- **Header** (40–44 px): app name, current area, service/status dots, one global action.
- **Content**: scrolls independently; reading pages centred `max-w-3xl`, tools full width.
- **Sticky action bar** at the bottom for the page's primary action (Generate, Clean up),
  with a one-line summary of what will happen on the left.
- Workspaces stay mounted when switching (state survives); hide with `hidden`, don't unmount.

## Progressive disclosure

- **Numbered sections** ("1 Scenes · 2 Voice-over · 3 Music"): collapsed rows show a one-line
  summary of the current choice ("No music · 1 scene song"); click to expand. Only one or two
  open at a time.
- **Hover/click trays** for tool groups; **"More…"** for advanced options; **Review ▸** to see
  the items behind a summary number.
- Defaults are chosen so the simple path needs zero changes. Show a setting only when it
  applies (e.g. "If the clip is shorter than narration" only for videos).
- A **None / Plain** option first in every gallery of styles or templates.

## Controls

- **Buttons**: primary = `bg-accent text-accent-on` (one per view); secondary = `ring-1
  ring-border hover:bg-surface-2`; quiet = text only `text-text-2 hover:text-text`.
  Destructive = `text-danger` (quiet) or `bg-danger` only inside a confirmation.
  Icon + verb label: "✂ Cut…", "● Record screen". Ellipsis when it opens something.
- **Segmented control** for 2–5 exclusive options (`rounded-lg bg-surface-2 p-0.5`, selected
  segment `bg-accent-soft text-text`). Prefer it over a select for ≤ 5 options.
- **Toggles**: On/Off segmented pair for clear state; checkbox + one-line hint for options lists
  ("Zoom in on clicks — moves in close where you click").
- **Sliders** with the live value and unit beside them; reset link when changed.
- **Inputs**: `bg-sunken border border-border rounded-sm`, placeholder = an example, not
  the label.

## Lists that grow

Search box first (with `/` shortcut and the hint in the placeholder) → filter chips → list.
Rows: title in `text`, detail in `text-3`, meta right-aligned `tabular-nums`. Selected row
`bg-accent-soft`. Multi-select with checkboxes; a plain click selects one.
Empty states: what is missing + the action that fixes it ("No windows found — open the app you
want to record, then refresh"). Never a bare "No results".

## Direct manipulation

- Media: trim on a **waveform / filmstrip** with draggable handles, times at the edges,
  ▶ play just the selection; split with **S**, gaps with their own handles, undo ⌘Z.
- Placement: click a corner of a mini preview frame instead of a position dropdown.
- Reorder: drag **and** visible ‹ › buttons. Scrolling strips get ‹ › arrows.

## Feedback

- **Progress** for anything > 1 s: a thin bar + stage name + elapsed/ETA; never freeze the UI.
  Long work runs in the background with a Stop button.
- **Toasts / inline notes** for results: what happened + how to undo or what to do next.
- **Errors** in plain words with a fix button where possible ("Restart services").
- **Confirmations** only for destructive or outward actions. Show exactly what will happen,
  graded by risk (Low = rebuilt automatically, Medium = can be made again, High = the user's own
  work), what is deleted vs moved to Trash, and keyboard hints (Esc / ↵).

## Dialogs and overlays

`bg-overlay` backdrop with blur, dialog `bg-surface-2 rounded-2xl shadow-calm`, max ~440 px for
forms. Title, short body, actions right-aligned (Cancel quiet, primary last). Esc closes;
focus starts on the first field (or the safe action for destructive dialogs).

## Keyboard map (show the relevant hints in context)

| Key | Action |
|---|---|
| ← → ↑ ↓ | move selection / step (⇧ = bigger step) |
| Enter / Space | choose / play-pause |
| Esc | close, cancel, step back |
| / | focus search |
| ⌘/Ctrl Z, ⇧⌘Z | undo, redo |
| ⌘/Ctrl ↵ | apply / run the primary action |
| Tab | next control or item, in reading order |
| Delete / ⌫ | remove the selected item (with undo) |

Shortcuts must not fire while typing in an input; dialogs capture keys first.

Entrance animations slide (transform) but never fade from transparent: browsers pause
animations in hidden tabs and some capture tools, and a panel frozen at opacity 0.6 is unreadable.
