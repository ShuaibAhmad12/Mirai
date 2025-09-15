#!/usr/bin/env python3
"""Legacy student admission/profile/promotion CSVs -> normalized student domain outputs.

Goal: Produce CSVs aligned with tables in `005_stu_admission_profile_promotion.sql` using the
same simple style as `agent_transform.py` & `feetable_transform.py`.

Inputs (searched under --old-data-dir, default: ../old-data):
  * alpine_student_admission_*.csv   (core admission + course/session + codes + dates)
  * alpine_student_profile_*.csv     (optional extra demographic data)
  * alpine_student_promotion_*.csv   (optional promotion / progression data)

Supporting mapping inputs (already produced by earlier transformers):
  * courses_out.csv & academic_sessions_out.csv   (from academic_transform)  -- via --academic-dir
  * agents_out.csv                                 (from agent_transform)    -- via --agents-dir
  * fee_plans_out.csv                              (from feetable_transform) -- via --fees-dir (optional)

Outputs (default directory: out/students):
  students_out.csv                      (id, legacy_student_id, full_name, status)
  student_profiles_out.csv              (student_id, mother_name, father_name, dob, gender, category, nationality)
  student_enrollments_out.csv           (id, student_id, course_id, session_id, enrollment_code, enrollment_date, joining_date, entry_year, entry_type, agent_id, fee_plan_id, status)
  student_contacts_out.csv              (id, student_id, contact_type, value_raw, value_norm, is_primary)
  student_prior_education_out.csv       (currently empty placeholder if none parsed)  (future extension)
  student_progressions_out.csv          (if promotion file present)
    student_addresses_out.csv             (id, student_id, addr_type, address_text, state, country)
    student_identity_documents_out.csv    (id, student_id, doc_type, doc_number, is_primary)
    student_internal_refs_out.csv         (id, student_id, ref_group, slot_number, raw_value)
    student_fee_overrides_out.csv         (placeholder for now)
    student_fee_adjustments_out.csv       (discounts parsed from remarks -> adjustment_type=discount)
    student_notes_out.csv                 (id, student_id, note from remark)
  student_quality_issues.csv            (if --quality-report)

Deterministic UUIDs (uuid5 over namespace URL) unless --no-uuid.

Simplifications / Assumptions (adjust later as data clarifies):
  * One admission row per legacy_student_id. If duplicates, last wins (like agents script).
  * Admission file columns (best-guess, adapt if different):
      studentid / legacy_student_id / id
      student_name / name
      course_id (legacy int)  session_id (legacy int)
      admission_date / enrollment_date, doj / joining_date, entry_year
      admission_code / enrollment_code
      agent_id (legacy)  fee_plan_legacy_id (optional)
      phone / mobile / parent_phone / email
  * Profile file columns (if present): mother_name, father_name, dob, gender, category, nationality.
  * Promotion file columns: promotion_id, student_id, from_year, to_year, course_duration, effective_date, status, notes.
  * Phone / email normalization mirrors `agent_transform.py` (E.164 +91 assumption for 10 digits, email regex, etc.).
  * Any mapping failure (course/session/agent/fee_plan) recorded as quality issue & enrollment row still produced with blank mapping (except course_id – if missing we drop enrollment entirely and flag issue).

Quality issue categories (examples):
  missing_course, missing_session, invalid_date:<field>, phone_invalid:<type>, email_invalid, duplicate_student, promotion_missing_enrollment, parse_error:<field>

Usage:
  python3 student_transform.py
  python3 student_transform.py --out-dir out/students --quality-report
  python3 student_transform.py --old-data-dir ../legacy --academic-dir out/academic_data --agents-dir out/agents --fees-dir out/feetable

Later extensions: prior education parsing, internal refs, fee overrides & adjustments.
"""
from __future__ import annotations
import csv, glob, uuid, argparse, re
from pathlib import Path
from typing import Dict, Any, List, Optional, Iterable, Tuple
from datetime import datetime

DEFAULT_OLD = (Path(__file__).parent.parent / 'old-data').resolve()

