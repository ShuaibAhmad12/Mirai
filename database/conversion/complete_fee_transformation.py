#!/usr/bin/env python3
"""
Complete Legacy Fee Data Transformation Script
==============================================

This script transforms ALL legacy fee receipt data from a    def generate_unique_receipt_number(self, legacy_receipt_no, legacy_id: str) -> str:
    
        # Convert to string and handle None/empty values
        if legacy_receipt_no is not None:
            clean_receipt_no = str(legacy_receipt_no).strip()
            if clean_receipt_no and clean_receipt_no != '0':
                if clean_receipt_no not in self.used_receipt_numbers:
                    self.used_receipt_numbers.add(clean_receipt_no)
                    return clean_receipt_no
        
        # If original is empty, zero, or duplicate, generate a unique one
        while True:
            new_receipt_no = f"MIG-{self.receipt_counter:06d}"
            if new_receipt_no not in self.used_receipt_numbers:
                self.used_receipt_numbers.add(new_receipt_no)
                self.receipt_counter += 1
                return new_receipt_no
            self.receipt_counter += 1eipts_20250904_140520.csv
into the new normalized fee ledger structure with complete CSV files ready for database import.

Features:
- Processes all 6,245+ legacy fee records
- Maps legacy student IDs to enrollment IDs using existing mappings
- Creates proper fee component allocations
- Generates event-sourced ledger entries
- Handles payment method standardization
- Creates complete import-ready CSV files
"""

import csv
import os
import sys
import pandas as pd
import uuid
from datetime import datetime, date
from typing import Dict, List, Optional
import re

