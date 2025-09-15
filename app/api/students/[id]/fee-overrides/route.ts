import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface UpdateFeeOverrideRequest {
  fee_plan_item_id: string;
  year_number: number;
  component_code: string;
  new_amount: number;
  reason?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;
    const body: UpdateFeeOverrideRequest = await request.json();

    const {
      fee_plan_item_id,
      year_number,
      component_code,
      new_amount,
      reason,
    } = body;

    if (
      !fee_plan_item_id ||
      !year_number ||
      !component_code ||
      new_amount === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user for audit trail
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First, get the enrollment_id for this student
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("student_enrollments")
      .select("id")
      .eq("student_id", studentId)
      .eq("status", "active")
      .single();

    if (enrollmentError || !enrollmentData) {
      return NextResponse.json(
        { error: "Active enrollment not found" },
        { status: 404 }
      );
    }

    const enrollmentId = enrollmentData.id;

    // Get the original course fee amount from fee_plan_items
    const { data: courseFeeData, error: courseFeeError } = await supabase
      .from("fee_plan_items")
      .select(
        `
        amount, 
        fee_components!inner(label, code)
      `
      )
      .eq("id", fee_plan_item_id)
      .single();

    if (courseFeeError || !courseFeeData) {
      return NextResponse.json(
        { error: "Course fee information not found" },
        { status: 404 }
      );
    }

    const originalAmount = courseFeeData.amount || 0;
    const feeComponents = courseFeeData.fee_components as {
      label: string;
      code: string;
    }[];
    const componentName = feeComponents?.[0]?.label || "Unknown";
    const componentCode = feeComponents?.[0]?.code || "UNKNOWN";

    // Get current balance information for validation - find balance by component code
    // Note: fee_current_balances doesn't have fee_plan_item_id, we query by component code instead
    const { data: currentBalances, error: balanceError } = await supabase
      .from("fee_current_balances")
      .select(
        `
        paid_amount, 
        outstanding_amount, 
        charged_amount,
        fee_components!inner(code)
      `
      )
      .eq("enrollment_id", enrollmentId)
      .eq("fee_components.code", componentCode);

    if (balanceError) {
      console.error("Error fetching balance:", balanceError);
      return NextResponse.json(
        { error: "Failed to fetch current balance" },
        { status: 500 }
      );
    }

    // Find the specific balance for this component (there might be multiple years)
    const currentBalance = currentBalances?.[0]; // Take the first match for now

    // Basic validation checks - NO NEGATIVE VALUES ALLOWED
    if (new_amount < 0) {
      return NextResponse.json(
        { error: `Fee amount cannot be negative for ${componentName}` },
        { status: 400 }
      );
    }

    // Special cases: SECURITY and OTHER fees can be modified regardless of course fee amount
    const isSpecialComponent =
      componentCode === "SECURITY" || componentCode === "OTHER";

    // For non-special components, cannot increase actual fee beyond the original course fee
    if (!isSpecialComponent && new_amount > originalAmount) {
      return NextResponse.json(
        {
          error: `Actual fee (₹${new_amount.toLocaleString()}) cannot exceed course fee (₹${originalAmount.toLocaleString()}) for ${componentName}`,
        },
        { status: 400 }
      );
    }

    // Advanced validation checks if balance exists
    if (currentBalance) {
      const paidAmount = currentBalance.paid_amount || 0;
      const outstandingAmount = currentBalance.outstanding_amount || 0;
      const chargedAmount = currentBalance.charged_amount || 0;

      // CRITICAL BUSINESS RULE: For all components except SECURITY and OTHER,
      // actual fee cannot be lower than the amount already paid
      // This prevents financial discrepancies and ensures payment integrity
      if (!isSpecialComponent && new_amount < paidAmount) {
        return NextResponse.json(
          {
            error: `Cannot reduce ${componentName} fee to ₹${new_amount.toLocaleString()} as ₹${paidAmount.toLocaleString()} has already been paid. Minimum allowed fee is ₹${paidAmount.toLocaleString()}. This rule applies to all fees except SECURITY and OTHER charges.`,
          },
          { status: 400 }
        );
      }

      // Special handling for SECURITY and OTHER - they can go below paid amount but warn user
      if (isSpecialComponent && new_amount < paidAmount) {
        console.warn(
          `Warning: ${componentName} fee (₹${new_amount.toLocaleString()}) is below paid amount (₹${paidAmount.toLocaleString()}). This is allowed for special components but may require manual adjustment.`
        );
      }

      // If fee is fully paid (no outstanding balance), only allow same amount or higher for non-special components
      if (
        !isSpecialComponent &&
        outstandingAmount === 0 &&
        paidAmount > 0 &&
        new_amount < chargedAmount
      ) {
        return NextResponse.json(
          {
            error: `Cannot reduce ${componentName} fee below ₹${chargedAmount.toLocaleString()} as it is fully paid (₹${paidAmount.toLocaleString()}). You can only increase or keep the same amount.`,
          },
          { status: 400 }
        );
      }

      // Warn if trying to increase fee significantly for partially paid fees
      if (paidAmount > 0 && new_amount > chargedAmount * 1.5) {
        return NextResponse.json(
          {
            error: `Fee increase is too large for ${componentName}. Cannot increase by more than 50% when payment has already been made (₹${paidAmount.toLocaleString()} paid of ₹${chargedAmount.toLocaleString()}).`,
          },
          { status: 400 }
        );
      }
    }

    // Check if override already exists
    const { data: existingOverride } = await supabase
      .from("student_fee_overrides")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .eq("fee_plan_item_id", fee_plan_item_id)
      .single();

    let result;

    if (existingOverride) {
      // Update existing override
      const { data, error } = await supabase
        .from("student_fee_overrides")
        .update({
          override_amount: new_amount,
          reason: reason || `Fee updated via student profile`,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingOverride.id)
        .select("*")
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new override
      const { data, error } = await supabase
        .from("student_fee_overrides")
        .insert({
          enrollment_id: enrollmentId,
          fee_plan_item_id,
          year_number,
          component_code,
          override_amount: new_amount,
          discount_amount: 0, // Default to 0
          reason: reason || `Fee set via student profile`,
          source: "manual_edit",
          created_by: user.id,
          updated_by: user.id,
        })
        .select("*")
        .single();

      if (error) throw error;
      result = data;
    }

    // Update the fee_current_balances table to reflect the new override
    await updateFeeBalance(
      supabase,
      enrollmentId,
      fee_plan_item_id,
      new_amount
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: "Fee override updated successfully",
    });
  } catch (error) {
    console.error("Error updating fee override:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function updateFeeBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  enrollmentId: string,
  feePlanItemId: string,
  newOverrideAmount: number
) {
  try {
    // Get current balance record
    const { data: currentBalance } = await supabase
      .from("fee_current_balances")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .eq("fee_plan_item_id", feePlanItemId)
      .single();

    if (currentBalance) {
      // Calculate new charged amount (override - discount)
      const chargedAmount =
        newOverrideAmount - (currentBalance.discount_amount || 0);
      const newOutstanding = Math.max(
        0,
        chargedAmount - (currentBalance.paid_amount || 0)
      );

      // Update the balance record
      await supabase
        .from("fee_current_balances")
        .update({
          override_amount: newOverrideAmount,
          charged_amount: chargedAmount,
          outstanding_amount: newOutstanding,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentBalance.id);
    } else {
      // Create new balance record if it doesn't exist
      await supabase.from("fee_current_balances").insert({
        enrollment_id: enrollmentId,
        fee_plan_item_id: feePlanItemId,
        override_amount: newOverrideAmount,
        charged_amount: newOverrideAmount,
        outstanding_amount: newOverrideAmount,
        paid_amount: 0,
        discount_amount: 0,
      });
    }
  } catch (error) {
    console.error("Error updating fee balance:", error);
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;

    const supabase = await createClient();

    // Get current user for authorization
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First get the enrollment_id for this student
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("student_enrollments")
      .select("id")
      .eq("student_id", studentId)
      .eq("status", "active")
      .single();

    if (enrollmentError || !enrollmentData) {
      return NextResponse.json(
        { error: "Active enrollment not found" },
        { status: 404 }
      );
    }

    const enrollmentId = enrollmentData.id;

    // Fetch fee overrides with related information
    const { data: overrides, error: overridesError } = await supabase
      .from("student_fee_overrides")
      .select(
        `
        *,
        fee_plan_items:fee_plan_item_id (
          fee_components:component_id (
            label,
            code
          )
        )
      `
      )
      .eq("enrollment_id", enrollmentId)
      .order("created_at", { ascending: false });

    if (overridesError) {
      console.error("Error fetching fee overrides:", overridesError);
      return NextResponse.json(
        { error: "Failed to fetch fee overrides" },
        { status: 500 }
      );
    }

    // Fetch user information separately to handle null values
    const userIds = [
      ...new Set([
        ...overrides.map((o) => o.created_by).filter(Boolean),
        ...overrides.map((o) => o.updated_by).filter(Boolean),
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

    // Format the response to include component information
    const formattedOverrides = overrides.map((override) => {
      const feePlanItem = override.fee_plan_items;
      const component = feePlanItem?.fee_components;

      // Extract user names from metadata
      const createdByUser = override.created_by
        ? userMap[override.created_by]
        : null;
      const updatedByUser = override.updated_by
        ? userMap[override.updated_by]
        : null;

      const createdByName = createdByUser?.full_name || "Unknown User";
      const updatedByName = updatedByUser?.full_name || "Unknown User";

      return {
        id: override.id,
        student_id: studentId,
        enrollment_id: override.enrollment_id,
        fee_plan_item_id: override.fee_plan_item_id,
        year_number: override.year_number,
        component_code: override.component_code,
        component_name: component?.label || override.component_code,
        override_amount: override.override_amount,
        discount_amount: override.discount_amount,
        reason: override.reason,
        created_at: override.created_at,
        created_by: override.created_by,
        created_by_name: createdByName,
        updated_at: override.updated_at,
        updated_by: override.updated_by,
        updated_by_name: updatedByName,
      };
    });

    return NextResponse.json({
      success: true,
      overrides: formattedOverrides,
    });
  } catch (error) {
    console.error("Error in GET fee-overrides:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
