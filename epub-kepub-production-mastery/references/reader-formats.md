# EPUB, Kobo, and Kindle delivery

## One source, target-aware outputs

Keep one editorial source of truth. Build standard EPUB 3 for general distribution and Kobo-compatible `.kepub.epub` only when Kobo's enhanced rendering path is a delivery target. KePUB is Kobo-specific; it is not a universal replacement for EPUB and should not be sent to Kindle as though the extensions were interchangeable.

Kindle workflows commonly accept EPUB as an input to Amazon conversion (including KDP and Send to Kindle workflows). Treat the converted Kindle book as a separate rendered target. Validate the EPUB with [Kindle Previewer](https://kdp.amazon.com/en_US/help/topic/G202131170) or the target Amazon workflow and review the converted result; an EPUB that opens on Kobo is not proof that the Kindle conversion preserves its layout. Check current [KDP format guidance](https://kdp.amazon.com/en_US/help/topic/G200634390) for publishing, and Amazon's separate Send to Kindle guidance for personal documents.

Kobo's [format support list](https://help.kobo.com/hc/en-us/articles/360017763713-File-formats-your-Kobo-eReader-and-Kobo-Books-app-support) documents EPUB 2 and EPUB 3 support and exceptions on older models. A `.kepub.epub` file may use Kobo-specific processing. Never claim that a KePUB package, a `koboSpan` convention, or static XML checks guarantee a particular stylus, annotation, or rendering feature on every Kobo device. Apply Kobo-specific spans only when the project's target workflow calls for them; wrap complete text blocks without splitting inline markup, reset any counters per content file, and parse every generated XHTML document.

Keep EPUB 3 packaging standards-based. Refer to the [W3C EPUB 3.3 Recommendation](https://www.w3.org/TR/epub-33/) for normative package and content requirements: `mimetype` is first in the ZIP archive and stored uncompressed; `META-INF/container.xml` points to the package document; the OPF manifest lists resources; the spine defines reading order; and EPUB navigation provides a linked table of contents. Include title, creator, language, stable identifiers, cover metadata, and appropriate accessibility metadata. Do not force fixed page layouts for ordinary text unless the book genuinely requires them.

## Validation layers

Run the reusable structural check:

```sh
python3 scripts/verify_epub.py book.epub
python3 scripts/verify_epub.py book.kepub.epub --require-kobo-spans
```

This checks ZIP ordering, XML well-formedness, package references, spine references, navigation, and internal links. It does not implement the complete EPUB specification. Also run EPUBCheck where available. For Kindle, preview the result using Kindle Previewer or the actual Amazon workflow. For Kobo, sideload the file and review the intended model or app. Keep successful tests and untested behaviors distinct in the release note.

## Cross-device reflow

Prefer semantic XHTML and simple CSS. Let readers control font size and use a single reflowable column. Avoid fixed widths, essential text embedded only in images, forced body colors that defeat dark mode, and wide tables. Wrap long code lines and give code blocks a readable monospace style. Test large type, narrow screens, dark mode, image scaling, links, and table behavior in target renderers.

Keep cover dimensions, fonts, Apple-specific metadata, KePUB span conventions, and any fixed-layout decisions in the book manifest as project settings. The local production default uses an original 1600×2400 JPEG cover, but check the selected retailer's current cover guidance before commercial publication.
