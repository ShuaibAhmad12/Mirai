import { createClient } from "@/lib/supabase/server";
import type {
  FeeAdjustment,
  AddAdjustmentRequest,
} from "@/lib/types/student-api.types";

interface ReceiptComponent {
  component_name: string;
  component_code: string;
  allocated_amount: number;
  component_type: "charge" | "payment" | "balance";
  component_balance: number;
}

export interface FeeSummary {
  enrollment_id: string;
  previous_balance: number;
  current_due: number;
  total_outstanding: number;
  total_paid: number;
  fee_plan_name?: string;
}

export interface RecentPayment {
  id: string;
  receipt_number: string;
  receipt_date: string;
  amount: number;
  payment_method: string;
  status: string;
}

interface FeeReceiptDetail {
  id: string;
  receipt_number: string;
  receipt_date: string;
  academic_year: string;
  paid_amount: number;
  balance_amount: number;
  payment_method: string;
  payment_reference?: string;
  status: string;
  comments?: string;
  running_balance_before: number;
  balance_after_payment: number;
  components: ReceiptComponent[];
}

export interface FeeChargeDetail {
  id: string;
  charge_date: string;
  component_name: string;
  component_code: string;
  amount: number;
  running_balance_after: number;
  academic_year: string;
  description: string | null;
}

export interface FeeDetail {
  component_name: string;
  component_code: string;
  year_number?: number;
  amount: number;
  original_amount?: number; // Original course fee amount
  paid_amount: number;
  outstanding_amount: number;
  fee_plan_item_id?: string; // Added for fee override editing
}

export class FeesService {
  private async getSupabase() {
    return await createClient();
  }

