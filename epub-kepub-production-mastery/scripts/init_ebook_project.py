#!/usr/bin/env python3
"""Scaffold editable ebook chapters and part folders from a book manifest."""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path, PurePosixPath


def safe_relative(value: str) -> Path:
    posix = PurePosixPath(value)
    if not value or posix.is_absolute() or ".." in posix.parts:
        raise ValueError(f"manifest paths must be safe relative paths: {value!r}")
    return Path(*posix.parts)


def validate_manifest(data: dict) -> list[tuple[dict, dict, Path]]:
    if not data.get("title") or not data.get("author"):
        raise ValueError("manifest requires a title and author")
    parts = data.get("parts")
    if not isinstance(parts, list) or not parts:
        raise ValueError("manifest requires a non-empty parts list")
    flat = [(part, chapter) for part in parts for chapter in part.get("chapters", [])]
    if not flat:
        raise ValueError("manifest has no chapters")
    chapter_ids = [chapter.get("id") for _, chapter in flat]
    if any(not item for item in chapter_ids) or len(set(chapter_ids)) != len(chapter_ids):
        raise ValueError("chapter IDs must be present and unique")
    part_ids = [part.get("id") for part in parts]
    if any(not item for item in part_ids) or len(set(part_ids)) != len(part_ids):
        raise ValueError("part IDs must be present and unique")
    if any(not item.replace("-", "").replace("_", "").replace(".", "").isalnum() for item in part_ids):
        raise ValueError("part IDs may contain only letters, digits, hyphens, underscores, and periods")
    editable_unit = data.get("production_plan", {}).get("editable_unit", "single")
    if editable_unit not in {"single", "modular"}:
        raise ValueError("production_plan.editable_unit must be 'single' or 'modular'")
    if editable_unit == "single" and len(parts) != 1:
        raise ValueError("a single editable manuscript should be represented by one part entry")
    if editable_unit == "modular" and any(len(part.get("chapters", [])) not in (2, 3) for part in parts):
        raise ValueError("modular-book parts must contain two or three related chapters each")
    result = []
    source_paths: set[Path] = set()
    for part in parts:
        for chapter in part.get("chapters", []):
            if not chapter.get("title"):
                raise ValueError(f"chapter {chapter['id']} needs a title")
            rel = safe_relative(chapter.get("source", ""))
            if rel in source_paths:
                raise ValueError(f"chapter source path is assigned more than once: {rel}")
            source_paths.add(rel)
            result.append((part, chapter, rel))
    return result


def create(manifest_path: Path, output: Path) -> list[Path]:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    data.setdefault("author", "Bhupender Bhardwaj")
    if not data.get("author"):
        data["author"] = "Bhupender Bhardwaj"
    rows = validate_manifest(data)
    output.mkdir(parents=True, exist_ok=True)
    created: list[Path] = []

    for directory in ("assets/images", "styles", "sources", "build", "dist"):
        target = output / directory
        target.mkdir(parents=True, exist_ok=True)

    manifest_target = output / "book-manifest.json"
    if not manifest_target.exists():
        manifest_target.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        created.append(manifest_target)

    coverage_path = output / safe_relative(data.get("source_coverage_file", "source-coverage.csv"))
    if not coverage_path.exists():
        coverage_path.parent.mkdir(parents=True, exist_ok=True)
        with coverage_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["source_id", "source_title", "source_location", "destination", "status", "reason", "verification"])
        created.append(coverage_path)

    for part, chapter, relative in rows:
        chapter_path = output / relative
        chapter_path.parent.mkdir(parents=True, exist_ok=True)
        if not chapter_path.exists():
            chapter_path.write_text(
                f"# Chapter {chapter['id']}: {chapter['title']}\n\n"
                "<!-- Draft with a bridge from the preceding topic and a forward transition. -->\n\n"
                "## Opening bridge\n\n"
                "## Main ideas\n\n"
                "## Worked example or practice\n\n"
                "## Closing bridge\n",
                encoding="utf-8",
            )
            created.append(chapter_path)
        part_dir = output / "parts" / part["id"]
        part_dir.mkdir(parents=True, exist_ok=True)
        readme = part_dir / "README.md"
        if not readme.exists():
            chapter_items = part.get("chapters", [])
            links = []
            for item in chapter_items:
                source_path = safe_relative(item["source"])
                rel_link = Path("..") / ".." / source_path
                links.append(f"- [{item['id']}: {item['title']}]({rel_link.as_posix()})")
            readme.write_text(
                f"# {part.get('title', part['id'])}\n\n"
                "Editable chapter sources:\n\n" + "\n".join(links) + "\n\n"
                "Build and review this part independently. Keep chapter files authoritative; generated navigation and package files should be reproducible.\n",
                encoding="utf-8",
            )
            created.append(readme)
    return created


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="book-manifest.json with chapter-to-part assignments")
    parser.add_argument("output", type=Path, help="new or existing project directory; existing files are preserved")
    args = parser.parse_args()
    try:
        created = create(args.manifest, args.output)
    except (OSError, json.JSONDecodeError, ValueError, KeyError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print(f"PASS: created {len(created)} missing scaffold files under {args.output}; existing files were preserved.")
    for path in created:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
