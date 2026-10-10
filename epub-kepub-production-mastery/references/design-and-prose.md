# Design, hierarchy, and teaching voice

## Page and image design

Design for reflow first. Use a quiet, consistent visual system with readable type, clear hierarchy, restrained accents, and enough white space to separate ideas. Do not force page breaks to imitate print pagination unless a dedicated plate or section opening benefits from one. Avoid repeated cards, banners, borders, and decorative labels that make every paragraph compete for attention.

Give each image a teaching job: explain a relationship, process, comparison, historical artifact, or decision. Place it beside the passage it supports. Use meaningful alt text; caption the source and the point the reader should take from it. Keep essential names, steps, and facts in nearby prose as well. Scale diagrams for a small e-reader screen and grayscale contrast. Avoid text-heavy wide infographics; split them into focused figures or redesign them as reflowable text.

For historical portraits, identify the person accurately and place the portrait with that person's story. Do not use generated likenesses as if they were documentary photographs. Keep image credits and licenses in an asset ledger; reader-facing caption/credit details should follow the asset license and the user's citation preference.

The workspace default cover is an original 1600×2400 JPEG with a clear title, optional concise subtitle, and **Bhupender Bhardwaj** as the author byline. Make the title readable at thumbnail size. Keep the composition calm and distinctive; avoid logos, brand marks, tiny text, and unrelated stock imagery. Treat this as a project default, not a retailer-independent technical requirement; check current distribution specifications for commercial release.

## Code blocks and command examples

Use semantic `<pre><code>` blocks for commands, source, and terminal output. Keep commands and output in separate blocks when that helps distinguish what the reader enters from what the system returns. Set a readable monospace size, compact padding, and wrapping (`white-space: pre-wrap` and `overflow-wrap: anywhere`) so long lines do not force horizontal scrolling. Preserve line breaks where they explain structure.

Put the explanation immediately beside the example. State what the command does, how important flags and shell quoting affect it, what output or state change to expect, and how to interpret common failure. Use a disposable lab path and a read-only inspection before privileged or destructive work. Label platform-specific behavior, sample placeholders, secrets, and commands that write data. Do not decorate every code block with a large title or repeat the same generic caution.

## Tables

Use a table only when comparing a small number of genuinely parallel properties. Keep it narrow enough to reflow at e-reader width. Use short column headings and semantic header cells. Avoid wide matrices, long prose in cells, nested tables, and screenshots of tables. Convert wide comparisons into short subsections, definition lists, or stacked field/value entries. Explain the key takeaway in prose so meaning does not depend on the table layout.

## Headings, numbering, chapters, and parts

Use one hierarchy throughout: **Part → Chapter → section → subsection**. Give each chapter one clear title that matches its TOC entry and actual topic. Use `h1` for chapter titles, `h2` for primary sections, and `h3` only when the section genuinely has subtopics. Avoid jumping heading levels, duplicating numbering, or carrying source-book numbers such as `6.1` into an unrelated new Chapter 2.

Choose one numbering scheme for chapters and sections and keep it consistent. Number chapters when it helps cross-reference or teach a sequence; section numbers are optional and should not overwhelm titles. Never combine unrelated source headings into a run-on title. Use “chapter” by default; use “module” only when the work is explicitly organized as modules and the term is consistent in the TOC, headings, and prose.

Divide a large book into editable parts of two or three related chapters, as described in [modular books](modular-books.md). A part is a production/editing boundary; it should not create repeated introductions, repeated history, or abrupt chapter endings. Include a brief opening orientation where needed and a forward bridge at chapter and part transitions.

## Content flow, insight, and fact checking

Sequence topics by what the reader must understand first, then by practical cause and effect. At a chapter opening, connect the current question to what the reader has already learned. Develop concepts in an order that makes each step useful for the next. Close with the implication that leads naturally forward. Revise transition sentences after moving or consolidating content; do not leave abrupt starts, dangling references, or conclusions that promise an absent section.

Write like a wise, experienced teacher: plain language, steady confidence, clear definitions, and memorable patterns grounded in correct explanations. Avoid pompous phrasing and address such as “my students,” “listen pupils,” or “dear learner.” Do not announce every paragraph with “what,” “why,” or “how”; answer those questions intrinsically, using explicit labels only when they help a reader navigate a complex explanation.

Be compact through precision and consolidation, not by squeezing away the reasoning. Preserve details needed to understand mechanisms, limits, variations, examples, and safe practice. Surface key ideas with occasional concise callouts or summary cues; reserve them for concepts readers should retain. Keep a glossary or quick reference for terms that recur, with links to the full explanation rather than a second competing lesson.

Include relevant history to show how a concept, tool, or practice evolved and why its present form matters. Verify dates, attribution, awards, and technical claims against primary or authoritative sources. Mark uncertainty. Tell historical events where they fit the topic sequence and give unique history one canonical home; later chapters can refer back briefly without retelling the whole story. Clearly distinguish a historical procedure from current guidance.
