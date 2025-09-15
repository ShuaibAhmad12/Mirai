"use client";

import * as React from "react";
import { useAcademicData } from "@/lib/stores/academic-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { listFeePlansByCourse, listFeePlanItems } from "@/lib/api/academic";
import { listAgents, type AgentBasic } from "@/lib/api/agents";
import { User, BookUser, Handshake } from "lucide-react";

export const dynamic = "force-dynamic";

type IssuePayload = {
  applicant_name: string;
  college_id: string;
  course_id: string;
  session_id: string;
  agent_id?: string | null;
  entry_type?: "regular" | "lateral";
  joining_date?: string | null;
};

export default function NewAdmissionPage() {
  const router = useRouter();
  const { colleges, courses, sessions, loading } = useAcademicData();

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [payload, setPayload] = React.useState<IssuePayload>({
    applicant_name: "",
    college_id: "",
    course_id: "",
    session_id: "",
    agent_id: null,
    entry_type: "regular",
    joining_date: new Date().toISOString().slice(0, 10),
  });
  const [previewCode, setPreviewCode] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [agents, setAgents] = React.useState<AgentBasic[]>([]);
  const [feePlans, setFeePlans] = React.useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedFeePlan, setSelectedFeePlan] = React.useState<string>("");
  const [feeStructure, setFeeStructure] = React.useState<
    Array<{
      id: string;
      component_name: string;
      component_code: string;
      year_number: number;
      course_fee: number;
      discount: number;
      actual_fee: number;
      is_placeholder?: boolean;
      is_lateral_entry_locked?: boolean;
    }>
  >([]);
  const [agentPaidChoice, setAgentPaidChoice] = React.useState<
    "na" | "yes" | "no"
  >("na");
  const [agentRemark, setAgentRemark] = React.useState("");

  const selectedCollegeCourses = React.useMemo(
    () => courses.filter((c) => c.college_id === payload.college_id),
    [courses, payload.college_id]
  );

  // Load agents for selector
  React.useEffect(() => {
    (async () => {
      try {
        const data = await listAgents();
        setAgents(data);
      } catch {
        setAgents([]);
      }
    })();
  }, []);

  // Load fee structure when course/session changes
  React.useEffect(() => {
    (async () => {
      if (!payload.course_id) {
        setFeePlans([]);
        setSelectedFeePlan("");
        setFeeStructure([]);
        return;
      }
      try {
        const plans = await listFeePlansByCourse(
          payload.course_id,
          payload.session_id || undefined
        );
        setFeePlans(plans.map((p) => ({ id: p.id, name: p.name })));

        // Auto-select first plan and load its structure
        if (plans.length > 0) {
          const firstPlan = plans[0];
          setSelectedFeePlan(firstPlan.id);

          const items = await listFeePlanItems(firstPlan.id);

          // Convert to fee structure format
          const structure = items.map((item) => {
            const component = item.fee_components;
            const componentName =
              component?.label || component?.code || "Unknown Component";
            const componentCode = component?.code || "UNKNOWN";
            const isPlaceholder = item.id.toString().startsWith("placeholder-");
            const yearNumber = item.year_number || 1;

            // For lateral entry, year 1 fees should be zero and non-adjustable
            const isLateralEntry = payload.entry_type === "lateral";
            const isYear1 = yearNumber === 1;
            const shouldZeroOut = isLateralEntry && isYear1;

            return {
              id: item.id,
              component_name: componentName,
              component_code: componentCode,
              year_number: yearNumber,
              course_fee: shouldZeroOut ? 0 : Number(item.amount) || 0,
              discount: 0, // Default discount
              actual_fee: shouldZeroOut ? 0 : Number(item.amount) || 0, // Initially same as course fee
              is_placeholder: isPlaceholder, // Track if this is a placeholder
              is_lateral_entry_locked: shouldZeroOut, // Track if this is locked due to lateral entry
            };
          });

          // Sort fees with primary fees first, then additional fees
          const sortedStructure = structure.sort((a, b) => {
            const aPrimary =
              a.component_code === "TUITION" ||
              a.component_code === "ADMISSION";
            const bPrimary =
              b.component_code === "TUITION" ||
              b.component_code === "ADMISSION";

            if (aPrimary && !bPrimary) return -1;
            if (!aPrimary && bPrimary) return 1;

            // Within same group, sort by component code
            return a.component_code.localeCompare(b.component_code);
          });

          console.log("Final fee structure:", sortedStructure);
          setFeeStructure(sortedStructure);
        } else {
          setSelectedFeePlan("");
          setFeeStructure([]);
        }
      } catch {
        setFeePlans([]);
        setSelectedFeePlan("");
        setFeeStructure([]);
      }
    })();
  }, [payload.course_id, payload.session_id, payload.entry_type]);

  // Update fee structure when entry type changes (for existing fee structure)
  React.useEffect(() => {
    if (feeStructure.length === 0) return; // No fee structure loaded yet

    const isLateralEntry = payload.entry_type === "lateral";

    // Update existing fee structure based on entry type
    const updatedStructure = feeStructure.map((fee) => {
      const isYear1 = fee.year_number === 1;
      const shouldZeroOut = isLateralEntry && isYear1;

      return {
        ...fee,
        course_fee: shouldZeroOut
          ? 0
          : fee.course_fee === 0
          ? fee.course_fee
          : Math.max(0, fee.course_fee),
        actual_fee: shouldZeroOut
          ? 0
          : fee.actual_fee === 0
          ? fee.actual_fee
          : Math.max(0, fee.actual_fee),
        is_lateral_entry_locked: shouldZeroOut,
      };
    });

    setFeeStructure(updatedStructure);
  }, [payload.entry_type]); // Only trigger when entry_type changes

  async function handlePreview() {
    setError(null);
    setPreviewCode(null);
    if (!payload.college_id || !payload.session_id) return;
    try {
      const res = await fetch("/api/admissions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          college_id: payload.college_id,
          session_id: payload.session_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to preview");
      setPreviewCode(data.enrollment_code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    }
  }

  async function handleIssue() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admissions/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          agent_id: payload.agent_id ?? null,
          agent_paid_choice: agentPaidChoice,
          agent_paid_remark: agentPaidChoice === "yes" ? agentRemark : "",
          fee_structure: feeStructure, // Include fee structure with discounts
          selected_fee_plan_id: selectedFeePlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to issue");
      // Navigate to student profile or students page
      router.push(`/students/${data.student_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Issue failed");
    } finally {
      setBusy(false);
    }
  }

  const canContinueStep1 =
    payload.applicant_name.trim().length > 1 &&
    payload.college_id &&
    payload.course_id &&
    payload.session_id &&
    payload.joining_date &&
    (payload.agent_id ?? "") !== "none" &&
    (agentPaidChoice !== "yes" || agentRemark.trim().length > 0);

  const canContinueStep2 = Boolean(selectedFeePlan && feeStructure.length > 0);

  React.useEffect(() => {
    if (payload.college_id && payload.session_id) {
      handlePreview();
    } else {
      setPreviewCode(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.college_id, payload.session_id]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            New Admission
          </h1>
        </div>

        <Card className="border-none shadow-lg bg-card rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-xl font-semibold text-slate-700 dark:text-slate-300">
              Admission Wizard
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-8">
              <Tabs value={String(step)} className="w-full">
                <TabsList className="grid grid-cols-3 w-full bg-muted/50 rounded-lg p-1">
                  <TabsTrigger
                    value="1"
                    className="text-sm font-medium rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    1. Applicant & Program
                  </TabsTrigger>
                  <TabsTrigger
                    value="2"
                    disabled={!canContinueStep1}
                    className="text-sm font-medium rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    2. Fee Plan
                  </TabsTrigger>
                  <TabsTrigger
                    value="3"
                    disabled={!canContinueStep1 || !canContinueStep2}
                    className="text-sm font-medium rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    3. Preview & Confirm
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {step === 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Applicant Details */}
                  <Card className="bg-slate-50/50 dark:bg-slate-900/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-slate-700 dark:text-slate-300">
                        <User className="w-5 h-5" />
                        Applicant Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2 md:col-span-1">
                          <Label>Full Name</Label>
                          <Input
                            value={payload.applicant_name}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                applicant_name: e.target.value,
                              }))
                            }
                            placeholder="Enter applicant's full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Entry Type</Label>
                          <Select
                            value={payload.entry_type}
                            onValueChange={(v) =>
                              setPayload((p) => ({
                                ...p,
                                entry_type: v as IssuePayload["entry_type"],
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select entry type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="regular">Regular</SelectItem>
                              <SelectItem value="lateral">Lateral</SelectItem>
                            </SelectContent>
                          </Select>
                          {payload.entry_type === "lateral" && (
                            <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-md">
                              <p className="text-sm text-purple-700">
                                <strong>Lateral Entry:</strong> Student enters
                                directly into year 2. All year 1 fees will be
                                set to zero and cannot be adjusted.
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>DOJ</Label>
                          <Input
                            type="date"
                            value={payload.joining_date ?? ""}
                            onChange={(e) =>
                              setPayload((p) => ({
                                ...p,
                                joining_date: e.target.value || null,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Program Selection */}
                  <Card className="bg-slate-50/50 dark:bg-slate-900/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-slate-700 dark:text-slate-300">
                        <BookUser className="w-5 h-5" />
                        Program Selection
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label>College</Label>
                          <Select
                            value={payload.college_id}
                            onValueChange={(v) =>
                              setPayload((p) => ({
                                ...p,
                                college_id: v,
                                course_id: "",
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  loading ? "Loading..." : "Select college"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {colleges.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Course</Label>
                          <Select
                            value={payload.course_id}
                            onValueChange={(v) =>
                              setPayload((p) => ({ ...p, course_id: v }))
                            }
                            disabled={!payload.college_id}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  payload.college_id
                                    ? "Select course"
                                    : "Select college first"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedCollegeCourses.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Session</Label>
                          <Select
                            value={payload.session_id}
                            onValueChange={(v) =>
                              setPayload((p) => ({ ...p, session_id: v }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  loading ? "Loading..." : "Select session"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {sessions.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                  {/* Agent & Payment */}
                  <Card className="bg-slate-50/50 dark:bg-slate-900/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-slate-700 dark:text-slate-300">
                        <Handshake className="w-5 h-5" />
                        Agent Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="grid grid-cols-1">
                          <div className="space-y-2">
                            <Label>Agent</Label>
                            <Select
                              value={payload.agent_id ?? ""}
                              onValueChange={(v) =>
                                setPayload((p) => ({ ...p, agent_id: v }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select agent" />
                              </SelectTrigger>
                              <SelectContent>
                                {agents.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {payload.agent_id && (
                          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700 mt-6">
                            <div className="space-y-2">
                              <Label>Agent Paid?</Label>
                              <Select
                                value={agentPaidChoice}
                                onValueChange={(v: "na" | "yes" | "no") =>
                                  setAgentPaidChoice(v)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="na">N/A</SelectItem>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {agentPaidChoice === "yes" && (
                              <div className="space-y-2">
                                <Label>Payment Remark</Label>
                                <Textarea
                                  value={agentRemark}
                                  onChange={(e) =>
                                    setAgentRemark(e.target.value)
                                  }
                                  placeholder="Enter payment details or remarks"
                                  rows={3}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Enrollment Code Preview */}
                  {payload.college_id && payload.session_id && (
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                      <CardHeader>
                        <CardTitle className="text-lg text-blue-700 dark:text-blue-300">
                          Enrollment Code Preview
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center space-y-2">
                          <div className="text-sm text-blue-600 dark:text-blue-400">
                            Generated Code
                          </div>
                          <div
                            className={cn(
                              "font-mono text-xl font-bold p-3 rounded-lg bg-white dark:bg-slate-900 border",
                              previewCode
                                ? "text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                                : "text-muted-foreground border-slate-200 dark:border-slate-700"
                            )}
                          >
                            {previewCode ?? "Loading..."}
                          </div>
                          {previewCode && (
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              This will be the student&apos;s enrollment number
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Action Button */}
                <div className="lg:col-span-3 flex items-center justify-end gap-2 mt-8">
                  <Button
                    size="lg"
                    onClick={() => setStep(2)}
                    disabled={!canContinueStep1}
                  >
                    Continue to Fee Plan
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                        Fee Structure
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Adjust fees: Discounts reduce Tuition/Admission fees,
                        while adjustments add to Security/Other fees.
                      </p>
                    </div>
                    {selectedFeePlan && (
                      <div className="text-sm text-muted-foreground">
                        Plan:{" "}
                        {feePlans.find((p) => p.id === selectedFeePlan)?.name}
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted/30 text-xs uppercase text-muted-foreground">
                          <th className="px-4 py-3 text-left font-semibold">
                            Component
                          </th>
                          <th className="px-4 py-3 text-right font-semibold">
                            Course Fee
                          </th>
                          <th className="px-4 py-3 text-right font-semibold">
                            Adjustment
                          </th>
                          <th className="px-4 py-3 text-right font-semibold">
                            Actual Fee
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeStructure.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-8 text-center text-muted-foreground"
                            >
                              {payload.course_id
                                ? "Loading fee structure..."
                                : "Please select a course first"}
                            </td>
                          </tr>
                        ) : (
                          (() => {
                            const primaryFees = feeStructure.filter(
                              (fee) =>
                                fee.component_code === "TUITION" ||
                                fee.component_code === "ADMISSION"
                            );
                            const additionalFees = feeStructure.filter(
                              (fee) =>
                                fee.component_code === "SECURITY" ||
                                fee.component_code === "OTHER"
                            );

                            const renderFeeRow = (
                              fee: (typeof feeStructure)[0],
                              index: number,
                              section: string
                            ) => (
                              <tr
                                key={fee.id}
                                className={cn(
                                  "border-t hover:bg-muted/20",
                                  fee.course_fee === 0 &&
                                    "bg-slate-50/50 dark:bg-slate-800/50",
                                  section === "additional" &&
                                    "bg-blue-50/30 dark:bg-blue-950/20"
                                )}
                              >
                                <td className="px-4 py-3">
                                  <div className="space-y-1">
                                    <div
                                      className={cn(
                                        "font-medium text-sm",
                                        fee.course_fee === 0 &&
                                          "text-muted-foreground"
                                      )}
                                    >
                                      {fee.component_name}
                                      {fee.course_fee === 0 && (
                                        <span className="ml-2 text-xs text-orange-500">
                                          (Not included in plan)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span className="px-2 py-1 bg-muted rounded text-xs">
                                        {fee.component_code}
                                      </span>
                                      {fee.is_lateral_entry_locked && (
                                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                          Year 1 - Lateral Entry
                                        </span>
                                      )}
                                      {(fee.component_code === "SECURITY" ||
                                        fee.component_code === "OTHER") && (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                          +Add
                                        </span>
                                      )}
                                      {(fee.component_code === "TUITION" ||
                                        fee.component_code === "ADMISSION") && (
                                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                          -Discount
                                        </span>
                                      )}
                                      {fee.year_number && (
                                        <span>Year {fee.year_number}</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-sm">
                                  ₹{fee.course_fee.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex justify-end">
                                    <Input
                                      type="number"
                                      value={fee.discount}
                                      disabled={fee.is_lateral_entry_locked}
                                      onChange={(e) => {
                                        const adjustment = Math.max(
                                          0,
                                          Number(e.target.value) || 0
                                        );
                                        const newStructure = [...feeStructure];
                                        const originalIndex =
                                          feeStructure.findIndex(
                                            (f) => f.id === fee.id
                                          );

                                        // Special logic for SECURITY and OTHER fees
                                        const isAdditionalFee =
                                          fee.component_code === "SECURITY" ||
                                          fee.component_code === "OTHER";
                                        const actualFee = isAdditionalFee
                                          ? fee.course_fee + adjustment // Addition for SECURITY/OTHER
                                          : Math.max(
                                              0,
                                              fee.course_fee - adjustment
                                            ); // Subtraction for TUITION/ADMISSION

                                        newStructure[originalIndex] = {
                                          ...fee,
                                          discount: adjustment,
                                          actual_fee: actualFee,
                                        };
                                        setFeeStructure(newStructure);
                                      }}
                                      className={cn(
                                        "w-24 text-right font-mono text-sm",
                                        fee.is_lateral_entry_locked &&
                                          "bg-gray-100 text-gray-500"
                                      )}
                                      min="0"
                                      placeholder={
                                        fee.component_code === "SECURITY" ||
                                        fee.component_code === "OTHER"
                                          ? "Add amount"
                                          : "Discount"
                                      }
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                                  ₹{fee.actual_fee.toLocaleString()}
                                </td>
                              </tr>
                            );

                            return (
                              <>
                                {/* Primary Fees Section */}
                                {primaryFees.map((fee, index) =>
                                  renderFeeRow(fee, index, "primary")
                                )}

                                {/* Separator Row */}
                                {primaryFees.length > 0 &&
                                  additionalFees.length > 0 && (
                                    <tr className="bg-slate-100 dark:bg-slate-800">
                                      <td
                                        colSpan={4}
                                        className="px-4 py-2 text-center"
                                      >
                                        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                                          <div className="h-px bg-border flex-1"></div>
                                          <span className="font-medium uppercase tracking-wide">
                                            Additional Fees
                                          </span>
                                          <div className="h-px bg-border flex-1"></div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}

                                {/* Additional Fees Section */}
                                {additionalFees.map((fee, index) =>
                                  renderFeeRow(fee, index, "additional")
                                )}
                              </>
                            );
                          })()
                        )}
                      </tbody>
                      {feeStructure.length > 0 && (
                        <tfoot>
                          <tr className="bg-muted/50 font-semibold border-t-2">
                            <td className="px-4 py-3 text-sm font-bold">
                              TOTAL
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              ₹
                              {feeStructure
                                .reduce((sum, fee) => sum + fee.course_fee, 0)
                                .toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              {(() => {
                                const discountTotal = feeStructure
                                  .filter(
                                    (fee) =>
                                      fee.component_code !== "SECURITY" &&
                                      fee.component_code !== "OTHER"
                                  )
                                  .reduce((sum, fee) => sum + fee.discount, 0);
                                const additionTotal = feeStructure
                                  .filter(
                                    (fee) =>
                                      fee.component_code === "SECURITY" ||
                                      fee.component_code === "OTHER"
                                  )
                                  .reduce((sum, fee) => sum + fee.discount, 0);

                                if (discountTotal > 0 && additionTotal > 0) {
                                  return `+₹${additionTotal.toLocaleString()} / -₹${discountTotal.toLocaleString()}`;
                                } else if (additionTotal > 0) {
                                  return `+₹${additionTotal.toLocaleString()}`;
                                } else if (discountTotal > 0) {
                                  return `-₹${discountTotal.toLocaleString()}`;
                                }
                                return "₹0";
                              })()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm font-bold">
                              ₹
                              {feeStructure
                                .reduce((sum, fee) => sum + fee.actual_fee, 0)
                                .toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!canContinueStep2}
                  >
                    Continue to Preview
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="rounded-md border p-4 bg-muted/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Applicant</div>
                      <div className="font-medium">
                        {payload.applicant_name}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        College / Course
                      </div>
                      <div className="font-medium">
                        {colleges.find((c) => c.id === payload.college_id)
                          ?.name || "-"}
                        {" • "}
                        {selectedCollegeCourses.find(
                          (c) => c.id === payload.course_id
                        )?.name || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Session</div>
                      <div className="font-medium">
                        {sessions.find((s) => s.id === payload.session_id)
                          ?.title || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Agent</div>
                      <div className="font-medium">
                        {agents.find((a) => a.id === payload.agent_id)?.name ||
                          "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Entry Type</div>
                      <div className="font-medium">
                        {payload.entry_type === "lateral" ? (
                          <span className="text-purple-700 font-semibold">
                            Lateral Entry (Year 2)
                          </span>
                        ) : (
                          "Regular Entry"
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lateral Entry Info */}
                {payload.entry_type === "lateral" && (
                  <div className="rounded-md border p-4 bg-purple-50/50 dark:bg-purple-950/20">
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">
                      Lateral Entry Impact
                    </h4>
                    <div className="text-sm text-purple-600 dark:text-purple-400">
                      <p>• Student enters directly into Year 2</p>
                      <p>• All Year 1 fees have been set to ₹0</p>
                      <p>
                        • Year 1 fees are non-adjustable and will not be charged
                      </p>
                      <p>
                        • Only Year 2+ fees will be applicable for this student
                      </p>
                    </div>
                  </div>
                )}

                {/* Fee Summary */}
                {feeStructure.length > 0 && (
                  <div className="rounded-md border p-4 bg-blue-50/50 dark:bg-blue-950/20">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-3">
                      Fee Summary
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">
                          Total Course Fee
                        </div>
                        <div className="font-mono font-bold text-lg">
                          ₹
                          {feeStructure
                            .reduce((sum, fee) => sum + fee.course_fee, 0)
                            .toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          Net Adjustments
                        </div>
                        <div className="font-mono font-bold text-lg">
                          {(() => {
                            const discountTotal = feeStructure
                              .filter(
                                (fee) =>
                                  fee.component_code !== "SECURITY" &&
                                  fee.component_code !== "OTHER"
                              )
                              .reduce((sum, fee) => sum + fee.discount, 0);
                            const additionTotal = feeStructure
                              .filter(
                                (fee) =>
                                  fee.component_code === "SECURITY" ||
                                  fee.component_code === "OTHER"
                              )
                              .reduce((sum, fee) => sum + fee.discount, 0);

                            if (discountTotal > 0 && additionTotal > 0) {
                              return (
                                <div className="space-y-1">
                                  <div className="text-orange-600">
                                    +₹{additionTotal.toLocaleString()}
                                  </div>
                                  <div className="text-green-600">
                                    -₹{discountTotal.toLocaleString()}
                                  </div>
                                </div>
                              );
                            } else if (additionTotal > 0) {
                              return (
                                <div className="text-orange-600">
                                  +₹{additionTotal.toLocaleString()}
                                </div>
                              );
                            } else if (discountTotal > 0) {
                              return (
                                <div className="text-green-600">
                                  -₹{discountTotal.toLocaleString()}
                                </div>
                              );
                            }
                            return <div className="text-slate-500">₹0</div>;
                          })()}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Actual Fee</div>
                        <div className="font-mono font-bold text-lg text-blue-600">
                          ₹
                          {feeStructure
                            .reduce((sum, fee) => sum + fee.actual_fee, 0)
                            .toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="text-muted-foreground">
                      Enrollment Code (preview)
                    </div>
                    <div
                      className={cn(
                        "font-mono text-base",
                        previewCode
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {previewCode ?? "Select college & session to preview"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button
                      onClick={handleIssue}
                      disabled={busy || !canContinueStep1 || !canContinueStep2}
                    >
                      {busy ? "Issuing…" : "Issue Admission"}
                    </Button>
                  </div>
                </div>
                {error && <div className="text-sm text-red-500">{error}</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
