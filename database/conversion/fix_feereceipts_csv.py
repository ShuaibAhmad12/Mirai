"""
Normalize malformed CSV rows in alpine_fees_feereceipts_20250904_140520.csv

- Problem: Some rows contain a multiline value in the 'remarks' (and sometimes
  'reference_number') column such as:
    "ID 5330\nPROVISIONAL ADMISSION"
  which breaks the CSV into two lines.

- Fix: Replace any embedded newlines (\r, \n, or \r\n) in these text fields
  with a single space. This preserves the content but makes each row
  single-line. CSV quoting will be handled automatically by the csv module.

Usage:
  python fix_feereceipts_csv.py [path_to_csv]

If no path is provided, it defaults to the known file in this repo. A backup
copy with suffix .bak will be written next to the original.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path


def sanitize_text(val: str | None) -> str | None:
    if val is None:
        return None
    # Replace any newline characters with a single space and normalize spaces
    cleaned = val.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    # Collapse repeated spaces
    cleaned = " ".join(cleaned.split()) if cleaned else cleaned
    return cleaned


def fix_csv(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(path)

    backup = path.with_suffix(path.suffix + ".bak")
    tmp = path.with_suffix(path.suffix + ".tmp")

    # Make a backup first
    backup.write_bytes(path.read_bytes())

    with path.open("r", newline="", encoding="utf-8") as f_in, tmp.open(
        "w", newline="", encoding="utf-8"
    ) as f_out:
        reader = csv.reader(f_in)
        writer = csv.writer(f_out, lineterminator="\n")

        header = next(reader)
        writer.writerow(header)

        # Identify target columns (best-effort by name)
        col_index = {name: i for i, name in enumerate(header)}
        remarks_idx = col_index.get("remarks")
        ref_idx = col_index.get("reference_number")

        for row in reader:
            # Pad or skip malformed rows defensively
            if len(row) < len(header):
                # Attempt a minimal recovery by padding missing cols
                row = row + [""] * (len(header) - len(row))

            if remarks_idx is not None and remarks_idx < len(row):
                row[remarks_idx] = sanitize_text(row[remarks_idx]) or ""
            if ref_idx is not None and ref_idx < len(row):
                row[ref_idx] = sanitize_text(row[ref_idx]) or ""

            writer.writerow(row)

    # Replace original with tmp
    tmp.replace(path)


def main(argv: list[str]) -> int:
    if len(argv) > 1:
        target = Path(argv[1])
    else:
        target = Path(
            "database/old-data/alpine_fees_feereceipts_20250904_140520.csv"
        )
    fix_csv(target)
    print(f"Fixed CSV written in place. Backup at: {target.with_suffix(target.suffix + '.bak')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
