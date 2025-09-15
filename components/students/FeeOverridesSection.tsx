"use client";

import { useEffect, useState, useCallback } from "react";
import { Edit, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface FeeOverridesSectionProps {
  studentId: string;
}

interface FeeOverride {
  id: string;
  student_id: string;
  enrollment_id: string;
  fee_plan_item_id: string;
  year_number: number;
  component_code: string;
  component_name: string;
  override_amount: number;
  discount_amount: number;
  reason: string;
  created_at: string;
  created_by: string;
  created_by_name: string;
  updated_at: string;
  updated_by: string;
  updated_by_name: string;
}

export function FeeOverridesSection({ studentId }: FeeOverridesSectionProps) {
  const [overrides, setOverrides] = useState<FeeOverride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverrides = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/students/${studentId}/fee-overrides`);

      if (!response.ok) {
        throw new Error("Failed to fetch fee overrides");
      }

      const data = await response.json();
      setOverrides(data.overrides || []);
    } catch (err) {
      console.error("Error loading fee overrides:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load fee overrides"
      );
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) {
      loadOverrides();
    }
  }, [studentId, loadOverrides]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            <span>Loading fee overrides...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error: {error}</p>
            <Button variant="outline" onClick={loadOverrides} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fee Overrides</h3>
          <p className="text-sm text-gray-600">
            History of all fee amount modifications made for this student
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {overrides.length} Override{overrides.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {overrides.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <Edit className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No fee overrides found</p>
            <p className="text-sm">
              All fees are using original course amounts
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-700">
                    Fee Type
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">
                    Override
                  </TableHead>

                  <TableHead className="font-semibold text-slate-700 pl-6">
                    Reason
                  </TableHead>

                  <TableHead className="font-semibold text-slate-700">
                    Users
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700">
                    Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((override, index) => {
                  return (
                    <TableRow
                      key={override.id}
                      className={`
                      hover:bg-slate-50/50 transition-colors
                      ${index % 2 === 0 ? "bg-white" : "bg-slate-25/25"}
                    `}
                    >
                      <TableCell className="py-4">
                        <div className="space-y-2">
                          <div className=" text-xs">
                            {override.component_name}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="text-xs  px-2 py-1"
                            >
                              Year {override.year_number}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span className="text-sm font-mono text-slate-900">
                          ₹{override.override_amount.toLocaleString()}
                        </span>
                      </TableCell>

                      <TableCell className="py-4 ">
                        <div className="pl-4 max-w-48 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
                          {override.reason || (
                            <span className="italic text-slate-400">
                              No reason provided
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="flex flex-col items-start gap-2 text-xs text-muted-foreground">
                          <span className="  truncate max-w-48">
                            Created by: {override.created_by_name}
                          </span>
                          <span className=" truncate max-w-48 text-red-600">
                            Updated by: {override.updated_by_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="font-medium">
                            {new Date(override.created_at).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
