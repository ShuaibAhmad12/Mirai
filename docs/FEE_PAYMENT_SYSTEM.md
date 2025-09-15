# Fee Payment System Documentation

## Overview

The Fee Payment System is a comprehensive solution for handling student fee collections with proper transaction management, audit trails, and multi-table updates. It consists of a React dialog component, dedicated API service layer, and database functions that ensure data integrity.

## Architecture

### Components

1. **CollectPaymentDialog.tsx** - Frontend React component for payment collection
2. **FeePaymentService** - Dedicated service layer for payment processing
3. **Database Functions** - PostgreSQL functions for transaction handling
4. **API Routes** - Next.js API endpoints

### Database Tables Involved

- `fee_receipts` - Main payment records
- `fee_receipt_allocations` - Component-wise payment distribution
- `fee_ledger_events` - Audit trail for all financial transactions
- `fee_current_balances` - Real-time balance tracking
- `fee_adjustments` - Rebates and discounts
- `fee_components` - Fee component definitions

## Payment Flow

### 1. Payment Initiation

- User opens CollectPaymentDialog for a student
- Dialog loads current fee components and balances
- User allocates payment amounts across components
- Optional rebate can be applied to tuition fees

### 2. Validation

- Receipt number uniqueness check
- Payment amount validation
- Component allocation verification
- Rebate amount limits (cannot exceed tuition balance)

### 3. Processing

- API receives payment request
- `FeePaymentService.processPayment()` handles the transaction
- Database function `process_fee_payment()` executes with ACID compliance

### 4. Database Updates

The system atomically updates multiple tables:
The system atomically updates multiple tables:

```sql
-- Main receipt
INSERT INTO fee_receipts (...)

-- Component allocations
INSERT INTO fee_receipt_allocations (...)

-- Ledger events for audit trail
INSERT INTO fee_ledger_events (...)

-- Balance updates
UPDATE fee_current_balances (...)

-- Rebate adjustments (if applicable)
INSERT INTO fee_adjustments (...)
```

## Key Features

### ✅ Transaction Safety

- All payment operations wrapped in database transactions
- Automatic rollback on any failure
- Data consistency guaranteed

### ✅ Component-wise Allocation

- Payments can be distributed across multiple fee components
- Previous balance carry-forward supported
- Real-time balance calculations

### ✅ Rebate System

- Discounts applied to tuition fees
- Mandatory reason tracking
- Automatic balance adjustments

### ✅ Comprehensive Audit Trail

- Every financial transaction logged
- Running balance calculations
- Full traceability

### ✅ Payment Method Support

- Cash, Cheque, Bank Transfer, Online, UPI, Cards, etc.
- Extensible payment method types

## API Usage

### Process Payment

```typescript
POST /api/students/[student_id]/fees

{
  "receipt_number": "RCP2025001",
  "receipt_date": "2025-09-12",
  "payment_method": "CASH",
  "total_amount": 50000,
  "component_payments": {
    "TUITION": 45000,
    "SECURITY": 5000
  },
  "rebate_amount": 5000,
  "rebate_reason": "Merit scholarship",
  "current_year": 1,
  "remarks": "Full year payment"
}
```

### Response

```json
{
  "success": true,
  "receipt_id": "uuid",
  "receipt_number": "RCP2025001",
  "message": "Payment processed successfully",
  "allocations_created": 2,
  "ledger_events_created": 3,
  "balances_updated": 2
}
```

## Database Functions

### process_fee_payment()

Main payment processing function with transaction handling.

### cancel_fee_payment()

Reverses payment and restores balances.

### get_fee_payment_summary()

Returns payment statistics for an enrollment.

## Migration

Run the migration script to deploy database functions:

```bash
npm run migrate:fee-payment
```

## Error Handling

The system provides comprehensive error handling:

- **Validation Errors**: Input validation with detailed messages
- **Database Errors**: Transaction rollback with proper error messages
- **Business Logic Errors**: Custom validation for payment rules

## Security Considerations

- All database functions use `SECURITY DEFINER`
- Proper permission grants for authenticated users
- Input validation at multiple layers
- Audit trail for all financial operations

## Testing

Test the payment system by:

1. Creating a test payment through the dialog
2. Verifying all related tables are updated
3. Checking balance calculations
4. Testing rebate functionality
5. Validating error scenarios

## Future Enhancements

- Payment gateway integration
- Bulk payment processing
- Payment reminders and notifications
- Advanced reporting and analytics
- Multi-currency support