  async getFeeSummary(studentId: string): Promise<FeeSummary | null> {
    const supabase = await this.getSupabase();

    // First get current enrollment
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .single();

    if (enrollmentError || !enrollmentData) return null;

    // NEW: Get summary from fee_current_balances table
    const { data: currentBalances, error: balancesError } = await supabase
      .from("fee_current_balances")
      .select(
        `
        charged_amount,
        paid_amount,
        outstanding_amount,
        academic_year
      `
      )
      .eq("enrollment_id", enrollmentData.enrollment_id)
      .is("deleted_at", null);

    if (balancesError) {
      console.error(
        "Error fetching current balances for summary:",
        balancesError
      );
      // Fallback to old method
      return this.getFeeSummaryFallback(enrollmentData.enrollment_id);
    }

    // Get fee plan name
    const { data: enrollmentDetails } = await supabase
      .from("student_enrollments")
      .select(
        `
        fee_plans:fee_plan_id (
          name
        )
      `
      )
      .eq("id", enrollmentData.enrollment_id)
      .single();

    // Calculate totals from current balances
    const totals = (currentBalances || []).reduce(
      (acc, balance) => ({
        totalCharged: acc.totalCharged + (balance.charged_amount || 0),
        totalPaid: acc.totalPaid + (balance.paid_amount || 0),
        totalOutstanding:
          acc.totalOutstanding + (balance.outstanding_amount || 0),
      }),
      { totalCharged: 0, totalPaid: 0, totalOutstanding: 0 }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feePlan = (enrollmentDetails as any)?.fee_plans;

    return {
      enrollment_id: enrollmentData.enrollment_id,
      previous_balance: 0, // This would need to be calculated based on previous years
      current_due: totals.totalOutstanding,
      total_outstanding: totals.totalOutstanding,
      total_paid: totals.totalPaid,
      fee_plan_name: feePlan?.name,
    };
  }

  private async getFeeSummaryFallback(
    enrollmentId: string
  ): Promise<FeeSummary | null> {
    const supabase = await this.getSupabase();

    // Get fee summary from the existing view (fallback method)
    const { data: feeData, error: feeError } = await supabase
      .from("view_fee_year_summary")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .order("last_activity", { ascending: false })
      .limit(1)
      .single();

    if (feeError && feeError.code !== "PGRST116") throw feeError;

    // Calculate total paid from receipts
    const { data: receiptsData } = await supabase
      .from("fee_receipts")
      .select("paid_amount")
      .eq("enrollment_id", enrollmentId)
      .eq("status", "ACTIVE");

    const totalPaid = (receiptsData || []).reduce(
      (sum: number, receipt: { paid_amount: number }) =>
        sum + (receipt.paid_amount || 0),
      0
    );

    return {
      enrollment_id: enrollmentId,
      previous_balance: feeData?.outstanding_balance || 0,
      current_due: feeData?.outstanding_balance || 0,
      total_outstanding: feeData?.outstanding_balance || 0,
      total_paid: totalPaid,
      fee_plan_name: undefined,
    };
  }

  async getRecentPayments(
    studentId: string,
    limit = 10
  ): Promise<RecentPayment[]> {
    const supabase = await this.getSupabase();

    // First get current enrollment
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .single();

    if (enrollmentError || !enrollmentData) return [];

    const { data, error } = await supabase
      .from("fee_receipts")
      .select(
        `
        id,
        receipt_number,
        receipt_date,
        paid_amount,
        payment_method,
        status,
        created_at
      `
      )
      .eq("enrollment_id", enrollmentData.enrollment_id)
      .order("receipt_date", { ascending: false })
      .limit(limit);

    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((receipt: any) => ({
      id: receipt.id,
      receipt_number: receipt.receipt_number,
      receipt_date: receipt.receipt_date,
      amount: receipt.paid_amount,
      payment_method: receipt.payment_method || "Unknown",
      status: receipt.status,
      created_at: receipt.created_at,
    }));
  }

  async getFeeDetails(studentId: string): Promise<FeeDetail[]> {
    const supabase = await this.getSupabase();

    // First get current enrollment
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .single();

    if (enrollmentError || !enrollmentData) {
      return [];
    }

    // Get current year from student enrollment details
    const { data: currentYearData } = await supabase
      .from("student_enrollments")
      .select("current_year")
      .eq("id", enrollmentData.enrollment_id)
      .single();

    const studentCurrentYear = currentYearData?.current_year || 1;

    const { data: enrollmentDetails } = await supabase
      .from("student_enrollments")
      .select("fee_plan_id")
      .eq("id", enrollmentData.enrollment_id)
      .single();

    // Get course fees (base amounts) from fee_plan_items when available
    type ComponentRef = { id?: string; label?: string; code?: string };
    type FeeJoinRow = {
      id?: string;
      amount?: number;
      override_amount?: number;
      year_number?: number;
      fee_component_id?: string | null;
      component_id?: string | null; // Add component_id for fee_plan_items
      paid_amount?: number;
      outstanding_amount?: number;
      charged_amount?: number;
      fee_plan_item_id?: string;
      fee_components?: ComponentRef | ComponentRef[];
    };

    let courseFees: FeeJoinRow[] | null = null;
    let courseFeesError: unknown = null;

    // Combine the data by fee component and year
    // Use a stable map key based on fee_component_id + year_number
    const feeComponentsMap = new Map<
      string,
      FeeDetail & { fee_component_id?: string }
    >();

    type ComponentJoin = ComponentRef | ComponentRef[] | undefined;
    const pickComponent = (fc: ComponentJoin): ComponentRef => {
      if (!fc) return {};
      return Array.isArray(fc) ? fc[0] || {} : fc;
    };

    if (enrollmentDetails?.fee_plan_id) {
      const { data, error } = await supabase
        .from("fee_plan_items")
        .select(
          `
          id,
          amount,
          year_number,
          component_id,
          fee_components!inner(id, label, code)
        `
        )
        .eq("fee_plan_id", enrollmentDetails.fee_plan_id);
      courseFees = data || [];
      courseFeesError = error || null;
    }

    // Get actual fees from fee overrides table
    const { data: actualFees, error: actualFeesError } = await supabase
      .from("student_fee_overrides")
      .select(
        `
        id,
        override_amount,
        discount_amount,
        year_number,
        fee_plan_item_id,
        fee_plan_items!inner (
          id,
          amount,
          year_number,
          component_id,
          fee_components!inner(id, label, code)
        )
      `
      )
      .eq("enrollment_id", enrollmentData.enrollment_id);

    // Get balance due from fee_current_balances table
    const { data: currentBalances, error: balancesError } = await supabase
      .from("fee_current_balances")
      .select(
        `
        id,
        charged_amount,
        outstanding_amount,
        paid_amount, 
        year_number,
        fee_component_id,
        fee_components!inner(id, label, code)
      `
      )
      .eq("enrollment_id", enrollmentData.enrollment_id);

    if (courseFeesError) {
      console.error("Error fetching course fees:", courseFeesError);
    }
    if (actualFeesError) {
      console.error("Error fetching actual fees:", actualFeesError);
    }
    if (balancesError) {
      console.error("Error fetching balance data:", balancesError);
    }

    // Add course fees (original amounts)
    (courseFees || []).forEach((fee: FeeJoinRow) => {
      const component = pickComponent(fee.fee_components);
      const compId = fee.fee_component_id || component?.id;
      const key = `${compId || component?.code || "UNKNOWN"}_${
        fee.year_number
      }`;
      if (!feeComponentsMap.has(key)) {
        feeComponentsMap.set(key, {
          component_name: component?.label || "Unknown Component",
          component_code: component?.code || "UNKNOWN",
          year_number: fee.year_number,
          original_amount: 0,
          amount: 0,
          paid_amount: 0,
          outstanding_amount: 0,
          fee_component_id: compId,
          fee_plan_item_id: fee.id, // Add fee_plan_item_id from the course fee
        });
      }
      const feeData = feeComponentsMap.get(key)!;
      feeData.original_amount = fee.amount || 0;
      feeData.fee_plan_item_id = fee.id; // Ensure fee_plan_item_id is set
      // Default actual amount to course fee only if no amount has been set yet
      // Don't overwrite if amount is explicitly set to 0 (e.g., by overrides)
      if (feeData.amount === undefined || feeData.amount === null) {
        feeData.amount = fee.amount || 0;
      }
    });

    // Add actual fees (overrides) - these override the course fees
    type OverrideJoinRow = FeeJoinRow & {
      fee_plan_items?: FeeJoinRow | FeeJoinRow[];
      fee_plan_item_id?: string;
      discount_amount?: number;
      override_amount?: number;
    };
    (actualFees || []).forEach((fee: OverrideJoinRow) => {
      // Resolve component via joined fee_plan_items
      const planItem = Array.isArray(fee.fee_plan_items)
        ? fee.fee_plan_items[0]
        : fee.fee_plan_items;
      const component = pickComponent(planItem?.fee_components);
      const compId = planItem?.component_id || component?.id; // Fix: use component_id, not fee_component_id
      const year = fee.year_number ?? planItem?.year_number;
      const key = `${compId || component?.code || "UNKNOWN"}_${year}`;
      if (!feeComponentsMap.has(key)) {
        feeComponentsMap.set(key, {
          component_name: component?.label || "Unknown Component",
          component_code: component?.code || "UNKNOWN",
          year_number: year,
          original_amount: 0,
          amount: 0,
          paid_amount: 0,
          outstanding_amount: 0,
          fee_component_id: compId,
          fee_plan_item_id: fee.fee_plan_item_id, // Add fee_plan_item_id from override
        });
      }
      const feeData = feeComponentsMap.get(key)!;
      // Ensure fee_plan_item_id is set from override
      if (fee.fee_plan_item_id) {
        feeData.fee_plan_item_id = fee.fee_plan_item_id;
      }
      // Ensure base/original is set from plan item if not already
      if (!feeData.original_amount || feeData.original_amount === 0) {
        feeData.original_amount = (planItem?.amount as number) || 0;
      }
      // Compute year-wise actual: treat override_amount as ABSOLUTE for that year,
      // then apply any discount_amount on top of it. If no override, start from base and subtract discount.
      const base =
        (feeData.original_amount ?? (planItem?.amount as number)) || 0;
      let actual = base;
      const overrideAbs = fee.override_amount as number | null | undefined;
      const discount = fee.discount_amount as number | null | undefined;

      if (overrideAbs !== null && overrideAbs !== undefined) {
        actual = overrideAbs;
      }
      if (discount !== null && discount !== undefined) {
        actual = Math.max(0, actual - discount);
      }

      feeData.amount = actual;
    });

    // Add balance data (paid and outstanding amounts)
    (currentBalances || []).forEach((balance: FeeJoinRow) => {
      const component = pickComponent(balance.fee_components);
      const compId = balance.fee_component_id || component?.id;
      const key = `${compId || component?.code || "UNKNOWN"}_${
        balance.year_number
      }`;
      if (!feeComponentsMap.has(key)) {
        feeComponentsMap.set(key, {
          component_name: component?.label || "Unknown Component",
          component_code: component?.code || "UNKNOWN",
          year_number: balance.year_number,
          original_amount: 0,
          amount: 0,
          paid_amount: 0,
          outstanding_amount: 0,
          fee_component_id: compId,
        });
      }
      const feeData = feeComponentsMap.get(key)!;

      // Only show paid amounts for current year and below
      // For future years, paid_amount should be 0
      const yearNumber = balance.year_number || 0;
      if (yearNumber <= studentCurrentYear) {
        feeData.paid_amount = balance.paid_amount || 0;
      } else {
        feeData.paid_amount = 0;
      }

      feeData.outstanding_amount = balance.outstanding_amount || 0;
    });

    // Normalize minimally: keep 'amount' and 'outstanding' as-is; derive 'paid' if missing
    const feeDetails = Array.from(feeComponentsMap.values()).map((row) => {
      const original = Number(row.original_amount || 0);
      let amount = Number(row.amount || 0);
      // Don't override amount if it has been explicitly set (including 0 from overrides)
      // Only default to original if amount was never set (undefined/null)
      if (row.amount === undefined || row.amount === null) {
        if (original) amount = original;
      }
      const outstanding = Number(row.outstanding_amount || 0);
      let paid = Number(row.paid_amount || 0);

      // Only derive paid amount for current and past years
      const yearNumber = row.year_number || 0;
      if (yearNumber <= studentCurrentYear) {
        if (!paid && (amount || outstanding)) {
          paid = Math.max(0, amount - outstanding);
        }
      } else {
        // Future years should always show 0 paid and outstanding should equal actual fee
        paid = 0;
        // For pending fees, outstanding amount should equal the actual fee amount
        // This ensures Balance Due = Actual Fee for pending fees
        if (amount > 0) {
          return {
            ...row,
            amount,
            paid_amount: 0,
            outstanding_amount: amount, // Balance Due = Actual Fee for pending
          } as typeof row;
        }
      }

      return {
        ...row,
        amount,
        paid_amount: paid,
        outstanding_amount: outstanding,
      } as typeof row;
    });

    // Sort fee details by year and component type for consistent ordering
    const sortedFeeDetails = feeDetails.sort((a, b) => {
      // First sort by year number
      const yearDiff = (a.year_number || 0) - (b.year_number || 0);
      if (yearDiff !== 0) return yearDiff;

      // Then sort by component code for consistent ordering within each year
      const componentOrder: { [key: string]: number } = {
        ADMISSION: 1,
        TUITION: 2,
        SECURITY: 3,
        OTHER: 4,
        TRANSPORT: 5,
        HOSTEL: 6,
        EXAM: 7,
        MISC: 8,
      };

      const aOrder = componentOrder[a.component_code] || 99;
      const bOrder = componentOrder[b.component_code] || 99;

      if (aOrder !== bOrder) return aOrder - bOrder;

      // Finally sort by component name as fallback
      return (a.component_name || "").localeCompare(b.component_name || "");
    });

    return sortedFeeDetails;
  }

  // Removed stray and unused helper/fallback code that was causing syntax errors

  async addPayment(
    studentId: string,
    paymentData: {
      amount: number;
      payment_method: string;
      receipt_number: string;
      receipt_date: string;
      academic_year: string;
    }
  ): Promise<RecentPayment> {
    const supabase = await this.getSupabase();

    // First get current enrollment
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .single();

    if (enrollmentError || !enrollmentData) {
      throw new Error("Student enrollment not found");
    }

    const { data, error } = await supabase
      .from("fee_receipts")
      .insert({
        enrollment_id: enrollmentData.enrollment_id,
        receipt_number: paymentData.receipt_number,
        receipt_date: paymentData.receipt_date,
        total_amount: paymentData.amount,
        paid_amount: paymentData.amount,
        balance_amount: 0,
        payment_method: paymentData.payment_method,
        academic_year: paymentData.academic_year,
        status: "ACTIVE",
      })
      .select(
        `
        id,
        receipt_number,
        receipt_date,
        paid_amount,
        payment_method,
        status,
        created_at
      `
      )
      .single();

    if (error) throw error;

    return {
      id: data.id,
      receipt_number: data.receipt_number,
      receipt_date: data.receipt_date,
      amount: data.paid_amount,
      payment_method: data.payment_method,
      status: data.status,
    };
  }

  async getFeeReceiptsDetailed(studentId: string): Promise<FeeReceiptDetail[]> {
    const supabase = await this.getSupabase();

    // Get current enrollment
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .single();

    if (enrollmentError || !enrollmentData) return [];

    // Get detailed receipts with component allocations
    const { data: receipts, error: receiptsError } = await supabase
      .from("fee_receipts")
      .select(
        `
        id,
        receipt_number,
        receipt_date,
        total_amount,
        paid_amount,
        balance_amount,
        payment_method,
        payment_reference,
        status,
        academic_year,
    remarks,
        comments,
        created_at,
        fee_receipt_allocations (
          allocated_amount,
          fee_components (
            code,
            label
          )
        )
      `
      )
      .eq("enrollment_id", enrollmentData.enrollment_id)
      .eq("status", "ACTIVE")
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (receiptsError) throw receiptsError;

    // Get fee ledger events to calculate running balance
    const { data: ledgerEvents, error: ledgerError } = await supabase
      .from("fee_ledger_events")
      .select("id, amount, running_balance, event_date, receipt_id, event_type")
      .eq("enrollment_id", enrollmentData.enrollment_id)
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (ledgerError) throw ledgerError;

    // Simple approach - we'll get balance records for each receipt individually

    // Process receipts and calculate balances for ALL components
    type ReceiptRow = {
      id: string;
      receipt_number: string;
      receipt_date: string;
      total_amount: number;
      paid_amount: number;
      balance_amount: number;
      payment_method: string;
      payment_reference?: string;
      status: string;
      academic_year: string;
      comments?: string;
      remarks?: string;
      fee_receipt_allocations?: Array<{
        allocated_amount: number;
        fee_components?:
          | { code?: string; label?: string }
          | Array<{ code?: string; label?: string }>;
      }>;
    };

    type LedgerEvent = {
      id: string;
      amount: number;
      running_balance: number;
      event_date: string;
      receipt_id: string | null;
      event_type: string;
    };

    const pickAllocComponent = (
      fc:
        | { code?: string; label?: string }
        | Array<{ code?: string; label?: string }>
        | undefined
    ) => {
      if (!fc) return {} as { code?: string; label?: string };
      return Array.isArray(fc)
        ? fc[0] || ({} as { code?: string; label?: string })
        : fc;
    };

    const detailedReceipts = await Promise.all(
      ((receipts as ReceiptRow[] | null | undefined) || []).map(
        async (receipt: ReceiptRow) => {
          // Find corresponding ledger events for this receipt
          const receiptEvents = (
            (ledgerEvents as LedgerEvent[] | null | undefined) || []
          ).filter((event: LedgerEvent) => event.receipt_id === receipt.id);

          // Get running balance before this payment
          const paymentEvent = receiptEvents.find(
            (event: LedgerEvent) => event.event_type === "PAYMENT_RECEIVED"
          );

          const runningBalanceBefore = paymentEvent
            ? paymentEvent.running_balance + Math.abs(paymentEvent.amount)
            : 0;

          // Process component allocations (what was paid)
          const paidComponents: ReceiptComponent[] = (
            receipt.fee_receipt_allocations || []
          ).map((allocation) => {
            const fc = pickAllocComponent(allocation.fee_components);
            return {
              component_name: fc?.label || "Unknown",
              component_code: fc?.code || "UNKNOWN",
              allocated_amount: allocation.allocated_amount,
              component_type: "payment" as const,
              component_balance: 0, // Will be calculated below
            } as ReceiptComponent;
          });

          // Get balance records for this receipt - these show balances BEFORE this payment
          const { data: balanceRecords, error: balanceError } = await supabase
            .from("fee_receipt_balance_records")
            .select(
              `
          balance_amount,
          fee_components!inner (
            code,
            label
          )
        `
            )
            .eq("receipt_id", receipt.id);

          if (balanceError) {
            console.error("Error fetching balance records:", balanceError);
          }

          // Convert balance records to component format, include zero balances as-is
          const allComponentBalances = (
            (balanceRecords as
              | Array<{
                  balance_amount: number;
                  fee_components: { label: string; code: string };
                }>
              | null
              | undefined) || []
          ).map((record) => ({
            component_name: record.fee_components.label,
            component_code: record.fee_components.code,
            allocated_amount: 0,
            component_type: "balance" as const,
            component_balance: record.balance_amount,
          }));

          return {
            id: receipt.id,
            receipt_number: receipt.receipt_number,
            receipt_date: receipt.receipt_date,
            total_amount: receipt.total_amount,
            paid_amount: receipt.paid_amount,
            balance_amount: receipt.balance_amount,
            payment_method: receipt.payment_method,
            payment_reference: receipt.payment_reference,
            status: receipt.status,
            academic_year: receipt.academic_year,
            components: paidComponents, // What was paid in this receipt
            all_component_balances: allComponentBalances, // Already filtered for balance > 0
            balance_after_payment: paymentEvent?.running_balance || 0,
            running_balance_before: runningBalanceBefore,
            comments: receipt.comments,
            remarks: receipt.remarks,
          } as FeeReceiptDetail;
        }
      )
    );

    return detailedReceipts;
  }

  async getFeeChargesDetailed(studentId: string): Promise<FeeChargeDetail[]> {
    const supabase = await this.getSupabase();

    // Get current enrollment
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .single();

    if (enrollmentError || !enrollmentData) return [];

    // Get fee charges from ledger events
    const { data: chargeEvents, error: chargesError } = await supabase
      .from("fee_ledger_events")
      .select(
        `
        id,
        event_type,
        event_date,
        amount,
        running_balance,
        academic_year,
        description,
        fee_components (
          code,
          label
        )
      `
      )
      .eq("enrollment_id", enrollmentData.enrollment_id)
      .eq("event_type", "CHARGE_CREATED")
      .order("event_date", { ascending: false });

    if (chargesError) throw chargesError;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (chargeEvents || []).map((charge: any) => ({
      id: charge.id,
      charge_date: charge.event_date,
      component_name: charge.fee_components?.label || "Unknown",
      component_code: charge.fee_components?.code || "UNKNOWN",
      amount: Math.abs(charge.amount), // Charges are typically negative in ledger
      running_balance_after: charge.running_balance,
      academic_year: charge.academic_year,
      description: charge.description,
    }));
  }

  async createRebateAdjustment(adjustmentData: {
    enrollment_id: string;
    academic_year: string;
    amount: number;
    title: string;
    reason: string;
    current_year: number;
    created_by: string;
  }) {
    const supabase = await createClient();

    // Find the current year's tuition fee component
    const { data: tuitionComponent, error: componentError } = await supabase
      .from("fee_components")
      .select("id")
      .eq("code", "TUITION")
      .single();

    if (componentError) throw componentError;

    // Create the rebate adjustment record
    const { data: adjustment, error: adjustmentError } = await supabase
      .from("fee_adjustments")
      .insert({
        enrollment_id: adjustmentData.enrollment_id,
        academic_year: adjustmentData.academic_year,
        fee_component_id: tuitionComponent.id,
        adjustment_type: "DISCOUNT",
        amount: adjustmentData.amount,
        title: adjustmentData.title,
        reason: adjustmentData.reason,
        status: "ACTIVE",
        effective_date: new Date().toISOString().split("T")[0],
        created_by: adjustmentData.created_by,
      })
      .select()
      .single();

    if (adjustmentError) throw adjustmentError;

    // Create ledger event for the rebate
    const { error: ledgerError } = await supabase
      .from("fee_ledger_events")
      .insert({
        event_type: "DISCOUNT_APPLIED",
        enrollment_id: adjustmentData.enrollment_id,
        academic_year: adjustmentData.academic_year,
        fee_component_id: tuitionComponent.id,
        amount: -adjustmentData.amount, // Negative for discount
        running_balance: 0, // This will be calculated by a trigger
        description: adjustmentData.title + ": " + adjustmentData.reason,
        created_by: adjustmentData.created_by,
      });

    if (ledgerError) throw ledgerError;

    // Update current balances - get current values first
    const { data: currentBalance, error: balanceFetchError } = await supabase
      .from("fee_current_balances")
      .select("discount_amount, charged_amount, outstanding_amount")
      .eq("enrollment_id", adjustmentData.enrollment_id)
      .eq("fee_component_id", tuitionComponent.id)
      .single();

    if (balanceFetchError) throw balanceFetchError;

    const { error: balanceError } = await supabase
      .from("fee_current_balances")
      .update({
        discount_amount:
          (currentBalance?.discount_amount || 0) + adjustmentData.amount,
        charged_amount:
          (currentBalance?.charged_amount || 0) - adjustmentData.amount,
        outstanding_amount:
          (currentBalance?.outstanding_amount || 0) - adjustmentData.amount,
        last_updated_at: new Date().toISOString(),
        last_updated_by: adjustmentData.created_by,
      })
      .eq("enrollment_id", adjustmentData.enrollment_id)
      .eq("fee_component_id", tuitionComponent.id);

    if (balanceError) throw balanceError;

    return adjustment;
  }

  async getFeeAdjustments(studentId: string): Promise<FeeAdjustment[]> {
    const supabase = await this.getSupabase();

    // Get current enrollment
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("v_student_current_enrollment")
      .select("enrollment_id")
      .eq("student_id", studentId)
      .single();

    if (enrollmentError || !enrollmentData) return [];

    // Get fee adjustments with component details
    const { data: adjustments, error: adjustmentError } = await supabase
      .from("fee_adjustments")
      .select(
        `
        id,
        adjustment_type,
        amount,
        title,
        reason,
        status,
        effective_date,
        created_at,
        created_by,
        cancelled_at,
        cancelled_by,
        cancellation_reason,
        fee_components:fee_component_id (
          code,
          label
        )
      `
      )
      .eq("enrollment_id", enrollmentData.enrollment_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (adjustmentError) {
      console.error("Error fetching fee adjustments:", adjustmentError);
      return [];
    }

    if (!adjustments || adjustments.length === 0) {
      return [];
    }

    // Get unique user IDs for fetching user names
    const userIds = [
      ...new Set([
        ...adjustments.map((a) => a.created_by).filter(Boolean),
        ...adjustments.map((a) => a.cancelled_by).filter(Boolean),
      ]),
    ];

    let userMap: Record<string, { id: string; full_name?: string }> = {};
    if (userIds.length > 0) {
      // Fetch user info from public.users table using supabase_auth_id
      const { data: userData } = await supabase
        .from("users")
        .select("supabase_auth_id, full_name")
        .in("supabase_auth_id", userIds);

      if (userData) {
        // Create map using supabase_auth_id as key
        userMap = userData.reduce((acc, user) => {
          acc[user.supabase_auth_id] = {
            id: user.supabase_auth_id,
            full_name: user.full_name,
          };
          return acc;
        }, {} as Record<string, { id: string; full_name?: string }>);
      }
    }

    // Transform the data to match our interface with user information
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (adjustments || []).map((adj: any) => {
      const createdByUser = adj.created_by ? userMap[adj.created_by] : null;
      const cancelledByUser = adj.cancelled_by
        ? userMap[adj.cancelled_by]
        : null;

      const createdByName = createdByUser?.full_name || "Unknown User";
      const cancelledByName = cancelledByUser?.full_name || "Unknown User";

      return {
        id: adj.id,
        adjustment_type: adj.adjustment_type,
        amount: adj.amount,
        title: adj.title,
        reason: adj.reason,
        status: adj.status,
        effective_date: adj.effective_date,
        created_at: adj.created_at,
        created_by: adj.created_by,
        created_by_name: createdByName,
        cancelled_at: adj.cancelled_at,
        cancelled_by: adj.cancelled_by,
        cancelled_by_name: cancelledByName,
        cancellation_reason: adj.cancellation_reason,
        fee_components: adj.fee_components,
      };
    }) as FeeAdjustment[];
  }

  async createAdjustment(
    studentId: string,
    adjustmentData: AddAdjustmentRequest
  ): Promise<FeeAdjustment> {
    const supabase = await this.getSupabase();

    try {
      // Get the student's enrollment info first
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("v_student_current_enrollment")
        .select("enrollment_id, entry_year")
        .eq("student_id", studentId)
        .single();

      if (enrollmentError || !enrollmentData) {
        console.error("Student enrollment lookup failed:", enrollmentError);
        throw new Error("Student enrollment not found");
      }

      // Get the tuition fee component ID
      const { data: componentData, error: componentError } = await supabase
        .from("fee_components")
        .select("id")
        .eq("code", "TUITION")
        .single();

      if (componentError || !componentData) {
        throw new Error("Tuition fee component not found");
      }

      // Generate academic year (current year format YYYY-YY)
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${(currentYear + 1)
        .toString()
        .slice(-2)}`;

      // Create the adjustment record
      const { data: adjustmentResult, error: adjustmentError } = await supabase
        .from("fee_adjustments")
        .insert({
          enrollment_id: enrollmentData.enrollment_id,
          academic_year: academicYear,
          fee_component_id: componentData.id,
          adjustment_type: adjustmentData.adjustment_type,
          amount: adjustmentData.amount,
          title: adjustmentData.title,
          reason: adjustmentData.reason,
          status: "ACTIVE",
          effective_date:
            adjustmentData.effective_date ||
            new Date().toISOString().split("T")[0],
          created_by: "00000000-0000-0000-0000-000000000001", // System user placeholder
        })
        .select()
        .single();

      if (adjustmentError) {
        console.error("Error creating adjustment:", adjustmentError);
        throw new Error(
          `Failed to create adjustment: ${adjustmentError.message}`
        );
      }

      // For discounts/scholarships/waivers, update balances (simplified approach)
      const isDeduction = ["DISCOUNT", "SCHOLARSHIP", "WAIVER"].includes(
        adjustmentData.adjustment_type
      );
      const isPenalty = adjustmentData.adjustment_type === "PENALTY";

      if (isDeduction || isPenalty) {
        // Create a ledger event for audit trail
        const ledgerEventType = isPenalty
          ? "PENALTY_APPLIED"
          : "DISCOUNT_APPLIED";
        const ledgerAmount = isPenalty
          ? adjustmentData.amount
          : -adjustmentData.amount;

        const { error: ledgerError } = await supabase
          .from("fee_ledger_events")
          .insert({
            event_type: ledgerEventType,
            enrollment_id: enrollmentData.enrollment_id,
            academic_year: academicYear,
            fee_component_id: componentData.id,
            amount: ledgerAmount,
            running_balance: 0, // Will be calculated by trigger if available
            description: `${adjustmentData.adjustment_type}: ${adjustmentData.title}`,
          });

        if (ledgerError) {
          console.warn("Warning: Could not create ledger event:", ledgerError);
          // Don't throw here, adjustment was created successfully
        }

        // Update current balances - find the tuition balance record for this student
        const { data: currentBalance, error: balanceFetchError } =
          await supabase
            .from("fee_current_balances")
            .select("id, discount_amount, charged_amount, outstanding_amount")
            .eq("enrollment_id", enrollmentData.enrollment_id)
            .eq("fee_component_id", componentData.id)
            .single();

        if (balanceFetchError) {
          console.warn(
            "Warning: Could not fetch current balance for update:",
            balanceFetchError
          );
        } else if (currentBalance) {
          // Calculate new balance values
          const updateData: {
            last_updated_at: string;
            last_updated_by: string;
            outstanding_amount?: number;
            discount_amount?: number;
          } = {
            last_updated_at: new Date().toISOString(),
            last_updated_by: "00000000-0000-0000-0000-000000000001",
          };

          if (isPenalty) {
            // For penalties, just increase outstanding amount (what student owes)
            updateData.outstanding_amount =
              (currentBalance.outstanding_amount || 0) + adjustmentData.amount;
          } else {
            // For discounts/scholarships/waivers, increase discount and reduce outstanding
            updateData.discount_amount =
              (currentBalance.discount_amount || 0) + adjustmentData.amount;
            updateData.outstanding_amount =
              (currentBalance.outstanding_amount || 0) - adjustmentData.amount;
            // Ensure outstanding doesn't go negative
            updateData.outstanding_amount = Math.max(
              0,
              updateData.outstanding_amount
            );
          }

          const { error: balanceError } = await supabase
            .from("fee_current_balances")
            .update(updateData)
            .eq("enrollment_id", enrollmentData.enrollment_id)
            .eq("fee_component_id", componentData.id);

          if (balanceError) {
            console.warn(
              "Warning: Could not update current balance:",
              balanceError
            );
            // Don't throw here, adjustment was created successfully
          }
        } else {
          console.warn("No current balance record found to update");
        }
      }

      return adjustmentResult;
    } catch (error) {
      console.error("Error in createAdjustment:", error);
      throw error;
    }
  }

  async cancelAdjustment(
    adjustmentId: string,
    cancellationReason: string
  ): Promise<FeeAdjustment> {
    const supabase = await this.getSupabase();

    try {
      // Get current user for audit trail
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Unauthorized");
      }

      // Get the adjustment details first to validate it can be cancelled
      const { data: adjustment, error: adjustmentError } = await supabase
        .from("fee_adjustments")
        .select(
          `
          id,
          status,
          adjustment_type,
          amount,
          enrollment_id,
          fee_component_id,
          effective_date
        `
        )
        .eq("id", adjustmentId)
        .single();

      if (adjustmentError || !adjustment) {
        throw new Error("Adjustment not found");
      }

      if (adjustment.status === "CANCELLED") {
        throw new Error("Adjustment is already cancelled");
      }

      // Update the adjustment to cancelled status
      const { data: cancelledAdjustment, error: cancelError } = await supabase
        .from("fee_adjustments")
        .update({
          status: "CANCELLED",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancellation_reason: cancellationReason,
        })
        .eq("id", adjustmentId)
        .select(
          `
          id,
          adjustment_type,
          amount,
          title,
          reason,
          status,
          effective_date,
          created_at,
          created_by,
          cancelled_at,
          cancelled_by,
          cancellation_reason,
          fee_components:fee_component_id (
            code,
            label
          )
        `
        )
        .single();

      if (cancelError) {
        throw new Error(`Failed to cancel adjustment: ${cancelError.message}`);
      }

      // Reverse the balance impact of the adjustment
      const isDeduction = ["DISCOUNT", "SCHOLARSHIP", "WAIVER"].includes(
        adjustment.adjustment_type
      );
      const isPenalty = adjustment.adjustment_type === "PENALTY";

      if (isDeduction || isPenalty) {
        // Get current balance record
        const { data: currentBalance, error: balanceFetchError } =
          await supabase
            .from("fee_current_balances")
            .select("id, discount_amount, charged_amount, outstanding_amount")
            .eq("enrollment_id", adjustment.enrollment_id)
            .eq("fee_component_id", adjustment.fee_component_id)
            .single();

        if (!balanceFetchError && currentBalance) {
          const updateData: {
            last_updated_at: string;
            last_updated_by: string;
            outstanding_amount?: number;
            discount_amount?: number;
          } = {
            last_updated_at: new Date().toISOString(),
            last_updated_by: user.id,
          };

          if (isPenalty) {
            // For penalty cancellation, reduce the outstanding amount
            updateData.outstanding_amount = Math.max(
              0,
              (currentBalance.outstanding_amount || 0) - adjustment.amount
            );
          } else {
            // For discount/scholarship/waiver cancellation, reduce discount and increase outstanding
            updateData.discount_amount = Math.max(
              0,
              (currentBalance.discount_amount || 0) - adjustment.amount
            );
            updateData.outstanding_amount =
              (currentBalance.outstanding_amount || 0) + adjustment.amount;
          }

          const { error: balanceError } = await supabase
            .from("fee_current_balances")
            .update(updateData)
            .eq("enrollment_id", adjustment.enrollment_id)
            .eq("fee_component_id", adjustment.fee_component_id);

          if (balanceError) {
            console.warn(
              "Warning: Could not reverse balance impact:",
              balanceError
            );
          }
        }

        // Create ledger event for cancellation
        const ledgerAmount = isPenalty ? -adjustment.amount : adjustment.amount;

        const { error: ledgerError } = await supabase
          .from("fee_ledger_events")
          .insert({
            event_type: "CANCELLED",
            enrollment_id: adjustment.enrollment_id,
            academic_year: new Date().getFullYear().toString(),
            fee_component_id: adjustment.fee_component_id,
            amount: ledgerAmount,
            running_balance: 0,
            description: `Cancelled ${adjustment.adjustment_type}: ${cancellationReason}`,
            created_by: user.id,
          });

        if (ledgerError) {
          console.warn(
            "Warning: Could not create cancellation ledger event:",
            ledgerError
          );
        }
      }

      // Get user information for the response
      const { data: userData } = await supabase
        .from("users")
        .select("supabase_auth_id, full_name")
        .in("supabase_auth_id", [cancelledAdjustment.created_by, user.id]);

      const userMap = (userData || []).reduce((acc, u) => {
        acc[u.supabase_auth_id] = u.full_name || "Unknown User";
        return acc;
      }, {} as Record<string, string>);

      return {
        id: cancelledAdjustment.id,
        adjustment_type: cancelledAdjustment.adjustment_type,
        amount: cancelledAdjustment.amount,
        title: cancelledAdjustment.title,
        reason: cancelledAdjustment.reason,
        status: cancelledAdjustment.status,
        effective_date: cancelledAdjustment.effective_date,
        created_at: cancelledAdjustment.created_at,
        created_by: cancelledAdjustment.created_by,
        created_by_name:
          userMap[cancelledAdjustment.created_by] || "Unknown User",
        cancelled_at: cancelledAdjustment.cancelled_at,
        cancelled_by: cancelledAdjustment.cancelled_by,
        cancelled_by_name: userMap[user.id] || "Unknown User",
        cancellation_reason: cancelledAdjustment.cancellation_reason,
        fee_components: Array.isArray(cancelledAdjustment.fee_components)
          ? cancelledAdjustment.fee_components[0]
          : cancelledAdjustment.fee_components,
      };
    } catch (error) {
      console.error("Error in cancelAdjustment:", error);
      throw error;
    }
  }
}

export const feesService = new FeesService();
