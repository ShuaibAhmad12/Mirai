#!/usr/bin/env python3
"""Generate agent_notes CSV from student admission data.

This script reads student admission records and creates agent_notes entries
for students who were referred by agents (ref_by field).

Mapping Logic:
  - ref_by (legacy agent id) → agent UUID from agents_out.csv
  - student_id (legacy student id) → student UUID from students_out.csv  
  - remarks: copy as-is, blank for blank, clean "na"/"n/a"/"no" to empty string

Input files:
  - alpine_students_admission_*.csv (from old-data)
  - agents_out.csv (from agents transformer)
  - students_out.csv (from student transformer)

Output:
  - agent_notes_out.csv (id, agent_id, student_id, is_paid, remarks, created_at, updated_at)

Usage:
  python3 agent_notes_transform.py
  python3 agent_notes_transform.py --out-dir out/agent_notes --students-dir out/students --agents-dir out/agents
"""
from __future__ import annotations
import csv, glob, uuid, argparse
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime

DEFAULT_OLD = (Path(__file__).parent.parent / 'old-data').resolve()
ADMISSION_PATTERNS = ['alpine_student_admission_*.csv','alpine_students_admission_*.csv']

def parse_args():
    ap = argparse.ArgumentParser(description='Generate agent_notes from student admission data')
    ap.add_argument('--old-data-dir', default=str(DEFAULT_OLD), help='Directory containing legacy admission CSV')
    ap.add_argument('--out-dir', default='out/agent_notes', help='Output directory')
    ap.add_argument('--students-dir', default='out/students', help='Directory containing students_out.csv')
    ap.add_argument('--agents-dir', default='out/agents', help='Directory containing agents_out.csv')
    ap.add_argument('--encoding', default='utf-8')
    ap.add_argument('--no-uuid', action='store_true')
    return ap.parse_args()

def latest_any(patterns: list[str], base: Path) -> Path:
    for p in patterns:
        matches = sorted(glob.glob(str(base / p)))
        if matches:
            return Path(matches[-1])
    raise FileNotFoundError(f'No files match {patterns} in {base}')

def read_csv(path: Path, encoding: str) -> List[Dict[str,Any]]:
    with path.open('r', encoding=encoding, newline='') as f:
        reader = csv.DictReader(f)
        return [{k.strip(): (v.strip() if isinstance(v,str) else v) for k,v in r.items()} 
                for r in reader if not all((v is None or str(v).strip()=='' for v in r.values()))]

def write_csv(path: Path, fieldnames: List[str], rows: List[Dict[str,Any]]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k,'') for k in fieldnames})

def det_uuid(kind: str, *parts: str, enabled: bool=True) -> str:
    if not enabled:
        return ''
    key = f'{kind}:' + ':'.join(str(p) for p in parts)
    return str(uuid.uuid5(uuid.NAMESPACE_URL, key))

def load_mapping(path: Path, key_col: str, val_col: str, encoding: str) -> Dict[str,str]:
    if not path.exists():
        return {}
    rows = read_csv(path, encoding)
    return {str(r.get(key_col,'')).strip(): str(r.get(val_col,'')).strip() 
            for r in rows if r.get(key_col) and r.get(val_col)}

def main():
    args = parse_args()
    old_dir = Path(args.old_data_dir)
    out_dir = Path(args.out_dir)
    students_dir = Path(args.students_dir)
    agents_dir = Path(args.agents_dir)
    make_uuid = not args.no_uuid

    # Load admission data
    admission_path = latest_any(ADMISSION_PATTERNS, old_dir)
    admission_rows = read_csv(admission_path, args.encoding)

    # Load mappings
    agent_map = load_mapping(agents_dir / 'agents_out.csv', 'legacy_id', 'id', args.encoding)
    student_map = load_mapping(students_dir / 'students_out.csv', 'legacy_student_id', 'id', args.encoding)

    agent_notes: List[Dict[str,Any]] = []
    now_iso = datetime.now().isoformat()

    for r in admission_rows:
        # Get student info
        legacy_student_id = str(r.get('student_id') or '').strip()
        if not legacy_student_id:
            continue
        
        student_uuid = student_map.get(legacy_student_id)
        if not student_uuid:
            continue  # Student not found in mapping

        # Get agent info - handle float values like "29.0" -> "29"
        ref_by_raw = str(r.get('ref_by') or '').strip()
        if not ref_by_raw:
            continue  # No agent reference
        
        # Convert float strings to integers (29.0 -> 29)
        try:
            legacy_agent_id = str(int(float(ref_by_raw)))
        except (ValueError, TypeError):
            legacy_agent_id = ref_by_raw
        
        agent_uuid = agent_map.get(legacy_agent_id)
        if not agent_uuid:
            continue  # Agent not found in mapping

        # Payment status
        is_paid_raw = str(r.get('is_paid') or '').strip().lower()
        is_paid = is_paid_raw in ('yes', 'y', '1', 'true', 't')

        # Remarks - copy exactly as-is, no cleanup, values as-is
        remarks = str(r.get('remark') or '').strip()

        # Create agent note for all agent-student relationships
        agent_note_id = det_uuid('agentnote', legacy_student_id, legacy_agent_id, enabled=make_uuid)
        agent_notes.append({
            'id': agent_note_id,
            'agent_id': agent_uuid,
            'student_id': student_uuid,
            'is_paid': is_paid,
            'remarks': remarks,
            'created_at': now_iso,
            'updated_at': now_iso
        })

    # Write output
    write_csv(out_dir / 'agent_notes_out.csv', 
              ['id', 'agent_id', 'student_id', 'is_paid', 'remarks', 'created_at', 'updated_at'], 
              agent_notes)

    print('=== Agent Notes Transform Summary ===')
    print(f'Admission source: {admission_path.name}')
    print(f'Agent notes created: {len(agent_notes)}')
    print(f'Output: {(out_dir / "agent_notes_out.csv").resolve()}')

if __name__ == '__main__':
    main()
