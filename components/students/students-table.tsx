"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Eye,
  Edit,
  CreditCard,
  Receipt,
  Phone,
  Mail,
  FileText,
  UserX,
  GraduationCap,
} from "lucide-react";

type Row = Record<string, unknown>;

type Column = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  widthClass?: string;
};

const ALL_COLUMNS: Column[] = [
  { key: "student_col", label: "Student", widthClass: "min-w-[220px]" },
  { key: "parent_col", label: "Parent", widthClass: "min-w-[200px]" },
  { key: "program_col", label: "Program", widthClass: "min-w-[240px]" },
  {
    key: "balances_col",
    label: "Balances",
    align: "right",
    widthClass: "min-w-[220px]",
  },
  {
    key: "actions_col",
    label: "Actions",
    align: "center",
    widthClass: "min-w-[140px]",
  },
];

export function StudentsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const columns = ALL_COLUMNS;

  // Helpers
  const formatCurrency = React.useMemo(() => {
    const fmt = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return (v: unknown) => {
      const n = typeof v === "number" ? v : Number(v ?? 0);
      return isFinite(n) ? fmt.format(n) : "-";
    };
  }, []);

  const totals = React.useMemo(() => {
    let prev = 0,
      due = 0;
    for (const r of rows) {
      const pv = r["previous_balance"];
      const dv = r["current_due"];
      const p = typeof pv === "number" ? pv : Number(pv ?? 0);
      const d = typeof dv === "number" ? dv : Number(dv ?? 0);
      if (isFinite(p)) prev += p;
      if (isFinite(d)) due += d;
    }
    return { prev, due, total: prev + due };
  }, [rows]);

  // Generic renderer for any simple field (fallback)
  const renderCell = (key: string, value: unknown) => {
    if (key === "enrollment_code") {
      return <span className="font-mono text-xs">{String(value ?? "-")}</span>;
    }
    if (
      key === "previous_balance" ||
      key === "current_due" ||
      key === "total_outstanding"
    ) {
      const n = typeof value === "number" ? value : Number(value ?? 0);
      const tone =
        n < 0
          ? "text-emerald-600"
          : n > 0
          ? "text-red-600"
          : "text-muted-foreground";
      return <span className={tone}>{formatCurrency(n)}</span>;
    }
    if (key === "current_year" || key === "course_duration") {
      const n = typeof value === "number" ? value : Number(value ?? 0);
      return isFinite(n) && n > 0 ? `${n} yr` : "-";
    }
    return String(value ?? "-");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Students ({rows.length})</h2>
        <div className="text-sm text-muted-foreground">
          Total Outstanding:{" "}
          <span className="font-semibold text-foreground">
            {formatCurrency(totals.total)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="text-left p-4 font-medium">Student</th>
              <th className="text-left p-4 font-medium">Parent</th>
              <th className="text-left p-4 font-medium">Program</th>
              <th className="text-right p-4 font-medium">Balances</th>
              <th className="text-center p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const prev =
                typeof row["previous_balance"] === "number"
                  ? row["previous_balance"]
                  : Number(row["previous_balance"] ?? 0);
              const current =
                typeof row["current_due"] === "number"
                  ? row["current_due"]
                  : Number(row["current_due"] ?? 0);
              const total =
                (isFinite(prev) ? prev : 0) + (isFinite(current) ? current : 0);

              const balanceColor =
                total < 0
                  ? "text-emerald-600"
                  : total > 0
                  ? "text-red-600"
                  : "text-muted-foreground";

              return (
                <tr
                  key={i}
                  className="border-b hover:bg-muted/30 transition-colors"
                >
                  {/* Column 1: Student Info */}
                  <td className="p-4 min-w-[220px]">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">
                        {String(row["full_name"] ?? "-")}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        {String(row["enrollment_code"] ?? "-")}
                      </p>
                    </div>
                  </td>

                  {/* Column 2: Parents */}
                  <td className="p-4 min-w-[200px]">
                    <div className="min-w-0 space-y-1">
                      {String(row["father_name"] ?? "").trim() && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            Father:{" "}
                          </span>
                          <span className="text-foreground">
                            {String(row["father_name"]).trim()}
                          </span>
                        </div>
                      )}
                      {String(row["mother_name"] ?? "").trim() && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            Mother:{" "}
                          </span>
                          <span className="text-foreground">
                            {String(row["mother_name"]).trim()}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Column 3: Program Details */}
                  <td className="p-4 min-w-[240px]">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium truncate">
                          {String(row["course_name"] ?? "-")}
                        </span>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {String(row["session_title"] ?? "-")}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          College:{" "}
                          <span className="text-foreground font-mono">
                            {String(row["college_code"] ?? "-")}
                          </span>
                        </span>
                        <span>
                          Year:{" "}
                          <span className="text-foreground">
                            {String(row["current_year"] ?? "-")}
                          </span>
                        </span>
                        <span>
                          Duration:{" "}
                          <span className="text-foreground">
                            {row["course_duration"]
                              ? `${row["course_duration"]} yr`
                              : "-"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Column 4: Balance */}
                  <td className="p-4 text-right min-w-[220px]">
                    <div className="text-right">
                      <div
                        className={`text-lg font-semibold tabular-nums ${balanceColor}`}
                      >
                        {formatCurrency(total)}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>
                          Prev:{" "}
                          <span
                            className={
                              prev < 0
                                ? "text-emerald-600"
                                : prev > 0
                                ? "text-red-600"
                                : ""
                            }
                          >
                            {formatCurrency(prev)}
                          </span>
                        </div>
                        <div>
                          Current:{" "}
                          <span
                            className={
                              current < 0
                                ? "text-emerald-600"
                                : current > 0
                                ? "text-red-600"
                                : ""
                            }
                          >
                            {formatCurrency(current)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Column 5: Actions */}
                  <td className="p-4 text-center min-w-[140px]">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => {
                          // Navigate to student profile page
                          // In a real implementation, you'd use the actual student ID
                          const studentId =
                            row["student_id"] ||
                            row["id"] ||
                            row["enrollment_code"];
                          router.push(`/students/${studentId}`);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() =>
                              console.log(
                                "Edit student:",
                                row["enrollment_code"]
                              )
                            }
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Student
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              console.log(
                                "View fee details:",
                                row["enrollment_code"]
                              )
                            }
                          >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Fee Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              console.log(
                                "Generate receipt:",
                                row["enrollment_code"]
                              )
                            }
                          >
                            <Receipt className="mr-2 h-4 w-4" />
                            Generate Receipt
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              console.log(
                                "Contact parent:",
                                row["enrollment_code"]
                              )
                            }
                          >
                            <Phone className="mr-2 h-4 w-4" />
                            Contact Parent
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              console.log("Send email:", row["enrollment_code"])
                            }
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              console.log(
                                "Academic records:",
                                row["enrollment_code"]
                              )
                            }
                          >
                            <GraduationCap className="mr-2 h-4 w-4" />
                            Academic Records
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              console.log(
                                "Generate report:",
                                row["enrollment_code"]
                              )
                            }
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Generate Report
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              console.log(
                                "Deactivate student:",
                                row["enrollment_code"]
                              )
                            }
                            className="text-red-600 focus:text-red-600"
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Deactivate Student
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className="rounded-lg bg-muted/40 p-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Summary</span>
          <div className="flex gap-6">
            <span>
              Prev:{" "}
              <span className="font-medium">{formatCurrency(totals.prev)}</span>
            </span>
            <span>
              Current:{" "}
              <span className="font-medium">{formatCurrency(totals.due)}</span>
            </span>
            <span className="font-semibold">
              Total: {formatCurrency(totals.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