class CompleteFeeDataTransformer:
    def __init__(self):
        """Initialize the transformer with paths and mappings."""
        self.base_path = "/Users/pawankathait/Documents/fullstack-nextjs/alpine_2025_08/miraisetu/database/conversion"
        self.out_path = os.path.join(self.base_path, "out")
        self.templates_path = os.path.join(self.out_path, "fee_ledger_templates")
        self.legacy_data_path = os.path.join(os.path.dirname(self.base_path), "old-data")
        
        # Ensure output directory exists
        os.makedirs(self.templates_path, exist_ok=True)
        
        # Data containers
        self.enrollment_lookup = {}
        self.student_lookup = {}
        self.fee_component_mappings = {}
        self.legacy_receipts = []
        self.legacy_balance_records = []
        self.current_balances = []
        
        # Receipt tracking for unique numbering
        self.used_receipt_numbers = set()
        self.receipt_counter = 1
        
        # Output data
        self.transformed_receipts = []
        self.transformed_events = []
        self.transformed_allocations = []
        self.transformed_balance_records = []
        
        print("🚀 Starting Complete Fee Data Transformation")
        print("=" * 60)
        
    def load_mappings(self):
        """Load all required mappings from existing CSV files."""
        print("📋 Loading enrollment and student mappings...")
        
        # Load student enrollments
        enrollment_file = os.path.join(self.out_path, "students", "student_enrollments_out.csv")
        if os.path.exists(enrollment_file):
            enrollment_df = pd.read_csv(enrollment_file)
            print(f"✅ Loaded {len(enrollment_df)} enrollment records")
            
            # Create lookup by enrollment code (maps to enrol_id in legacy data)
            for _, row in enrollment_df.iterrows():
                enrollment_code = row['enrollment_code']
                self.enrollment_lookup[enrollment_code] = {
                    'enrollment_id': row['id'],
                    'student_id': row['student_id'],
                    'course_id': row['course_id'],
                    'session_id': row['session_id']
                }
        
        # Load students for additional mapping
        student_file = os.path.join(self.out_path, "students", "students_out.csv")
        if os.path.exists(student_file):
            student_df = pd.read_csv(student_file)
            print(f"✅ Loaded {len(student_df)} student records")
            
            # Create lookup by legacy_student_id (maps to student_id in legacy fee data)
            for _, row in student_df.iterrows():
                if pd.notna(row['legacy_student_id']):
                    self.student_lookup[str(row['legacy_student_id'])] = {
                        'student_id': row['id'],
                        'full_name': row.get('full_name', ''),
                        'status': row.get('status', 'active')
                    }
        
        print(f"📊 Mapping summary:")
        print(f"   - {len(self.enrollment_lookup)} enrollment codes mapped")
        print(f"   - {len(self.student_lookup)} legacy student IDs mapped")
        
    def create_fee_components(self):
        """Create standard fee component mappings using actual database IDs."""
        print("🏗️  Creating fee component mappings...")
        
        # Using actual fee component IDs from the database (from screenshot)
        self.fee_component_mappings = {
            'reg_fee': {
                'id': '6dd45f0c-5e4d-4024-8a50-494761a01c33',  # ADMISSION from database
                'code': 'ADMISSION',
                'label': 'Admission Fee',
                'legacy_field': 'reg_fee'
            },
            'sec_fee': {
                'id': '1c2c736d-2d77-4956-8b5b-2ad385d032e0',  # SECURITY from database
                'code': 'SECURITY',
                'label': 'Security Fee',
                'legacy_field': 'sec_fee'
            },
            'tut_fee': {
                'id': 'dd319c9-03de-4595-88a5-a2c3807f99bd',   # TUITION from database
                'code': 'TUITION',
                'label': 'Tuition Fee',
                'legacy_field': 'tut_fee'
            },
            'other_fee': {
                'id': '50456145-6cad-4b8c-a05c-22dd74e4a40a',  # OTHER from database
                'code': 'OTHER',
                'label': 'Other Fee',
                'legacy_field': 'other_fee'
            }
        }
        
        # Note: Using existing fee component IDs from database, not generating new CSV
        print(f"✅ Mapped {len(self.fee_component_mappings)} fee components to existing database IDs")
        
    def load_legacy_data(self):
        """Load all legacy fee data files."""
        print("📂 Loading legacy fee data...")
        
        # Load fee receipts
        legacy_receipts_file = os.path.join(self.legacy_data_path, "alpine_fees_feereceipts_20250904_140520.csv")
        if not os.path.exists(legacy_receipts_file):
            raise FileNotFoundError(f"Legacy receipts file not found: {legacy_receipts_file}")
        legacy_receipts_df = pd.read_csv(legacy_receipts_file)
        self.legacy_receipts = legacy_receipts_df.to_dict('records')
        print(f"✅ Loaded {len(self.legacy_receipts)} legacy fee receipts")
        
        # Load balance records (AFTER payment snapshots)
        legacy_balance_file = os.path.join(self.legacy_data_path, "alpine_fees_feereceiptbalancerecord_20250904_140519.csv")
        if os.path.exists(legacy_balance_file):
            balance_df = pd.read_csv(legacy_balance_file)
            self.legacy_balance_records = balance_df.to_dict('records')
            print(f"✅ Loaded {len(self.legacy_balance_records)} legacy balance records")
        
        # Load current balances
        current_balance_file = os.path.join(self.legacy_data_path, "alpine_fees_feebalance_20250904_140519.csv")
        if os.path.exists(current_balance_file):
            current_balance_df = pd.read_csv(current_balance_file)
            self.current_balances = current_balance_df.to_dict('records')
            print(f"✅ Loaded {len(self.current_balances)} current balance records")
        
    def standardize_payment_method(self, method: str) -> str:
        """Standardize payment method to match enum values."""
        if not method or pd.isna(method):
            return 'OTHER'
            
        method = str(method).strip().upper()
        
        # Direct mappings based on actual data analysis
        mappings = {
            'CASH': 'CASH',
            'BANK': 'BANK',
            'QR PHONEPE': 'QR_PHONEPE',
            'QR PHONEPAY': 'QR_PHONEPE',
            'QR HDFC': 'QR_HDFC',
            'SWIPE': 'SWIPE',
            'CHEQUE': 'CHEQUE',
            'DD': 'DD',
            'QR': 'QR'
        }
        
        return mappings.get(method, 'OTHER')
        
    def safe_parse_date(self, date_str: str) -> pd.Timestamp:
        """Safely parse date string, handling malformed dates."""
        if not date_str or pd.isna(date_str):
            return pd.to_datetime('2023-01-01')
        
        try:
            # Handle common malformed date patterns
            date_str = str(date_str).strip()
            
            # Fix years that are clearly wrong (like 0024 instead of 2024)
            if date_str.startswith('00'):
                date_str = '20' + date_str[2:]
            
            # Try to parse the corrected date
            return pd.to_datetime(date_str)
        except:
            # If all else fails, return a default date
            return pd.to_datetime('2023-01-01')
    
    def determine_academic_year(self, date_str: str) -> str:
        """Determine academic year from date."""
        try:
            dt = self.safe_parse_date(date_str)
            year = dt.year
            
            # Academic year starts in July
            if dt.month >= 7:
                return f"{year}-{str(year+1)[2:]}"
            else:
                return f"{year-1}-{str(year)[2:]}"
        except:
            return "2023-24"
            
    def generate_unique_receipt_number(self, legacy_receipt_no, legacy_id: str) -> str:
        """Generate a unique receipt number, ensuring no duplicates."""
        # Convert to string and handle None/empty values
        if legacy_receipt_no is not None:
            clean_receipt_no = str(legacy_receipt_no).strip()
            if clean_receipt_no and clean_receipt_no != '0':
                if clean_receipt_no not in self.used_receipt_numbers:
                    self.used_receipt_numbers.add(clean_receipt_no)
                    return clean_receipt_no
        
        # If original is empty, zero, or duplicate, generate a unique one
        while True:
            new_receipt_no = f"MIG-{self.receipt_counter:06d}"
            if new_receipt_no not in self.used_receipt_numbers:
                self.used_receipt_numbers.add(new_receipt_no)
                self.receipt_counter += 1
                return new_receipt_no
            self.receipt_counter += 1
            
    def find_enrollment_id(self, legacy_receipt: dict) -> Optional[str]:
        """Find enrollment ID for a legacy receipt."""
        
        # Strategy 1: Direct enrollment code match (legacy enrol_id -> enrollment_code)
        enrol_id = legacy_receipt.get('enrol_id', '')
        if enrol_id and enrol_id in self.enrollment_lookup:
            return self.enrollment_lookup[enrol_id]['enrollment_id']
            
        # Strategy 2: Legacy student ID lookup and find matching enrollment
        legacy_student_id = str(legacy_receipt.get('student_id', ''))
        if legacy_student_id in self.student_lookup:
            mapped_student_id = self.student_lookup[legacy_student_id]['student_id']
            
            # Find enrollment for this student by searching through all enrollments
            for enrol_code, enrol_data in self.enrollment_lookup.items():
                if enrol_data['student_id'] == mapped_student_id:
                    return enrol_data['enrollment_id']
        
        # Strategy 3: Try extracting student ID from enrollment code for partial matching
        if enrol_id:
            # Many enrollment codes end with student ID like "AIMT(H)/10384/2023"
            # Extract the number before the year
            import re
            match = re.search(r'/(\d+)/\d{4}$', enrol_id)
            if match:
                extracted_student_id = match.group(1)
                if extracted_student_id in self.student_lookup:
                    mapped_student_id = self.student_lookup[extracted_student_id]['student_id']
                    
                    # Find enrollment for this student
                    for enrol_code, enrol_data in self.enrollment_lookup.items():
                        if enrol_data['student_id'] == mapped_student_id:
                            return enrol_data['enrollment_id']
        
        return None
        
    def calculate_total_amount(self, receipt: dict) -> float:
        """Calculate total amount from legacy receipt."""
        return sum([
            float(receipt.get('reg_fee', 0) or 0),
            float(receipt.get('sec_fee', 0) or 0),
            float(receipt.get('tut_fee', 0) or 0),
            float(receipt.get('other_fee', 0) or 0)
        ])
    
    def find_balance_record(self, receipt_id: str) -> dict:
        """Find the balance record (AFTER payment) for a given receipt."""
        for balance_record in self.legacy_balance_records:
            if str(balance_record.get('feereceipt_id', '')) == str(receipt_id):
                return balance_record
        return {}
    
    def reconstruct_student_fee_history(self, student_id: str, enrollment_id: str) -> List[Dict]:
        """Reconstruct complete fee history for a student by analyzing payment sequence."""
        # Get all receipts for this student, sorted by date
        student_receipts = []
        for receipt in self.legacy_receipts:
            if str(receipt.get('student_id', '')) == str(student_id):
                receipt_enrollment_id = self.find_enrollment_id(receipt)
                if receipt_enrollment_id == enrollment_id:
                    student_receipts.append(receipt)
        
        # Sort by fee_date to get chronological order
        student_receipts.sort(key=lambda x: self.safe_parse_date(x.get('fee_date', '1900-01-01')))
        
        # Reconstruct the history
        fee_events = []
        component_balances = {
            'reg_fee': 0.0,
            'sec_fee': 0.0, 
            'tut_fee': 0.0,
            'other_fee': 0.0
        }
        
        for receipt in student_receipts:
            # Get the balance AFTER this payment
            balance_record = self.find_balance_record(receipt.get('id', ''))
            
            # Calculate what the balance was BEFORE this payment
            payment_amounts = {
                'reg_fee': float(receipt.get('reg_fee', 0) or 0),
                'sec_fee': float(receipt.get('sec_fee', 0) or 0),
                'tut_fee': float(receipt.get('tut_fee', 0) or 0),
                'other_fee': float(receipt.get('other_fee', 0) or 0)
            }
            
            balance_after = {
                'reg_fee': float(balance_record.get('reg_balance', 0) or 0),
                'sec_fee': float(balance_record.get('sec_balance', 0) or 0),
                'tut_fee': float(balance_record.get('tut_balance', 0) or 0),
                'other_fee': float(balance_record.get('other_balance', 0) or 0)
            }
            
            # For first payment, we need to create charge events
            if not fee_events:
                for component, payment_amount in payment_amounts.items():
                    if payment_amount > 0:
                        balance_before = balance_after[component] + payment_amount
                        if balance_before > 0:
                            # Create initial charge event
                            charge_event = {
                                'receipt': receipt,
                                'component': component,
                                'event_type': 'CHARGE_CREATED',
                                'amount': balance_before,
                                'running_balance': balance_before,
                                'is_initial_charge': True
                            }
                            fee_events.append(charge_event)
            
            # Create payment events for this receipt
            for component, payment_amount in payment_amounts.items():
                if payment_amount > 0:
                    balance_before = balance_after[component] + payment_amount
                    payment_event = {
                        'receipt': receipt,
                        'component': component,
                        'event_type': 'PAYMENT_RECEIVED',
                        'amount': -payment_amount,  # Negative for payment
                        'running_balance': balance_after[component],
                        'is_initial_charge': False
                    }
                    fee_events.append(payment_event)
        
        return fee_events
        
    def transform_all_receipts(self):
        """Transform all legacy receipts to new structure with complete ledger history."""
        print("🔄 Transforming all legacy receipts with balance reconstruction...")
        
        processed_count = 0
        skipped_no_enrollment = 0
        unmapped_enrollments = set()
        unmapped_students = set()
        processed_enrollments = set()
        
        # Group receipts by enrollment to process complete fee history
        enrollment_receipts = {}
        for receipt in self.legacy_receipts:
            enrollment_id = self.find_enrollment_id(receipt)
            if not enrollment_id:
                unmapped_enrollments.add(receipt.get('enrol_id', 'UNKNOWN'))
                unmapped_students.add(str(receipt.get('student_id', 'UNKNOWN')))
                skipped_no_enrollment += 1
                continue
            
            if enrollment_id not in enrollment_receipts:
                enrollment_receipts[enrollment_id] = []
            enrollment_receipts[enrollment_id].append(receipt)
        
        # Process each enrollment's complete fee history
        for enrollment_id, receipts in enrollment_receipts.items():
            if enrollment_id in processed_enrollments:
                continue
            processed_enrollments.add(enrollment_id)
            
            # Get student_id for history reconstruction
            student_id = receipts[0].get('student_id', '')
            
            # Reconstruct complete fee history for this enrollment
            fee_events = self.reconstruct_student_fee_history(student_id, enrollment_id)
            
            # Generate ledger events from fee history
            for event in fee_events:
                receipt = event['receipt']
                component = event['component']
                
                # Get fee component mapping
                if component not in self.fee_component_mappings:
                    continue
                
                fee_component_info = self.fee_component_mappings[component]
                academic_year = self.determine_academic_year(receipt.get('fee_date'))
                
                # Create ledger event
                event_record = {
                    'id': str(uuid.uuid4()),
                    'event_type': event['event_type'],
                    'event_date': receipt.get('fee_date', ''),
                    'enrollment_id': enrollment_id,
                    'academic_year': academic_year,
                    'fee_component_id': fee_component_info['id'],
                    'amount': f"{event['amount']:.2f}",
                    'running_balance': f"{event['running_balance']:.2f}",
                    'receipt_id': str(uuid.uuid4()) if not event['is_initial_charge'] else '',
                    'fee_plan_id': '',  # Will be populated later if needed
                    'reference_event_id': '',
                    'description': f"{'Initial charge' if event['is_initial_charge'] else 'Payment received'} - {fee_component_info['label']}",
                    'created_by': 'SYSTEM_MIGRATION',
                    'created_at': receipt.get('created_at', receipt.get('fee_date', '')),
                    'legacy_receipt_id': str(receipt.get('id', '')),
                    'legacy_balance_id': '',
                    'legacy_record_id': str(receipt.get('id', ''))
                }
                
                self.transformed_events.append(event_record)
            
        # Now process individual receipts
        for receipt in self.legacy_receipts:
            # Find enrollment mapping - this is the only skip condition now
            enrollment_id = self.find_enrollment_id(receipt)
            if not enrollment_id:
                continue  # Already counted in skipped_no_enrollment above
                
            # Calculate amounts
            total_amount = self.calculate_total_amount(receipt)
            
            # Determine receipt status
            is_cancelled = receipt.get('is_cancelled', False)
            receipt_status = 'CANCELLED' if is_cancelled else 'ACTIVE'
                
            # Create receipt record
            receipt_id = str(uuid.uuid4())
            academic_year = self.determine_academic_year(receipt.get('fee_date'))
            unique_receipt_number = self.generate_unique_receipt_number(
                receipt.get('receipt_no', ''), 
                str(receipt.get('id', ''))
            )
            
            receipt_record = {
                'id': receipt_id,
                'receipt_number': unique_receipt_number,
                'receipt_date': receipt.get('fee_date', ''),
                'enrollment_id': enrollment_id,
                'academic_year': academic_year,
                'total_amount': f"{total_amount:.2f}",
                'paid_amount': f"{total_amount:.2f}",
                'balance_amount': "0.00",
                'payment_method': self.standardize_payment_method(receipt.get('payment_method')),
                'payment_reference': receipt.get('reference_number', ''),
                'payment_date': receipt.get('fee_date', ''),
                'bank_name': '',
                'legacy_reg_fee': f"{float(receipt.get('reg_fee', 0) or 0):.2f}",
                'legacy_sec_fee': f"{float(receipt.get('sec_fee', 0) or 0):.2f}",
                'legacy_tut_fee': f"{float(receipt.get('tut_fee', 0) or 0):.2f}",
                'legacy_other_fee': f"{float(receipt.get('other_fee', 0) or 0):.2f}",
                'legacy_pre_bal': f"{float(receipt.get('pre_bal', 0) or 0):.2f}",
                'legacy_rebate': f"{float(receipt.get('rebate', 0) or 0):.2f}",
                'status': receipt_status,  # Use the determined status (ACTIVE or CANCELLED)
                'comments': f"Converted from legacy receipt - {'CANCELLED' if is_cancelled else 'ACTIVE'}",
                'created_by': 'SYSTEM_MIGRATION',
                'updated_by': 'SYSTEM_MIGRATION',
                'created_at': receipt.get('created_at', receipt.get('fee_date', '')),
                'updated_at': receipt.get('created_at', receipt.get('fee_date', '')),
                'legacy_receipt_id': str(receipt.get('id', ''))
            }
            
            self.transformed_receipts.append(receipt_record)
            
            # Create ledger events and allocations for each component
            running_balance = 0.0
            
            for field in ['reg_fee', 'sec_fee', 'tut_fee', 'other_fee']:
                amount = float(receipt.get(field, 0) or 0)
                if amount > 0:
                    component = self.fee_component_mappings[field]
                    
                    # Determine event type based on receipt status
                    event_type = 'PAYMENT_CANCELLED' if is_cancelled else 'PAYMENT_RECEIVED'
                    description_prefix = 'Cancelled payment' if is_cancelled else 'Payment'
                    
                    # Create event
                    event_id = str(uuid.uuid4())
                    running_balance -= amount  # Payment reduces balance
                    
                    event_record = {
                        'id': event_id,
                        'event_type': event_type,
                        'event_date': receipt.get('fee_date', ''),
                        'enrollment_id': enrollment_id,
                        'academic_year': academic_year,
                        'fee_component_id': component['id'],
                        'amount': f"{amount:.2f}",
                        'running_balance': f"{running_balance:.2f}",
                        'receipt_id': receipt_id,
                        'fee_plan_id': '',
                        'reference_event_id': '',
                        'description': f'{description_prefix} for {component["label"]} - Receipt {receipt.get("receipt_no", "")} {"(CANCELLED)" if is_cancelled else ""}',
                        'created_by': 'SYSTEM_MIGRATION',
                        'created_at': receipt.get('created_at', receipt.get('fee_date', '')),
                        'legacy_receipt_id': str(receipt.get('id', '')),
                        'legacy_balance_id': '',
                        'legacy_record_id': str(receipt.get('id', ''))
                    }
                    
                    self.transformed_events.append(event_record)
                    
                    # Create allocation record
                    allocation_record = {
                        'id': str(uuid.uuid4()),
                        'receipt_id': receipt_id,
                        'ledger_event_id': event_id,
                        'fee_component_id': component['id'],
                        'allocated_amount': f"{amount:.2f}",
                        'enrollment_id': enrollment_id,
                        'academic_year': academic_year,
                        'receipt_date': receipt.get('fee_date', ''),
                        'created_at': receipt.get('created_at', receipt.get('fee_date', '')),
                        'legacy_record_id': str(receipt.get('id', ''))
                    }
                    
                    self.transformed_allocations.append(allocation_record)
                    
            # Find the balance record (AFTER payment) for this receipt
            balance_record_data = self.find_balance_record(receipt.get('id', ''))
            
            # Create balance records for each component using actual legacy data
            balance_field_mapping = {
                'reg_fee': 'reg_balance',
                'sec_fee': 'sec_balance', 
                'tut_fee': 'tut_balance',
                'other_fee': 'other_balance'
            }
            
            for field in ['reg_fee', 'sec_fee', 'tut_fee', 'other_fee']:
                amount_paid = float(receipt.get(field, 0) or 0)
                balance_field = balance_field_mapping.get(field, '')
                balance_after = float(balance_record_data.get(balance_field, 0) or 0)
                
                # Calculate what was owed before this payment
                charge_amount = balance_after + amount_paid
                
                if charge_amount > 0 or amount_paid > 0:
                    component = self.fee_component_mappings[field]
                    balance_record = {
                        'id': str(uuid.uuid4()),
                        'receipt_id': receipt_id,
                        'fee_component_id': component['id'],
                        'charge_amount': f"{charge_amount:.2f}",
                        'paid_amount': f"{amount_paid:.2f}",
                        'balance_amount': f"{balance_after:.2f}",  # Balance AFTER payment
                        'enrollment_id': enrollment_id,
                        'academic_year': academic_year,
                        'receipt_date': receipt.get('fee_date', ''),
                        'created_at': receipt.get('created_at', receipt.get('fee_date', '')),
                        'legacy_record_id': str(receipt.get('id', ''))
                    }
                    
                    self.transformed_balance_records.append(balance_record)
            
            processed_count += 1
            
            if processed_count % 500 == 0:
                print(f"   Processed {processed_count} receipts...")
                
        print(f"✅ Transformation complete!")
        print(f"   - Total processed: {processed_count} receipts")
        print(f"   - Skipped (no enrollment mapping): {skipped_no_enrollment} receipts")
        print(f"   - Generated: {len(self.transformed_events)} ledger events")
        print(f"   - Generated: {len(self.transformed_allocations)} allocations")
        print(f"   - Generated: {len(self.transformed_balance_records)} balance records")
        
        # Count by status
        active_receipts = sum(1 for r in self.transformed_receipts if r['status'] == 'ACTIVE')
        cancelled_receipts = sum(1 for r in self.transformed_receipts if r['status'] == 'CANCELLED')
        zero_amount_receipts = sum(1 for r in self.transformed_receipts if float(r['total_amount']) == 0)
        
        print(f"\n📊 Receipt Status Breakdown:")
        print(f"   - Active receipts: {active_receipts}")
        print(f"   - Cancelled receipts: {cancelled_receipts}")
        print(f"   - Zero amount receipts: {zero_amount_receipts}")
        
        # Count event types
        payment_received = sum(1 for e in self.transformed_events if e['event_type'] == 'PAYMENT_RECEIVED')
        payment_cancelled = sum(1 for e in self.transformed_events if e['event_type'] == 'PAYMENT_CANCELLED')
        
        print(f"\n📊 Event Type Breakdown:")
        print(f"   - Payment received events: {payment_received}")
        print(f"   - Payment cancelled events: {payment_cancelled}")
        
        if unmapped_enrollments:
            print(f"\n⚠️  Warning: {len(unmapped_enrollments)} enrollment codes could not be mapped:")
            for enrol in sorted(list(unmapped_enrollments))[:10]:  # Show first 10
                print(f"     - {enrol}")
            if len(unmapped_enrollments) > 10:
                print(f"     ... and {len(unmapped_enrollments) - 10} more")
                
        # Let's also analyze the data we processed
        print("\n🔍 Analysis of processed data:")
        
        # Check cancelled records that were processed
        processed_cancelled_receipts = [r for r in self.transformed_receipts if r['status'] == 'CANCELLED']
        if processed_cancelled_receipts:
            print(f"   📋 Sample processed cancelled receipts:")
            for i, receipt in enumerate(processed_cancelled_receipts[:3]):
                legacy_receipt = next((r for r in self.legacy_receipts if str(r.get('id', '')) == receipt['legacy_receipt_id']), None)
                total_amount = float(receipt['total_amount'])
                print(f"     {i+1}. Receipt {receipt['receipt_number']} - Amount: {total_amount:.2f} - Legacy cancelled: {legacy_receipt.get('is_cancelled', False) if legacy_receipt else 'Unknown'}")
        
        # Check zero amount records that were processed
        processed_zero_amount_receipts = [r for r in self.transformed_receipts if float(r['total_amount']) == 0]
        if processed_zero_amount_receipts:
            print(f"   📋 Sample processed zero amount receipts:")
            for i, receipt in enumerate(processed_zero_amount_receipts[:3]):
                print(f"     {i+1}. Receipt {receipt['receipt_number']} - Status: {receipt['status']} - All fees are 0")
        
        # Check unmapped enrollments
        if unmapped_enrollments:
            print(f"   📋 Sample unmapped enrollment codes:")
            for i, enrol_code in enumerate(sorted(list(unmapped_enrollments))[:5]):
                # Find a receipt with this enrollment code
                sample_receipt = next((r for r in self.legacy_receipts if r.get('enrol_id') == enrol_code), None)
                if sample_receipt:
                    print(f"     {i+1}. {enrol_code} - Student {sample_receipt.get('student_id')} - {sample_receipt.get('stu_name', '')}")
                
        print(f"\n🎯 Migration Summary:")
        print(f"   - Successfully migrated {len(self.transformed_receipts)} out of {len(self.legacy_receipts)} legacy receipts")
        print(f"   - Success rate: {(len(self.transformed_receipts)/len(self.legacy_receipts)*100):.1f}%")
        print(f"   - All receipt types included: Active, Cancelled, and Zero Amount")
                
    def save_transformed_data(self):
        """Save all transformed data to CSV files."""
        print("💾 Saving transformed data to CSV files...")
        
        # Save fee receipts
        receipts_file = os.path.join(self.templates_path, "transformed_fee_receipts.csv")
        if self.transformed_receipts:
            df = pd.DataFrame(self.transformed_receipts)
            df.to_csv(receipts_file, index=False)
            print(f"✅ Saved {len(self.transformed_receipts)} receipts to: {receipts_file}")
        
        # Save ledger events
        events_file = os.path.join(self.templates_path, "transformed_fee_ledger_events.csv")
        if self.transformed_events:
            df = pd.DataFrame(self.transformed_events)
            df.to_csv(events_file, index=False)
            print(f"✅ Saved {len(self.transformed_events)} events to: {events_file}")
            
        # Save allocations
        allocations_file = os.path.join(self.templates_path, "transformed_fee_receipt_allocations.csv")
        if self.transformed_allocations:
            df = pd.DataFrame(self.transformed_allocations)
            df.to_csv(allocations_file, index=False)
            print(f"✅ Saved {len(self.transformed_allocations)} allocations to: {allocations_file}")
            
        # Save balance records
        balance_file = os.path.join(self.templates_path, "transformed_fee_receipt_balance_records.csv")
        if self.transformed_balance_records:
            df = pd.DataFrame(self.transformed_balance_records)
            df.to_csv(balance_file, index=False)
            print(f"✅ Saved {len(self.transformed_balance_records)} balance records to: {balance_file}")
            
    def generate_import_script(self):
        """Generate PostgreSQL import script."""
        script_content = '''-- PostgreSQL Import Script for Fee Ledger Data
-- Run this script after ensuring the 006_fee_ledger_system.sql schema is deployed
-- Note: Fee components already exist in database, so we skip importing them

-- Import fee receipts
\\copy fee_receipts(id, receipt_number, receipt_date, enrollment_id, academic_year, total_amount, paid_amount, balance_amount, payment_method, payment_reference, payment_date, bank_name, legacy_reg_fee, legacy_sec_fee, legacy_tut_fee, legacy_other_fee, legacy_pre_bal, legacy_rebate, status, comments, created_by, updated_by, created_at, updated_at, legacy_receipt_id) FROM 'transformed_fee_receipts.csv' WITH CSV HEADER;

-- Import fee ledger events
\\copy fee_ledger_events(id, event_type, event_date, enrollment_id, academic_year, fee_component_id, amount, running_balance, receipt_id, fee_plan_id, reference_event_id, description, created_by, created_at, legacy_receipt_id, legacy_balance_id, legacy_record_id) FROM 'transformed_fee_ledger_events.csv' WITH CSV HEADER;

-- Import fee receipt allocations
\\copy fee_receipt_allocations(id, receipt_id, ledger_event_id, fee_component_id, allocated_amount, enrollment_id, academic_year, receipt_date, created_at, legacy_record_id) FROM 'transformed_fee_receipt_allocations.csv' WITH CSV HEADER;

-- Import fee receipt balance records
\\copy fee_receipt_balance_records(id, receipt_id, fee_component_id, charge_amount, paid_amount, balance_amount, enrollment_id, academic_year, receipt_date, created_at, legacy_record_id) FROM 'transformed_fee_receipt_balance_records.csv' WITH CSV HEADER;

-- Refresh analytics materialized view
SELECT refresh_fee_analytics();

-- Verify import
SELECT 'Fee Receipts' as table_name, COUNT(*) as record_count FROM fee_receipts
UNION ALL
SELECT 'Ledger Events', COUNT(*) FROM fee_ledger_events  
UNION ALL
SELECT 'Allocations', COUNT(*) FROM fee_receipt_allocations
UNION ALL
SELECT 'Balance Records', COUNT(*) FROM fee_receipt_balance_records;
'''
        
        script_file = os.path.join(self.templates_path, "import_fee_data.sql")
        with open(script_file, 'w', encoding='utf-8') as f:
            f.write(script_content)
            
        print(f"✅ Generated import script: {script_file}")
        
    def run_complete_transformation(self):
        """Run the complete transformation process."""
        try:
            self.load_mappings()
            self.create_fee_components()
            self.load_legacy_data()
            self.transform_all_receipts()
            self.save_transformed_data()
            self.generate_import_script()
            
            print("=" * 60)
            print("🎉 COMPLETE TRANSFORMATION SUCCESSFUL!")
            print(f"📁 All files saved to: {self.templates_path}")
            print("\n📋 Next Steps:")
            print("1. Review the transformed CSV files")
            print("2. Ensure 006_fee_ledger_system.sql schema is deployed")
            print("3. Run import_fee_data.sql to load data into PostgreSQL")
            print("4. Validate data integrity and run analytics queries")
            
        except Exception as e:
            print(f"❌ Error during transformation: {e}")
            raise

def main():
    """Main function to run the complete transformation."""
    transformer = CompleteFeeDataTransformer()
    transformer.run_complete_transformation()

if __name__ == "__main__":
    main()