ADMISSION_PATTERNS = ['alpine_student_admission_*.csv','alpine_students_admission_*.csv']
PROFILE_PATTERNS   = ['alpine_student_profile_*.csv','alpine_students_profile_*.csv']
PROMOTION_PATTERNS = ['alpine_student_promotion_*.csv','alpine_students_promotion_*.csv']

TRUTHY = {'1','true','t','yes','y','on'}

EMAIL_RE = re.compile(r"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$", re.IGNORECASE)
PLACEHOLDER_EMAILS = {"test@test.com","example@example.com"}

DATE_FORMATS = [
    '%Y-%m-%d','%d-%m-%Y','%d/%m/%Y','%Y/%m/%d','%d.%m.%Y','%Y.%m.%d'
]

# ---------------- CLI ----------------

def parse_args():
    ap = argparse.ArgumentParser(description='Transform legacy student CSVs to normalized outputs')
    ap.add_argument('--old-data-dir', default=str(DEFAULT_OLD), help='Directory containing legacy CSVs')
    ap.add_argument('--out-dir', default='out/students', help='Output directory')
    ap.add_argument('--academic-dir', help='Directory containing courses_out.csv & academic_sessions_out.csv (default searches out/academic_data then out)')
    ap.add_argument('--agents-dir', help='Directory containing agents_out.csv')
    ap.add_argument('--fees-dir', help='Directory containing fee_plans_out.csv (optional)')
    ap.add_argument('--encoding', default='utf-8')
    ap.add_argument('--no-uuid', action='store_true')
    ap.add_argument('--quality-report', action='store_true')
    ap.add_argument('--verbose', action='store_true', help='Print extra debug info about loaded files and row counts')
    return ap.parse_args()

# ---------------- Helpers ----------------

def latest(pattern: str, base: Path) -> Optional[Path]:
    matches = sorted(glob.glob(str(base / pattern)))
    return Path(matches[-1]) if matches else None

def latest_any(patterns: list[str], base: Path) -> Optional[Path]:
    for p in patterns:
        found = latest(p, base)
        if found:
            return found
    return None

def read_rows(path: Path, encoding: str) -> List[Dict[str,Any]]:
    with path.open('r', encoding=encoding, newline='') as f:
        reader = csv.DictReader(f)
        rows: List[Dict[str,Any]] = []
        for r in reader:
            if all((v is None or str(v).strip()=='' for v in r.values())):
                continue
            rows.append({k.strip(): (v.strip() if isinstance(v,str) else v) for k,v in r.items()})
        return rows

def det_uuid(kind: str, *parts: str, enabled: bool=True) -> str:
    if not enabled:
        return ''
    key = f'{kind}:' + ':'.join(str(p) for p in parts)
    return str(uuid.uuid5(uuid.NAMESPACE_URL, key))

def clean_email(raw: str|None) -> Tuple[str,str,bool,List[str]]:
    issues: List[str] = []
    if not raw:
        return ('','', False, ['empty_email'])
    orig = raw.strip()
    if '@' not in orig:
        return (orig,'', False, ['missing_at'])
    norm = orig.lower()
    if norm in PLACEHOLDER_EMAILS:
        return (orig,'', False, ['placeholder_email'])
    if not EMAIL_RE.match(norm):
        return (orig,'', False, ['invalid_format'])
    return (orig, norm, True, issues)

