#!/usr/bin/env python3
"""
Fee Current Balances CSV Generator
Converts legacy fee balance CSV to new fee_current_balances CSV format.

This script:
1. Reads legacy fee balance CSV (alpine_fees_feebalance_*.csv)
2. Transforms to new fee_current_balances format
3. Maps legacy fields for proper correlation
4. Generates CSV ready for database import

Dependencies: pandas, uuid
Input: alpine_fees_feebalance_*.csv
Output: fee_current_balances.csv
"""

import pandas as pd
import uuid
from datetime import datetime
import logging
import os
import glob

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FeeCurrentBalancesCSVGenerator:
    def __init__(self, input_dir: str = "database/old-data", output_dir: str = "database/conversion/out"):
        """Initialize with input and output directories."""
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.component_mapping = self.get_component_mapping()
        
    def get_component_mapping(self) -> dict:
        """
        Define mapping from legacy CSV columns to component codes.
        Based on the actual fee balance CSV structure.
        """
        return {
            'reg_fee': 'ADMISSION',
            'sec_fee': 'SECURITY', 
            'tut_fee': 'TUITION',
            'other_fee': 'OTHER',
            # Legacy name mappings (if needed)
            'Registration Fee': 'ADMISSION',
            'Security Fee': 'SECURITY',
            'Tuition Fee': 'TUITION',
            'Other Fee': 'OTHER',
        }
        
    def find_fee_balance_csv(self) -> str:
        """Find the legacy fee balance CSV file."""
        # Handle relative path properly - go up one directory from conversion folder to database
        if not os.path.isabs(self.input_dir):
            # We're in database/conversion, so go up one level to database, then access old-data
            base_path = os.path.dirname(os.path.abspath(__file__))  # This is database/conversion
            input_path = os.path.join(base_path, "..", "old-data")  # Go to database/old-data
        else:
            input_path = self.input_dir
            
        pattern = os.path.join(input_path, "alpine_fees_feebalance_*.csv")
        files = glob.glob(pattern)
        
        if not files:
            raise FileNotFoundError(f"No fee balance CSV found matching pattern: {pattern}")
        
        # Get the most recent file if multiple exist
        latest_file = max(files, key=os.path.getctime)
        logger.info(f"Found fee balance CSV: {latest_file}")
        return latest_file
    
    def load_legacy_fee_balance(self) -> pd.DataFrame:
        """Load legacy fee balance data."""
        csv_file = self.find_fee_balance_csv()
        
        logger.info(f"Loading legacy fee balance data from: {csv_file}")
        df = pd.read_csv(csv_file)
        logger.info(f"Loaded {len(df)} legacy fee balance records")
        
        # Log column names for debugging
        logger.info(f"Available columns: {list(df.columns)}")
        return df
    
    def load_student_enrollments(self) -> pd.DataFrame:
        """Load student enrollment data for enrollment_id mapping."""
        # Handle relative path properly
        if not os.path.isabs(self.output_dir):
            # We're in database/conversion, so go up one level to database, then access conversion/out
            base_path = os.path.dirname(os.path.abspath(__file__))  # This is database/conversion
            output_path = os.path.join(base_path, "out")  # Go to database/conversion/out
        else:
            output_path = self.output_dir
            
        enrollments_file = os.path.join(output_path, "students", "student_enrollments_out.csv")
        
        if not os.path.exists(enrollments_file):
            logger.warning(f"Student enrollments file not found: {enrollments_file}")
            return pd.DataFrame()
            
        logger.info(f"Loading student enrollments from: {enrollments_file}")
        df = pd.read_csv(enrollments_file)
        logger.info(f"Loaded {len(df)} enrollment records")
        return df
    
    def load_students(self) -> pd.DataFrame:
        """Load student data for legacy_student_id to student_id mapping."""
        # Handle relative path properly
        if not os.path.isabs(self.output_dir):
            # We're in database/conversion, so go up one level to database, then access conversion/out
            base_path = os.path.dirname(os.path.abspath(__file__))  # This is database/conversion
            output_path = os.path.join(base_path, "out")  # Go to database/conversion/out
        else:
            output_path = self.output_dir
            
        students_file = os.path.join(output_path, "students", "students_out.csv")
        
        if not os.path.exists(students_file):
            logger.warning(f"Students file not found: {students_file}")
            return pd.DataFrame()
            
        logger.info(f"Loading students from: {students_file}")
        df = pd.read_csv(students_file)
        logger.info(f"Loaded {len(df)} student records")
        return df
    
    def load_fee_components(self) -> pd.DataFrame:
        """Load fee components for component_id mapping."""
        # Handle relative path properly
        if not os.path.isabs(self.output_dir):
            # We're in database/conversion, so go up one level to database, then access conversion/out
            base_path = os.path.dirname(os.path.abspath(__file__))  # This is database/conversion
            output_path = os.path.join(base_path, "out")  # Go to database/conversion/out
        else:
            output_path = self.output_dir
            
        components_file = os.path.join(output_path, "fee_ledger_templates", "fee_components_reference.csv")
        
        if not os.path.exists(components_file):
            logger.warning(f"Fee components file not found: {components_file}")
            return pd.DataFrame()
            
        logger.info(f"Loading fee components from: {components_file}")
        df = pd.read_csv(components_file)
        logger.info(f"Loaded {len(df)} fee component records")
        return df
    
    def transform_fee_balances(self, legacy_df: pd.DataFrame, students_df: pd.DataFrame, enrollments_df: pd.DataFrame, components_df: pd.DataFrame) -> pd.DataFrame:
        """
        Transform legacy fee balance data to new format.
        Each legacy row contains multiple fee components (reg_fee, sec_fee, tut_fee, other_fee)
        We need to create separate rows for each component.
        """
        logger.info("Transforming legacy fee balance data...")
        
        # Create student lookup - map legacy_student_id to student_id
        student_lookup = {}
        if not students_df.empty:
            for _, student in students_df.iterrows():
                student_lookup[student['legacy_student_id']] = {
                    'student_id': student['id'],
                    'full_name': student['full_name']
                }
        
        # Create enrollment lookup - map student_id to enrollment_id
        enrollment_lookup = {}
        if not enrollments_df.empty:
            for _, enrollment in enrollments_df.iterrows():
                enrollment_lookup[enrollment['student_id']] = {
                    'enrollment_id': enrollment['id'],
                    'enrollment_code': enrollment['enrollment_code']
                }
        
        # Create component lookup
        component_lookup = {}
        if not components_df.empty:
            for _, component in components_df.iterrows():
                component_lookup[component['code']] = {
                    'id': component['id'],
                    'name': component['label']
                }
        
        # Define fee component mapping based on actual CSV columns
        fee_components_mapping = [
            {'csv_column': 'reg_fee', 'component_code': 'ADMISSION', 'component_name': 'Admission Fee'},
            {'csv_column': 'sec_fee', 'component_code': 'SECURITY', 'component_name': 'Security Fee'},
            {'csv_column': 'tut_fee', 'component_code': 'TUITION', 'component_name': 'Tuition Fee'},
            {'csv_column': 'other_fee', 'component_code': 'OTHER', 'component_name': 'Other Fee'},
        ]
        
        transformed_records = []
        current_time = datetime.now().isoformat()
        batch_id = str(uuid.uuid4())
        
        for _, record in legacy_df.iterrows():
            try:
                legacy_student_id = int(record.get('student_id', 0))
                legacy_balance_id = str(record.get('id', ''))
                curr_year = int(record.get('curr_year', 1))
                pre_bal = float(record.get('pre_bal', 0))
                rebate = float(record.get('rebate', 0))  # This is discount
                
                # Find student info using legacy_student_id
                student_info = student_lookup.get(legacy_student_id, {
                    'student_id': str(uuid.uuid4()),
                    'full_name': 'Unknown Student'
                })
                
                # Find enrollment info using student_id
                enrollment_info = enrollment_lookup.get(student_info['student_id'], {
                    'enrollment_id': str(uuid.uuid4()),
                    'enrollment_code': 'UNKNOWN'
                })
                
                enrollment_id = enrollment_info['enrollment_id']
                
                # Determine academic year based on curr_year
                academic_year = f"202{curr_year+2}-{curr_year+3}" if curr_year <= 5 else "2023-24"
                
                # Create a record for each fee component that has a non-zero amount
                for fee_mapping in fee_components_mapping:
                    csv_column = fee_mapping['csv_column']
                    component_code = fee_mapping['component_code']
                    component_name = fee_mapping['component_name']
                    
                    # Get the fee amount for this component
                    fee_amount = float(record.get(csv_column, 0))
                    
                    # Include ALL records, even if fee amount is 0
                    # This ensures we have complete fee structure for every student
                    
                    # Get component details from lookup or create default
                    component_info = component_lookup.get(component_code, {
                        'id': str(uuid.uuid4()),
                        'name': component_name
                    })
                    
                    # Calculate amounts
                    original_amount = fee_amount
                    override_amount = fee_amount
                    discount_amount = rebate if fee_mapping['csv_column'] == 'tut_fee' else 0  # Apply rebate to tuition only
                    charged_amount = override_amount - discount_amount + pre_bal  # Include previous balance
                    
                    # For simplification, assume all fees are outstanding (no payments recorded in this CSV)
                    # The actual payments will come from the fee receipts transformation
                    paid_amount = 0  # We'll calculate this from receipts later
                    outstanding_amount = charged_amount
                    
                    # Create transformed record
                    transformed_record = {
                        'id': str(uuid.uuid4()),
                        'enrollment_id': enrollment_id,
                        'academic_year': academic_year,
                        'fee_component_id': component_info['id'],
                        'component_code': component_code,
                        'component_name': component_info['name'],
                        'year_number': curr_year,
                        'original_amount': original_amount,
                        'override_amount': override_amount,
                        'discount_amount': discount_amount,
                        'charged_amount': charged_amount,
                        'paid_amount': paid_amount,
                        'outstanding_amount': outstanding_amount,
                        'last_updated_at': current_time,
                        'last_updated_by': None,
                        'created_at': current_time,
                        
                        # Legacy mapping fields (CRITICAL for correlation)
                        'legacy_student_id': legacy_student_id,
                        'legacy_balance_id': legacy_balance_id,
                        'legacy_course_id': None,  # Not available in this CSV
                        'legacy_session_id': None,  # Not available in this CSV
                        'legacy_component_name': component_name,
                        
                        # Source tracking
                        'source_system': 'legacy_import',
                        'import_batch_id': batch_id,
                        'migration_notes': f"Imported from legacy fee balance system on {datetime.now().strftime('%Y-%m-%d')}"
                    }
                    
                    transformed_records.append(transformed_record)
                
            except Exception as e:
                logger.error(f"Error processing record {record.get('id', 'unknown')}: {e}")
                continue
        
        transformed_df = pd.DataFrame(transformed_records)
        logger.info(f"Transformed {len(transformed_df)} fee balance records from {len(legacy_df)} legacy records")
        
        return transformed_df
    
    def validate_transformed_data(self, df: pd.DataFrame) -> bool:
        """Validate the transformed data."""
        logger.info("Validating transformed fee balance data...")
        
        # Check for required fields
        required_fields = [
            'enrollment_id', 'academic_year', 'fee_component_id',
            'component_code', 'year_number', 'outstanding_amount'
        ]
        
        for field in required_fields:
            if field not in df.columns:
                logger.error(f"Missing required field: {field}")
                return False
            
            null_count = df[field].isnull().sum()
            if null_count > 0:
                logger.warning(f"Field {field} has {null_count} null values")
        
        # Check for negative amounts (should not happen)
        amount_fields = ['original_amount', 'override_amount', 'charged_amount', 'paid_amount', 'outstanding_amount']
        for field in amount_fields:
            if field in df.columns:
                negative_count = (df[field] < 0).sum()
                if negative_count > 0:
                    logger.warning(f"Field {field} has {negative_count} negative values")
        
        # Validate balance calculation
        if all(field in df.columns for field in ['charged_amount', 'paid_amount', 'outstanding_amount']):
            calculated_outstanding = (df['charged_amount'] - df['paid_amount']).clip(lower=0)
            balance_diff = abs(df['outstanding_amount'] - calculated_outstanding)
            incorrect_balances = (balance_diff > 0.01).sum()  # Allow small rounding errors
            
            if incorrect_balances > 0:
                logger.warning(f"Balance calculation may be incorrect for {incorrect_balances} records")
        
        logger.info("Data validation completed")
        return True
    def generate_summary_report(self, df: pd.DataFrame):
        """Generate a summary report of the transformed data."""
        logger.info("Generating summary report...")
        
        print("\n" + "="*60)
        print("FEE CURRENT BALANCES TRANSFORMATION SUMMARY")
        print("="*60)
        
        print(f"Total Records: {len(df):,}")
        print(f"Unique Students: {df['legacy_student_id'].nunique():,}")
        print(f"Unique Components: {df['component_code'].nunique():,}")
        print(f"Total Outstanding: ₹{df['outstanding_amount'].sum():,.2f}")
        print(f"Total Charged: ₹{df['charged_amount'].sum():,.2f}")
        print(f"Total Paid: ₹{df['paid_amount'].sum():,.2f}")
        
        # Records with outstanding balance
        outstanding_records = df[df['outstanding_amount'] > 0]
        print(f"Records with Outstanding Balance: {len(outstanding_records):,}")
        print(f"Students with Outstanding Balance: {outstanding_records['legacy_student_id'].nunique():,}")
        
        # Component-wise breakdown
        print(f"\nComponent-wise Outstanding Balances:")
        print("-" * 40)
        component_summary = df[df['outstanding_amount'] > 0].groupby('component_code').agg({
            'outstanding_amount': ['count', 'sum', 'mean']
        }).round(2)
        
        for component in component_summary.index:
            count = component_summary.loc[component, ('outstanding_amount', 'count')]
            total = component_summary.loc[component, ('outstanding_amount', 'sum')]
            avg = component_summary.loc[component, ('outstanding_amount', 'mean')]
            print(f"{component}: {count} records, ₹{total:,.2f} total, ₹{avg:,.2f} avg")
        
        print("="*60)
    
    def save_csv(self, df: pd.DataFrame, filename: str = "fee_current_balances.csv"):
        """Save the transformed data to CSV."""
        # Handle relative path properly
        if not os.path.isabs(self.output_dir):
            # We're in database/conversion, so go up one level to database, then access conversion/out
            base_path = os.path.dirname(os.path.abspath(__file__))  # This is database/conversion
            output_path = os.path.join(base_path, "out")  # Go to database/conversion/out
        else:
            output_path = self.output_dir
            
        # Create fee_balance folder like other CSV outputs
        fee_balance_dir = os.path.join(output_path, "fee_balance")
        os.makedirs(fee_balance_dir, exist_ok=True)
        
        output_file = os.path.join(fee_balance_dir, filename)
        
        logger.info(f"Saving transformed data to: {output_file}")
        df.to_csv(output_file, index=False)
        logger.info(f"Successfully saved {len(df)} records to {output_file}")
        
        return output_file
    
    def run(self):
        """Main execution method."""
        try:
            # Step 1: Load legacy fee balance data
            legacy_df = self.load_legacy_fee_balance()
            
            # Step 2: Load reference data for mapping
            students_df = self.load_students()
            enrollments_df = self.load_student_enrollments()
            components_df = self.load_fee_components()
            
            # Step 3: Transform the data
            transformed_df = self.transform_fee_balances(legacy_df, students_df, enrollments_df, components_df)
            
            if transformed_df.empty:
                logger.error("No data was transformed. Check input files and mapping logic.")
                return False
            
            # Step 4: Validate the transformed data
            if not self.validate_transformed_data(transformed_df):
                logger.error("Data validation failed")
                return False
            
            # Step 5: Generate summary report
            self.generate_summary_report(transformed_df)
            
            # Step 6: Save to CSV
            output_file = self.save_csv(transformed_df)
            
            print(f"\n✅ Fee current balances transformation completed successfully!")
            print(f"📁 Output file: {output_file}")
            print(f"📊 Total records: {len(transformed_df):,}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error during transformation: {e}")
            return False


def main():
    """Main execution function."""
    
    # Create generator instance
    generator = FeeCurrentBalancesCSVGenerator()
    
    # Run the transformation
    success = generator.run()
    
    if success:
        print("\n🎉 Ready for database import!")
        print("Next steps:")
        print("1. Review the generated fee_current_balances.csv")
        print("2. Run the SQL schema (006.1_fee_current_balances.sql)")
        print("3. Import the CSV data into the database")
        print("4. Update the fee service to use the new table")
    else:
        print("\n❌ Transformation failed. Check the logs for details.")


if __name__ == "__main__":
    main()
