#!/usr/bin/env python3
"""Academic legacy -> new schema CSV transformer (with deterministic UUIDs).

What it does:
    1. Looks in ../old-data/ (relative to this script) for the LATEST CSV that matches:
             - alpine_gp_college_*.csv
             - alpine_gp_course_*.csv
             - alpine_gp_session_*.csv
    2. Normalizes & maps columns to new minimal schema.
        3. Generates deterministic UUID v5 values for each row (stable across runs) unless disabled.
        4. Writes three output CSV files into ./out (or a custom --out-dir):
                 - colleges_out.csv (id + legacy fields)
                 - academic_sessions_out.csv (id + legacy fields)
                 - courses_out.csv (id + legacy fields + college_id foreign key UUID)

You ONLY run:
        python3 academic_transform.py
            (options: --out-dir my_output  --no-uuid)

No need to pass input file paths.

Basic cleaning rules:
    - Dates -> ISO (YYYY-MM-DD); missing start_date -> 2000-01-01.
    - end_date missing -> start_date + 180 days (or +1 day if invalid order).
    - status coerced to 0/1 (defaults to 1 if unclear).
    - duration <= 0 or invalid -> blank.
    - is_current parsed from {1,true,t,yes,y,on}.

Output columns:
        colleges_out.csv: id,legacy_id,code,name,address,website,email,phone,affiliation,approved_by,status
        academic_sessions_out.csv: id,legacy_id,title,start_date,end_date,is_current
        courses_out.csv: id,legacy_id,college_code,college_id,name,duration

    Deterministic UUID Strategy:
        uuid5(NAMESPACE_URL, f"college:{legacy_id}") etc. So re-running yields identical IDs.
        Courses get college_id by matching college_code -> college UUID.
"""
from __future__ import annotations
import csv
import argparse
from pathlib import Path
from datetime import datetime, timedelta
from typing import Iterable, Dict, Any, Optional, List
import uuid
import glob

TRUTHY = {"1","true","t","yes","y","on"}

DATE_IN_FORMATS = [
    "%Y-%m-%d","%d-%m-%Y","%d/%m/%Y","%m/%d/%Y","%Y/%m/%d",
    "%Y-%m-%d %H:%M:%S","%Y/%m/%d %H:%M:%S"
]

FALLBACK_START = datetime(2000,1,1).date()


DEFAULT_OLD_DATA_DIR = (Path(__file__).parent.parent / "old-data").resolve()


def latest(pattern: str) -> Path:
    matches = sorted(glob.glob(pattern))
    if not matches:
        raise FileNotFoundError(f"No files match pattern: {pattern}")
    return Path(matches[-1])


def parse_args():
    ap = argparse.ArgumentParser(description="Transform latest legacy academic CSVs -> new schema with stable UUIDs")
    ap.add_argument("--out-dir", default="out", help="Output directory (default: out)")
    ap.add_argument("--encoding", default="utf-8", help="CSV file encoding (default utf-8)")
    ap.add_argument("--no-uuid", action="store_true", help="Do not generate UUID columns; leave for DB defaults")
    return ap.parse_args()


def read_rows(path: Path, encoding: str) -> Iterable[Dict[str, Any]]:
    with path.open("r", encoding=encoding, newline="") as f:
        sniffer = csv.Sniffer()
        sample = f.read(4096)
        f.seek(0)
        dialect = sniffer.sniff(sample) if sample.strip() else csv.excel
        reader = csv.DictReader(f, dialect=dialect)
        for row in reader:
            # Skip fully empty rows
            if all((v is None or str(v).strip()=="") for v in row.values()):
                continue
            yield {k.strip(): (v.strip() if isinstance(v,str) else v) for k,v in row.items()}


def normalize_int(value: Any) -> Optional[int]:
    if value is None: return None
    s = str(value).strip()
    if s == "": return None
    try:
        return int(float(s))
    except ValueError:
        return None


def normalize_duration(value: Any) -> str:
    iv = normalize_int(value)
    if iv is None or iv <= 0:
        return ""
    return str(iv)


def parse_date(value: Any) -> datetime.date:
    if value is None:
        return FALLBACK_START
    s = str(value).strip()
    if not s:
        return FALLBACK_START
    for fmt in DATE_IN_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    # Try year only
    if s.isdigit() and len(s) == 4:
        return datetime(int(s), 1, 1).date()
    return FALLBACK_START


def parse_bool(value: Any) -> bool:
    if value is None: return False
    return str(value).strip().lower() in TRUTHY


def coerce_status(value: Any) -> int:
    iv = normalize_int(value)
    if iv in (0,1):
        return iv
    return 1  # default active


def extract(row: Dict[str, Any], *candidates: str) -> Any:
    for c in candidates:
        if c in row and row[c] not in (None,""):
            return row[c]
    return None


