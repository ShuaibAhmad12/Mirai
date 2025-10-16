"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useStudentProfileStore } from "@/hooks/use-student-profile";
import { EditableFeeCell } from "./EditableFeeCell";
import { FeeOverridesSection } from "./FeeOverridesSection";
import {
  Edit,
  User,
  GraduationCap,
  DollarSign,
  BookOpen,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Receipt,
  MoreHorizontal,
  Printer,
  Eye,
  Download,
  Share2,
  Copy,
  Calculator,
} from "lucide-react";
import { useReactToPrint } from "react-to-print";

import ReceiptPrint, {
  ReceiptPrintData,
} from "@/components/receipts/ReceiptPrint";
import { CollectPaymentDialog } from "@/components/fees/collect-payment/CollectPaymentDialog";
import { useAcademicStore } from "@/lib/stores/academic-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdjustmentsSection } from "./AdjustmentsSection";

import { UnsavedChangesBar } from "./UnsavedChangesBar";
import { set, get } from "lodash";

// Helper functions to manage state changes
function isObject(item: any) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

function mergeDeep(target: any, ...sources: any[]): any {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  return mergeDeep(target, ...sources);
}

// SIMPLIFIED EDITABLE FIELD COMPONENT
// This component no longer handles saving. It only reports changes to its parent.
interface EditableFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}

function EditableField({ label, value, onValueChange }: EditableFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);

  React.useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleCommit = () => {
    if (editValue !== value) {
      onValueChange(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-3 border rounded-lg">
        <div className="text-xs text-muted-foreground mb-2">{label}</div>
        <div className="flex gap-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommit();
              if (e.key === 'Escape') handleCancel();
            }}
            className="h-8 text-sm font-mono"
          />
          <Button size="sm" onClick={handleCommit} className="h-8">
            <CheckCircle className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            className="h-8"
          >
            <XCircle className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group p-3 border rounded-lg cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-mono text-sm flex items-center justify-between">
        {value || "-"}
        <Edit className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

// This component is for creating new notes, which is an immediate action.
interface AddNoteFieldProps {
  onSave: (note: string) => void;
}
function AddNoteField({ onSave }: AddNoteFieldProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (!noteText.trim()) return;
    setIsSaving(true);
    try {
      await onSave(noteText);
      setNoteText("");
      setIsAdding(false);
    } catch (error) {
      console.error("Failed to save note:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNoteText("");
    setIsAdding(false);
  };

  if (isAdding) {
    return (
      <div className="p-4 border rounded-lg">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Enter your note here..."
          className="w-full min-h-[100px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          disabled={isSaving}
        />
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={handleSave} disabled={isSaving || !noteText.trim()}>
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            Save Note
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
            <XCircle className="h-3 w-3" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button variant="outline" onClick={() => setIsAdding(true)} className="w-full">
      Add New Note
    </Button>
  );
}

// Row actions: print via react-to-print + menu items.
type ReceiptRowData = {
  id: string | number;
  receipt_number: string | number;
  receipt_date: string | Date;
  academic_year?: string | null;
  payment_method?: string | null;
  remarks?: string | null;
  paid_amount?: number;
  components_arr?: Array<{
    component_name?: string;
    allocated_amount?: number;
    component_code?: string;
  }>;
  details: Array<{
    code?: string | null;
    name?: string | null;
    paid?: number | null;
    balance?: number | null;
  }>;
  logoUrl?: string;
  college?: {
    name?: string | null;
    code?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    affiliation?: string | null;
    approvedBy?: string | null;
    affiliationWebsite?: string | null;
  };
  student?: {
    name?: string | null;
    fatherName?: string | null;
    motherName?: string | null;
    enrollmentCode?: string | null;
    courseName?: string | null;
    sessionTitle?: string | null;
    currentYear?: number | string | null;
  };
};

function RowPrintMenu({
  data,
  onEditReceipt,
}: {
  data: ReceiptRowData;
  onEditReceipt?: (receiptData: {
    id: string;
    receipt_number: string;
    receipt_date: string;
    academic_year?: string;
    payment_method: string;
    remarks: string;
    paid_amount: number;
    components: Array<{
      component_code?: string;
      component_name?: string;
      allocated_amount?: number;
    }>;
  }) => void;
}) {
  const printRef = React.useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `receipt-${data.receipt_number}`,
  });

  const getCollegeByCode = useAcademicStore((s) => s.getCollegeByCode);
  const colleges = useAcademicStore((s) => s.colleges);
  const loadColleges = useAcademicStore((s) => s.loadColleges);
  React.useEffect(() => {
    if (!colleges || colleges.length === 0) {
      loadColleges().catch(() => { });
    }
  }, [colleges, loadColleges]);

  const enrichedCollege = React.useMemo(() => {
    const fromRow = data.college || {};
    const code = fromRow.code || undefined;
    const storeCollege = code ? getCollegeByCode(code) : undefined;
    if (!storeCollege) return fromRow;
    return {
      name: storeCollege.name ?? fromRow.name,
      code: storeCollege.code ?? code,
      address: storeCollege.address ?? fromRow.address ?? undefined,
      phone: storeCollege.phone ?? fromRow.phone ?? undefined,
      email: storeCollege.email ?? fromRow.email ?? undefined,
      website: storeCollege.website ?? fromRow.website ?? undefined,
      affiliation: storeCollege.affiliation ?? fromRow.affiliation ?? undefined,
      approvedBy: storeCollege.approved_by ?? fromRow.approvedBy ?? undefined,
      affiliationWebsite: fromRow.affiliationWebsite ?? undefined,
    };
  }, [data.college, getCollegeByCode]);

  const printData: ReceiptPrintData = {
    receipt_number: data.receipt_number,
    receipt_date: data.receipt_date,
    academic_year: data.academic_year ?? undefined,
    payment_method: data.payment_method ?? undefined,
    remarks: data.remarks ?? undefined,
    details: (data.details || []).map((d) => ({
      code: d.code ?? null,
      name: (d.name ?? d.code ?? "Component") as string,
      paid: d.paid ?? 0,
      balance: d.balance ?? 0,
    })),
    logoUrl: data.logoUrl,
    college: enrichedCollege,
    student: data.student,
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>
            <Eye className="h-4 w-4" />
            View receipt
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              if (onEditReceipt) {
                onEditReceipt({
                  id: String(data.id),
                  receipt_number: String(data.receipt_number),
                  receipt_date:
                    data.receipt_date instanceof Date
                      ? data.receipt_date.toISOString().split("T")[0]
                      : String(data.receipt_date),
                  academic_year: data.academic_year || undefined,
                  payment_method: data.payment_method ?? "CASH",
                  remarks: data.remarks ?? "",
                  paid_amount: data.paid_amount || 0,
                  components: (data.components_arr || []).map((comp) => ({
                    component_code: comp.component_code,
                    component_name: comp.component_name,
                    allocated_amount: comp.allocated_amount,
                  })),
                });
              }
            }}
          >
            <Edit className="h-4 w-4" />
            Edit receipt
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handlePrint?.();
            }}
          >
            <Printer className="h-4 w-4" />
            Print receipt
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Download className="h-4 w-4" />
            Download PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Share2 className="h-4 w-4" />
            Share link
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy className="h-4 w-4" />
            Copy receipt #
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="sr-only">
        <ReceiptPrint ref={printRef} data={printData} />
      </div>
    </>
  );
}

