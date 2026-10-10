# Modular book planning and assembly

## Choose single or modular production

Use word count and chapter count as planning signals, not hard laws. EPUB page count is not a useful cutoff: the same reflowable book changes page count with screen size, font, margins, and reader software.

| Planning signal | Default choice |
| --- | --- |
| Up to about 35,000 words and up to 6 chapters, with a manageable source set and one review cycle | One editable manuscript and one build |
| More than about 60,000 words, more than 10 chapters, or a complex source corpus (for example, 3+ substantial books or 100+ source sections to map) | Plan as a large, modular book |
| Roughly 35,000–60,000 words or 7–10 chapters | Decide from source count, number of topics, revision cadence, build/review time, and whether chapters naturally group into related sets |

Any one large-book signal can justify parts. Many independently revised chapters, three or more substantial sources, more than 100 mapped source sections, long builds that impede review, or an editorial process that approves sections over time are strong reasons to split. In the borderline band, default to one manuscript when there is no clear editing benefit to splitting. Honor the user's explicit preference when they specify one format. Record the decision and its reason in the manifest so future revisions use the same model.

These thresholds describe editing and production units, not how many reader-facing volumes to publish. A single final EPUB can be assembled from modular sources. Conversely, a short reference work may be split when a user or team needs separate deliverables.

## Plan before drafting

For a small book, keep a single editable source and a compact chapter map. For a large book, first inventory the sources, topics, examples, exercises, images, and dependencies. Map each source unit to a planned chapter and disposition before writing. A source unit is covered only when its essential ideas and useful details have a destination; copying many words is not a coverage measure.

Group large books into named parts containing two or three related chapters. Choose boundaries by learning sequence and topic relationship, not by equal word counts. Use stable names such as `<Book>-part-1`. Maintain a book-level manifest with chapter order, titles, part membership, source coverage, shared styles, and current build state. Keep exactly one authoritative editable source for each chapter.

Each part should be independently editable and buildable, with its own title page, local contents, chapter sequence, shared design assets, and validation. Rebuilding navigation or package files must preserve edited chapter sources. Keep chapter numbering consistent across parts. Do not repeat a unique history or explanation at every part boundary; use a short bridge and a link to the canonical treatment.

## Preserve depth and flow

Do not compress a large source corpus into a brief survey unless the user requests a summary. Preserve concepts, examples, commands, meaningful caveats, and exercises. Consolidate genuine repeats at one canonical location and cross-reference it. Track every source unit as included, consolidated, intentionally omitted, or replaced, with a reason.

Give the whole book a throughline. Each chapter opens by connecting to the reader's prior question, develops one coherent set of ideas, and ends by preparing the next topic. Section transitions should explain why the next idea follows. Avoid abrupt endings, orphan headings, duplicate history, mixed heading hierarchies, and source-book chapter numbering embedded in the new hierarchy.

## Build and assemble

Treat parts as the editing and review units. Do not assemble a combined book until the user requests or approves that step. On assembly, derive one hierarchical EPUB 3 TOC from the approved manifest. Keep spine and heading order consistent, remove duplicate front matter, preserve clear part boundaries where they aid orientation, and add discreet navigation links between chapters and back to contents. Build a unified alphabetical or topic quick reference with working links to canonical lessons.

After assembly, verify that all part chapters occur once in the intended order, all internal links resolve across part boundaries, the global TOC and quick reference work, and no unique content was lost or duplicated. Compare the combined edition's text to the approved part sources. Report part and combined counts separately.

Use [the manifest template](../templates/book-manifest.json), [coverage ledger template](../templates/source-coverage.csv), and [part review record](../resources/part-review-template.md). `init_ebook_project.py` creates missing chapter and part scaffolds from the manifest while preserving existing files. The `validate_coverage.py` script checks that source units have explicit dispositions and that included units point to a destination.
