#!/usr/bin/env python3
"""Check common EPUB package invariants; this is not a complete EPUB conformance checker."""
from __future__ import annotations

import argparse
import posixpath
import sys
import urllib.parse
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

OPF = "http://www.idpf.org/2007/opf"
DC = "http://purl.org/dc/elements/1.1/"
EPUB = "http://www.idpf.org/2007/ops"
CONTAINER = "urn:oasis:names:tc:opendocument:xmlns:container"
XML_SUFFIXES = (".xhtml", ".xml", ".opf", ".ncx", ".svg")


def fail(message: str) -> None:
    raise ValueError(message)


def resolve_archive_path(base: str, reference: str) -> str | None:
    parsed = urllib.parse.urlsplit(reference)
    if parsed.scheme or parsed.netloc:
        return None
    path = urllib.parse.unquote(parsed.path)
    if not path:
        return base
    return posixpath.normpath(posixpath.join(posixpath.dirname(base), path))


def parse_xml(z: zipfile.ZipFile, name: str) -> ET.Element:
    try:
        return ET.fromstring(z.read(name))
    except (KeyError, ET.ParseError) as exc:
        fail(f"XML parse failed for {name}: {exc}")


def check(path: Path, args: argparse.Namespace) -> list[str]:
    findings: list[str] = []
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        if not names or names[0] != "mimetype":
            fail("mimetype must be the first ZIP member")
        if z.getinfo("mimetype").compress_type != zipfile.ZIP_STORED:
            fail("mimetype must be stored without compression")
        if z.read("mimetype") != b"application/epub+zip":
            fail("mimetype has an unexpected value")
        if len(names) != len(set(names)):
            fail("archive contains duplicate member names")
        name_set = set(names)
        if "META-INF/container.xml" not in name_set:
            fail("META-INF/container.xml is missing")

        container = parse_xml(z, "META-INF/container.xml")
        rootfile = container.find(f".//{{{CONTAINER}}}rootfile")
        if rootfile is None or not rootfile.get("full-path"):
            fail("container.xml has no package rootfile")
        opf_path = rootfile.attrib["full-path"]
        if opf_path not in name_set:
            fail(f"package document is missing: {opf_path}")
        opf = parse_xml(z, opf_path)
        if opf.tag != f"{{{OPF}}}package":
            fail("package document root is not an OPF package element")
        if opf.get("version", "").split(".")[0] != "3":
            findings.append("Package is not EPUB 3; verify target support and requirements.")

        metadata = opf.find(f"{{{OPF}}}metadata")
        manifest = opf.find(f"{{{OPF}}}manifest")
        spine = opf.find(f"{{{OPF}}}spine")
        if metadata is None or manifest is None or spine is None:
            fail("OPF must contain metadata, manifest, and spine")
        if not (metadata.find(f"{{{DC}}}title") is not None and metadata.find(f"{{{DC}}}creator") is not None):
            fail("OPF metadata must include a title and creator")
        items = {item.get("id"): item.attrib for item in manifest.findall(f"{{{OPF}}}item")}
        if None in items or len(items) != len(manifest.findall(f"{{{OPF}}}item")):
            fail("manifest item IDs must be present and unique")
        item_by_href = {attrs.get("href"): attrs for attrs in items.values()}
        for item_id, attrs in items.items():
            target = resolve_archive_path(opf_path, attrs.get("href", ""))
            if target not in name_set:
                fail(f"manifest item {item_id} points to a missing file: {target}")

        spine_ids = [item.get("idref") for item in spine.findall(f"{{{OPF}}}itemref")]
        missing_ids = [item_id for item_id in spine_ids if item_id not in items]
        if missing_ids:
            fail(f"spine references missing manifest IDs: {missing_ids}")

        nav_items = [attrs for attrs in items.values() if "nav" in attrs.get("properties", "").split()]
        if not nav_items:
            fail("manifest has no EPUB navigation document marked properties=nav")
        for attrs in nav_items:
            nav_path = resolve_archive_path(opf_path, attrs["href"])
            nav = parse_xml(z, nav_path)
            if not any(el.get(f"{{{EPUB}}}type") == "toc" for el in nav.iter()):
                fail(f"navigation document has no epub:type=\"toc\": {nav_path}")

        parsed_docs: dict[str, ET.Element] = {}
        for member in names:
            if member.lower().endswith(XML_SUFFIXES):
                parsed_docs[member] = parse_xml(z, member)

        for doc_path, root in parsed_docs.items():
            for element in root.iter():
                for attr in ("href", "src"):
                    ref = element.get(attr)
                    if not ref:
                        continue
                    target = resolve_archive_path(doc_path, ref)
                    if target is not None and target not in name_set:
                        fail(f"broken internal {attr} in {doc_path}: {ref} -> {target}")

        if args.require_reverse_links:
            for item_id in spine_ids:
                attrs = items[item_id]
                media = attrs.get("media-type", "")
                if media != "application/xhtml+xml":
                    continue
                doc_path = resolve_archive_path(opf_path, attrs["href"])
                root = parsed_docs.get(doc_path)
                if root is None or posixpath.basename(doc_path).lower() in {"cover.xhtml", "nav.xhtml"}:
                    continue
                classes = {el.get("class") for el in root.iter()}
                if not {"nav-bar", "nav-bar-bottom"} <= classes:
                    fail(f"spine XHTML lacks top/bottom contents links: {doc_path}")

        if args.require_kobo_spans:
            content_paths = [
                resolve_archive_path(opf_path, items[item_id]["href"])
                for item_id in spine_ids
                if items[item_id].get("media-type") == "application/xhtml+xml"
            ]
            checked = 0
            for doc_path in content_paths:
                root = parsed_docs.get(doc_path)
                if root is None:
                    continue
                spans = [el.get("id", "") for el in root.iter() if "koboSpan" in el.get("class", "").split()]
                if spans:
                    expected = [f"kobo.{index}.1" for index in range(1, len(spans) + 1)]
                    if spans != expected:
                        fail(f"Kobo span IDs must reset and increment within each file: {doc_path}")
                    checked += len(spans)
            if checked == 0:
                fail("no koboSpan markers found in spine XHTML")
            findings.append(f"Found {checked} Kobo span markers; device behavior remains untested.")

        if args.cover_size:
            width, height = (int(value) for value in args.cover_size.lower().split("x", 1))
            covers = [attrs for attrs in items.values() if "cover-image" in attrs.get("properties", "").split()]
            if not covers:
                fail("no manifest item is marked properties=cover-image")
            try:
                from PIL import Image
                import io
            except ImportError:
                fail("Pillow is required for --cover-size")
            for attrs in covers:
                cover_path = resolve_archive_path(opf_path, attrs["href"])
                size = Image.open(io.BytesIO(z.read(cover_path))).size
                if size != (width, height):
                    fail(f"cover dimensions for {cover_path}: expected {(width, height)}, found {size}")

        findings.insert(0, f"PASS: {path} — {len(names)} ZIP members, {len(spine_ids)} spine entries, {len(parsed_docs)} XML documents parsed.")
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("epub", type=Path, help="EPUB or KePUB archive to check")
    parser.add_argument("--require-reverse-links", action="store_true", help="require nav-bar and nav-bar-bottom classes in every spine XHTML")
    parser.add_argument("--require-kobo-spans", action="store_true", help="check per-document koboSpan IDs; this does not prove device support")
    parser.add_argument("--cover-size", metavar="WIDTHxHEIGHT", help="optionally check the declared cover-image dimensions (requires Pillow)")
    args = parser.parse_args()
    try:
        for finding in check(args.epub, args):
            print(finding)
    except (OSError, zipfile.BadZipFile, ValueError, KeyError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
