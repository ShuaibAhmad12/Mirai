"""
Generate SQL to update fee_receipts.remarks from an id_remarks CSV.

Assumptions:
- PostgreSQL dialect
- fee_receipts table has a column legacy_receipt_id matching the CSV id
- remarks is a text-like column

Approach:
- Use chunked UPDATE ... FROM (VALUES ...) for performance and safety
- Escape single quotes in remarks
- Skip rows with missing id

Usage:
  python generate_update_remarks_sql.py [input_csv] [output_sql] [--chunk-size N]

Defaults:
  input_csv: database/old-data/alpine_fees_feereceipts_20250904_140520_id_remarks.csv
  output_sql: database/old-data/fee_receipts_update_remarks.sql
  chunk_size: 1000
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Iterable, List, Tuple


def sanitize_text(val: str | None) -> str:
    if not val:
        return ""
    # Normalize whitespace and remove newlines just in case
    s = val.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    s = " ".join(s.split())
    # Escape single quotes for SQL
    return s.replace("'", "''")


def read_pairs(path: Path) -> List[Tuple[str, str]]:
    pairs: List[Tuple[str, str]] = []
    with path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if "id" not in reader.fieldnames or "remarks" not in reader.fieldnames:
            raise KeyError(
                f"CSV must contain 'id' and 'remarks' columns. Found: {reader.fieldnames}"
            )
        for row in reader:
            rid_raw = (row.get("id") or "").strip()
            remarks_raw = row.get("remarks")
            if not rid_raw:
                continue
            # Treat id as text to match DB column type
            rid = rid_raw
            remarks = sanitize_text(remarks_raw)
            if not remarks:
                # Skip empty remarks to avoid overwriting existing
                continue
            pairs.append((rid, remarks))
    return pairs


def chunks(seq: List[Tuple[str, str]], size: int) -> Iterable[List[Tuple[str, str]]]:
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def sql_escape(val: str) -> str:
    # Escape single quotes
    return val.replace("'", "''")


def generate_sql(pairs: List[Tuple[str, str]], chunk_size: int = 1000) -> str:
    lines: List[str] = []
    lines.append("BEGIN;")
    if not pairs:
        lines.append("-- No rows to update")
        lines.append("COMMIT;")
        return "\n".join(lines) + "\n"

    for idx, batch in enumerate(chunks(pairs, chunk_size), start=1):
        lines.append(f"-- Batch {idx} ({len(batch)} rows)")
        lines.append("WITH v(legacy_receipt_id, remarks) AS (")
        lines.append("  VALUES")
        # Join each tuple as ('id'::text, 'remarks'::text)
        value_lines = [
            f"    ('{sql_escape(rid)}'::text, '{sql_escape(remarks)}'::text)" for rid, remarks in batch
        ]
        lines.append((",\n").join(value_lines))
        lines.append(")")
        lines.append("UPDATE fee_receipts fr")
        lines.append("SET remarks = v.remarks")
        lines.append("FROM v")
        lines.append("WHERE fr.legacy_receipt_id = v.legacy_receipt_id;")
        lines.append("")

    lines.append("COMMIT;")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate SQL to update fee_receipts.remarks from id_remarks CSV")
    parser.add_argument(
        "input_csv",
        nargs="?",
        default="database/old-data/alpine_fees_feereceipts_20250904_140520_id_remarks.csv",
        help="Path to the id_remarks CSV",
    )
    parser.add_argument(
        "output_sql",
        nargs="?",
        default="database/old-data/fee_receipts_update_remarks.sql",
        help="Path to write the generated SQL file",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1000,
        help="Number of rows per UPDATE batch",
    )

    args = parser.parse_args()
    input_path = Path(args.input_csv)
    output_path = Path(args.output_sql)

    pairs = read_pairs(input_path)
    sql = generate_sql(pairs, args.chunk_size)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(sql, encoding="utf-8")
    print(f"Wrote SQL for {len(pairs)} rows to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
