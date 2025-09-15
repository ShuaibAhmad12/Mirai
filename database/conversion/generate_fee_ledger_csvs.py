#!/usr/bin/env python3
"""
Fee Ledger CSV Generator
========================

This script generates CSV templates for the new fee ledger system tables and creates
mapping utilities to transform legacy fee data into the new normalized structure.

Features:
- Generates CSV templates for all fee ledger tables
- Uses existing enrollment and fee plan mappings from out/ folder
- Creates ID mapping utilities for legacy data transformation
- Supports component-based fee allocation
- Handles payment method standardization

Usage:
    python generate_fee_ledger_csvs.py

Output:
    - CSV templates in database/conversion/fee_ledger_templates/
    - Mapping utilities for legacy data transformation
    - Sample data for testing
"""

import csv
import os
import sys
import pandas as pd
import uuid
from datetime import datetime, date, timedelta
from typing import Dict, List, Tuple, Optional
import re

# Add the parent directory to the path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class FeeLedgerCSVGenerator:
    def __init__(self, base_path: str = None):
        """Initialize the CSV generator with paths and mappings."""
        if base_path is None:
            base_path = os.path.dirname(os.path.abspath(__file__))
        
        self.base_path = base_path
        self.out_path = os.path.join(base_path, "out")
        self.templates_path = os.path.join(base_path, "fee_ledger_templates")
        self.legacy_data_path = os.path.join(os.path.dirname(base_path), "old-data")
        
        # Create templates directory
        os.makedirs(self.templates_path, exist_ok=True)
        
        # Load existing mappings
        self.enrollment_mappings = {}
        self.fee_plan_mappings = {}
        self.student_mappings = {}
        self.fee_component_mappings = {}
        
        self._load_mappings()
        
    def _load_mappings(self):
        """Load ID mappings from existing CSV files."""
        print("Loading existing ID mappings...")
        
        try:
            # Load enrollment mappings
            enrollment_file = os.path.join(self.out_path, "students", "student_enrollments_out.csv")
            if os.path.exists(enrollment_file):
                df = pd.read_csv(enrollment_file)
                print(f"Loaded {len(df)} enrollment mappings")
                self.enrollment_mappings = df.to_dict('records')
                
            # Load fee plan mappings 
            fee_plan_file = os.path.join(self.out_path, "feetable", "fee_plans_out.csv")
            if os.path.exists(fee_plan_file):
                df = pd.read_csv(fee_plan_file)
                print(f"Loaded {len(df)} fee plan mappings")
                self.fee_plan_mappings = {str(row['legacy_id']): row for _, row in df.iterrows()}
                
            # Load student mappings
            student_file = os.path.join(self.out_path, "students", "students_out.csv")
            if os.path.exists(student_file):
                df = pd.read_csv(student_file)
                print(f"Loaded {len(df)} student mappings")
                self.student_mappings = {str(row['legacy_id']): row for _, row in df.iterrows()}
                
        except Exception as e:
            print(f"Warning: Could not load some mappings: {e}")
    
    def _standardize_payment_method(self, legacy_method: str) -> str:
        """Standardize payment method names to match enum values."""
        if not legacy_method or pd.isna(legacy_method):
            return 'OTHER'
            
        method = str(legacy_method).strip().upper()
        
        # Mapping rules based on analysis
        method_mappings = {
            'CASH': 'CASH',
            'CHEQUE': 'CHEQUE',
            'BANK': 'BANK',
            'BANK TRANSFER': 'BANK_TRANSFER',
            'ONLINE': 'ONLINE',
            'DD': 'DD',
            'DEMAND DRAFT': 'DEMAND_DRAFT',
            'SWIPE': 'SWIPE',
            'CARD': 'CARD',
            'UPI': 'UPI',
            'QR PHONEPE': 'QR_PHONEPE',
            'QR PHONEPAY': 'QR_PHONEPE',  # Common typo
            'QR HDFC': 'QR_HDFC',
            'QR PAYTM': 'QR_PAYTM',
            'QR GPAY': 'QR_GPAY',
            'QR': 'QR',
            'PHONEPE': 'PHONEPE',
            'PAYTM': 'PAYTM',
            'GPAY': 'GPAY',
        }
        
        # Try exact match first
        if method in method_mappings:
            return method_mappings[method]
            
        # Try partial matches
        for key, value in method_mappings.items():
            if key in method:
                return value
                
        return 'OTHER'
    
    def _determine_academic_year(self, date_str: str, enrollment_code: str = None) -> str:
        """Determine academic year from date or enrollment code."""
        try:
            if date_str and not pd.isna(date_str):
                dt = pd.to_datetime(date_str)
                year = dt.year
                
                # Academic year typically starts in July/August
                if dt.month >= 7:
                    return f"{year}-{str(year+1)[2:]}"
                else:
                    return f"{year-1}-{str(year)[2:]}"
                    
            # Fallback: extract from enrollment code if available
            if enrollment_code:
                match = re.search(r'/(\d{4})$', enrollment_code)
                if match:
                    year = int(match.group(1))
                    return f"{year}-{str(year+1)[2:]}"
                    
        except Exception:
            pass
            
        # Default fallback
        return "2023-24"
    
    def generate_fee_components_mapping(self) -> List[Dict]:
        """Generate standard fee component mappings."""
        components = [
            {
                'id': str(uuid.uuid4()),
                'code': 'REG_FEE',
                'label': 'Registration Fee',
                'legacy_field': 'reg_fee'
            },
            {
                'id': str(uuid.uuid4()),
                'code': 'SEC_FEE', 
                'label': 'Security Fee',
                'legacy_field': 'sec_fee'
            },
            {
                'id': str(uuid.uuid4()),
                'code': 'TUT_FEE',
                'label': 'Tuition Fee', 
                'legacy_field': 'tut_fee'
            },
            {
                'id': str(uuid.uuid4()),
                'code': 'OTHER_FEE',
                'label': 'Other Fee',
                'legacy_field': 'other_fee'
            },
            {
                'id': str(uuid.uuid4()),
                'code': 'PREV_BAL',
                'label': 'Previous Balance',
                'legacy_field': 'pre_bal'
            },
            {
                'id': str(uuid.uuid4()),
                'code': 'REBATE',
                'label': 'Rebate/Discount',
                'legacy_field': 'rebate'
            }
        ]
        
        # Store for later use
        self.fee_component_mappings = {comp['legacy_field']: comp for comp in components}
        
        return components
    
    def generate_fee_ledger_events_csv(self) -> str:
        """Generate CSV template for fee_ledger_events table."""
        filename = os.path.join(self.templates_path, "fee_ledger_events.csv")
        
        headers = [
            'id',
            'event_type', 
            'event_date',
            'enrollment_id',
            'academic_year',
            'fee_component_id',
            'amount',
            'running_balance',
            'receipt_id',
            'fee_plan_id',
            'reference_event_id',
            'description',
            'created_by',
            'created_at',
            'legacy_receipt_id',
            'legacy_balance_id',
            'legacy_record_id'
        ]
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            # Add sample rows for reference
            sample_rows = [
                [
                    str(uuid.uuid4()),
                    'CHARGE_CREATED',
                    '2023-07-01T00:00:00Z',
                    'ENROLLMENT_ID_FROM_MAPPING',
                    '2023-24',
                    'FEE_COMPONENT_ID_FROM_MAPPING',
                    '45000.00',
                    '45000.00',
                    '',
                    'FEE_PLAN_ID_FROM_MAPPING',
                    '',
                    'Initial charge for tuition fee',
                    'SYSTEM_USER_ID',
                    '2023-07-01T00:00:00Z',
                    '',
                    '',
                    'LEGACY_RECORD_ID'
                ],
                [
                    str(uuid.uuid4()),
                    'PAYMENT_RECEIVED',
                    '2024-08-12T04:24:55Z',
                    'ENROLLMENT_ID_FROM_MAPPING',
                    '2023-24',
                    'FEE_COMPONENT_ID_FROM_MAPPING',
                    '45000.00',
                    '0.00',
                    'RECEIPT_ID_FROM_MAPPING',
                    '',
                    '',
                    'Payment received via Bank transfer',
                    'SYSTEM_USER_ID',
                    '2024-08-12T04:24:55Z',
                    '22045',
                    '',
                    ''
                ]
            ]
            
            writer.writerows(sample_rows)
            
        print(f"Generated: {filename}")
        return filename
    
    def generate_fee_receipts_csv(self) -> str:
        """Generate CSV template for fee_receipts table."""
        filename = os.path.join(self.templates_path, "fee_receipts.csv")
        
        headers = [
            'id',
            'receipt_number',
            'receipt_date',
            'enrollment_id',
            'academic_year',
            'total_amount',
            'paid_amount', 
            'balance_amount',
            'payment_method',
            'payment_reference',
            'payment_date',
            'bank_name',
            'legacy_reg_fee',
            'legacy_sec_fee',
            'legacy_tut_fee',
            'legacy_other_fee',
            'legacy_pre_bal',
            'legacy_rebate',
            'status',
            'comments',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at',
            'legacy_receipt_id'
        ]
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            # Add sample row
            sample_row = [
                str(uuid.uuid4()),
                '1333',
                '2024-08-12',
                'ENROLLMENT_ID_FROM_MAPPING',
                '2023-24',
                '45000.00',
                '45000.00',
                '0.00',
                'BANK',
                'ph pay id 0724 1/7/24',
                '2024-08-12',
                '',
                '0.00',  # legacy_reg_fee
                '0.00',  # legacy_sec_fee
                '45000.00',  # legacy_tut_fee
                '0.00',  # legacy_other_fee
                '0.00',  # legacy_pre_bal
                '0.00',  # legacy_rebate
                'ACTIVE',
                'Converted from legacy receipt',
                'SYSTEM_USER_ID',
                'SYSTEM_USER_ID',
                '2024-08-12T04:24:55Z',
                '2024-08-12T04:24:55Z',
                '22045'
            ]
            
            writer.writerow(sample_row)
            
        print(f"Generated: {filename}")
        return filename
    
    def generate_fee_receipt_allocations_csv(self) -> str:
        """Generate CSV template for fee_receipt_allocations table."""
        filename = os.path.join(self.templates_path, "fee_receipt_allocations.csv")
        
        headers = [
            'id',
            'receipt_id',
            'ledger_event_id',
            'fee_component_id',
            'allocated_amount',
            'enrollment_id',
            'academic_year',
            'receipt_date',
            'created_at',
            'legacy_record_id'
        ]
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            # Add sample row
            sample_row = [
                str(uuid.uuid4()),
                'RECEIPT_ID_FROM_MAPPING',
                'LEDGER_EVENT_ID_FROM_MAPPING',
                'TUT_FEE_COMPONENT_ID',
                '45000.00',
                'ENROLLMENT_ID_FROM_MAPPING',
                '2023-24',
                '2024-08-12',
                '2024-08-12T04:24:55Z',
                '22045'
            ]
            
            writer.writerow(sample_row)
            
        print(f"Generated: {filename}")
        return filename
    
    def generate_fee_receipt_balance_records_csv(self) -> str:
        """Generate CSV template for fee_receipt_balance_records table."""
        filename = os.path.join(self.templates_path, "fee_receipt_balance_records.csv")
        
        headers = [
            'id',
            'receipt_id',
            'fee_component_id',
            'charge_amount',
            'paid_amount',
            'balance_amount',
            'enrollment_id',
            'academic_year',
            'receipt_date',
            'created_at',
            'legacy_record_id'
        ]
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            # Add sample row
            sample_row = [
                str(uuid.uuid4()),
                'RECEIPT_ID_FROM_MAPPING',
                'TUT_FEE_COMPONENT_ID',
                '45000.00',  # charge_amount (what was owed before payment)
                '0.00',      # paid_amount (what was paid before this receipt)
                '45000.00',  # balance_amount (outstanding before this payment)
                'ENROLLMENT_ID_FROM_MAPPING',
                '2023-24',
                '2024-08-12',
                '2024-08-12T04:24:55Z',
                '22045'
            ]
            
            writer.writerow(sample_row)
            
        print(f"Generated: {filename}")
        return filename
    
    def generate_fee_components_reference_csv(self) -> str:
        """Generate reference CSV for fee components mapping."""
        filename = os.path.join(self.templates_path, "fee_components_reference.csv")
        
        components = self.generate_fee_components_mapping()
        
        headers = ['id', 'code', 'label', 'legacy_field']
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows([[c['id'], c['code'], c['label'], c['legacy_field']] for c in components])
            
        print(f"Generated: {filename}")
        return filename
    
    def generate_legacy_transformation_script(self) -> str:
        """Generate Python script to transform legacy data to new structure."""
        script_content = '''#!/usr/bin/env python3
"""
Legacy Fee Data Transformation Script
====================================

Transforms legacy fee receipt data into normalized fee ledger structure.
"""

import pandas as pd
import uuid
from datetime import datetime
import os

def transform_legacy_fee_data():
    """Transform legacy fee receipts to new ledger structure."""
    
    # Load legacy data
    legacy_receipts = pd.read_csv('../old-data/alpine_fees_feereceipts_20250904_140520.csv')
    
    # Load mappings
    enrollments = pd.read_csv('../out/students/student_enrollments_out.csv')
    fee_components = pd.read_csv('fee_ledger_templates/fee_components_reference.csv')
    
    # Create enrollment lookup by legacy student ID
    enrollment_lookup = {}
    for _, row in enrollments.iterrows():
        # You'll need to add logic here to match legacy student IDs to enrollments
        pass
    
    # Create component lookup
    component_lookup = {row['legacy_field']: row for _, row in fee_components.iterrows()}
    
    # Initialize output DataFrames
    fee_receipts = []
    fee_ledger_events = []
    fee_receipt_allocations = []
    fee_receipt_balance_records = []
    
    for _, receipt in legacy_receipts.iterrows():
        if pd.isna(receipt['is_cancelled']) or not receipt['is_cancelled']:
            # Process active receipts only
            
            receipt_id = str(uuid.uuid4())
            enrollment_id = "LOOKUP_ENROLLMENT_ID"  # Implement lookup logic
            academic_year = determine_academic_year(receipt['fee_date'])
            
            # Create receipt record
            fee_receipt = {
                'id': receipt_id,
                'receipt_number': receipt['receipt_no'],
                'receipt_date': receipt['fee_date'],
                'enrollment_id': enrollment_id,
                'academic_year': academic_year,
                'total_amount': calculate_total_amount(receipt),
                'paid_amount': calculate_total_amount(receipt),
                'balance_amount': 0.00,
                'payment_method': standardize_payment_method(receipt['payment_method']),
                'payment_reference': receipt['reference_number'],
                'payment_date': receipt['fee_date'],
                'legacy_reg_fee': receipt['reg_fee'],
                'legacy_sec_fee': receipt['sec_fee'],
                'legacy_tut_fee': receipt['tut_fee'],
                'legacy_other_fee': receipt['other_fee'],
                'legacy_pre_bal': receipt['pre_bal'],
                'legacy_rebate': receipt['rebate'],
                'status': 'ACTIVE',
                'legacy_receipt_id': receipt['id']
            }
            fee_receipts.append(fee_receipt)
            
            # Create ledger events and allocations for each component
            for field in ['reg_fee', 'sec_fee', 'tut_fee', 'other_fee']:
                amount = float(receipt[field] or 0)
                if amount > 0:
                    component = component_lookup[field]
                    
                    # Create payment event
                    event_id = str(uuid.uuid4())
                    event = {
                        'id': event_id,
                        'event_type': 'PAYMENT_RECEIVED',
                        'event_date': receipt['fee_date'],
                        'enrollment_id': enrollment_id,
                        'academic_year': academic_year,
                        'fee_component_id': component['id'],
                        'amount': amount,
                        'running_balance': 0.00,  # Calculate based on previous events
                        'receipt_id': receipt_id,
                        'description': f'Payment for {component["label"]}',
                        'legacy_receipt_id': receipt['id']
                    }
                    fee_ledger_events.append(event)
                    
                    # Create allocation
                    allocation = {
                        'id': str(uuid.uuid4()),
                        'receipt_id': receipt_id,
                        'ledger_event_id': event_id,
                        'fee_component_id': component['id'],
                        'allocated_amount': amount,
                        'enrollment_id': enrollment_id,
                        'academic_year': academic_year,
                        'receipt_date': receipt['fee_date'],
                        'legacy_record_id': receipt['id']
                    }
                    fee_receipt_allocations.append(allocation)
    
    # Save transformed data
    pd.DataFrame(fee_receipts).to_csv('fee_ledger_templates/transformed_fee_receipts.csv', index=False)
    pd.DataFrame(fee_ledger_events).to_csv('fee_ledger_templates/transformed_fee_ledger_events.csv', index=False)
    pd.DataFrame(fee_receipt_allocations).to_csv('fee_ledger_templates/transformed_fee_receipt_allocations.csv', index=False)
    
    print("Legacy data transformation completed!")

def calculate_total_amount(receipt):
    """Calculate total amount from legacy receipt."""
    return sum([
        float(receipt['reg_fee'] or 0),
        float(receipt['sec_fee'] or 0),
        float(receipt['tut_fee'] or 0),
        float(receipt['other_fee'] or 0)
    ])

def standardize_payment_method(method):
    """Standardize payment method."""
    if not method:
        return 'OTHER'
    method = str(method).upper().strip()
    method_mappings = {
        'CASH': 'CASH',
        'BANK': 'BANK',
        'QR PHONEPE': 'QR_PHONEPE',
        'QR HDFC': 'QR_HDFC',
        'SWIPE': 'SWIPE',
        'CHEQUE': 'CHEQUE'
    }
    return method_mappings.get(method, 'OTHER')

def determine_academic_year(date_str):
    """Determine academic year from date."""
    try:
        dt = pd.to_datetime(date_str)
        year = dt.year
        if dt.month >= 7:
            return f"{year}-{str(year+1)[2:]}"
        else:
            return f"{year-1}-{str(year)[2:]}"
    except:
        return "2023-24"

if __name__ == "__main__":
    transform_legacy_fee_data()
'''
        
        script_filename = os.path.join(self.templates_path, "transform_legacy_data.py")
        with open(script_filename, 'w', encoding='utf-8') as f:
            f.write(script_content)
            
        print(f"Generated: {script_filename}")
        return script_filename
    
    def generate_mapping_analysis_csv(self) -> str:
        """Generate analysis of enrollment to legacy ID mappings."""
        filename = os.path.join(self.templates_path, "enrollment_legacy_mapping_analysis.csv")
        
        try:
            # Load legacy fee data to see what student IDs we need to map
            legacy_file = os.path.join(self.legacy_data_path, "alpine_fees_feereceipts_20250904_140520.csv")
            if os.path.exists(legacy_file):
                legacy_df = pd.read_csv(legacy_file)
                
                # Get unique student IDs from legacy data
                legacy_student_ids = legacy_df['student_id'].dropna().unique()
                
                # Get enrollment data
                enrollment_file = os.path.join(self.out_path, "students", "student_enrollments_out.csv")
                if os.path.exists(enrollment_file):
                    enrollment_df = pd.read_csv(enrollment_file)
                    
                    # Create mapping analysis
                    analysis_data = []
                    for student_id in legacy_student_ids:
                        # Find matching enrollments
                        student_receipts = legacy_df[legacy_df['student_id'] == student_id]
                        receipt_count = len(student_receipts)
                        total_amount = student_receipts[['reg_fee', 'sec_fee', 'tut_fee', 'other_fee']].fillna(0).sum().sum()
                        
                        analysis_data.append({
                            'legacy_student_id': student_id,
                            'receipt_count': receipt_count,
                            'total_fee_amount': total_amount,
                            'first_receipt_date': student_receipts['fee_date'].min(),
                            'last_receipt_date': student_receipts['fee_date'].max(),
                            'enrollment_codes': student_receipts['enrol_id'].unique().tolist(),
                            'mapped_enrollment_id': '',  # To be filled manually or via additional logic
                            'mapping_status': 'NEEDS_MAPPING'
                        })
                    
                    # Save analysis
                    analysis_df = pd.DataFrame(analysis_data)
                    analysis_df.to_csv(filename, index=False)
                    print(f"Generated mapping analysis: {filename}")
                    print(f"Found {len(legacy_student_ids)} unique legacy student IDs needing enrollment mapping")
                    
        except Exception as e:
            print(f"Could not generate mapping analysis: {e}")
            
        return filename
    
    def generate_all_templates(self):
        """Generate all CSV templates and utilities."""
        print("🚀 Generating Fee Ledger CSV Templates...")
        print("=" * 50)
        
        # Generate component reference first
        self.generate_fee_components_reference_csv()
        
        # Generate main table templates
        self.generate_fee_ledger_events_csv()
        self.generate_fee_receipts_csv() 
        self.generate_fee_receipt_allocations_csv()
        self.generate_fee_receipt_balance_records_csv()
        
        # Generate utility files
        self.generate_legacy_transformation_script()
        self.generate_mapping_analysis_csv()
        
        # Generate README
        self._generate_readme()
        
        print("=" * 50)
        print("✅ All templates generated successfully!")
        print(f"📁 Output directory: {self.templates_path}")
        print("\n📋 Next Steps:")
        print("1. Review fee_components_reference.csv for component mappings")
        print("2. Check enrollment_legacy_mapping_analysis.csv for student ID mappings")
        print("3. Run transform_legacy_data.py after completing mappings")
        print("4. Import transformed CSVs into PostgreSQL")
        
    def _generate_readme(self):
        """Generate README file explaining the templates."""
        readme_content = """# Fee Ledger CSV Templates

This folder contains CSV templates and utilities for the new fee ledger system.

## Files Generated

### Table Templates
- `fee_ledger_events.csv` - Immutable audit log of all fee events
- `fee_receipts.csv` - Receipt header information
- `fee_receipt_allocations.csv` - How payments are allocated to components
- `fee_receipt_balance_records.csv` - Balance snapshots before payments

### Reference Data
- `fee_components_reference.csv` - Standard fee component mappings
- `enrollment_legacy_mapping_analysis.csv` - Analysis of student ID mappings needed

### Utilities
- `transform_legacy_data.py` - Script to transform legacy data
- `README.md` - This file

## Transformation Process

1. **Review Mappings**: Check the enrollment mapping analysis to ensure all legacy student IDs can be mapped to enrollment IDs.

2. **Update Component References**: Modify fee_components_reference.csv if needed to match your fee structure.

3. **Run Transformation**: Execute the transformation script to convert legacy data.

4. **Validate Data**: Review transformed CSV files before importing.

5. **Import to Database**: Load CSV files into PostgreSQL using COPY commands.

## Key Concepts

### Event-Sourced Ledger
- Every financial transaction creates immutable events
- Balance calculations derived from event history
- Full audit trail maintained

### Component-Based Allocation
- Payments allocated across fee components (tuition, registration, etc.)
- Flexible structure supports any fee breakdown
- Legacy component amounts preserved for validation

### Denormalized Performance Fields
- Key fields duplicated for query performance
- Avoids joins in common analytical queries
- Maintains referential integrity with constraints

## Data Validation

Before importing, ensure:
- All enrollment_ids exist in student_enrollments table
- All fee_component_ids exist in fee_components table  
- All amounts are properly rounded to 2 decimal places
- Academic year follows YYYY-YY format
- Payment methods match enum values

## Support

For questions or issues with the transformation process, refer to the main schema documentation in 006_fee_ledger_system.sql.
"""
        
        readme_file = os.path.join(self.templates_path, "README.md")
        with open(readme_file, 'w', encoding='utf-8') as f:
            f.write(readme_content)
            
        print(f"Generated: {readme_file}")

def main():
    """Main function to run the CSV generator."""
    try:
        generator = FeeLedgerCSVGenerator()
        generator.generate_all_templates()
        
    except Exception as e:
        print(f"❌ Error generating templates: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