PHONE_DIGITS_RE = re.compile(r'\d+')
def clean_phone(raw: str|None) -> Tuple[str,str,bool,List[str]]:
    issues: List[str] = []
    if not raw:
        return ('','', False, ['empty_phone'])
    # Handle float strings like "900219794.0"
    raw_str = str(raw).strip()
    if raw_str.endswith('.0'):
        raw_str = raw_str[:-2]
    
    groups = PHONE_DIGITS_RE.findall(raw_str)
    if not groups:
        return (raw_str,'', False, ['no_digits'])
    
    # Try each digit group as a potential phone number
    for g in groups:
        # Remove leading zeros for 11-digit numbers
        cand = g[1:] if len(g)==11 and g.startswith('0') else g
        # Accept 10-digit numbers with variety
        if len(cand)==10 and len(set(cand))>1:
            return (raw_str, '+91'+cand, True, issues)
    
    # For 9-digit numbers, try adding leading digit
    longest = max(groups, key=len)
    if len(longest)==9 and len(set(longest))>1:
        return (raw_str, '+91' + '0' + longest, True, issues)
    
    # For very long numbers (11-13 digits), check if it starts with country code
    if 11 <= len(longest) <= 13:
        if longest.startswith('91') and len(longest) in (12,13):
            return (raw_str, '+'+longest, True, issues)
        # Try treating as 10-digit with extra digits
        if len(longest) >= 10:
            candidate = longest[-10:]  # Take last 10 digits
            if len(set(candidate)) > 1:
                return (raw_str, '+91'+candidate, True, issues)
    
    # Fallback: if we have at least 7 digits and some variety, mark as phone but flag issue
    if len(longest) >= 7 and len(set(longest)) > 1:
        if len(longest) == 10:
            return (raw_str, '+91'+longest, True, issues)
        else:
            return (raw_str, '+91'+longest.zfill(10), True, ['padded_short'])
    
    if len(longest) < 7:
        return (raw_str,'', False, ['too_short'])
    if len(set(longest))==1:
        return (raw_str,'', False, ['repeated_digit'])
    return (raw_str,'', False, ['unhandled_pattern'])

def parse_date(raw: str|None, field: str, issues: List[Dict[str,Any]]) -> str:
    if not raw:
        return ''
    val = raw.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(val, fmt).date().isoformat()
        except ValueError:
            continue
    issues.append({'legacy_id':'','field':f'date_{field}','issues':'invalid_date','raw':val})
    return ''

def load_simple_map(path: Path, key_col: str, val_col: str) -> Dict[str,str]:
    if not path or not path.exists():
        return {}
    rows = read_rows(path, 'utf-8')
    out: Dict[str,str] = {}
    for r in rows:
        k = str(r.get(key_col,'')).strip()
        v = str(r.get(val_col,'')).strip()
        if k and v:
            out[k] = v
    return out

def find_academic_dir(given: Optional[str]) -> Optional[Path]:
    if given:
        p = Path(given)
        return p if p.exists() else None
    for candidate in (Path('out/academic_data'), Path('out')):
        if (candidate/'courses_out.csv').exists():
            return candidate
    return None

# ---------------- Core transform ----------------

