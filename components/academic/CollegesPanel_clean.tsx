"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  createCollege,
  updateCollege,
  deleteCollege,
} from "@/lib/api/academic";
import { College } from "@/lib/types/academic";
import { useAcademicData } from "@/lib/stores/academic-store";

export default function CollegesPanel() {
  const { colleges, loading, isHydrated, invalidateColleges } =
    useAcademicData();

  const [form, setForm] = useState<{
    code: string;
    name: string;
    admission_number: number;
  }>({ code: "", name: "", admission_number: 10000 });

  const [editForm, setEditForm] = useState<{
    id: string;
    code: string;
    name: string;
    admission_number: number;
    status: number;
  }>({ id: "", code: "", name: "", admission_number: 10000, status: 1 });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Filtered colleges
  const filteredColleges = useMemo(() => {
    let filtered = colleges;

    // Filter by status
    if (statusFilter === "active") {
      filtered = filtered.filter((college) => college.status === 1);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((college) => college.status === 0);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (college) =>
          college.name.toLowerCase().includes(term) ||
          (college.code && college.code.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [colleges, searchTerm, statusFilter]);

  async function onCreate() {
    if (!(form.name && form.name.trim())) {
      alert("Please enter a college name.");
      return;
    }
    try {
      await createCollege({
        code: form.code.trim() === "" ? undefined : form.code.trim(),
        name: form.name.trim(),
        admission_number: form.admission_number || 10000,
        status: 1, // Active by default
      });
      setForm({ code: "", name: "", admission_number: 10000 });
      setIsAddOpen(false);
      invalidateColleges();
    } catch (error) {
      alert("Failed to create college. Please try again.");
      console.error("Create college error:", error);
    }
  }

  async function onUpdate() {
    if (!(editForm.name && editForm.name.trim())) {
      alert("Please enter a college name.");
      return;
    }
    try {
      await updateCollege(editForm.id, {
        code: editForm.code.trim() === "" ? undefined : editForm.code.trim(),
        name: editForm.name.trim(),
        admission_number: editForm.admission_number || undefined,
        status: editForm.status,
      });
      setIsEditOpen(false);
      setEditForm({
        id: "",
        code: "",
        name: "",
        admission_number: 10000,
        status: 1,
      });
      invalidateColleges();
    } catch (error) {
      alert("Failed to update college. Please try again.");
      console.error("Update college error:", error);
    }
  }

  async function onDelete(id: string, name: string) {
    if (
      !confirm(
        `Are you sure you want to delete "${name}"? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteCollege(id);
      invalidateColleges();
    } catch (error) {
      alert("Failed to delete college. Please try again.");
      console.error("Delete college error:", error);
    }
  }

  async function onToggleStatus(id: string, currentStatus: number) {
    try {
      await updateCollege(id, { status: currentStatus === 1 ? 0 : 1 });
      invalidateColleges();
    } catch (error) {
      alert("Failed to update college status. Please try again.");
      console.error("Toggle status error:", error);
    }
  }

  function openEdit(college: College) {
    setEditForm({
      id: college.id,
      code: college.code || "",
      name: college.name,
      admission_number: college.admission_number ?? 10000,
      status: college.status,
    });
    setIsEditOpen(true);
  }

  if (!isHydrated || loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">Loading colleges...</div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">College Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage educational institutions and their details
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{colleges.length}</p>
            <p className="text-xs text-muted-foreground">Total Colleges</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">
              {filteredColleges.length}
            </p>
            <p className="text-xs text-muted-foreground">Filtered</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Filters Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Filters & Search</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Search Colleges
            </label>
            <Input
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "inactive")
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="all">All Colleges</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Quick Actions
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setSearchTerm("");
              }}
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Add New College Section */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">College Management</h3>
          <p className="text-xs text-muted-foreground">
            Add new colleges or manage existing ones
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => invalidateColleges()}
            className="shrink-0"
          >
            🔄 Refresh
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="shrink-0">
            + Add College
          </Button>
        </div>
      </div>

      <Separator />

      {/* Colleges Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">College List</h3>
          {statusFilter !== "all" && (
            <Badge variant="secondary">Showing: {statusFilter} colleges</Badge>
          )}
        </div>

        {filteredColleges.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {colleges.length === 0
              ? "No colleges found. Add one to get started."
              : "No colleges match your current filters."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">S.No.</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>College Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Next Admission No.</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredColleges.map((college, index) => (
                <TableRow key={college.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    {college.code ? (
                      <Badge variant="outline" className="font-mono">
                        {college.code}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{college.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={college.status === 1 ? "default" : "secondary"}
                    >
                      {college.status === 1 ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {college.admission_number?.toString() ?? "—"}
                  </TableCell>
                  <TableCell>
                    {college.created_at
                      ? new Date(college.created_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(college)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onToggleStatus(college.id, college.status)
                        }
                      >
                        {college.status === 1 ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(college.id, college.name)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add College Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setForm({ code: "", name: "", admission_number: 10000 });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New College</DialogTitle>
            <DialogDescription>
              Create a new college/institution in the system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                College Code
              </label>
              <Input
                placeholder="e.g., AIMT, MIT, IIT"
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && form.name && form.name.trim()) {
                    onCreate();
                  }
                }}
                maxLength={50}
              />
              <div className="text-xs text-muted-foreground">
                Optional short code for the college (max 50 characters)
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                College Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g., Alpine Institute of Management and Technology"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && form.name && form.name.trim()) {
                    onCreate();
                  }
                }}
                maxLength={200}
              />
              <div className="text-xs text-muted-foreground">
                Full name of the college or institution (max 200 characters)
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Next Admission Number
              </label>
              <Input
                type="number"
                placeholder="e.g., 10000"
                value={form.admission_number}
                onChange={(e) =>
                  setForm({ ...form, admission_number: Number(e.target.value) })
                }
                min={1}
              />
              <div className="text-xs text-muted-foreground">
                Used to auto-generate admission IDs. Default is 10000.
              </div>
            </div>

            {form.name && (
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Preview:
                </div>
                <div className="text-sm flex items-center gap-2">
                  {form.code && (
                    <Badge variant="outline" className="font-mono">
                      {form.code}
                    </Badge>
                  )}
                  <span className="font-medium">{form.name}</span>
                  <Badge variant="secondary" className="font-mono">
                    Next Adm. #{form.admission_number || 10000}
                  </Badge>
                  <Badge variant="default">Active</Badge>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddOpen(false);
                setForm({ code: "", name: "", admission_number: 10000 });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={!(form.name && form.name.trim())}
            >
              Create College
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit College</DialogTitle>
            <DialogDescription>
              Update the college information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                College Code
              </label>
              <Input
                placeholder="College code (optional)"
                value={editForm.code}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                College Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="College name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Next Admission Number
              </label>
              <Input
                type="number"
                placeholder="e.g., 10000"
                value={editForm.admission_number}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    admission_number: Number(e.target.value),
                  })
                }
                min={1}
              />
              <div className="text-xs text-muted-foreground">
                Updating this will change the next assigned admission number.
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Status
              </label>
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({ ...editForm, status: Number(e.target.value) })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onUpdate}
              disabled={!(editForm.name && editForm.name.trim())}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
