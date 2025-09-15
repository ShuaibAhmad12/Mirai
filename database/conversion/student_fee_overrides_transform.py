#!/usr/bin/env python3
"""Generate student_fee_overrides CSV from student admission fee data.

This script reads student admission records, extracts all fee information,
maps to normalized fee structure, and calculates overrides/discounts.

Process:
1. Read student admission CSV → extract student_id + all fee columns
2. Map legacy student_id → UUID via students_out.csv  
3. Get enrollment info → student_enrollments_out.csv for enrollment_id + course_id
4. Get original fees → fee_plans + fee_plan_items using course_id
5. Calculate overrides → compare actual vs original fees
6. Generate student_fee_overrides_out.csv

Input files:
  - alpine_students_admission_*.csv (from old-data)
  - students_out.csv (from students transformer)
  - student_enrollments_out.csv (from students transformer)
  - fee_plans_out.csv + fee_plan_items_out.csv (from fee transformer)

Output:
  - student_fee_overrides_out.csv

Usage:
  python3 student_fee_overrides_transform.py
"""
from __future__ import annotations
import csv, glob, uuid, argparse
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
from decimal import Decimal

DEFAULT_OLD = (Path(__file__).parent.parent / 'old-data').resolve()
ADMISSION_PATTERNS = ['alpine_student_admission_*.csv','alpine_students_admission_*.csv']

def parse_args():
    ap = argparse.ArgumentParser(description='Generate student fee overrides from admission data')
    ap.add_argument('--old-data-dir', default=str(DEFAULT_OLD), help='Directory containing legacy admission CSV')
    ap.add_argument('--out-dir', default='out/student_fee_overrides', help='Output directory')
    ap.add_argument('--students-dir', default='out/students', help='Directory containing students output CSVs')
    ap.add_argument('--fee-dir', default='out/feetable', help='Directory containing fee output CSVs')
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
    if not path.exists():
        return []
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

def safe_decimal(value: Any) -> Optional[Decimal]:
    """Convert value to Decimal, return None if invalid"""
    if value is None or str(value).strip() == '':
        return None
    try:
        return Decimal(str(value).strip())
    except:
        return None