interface StudentProfileProps {
  studentId: string;
}

export function StudentProfile({ studentId }: StudentProfileProps) {
  const {
    overview, academic, fees, contact, documents, internalRefs, notes,
    isLoadingOverview, isLoadingAcademic, isLoadingFees, isLoadingContact,
    isLoadingDocuments, isLoadingInternalRefs, isLoadingNotes,
    overviewError, academicError, feesError, contactError, documentsError,
    internalRefsError, notesError,
    loadOverview, loadAcademic, loadFees, loadContact, loadDocuments,
    loadInternalRefs, loadNotes, setCurrentStudent,
  } = useStudentProfileStore();

  const [activeTab, setActiveTab] = React.useState("overview");
  const [editReceiptDialogOpen, setEditReceiptDialogOpen] = React.useState(false);
  const [editReceiptData, setEditReceiptData] = React.useState<any | null>(null);

  // UNIFIED STATE MANAGEMENT SYSTEM
  const [draft, setDraft] = React.useState<Record<string, any>>({});
  const [isSavingAll, setIsSavingAll] = React.useState(false);
  const hasUnsavedChanges = Object.keys(draft).length > 0;

  const handleDraftChange = (path: string, value: any) => {
    const newDraft = { ...draft };
    set(newDraft, path, value);
    setDraft(newDraft);
  };

  const displayData = React.useMemo(() => {
    const baseData = JSON.parse(JSON.stringify({ overview, academic, contact, documents, internalRefs, notes }));
    return mergeDeep(baseData, draft);
  }, [overview, academic, contact, documents, internalRefs, notes, draft]);


  // THE NEW MASTER SAVE HANDLER
  const handleSaveChanges = async () => {
    setIsSavingAll(true);
    const apiCalls: Promise<Response>[] = [];

    if (get(draft, 'overview.profile')) {
      apiCalls.push(fetch(`/api/students/${studentId}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(get(draft, 'overview.profile')) }));
    }
    if (get(draft, 'overview.current_enrollment')) {
      apiCalls.push(fetch(`/api/students/${studentId}/enrollment`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(get(draft, 'overview.current_enrollment')) }));
    }
    if (get(draft, 'contact')) {
      apiCalls.push(fetch(`/api/students/${studentId}/contact`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(get(draft, 'contact')) }));
    }
    if (get(draft, 'documents.documents')) {
      const changedDocs = get(draft, 'documents.documents', []).filter((doc: any) => doc && doc.doc_number);
      changedDocs.forEach((doc: any) => {
        const originalDoc = documents?.documents?.find(d => d.id === doc.id);
        if (originalDoc && originalDoc.doc_number !== doc.doc_number) {
          apiCalls.push(fetch(`/api/students/${studentId}/documents/${doc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc_number: doc.doc_number }) }));
        }
      });
    }
    if (get(draft, 'internalRefs')) {
      const refsPayload = { refs: [] as { ref_group: string, slot_number: number, raw_value: string }[] };
      const draftRefs = get(draft, 'internalRefs');
      if (draftRefs.cards) {
        draftRefs.cards.forEach((card: { raw_value: string }, index: number) => {
          if (card && typeof card.raw_value !== 'undefined') {
            refsPayload.refs.push({ ref_group: 'card', slot_number: index + 1, raw_value: card.raw_value });
          }
        });
      }
      if (draftRefs.enos) {
        draftRefs.enos.forEach((eno: { raw_value: string }, index: number) => {
          if (eno && typeof eno.raw_value !== 'undefined') {
            refsPayload.refs.push({ ref_group: 'eno', slot_number: index + 1, raw_value: eno.raw_value });
          }
        });
      }
      if (refsPayload.refs.length > 0) {
        apiCalls.push(fetch(`/api/students/${studentId}/internal-refs`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(refsPayload) }));
      }
    }
    if (get(draft, 'academic')) {
      apiCalls.push(fetch(`/api/students/${studentId}/academic`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(get(draft, 'academic')) }));
    }

    try {
      const responses = await Promise.all(apiCalls);
      for (const res of responses) {
        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`API update failed: ${res.status} - ${errorBody}`);
        }
      }
      setDraft({});
      await Promise.all([
        loadOverview(studentId), loadContact(studentId), loadAcademic(studentId),
        loadInternalRefs(studentId), loadDocuments(studentId)
      ]);
    } catch (error) {
      console.error("Failed to save changes:", error);
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDiscardChanges = () => {
    setDraft({});
  };

  React.useEffect(() => {
    setCurrentStudent(studentId);
    loadOverview(studentId);
  }, [studentId, setCurrentStudent, loadOverview]);

  React.useEffect(() => {
    switch (activeTab) {
      case "academic": if (!academic && !isLoadingAcademic) loadAcademic(studentId); break;
      case "fees": if (!fees && !isLoadingFees) loadFees(studentId); break;
      case "contact": if (!contact && !isLoadingContact) loadContact(studentId); break;
      case "documents": if (!documents && !isLoadingDocuments) loadDocuments(studentId); break;
      case "internal-refs": if (!internalRefs && !isLoadingInternalRefs) loadInternalRefs(studentId); break;
      case "notes": if (!notes && !isLoadingNotes) loadNotes(studentId); break;
    }
  }, [activeTab, studentId, academic, fees, contact, documents, internalRefs, notes, isLoadingAcademic, isLoadingFees, isLoadingContact, isLoadingDocuments, isLoadingInternalRefs, isLoadingNotes, loadAcademic, loadFees, loadContact, loadDocuments, loadInternalRefs, loadNotes]);

  const handleAddNote = async (noteText: string) => {
    try {
      const response = await fetch(`/api/students/${studentId}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText, created_by: "Current User" }),
      });
      if (!response.ok) throw new Error("Failed to add note");
      loadNotes(studentId);
    } catch (error) {
      console.error("Error adding note:", error);
      throw error;
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: "default" as const, label: "Active", icon: CheckCircle },
      suspended: { variant: "destructive" as const, label: "Suspended", icon: XCircle },
      withdrawn: { variant: "secondary" as const, label: "Withdrawn", icon: AlertCircle },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const LoadingCard = ({ title }: { title: string }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading {title}...
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (<div key={i} className="h-4 bg-muted rounded animate-pulse" />))}
        </div>
      </CardContent>
    </Card>
  );

  const ErrorCard = ({ title, error, onRetry }: { title: string; error: string; onRetry: () => void; }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          Error Loading {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={onRetry} variant="outline" size="sm"> Try Again </Button>
      </CardContent>
    </Card>
  );


  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {isLoadingOverview ? (
            <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
          ) : overview ? (
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {overview.student.full_name.split(" ").map((n: string) => n[0]).join("")}
            </div>
          ) : (
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          <div className="space-y-1">
            {isLoadingOverview ? (
              <>
                <div className="h-8 w-48 bg-muted rounded animate-pulse" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-4 w-40 bg-muted rounded animate-pulse" />
              </>
            ) : overview ? (
              <>
                <h1 className="text-3xl font-bold">{overview.student.full_name}</h1>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted-foreground">{overview.student.enrollment_code}</span>
                  {getStatusBadge(overview.student.status)}
                </div>
                <p className="text-muted-foreground">
                  {overview.current_enrollment?.course_name} • Year {overview.current_enrollment?.current_year}
                </p>
              </>
            ) : overviewError ? (
              <div className="space-y-1">
                <h1 className="text-3xl font-bold text-muted-foreground">Student Profile</h1>
                <p className="text-sm text-destructive">{overviewError}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {hasUnsavedChanges && (
        <UnsavedChangesBar
          onSave={handleSaveChanges}
          onDiscard={handleDiscardChanges}
          isSaving={isSavingAll}
        />
      )}

      <Tabs defaultValue="overview" className="space-y-6" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-fit">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="internal-refs">Internal Refs</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {isLoadingOverview ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <LoadingCard title="Personal Information" />
              <LoadingCard title="Quick Stats" />
            </div>
          ) : overviewError ? (
            <ErrorCard title="Overview" error={overviewError} onRetry={() => loadOverview(studentId)} />
          ) : overview ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <EditableField label="Father's Name" value={get(displayData, 'overview.profile.father_name', '')} onValueChange={(value) => handleDraftChange('overview.profile.father_name', value)} />
                      <EditableField label="Mother's Name" value={get(displayData, 'overview.profile.mother_name', '')} onValueChange={(value) => handleDraftChange('overview.profile.mother_name', value)} />
                      <EditableField label="Date of Birth" value={get(displayData, 'overview.profile.dob', '')} onValueChange={(value) => handleDraftChange('overview.profile.dob', value)} />
                      <EditableField label="Gender" value={get(displayData, 'overview.profile.gender', '')} onValueChange={(value) => handleDraftChange('overview.profile.gender', value)} />
                      <EditableField label="Category" value={get(displayData, 'overview.profile.category', '')} onValueChange={(value) => handleDraftChange('overview.profile.category', value)} />
                      <EditableField label="Nationality" value={get(displayData, 'overview.profile.nationality', '')} onValueChange={(value) => handleDraftChange('overview.profile.nationality', value)} />
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-6">
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Fee Status</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Outstanding</span>
                          <Badge variant={(overview.quick_stats?.total_outstanding || 0) > 0 ? "destructive" : "default"}>
                            ₹{overview.quick_stats?.total_outstanding?.toLocaleString() || "0"}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Total Paid</span>
                          <span className="font-medium">₹{overview.quick_stats?.total_paid?.toLocaleString() || "0"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" />Academic Status</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm text-muted-foreground">Year</span>
                          <p className="font-medium">{overview.current_enrollment?.current_year} / {overview.current_enrollment?.course_duration}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Entry Type</span>
                          <p className="font-medium capitalize">{overview.current_enrollment?.entry_type || "-"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" />Current Enrollment</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Course</div>
                      <p className="font-mono text-sm">{overview?.current_enrollment?.course_name || "-"}</p>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">College</div>
                      <p className="font-mono text-sm">{overview?.current_enrollment?.college_name || "-"} ({overview?.current_enrollment?.college_code || "-"})</p>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Session</div>
                      <p className="font-mono text-sm">{overview?.current_enrollment?.session_title || "-"}</p>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Enrollment Date</div>
                      <p className="font-mono text-sm">{overview?.current_enrollment?.enrollment_date ? formatDate(overview.current_enrollment.enrollment_date) : "-"}</p>
                    </div>
                    <div className="md:col-span-1">
                      <EditableField
                        label="Joining Date"
                        value={get(displayData, 'overview.current_enrollment.joining_date') ? formatDate(get(displayData, 'overview.current_enrollment.joining_date')) : ""}
                        onValueChange={(value) => handleDraftChange('overview.current_enrollment.joining_date', value)}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Status</div>
                      <div>{getStatusBadge(overview?.current_enrollment?.status || "inactive")}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="academic" className="space-y-6">
          {isLoadingAcademic ? <LoadingCard title="Academic Information" /> : academicError ? <ErrorCard title="Academic Information" error={academicError} onRetry={() => loadAcademic(studentId)} /> : academic ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Academic History</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {academic.academic_history.map((record, index) => (
                    <div key={record.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">Year {record.to_year} - {record.status}</span>
                        <Badge variant="outline">{formatDate(record.effective_date)}</Badge>
                      </div>
                      <EditableField label="Notes" value={get(displayData, `academic.academic_history[${index}].notes`, '')} onValueChange={(value) => handleDraftChange(`academic.academic_history[${index}].notes`, value)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Prior Education</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {academic.prior_education.map((edu, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{edu.level}</span>
                        <EditableField label="Year of Passing" value={get(displayData, `academic.prior_education[${index}].year_of_passing`, '')} onValueChange={(value) => handleDraftChange(`academic.prior_education[${index}].year_of_passing`, value)} />
                      </div>
                      <EditableField label="Board/University" value={get(displayData, `academic.prior_education[${index}].board_university`, '')} onValueChange={(value) => handleDraftChange(`academic.prior_education[${index}].board_university`, value)} />
                      <EditableField label="Marks Percentage" value={get(displayData, `academic.prior_education[${index}].marks_percentage`, '').toString()} onValueChange={(value) => handleDraftChange(`academic.prior_education[${index}].marks_percentage`, value)} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="fees" className="space-y-6">
          {isLoadingFees ? <LoadingCard title="Fee Information" /> : feesError ? <ErrorCard title="Fee Information" error={feesError} onRetry={() => loadFees(studentId)} /> : fees ? (
            <div className="space-y-6">
              {fees.fee_summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(() => {
                    const details = fees.fee_details || [];
                    const totalCourse = details.reduce((sum, d) => sum + (d.amount || 0), 0);
                    const totalPaid = details.reduce((sum, d) => sum + (d.paid_amount || 0), 0);
                    const totalOutstanding = details.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0);
                    const denominator = totalPaid + totalOutstanding;
                    const progressPct = denominator ? Math.round((totalPaid / denominator) * 100) : 0;
                    return (
                      <>
                        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-600">₹{totalCourse.toLocaleString()}</div><p className="text-sm text-muted-foreground">Total Actual Fee</p></CardContent></Card>
                        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString()}</div><p className="text-sm text-muted-foreground">Total Paid</p></CardContent></Card>
                        <Card><CardContent className="p-4 text-center"><div className={`text-2xl font-bold ${totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}>₹{totalOutstanding.toLocaleString()}</div><p className="text-sm text-muted-foreground">Outstanding Balance</p></CardContent></Card>
                        <Card><CardContent className="p-4 text-center"><div className="text-lg font-medium text-slate-600">{totalOutstanding === 0 ? "✅" : `${progressPct}%`}</div><p className="text-sm text-muted-foreground">{totalOutstanding === 0 ? "Fully Paid" : "Paid Progress"}</p></CardContent></Card>
                      </>
                    );
                  })()}
                </div>
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Fee Structure Overview</CardTitle>
                  <p className="text-sm text-muted-foreground">Detailed breakdown showing original course fees, any discounts applied, payments made, and outstanding balance for each component</p>
                </CardHeader>
                <CardContent>
                  {fees.fee_details && fees.fee_details.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-200 rounded-lg">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">Fee Component</th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700">Course Fee</th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700">Actual Fee</th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700">Discount</th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700">Amount Paid</th>
                            <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700">Balance Due</th>
                            <th className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fees.fee_details.map((detail, index) => {
                            const courseFee = detail.original_amount || 0;
                            const actualFee = detail.amount || 0;
                            const paidAmount = detail.paid_amount || 0;
                            const isLateralEntryYear1Waiver = overview?.current_enrollment?.entry_type === "lateral" && detail.year_number === 1 && (detail.component_code === "TUITION" || detail.component_code === "ADMISSION");
                            const discount = isLateralEntryYear1Waiver ? 0 : Math.max(0, courseFee - actualFee);
                            const balanceDue = detail.outstanding_amount || 0;
                            const isFullyPaid = balanceDue === 0;
                            const yearNumber = detail.year_number || 0;
                            const currentYear = overview?.current_enrollment?.current_year || 1;
                            let status = "Due";
                            let statusVariant: "default" | "destructive" | "secondary" = "destructive";
                            if (yearNumber > currentYear) { status = "Pending"; statusVariant = "secondary"; }
                            else if (isFullyPaid) { status = "Paid"; statusVariant = "default"; }
                            else { status = "Due"; statusVariant = "destructive"; }
                            return (
                              <tr key={index} className="hover:bg-gray-50 transition-colors">
                                <td className="border border-gray-200 px-4 py-3">
                                  <div className="space-y-1">
                                    <div className="font-medium text-gray-900">{detail.component_name}</div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <Badge variant="outline" className="text-xs">{detail.component_code}</Badge>
                                      {detail.year_number && <span>Year {detail.year_number}</span>}
                                    </div>
                                  </div>
                                </td>
                                <td className="border border-gray-200 px-4 py-3 text-right text-sm font-mono">₹{courseFee.toLocaleString()}</td>
                                <td className="border border-gray-200 px-4 py-3 text-right">
                                  <EditableFeeCell studentId={studentId} feePlanItemId={detail.fee_plan_item_id || ""} yearNumber={yearNumber} componentCode={detail.component_code || ""} currentAmount={actualFee} paidAmount={paidAmount} />
                                </td>
                                <td className="border border-gray-200 px-4 py-3 text-right text-sm font-mono">{discount > 0 ? (<span className="text-green-600 font-medium">-₹{discount.toLocaleString()}</span>) : (<span className="text-gray-400">₹0</span>)}</td>
                                <td className="border border-gray-200 px-4 py-3 text-right text-sm font-mono"><span className="text-green-600 font-medium">₹{paidAmount.toLocaleString()}</span></td>
                                <td className="border border-gray-200 px-4 py-3 text-right text-sm font-mono">{balanceDue > 0 ? (<span className="font-semibold text-red-600">₹{balanceDue.toLocaleString()}</span>) : (<span className="font-semibold text-green-600">₹0</span>)}</td>
                                <td className="border border-gray-200 px-4 py-3 text-center"><Badge variant={statusVariant} className="text-xs">{status}</Badge></td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {fees.fee_details && fees.fee_details.length > 0 && (
                          <tfoot>
                            <tr className="bg-gray-100 font-semibold">
                              <td className="border border-gray-200 px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                              <td className="border border-gray-200 px-4 py-3 text-right text-sm font-mono">₹{fees.fee_details.reduce((sum, d) => sum + (d.original_amount || 0), 0).toLocaleString()}</td>
                              <td className="border border-gray-200 px-4 py-3 text-right text-sm font-mono">₹{fees.fee_details.reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString()}</td>
                              <td className="border border-gray-200 px-4 py-3 text-right text-sm font-mono text-green-600">{(() => { const course = fees.fee_details.reduce((sum, d) => sum + (d.original_amount || 0), 0); const actual = fees.fee_details.reduce((sum, d) => sum + (d.amount || 0), 0); const disc = Math.max(0, course - actual); return disc === 0 ? "-₹0" : `-₹${disc.toLocaleString()}`; })()}</td>
                              <td className="border border-gray-200 px-4 py-3 text-right text-sm font-mono text-green-600">₹{fees.fee_details.reduce((sum, d) => sum + (d.paid_amount || 0), 0).toLocaleString()}</td>
                              <td className="border border-gray-200 px-4 py-3 text-right text-sm font-mono"><span className={`font-bold ${fees.fee_details.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0) > 0 ? "text-red-600" : "text-green-600"}`}>₹{fees.fee_details.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0).toLocaleString()}</span></td>
                              <td className="border border-gray-200 px-4 py-3 text-center"><Badge variant={fees.fee_details.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0) === 0 ? "default" : "destructive"} className="text-xs">{fees.fee_details.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0) === 0 ? "Complete" : "Pending"}</Badge></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500"><DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p className="text-lg font-medium mb-2">No Fee Structure Found</p><p className="text-sm">Fee details will appear here once the student is enrolled and fee structure is configured.</p></div>
                  )}
                  {fees.fee_summary?.fee_plan_name && (
                    <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                      <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-600" /><span className="text-sm font-medium text-blue-800">Fee Plan: {fees.fee_summary.fee_plan_name}</span></div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Fee Transactions History</CardTitle>
                  <p className="text-sm text-muted-foreground">Complete history of payments, receipts, and fee adjustments</p>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="receipts" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="receipts" className="flex items-center gap-2"><Receipt className="h-4 w-4" />Payment Receipts</TabsTrigger>
                      <TabsTrigger value="adjustments" className="flex items-center gap-2"><Calculator className="h-4 w-4" />Fee Adjustments</TabsTrigger>
                      <TabsTrigger value="overrides" className="flex items-center gap-2"><Edit className="h-4 w-4" />Fee Overrides</TabsTrigger>
                    </TabsList>
                    <TabsContent value="receipts" className="mt-4">
                      {(() => {
                        type PaidComponent = { component_name?: string; allocated_amount?: number; component_code?: string; };
                        type BalanceItem = { component_name?: string; component_balance?: number; component_code?: string; };
                        type FeeDetailRow = { code?: string; name?: string; paid: number; balance: number; };
                        type ReceiptRow = { id: string; receipt_number: string; receipt_date: string; academic_year: string; payment_method: string; status: string; paid_amount: number; balance_total: number | null; components_arr: PaidComponent[]; balances_arr: BalanceItem[]; details: FeeDetailRow[]; remarks: string; payment_reference: string; };
                        const rows: ReceiptRow[] =
                          fees.detailed_receipts && fees.detailed_receipts.length ? fees.detailed_receipts.map((r) => {
                            const balanceFromRecords = (r as { all_component_balances?: Array<{ component_balance?: number; }>; }).all_component_balances?.reduce((sum, b) => sum + (b.component_balance || 0), 0);
                            const balance = (typeof balanceFromRecords === "number" ? balanceFromRecords : undefined) ?? (r as { balance_amount?: number }).balance_amount ?? 0;
                            const componentsArr = (r as { components?: Array<{ component_name?: string; allocated_amount?: number; component_code?: string; }>; }).components || [];
                            const balancesArr = (r as { all_component_balances?: Array<{ component_name?: string; component_balance?: number; component_code?: string; }>; }).all_component_balances || [];
                            const mergedDetails: FeeDetailRow[] = (() => {
                              const map = new Map<string, FeeDetailRow>();
                              componentsArr.forEach((c) => {
                                const key = c.component_code || c.component_name || "UNKNOWN";
                                const existing = map.get(key) || { code: c.component_code, name: c.component_name, paid: 0, balance: 0, };
                                existing.paid += c.allocated_amount || 0;
                                map.set(key, existing);
                              });
                              balancesArr.forEach((b) => {
                                const key = b.component_code || b.component_name || "UNKNOWN";
                                const existing = map.get(key) || { code: b.component_code, name: b.component_name, paid: 0, balance: 0, };
                                existing.balance += b.component_balance || 0;
                                map.set(key, existing);
                              });
                              return Array.from(map.values());
                            })();
                            return {
                              id: r.id, receipt_number: r.receipt_number, receipt_date: r.receipt_date, academic_year: r.academic_year, payment_method: r.payment_method, status: r.status, paid_amount: r.paid_amount || 0, balance_total: balance, components_arr: componentsArr, balances_arr: balancesArr, details: mergedDetails, remarks: (r as { remarks?: string }).remarks || "", payment_reference: r.payment_reference ?? "",
                            };
                          }) : (fees.recent_payments || []).map((p) => ({ id: p.id, receipt_number: p.receipt_number, receipt_date: p.receipt_date, academic_year: "-", payment_method: p.payment_method, status: p.status, paid_amount: p.amount, balance_total: null, components_arr: [], balances_arr: [], details: [], remarks: "", payment_reference: "", }));
                        if (!rows || rows.length === 0) { return (<div className="text-center text-muted-foreground py-4">No receipts found</div>); }
                        return (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-200 rounded-lg">
                              <thead>
                                <tr className="bg-gray-50">
                                  <th className="border border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Receipt #</th>
                                  <th className="border border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Date</th>
                                  <th className="border border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Year</th>
                                  <th className="border border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Method</th>
                                  <th className="border border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Fee Details</th>
                                  <th className="border border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">Remarks</th>
                                  <th className="border border-gray-200 px-2 py-3 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="[&>tr:nth-child(even)]:bg-muted/30">
                                {rows.map((r) => (
                                  <tr key={r.id} className="hover:bg-gray-50 align-top">
                                    <td className="border border-gray-200 px-4 py-3 font-mono text-slate-800">#{r.receipt_number}</td>
                                    <td className="border border-gray-200 px-4 py-3 text-sm text-slate-700">{formatDate(r.receipt_date)}</td>
                                    <td className="border border-gray-200 px-4 py-3 text-sm text-slate-700">{r.academic_year || "-"}</td>
                                    <td className="border border-gray-200 px-4 py-3 text-sm"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs border border-slate-200">{r.payment_method}</span></td>
                                    <td className="border border-gray-200 px-2 py-2 text-sm">
                                      {r.details && r.details.length > 0 ? (
                                        <div className="rounded-md border border-slate-200 bg-white p-2">
                                          <table className="w-full text-sm">
                                            <thead><tr className="text-[10px] text-slate-500"><th className="text-left font-medium pb-1">Component</th><th className="text-right font-medium pb-1">Paid</th><th className="text-right font-medium pb-1">Balance</th></tr></thead>
                                            <tbody className="[&>tr:nth-child(even)]:bg-muted/20">
                                              {r.details.map((d, idx) => (<tr key={idx} className="border-t first:border-t-0 border-slate-100"><td className="py-1 pr-2"><span className="inline-flex items-center gap-2">{d.code && (<span className="px-1.5 py-0.5 rounded border text-[10px] uppercase text-slate-600">{d.code}</span>)}<span className="text-slate-800">{(() => { const raw = (d.name ?? "").trim(); const low = raw.toLowerCase(); const already = low.includes("(reg. fee)"); const isAdmission = low === "admission fee" || low === "admission" || low.includes("admission"); return isAdmission && !already ? `${raw} (Reg. Fee)` : raw || "-"; })()}</span></span></td><td className="py-1 pl-2 text-right font-mono text-green-600">₹{(d.paid || 0).toLocaleString()}</td><td className="py-1 pl-2 text-right font-mono text-red-600">₹{(d.balance || 0).toLocaleString()}</td></tr>))}
                                            </tbody>
                                            <tfoot><tr className="border-t border-slate-200"><td className="pt-2 text-right text-xs text-slate-600 font-medium">Totals</td><td className="pt-2 text-right font-mono text-green-700 font-semibold">₹{r.details.reduce((s, d) => s + (d.paid || 0), 0).toLocaleString()}</td><td className="pt-2 text-right font-mono text-red-700 font-semibold">₹{r.details.reduce((s, d) => s + (d.balance || 0), 0).toLocaleString()}</td></tr></tfoot>
                                          </table>
                                        </div>
                                      ) : (<span className="text-slate-400">-</span>)}
                                    </td>
                                    <td className="border border-gray-200 px-4 py-3 text-sm text-slate-700">{r.remarks || "-"}</td>
                                    <td className="border border-gray-200 px-2 py-2 text-right align-top">
                                      <RowPrintMenu data={{ ...r, student: { name: overview?.student?.full_name || undefined, fatherName: overview?.profile?.father_name || undefined, motherName: overview?.profile?.mother_name || undefined, enrollmentCode: overview?.student?.enrollment_code || undefined, courseName: overview?.current_enrollment?.course_name || undefined, sessionTitle: overview?.current_enrollment?.session_title || undefined, currentYear: overview?.current_enrollment?.current_year ?? undefined, }, college: { name: overview?.current_enrollment?.college_name || undefined, code: overview?.current_enrollment?.college_code || undefined, address: contact?.addresses?.permanent?.address_text || undefined, affiliationWebsite: undefined, }, logoUrl: "/alpine_logo.png", }} onEditReceipt={(receiptData) => { setEditReceiptData(receiptData); setEditReceiptDialogOpen(true); }} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </TabsContent>
                    <TabsContent value="adjustments" className="mt-4"><AdjustmentsSection studentId={studentId} /></TabsContent>
                    <TabsContent value="overrides" className="mt-4"><FeeOverridesSection studentId={studentId} /></TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No fee data available</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          {isLoadingContact ? <LoadingCard title="Contact Information" /> : contactError ? <ErrorCard title="Contact Information" error={contactError} onRetry={() => loadContact(studentId)} /> : contact ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <EditableField label="Phone Number" value={get(displayData, 'contact.contacts[0].value_raw', '')} onValueChange={(value) => handleDraftChange('contact.contacts[0].value_raw', value)} />
                  <EditableField label="Parent Phone" value={get(displayData, 'contact.contacts[1].value_raw', '')} onValueChange={(value) => handleDraftChange('contact.contacts[1].value_raw', value)} />
                  <EditableField label="Guardian Phone" value={get(displayData, 'contact.contacts[2].value_raw', '')} onValueChange={(value) => handleDraftChange('contact.contacts[2].value_raw', value)} />
                  <EditableField label="Email Address" value={get(displayData, 'contact.contacts[3].value_raw', '')} onValueChange={(value) => handleDraftChange('contact.contacts[3].value_raw', value)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Address Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="font-medium">Permanent Address</label>
                    <div className="space-y-2 mt-1">
                      <EditableField label="Address" value={get(displayData, 'contact.addresses.permanent.address_text', '')} onValueChange={(value) => handleDraftChange('contact.addresses.permanent.address_text', value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <EditableField label="State" value={get(displayData, 'contact.addresses.permanent.state', '')} onValueChange={(value) => handleDraftChange('contact.addresses.permanent.state', value)} />
                        <EditableField label="Country" value={get(displayData, 'contact.addresses.permanent.country', '')} onValueChange={(value) => handleDraftChange('contact.addresses.permanent.country', value)} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="font-medium">Correspondence Address</label>
                    <div className="space-y-2 mt-1">
                      <EditableField label="Address" value={get(displayData, 'contact.addresses.correspondence.address_text', '')} onValueChange={(value) => handleDraftChange('contact.addresses.correspondence.address_text', value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <EditableField label="State" value={get(displayData, 'contact.addresses.correspondence.state', '')} onValueChange={(value) => handleDraftChange('contact.addresses.correspondence.state', value)} />
                        <EditableField label="Country" value={get(displayData, 'contact.addresses.correspondence.country', '')} onValueChange={(value) => handleDraftChange('contact.addresses.correspondence.country', value)} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="documents">
          {isLoadingDocuments ? <LoadingCard title="Documents" /> : documentsError ? <ErrorCard title="Documents" error={documentsError} onRetry={() => loadDocuments(studentId)} /> : documents ? (
            <Card>
              <CardHeader><CardTitle>Identity Documents</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.documents?.map((doc, index) => (
                    <div key={doc.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{doc.doc_type}</span>
                        {doc.is_primary && <Badge>Primary</Badge>}
                      </div>
                      <EditableField label="Document Number" value={get(displayData, `documents.documents[${index}].doc_number`, '')} onValueChange={(value) => { handleDraftChange(`documents.documents[${index}].id`, doc.id); handleDraftChange(`documents.documents[${index}].doc_number`, value); }} />
                      <p className="text-xs text-muted-foreground">Added: {formatDate(doc.created_at)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="internal-refs" className="space-y-6">
          {isLoadingInternalRefs ? <LoadingCard title="Internal References" /> : internalRefsError ? <ErrorCard title="Internal References" error={internalRefsError} onRetry={() => loadInternalRefs(studentId)} /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Card Numbers</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 4 }, (_, i) => (
                      <EditableField key={i + 1} label={`Card ${i + 1}`} value={get(displayData, `internalRefs.cards[${i}].raw_value`, '')} onValueChange={(value) => handleDraftChange(`internalRefs.cards[${i}].raw_value`, value)} />
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>ENO Numbers</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 8 }, (_, i) => (
                      <EditableField key={i + 1} label={`ENO ${i + 1}`} value={get(displayData, `internalRefs.enos[${i}].raw_value`, '')} onValueChange={(value) => handleDraftChange(`internalRefs.enos[${i}].raw_value`, value)} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          {isLoadingNotes ? <LoadingCard title="Notes" /> : notesError ? <ErrorCard title="Notes" error={notesError} onRetry={() => loadNotes(studentId)} /> : (
            <div className="space-y-6">
              <AddNoteField onSave={handleAddNote} />
              <Card>
                <CardHeader><CardTitle>Student Notes</CardTitle></CardHeader>
                <CardContent>
                  {notes?.notes && notes.notes.length > 0 ? (
                    <div className="space-y-4">
                      {notes.notes.map((note, index) => (
                        <div key={note.id || index} className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">General</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {note.created_at ? new Date(note.created_at).toLocaleDateString() : ""}
                            </div>
                          </div>
                          <div className="text-sm">{note.note}</div>
                          {note.created_by && (<div className="text-xs text-muted-foreground mt-2">By: {note.created_by}</div>)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">No notes available for this student</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CollectPaymentDialog
        open={editReceiptDialogOpen}
        onOpenChange={setEditReceiptDialogOpen}
        student={
          overview?.student && overview?.current_enrollment
            ? {
              student_id: overview.student.id,
              enrollment_id: "",
              full_name: overview.student.full_name,
              enrollment_code: overview.student.enrollment_code,
              current_year: overview.current_enrollment.current_year,
              course_name: overview.current_enrollment.course_name,
              session_title: overview.current_enrollment.session_title,
              college_name: overview.current_enrollment.college_name,
              father_name: get(displayData, 'overview.profile.father_name', null),
              mother_name: get(displayData, 'overview.profile.mother_name', null),
              session_id: null,
              course_id: null,
              course_duration: overview.current_enrollment.course_duration,
              college_id: null,
              college_code: overview.current_enrollment.college_code,
              previous_balance: null,
              current_due: null,
              total_outstanding: null,
              last_payment_date: null,
              last_payment_amount: null,
            }
            : null
        }
        editReceiptData={editReceiptData}
        onSuccess={() => {
          loadFees(studentId);
          setEditReceiptData(null);
        }}
      />
    </div>
  );
}