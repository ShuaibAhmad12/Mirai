#!/usr/bin/env python3
"""Legacy agent CSV -> normalized agent & agent_contacts output.

Reads latest alpine_gp_agent_*.csv from ../old-data and produces:
  out/agents/agents_out.csv        (id, legacy_id, name, email_raw, email, phone_raw, phone_e164, status)
  out/agents/agent_contacts_out.csv(id, agent_id, contact_type, value_raw, value_norm, is_primary)

Deterministic UUIDs (uuid5) used unless --no-uuid.
Normalization:
  * email -> lowercased trimmed if it contains '@'
  * phone -> keep only digits; if 10 digits assume India (+91) and build +91XXXXXXXXXX
  * status -> active if phone/email present else 0
  * duplicates by legacy_id collapsed (last occurrence wins)

Usage:
  python3 agent_transform.py
  python3 agent_transform.py --out-dir out/agents --no-uuid
"""
from __future__ import annotations
import csv, glob, uuid, argparse, re
from pathlib import Path
from typing import Dict, Any, List, Iterable

DEFAULT_OLD = (Path(__file__).parent.parent / 'old-data').resolve()
AGENT_PATTERN = 'alpine_gp_agent_*.csv'

TRUTHY = {'1','true','t','yes','y','on'}


def parse_args():
    ap = argparse.ArgumentParser(description='Transform legacy agent CSV')
    ap.add_argument('--out-dir', default='out/agents', help='Output directory')
    ap.add_argument('--encoding', default='utf-8')
    ap.add_argument('--no-uuid', action='store_true')
    ap.add_argument('--quality-report', action='store_true', help='Emit agent_quality_issues.csv with detected data issues')
    return ap.parse_args()


def latest(pattern: str, base: Path) -> Path:
    matches = sorted(glob.glob(str(base / pattern)))
    if not matches:
        raise FileNotFoundError(f'No files match {pattern} in {base}')
    return Path(matches[-1])


def read_rows(path: Path, encoding: str) -> List[Dict[str,Any]]:
    with path.open('r', encoding=encoding, newline='') as f:
        reader = csv.DictReader(f)
        rows = []
        for r in reader:
            if all((v is None or str(v).strip()=='' for v in r.values())):
                continue
            rows.append({k.strip(): (v.strip() if isinstance(v,str) else v) for k,v in r.items()})
        return rows


EMAIL_RE = re.compile(r"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$", re.IGNORECASE)

PLACEHOLDER_EMAILS = {"test@test.com","example@example.com"}

def clean_email(raw: str|None) -> tuple[str,str,bool,list[str]]:
    """Return (raw, normalized, is_valid, issues)."""
    issues: list[str] = []
    if not raw:
        return ('','', False, ['empty_email'])
    original = raw.strip()
    if '@' not in original:
        return (original, '', False, ['missing_at'])
    norm = original.lower()
    if norm in PLACEHOLDER_EMAILS:
        return (original, '', False, ['placeholder_email'])
    if not EMAIL_RE.match(norm):
        return (original, '', False, ['invalid_format'])
    return (original, norm, True, issues)


def clean_phone(raw: str|None) -> tuple[str,str,bool,list[str]]:
    """Return (raw, e164, is_valid, issues). Accepts messy inputs with dots / dashes.
    Rules:
      * Extract all digit groups; evaluate each for 10-digit candidate (India assumed +91)
      * Reject if all digits identical, or obvious placeholder (0 / 12323 etc < 7 length)
      * If >10 digits treat as already including country if starts with country code (no leading zero) else invalid
    """
    issues: list[str] = []
    if not raw:
        return ('','', False, ['empty_phone'])
    groups = re.findall(r'\d+', raw)
    if not groups:
        return (raw, '', False, ['no_digits'])
    # prefer first 10-digit group
    for g in groups:
        # strip leading 0 if length 11 and starts with 0
        cand = g[1:] if len(g)==11 and g.startswith('0') else g
        if len(cand) == 10:
            if len(set(cand)) == 1:
                issues.append('repeated_digit')
                continue
            return (raw, '+91'+cand, True, issues)
    # Fallback: longest group as candidate if 7-13 digits
    longest = max(groups, key=len)
    if len(longest) < 7:
        return (raw, '', False, ['too_short'])
    if len(set(longest)) == 1:
        return (raw, '', False, ['repeated_digit'])
    if len(longest) == 10:
        return (raw, '+91'+longest, True, issues)
    if 11 <= len(longest) <= 13 and longest.startswith('91') and len(longest) in (12,13):
        # Already includes 91
        return (raw, '+'+longest, True, issues)
    return (raw, '', False, ['unhandled_pattern'])


