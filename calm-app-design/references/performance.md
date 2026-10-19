# Fast and light — speed, accuracy, and careful use of memory, CPU/GPU and disk

Calm apps feel instant and stay light. Priority order when they conflict: **speed of the app →
accuracy → user experience → security → memory and CPU/GPU → disk.** A little more disk is fine
when it buys a faster, smoother app; never the other way round. Measure before and after every
optimisation and say the numbers — no "should be faster".

## Contents
1. Budgets
2. Never block the screen
3. Do only the work that changed
4. Use the GPU where it actually helps
5. Memory
6. Startup and disk
7. Accuracy of every shortcut
8. How to measure

## 1. Budgets

| Moment | Target |
|---|---|
| Typing, dragging, hovering | next frame (≤ 16 ms of work per event) |
| A click's visible response | ≤ 100 ms (show something — a pressed state, a spinner — within it) |
| Re-render after an edit | ≤ 50 ms, whatever the document size |
| Anything over ~300 ms | runs in the background with progress **and** a Stop (Esc) |
| App start to usable | ≤ 1 s; heavy pages and libraries load on first use |

## 2. Never block the screen

- Long work runs off the UI thread: a Web Worker (pure JS: parsing, layout maths, zips), a
  backend task (Rust `spawn_blocking`, Python thread pool), or — when it needs the DOM (SVG → image)
  — in chunks that **yield between steps** (`await requestAnimationFrame`) so the screen repaints
  and a Stop lands.
- Every long task takes an `AbortSignal`, reports `onProgress(done, total)`, and frees what it
  allocated in `finally` (also when stopped).
- Debounce what follows typing (≈ 150–300 ms); coalesce bursts into one job; let a newer job
  supersede an older one (generation counter) instead of queueing both.
- Drag feedback never re-renders the document: move the drawn element with a CSS / SVG
  `transform` (GPU-composited) and commit once on release.

## 3. Do only the work that changed

- **Cache by content, not by time.** Key each piece (a slide, a card preview, a parsed file) by
  everything that shapes its output (its own data + the document-wide inputs: theme, fonts, page
  size, position-dependent bits like page numbers). Reuse unchanged pieces; rebuild only misses.
- **Batch.** Many small requests made together (gallery thumbnails) become one job.
- **Read once.** One parse of a file feeds every view of it (preview *and* analysis) — never two
  libraries reading the same bytes.
- Keep render functions stable (pass render *functions*, not components created inline) so
  React doesn't remount — and redo — everything on each parent render.
- Caches are bounded (LRU, a few dozen to a few hundred entries) and cleared when their context
  changes (another document opened).

## 4. Use the GPU where it actually helps

Moving work to the GPU only helps when that work is the bottleneck. Already GPU in a web view:
compositing, CSS / SVG transforms and opacity, `<canvas>` 2D drawing, image decoding and scaling,
video playback. Use those paths:

- Animate and drag with `transform` / `opacity`, not layout properties.
- Rasterise with `<canvas>` (and `OffscreenCanvas` in a worker where the engine allows it).
- Decode pictures once (`createImageBitmap` / one blob URL per content) and let the GPU scale.
- Video: hardware encoder first (VideoToolbox on macOS, NVENC / QSV elsewhere), CPU encoder as the
  automatic fallback — same quality settings.
- Local AI: run on the GPU (Metal / MLX on Apple Silicon, CUDA elsewhere); unload the model after
  idle (keep-alive of minutes, not forever); call it only when it adds something (open-ended
  notes), never for what plain code does well.
- CPU-bound logic (parsing, layout) is fastest made *smaller* (incremental, cached), not moved.

## 5. Memory

- Release big buffers deliberately: `canvas.width = canvas.height = 0` after use,
  `URL.revokeObjectURL` for blob URLs no view shows any more, close workbooks / files in
  `finally`.
- One copy of each picture: content-keyed blob URLs, never base64 strings kept around per render.
- Refuse oversize input **before** loading it (check sizes from headers / zip directories; cap
  rows, cells and pixels) — with a message that says how to make it smaller.
- Long lists render only what's visible (virtualise beyond ~200 rows); previews only for cards on
  screen.
- Watch for leaks: listeners, intervals and observers removed on unmount; per-session maps capped.

## 6. Startup and disk

- Lazy-load heavy pages, editors and libraries (`lazy(() => import(...))`, imports inside the
  Python function that needs them).
- Lean runtimes: pick the smallest library that does the job (e.g. openpyxl over pandas+numpy for
  reading workbooks); no build tools (pip, setuptools) inside shipped runtimes; no download caches
  left on users' machines; one font format (woff2).
- Previews held in memory uncompressed (fast); exports compressed (small).
- Give users a Cleanup view for what the app leaves behind (logs, caches, leftovers) — by risk,
  with sizes, nothing deleted without a click.

## 7. Accuracy of every shortcut

A cache, a batch or an incremental path must give **exactly** what the slow path gives. Prove it
with a test that compares the fast result to a full rebuild (minus volatile ids), including the
position-dependent parts (numbering, cross-references). Keep a byte-parity test when output must
match another system.

## 8. How to measure

- UI: `performance.now()` around the work; a 16 ms interval timer during long tasks records the
  longest pause; React Profiler for re-render counts.
- Backend: `python -X importtime`, `time.perf_counter`, `resource.getrusage(...).ru_maxrss` for
  peak memory; Rust: `Instant::now()`.
- Disk: `du -sh` of bundles and runtimes before and after.
- Report before → after numbers with every optimisation, and what was *not* measured.