def main():
    args = parse_args()
    old = Path(args.old_data_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    make_uuid = not args.no_uuid

    issues: List[Dict[str,Any]] = []

    # Locate legacy files
    admission_path = latest_any(ADMISSION_PATTERNS, old)
    if not admission_path:
        raise FileNotFoundError(f'No admission file ({ADMISSION_PATTERNS}) in {old}')
    profile_path = latest_any(PROFILE_PATTERNS, old)
    promotion_path = latest_any(PROMOTION_PATTERNS, old)

    admission_rows = read_rows(admission_path, args.encoding)
    profile_rows = read_rows(profile_path, args.encoding) if profile_path else []
    promotion_rows = read_rows(promotion_path, args.encoding) if promotion_path else []
    if args.verbose:
        print(f'[DEBUG] Admissions file: {admission_path.name} rows={len(admission_rows)}')
        if profile_path:
            print(f'[DEBUG] Profiles file:  {profile_path.name} rows={len(profile_rows)}')
        else:
            print('[DEBUG] No profile file found')
        if promotion_path:
            print(f'[DEBUG] Promotions file: {promotion_path.name} rows={len(promotion_rows)}')
        else:
            print('[DEBUG] No promotions file found')

    # Academic mappings
    academic_dir = find_academic_dir(args.academic_dir)
    if not academic_dir:
        raise FileNotFoundError('Could not locate academic data (courses_out.csv)')
    course_map = load_simple_map(academic_dir/'courses_out.csv', 'legacy_id', 'id')
    session_map = load_simple_map(academic_dir/'academic_sessions_out.csv', 'legacy_id', 'id')

    # Agents mapping
    agents_dir = Path(args.agents_dir) if args.agents_dir else Path('out/agents')
    agent_map = load_simple_map(agents_dir/'agents_out.csv', 'legacy_id', 'id') if (agents_dir/'agents_out.csv').exists() else {}

    # Fee plans mapping (optional)
    fees_dir = Path(args.fees_dir) if args.fees_dir else Path('out/feetable')
    fee_plan_map = load_simple_map(fees_dir/'fee_plans_out.csv', 'legacy_id', 'id') if (fees_dir/'fee_plans_out.csv').exists() else {}

    # Profile index by legacy student id (best effort)
    profile_by_legacy: Dict[str,Dict[str,Any]] = {}
    for pr in profile_rows:
        legacy = pr.get('student_id') or pr.get('legacy_student_id') or pr.get('id')
        if not legacy:
            continue
        profile_by_legacy[str(legacy).strip()] = pr

    # Students + all associated tables
    students: Dict[str,Dict[str,Any]] = {}  # legacy_student_id -> row
    enrollments: List[Dict[str,Any]] = []
    contacts: List[Dict[str,Any]] = []
    addresses: List[Dict[str,Any]] = []
    identity_docs: List[Dict[str,Any]] = []
    prior_education: List[Dict[str,Any]] = []
    internal_refs: List[Dict[str,Any]] = []
    notes: List[Dict[str,Any]] = []
    fee_adjustments: List[Dict[str,Any]] = []
    
    # Global contact deduplication tracker: (student_id, value_norm) -> bool
    global_contact_tracker: set[tuple[str,str]] = set()

    for r in admission_rows:
        legacy = r.get('studentid') or r.get('legacy_student_id') or r.get('id') or r.get('student_id')
        if not legacy:
            continue
        legacy_str = str(legacy).strip()
        # Prefer explicit name field from legacy (stu_name/student_name/name) without fallback synthetic label unless totally missing
        name = (r.get('stu_name') or r.get('student_name') or r.get('name') or '').strip()
        if not name:
            name = f'UNKNOWN_{legacy_str}'
        # Save or overwrite student (last wins)
        if legacy_str in students:
            issues.append({'legacy_id': legacy_str, 'field': 'student', 'issues': 'duplicate_student', 'raw': ''})
        student_id = det_uuid('student', legacy_str, enabled=make_uuid)
        status = 'active'
        students[legacy_str] = {
            'id': student_id,
            'legacy_student_id': legacy_str,
            'full_name': name,
            'status': status
        }

        # Course / session mapping
        legacy_course = str(r.get('crsid') or r.get('course_id') or '').strip()
        legacy_session = str(r.get('ssnid') or r.get('session_id') or '').strip()
        course_id = course_map.get(legacy_course)
        session_id = session_map.get(legacy_session) if legacy_session else ''
        if not course_id:
            issues.append({'legacy_id': legacy_str, 'field': 'course_id', 'issues': 'missing_course', 'raw': legacy_course})
            # Continue with empty course_id instead of skipping - student still gets created
            course_id = ''
        if legacy_session and not session_id:
            issues.append({'legacy_id': legacy_str, 'field': 'session_id', 'issues': 'missing_session', 'raw': legacy_session})

        enrollment_id = det_uuid('enrollment', legacy_str, legacy_course, legacy_session, enabled=make_uuid)

        # Dates
        enrollment_date_raw = r.get('doa') or r.get('admission_date') or r.get('enrollment_date') or ''
        joining_date_raw = r.get('doj') or r.get('joining_date') or ''
        enrollment_date = parse_date(enrollment_date_raw, 'enrollment_date', issues) if enrollment_date_raw else ''
        joining_date = parse_date(joining_date_raw, 'joining_date', issues) if joining_date_raw else ''

        entry_year = r.get('admsn_yr1') or r.get('entry_year') or ''
        entry_year_norm = ''
        if entry_year:
            try:
                entry_year_norm = str(int(str(entry_year).strip()))
            except ValueError:
                issues.append({'legacy_id': legacy_str, 'field': 'entry_year', 'issues': 'parse_error:entry_year', 'raw': str(entry_year)})

        entry_type = 'lateral' if r.get('lateral_entry') else 'regular'

        agent_legacy = str(r.get('ref_by') or r.get('agent_id') or '').strip()
        agent_id = agent_map.get(agent_legacy, '') if agent_legacy else ''
        fee_plan_legacy = str(r.get('fee_plan_legacy_id') or '').strip()
        fee_plan_id = fee_plan_map.get(fee_plan_legacy, '') if fee_plan_legacy else ''

        enrollment_code = (r.get('enrol_id') or r.get('admission_code') or r.get('enrollment_code') or '').strip()

        enrollments.append({
            'id': enrollment_id,
            'student_id': student_id,
            'course_id': course_id,  # May be empty if mapping failed
            'session_id': session_id,
            'enrollment_code': enrollment_code,
            'enrollment_date': enrollment_date,
            'joining_date': joining_date,
            'entry_year': entry_year_norm,
            'entry_type': entry_type,
            'agent_id': agent_id,
            'fee_plan_id': fee_plan_id,
            'status': 'active'
        })

        # Contact from admission file (contact_no)
        contact_no = r.get('contact_no')
        if contact_no:
            p_raw, p_norm, valid, p_issues = clean_phone(contact_no)
            if valid and (student_id, p_norm) not in global_contact_tracker:
                contacts.append({
                    'id': det_uuid('studentcontact', legacy_str, 'admission_phone', p_norm, enabled=make_uuid),
                    'student_id': student_id,
                    'contact_type': 'phone',
                    'value_raw': p_raw,
                    'value_norm': p_norm,
                    'is_primary': True
                })
                global_contact_tracker.add((student_id, p_norm))
            elif p_issues:
                issues.append({'legacy_id': legacy_str, 'field': 'contact_no', 'issues': 'phone_invalid:'+'|'.join(p_issues), 'raw': p_raw})

        # Notes from remark
        remark = (r.get('remark') or '').strip()
        if remark:
            notes.append({
                'id': det_uuid('studentnote', legacy_str, enabled=make_uuid),
                'student_id': student_id,
                'note': remark
            })
            # Check for discount keywords
            discount_keywords = ['dis', 'discount', 'scholar', 'waive', 'waiver', 'concession']
            if any(k in remark.lower() for k in discount_keywords):
                fee_adjustments.append({
                    'id': det_uuid('stuadjust', legacy_str, 'remark', enabled=make_uuid),
                    'enrollment_id': enrollment_id,
                    'fee_plan_item_id': '',
                    'adjustment_type': 'discount',
                    'amount': '',
                    'reason': remark,
                    'source': 'remark'
                })

    # Process profiles for all additional data
    profiles_out: List[Dict[str,Any]] = []
    for legacy_id, stu in students.items():
        profile_src = profile_by_legacy.get(legacy_id, {})
        
        # Basic profile
        dob = profile_src.get('dob') or profile_src.get('date_of_birth')
        dob_iso = parse_date(dob, 'dob', issues) if dob else ''
        gender = (profile_src.get('gender') or '').strip().lower()
        if gender and gender not in ('male','female','other'):
            gender = ''
        profiles_out.append({
            'student_id': stu['id'],
            'mother_name': profile_src.get('mother_name',''),
            'father_name': profile_src.get('father_name',''),
            'dob': dob_iso,
            'gender': gender,
            'category': profile_src.get('category',''),
            'nationality': profile_src.get('nationality','')
        })

        # Addresses
        perm_addr = profile_src.get('permanent_address')
        if perm_addr:
            addresses.append({
                'id': det_uuid('stuaddr', legacy_id, 'permanent', enabled=make_uuid),
                'student_id': stu['id'],
                'addr_type': 'permanent',
                'address_text': perm_addr,
                'state': profile_src.get('state',''),
                'country': ''
            })
        corr_addr = profile_src.get('correspondence_address')
        if corr_addr and corr_addr != perm_addr:
            addresses.append({
                'id': det_uuid('stuaddr', legacy_id, 'correspondence', enabled=make_uuid),
                'student_id': stu['id'],
                'addr_type': 'correspondence',
                'address_text': corr_addr,
                'state': profile_src.get('state',''),
                'country': ''
            })

        # Identity documents
        if profile_src.get('id_type') or profile_src.get('id_number'):
            identity_docs.append({
                'id': det_uuid('studoc', legacy_id, enabled=make_uuid),
                'student_id': stu['id'],
                'doc_type': profile_src.get('id_type',''),
                'doc_number': profile_src.get('id_number',''),
                'is_primary': True
            })

        # Additional contacts from profile
        for contact_field, contact_type in [('parent_phone', 'parent_phone'), ('guardian_phone', 'guardian_phone'), ('phone', 'phone')]:
            raw_val = profile_src.get(contact_field)
            if raw_val:
                p_raw, p_norm, valid, p_issues = clean_phone(raw_val)
                if valid and (stu['id'], p_norm) not in global_contact_tracker:
                    contacts.append({
                        'id': det_uuid('stucontact', legacy_id, contact_type, p_norm, enabled=make_uuid),
                        'student_id': stu['id'],
                        'contact_type': contact_type,
                        'value_raw': p_raw,
                        'value_norm': p_norm,
                        'is_primary': False
                    })
                    global_contact_tracker.add((stu['id'], p_norm))
                elif p_issues:
                    issues.append({'legacy_id': legacy_id, 'field': contact_field, 'issues': 'phone_invalid:'+'|'.join(p_issues), 'raw': raw_val})

        # Email contact
        email_val = profile_src.get('email')
        if email_val:
            e_raw, e_norm, e_valid, e_issues = clean_email(email_val)
            if e_valid and (stu['id'], e_norm) not in global_contact_tracker:
                contacts.append({
                    'id': det_uuid('stucontact', legacy_id, 'email', e_norm, enabled=make_uuid),
                    'student_id': stu['id'],
                    'contact_type': 'email',
                    'value_raw': e_raw,
                    'value_norm': e_norm,
                    'is_primary': False
                })
                global_contact_tracker.add((stu['id'], e_norm))
            elif e_issues:
                issues.append({'legacy_id': legacy_id, 'field': 'email', 'issues': 'email_invalid:'+'|'.join(e_issues), 'raw': email_val})

        # Prior education
        if any(profile_src.get(k) for k in ['exam_passed','year_of_passing','university_board','marks_percentage']):
            prior_education.append({
                'id': det_uuid('stuprior', legacy_id, enabled=make_uuid),
                'student_id': stu['id'],
                'level': profile_src.get('exam_passed',''),
                'board_university': profile_src.get('university_board',''),
                'year_of_passing': profile_src.get('year_of_passing',''),
                'marks_percentage': profile_src.get('marks_percentage','')
            })

        # Internal refs (card_1 through card_4, eno_1 through eno_8)
        for i in range(1, 5):
            card_val = profile_src.get(f'card_{i}')
            if card_val:
                internal_refs.append({
                    'id': det_uuid('sturef', legacy_id, 'card', i, enabled=make_uuid),
                    'student_id': stu['id'],
                    'ref_group': 'card',
                    'slot_number': i,
                    'raw_value': card_val
                })
        for i in range(1, 9):
            eno_val = profile_src.get(f'eno_{i}')
            if eno_val:
                internal_refs.append({
                    'id': det_uuid('sturef', legacy_id, 'eno', i, enabled=make_uuid),
                    'student_id': stu['id'],
                    'ref_group': 'eno',
                    'slot_number': i,
                    'raw_value': eno_val
                })

    # Promotions -> progressions
    progressions_out: List[Dict[str,Any]] = []
    if promotion_rows:
        enrollment_by_student: Dict[str,str] = {e['student_id']: e['id'] for e in enrollments}
        for pr in promotion_rows:
            stu_legacy = str(pr.get('student_id') or pr.get('legacy_student_id') or '').strip()
            if not stu_legacy:
                continue
            stu = students.get(stu_legacy)
            if not stu:
                continue
            enrollment_id = enrollment_by_student.get(stu['id'])
            if not enrollment_id:
                issues.append({'legacy_id': stu_legacy, 'field': 'promotion', 'issues': 'promotion_missing_enrollment', 'raw': ''})
                continue
            legacy_promo_id = str(pr.get('promotion_id') or pr.get('id') or '')
            to_year = str(pr.get('curr_year') or pr.get('to_year') or '').strip()
            from_year = ''
            if to_year.isdigit():
                ty = int(to_year)
                from_year = str(ty-1) if ty>1 else ''
            course_duration = str(pr.get('duration') or pr.get('course_duration') or '').strip()
            eff_raw = pr.get('promotion_date') or pr.get('effective_date') or pr.get('date') or ''
            effective_date = parse_date(eff_raw, 'effective_date', issues) if eff_raw else ''
            status = (pr.get('status') or '').strip().lower() or 'promoted'
            if status not in ('new_admission','promoted','repeated','withdrawn'):
                status = 'promoted'
            progression_id = det_uuid('progression', stu_legacy, legacy_promo_id or to_year, enabled=make_uuid)
            progressions_out.append({
                'id': progression_id,
                'enrollment_id': enrollment_id,
                'from_year': from_year,
                'to_year': to_year,
                'course_duration': course_duration,
                'effective_date': effective_date,
                'status': status,
                'legacy_promotion_id': legacy_promo_id,
                'notes': pr.get('notes','')
            })

    # Write outputs
    def write_csv(path: Path, headers: List[str], rows: Iterable[Dict[str,Any]]):
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('w', encoding='utf-8', newline='') as f:
            w = csv.DictWriter(f, fieldnames=headers)
            w.writeheader()
            for r in rows:
                w.writerow({h: r.get(h,'') for h in headers})

    write_csv(out_dir/'students_out.csv', ['id','legacy_student_id','full_name','status'], students.values())
    write_csv(out_dir/'student_profiles_out.csv', ['student_id','mother_name','father_name','dob','gender','category','nationality'], profiles_out)
    write_csv(out_dir/'student_enrollments_out.csv', ['id','student_id','course_id','session_id','enrollment_code','enrollment_date','joining_date','entry_year','entry_type','agent_id','fee_plan_id','status'], enrollments)
    write_csv(out_dir/'student_contacts_out.csv', ['id','student_id','contact_type','value_raw','value_norm','is_primary'], contacts)
    write_csv(out_dir/'student_addresses_out.csv', ['id','student_id','addr_type','address_text','state','country'], addresses)
    write_csv(out_dir/'student_identity_documents_out.csv', ['id','student_id','doc_type','doc_number','is_primary'], identity_docs)
    write_csv(out_dir/'student_prior_education_out.csv', ['id','student_id','level','board_university','year_of_passing','marks_percentage'], prior_education)
    write_csv(out_dir/'student_internal_refs_out.csv', ['id','student_id','ref_group','slot_number','raw_value'], internal_refs)
    write_csv(out_dir/'student_notes_out.csv', ['id','student_id','note'], notes)
    write_csv(out_dir/'student_fee_adjustments_out.csv', ['id','enrollment_id','fee_plan_item_id','adjustment_type','amount','reason','source'], fee_adjustments)
    write_csv(out_dir/'student_fee_overrides_out.csv', ['id','enrollment_id','fee_plan_item_id','year_number','component_code','override_amount','discount_amount','reason','source'], [])  # placeholder
    if progressions_out:
        write_csv(out_dir/'student_progressions_out.csv', ['id','enrollment_id','from_year','to_year','course_duration','effective_date','status','legacy_promotion_id','notes'], progressions_out)
    if args.quality_report and issues:
        write_csv(out_dir/'student_quality_issues.csv', ['legacy_id','field','issues','raw'], issues)

    print('=== Student Transform Summary ===')
    print(f'Legacy admission source: {admission_path.name}')
    if profile_path:
        print(f'Legacy profile source: {profile_path.name}')
    if promotion_path:
        print(f'Legacy promotion source: {promotion_path.name}')
    print(f'Students: {len(students)}  Enrollments: {len(enrollments)}  Contacts: {len(contacts)}  Progressions: {len(progressions_out)}')
    print(f'Addresses: {len(addresses)}  Identity Docs: {len(identity_docs)}  Prior Ed: {len(prior_education)}  Internal Refs: {len(internal_refs)}')
    print(f'Notes: {len(notes)}  Fee Adjustments: {len(fee_adjustments)}')
    print(f'Output dir: {out_dir.resolve()}')
    print(f'Output dir: {out_dir.resolve()}')
    if args.quality_report:
        print(f'Quality issues: {len(issues)} (student_quality_issues.csv)')

if __name__ == '__main__':
    main()
