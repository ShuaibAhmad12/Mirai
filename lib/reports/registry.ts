import type { ReportSource } from "./types";

// NOTE: Keep this list small and safe. Only include read-safe tables with RLS enabled.
export const REPORT_SOURCES: ReportSource[] = [
  {
    key: "students",
    label: "Students",
    table: "students",
    fields: {
      id: { type: "uuid", label: "ID" },
      full_name: { type: "text", label: "Name" },
      status: { type: "text", label: "Status" },
      created_at: { type: "date", label: "Created" },
      updated_at: { type: "date", label: "Updated" },
    },
    relations: {
      student_profiles: {
        label: "Profile",
        fields: {
          dob: { type: "date", label: "DOB" },
          gender: { type: "text", label: "Gender" },
          category: { type: "text", label: "Category" },
          mother_name: { type: "text", label: "Mother" },
          father_name: { type: "text", label: "Father" },
        },
      },
      student_enrollments: {
        label: "Enrollments",
        fields: {
          id: { type: "uuid", label: "Enrollment ID" },
          course_id: { type: "uuid", label: "Course ID" },
          session_id: { type: "uuid", label: "Session ID" },
          enrollment_code: { type: "text", label: "Enrollment Code" },
          enrollment_date: { type: "date", label: "Enrollment Date" },
          entry_year: { type: "number", label: "Entry Year" },
          entry_type: { type: "text", label: "Entry Type" },
          status: { type: "text", label: "Enrollment Status" },
        },
      },
    },
    defaultSort: { field: "created_at", dir: "desc" },
  },
  {
    key: "fee_receipts",
    label: "Fee Receipts",
    table: "fee_receipts",
    fields: {
      id: { type: "uuid", label: "Receipt ID" },
      receipt_number: { type: "text", label: "Receipt No" },
      receipt_date: { type: "date", label: "Receipt Date" },
      enrollment_id: { type: "uuid", label: "Enrollment ID" },
      academic_year: { type: "text", label: "Academic Year" },
      total_amount: { type: "number", label: "Total Amount" },
      paid_amount: { type: "number", label: "Paid Amount" },
      balance_amount: { type: "number", label: "Balance Amount" },
      payment_method: { type: "text", label: "Payment Method" },
      payment_reference: { type: "text", label: "Payment Reference" },
      payment_date: { type: "date", label: "Payment Date" },
      bank_name: { type: "text", label: "Bank Name" },
      status: { type: "text", label: "Status" },
      created_at: { type: "date", label: "Created" },
      updated_at: { type: "date", label: "Updated" },
    },
    defaultSort: { field: "receipt_date", dir: "desc" },
  },
  {
    key: "fee_current_balances",
    label: "Fee Balances",
    table: "fee_current_balances",
    fields: {
      id: { type: "uuid", label: "Balance ID" },
      enrollment_id: { type: "uuid", label: "Enrollment ID" },
      academic_year: { type: "text", label: "Academic Year" },
      fee_component_id: { type: "uuid", label: "Component ID" },
      component_code: { type: "text", label: "Component Code" },
      component_name: { type: "text", label: "Component Name" },
      year_number: { type: "number", label: "Year Number" },
      original_amount: { type: "number", label: "Original Amount" },
      override_amount: { type: "number", label: "Override Amount" },
      discount_amount: { type: "number", label: "Discount Amount" },
      charged_amount: { type: "number", label: "Charged Amount" },
      paid_amount: { type: "number", label: "Paid Amount" },
      outstanding_amount: { type: "number", label: "Outstanding Amount" },
      last_updated_at: { type: "date", label: "Last Updated" },
      created_at: { type: "date", label: "Created" },
    },
    defaultSort: { field: "last_updated_at", dir: "desc" },
  },
  {
    key: "agents",
    label: "Agents",
    table: "agents",
    fields: {
      id: { type: "uuid", label: "ID" },
      code: { type: "text", label: "Code" },
      name: { type: "text", label: "Name" },
      phone: { type: "text", label: "Phone" },
      email: { type: "text", label: "Email" },
      city: { type: "text", label: "City" },
      created_at: { type: "date", label: "Created" },
    },
    defaultSort: { field: "created_at", dir: "desc" },
  },
];

export function getReportSource(key: string): ReportSource | undefined {
  return REPORT_SOURCES.find((s) => s.key === key);
}
