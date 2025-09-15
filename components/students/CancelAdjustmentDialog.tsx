"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { studentApiClient } from "@/lib/services/student-api.client";
import type { FeeAdjustment } from "@/lib/types/student-api.types";

interface CancelAdjustmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  adjustment: FeeAdjustment | null;
  studentId: string;
  onSuccess?: () => void;
}

export function CancelAdjustmentDialog({
  isOpen,
  onOpenChange,
  adjustment,
  studentId,
  onSuccess,
}: CancelAdjustmentDialogProps) {
  const [cancellationReason, setCancellationReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setCancellationReason("");
    onOpenChange(false);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
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

  const handleCancel = async () => {
    if (!adjustment) return;

    if (!cancellationReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }

    try {
      setIsLoading(true);

      await studentApiClient.cancelAdjustment(
        studentId,
        adjustment.id,
        cancellationReason.trim()
      );

      toast.success("Adjustment cancelled successfully");
      handleClose();
      onSuccess?.();
    } catch (error) {
      console.error("Error cancelling adjustment:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel adjustment"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!adjustment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Cancel Fee Adjustment
          </DialogTitle>
          <DialogDescription>
            You are about to cancel this fee adjustment. This action will
            reverse the balance impact and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Adjustment Details */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-medium mb-3">Adjustment Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Label className="text-muted-foreground">Type</Label>
                <div>{getAdjustmentTypeBadge(adjustment.adjustment_type)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Amount</Label>
                <div className="font-medium">
                  {adjustment.adjustment_type === "PENALTY" ? "+" : "-"}
                  {formatAmount(Math.abs(adjustment.amount))}
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground">Title</Label>
                <div className="font-medium">{adjustment.title}</div>
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground">Original Reason</Label>
                <div className="text-sm">{adjustment.reason}</div>
              </div>
            </div>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="cancellationReason">
              Cancellation Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="cancellationReason"
              placeholder="Please provide a detailed reason for cancelling this adjustment..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Warning:</strong> Cancelling this adjustment will:
                <ul className="mt-1 list-disc list-inside space-y-1">
                  <li>
                    Reverse the balance impact on the student&apos;s fee account
                  </li>
                  <li>Create an audit trail of the cancellation</li>
                  <li>Mark the adjustment as permanently cancelled</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Close
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isLoading || !cancellationReason.trim()}
          >
            {isLoading ? "Cancelling..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
