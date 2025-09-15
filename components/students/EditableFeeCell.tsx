"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditableFeeProps {
  studentId: string;
  feePlanItemId: string;
  yearNumber: number;
  componentCode: string;
  currentAmount: number;
  paidAmount: number;
  onUpdate?: (newAmount: number) => void;
}

export function EditableFeeCell({
  studentId,
  feePlanItemId,
  yearNumber,
  componentCode,
  currentAmount,
  paidAmount,
  onUpdate,
}: EditableFeeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentAmount.toString());
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(currentAmount.toString());
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(currentAmount.toString());
  };

  const handleSave = async () => {
    const newAmount = parseFloat(editValue);

    // Enhanced validation with negative check
    if (isNaN(newAmount)) {
      toast.error("Please enter a valid number");
      return;
    }

    if (newAmount < 0) {
      toast.error("Fee amount cannot be negative");
      return;
    }

    // CRITICAL VALIDATION: For non-SECURITY/OTHER components,
    // actual fee cannot be reduced below paid amount
    const isSpecialComponent =
      componentCode === "SECURITY" || componentCode === "OTHER";
    if (!isSpecialComponent && newAmount < paidAmount) {
      toast.error(
        `Cannot reduce fee to ₹${newAmount.toLocaleString()} as ₹${paidAmount.toLocaleString()} has already been paid. Minimum allowed: ₹${paidAmount.toLocaleString()}`
      );
      return;
    }

    console.log("EditableFeeCell sending data:", {
      studentId,
      feePlanItemId,
      yearNumber,
      componentCode,
      newAmount,
    });

    setIsLoading(true);

    try {
      const response = await fetch(`/api/students/${studentId}/fee-overrides`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fee_plan_item_id: feePlanItemId,
          year_number: yearNumber,
          component_code: componentCode,
          new_amount: newAmount,
          reason: `Updated via student profile from ₹${currentAmount.toLocaleString()} to ₹${newAmount.toLocaleString()}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update fee");
      }

      await response.json();

      // Show success message with special note for SECURITY and OTHER fees
      const isSpecialComponent =
        componentCode === "SECURITY" || componentCode === "OTHER";
      const successMessage = isSpecialComponent
        ? "Fee updated successfully (special component - no course limit)"
        : "Fee updated successfully";

      toast.success(successMessage);
      setIsEditing(false);

      // Notify parent component
      if (onUpdate) {
        onUpdate(newAmount);
      }

      // Reload the page to refresh all fee data
      window.location.reload();
    } catch (error) {
      console.error("Error updating fee:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update fee"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">
            ₹
          </span>
          <Input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-24 pl-6 text-right text-sm font-mono"
            autoFocus
            disabled={isLoading}
            min={
              componentCode === "SECURITY" || componentCode === "OTHER"
                ? 0
                : paidAmount
            }
            title={
              paidAmount > 0 &&
              componentCode !== "SECURITY" &&
              componentCode !== "OTHER"
                ? `Minimum allowed: ₹${paidAmount.toLocaleString()} (already paid)`
                : "Enter fee amount"
            }
          />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={isLoading}
            className="h-6 w-6 p-0"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3 text-green-600" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isLoading}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3 text-red-600" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <span className="text-sm font-mono">
        ₹{currentAmount.toLocaleString()}
      </span>
      {/* Special indicator for SECURITY and OTHER fees */}
      {(componentCode === "SECURITY" || componentCode === "OTHER") && (
        <span
          className="text-xs text-blue-500 opacity-70"
          title="This fee can be modified without course limit restrictions"
        >
          *
        </span>
      )}
      {/* Warning indicator when there's a paid amount for non-special components */}
      {paidAmount > 0 &&
        componentCode !== "SECURITY" &&
        componentCode !== "OTHER" && (
          <span
            className="text-xs text-amber-600 opacity-70"
            title={`Cannot reduce below ₹${paidAmount.toLocaleString()} (already paid)`}
          >
            ⚠
          </span>
        )}
      <Button
        size="sm"
        variant="ghost"
        onClick={handleEdit}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit className="h-3 w-3" />
      </Button>
    </div>
  );
}