def main():
    args = parse_args()
    old_dir = Path(args.old_data_dir)
    out_dir = Path(args.out_dir)
    students_dir = Path(args.students_dir)
    fee_dir = Path(args.fee_dir)
    make_uuid = not args.no_uuid

    # Track created overrides to prevent duplicates
    created_overrides = set()
    
    print("=== Loading data files ===")
    
    # Load admission data
    admission_path = latest_any(ADMISSION_PATTERNS, old_dir)
    admission_rows = read_csv(admission_path, args.encoding)
    print(f"Admission records: {len(admission_rows)}")

    # Load mappings
    student_map = load_mapping(students_dir / 'students_out.csv', 'legacy_student_id', 'id', args.encoding)
    print(f"Student mapping: {len(student_map)} entries")
    
    # Load enrollments
    enrollment_rows = read_csv(students_dir / 'student_enrollments_out.csv', args.encoding)
    enrollment_map = {r.get('student_id'): r for r in enrollment_rows}
    print(f"Enrollment records: {len(enrollment_map)}")
    
    # Load fee plans and plan items
    fee_plan_rows = read_csv(fee_dir / 'fee_plans_out.csv', args.encoding)
    fee_plan_map = {r.get('id'): r for r in fee_plan_rows}
    
    fee_plan_item_rows = read_csv(fee_dir / 'fee_plan_items_out.csv', args.encoding)
    # Group fee plan items by fee_plan_id
    fee_plan_items_map = {}
    for item in fee_plan_item_rows:
        plan_id = item.get('fee_plan_id')
        if plan_id not in fee_plan_items_map:
            fee_plan_items_map[plan_id] = []
        fee_plan_items_map[plan_id].append(item)
    
    print(f"Fee plans: {len(fee_plan_map)}")
    print(f"Fee plan items: {len(fee_plan_item_rows)}")

    fee_overrides: List[Dict[str,Any]] = []
    now_iso = datetime.now().isoformat()
    
    print("\n=== Processing admission records ===")
    processed = 0
    skipped_no_student = 0
    skipped_no_enrollment = 0
    skipped_no_fee_plan = 0

    for admission in admission_rows:
        legacy_student_id = str(admission.get('student_id') or '').strip()
        if not legacy_student_id:
            continue
            
        # Get student UUID
        student_uuid = student_map.get(legacy_student_id)
        if not student_uuid:
            skipped_no_student += 1
            continue
            
        # Get enrollment info
        enrollment = enrollment_map.get(student_uuid)
        if not enrollment:
            skipped_no_enrollment += 1
            continue
            
        enrollment_id = enrollment.get('id')
        course_id = enrollment.get('course_id')
        
        # Extract all fee data from admission record
        fee_data = {
            # Admission fees
            'admsn_yr1': safe_decimal(admission.get('admsn_yr1')),
            'admsn_yr2': safe_decimal(admission.get('admsn_yr2')),
            'admsn_yr3': safe_decimal(admission.get('admsn_yr3')),
            'admsn_yr4': safe_decimal(admission.get('admsn_yr4')),
            'admsn_yr5': safe_decimal(admission.get('admsn_yr5')),
            'admsn_yr6': safe_decimal(admission.get('admsn_yr6')),
            # Other fees
            'security_fee': safe_decimal(admission.get('security_fee')),
            'other_fee': safe_decimal(admission.get('other_fee')),
            # Tuition fees  
            'yr1_fee': safe_decimal(admission.get('yr1_fee')),
            'yr2_fee': safe_decimal(admission.get('yr2_fee')),
            'yr3_fee': safe_decimal(admission.get('yr3_fee')),
            'yr4_fee': safe_decimal(admission.get('yr4_fee')),
            'yr5_fee': safe_decimal(admission.get('yr5_fee')),
            'yr6_fee': safe_decimal(admission.get('yr6_fee')),
        }
        
        # Find fee plan for this course
        fee_plan = None
        for plan in fee_plan_rows:
            if plan.get('course_id') == course_id:
                fee_plan = plan
                break
                
        if not fee_plan:
            skipped_no_fee_plan += 1
            continue
            
        fee_plan_id = fee_plan.get('id')
        plan_items = fee_plan_items_map.get(fee_plan_id, [])
        
        # Create overrides for each fee type - capture ALL fee information (ignore plan comparisons)
        
        # Process admission fees (yr1-6) - Create override for every non-null value
        for year in range(1, 7):
            actual_admission = fee_data.get(f'admsn_yr{year}')
            if actual_admission is not None and actual_admission > 0:  # Only non-null and positive values
                # Find corresponding plan item (for reference)
                plan_item = None
                for item in plan_items:
                    if (item.get('component_code') == 'ADMISSION' and 
                        str(item.get('year_number')) == str(year)):
                        plan_item = item
                        break
                
                # If no plan item found, create a placeholder reference
                if not plan_item:
                    # Use first available plan item as reference
                    plan_item = plan_items[0] if plan_items else {'id': ''}
                
                override_id = det_uuid('feeoverride', legacy_student_id, 'ADMISSION', str(year), enabled=make_uuid)
                
                # Check for duplicates using enrollment_id + fee_plan_item_id (matches DB constraint)
                plan_item_id = plan_item.get('id', '')
                override_key = (enrollment_id, plan_item_id)
                if override_key not in created_overrides:
                    created_overrides.add(override_key)
                    
                    fee_overrides.append({
                    'id': override_id,
                    'enrollment_id': enrollment_id,
                    'fee_plan_item_id': plan_item_id,
                    'year_number': year,
                    'component_code': 'ADMISSION',
                    'override_amount': str(actual_admission),
                    'discount_amount': '0.00',  # Set to 0 since we're not comparing to plan
                    'reason': 'Legacy admission fee data import',
                    'source': 'admission_csv',
                    'created_at': now_iso,
                    'updated_at': now_iso
                    })
        
        # Process tuition fees (yr1-6) - Create override for every non-null value
        for year in range(1, 7):
            actual_tuition = fee_data.get(f'yr{year}_fee')
            if actual_tuition is not None and actual_tuition > 0:  # Only non-null and positive values
                # Find corresponding plan item (for reference)
                plan_item = None
                for item in plan_items:
                    if (item.get('component_code') == 'TUITION' and 
                        str(item.get('year_number')) == str(year)):
                        plan_item = item
                        break
                
                # If no plan item found, create a placeholder reference
                if not plan_item:
                    # Use first available plan item as reference
                    plan_item = plan_items[0] if plan_items else {'id': ''}
                
                override_id = det_uuid('feeoverride', legacy_student_id, 'TUITION', str(year), enabled=make_uuid)
                
                # Check for duplicates using enrollment_id + fee_plan_item_id (matches DB constraint)
                plan_item_id = plan_item.get('id', '')
                override_key = (enrollment_id, plan_item_id)
                if override_key not in created_overrides:
                    created_overrides.add(override_key)
                    
                    fee_overrides.append({
                        'id': override_id,
                        'enrollment_id': enrollment_id,
                        'fee_plan_item_id': plan_item_id,
                        'year_number': year,
                        'component_code': 'TUITION',
                        'override_amount': str(actual_tuition),
                        'discount_amount': '0.00',  # Set to 0 since we're not comparing to plan
                        'reason': 'Legacy tuition fee data import',
                        'source': 'admission_csv',
                        'created_at': now_iso,
                        'updated_at': now_iso
                    })
        
        # Process security fee - Create override if non-null value exists
        actual_security = fee_data.get('security_fee')
        if actual_security is not None and actual_security > 0:  # Only non-null and positive values
            # Find corresponding plan item (for reference)
            plan_item = None
            for item in plan_items:
                if item.get('component_code') == 'SECURITY':
                    plan_item = item
                    break
            
            # If no plan item found, create a placeholder reference
            if not plan_item:
                plan_item = plan_items[0] if plan_items else {'id': ''}
            
            override_id = det_uuid('feeoverride', legacy_student_id, 'SECURITY', '1', enabled=make_uuid)
            
            # Check for duplicates using enrollment_id + fee_plan_item_id (matches DB constraint)
            plan_item_id = plan_item.get('id', '')
            override_key = (enrollment_id, plan_item_id)
            if override_key not in created_overrides:
                created_overrides.add(override_key)
                
                fee_overrides.append({
                'id': override_id,
                'enrollment_id': enrollment_id,
                'fee_plan_item_id': plan_item_id,
                'year_number': 1,  # Security fee typically for year 1
                'component_code': 'SECURITY',
                'override_amount': str(actual_security),
                'discount_amount': '0.00',  # Set to 0 since we're not comparing to plan
                'reason': 'Legacy security fee data import',
                'source': 'admission_csv',
                'created_at': now_iso,
                'updated_at': now_iso
            })
        
        # Process other fee - Create override if non-null value exists
        actual_other = fee_data.get('other_fee')
        if actual_other is not None and actual_other > 0:  # Only non-null and positive values
            # Find corresponding plan item (for reference)
            plan_item = None
            for item in plan_items:
                if item.get('component_code') == 'OTHER':
                    plan_item = item
                    break
            
            # If no plan item found, create a placeholder reference
            if not plan_item:
                plan_item = plan_items[0] if plan_items else {'id': ''}
            
            override_id = det_uuid('feeoverride', legacy_student_id, 'OTHER', '1', enabled=make_uuid)
            
            # Check for duplicates using enrollment_id + fee_plan_item_id (matches DB constraint)
            plan_item_id = plan_item.get('id', '')
            override_key = (enrollment_id, plan_item_id)
            if override_key not in created_overrides:
                created_overrides.add(override_key)
                
                fee_overrides.append({
                    'id': override_id,
                    'enrollment_id': enrollment_id,
                    'fee_plan_item_id': plan_item_id,
                    'year_number': 1,  # Other fee typically for year 1
                    'component_code': 'OTHER',
                    'override_amount': str(actual_other),
                    'discount_amount': '0.00',  # Set to 0 since we're not comparing to plan
                    'reason': 'Legacy other fee data import',
                    'source': 'admission_csv',
                    'created_at': now_iso,
                    'updated_at': now_iso
                })
        
        processed += 1

    # Write output
    fieldnames = [
        'id', 'enrollment_id', 'fee_plan_item_id', 'year_number', 'component_code',
        'override_amount', 'discount_amount', 'reason', 'source', 'created_at', 'updated_at'
    ]
    
    write_csv(out_dir / 'student_fee_overrides_out.csv', fieldnames, fee_overrides)

    print('\n=== Student Fee Overrides Transform Summary ===')
    print(f'Admission source: {admission_path.name}')
    print(f'Total admission records: {len(admission_rows)}')
    print(f'Processed successfully: {processed}')
    print(f'Skipped - no student mapping: {skipped_no_student}')
    print(f'Skipped - no enrollment: {skipped_no_enrollment}')
    print(f'Skipped - no fee plan: {skipped_no_fee_plan}')
    print(f'Fee overrides created: {len(fee_overrides)}')
    print(f'Output: {(out_dir / "student_fee_overrides_out.csv").resolve()}')

if __name__ == '__main__':
    main()
