"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2 } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  createSession,
  updateSession,
  deleteSession,
} from "@/lib/api/academic";
import { AcademicSession } from "@/lib/types/academic";
import { useAcademicData } from "@/lib/stores/academic-store";
import { toast } from "sonner";

// Helper functions for form state
function getEmptyForm() {
  return {
    title: "",
    start_date: "",
    end_date: "",
    is_current: false,
  };
}

function getEmptyEditForm() {
  return {
    id: "",
    title: "",
    start_date: "",
    end_date: "",
    is_current: false,
  };
}

function getEmptyFormErrors() {
  return {
    title: "",
    start_date: "",
    end_date: "",
    general: "",
  };
}

export default function SessionsPanel() {
  const { sessions, invalidateSessions } =
    useAcademicData();

  const [form, setForm] = useState(getEmptyForm());
  const [editForm, setEditForm] = useState(getEmptyEditForm());
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Validation states
  const [formErrors, setFormErrors] = useState(getEmptyFormErrors());

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "current" | "past" | "future"
  >("all");

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    sessionId: string;
    sessionTitle: string;
  }>({
    open: false,
    sessionId: "",
    sessionTitle: "",
  });

  // Validation functions
  function validateTitle(title: string): string {
    if (!(title && title.trim())) {
      return "Session title is required";
    }
    if (title.trim().length < 3) {
      return "Title must be at least 3 characters long";
    }
    if (title.trim().length > 100) {
      return "Title must be less than 100 characters";
    }
    return "";
  }

  function validateDate(date: string, fieldName: string): string {
    if (!(date && date.trim())) {
      return `${fieldName} is required`;
    }
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return `${fieldName} must be a valid date`;
    }
    return "";
  }

  function validateDateRange(startDate: string, endDate: string): string {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return "End date must be after start date";
    }
    return "";
  }

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Filter by status
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    if (statusFilter === "current") {
      filtered = filtered.filter((session) => session.is_current);
    } else if (statusFilter === "past") {
      filtered = filtered.filter((session) => session.end_date < today);
    } else if (statusFilter === "future") {
      filtered = filtered.filter((session) => session.start_date > today);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((session) =>
        session.title.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [sessions, searchTerm, statusFilter]);

  async function onCreate() {
    // Clear previous errors
    setFormErrors(getEmptyFormErrors());

    // Validate form
    const titleError = validateTitle(form.title);
    const startError = validateDate(form.start_date, "Start date");
    const endError = validateDate(form.end_date, "End date");
    const rangeError = validateDateRange(form.start_date, form.end_date);

    if (titleError || startError || endError || rangeError) {
      setFormErrors({
        title: titleError,
        start_date: startError,
        end_date: endError,
        general: rangeError,
      });
      return;
    }

    try {
      await createSession({
        title: form.title.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        is_current: form.is_current,
      });
      setForm(getEmptyForm());
      setFormErrors(getEmptyFormErrors());
      setIsAddOpen(false);
      invalidateSessions();
      toast.success("Session created successfully");
    } catch (error) {
      toast.error("Failed to create session. Please try again.");
      console.error("Create session error:", error);
    }
  }

  async function onUpdate() {
    if (!(editForm.title && editForm.title.trim())) {
      toast.error("Please enter a session title.");
      return;
    }
    if (!editForm.start_date || !editForm.end_date) {
      toast.error("Please enter both start and end dates.");
      return;
    }
    if (new Date(editForm.start_date) >= new Date(editForm.end_date)) {
      toast.error("End date must be after start date.");
      return;
    }

    try {
      await updateSession(editForm.id, {
        title: editForm.title.trim(),
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        is_current: editForm.is_current,
      });
      setIsEditOpen(false);
      setEditForm(getEmptyEditForm());
      invalidateSessions();
      toast.success("Session updated successfully");
    } catch (error) {
      toast.error("Failed to update session. Please try again.");
      console.error("Update session error:", error);
    }
  }

  async function handleDelete() {
    try {
      await deleteSession(confirmDialog.sessionId);
      setConfirmDialog({ open: false, sessionId: "", sessionTitle: "" });
      invalidateSessions();
      toast.success("Session deleted successfully");
    } catch (error) {
      toast.error("Failed to delete session. Please try again.");
      console.error("Delete session error:", error);
    }
  }

  function openEdit(session: AcademicSession) {
    setEditForm({
      id: session.id,
      title: session.title,
      start_date: session.start_date,
      end_date: session.end_date,
      is_current: session.is_current,
    });
    setIsEditOpen(true);
  }

  function getSessionStatus(session: AcademicSession) {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const start = session.start_date;
    const end = session.end_date;

    if (session.is_current)
      return { label: "Current", variant: "default" as const };
    if (end < today) return { label: "Past", variant: "secondary" as const };
    if (start > today) return { label: "Future", variant: "outline" as const };
    return { label: "Active", variant: "default" as const };
  }

  // if (!isHydrated || loading) {
  //   return (
  //     <Card className="p-6">
  //       <div className="text-center py-8">Loading sessions...</div>
  //     </Card>
  //   );
  // }

  return (
    <Card className="p-6 space-y-4">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Academic Sessions</h2>
          <p className="text-sm text-muted-foreground">
            Manage academic years and session periods
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{sessions.length}</p>
            <p className="text-xs text-muted-foreground">Total Sessions</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">
              {filteredSessions.length}
            </p>
            <p className="text-xs text-muted-foreground">Filtered</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Filters Section */}
      <div className="space-y-4">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Search Sessions
            </label>
            <Input
              placeholder="Search by title..."
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
                setStatusFilter(
                  e.target.value as "all" | "current" | "past" | "future"
                )
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="all">All Sessions</option>
              <option value="current">Current Session</option>
              <option value="past">Past Sessions</option>
              <option value="future">Future Sessions</option>
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
              className="w-full h-9"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Add New Session Section */}
      <div className="flex items-center justify-between">
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => invalidateSessions()}
            className="shrink-0"
          >
            🔄 Refresh
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="shrink-0">
            + Add Session
          </Button>
        </div>
      </div>

      <Separator />

      {/* Sessions Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Session List</h3>
          {statusFilter !== "all" && (
            <Badge variant="secondary">Showing: {statusFilter} sessions</Badge>
          )}
        </div>

        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {sessions.length === 0
              ? "No sessions found. Add one to get started."
              : "No sessions match your current filters."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">S.No.</TableHead>
                <TableHead>Session Title</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map((session, index) => {
                const status = getSessionStatus(session);
                const startDate = new Date(session.start_date);
                const endDate = new Date(session.end_date);
                const durationDays = Math.ceil(
                  (endDate.getTime() - startDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                return (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {session.title}
                    </TableCell>
                    <TableCell>{startDate.toLocaleDateString()}</TableCell>
                    <TableCell>{endDate.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {durationDays} days
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {session.created_at
                        ? new Date(session.created_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(session)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setConfirmDialog({
                              open: true,
                              sessionId: session.id,
                              sessionTitle: session.title,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Session Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setForm(getEmptyForm());
            setFormErrors(getEmptyFormErrors());
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Academic Session</DialogTitle>
            <DialogDescription>
              Create a new academic session/year in the system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {formErrors.general && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {formErrors.general}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Session Title <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g., Academic Year 2024-25, Spring Semester 2024"
                value={form.title}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm({ ...form, title: value });
                  const error = validateTitle(value);
                  setFormErrors({ ...formErrors, title: error });
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !(
                      formErrors.title ||
                      formErrors.start_date ||
                      formErrors.end_date ||
                      formErrors.general
                    )
                  ) {
                    onCreate();
                  }
                }}
                maxLength={100}
                className={formErrors.title ? "border-red-500" : ""}
              />
              {formErrors.title && (
                <div className="text-xs text-red-600">{formErrors.title}</div>
              )}
              <div className="text-xs text-muted-foreground">
                Descriptive title for the academic session (max 100 characters)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm({ ...form, start_date: value });
                    const error = validateDate(value, "Start date");
                    setFormErrors({ ...formErrors, start_date: error });
                    if (value && form.end_date) {
                      const rangeError = validateDateRange(
                        value,
                        form.end_date
                      );
                      setFormErrors((prev) => ({
                        ...prev,
                        general: rangeError,
                      }));
                    }
                  }}
                  className={formErrors.start_date ? "border-red-500" : ""}
                />
                {formErrors.start_date && (
                  <div className="text-xs text-red-600">
                    {formErrors.start_date}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  End Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm({ ...form, end_date: value });
                    const error = validateDate(value, "End date");
                    setFormErrors({ ...formErrors, end_date: error });
                    if (form.start_date && value) {
                      const rangeError = validateDateRange(
                        form.start_date,
                        value
                      );
                      setFormErrors((prev) => ({
                        ...prev,
                        general: rangeError,
                      }));
                    }
                  }}
                  className={formErrors.end_date ? "border-red-500" : ""}
                />
                {formErrors.end_date && (
                  <div className="text-xs text-red-600">
                    {formErrors.end_date}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_current"
                  checked={form.is_current}
                  onChange={(e) =>
                    setForm({ ...form, is_current: e.target.checked })
                  }
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label
                  htmlFor="is_current"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Set as current session
                </label>
              </div>
              <div className="text-xs text-muted-foreground">
                Mark this session as the currently active academic session
              </div>
            </div>

            {form.title && form.start_date && form.end_date && (
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Preview:
                </div>
                <div className="text-sm flex items-center gap-2">
                  <span className="font-medium">{form.title}</span>
                  {form.is_current && <Badge variant="default">Current</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(form.start_date).toLocaleDateString()} -{" "}
                  {new Date(form.end_date).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddOpen(false);
                setForm(getEmptyForm());
                setFormErrors(getEmptyFormErrors());
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={
                !!(
                  formErrors.title ||
                  formErrors.start_date ||
                  formErrors.end_date ||
                  formErrors.general ||
                  !(
                    form.title &&
                    form.title.trim() &&
                    form.start_date &&
                    form.end_date
                  )
                )
              }
            >
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Academic Session</DialogTitle>
            <DialogDescription>
              Update the academic session information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Session Title <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Session title"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, start_date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  End Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, end_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit_is_current"
                  checked={editForm.is_current}
                  onChange={(e) =>
                    setEditForm({ ...editForm, is_current: e.target.checked })
                  }
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label
                  htmlFor="edit_is_current"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Set as current session
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onUpdate}
              disabled={
                !(
                  editForm.title &&
                  editForm.title.trim() &&
                  editForm.start_date &&
                  editForm.end_date
                )
              }
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;
              {confirmDialog.sessionTitle}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog({
                  open: false,
                  sessionId: "",
                  sessionTitle: "",
                })
              }
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
