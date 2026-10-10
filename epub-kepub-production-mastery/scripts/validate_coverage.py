#!/usr/bin/env python3
"""Validate a source coverage CSV used during ebook planning and revision."""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

STATUSES = {"included", "consolidated", "omitted", "replaced", "historical-only"}
REQUIRED = {"source_id", "source_title", "source_location", "destination", "status", "reason", "verification"}


def validate(path: Path) -> tuple[int, list[str]]:
    errors: list[str] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fields = set(reader.fieldnames or [])
        missing = REQUIRED - fields
        if missing:
            return 0, [f"missing columns: {', '.join(sorted(missing))}"]
        seen: set[str] = set()
        count = 0
        for line, row in enumerate(reader, 2):
            count += 1
            source_id = (row.get("source_id") or "").strip()
            status = (row.get("status") or "").strip().lower()
            if not source_id:
                errors.append(f"line {line}: source_id is empty")
            elif source_id in seen:
                errors.append(f"line {line}: duplicate source_id {source_id}")
            seen.add(source_id)
            if status not in STATUSES:
                errors.append(f"line {line}: status must be one of {', '.join(sorted(STATUSES))}")
            if status in {"included", "consolidated", "historical-only"} and not (row.get("destination") or "").strip():
                errors.append(f"line {line}: {status} source needs a destination")
            if not (row.get("source_title") or "").strip():
                errors.append(f"line {line}: source_title is empty")
            if not (row.get("source_location") or "").strip():
                errors.append(f"line {line}: source_location is empty")
            if not (row.get("reason") or "").strip():
                errors.append(f"line {line}: add a reason for the {status or 'unclassified'} disposition")
            if not (row.get("verification") or "").strip():
                errors.append(f"line {line}: add a verification note or review question")
    return count, errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("coverage_csv", type=Path)
    args = parser.parse_args()
    try:
        count, errors = validate(args.coverage_csv)
    except OSError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    if errors:
        print(f"FAIL: {len(errors)} issue(s) across {count} source rows", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"PASS: {count} source units have explicit coverage dispositions and review notes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
