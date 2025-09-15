"""
Extract id and corresponding remarks from a fee receipts CSV and write to a new CSV.

Defaults:
- Input: database/old-data/alpine_fees_feereceipts_20250904_140520.csv
- Output: <input_basename>_id_remarks.csv in the same folder
- Skips rows where remarks is empty unless --include-empty is passed

Usage:
  python extract_id_remarks.py [input_csv] [output_csv] [--include-empty]
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


def sanitize_text(val: str | None) -> str:
    if not val:
        return ""
    # Replace any newlines and collapse spaces
    s = val.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    return " ".join(s.split())


def extract(input_path: Path, output_path: Path, include_empty: bool = False) -> int:
    if not input_path.exists():
        raise FileNotFoundError(input_path)

    with input_path.open("r", newline="", encoding="utf-8") as f_in, output_path.open(
        "w", newline="", encoding="utf-8"
    ) as f_out:
        reader = csv.DictReader(f_in)
        if "id" not in reader.fieldnames or "remarks" not in reader.fieldnames:
            raise KeyError(
                f"Input CSV must contain 'id' and 'remarks' columns. Found: {reader.fieldnames}"
            )
        writer = csv.writer(f_out, lineterminator="\n")
        writer.writerow(["id", "remarks"])  # header

        written = 0
        for row in reader:
            rid = row.get("id", "").strip()
            remarks = sanitize_text(row.get("remarks"))
            if remarks or include_empty:
                writer.writerow([rid, remarks])
                written += 1

    return written


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract id and remarks from fee receipts CSV")
    parser.add_argument(
        "input_csv",
        nargs="?",
        default="database/old-data/alpine_fees_feereceipts_20250904_140520.csv",
        help="Path to input CSV",
    )
    parser.add_argument(
        "output_csv",
        nargs="?",
        help="Path to output CSV (defaults to <input_basename>_id_remarks.csv in same folder)",
    )
    parser.add_argument(
        "--include-empty",
        action="store_true",
        help="Include rows where remarks is empty",
    )

    args = parser.parse_args()
    input_path = Path(args.input_csv)
    if args.output_csv:
        output_path = Path(args.output_csv)
    else:
        output_path = input_path.with_name(input_path.stem + "_id_remarks.csv")

    count = extract(input_path, output_path, include_empty=args.include_empty)
    print(f"Wrote {count} rows to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
