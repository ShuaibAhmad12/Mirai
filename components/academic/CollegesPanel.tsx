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
import { toast } from "sonner";
import {
  createCollege,
  updateCollege,
  deleteCollege,
} from "@/lib/api/academic";
import { College } from "@/lib/types/academic";
import { useAcademicData } from "@/lib/stores/academic-store";
import { Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function CollegesPanel() {
  const { colleges, loading, isHydrated, invalidateColleges } =
    useAcademicData();

  // Helper function for empty form state
  const getEmptyForm = () => ({
    code: "",
    name: "",
    admission_number: 10000,
    address: "",
    website: "",
    email: "",
    phone: "",
    affiliation: "",
    approved_by: "",
  });

  const getEmptyEditForm = () => ({
    id: "",
    code: "",
    name: "",
    admission_number: 10000,
    address: "",
    website: "",
    email: "",
    phone: "",
    affiliation: "",
    approved_by: "",
    status: 1,
  });

  const [form, setForm] = useState(getEmptyForm());

  const [editForm, setEditForm] = useState(getEmptyEditForm());

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form validation errors
  const [formErrors, setFormErrors] = useState<{
    code?: string;
    name?: string;
    admission_number?: string;
    address?: string;
    website?: string;
    email?: string;
    phone?: string;
    affiliation?: string;
    approved_by?: string;
  }>({});

  const [editFormErrors, setEditFormErrors] = useState<{
    code?: string;
    name?: string;
    admission_number?: string;
    address?: string;
    website?: string;
    email?: string;
    phone?: string;
    affiliation?: string;
    approved_by?: string;
  }>({});

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    action: () => { },
  });

  // Validation functions
  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return undefined;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    return undefined;
  };

  const validatePhone = (phone: string): string | undefined => {
    if (!phone.trim()) return undefined;
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{7,15}$/;
    if (!phoneRegex.test(phone)) return "Please enter a valid phone number";
    return undefined;
  };

  const validateWebsite = (website: string): string | undefined => {
    if (!website.trim()) return undefined;
    try {
      new URL(website.startsWith("http") ? website : `https://${website}`);
      return undefined;
    } catch {
      return "Please enter a valid website URL";
    }
  };

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case "name":
        if (!value.trim()) return "College name is required";
        if (value.trim().length < 2)
          return "College name must be at least 2 characters";
        return undefined;
      case "code":
        if (value.trim() && value.trim().length < 2)
          return "College code must be at least 2 characters";
        return undefined;
      case "admission_number":
        if (!value.toString().trim()) return undefined;
        if (!/^\d{1,9}$/.test(value.toString().trim()))
          return "Admission number must be a positive integer";
        return undefined;
      case "email":
        return validateEmail(value);
      case "phone":
        return validatePhone(value);
      case "website":
        return validateWebsite(value);
      case "address":
        if (value.trim() && value.trim().length < 5)
          return "Address must be at least 5 characters";
        return undefined;
      case "affiliation":
        if (value.trim() && value.trim().length < 2)
          return "Affiliation must be at least 2 characters";
        return undefined;
      case "approved_by":
        if (value.trim() && value.trim().length < 2)
          return "Approved by must be at least 2 characters";
        return undefined;
      default:
        return undefined;
    }
  };

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
    // Clear previous errors
    setFormErrors({});

    // Validate all fields
    const errors: typeof formErrors = {};
    Object.keys(form).forEach((key) => {
      const fieldKey = key as keyof typeof form;
      const raw = form[fieldKey] as unknown;
      const error = validateField(String(fieldKey), String(raw ?? ""));
      if (error) errors[fieldKey as keyof typeof formErrors] = error;
    });

    // Check for validation errors
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please fix the form errors before submitting");
      return;
    }

    // Validate required field
    if (!form.name?.trim()) {
      toast.error("College name is required");
      return;
    }

    try {
      const payload = {
        code: form.code?.trim() || undefined,
        name: form.name.trim(),
        admission_number: Number(form.admission_number) || 10000,
        address: form.address?.trim() || undefined,
        website: form.website?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        affiliation: form.affiliation?.trim() || undefined,
        approved_by: form.approved_by?.trim() || undefined,
        status: 1, // Active by default
      };

      await createCollege(payload);
      setForm(getEmptyForm());
      setFormErrors({});
      setIsAddOpen(false);
      invalidateColleges();
      toast.success("College created successfully!");
    } catch (error: unknown) {
      const errorMessage =
        error &&
          typeof error === "object" &&
          "response" in error &&
          error.response &&
          typeof error.response === "object" &&
          "data" in error.response &&
          error.response.data &&
          typeof error.response.data === "object" &&
          "error" in error.response.data &&
          error.response.data.error &&
          typeof error.response.data.error === "object" &&
          "message" in error.response.data.error
          ? (error.response.data.error.message as string)
          : error instanceof Error
            ? error.message
            : "Failed to create college. Please try again.";
      toast.error(errorMessage);
      console.error("Create college error:", error);
    }
  }

  async function onUpdate() {
    // Clear previous errors
    setEditFormErrors({});

    // Validate all fields for edit form
    const errors: typeof formErrors = {};
    Object.keys(editForm).forEach((key) => {
      if (key !== "id" && key !== "status") {
        const raw = editForm[key as keyof typeof editForm] as unknown;
        const error = validateField(key, String(raw ?? ""));
        if (error) errors[key as keyof typeof formErrors] = error;
      }
    });

    // Check for validation errors
    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      toast.error("Please fix the form errors before submitting");
      return;
    }

    // Validate required field
    if (!editForm.name?.trim()) {
      toast.error("College name is required");
      return;
    }

    try {
      const payload = {
        code: editForm.code?.trim() || undefined,
        name: editForm.name.trim(),
        admission_number: Number(editForm.admission_number) || undefined,
        address: editForm.address?.trim() || undefined,
        website: editForm.website?.trim() || undefined,
        email: editForm.email?.trim() || undefined,
        phone: editForm.phone?.trim() || undefined,
        affiliation: editForm.affiliation?.trim() || undefined,
        approved_by: editForm.approved_by?.trim() || undefined,
        status: editForm.status,
      };

      await updateCollege(editForm.id, payload);
      setIsEditOpen(false);
      setEditForm(getEmptyEditForm());
      setEditFormErrors({});
      invalidateColleges();
      toast.success("College updated successfully!");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update college. Please try again.";
      toast.error(errorMessage);
      console.error("Update college error:", error);
    }
  }

  async function onDelete(id: string, name: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Delete College",
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      action: async () => {
        try {
          await deleteCollege(id);
          invalidateColleges();
          toast.success(`College "${name}" deleted successfully`);
        } catch (error) {
          toast.error("Failed to delete college. Please try again.");
          console.error("Delete college error:", error);
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  }

  async function onToggleStatus(id: string, currentStatus: number) {
    try {
      await updateCollege(id, { status: currentStatus === 1 ? 0 : 1 });
      invalidateColleges();
      toast.success(
        `College ${currentStatus === 1 ? "disabled" : "enabled"} successfully`
      );
    } catch (error) {
      toast.error("Failed to update college status. Please try again.");
      console.error("Toggle status error:", error);
    }
  }

  function openEdit(college: College) {
    setEditForm({
      id: college.id,
      code: college.code || "",
      name: college.name,
      admission_number: college.admission_number ?? 10000,
      address: college.address || "",
      website: college.website || "",
      email: college.email || "",
      phone: college.phone || "",
      affiliation: college.affiliation || "",
      approved_by: college.approved_by || "",
      status: college.status,
    });
    setIsEditOpen(true);
  }

  // if (!isHydrated || loading) {
  //   return (
  //     <Card className="p-6">
  //       <div className="text-center py-8">Loading colleges...</div>
  //     </Card>
  //   );
  // }

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
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
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
              className="w-full h-9"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Add New College Section */}
      <div className="flex items-center justify-between">

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
                <TableHead>Contact</TableHead>
                <TableHead>Affiliation</TableHead>
                <TableHead className="text-right">Next Admission No.</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell>
                    <div>
                      <div className="font-medium">{college.name}</div>
                      {college.address && (
                        <div className="text-xs text-muted-foreground truncate max-w-48">
                          📍 {college.address}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {college.email && (
                        <div className="text-xs">✉️ {college.email}</div>
                      )}
                      {college.phone && (
                        <div className="text-xs">📞 {college.phone}</div>
                      )}
                      {college.website && (
                        <div className="text-xs truncate max-w-32">
                          🌐{" "}
                          <a
                            href={college.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {college.website.replace(/^https?:\/\//, "")}
                          </a>
                        </div>
                      )}
                      {!college.email && !college.phone && !college.website && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {college.affiliation && (
                        <div className="text-xs">🎓 {college.affiliation}</div>
                      )}
                      {college.approved_by && (
                        <div className="text-xs">✅ {college.approved_by}</div>
                      )}
                      {!college.affiliation && !college.approved_by && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {college.admission_number?.toString() ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={college.status === 1 ? "default" : "secondary"}
                    >
                      {college.status === 1 ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex justify-end gap-2">
                        {/* Edit */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(college)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>

                        {/* Enable/Disable */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onToggleStatus(college.id, college.status)}
                            >
                              {college.status === 1 ? (
                                <ToggleLeft className="h-4 w-4" />
                              ) : (
                                <ToggleRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {college.status === 1 ? "Disable" : "Enable"}
                          </TooltipContent>
                        </Tooltip>

                        {/* Delete */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => onDelete(college.id, college.name)}
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
            setForm(getEmptyForm());
            setFormErrors({});
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New College</DialogTitle>
            <DialogDescription>
              Create a new college/institution in the system with complete
              details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Basic Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    College Code
                  </label>
                  <Input
                    placeholder="e.g., AIMT, MIT, IIT"
                    value={form.code}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      setForm({ ...form, code: value });
                      // Real-time validation
                      const error = validateField("code", value);
                      setFormErrors((prev) => ({ ...prev, code: error }));
                    }}
                    maxLength={50}
                    className={formErrors.code ? "border-red-500" : ""}
                  />
                  {formErrors.code && (
                    <div className="text-xs text-red-500">
                      {formErrors.code}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Optional short code (max 50 characters)
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    College Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Full college name"
                    value={form.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm({ ...form, name: value });
                      // Real-time validation
                      const error = validateField("name", value);
                      setFormErrors((prev) => ({ ...prev, name: error }));
                    }}
                    maxLength={200}
                    className={formErrors.name ? "border-red-500" : ""}
                  />
                  {formErrors.name && (
                    <div className="text-xs text-red-500">
                      {formErrors.name}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Full institution name (max 200 characters)
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
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm({ ...form, admission_number: Number(value) });
                      const err = validateField("admission_number", value);
                      setFormErrors((prev) => ({
                        ...prev,
                        admission_number: err,
                      }));
                    }}
                    min={1}
                  />
                  {formErrors.admission_number && (
                    <div className="text-xs text-red-500">
                      {formErrors.admission_number}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Used to auto-generate admission IDs for this college.
                    Default is 10000.
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Contact Information
              </h4>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Address
                  </label>
                  <Input
                    placeholder="Complete address of the institution"
                    value={form.address}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm({ ...form, address: value });
                      // Real-time validation
                      const error = validateField("address", value);
                      setFormErrors((prev) => ({ ...prev, address: error }));
                    }}
                    maxLength={500}
                    className={formErrors.address ? "border-red-500" : ""}
                  />
                  {formErrors.address && (
                    <div className="text-xs text-red-500">
                      {formErrors.address}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Full address (max 500 characters)
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Email
                    </label>
                    <Input
                      type="email"
                      placeholder="contact@college.edu"
                      value={form.email}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm({ ...form, email: value });
                        // Real-time validation
                        const error = validateField("email", value);
                        setFormErrors((prev) => ({ ...prev, email: error }));
                      }}
                      maxLength={100}
                      className={formErrors.email ? "border-red-500" : ""}
                    />
                    {formErrors.email && (
                      <div className="text-xs text-red-500">
                        {formErrors.email}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Official email address
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Phone
                    </label>
                    <Input
                      placeholder="+91-XXXXXXXXXX"
                      value={form.phone}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm({ ...form, phone: value });
                        // Real-time validation
                        const error = validateField("phone", value);
                        setFormErrors((prev) => ({ ...prev, phone: error }));
                      }}
                      maxLength={20}
                      className={formErrors.phone ? "border-red-500" : ""}
                    />
                    {formErrors.phone && (
                      <div className="text-xs text-red-500">
                        {formErrors.phone}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Contact phone number
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Website
                  </label>
                  <Input
                    placeholder="https://www.college.edu"
                    value={form.website}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm({ ...form, website: value });
                      // Real-time validation
                      const error = validateField("website", value);
                      setFormErrors((prev) => ({ ...prev, website: error }));
                    }}
                    maxLength={200}
                    className={formErrors.website ? "border-red-500" : ""}
                  />
                  {formErrors.website && (
                    <div className="text-xs text-red-500">
                      {formErrors.website}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Official website URL
                  </div>
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Academic Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Affiliation
                  </label>
                  <Input
                    placeholder="e.g., University of XYZ, AICTE"
                    value={form.affiliation}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm({ ...form, affiliation: value });
                      // Real-time validation
                      const error = validateField("affiliation", value);
                      setFormErrors((prev) => ({
                        ...prev,
                        affiliation: error,
                      }));
                    }}
                    maxLength={200}
                    className={formErrors.affiliation ? "border-red-500" : ""}
                  />
                  {formErrors.affiliation && (
                    <div className="text-xs text-red-500">
                      {formErrors.affiliation}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    University or board affiliation
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Approved By
                  </label>
                  <Input
                    placeholder="e.g., AICTE, UGC, State Govt"
                    value={form.approved_by}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm({ ...form, approved_by: value });
                      // Real-time validation
                      const error = validateField("approved_by", value);
                      setFormErrors((prev) => ({
                        ...prev,
                        approved_by: error,
                      }));
                    }}
                    maxLength={100}
                    className={formErrors.approved_by ? "border-red-500" : ""}
                  />
                  {formErrors.approved_by && (
                    <div className="text-xs text-red-500">
                      {formErrors.approved_by}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Regulatory approval authority
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            {form.name && (
              <div className="p-4 bg-muted/30 rounded-lg border">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Preview:
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
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
                  {form.address && (
                    <div className="text-xs text-muted-foreground">
                      📍 {form.address}
                    </div>
                  )}
                  {(form.email || form.phone) && (
                    <div className="text-xs text-muted-foreground flex gap-4">
                      {form.email && <span>✉️ {form.email}</span>}
                      {form.phone && <span>📞 {form.phone}</span>}
                    </div>
                  )}
                  {form.website && (
                    <div className="text-xs text-muted-foreground">
                      🌐 {form.website}
                    </div>
                  )}
                  {(form.affiliation || form.approved_by) && (
                    <div className="text-xs text-muted-foreground flex gap-4">
                      {form.affiliation && (
                        <span>🎓 Affiliated: {form.affiliation}</span>
                      )}
                      {form.approved_by && (
                        <span>✅ Approved: {form.approved_by}</span>
                      )}
                    </div>
                  )}
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
                setFormErrors({});
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={
                !(form.name && form.name.trim()) ||
                Object.keys(formErrors).some(
                  (key) => formErrors[key as keyof typeof formErrors]
                )
              }
            >
              Create College
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit College</DialogTitle>
            <DialogDescription>
              Update the college information and details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Basic Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    College Code
                  </label>
                  <Input
                    placeholder="e.g., AIMT, MIT, IIT"
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
                    placeholder="Full college name"
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
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditForm({
                        ...editForm,
                        admission_number: Number(val),
                      });
                      const err = validateField("admission_number", val);
                      setEditFormErrors((prev) => ({
                        ...prev,
                        admission_number: err,
                      }));
                    }}
                    min={1}
                  />
                  {editFormErrors.admission_number && (
                    <div className="text-xs text-red-500">
                      {editFormErrors.admission_number}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Updating this will change the next assigned admission
                    number.
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Contact Information
              </h4>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Address
                  </label>
                  <Input
                    placeholder="Complete address"
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm({ ...editForm, address: e.target.value })
                    }
                    maxLength={500}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Email
                    </label>
                    <Input
                      type="email"
                      placeholder="contact@college.edu"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      maxLength={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Phone
                    </label>
                    <Input
                      placeholder="+91-XXXXXXXXXX"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm({ ...editForm, phone: e.target.value })
                      }
                      maxLength={20}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Website
                  </label>
                  <Input
                    placeholder="https://www.college.edu"
                    value={editForm.website}
                    onChange={(e) =>
                      setEditForm({ ...editForm, website: e.target.value })
                    }
                    maxLength={200}
                  />
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Academic Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Affiliation
                  </label>
                  <Input
                    placeholder="e.g., University of XYZ, AICTE"
                    value={editForm.affiliation}
                    onChange={(e) =>
                      setEditForm({ ...editForm, affiliation: e.target.value })
                    }
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Approved By
                  </label>
                  <Input
                    placeholder="e.g., AICTE, UGC, State Govt"
                    value={editForm.approved_by}
                    onChange={(e) =>
                      setEditForm({ ...editForm, approved_by: e.target.value })
                    }
                    maxLength={100}
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                Status
              </h4>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  College Status
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

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.message}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
              }
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDialog.action}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
