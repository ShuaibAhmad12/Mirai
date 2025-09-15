// API Response Types for Student Profile

export interface StudentOverviewResponse {
  student: {
    id: string;
    full_name: string;
    status: string;
    enrollment_code: string;
  };
  profile: {
    father_name?: string;
    mother_name?: string;
    dob?: string;
    gender?: string;
    category?: string;
    nationality?: string;
  } | null;
  current_enrollment: {
    course_name: string;
    college_name: string;
    college_code: string;
    session_title: string;
    current_year: number;
    course_duration: number;
    enrollment_date: string;
    entry_type: string;
    status: string;
  } | null;
  quick_stats: {
    total_outstanding: number;
    previous_balance: number;
    current_due: number;
    total_paid: number;
    fee_plan_name?: string;
  } | null;
}

export interface StudentAcademicResponse {
  academic_history: Array<{
    id: string;
    enrollment_id: string;
    from_year?: number;
    to_year: number;
    course_duration?: number;
    effective_date: string;
    status: string;
    notes?: string;
    created_at: string;
  }>;
  prior_education: Array<{
    id: string;
    student_id: string;
    level?: string;
    board_university?: string;
    year_of_passing?: string;
    marks_percentage?: string;
    created_at: string;
    updated_at: string;
  }>;
}

export interface StudentFeesResponse {
  fee_summary: {
    enrollment_id: string;
    previous_balance: number;
    current_due: number;
    total_outstanding: number;
    total_paid: number;
    fee_plan_name?: string;
  } | null;
  recent_payments: Array<{
    id: string;
    receipt_number: string;
    receipt_date: string;
    amount: number;
    payment_method: string;
    status: string;
    created_at: string;
  }>;
  fee_details: Array<{
    component_name: string;
    component_code: string;
    year_number?: number;
    amount: number;
    original_amount?: number;
    paid_amount: number;
    outstanding_amount: number;
    fee_plan_item_id?: string;
  }>;
  detailed_receipts?: Array<{
    id: string;
    receipt_number: string;
    receipt_date: string;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
    payment_method: string;
    payment_reference: string | null;
    status: string;
    academic_year: string;
    components: Array<{
      component_name: string;
      component_code: string;
      allocated_amount: number;
      component_type: "payment" | "charge";
      component_balance?: number;
    }>;
    balance_after_payment: number;
    running_balance_before: number;
    comments: string | null;
  }>;
  detailed_charges?: Array<{
    id: string;
    charge_date: string;
    component_name: string;
    component_code: string;
    amount: number;
    running_balance_after: number;
    academic_year: string;
    description: string | null;
  }>;
}

export interface StudentContactResponse {
  addresses: {
    permanent?: {
      id: string;
      student_id: string;
      addr_type: "permanent";
      address_text?: string;
      state?: string;
      country?: string;
      created_at: string;
      updated_at: string;
    };
    correspondence?: {
      id: string;
      student_id: string;
      addr_type: "correspondence";
      address_text?: string;
      state?: string;
      country?: string;
      created_at: string;
      updated_at: string;
    };
  };
  contacts: Array<{
    id: string;
    student_id: string;
    contact_type:
      | "phone"
      | "parent_phone"
      | "guardian_phone"
      | "email"
      | "other";
    value_raw?: string;
    value_norm?: string;
    is_primary: boolean;
    created_at: string;
    updated_at: string;
  }>;
}

export interface StudentDocumentsResponse {
  documents: Array<{
    id: string;
    student_id: string;
    doc_type: string;
    doc_number?: string;
    is_primary: boolean;
    created_at: string;
    updated_at: string;
  }>;
}

export interface StudentInternalRefsResponse {
  cards: Array<{
    id: string;
    student_id: string;
    ref_group: "card";
    slot_number: number;
    raw_value?: string;
    created_at: string;
  }>;
  enos: Array<{
    id: string;
    student_id: string;
    ref_group: "eno";
    slot_number: number;
    raw_value?: string;
    created_at: string;
  }>;
}

export interface StudentNotesResponse {
  notes: Array<{
    id: string;
    student_id: string;
    note: string;
    created_at: string;
    created_by?: string;
  }>;
  total_count: number;
}

// Request Types for Updates
export interface UpdateContactRequest {
  addresses?: {
    permanent?: {
      address_text?: string;
      state?: string;
      country?: string;
    };
    correspondence?: {
      address_text?: string;
      state?: string;
      country?: string;
    };
  };
}

export interface UpdateInternalRefsRequest {
  refs: Array<{
    ref_group: "card" | "eno";
    slot_number: number;
    raw_value?: string;
  }>;
}

export interface AddNoteRequest {
  note: string;
  created_by?: string;
}

export interface AddPaymentRequest {
  amount: number;
  payment_method: string;
  receipt_number: string;
  receipt_date: string;
  academic_year: string;
}

// Fee Adjustments Types
export interface FeeAdjustment {
  id: string;
  adjustment_type: "DISCOUNT" | "PENALTY" | "SCHOLARSHIP" | "WAIVER" | "OTHER";
  amount: number;
  title: string;
  reason: string;
  status: "ACTIVE" | "CANCELLED";
  effective_date: string;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancelled_by_name?: string;
  cancellation_reason?: string;
  fee_components?: {
    code: string;
    label: string;
  };
}

export interface AddAdjustmentRequest {
  adjustment_type: "DISCOUNT" | "PENALTY" | "SCHOLARSHIP" | "WAIVER" | "OTHER";
  amount: number;
  title: string;
  reason: string;
  fee_component_code?: string;
  effective_date?: string;
}
