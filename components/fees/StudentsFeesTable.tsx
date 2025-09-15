"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, Receipt, CreditCard, Users } from "lucide-react";
import type { StudentGridRow } from "@/lib/types/students";
import { CollectPaymentDialog } from "@/components/fees/collect-payment/CollectPaymentDialog";

export function StudentsFeesTable({ rows }: { rows: StudentGridRow[] }) {
  const router = useRouter();
  const [collectFor, setCollectFor] = React.useState<StudentGridRow | null>(
    null
  );

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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Student Balances</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Student</TableHead>
                  <TableHead className="w-[200px]">Course</TableHead>
                  <TableHead className="w-[180px]">Fee Status</TableHead>
                  <TableHead className="w-[150px] text-right">Amount</TableHead>
                  <TableHead className="w-[120px] text-center">
                    Status
                  </TableHead>
                  <TableHead className="w-[100px] text-center">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No students found. Try adjusting your filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => {
                  const prev = Number(row.previous_balance ?? 0);
                  const current = Number(row.current_due ?? 0);
                  const total =
                    (isFinite(prev) ? prev : 0) +
                    (isFinite(current) ? current : 0);

                  // Determine status based on balance
                  const getStatus = () => {
                    if (total === 0)
                      return { label: "Paid", variant: "default" as const };
                    if (total > 0 && current > 0)
                      return {
                        label: "Overdue",
                        variant: "destructive" as const,
                      };
                    if (total > 0)
                      return {
                        label: "Pending",
                        variant: "secondary" as const,
                      };
                    if (total < 0)
                      return { label: "Advance", variant: "outline" as const };
                    return { label: "Partial", variant: "secondary" as const };
                  };

                  const status = getStatus();

                  return (
                    <TableRow
                      key={row.enrollment_id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="py-4">
                        <div className="space-y-1">
                          <div className="font-medium text-sm">
                            {row.full_name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {row.enrollment_code ?? "-"}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="space-y-1">
                          <div className="font-medium text-sm">
                            {row.course_name ?? "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.current_year
                              ? `${row.current_year} Year`
                              : "-"}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="text-emerald-600">
                              Paid:{" "}
                              {formatCurrency(
                                Math.abs(prev) - Math.abs(current)
                              )}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-red-600">
                              Due: {formatCurrency(Math.abs(current))}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-4 text-right">
                        <div className="space-y-1">
                          <div className="text-lg font-semibold tabular-nums">
                            {formatCurrency(Math.abs(total))}
                          </div>
                          {row.last_payment_date && (
                            <div className="text-xs text-muted-foreground">
                              Last:{" "}
                              {new Date(
                                row.last_payment_date
                              ).toLocaleDateString("en-IN")}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-4 text-center">
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">More actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => setCollectFor(row)}
                            >
                              <CreditCard className="mr-2 h-4 w-4" />
                              Collect Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/students/${row.student_id}`)
                              }
                            >
                              <Receipt className="mr-2 h-4 w-4" />
                              View Receipts
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/students/${row.student_id}`)
                              }
                            >
                              View Full Profile
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {collectFor && (
        <CollectPaymentDialog
          open={Boolean(collectFor)}
          student={collectFor}
          onOpenChange={(open: boolean) => {
            if (!open) setCollectFor(null);
          }}
        />
      )}
    </>
  );
}
