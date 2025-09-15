"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import ReceiptPrint, {
  ReceiptPrintData,
} from "@/components/receipts/ReceiptPrint";
import { useReactToPrint } from "react-to-print";
import { useAcademicStore } from "@/lib/stores/academic-store";
import { CheckCircle, Loader2 } from "lucide-react";
import type { StudentGridRow } from "@/lib/types/students";
import type { StudentFeesResponse } from "@/lib/types/student-api.types";
import { studentApiClient } from "@/lib/services/student-api.client";

type FeeComponent = {
  component_name: string;
  component_code: string;
  year_number?: number;
  amount: number; // Actual fee amount
  original_amount?: number; // Course fee amount
  paid_amount: number;
  outstanding_amount: number;
};

type PaymentForm = {
  receipt_number?: string; // Made optional
  receipt_date: string;
  academic_year?: string; // Made optional
  payment_method: string;
  remarks: string;
  componentPayments: Record<string, string>; // component_code -> payment amount
};

type ExistingReceiptData = {
  id: string;
  receipt_number: string;
  receipt_date: string;
  academic_year?: string;
  payment_method: string;
  remarks: string;
  paid_amount: number;
  components: Array<{
    component_code?: string;
    component_name?: string;
    allocated_amount?: number;
  }>;
};

export function CollectPaymentDialog({
  open,
  onOpenChange,
  student,
  editReceiptData,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentGridRow | null;
  editReceiptData?: ExistingReceiptData | null;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [loadingFees, setLoadingFees] = React.useState(false);
  const [feeComponents, setFeeComponents] = React.useState<FeeComponent[]>([]);
  const [feesError, setFeesError] = React.useState<string | null>(null);
  const [rebateAmount, setRebateAmount] = React.useState<string>("");
  const [rebateReason, setRebateReason] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [previewData, setPreviewData] = React.useState<ReceiptPrintData | null>(
    null
  );
  const academicStore = useAcademicStore();
  const [lastReceiptMeta, setLastReceiptMeta] = React.useState<{
    id: string;
    number: string;
  } | null>(null);
  const printRef = React.useRef<HTMLDivElement | null>(null);
  const handlePrint = useReactToPrint({
    documentTitle: lastReceiptMeta
      ? `receipt-${lastReceiptMeta.number}`
      : "receipt",
    contentRef: printRef,
  });

  const [form, setForm] = React.useState<PaymentForm>(() => {
    if (editReceiptData) {
      // Initialize with existing receipt data for editing
      const componentPayments: Record<string, string> = {};
      editReceiptData.components?.forEach((comp) => {
        // Use the same key format as getComponentKey function
        let key = "";
        if (comp.component_code === "PREV_BAL") {
          key = "PREV_BAL";
        } else if (comp.component_code) {
          // Extract year from component_name if available, default to 1
          const yearMatch = comp.component_name?.match(/Year (\d+)/i);
          const year = yearMatch ? parseInt(yearMatch[1]) : 1;
          key = `${comp.component_code}_${year}`;
        } else if (comp.component_name) {
          // Fallback to component name if no code
          key = comp.component_name;
        }

        if (key && comp.allocated_amount) {
          componentPayments[key] = comp.allocated_amount.toString();
        }
      });

      return {
        receipt_number: editReceiptData.receipt_number,
        receipt_date: editReceiptData.receipt_date,
        academic_year: editReceiptData.academic_year,
        payment_method: editReceiptData.payment_method,
        remarks: editReceiptData.remarks,
        componentPayments,
      };
    }

    // Default form for new receipt
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return {
      receipt_number: `RCP${yyyy}${mm}${dd}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`,
      receipt_date: `${yyyy}-${mm}-${dd}`,
      payment_method: "CASH",
      remarks: "",
      componentPayments: {},
    };
  });

  // Reset form when editReceiptData changes
  React.useEffect(() => {
    if (editReceiptData) {
      // Initialize with existing receipt data for editing
      const componentPayments: Record<string, string> = {};
      editReceiptData.components?.forEach((comp) => {
        // Use the same key format as getComponentKey function
        let key = "";
        if (comp.component_code === "PREV_BAL") {
          key = "PREV_BAL";
        } else if (comp.component_code) {
          // Extract year from component_name if available, default to 1
          const yearMatch = comp.component_name?.match(/Year (\d+)/i);
          const year = yearMatch ? parseInt(yearMatch[1]) : 1;
          key = `${comp.component_code}_${year}`;
        } else if (comp.component_name) {
          // Fallback to component name if no code
          key = comp.component_name;
        }

        if (key && comp.allocated_amount) {
          componentPayments[key] = comp.allocated_amount.toString();
        }
      });

      setForm({
        receipt_number: editReceiptData.receipt_number,
        receipt_date: editReceiptData.receipt_date,
        academic_year: editReceiptData.academic_year,
        payment_method: editReceiptData.payment_method,
        remarks: editReceiptData.remarks,
        componentPayments,
      });
    } else if (open) {
      // Reset to default form for new receipt
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setForm({
        receipt_number: `RCP${yyyy}${mm}${dd}${Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0")}`,
        receipt_date: `${yyyy}-${mm}-${dd}`,
        payment_method: "CASH",
        remarks: "",
        componentPayments: {},
      });
    }
  }, [editReceiptData, open]);

  // Load actual fee components from API
  React.useEffect(() => {
    if (open && student) {
      const loadFeeComponents = async () => {
        setLoadingFees(true);
        setFeesError(null);
        try {
          const feesData: StudentFeesResponse = await studentApiClient.getFees(
            student.student_id
          );

          const components: FeeComponent[] = [];

          if (feesData.fee_details) {
            const currentYear = student.current_year || 1;

            // Calculate Previous Balance from components of previous years with outstanding amounts
            const previousYearComponents = feesData.fee_details.filter(
              (component) =>
                component.year_number &&
                component.year_number < currentYear &&
                component.outstanding_amount > 0
            );

            const previousBalance = previousYearComponents.reduce(
              (sum, component) => sum + component.outstanding_amount,
              0
            );

            // Always add Previous Balance component (even if 0)
            const previousBalanceComponent: FeeComponent = {
              component_name: "Previous Balance",
              component_code: "PREV_BAL",
              year_number: undefined,
              amount: previousBalance,
              original_amount: previousBalance,
              paid_amount: 0,
              outstanding_amount: previousBalance,
            };
            components.push(previousBalanceComponent);

            // Filter components: current year + always show Security & Other charges
            const filteredComponents = feesData.fee_details.filter(
              (component) => {
                // Always show Security and Other charges regardless of year
                if (
                  component.component_code === "SECURITY" ||
                  component.component_code === "OTHER"
                ) {
                  return true;
                }
                // Show components for current year only
                return component.year_number === currentYear;
              }
            );

            // Add filtered current year components
            components.push(...filteredComponents);
          }

          setFeeComponents(components);
        } catch (error) {
          console.error("Failed to load fee components:", error);
          setFeesError(
            error instanceof Error ? error.message : "Failed to load fee data"
          );
          setFeeComponents([]);
        } finally {
          setLoadingFees(false);
        }
      };

      loadFeeComponents();
    }
  }, [open, student]);

  React.useEffect(() => {
    if (!open) {
      setForm((f) => ({
        ...f,
        receipt_number: "",
        remarks: "",
        componentPayments: {},
      }));
    }
  }, [open]);

  const formatCurrency = React.useMemo(() => {
    const fmt = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return (v: number) => fmt.format(v);
  }, []);

  const calculateBalance = (component: FeeComponent, paymentAmount: string) => {
    const payment = Number(paymentAmount) || 0;
    return Math.max(0, component.outstanding_amount - payment);
  };

  const getTotalPayment = () => {
    const paymentTotal = Object.values(form.componentPayments).reduce(
      (sum, amount) => {
        return sum + (Number(amount) || 0);
      },
      0
    );
    return paymentTotal; // Exclude rebate amount from total payment
  };

  const hasValidComponentPayment = () => {
    // Check if at least one component payment is greater than 0
    return Object.values(form.componentPayments).some(
      (amount) => (Number(amount) || 0) > 0
    );
  };

  const getComponentKey = (component: FeeComponent) => {
    // Special handling for Previous Balance (no year number)
    if (component.component_code === "PREV_BAL") {
      return "PREV_BAL";
    }
    return `${component.component_code}_${component.year_number || 1}`;
  };

  const submit = async () => {
    console.log("🚀 Submit function called");
    console.log("Student:", student);
    console.log("Session title:", student?.session_title);
    console.log("Form data:", form);
    console.log("Total payment:", getTotalPayment());
    console.log("Rebate amount:", rebateAmount);

    if (!student) {
      console.error("❌ No student selected");
      return;
    }

    // Prevent double submission
    if (isSubmitting || submitSuccess) {
      return;
    }

    const totalPayment = getTotalPayment();
    const rebateValue = parseFloat(rebateAmount) || 0;

    // Validate rebate reason if rebate amount is provided
    if (rebateValue > 0 && !rebateReason.trim()) {
      toast.error("Rebate reason is required when applying a rebate");
      return;
    }

    // Require at least one component payment to be greater than 0
    if (!hasValidComponentPayment()) {
      toast.error("At least one fee component payment is required");
      return;
    }

    if (!form.receipt_number?.trim()) {
      toast.error("Receipt number is required");
      return;
    }

    // Set submitting state and clear any previous errors
    setIsSubmitting(true);
    setLoading(true);
    setSubmitError(null);

    // Convert session_title to academic_year format (YYYY-YY)
    const convertToAcademicYear = (sessionTitle: string): string => {
      if (!sessionTitle) return "";

      // Handle formats like "2024-2025" -> "2024-25"
      const match = sessionTitle.match(/(\d{4})-?(\d{4})/);
      if (match) {
        const startYear = match[1];
        const endYear = match[2].slice(-2); // Get last 2 digits
        return `${startYear}-${endYear}`;
      }

      // Handle formats like "2024-25" (already correct)
      if (sessionTitle.match(/^\d{4}-\d{2}$/)) {
        return sessionTitle;
      }

      // Default fallback - current academic year
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    };

    const academicYear = convertToAcademicYear(student.session_title || "");
    console.log("📅 Academic year converted:", academicYear);
    console.log("💰 Component payments:", form.componentPayments);

    const requestBody = {
      student_id: student.student_id,
      enrollment_id: student.enrollment_id,
      receipt_number: form.receipt_number!,
      receipt_date: form.receipt_date,
      academic_year: academicYear,
      payment_method: form.payment_method,
      remarks: form.remarks,
      total_amount: totalPayment,
      component_payments: Object.fromEntries(
        Object.entries(form.componentPayments)
          .filter(([, value]) => (parseFloat(value) || 0) > 0)
          .map(([key, value]) => {
            // Extract component code from key (remove _YEAR suffix)
            const componentCode = key.includes("_") ? key.split("_")[0] : key;
            return [componentCode, parseFloat(value) || 0];
          })
      ),
      rebate_amount: rebateValue,
      rebate_reason: rebateReason.trim(),
      current_year: student.current_year || 1,
    };

    console.log("📦 Final request body:", requestBody);

    try {
      let responseData;

      if (editReceiptData) {
        // Update existing receipt using PATCH
        console.log("🔄 Updating existing receipt:", {
          receiptId: editReceiptData.id,
          studentId: student.student_id,
          receiptIdType: typeof editReceiptData.id,
          studentIdType: typeof student.student_id,
        });
        responseData = await studentApiClient.updatePaymentReceipt(
          student.student_id,
          editReceiptData.id,
          requestBody
        );
      } else {
        // Create new receipt using POST
        console.log("✨ Creating new receipt");
        responseData = await studentApiClient.processComplexPayment(
          student.student_id,
          requestBody
        );
      }

      // Mark as successfully submitted
      setSubmitSuccess(true);

      // Call success callback if provided
      onSuccess?.();

      // Show success message with receipt details
      toast.success(
        `Payment recorded successfully! Receipt #${responseData.receipt_number}`,
        {
          duration: 5000,
          description: `Amount: ₹${totalPayment.toFixed(2)} | Method: ${
            form.payment_method
          }`,
        }
      );

      // Show validation warnings if any
      if (responseData.validation?.warnings?.length > 0) {
        setTimeout(() => {
          responseData.validation.warnings.forEach((warning: string) => {
            toast.warning(warning, { duration: 4000 });
          });
        }, 1000);
      }

      // Fetch receipt detail & show preview (only for create, not edit)
      if (!editReceiptData && responseData.receipt_id && student) {
        try {
          const detail = await studentApiClient.getReceiptDetail(
            student.student_id,
            responseData.receipt_id
          );
          interface AllocationItem {
            component_name: string;
            allocated_amount: number;
          }
          // Ensure colleges are loaded (non-blocking)
          if (
            academicStore.colleges.length === 0 &&
            !academicStore.collegesLoading
          ) {
            academicStore.loadColleges();
          }
          const collegeInfo =
            (student.college_id &&
              academicStore.getCollegeById(student.college_id)) ||
            (student.college_code &&
              academicStore.getCollegeByCode(student.college_code || "")) ||
            undefined;

          const receiptPrint: ReceiptPrintData = {
            receipt_number: detail.receipt_number,
            receipt_date: detail.receipt_date,
            academic_year: detail.academic_year,
            payment_method: detail.payment_method,
            remarks: detail.remarks,
            details: (detail.allocations as AllocationItem[]).map((a) => ({
              name: a.component_name,
              paid: a.allocated_amount,
              balance: 0, // balance per component not needed in preview of payment portion
            })),
            logoUrl: "/alpine_logo.png",
            college: {
              name: collegeInfo?.name || student.college_name || "",
              code: collegeInfo?.code || student.college_code || undefined,
              address: collegeInfo?.address || undefined,
              phone: collegeInfo?.phone || undefined,
              email: collegeInfo?.email || undefined,
              website: collegeInfo?.website || undefined,
              affiliation: collegeInfo?.affiliation || undefined,
              approvedBy: collegeInfo?.approved_by || undefined,
            },
            student: {
              name: student.full_name,
              fatherName: student.father_name,
              motherName: student.mother_name,
              enrollmentCode: student.enrollment_code,
              courseName: student.course_name,
              sessionTitle: student.session_title || undefined,
              currentYear: student.current_year || undefined,
            },
          };
          setPreviewData(receiptPrint);
          setLastReceiptMeta({
            id: responseData.receipt_id,
            number: receiptPrint.receipt_number.toString(),
          });
        } catch (fetchErr) {
          console.error("Failed to fetch receipt detail for preview", fetchErr);
        }
      }

      // For edit keep old auto-close behaviour; for create keep dialog open so preview can show
      if (editReceiptData) {
        setTimeout(() => onOpenChange(false), 1500);
      }
    } catch (e) {
      console.error("💥 Payment submission error:", e);
      const errorMessage =
        e instanceof Error ? e.message : "Could not record payment";

      // Set error state for dialog display
      setSubmitError(errorMessage);
      console.error("❌ Error state set:", errorMessage);

      // Show detailed error in toast
      toast.error(errorMessage, {
        duration: 6000,
        description: "Please check the details and try again",
      });

      // Reset submitting state on error so user can retry
      setIsSubmitting(false);
    } finally {
      setLoading(false);
    }
  };

  // Get maximum rebate amount (tuition fee outstanding amount)
  const getMaxRebateAmount = () => {
    const tuitionComponent = feeComponents.find(
      (component) => component.component_code === "TUITION"
    );
    return tuitionComponent ? tuitionComponent.outstanding_amount : 0;
  };

  const handleRebateChange = (value: string) => {
    const rebateValue = parseFloat(value) || 0;
    const maxRebate = getMaxRebateAmount();

    if (rebateValue > maxRebate) {
      toast.error(
        `Rebate amount cannot exceed tuition fee balance (${formatCurrency(
          maxRebate
        )})`
      );
      return;
    }

    setRebateAmount(value);
  };
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            // Reset states when opening dialog
            setIsSubmitting(false);
            setSubmitSuccess(false);
            setSubmitError(null);
          } else {
            // Only allow closing via explicit close button or API call, not background click
            if (!loading && !isSubmitting) {
              onOpenChange(false);
            }
          }
        }}
      >
        <DialogContent
          className="!max-w-6xl  max-h-[90vh] overflow-hidden flex flex-col"
          onInteractOutside={(e) => e.preventDefault()} // Prevent closing on background click
          onEscapeKeyDown={(e) => e.preventDefault()} // Prevent closing on escape
        >
          <DialogHeader className="flex-shrink-0 border-b pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold flex items-center">
                {editReceiptData ? "Edit Receipt" : "Fee Payment"}
                {submitSuccess && (
                  <div className="ml-3 flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-1" />
                    <span className="text-sm font-medium">
                      {editReceiptData ? "Receipt Updated" : "Payment Recorded"}
                    </span>
                  </div>
                )}
              </DialogTitle>
            </div>
          </DialogHeader>

          {!submitSuccess && (
            <div className="flex-1 overflow-auto space-y-6 py-4">
              {/* Student Details Section */}
              {student && (
                <div className="mb-6 p-6 bg-white border rounded-lg shadow">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <span className="block text-xs text-gray-500">Name</span>
                      <span className="block font-semibold text-gray-800">
                        {student.full_name}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500">
                        Enrollment
                      </span>
                      <span className="block font-semibold text-gray-800">
                        {student.enrollment_code}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500">
                        Course
                      </span>
                      <span className="block font-semibold text-gray-800">
                        {student.course_name}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500">
                        Session/Year
                      </span>
                      <span className="block font-semibold text-gray-800">
                        {student.session_title || "-"} / {student.current_year}
                      </span>
                    </div>
                    {/* additional fields if needed */}
                  </div>
                </div>
              )}

              {/* Error Display */}
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-red-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Payment Failed
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{submitError}</p>
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          className="text-sm text-red-800 underline hover:text-red-900"
                          onClick={() => setSubmitError(null)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fee Components Table */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Fee Components</h3>
                {loadingFees ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading fee components...</span>
                  </div>
                ) : feesError ? (
                  <div className="text-center py-8">
                    <p className="text-red-600 mb-2">{feesError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (student) {
                          // Retry loading
                          const loadFeeComponents = async () => {
                            setLoadingFees(true);
                            setFeesError(null);
                            try {
                              const feesData: StudentFeesResponse =
                                await studentApiClient.getFees(
                                  student.student_id
                                );
                              if (feesData.fee_details) {
                                setFeeComponents(feesData.fee_details);
                              } else {
                                setFeeComponents([]);
                              }
                            } catch (error) {
                              console.error(
                                "Failed to load fee components:",
                                error
                              );
                              setFeesError(
                                error instanceof Error
                                  ? error.message
                                  : "Failed to load fee data"
                              );
                              setFeeComponents([]);
                            } finally {
                              setLoadingFees(false);
                            }
                          };
                          loadFeeComponents();
                        }
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[300px]">
                            Fee Component
                          </TableHead>
                          <TableHead className="w-[120px] text-right">
                            Actual Fee
                          </TableHead>
                          <TableHead className="w-[120px] text-right">
                            Amount Paid
                          </TableHead>
                          <TableHead className="w-[140px] text-right">
                            Payment Amount
                          </TableHead>
                          <TableHead className="w-[120px] text-right">
                            Balance Left
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feeComponents.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center py-8 text-muted-foreground"
                            >
                              No fee components found for this student.
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {feeComponents.map((component) => {
                              const componentKey = getComponentKey(component);
                              const paymentAmount =
                                form.componentPayments[componentKey] || "";
                              const rebateValue = parseFloat(rebateAmount) || 0;

                              // Adjust balance for tuition fee when rebate is applied
                              let adjustedOutstanding =
                                component.outstanding_amount;
                              if (
                                component.component_code === "TUITION" &&
                                rebateValue > 0
                              ) {
                                adjustedOutstanding = Math.max(
                                  0,
                                  component.outstanding_amount - rebateValue
                                );
                              }

                              const balance = calculateBalance(
                                {
                                  ...component,
                                  outstanding_amount: adjustedOutstanding,
                                },
                                paymentAmount
                              );

                              return (
                                <TableRow key={componentKey}>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <div className="font-medium text-sm">
                                        {component.component_name}
                                        {component.component_code ===
                                          "PREV_BAL" && (
                                          <span className="text-xs text-orange-600 ml-2">
                                            (Carried Forward)
                                          </span>
                                        )}
                                        {component.component_code ===
                                          "TUITION" &&
                                          rebateValue > 0 && (
                                            <span className="text-xs text-blue-600 ml-2">
                                              (Rebate Applied: -
                                              {formatCurrency(rebateValue)})
                                            </span>
                                          )}
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Badge
                                          variant={
                                            component.component_code ===
                                            "PREV_BAL"
                                              ? "secondary"
                                              : "outline"
                                          }
                                          className={`text-xs ${
                                            component.component_code ===
                                            "PREV_BAL"
                                              ? "bg-orange-100 text-orange-700 border-orange-200"
                                              : ""
                                          }`}
                                        >
                                          {component.component_code}
                                        </Badge>
                                        {component.year_number && (
                                          <span>
                                            Year {component.year_number}
                                          </span>
                                        )}
                                        {component.component_code ===
                                          "PREV_BAL" && (
                                          <span className="text-orange-600">
                                            Previous Years
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {formatCurrency(component.amount)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm text-green-600">
                                    {formatCurrency(component.paid_amount)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      placeholder="0"
                                      className="w-full h-8 text-right font-mono text-sm"
                                      value={paymentAmount}
                                      onChange={(e) => {
                                        let value =
                                          parseFloat(e.target.value) || 0;
                                        // Clamp between 0 and adjustedOutstanding
                                        if (value < 0) value = 0;
                                        if (value > adjustedOutstanding)
                                          value = adjustedOutstanding;
                                        setForm((f) => ({
                                          ...f,
                                          componentPayments: {
                                            ...f.componentPayments,
                                            [componentKey]: value.toString(),
                                          },
                                        }));
                                      }}
                                      max={adjustedOutstanding}
                                      min="0"
                                      step="0.01"
                                      disabled={adjustedOutstanding === 0}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    <span
                                      className={
                                        balance > 0
                                          ? "text-red-600"
                                          : "text-green-600 font-semibold"
                                      }
                                    >
                                      {formatCurrency(balance)}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {/* Rebate Row */}
                            <TableRow className="bg-blue-50 border-blue-200">
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium text-sm text-blue-700">
                                    Rebate/Discount
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-blue-600">
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-blue-100 text-blue-700 border-blue-200"
                                    >
                                      DISCOUNT
                                    </Badge>
                                    <span>Current Year Tuition</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-blue-700">
                                {/* Empty - no actual fee amount for rebate */}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-green-600">
                                {/* Empty - no amount paid for rebate */}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  className="w-full h-8 text-right font-mono text-sm border-blue-200 focus:border-blue-400"
                                  value={rebateAmount}
                                  onChange={(e) =>
                                    handleRebateChange(e.target.value)
                                  }
                                  min="0"
                                  max={getMaxRebateAmount()}
                                  step="0.01"
                                />
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-green-600 font-semibold">
                                {/* Empty - no balance left for rebate */}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="receipt-date" className="text-xs">
                        Receipt Date
                      </Label>
                      <Input
                        id="receipt-date"
                        type="date"
                        className="h-8 text-sm"
                        value={form.receipt_date}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            receipt_date: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="receipt-number" className="text-xs">
                        Receipt Number
                      </Label>
                      <Input
                        id="receipt-number"
                        type="text"
                        className="h-8 text-sm font-mono"
                        value={form.receipt_number}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            receipt_number: e.target.value,
                          }))
                        }
                        placeholder="RCP20250912001"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="payment-method" className="text-xs">
                      Payment Method
                    </Label>
                    <Select
                      value={form.payment_method}
                      onValueChange={(value) =>
                        setForm((f) => ({ ...f, payment_method: value }))
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                        <SelectItem value="BANK_TRANSFER">
                          Bank Transfer
                        </SelectItem>
                        <SelectItem value="BANK">Bank</SelectItem>
                        <SelectItem value="ONLINE">Online</SelectItem>
                        <SelectItem value="DEMAND_DRAFT">
                          Demand Draft
                        </SelectItem>
                        <SelectItem value="DD">DD</SelectItem>
                        <SelectItem value="CARD">Card</SelectItem>
                        <SelectItem value="SWIPE">Swipe</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="WALLET">Wallet</SelectItem>
                        <SelectItem value="QR_PHONEPE">QR PhonePe</SelectItem>
                        <SelectItem value="QR_HDFC">QR HDFC</SelectItem>
                        <SelectItem value="QR_PAYTM">QR Paytm</SelectItem>
                        <SelectItem value="QR_GPAY">QR GPay</SelectItem>
                        <SelectItem value="QR_OTHER">QR Other</SelectItem>
                        <SelectItem value="QR">QR</SelectItem>
                        <SelectItem value="PHONEPE">PhonePe</SelectItem>
                        <SelectItem value="PAYTM">Paytm</SelectItem>
                        <SelectItem value="GPAY">GPay</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="remarks" className="text-xs">
                      Remarks (Optional)
                    </Label>
                    <textarea
                      id="remarks"
                      className="w-full h-20 px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Additional notes..."
                      value={form.remarks}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, remarks: e.target.value }))
                      }
                    />
                  </div>
                  {parseFloat(rebateAmount) > 0 && (
                    <div>
                      <Label htmlFor="rebate-reason" className="text-xs">
                        Rebate Reason <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="rebate-reason"
                        placeholder="e.g. Merit scholarship, Early payment discount..."
                        className="h-8 text-sm"
                        value={rebateReason}
                        onChange={(e) => setRebateReason(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Total Payment Amount:
                  </div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(getTotalPayment())}
                  </div>
                </div>
              </div>
            </div>
          )}
          {submitSuccess && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center gap-6">
              <div className="space-y-2">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                <h2 className="text-xl font-semibold text-green-700">
                  Payment Recorded Successfully
                </h2>
                {lastReceiptMeta && (
                  <p className="text-sm text-muted-foreground">
                    Receipt #:{" "}
                    <span className="font-mono font-medium">
                      {lastReceiptMeta.number}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                {previewData && (
                  <Button variant="outline" onClick={handlePrint}>
                    Print Receipt
                  </Button>
                )}
                <Button onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!submitSuccess && (
            <div className="flex-shrink-0 flex justify-end gap-3 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || isSubmitting}
              >
                {submitSuccess ? "Close" : "Cancel"}
              </Button>
              <Button
                onClick={() => {
                  submit();
                }}
                disabled={
                  loading ||
                  isSubmitting ||
                  submitSuccess ||
                  !hasValidComponentPayment() // Require at least one component payment > 0
                }
                className={
                  submitSuccess ? "bg-green-600 hover:bg-green-700" : ""
                }
              >
                {submitSuccess ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : loading || isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {loading || isSubmitting
                  ? "Processing..."
                  : submitSuccess
                  ? "Payment Recorded ✓"
                  : `Record Payment (${formatCurrency(getTotalPayment())})`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Hidden print container for react-to-print */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          overflow: "hidden",
          zIndex: -1,
        }}
        aria-hidden
      >
        {previewData && (
          <div ref={printRef} className="print-receipt-wrapper">
            <ReceiptPrint data={previewData as ReceiptPrintData} />
          </div>
        )}
      </div>
    </>
  );
}