def det_uuid(kind: str, legacy_id: str, *parts: str, enabled: bool=True) -> str:
    if not enabled:
        return ''
    key = f'{kind}:{legacy_id}:' + ':'.join(parts)
    return str(uuid.uuid5(uuid.NAMESPACE_URL, key))


def transform(rows: List[Dict[str,Any]], make_uuid: bool, collect_quality: bool=False):
    by_legacy: Dict[str,Dict[str,Any]] = {}
    issues: List[Dict[str,Any]] = []
    for r in rows:
        legacy = r.get('agentsid') or r.get('legacy_id') or r.get('id')
        if not legacy:
            continue
        legacy_str = str(legacy).strip()
        name = (r.get('agentname') or '').strip() or f'Agent {legacy_str}'
        email_raw, email_norm, email_valid, email_issues = clean_email(r.get('email'))
        phone_raw, phone_norm, phone_valid, phone_issues = clean_phone(r.get('contact'))
        status = 1 if (email_valid or phone_valid) else 0
        agent_id = det_uuid('agent', legacy_str, enabled=make_uuid)
        by_legacy[legacy_str] = {
            'id': agent_id,
            'legacy_id': legacy_str,
            'name': name,
            'email_raw': email_raw,
            'email': email_norm,
            'phone_raw': phone_raw,
            'phone_e164': phone_norm,
            'status': status,
        }
        if collect_quality:
            if email_issues:
                issues.append({'legacy_id': legacy_str, 'field': 'email', 'issues': '|'.join(email_issues), 'raw': email_raw})
            if phone_issues:
                issues.append({'legacy_id': legacy_str, 'field': 'phone', 'issues': '|'.join(phone_issues), 'raw': phone_raw})

    # Contacts list
    contacts: List[Dict[str,Any]] = []
    for a in by_legacy.values():
        # email contact
        if a['email']:
            contacts.append({
                'id': det_uuid('agentcontact', a['legacy_id'], 'email', enabled=make_uuid),
                'agent_id': a['id'],
                'contact_type': 'email',
                'value_raw': a['email_raw'],
                'value_norm': a['email'],
                'is_primary': True
            })
        if a['phone_e164']:
            contacts.append({
                'id': det_uuid('agentcontact', a['legacy_id'], 'phone', enabled=make_uuid),
                'agent_id': a['id'],
                'contact_type': 'phone',
                'value_raw': a['phone_raw'],
                'value_norm': a['phone_e164'],
                'is_primary': False if a['email'] else True
            })
    return list(by_legacy.values()), contacts, issues


def write_csv(path: Path, fieldnames: list[str], rows: List[Dict[str,Any]]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k,'') for k in fieldnames})


def main():
    args = parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    legacy_path = latest(AGENT_PATTERN, DEFAULT_OLD)
    rows = read_rows(legacy_path, args.encoding)
    make_uuid = not args.no_uuidd if hasattr(args,'no_uuidd') else not args.no_uuid

    agents_rows, contacts_rows, issues = transform(rows, make_uuid, collect_quality=args.quality_report)

    write_csv(out_dir / 'agents_out.csv', ['id','legacy_id','name','email_raw','email','phone_raw','phone_e164','status'], agents_rows)
    write_csv(out_dir / 'agent_contacts_out.csv', ['id','agent_id','contact_type','value_raw','value_norm','is_primary'], contacts_rows)
    if args.quality_report and issues:
        write_csv(out_dir / 'agent_quality_issues.csv', ['legacy_id','field','issues','raw'], issues)

    print('=== Agent Transform Summary ===')
    print(f'Legacy source: {legacy_path.name}')
    print(f'Agents: {len(agents_rows)}  Contacts: {len(contacts_rows)}')
    if args.quality_report:
        print(f'Quality issue rows: {len(issues)} (agent_quality_issues.csv)')
    print(f'Output dir: {out_dir.resolve()}')

if __name__ == '__main__':
    main()
