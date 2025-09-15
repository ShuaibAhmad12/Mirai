"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { studentApiClient } from "@/lib/services/student-api.client";

interface ManageAdjustmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  currentYear: number;
  onSuccess?: () => void;
}

export function ManageAdjustmentDialog({
  isOpen,
  onOpenChange,
  studentId,
  currentYear,
  onSuccess,
}: ManageAdjustmentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    adjustmentType: "",
    amount: "",
    title: "",
    reason: "",
  });

  const adjustmentTypes = [
    {
      value: "DISCOUNT",
      label: "Discount",
      description: "Reduce fees for the student",
    },
    { value: "PENALTY", label: "Penalty", description: "Add penalty charges" },
    {
      value: "SCHOLARSHIP",
      label: "Scholarship",
      description: "Apply scholarship discount",
    },
    {
      value: "WAIVER",
      label: "Fee Waiver",
      description: "Waive specific fees",
    },
    { value: "OTHER", label: "Other", description: "Other adjustment type" },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      adjustmentType: "",
      amount: "",
      title: "",
      reason: "",
    });
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);

      // Validation
      if (!formData.adjustmentType) {
        toast.error("Please select an adjustment type");
        return;
      }

      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        toast.error("Please enter a valid amount greater than 0");
        return;
      }

      if (!formData.title.trim()) {
        toast.error("Please enter a title for the adjustment");
        return;
      }

      if (!formData.reason.trim()) {
        toast.error("Please enter a reason for the adjustment");
        return;
      }

      // Prepare adjustment data
      const adjustmentData = {
        adjustment_type: formData.adjustmentType as
          | "DISCOUNT"
          | "PENALTY"
          | "SCHOLARSHIP"
          | "WAIVER"
          | "OTHER",
        amount: parseFloat(formData.amount),
        title: formData.title.trim(),
        reason: formData.reason.trim(),
        fee_component_code: "TUITION", // Always apply to tuition
        effective_date: new Date().toISOString().split("T")[0], // Today's date
      };

      console.log(
        "Creating adjustment for student:",
        studentId,
        adjustmentData
      );

      // Call API to create adjustment
      await studentApiClient.createAdjustment(studentId, adjustmentData);

      toast.success("The fee adjustment has been applied successfully");

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating adjustment:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create adjustment. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const selectedType = adjustmentTypes.find(
    (type) => type.value === formData.adjustmentType
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Fee Adjustment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label htmlFor="adjustmentType">Adjustment Type</Label>
            <Select
              value={formData.adjustmentType}
              onValueChange={(value) =>
                handleInputChange("adjustmentType", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select adjustment type" />
              </SelectTrigger>
              <SelectContent>
                {adjustmentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {type.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <p className="text-sm text-muted-foreground">
                {selectedType.description}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount (₹)
              {formData.adjustmentType === "PENALTY" && (
                <span className="text-red-600 ml-1">
                  - Will be added to tuition fees
                </span>
              )}
              {(formData.adjustmentType === "DISCOUNT" ||
                formData.adjustmentType === "SCHOLARSHIP" ||
                formData.adjustmentType === "WAIVER") && (
                <span className="text-green-600 ml-1">
                  - Will be deducted from tuition fees
                </span>
              )}
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="Enter amount"
              value={formData.amount}
              onChange={(e) => handleInputChange("amount", e.target.value)}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter adjustment title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for this adjustment"
              value={formData.reason}
              onChange={(e) => handleInputChange("reason", e.target.value)}
              rows={3}
            />
          </div>

          {/* Info */}
          <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This adjustment will be applied to the
              tuition fee component for the current academic year ({currentYear}
              ). The adjustment will be effective immediately.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
