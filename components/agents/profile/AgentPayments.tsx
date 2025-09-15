"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Download,
  Plus,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface PaymentRecord {
  id: string;
  student_name: string;
  course_name: string | null;
  college_name: string | null;
  is_paid: boolean | null;
  payment_date: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  remarks: string | null;
  created_at: string;
}

interface PaymentSummary {
  total_records: number;
  paid_count: number;
  pending_count: number;
  this_month_records: number;
}

interface AgentPaymentsProps {
  agentId: string;
}

export function AgentPayments({ agentId }: AgentPaymentsProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const loadPayments = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.append("status", statusFilter);

        const [paymentsRes, summaryRes] = await Promise.all([
          fetch(`/api/agents/${agentId}/payments?${params.toString()}`),
          fetch(`/api/agents/${agentId}/payment-summary`),
        ]);

        if (!paymentsRes.ok || !summaryRes.ok) {
          throw new Error("Failed to load payment data");
        }

        const paymentsData = await paymentsRes.json();
        const summaryData = await summaryRes.json();

        setPayments(paymentsData.payments || []);
        setSummary(summaryData);
      } catch (error) {
        console.error("Error loading payments:", error);
      } finally {
        setLoading(false);
      }
    };

    if (agentId) {
      loadPayments();
    }
  }, [agentId, statusFilter]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (isPaid: boolean | null) => {
    if (isPaid === true) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Paid
        </Badge>
      );
    } else if (isPaid === false) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Unknown
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-20" />
                  <div className="h-8 bg-muted rounded w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Paid Records
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {summary.paid_count}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending Records
                  </p>
                  <p className="text-2xl font-bold text-orange-600">
                    {summary.pending_count}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    This Month
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {summary.this_month_records}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CreditCard className="h-4 w-4 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Records
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {summary.total_records}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Payment History ({payments.length})
            </div>
            <div className="flex items-center space-x-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No payment records</h3>
              <p className="text-muted-foreground">
                No payment records have been recorded for this agent yet.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student & Course</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Transaction ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {payment.student_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {payment.course_name || "Course not assigned"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {payment.college_name || "College not assigned"}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <div className="text-sm">
                            {payment.remarks || "No remarks"}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>{getStatusBadge(payment.is_paid)}</TableCell>

                      <TableCell>
                        <div className="flex items-center text-sm">
                          <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                          {formatDate(payment.payment_date)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          {payment.payment_method || "Not specified"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm font-mono">
                          {payment.transaction_id || "-"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
