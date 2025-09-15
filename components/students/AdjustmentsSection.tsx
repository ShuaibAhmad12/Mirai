"use client";

import { useEffect, useState } from "react";
import { Settings, Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudentProfileStore } from "@/hooks/use-student-profile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ManageAdjustmentDialog } from "./ManageAdjustmentDialog";
import { CancelAdjustmentDialog } from "./CancelAdjustmentDialog";
import type { FeeAdjustment } from "@/lib/types/student-api.types";

interface AdjustmentsSectionProps {
  studentId: string;
}

export function AdjustmentsSection({ studentId }: AdjustmentsSectionProps) {
  const {
    adjustments,
    isLoadingAdjustments,
    adjustmentsError,
    loadAdjustments,
    loadFees,
  } = useStudentProfileStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] =
    useState<FeeAdjustment | null>(null);

  useEffect(() => {
    if (studentId) {
      loadAdjustments(studentId);
    }
  }, [studentId, loadAdjustments]);

  const handleAdjustmentSuccess = () => {
    // Reload adjustments after successful creation
    loadAdjustments(studentId);
    // Also reload fees to refresh balance data
    loadFees(studentId);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getAdjustmentTypeBadge = (type: string) => {
    switch (type) {
      case "DISCOUNT":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Discount
          </Badge>
        );
      case "PENALTY":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-700">
            Penalty
          </Badge>
        );
      case "SCHOLARSHIP":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            Scholarship
          </Badge>
        );
      case "WAIVER":
        return (
          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
            Waiver
          </Badge>
        );
      case "OTHER":
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
            Other
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge variant="default" className="bg-green-600">
            Active
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge
            variant="destructive"
            className="bg-red-100 text-red-700 border-red-200"
          >
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (adjustmentsError) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Fee Adjustments History</h3>
            <p className="text-sm text-muted-foreground">
              View and manage fee adjustments, penalties, and discounts
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Adjustment
            </Button>
          </div>
        </div>
        <div className="border rounded-lg p-8 text-center">
          <p className="text-red-600">
            Error loading adjustments: {adjustmentsError}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Fee Adjustments History</h3>
          <p className="text-sm text-muted-foreground">
            View and manage fee adjustments, penalties, and discounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Adjustment
          </Button>
        </div>
      </div>

      {isLoadingAdjustments ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50 animate-pulse" />
          <p>Loading adjustments...</p>
        </div>
      ) : !adjustments ||
        !Array.isArray(adjustments) ||
        adjustments.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h4 className="font-medium mb-2">No adjustments found</h4>
          <p className="text-sm">
            Fee adjustments and penalties will appear here when created.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Audit</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((adjustment) => (
                <TableRow key={adjustment.id}>
                  <TableCell>{formatDate(adjustment.created_at)}</TableCell>
                  <TableCell>
                    {getAdjustmentTypeBadge(adjustment.adjustment_type)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {adjustment.title}
                  </TableCell>
                  <TableCell>
                    {adjustment.fee_components?.label || "General"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span
                      className={
                        adjustment.status === "CANCELLED"
                          ? "line-through text-muted-foreground"
                          : ""
                      }
                    >
                      {adjustment.adjustment_type === "PENALTY" ? "+" : "-"}
                      {formatAmount(Math.abs(adjustment.amount))}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(adjustment.status)}</TableCell>
                  <TableCell className="max-w-xs">
                    <div
                      className="truncate whitespace-pre-wrap break-words"
                      title={adjustment.reason || ""}
                    >
                      {adjustment.reason || "No reason provided"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2 text-xs">
                      {/* Created By */}
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-slate-700">
                            Created:{" "}
                            {adjustment.created_by_name || "Unknown User"}
                          </div>
                        </div>
                      </div>

                      {/* Cancelled By (if status is CANCELLED) */}
                      {adjustment.status === "CANCELLED" &&
                        adjustment.cancelled_by && (
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium text-red-700">
                                Cancelled:{" "}
                                {adjustment.cancelled_by_name || "Unknown User"}
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {adjustment.status === "ACTIVE" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAdjustment(adjustment);
                          setCancelDialogOpen(true);
                        }}
                        className="text-red-600 border-red-200 hover:bg-red-50 h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ManageAdjustmentDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        studentId={studentId}
        currentYear={new Date().getFullYear()}
        onSuccess={handleAdjustmentSuccess}
      />

      <CancelAdjustmentDialog
        isOpen={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        adjustment={selectedAdjustment}
        studentId={studentId}
        onSuccess={() => {
          handleAdjustmentSuccess();
          setSelectedAdjustment(null);
        }}
      />
    </div>
  );
}