def transform_colleges(rows: Iterable[Dict[str, Any]], make_uuid: bool):
    for r in rows:
        legacy_id = normalize_int(extract(r, "legacy_id","id","college_id"))
        if legacy_id is None:
            continue  # skip invalid
        uid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"college:{legacy_id}")) if make_uuid else ""
        yield {
            "id": uid,
            "legacy_id": legacy_id,
            "code": extract(r, "code","college_code","abbr") or "",
            "name": extract(r, "name","college_name","title") or "UNKNOWN",
            "address": extract(r, "address","addr") or "",
            "website": extract(r, "website","url") or "",
            "email": extract(r, "email","contact_email") or "",
            "phone": extract(r, "phone","contact_phone","tel") or "",
            "affiliation": extract(r, "affiliation","board") or "",
            "approved_by": extract(r, "approved_by","approved") or "",
            "status": coerce_status(extract(r, "status","active","is_active")),
        }


def transform_sessions(rows: Iterable[Dict[str, Any]], make_uuid: bool):
    for r in rows:
        legacy_id = normalize_int(extract(r, "legacy_id","id","session_id","ssnid"))
        if legacy_id is None:
            continue
        start = parse_date(extract(r, "start_date","start","from","sdate"))
        end_raw = extract(r, "end_date","end","to","edate")
        end = parse_date(end_raw) if end_raw else (start + timedelta(days=180))
        if end <= start:
            end = start + timedelta(days=1)
        uid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"session:{legacy_id}")) if make_uuid else ""
        yield {
            "id": uid,
            "legacy_id": legacy_id,
            "title": (extract(r, "title","name","session_name","ssntitle") or f"Session {legacy_id}"),
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "is_current": "1" if parse_bool(extract(r, "is_current","current","active","iscurrent")) else "0",
        }


def build_college_code_map(raw_college_rows: Iterable[Dict[str, Any]]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for r in raw_college_rows:
        cid = extract(r, "college_id","id","legacy_id")
        code = extract(r, "college_code","code","abbr")
        if cid and code:
            mapping[str(cid).strip()] = str(code).strip()
    return mapping


def transform_courses(rows: Iterable[Dict[str, Any]], college_code_map: Dict[str,str], college_uuid_by_code: Dict[str,str], make_uuid: bool):
    for r in rows:
        legacy_id = normalize_int(extract(r, "legacy_id","id","course_id","crsid"))
        if legacy_id is None:
            continue
        college_code = extract(r, "college_code","college","college_abbr","college_code_fk")
        if not college_code:
            # attempt lookup by numeric college_id
            raw_cid = extract(r, "college_id","colid")
            if raw_cid and str(raw_cid).strip() in college_code_map:
                college_code = college_code_map[str(raw_cid).strip()]
        uid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"course:{legacy_id}")) if make_uuid else ""
        college_uuid = college_uuid_by_code.get(str(college_code).strip(), "") if college_code else ""
        yield {
            "id": uid,
            "legacy_id": legacy_id,
            "college_code": (college_code or ""),
            "college_id": college_uuid,
            "name": extract(r, "name","course_name","title","course") or f"Course {legacy_id}",
            "duration": normalize_duration(extract(r, "duration","length","months")),
        }


def write_csv(path: Path, fieldnames: Iterable[str], rows: Iterable[Dict[str, Any]]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        count = 0
        for row in rows:
            writer.writerow(row)
            count += 1
    return count


def main():
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Discover latest legacy CSVs
    colleges_path = latest(str(DEFAULT_OLD_DATA_DIR / "alpine_gp_college_*.csv"))
    sessions_path = latest(str(DEFAULT_OLD_DATA_DIR / "alpine_gp_session_*.csv"))
    courses_path  = latest(str(DEFAULT_OLD_DATA_DIR / "alpine_gp_course_*.csv"))

    colleges_in = list(read_rows(colleges_path, args.encoding))
    sessions_in = list(read_rows(sessions_path, args.encoding))
    courses_in = list(read_rows(courses_path, args.encoding))

    college_code_map = build_college_code_map(colleges_in)
    make_uuid = not args.no_uuid
    # Build mapping code->uuid for foreign key linking
    college_uuid_by_code: Dict[str,str] = {}
    if make_uuid:
        for c in transform_colleges(colleges_in, True):
            if c["code"]:
                college_uuid_by_code[c["code"]] = c["id"]
        # Need original generator again (it was exhausted above). Recreate list.
        colleges_rows_for_output = list(transform_colleges(colleges_in, True))
    else:
        colleges_rows_for_output = list(transform_colleges(colleges_in, False))

    colleges_count = write_csv(out_dir / "colleges_out.csv",
        ["id","legacy_id","code","name","address","website","email","phone","affiliation","approved_by","status"],
        colleges_rows_for_output)

    sessions_count = write_csv(out_dir / "academic_sessions_out.csv",
        ["id","legacy_id","title","start_date","end_date","is_current"],
        transform_sessions(sessions_in, make_uuid))

    courses_count = write_csv(out_dir / "courses_out.csv",
        ["id","legacy_id","college_code","college_id","name","duration"],
        transform_courses(courses_in, college_code_map, college_uuid_by_code, make_uuid))

    print("=== Academic Transform Summary ===")
    print(f"Colleges source: {colleges_path.name}")
    print(f"Sessions source: {sessions_path.name}")
    print(f"Courses source:  {courses_path.name}")
    print(f"Written colleges: {colleges_count}")
    print(f"Written academic_sessions: {sessions_count}")
    print(f"Written courses: {courses_count}")
    print(f"Output directory: {out_dir.resolve()}")

if __name__ == "__main__":
    main()
