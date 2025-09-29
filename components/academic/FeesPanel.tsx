"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2,Settings } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  listFeeComponents,
  createFeeComponent,
  updateFeeComponent,
  deleteFeeComponent,
  listAllFeePlans,
  createFeePlan,
  updateFeePlan,
  deleteFeePlan,
  listAllFeePlanItems,
  addFeePlanItem,
  updateFeePlanItem,
  deleteFeePlanItem,
  type FeeComponent,
  type FeePlan,
  type FeePlanItem,
} from "@/lib/api/academic";
import { useAcademicData } from "@/lib/stores/academic-store";

// Helper function for empty form states
function getEmptyComponentForm() {
  return {
    code: "",
    label: "",
    frequency: "one_time",
    description: "",
  };
}

function getEmptyPlanForm() {
  return {
    course_id: "",
    session_id: "",
    name: "",
    currency: "INR",
    status: 1,
    effective_start: new Date().toISOString().split("T")[0],
    effective_end: "",
  };
}

function getEmptyItemForm() {
  return {
    fee_plan_id: "",
    component_id: "",
    amount: "",
    year_number: "",
    is_admission_phase: false,
    notes: "",
  };
}

export default function FeesPanel() {
  const { courses, sessions, isHydrated } = useAcademicData();

  // Data states
  const [components, setComponents] = useState<FeeComponent[]>([]);
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [planItems, setPlanItems] = useState<Record<string, FeePlanItem[]>>({});
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState("components");

  // Dialog states
  const [isComponentAddOpen, setIsComponentAddOpen] = useState(false);
  const [isComponentEditOpen, setIsComponentEditOpen] = useState(false);
  const [isPlanAddOpen, setIsPlanAddOpen] = useState(false);
  const [isPlanEditOpen, setIsPlanEditOpen] = useState(false);
  const [isItemAddOpen, setIsItemAddOpen] = useState(false);
  const [isItemEditOpen, setIsItemEditOpen] = useState(false);
  const [isManageItemsOpen, setIsManageItemsOpen] = useState(false);
  const [selectedPlanForManagement, setSelectedPlanForManagement] =
    useState<FeePlan | null>(null);

  // Form states
  const [componentForm, setComponentForm] = useState(getEmptyComponentForm());
  const [editComponentForm, setEditComponentForm] = useState(
    getEmptyComponentForm()
  );
  const [planForm, setPlanForm] = useState(getEmptyPlanForm());
  const [editPlanForm, setEditPlanForm] = useState(getEmptyPlanForm());
  const [itemForm, setItemForm] = useState(getEmptyItemForm());
  const [editItemForm, setEditItemForm] = useState(getEmptyItemForm());

  // Edit IDs
  const [editComponentId, setEditComponentId] = useState("");
  const [editPlanId, setEditPlanId] = useState("");
  const [editItemId, setEditItemId] = useState("");

  // Filter states
  const [componentSearch, setComponentSearch] = useState("");
  const [planSearch, setPlanSearch] = useState("");
  const [selectedPlanForItems, setSelectedPlanForItems] = useState("");

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [componentsData, plansData, allItemsData] = await Promise.all([
        listFeeComponents(),
        listAllFeePlans(),
        listAllFeePlanItems(), // Fetch all items in one call
      ]);

      setComponents(componentsData);
      setPlans(plansData);

      // Group items by plan ID for efficient lookup
      const itemsByPlan: Record<string, FeePlanItem[]> = {};
      allItemsData.forEach((item) => {
        if (!itemsByPlan[item.fee_plan_id]) {
          itemsByPlan[item.fee_plan_id] = [];
        }
        itemsByPlan[item.fee_plan_id].push(item);
      });
      setPlanItems(itemsByPlan);
    } catch (error) {
      toast.error("Failed to load fee data");
      console.error("Load fee data error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper function to reload all plan items efficiently
  const reloadPlanItems = useCallback(async () => {
    try {
      const allItemsData = await listAllFeePlanItems();

      // Group items by plan ID for efficient lookup
      const itemsByPlan: Record<string, FeePlanItem[]> = {};
      allItemsData.forEach((item) => {
        if (!itemsByPlan[item.fee_plan_id]) {
          itemsByPlan[item.fee_plan_id] = [];
        }
        itemsByPlan[item.fee_plan_id].push(item);
      });
      setPlanItems(itemsByPlan);
    } catch (error) {
      toast.error("Failed to reload plan items");
      console.error("Reload plan items error:", error);
    }
  }, []);

  useEffect(() => {
    if (isHydrated) {
      loadData();
    }
  }, [isHydrated, loadData]);

  // Component CRUD functions
  async function onCreateComponent() {
    if (!componentForm.code.trim() || !componentForm.label.trim()) {
      toast.error("Code and label are required");
      return;
    }
    try {
      await createFeeComponent({
        code: componentForm.code.trim().toUpperCase(),
        label: componentForm.label.trim(),
        frequency: componentForm.frequency,
        description: componentForm.description.trim() || undefined,
      });
      toast.success("Fee component created successfully");
      setComponentForm(getEmptyComponentForm());
      setIsComponentAddOpen(false);
      loadData();
    } catch (error) {
      toast.error("Failed to create fee component");
      console.error("Create component error:", error);
    }
  }

  async function onUpdateComponent() {
    if (!editComponentForm.code.trim() || !editComponentForm.label.trim()) {
      toast.error("Code and label are required");
      return;
    }
    try {
      await updateFeeComponent(editComponentId, {
        code: editComponentForm.code.trim().toUpperCase(),
        label: editComponentForm.label.trim(),
        frequency: editComponentForm.frequency,
        description: editComponentForm.description.trim() || undefined,
      });
      toast.success("Fee component updated successfully");
      setIsComponentEditOpen(false);
      setEditComponentForm(getEmptyComponentForm());
      setEditComponentId("");
      loadData();
    } catch (error) {
      toast.error("Failed to update fee component");
      console.error("Update component error:", error);
    }
  }

  async function onDeleteComponent(id: string, label: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Fee Component",
      message: `Are you sure you want to delete "${label}"? This action cannot be undone and may affect existing fee plans.`,
      onConfirm: async () => {
        try {
          await deleteFeeComponent(id);
          toast.success("Fee component deleted successfully");
          loadData();
        } catch (error) {
          toast.error("Failed to delete fee component");
          console.error("Delete component error:", error);
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }

  // Plan CRUD functions
  async function onCreatePlan() {
    if (!planForm.course_id.trim() || !planForm.name.trim()) {
      toast.error("Course and plan name are required");
      return;
    }
    try {
      await createFeePlan({
        course_id: planForm.course_id,
        session_id: planForm.session_id || null,
        name: planForm.name.trim(),
        currency: planForm.currency,
        status: planForm.status,
        effective_start: planForm.effective_start,
        effective_end: planForm.effective_end || undefined,
      });
      toast.success("Fee plan created successfully");
      setPlanForm(getEmptyPlanForm());
      setIsPlanAddOpen(false);
      loadData();
    } catch (error) {
      toast.error("Failed to create fee plan");
      console.error("Create plan error:", error);
    }
  }

  async function onUpdatePlan() {
    if (!editPlanForm.course_id.trim() || !editPlanForm.name.trim()) {
      toast.error("Course and plan name are required");
      return;
    }
    try {
      await updateFeePlan(editPlanId, {
        course_id: editPlanForm.course_id,
        session_id: editPlanForm.session_id || null,
        name: editPlanForm.name.trim(),
        currency: editPlanForm.currency,
        status: editPlanForm.status,
        effective_start: editPlanForm.effective_start,
        effective_end: editPlanForm.effective_end || undefined,
      });
      toast.success("Fee plan updated successfully");
      setIsPlanEditOpen(false);
      setEditPlanForm(getEmptyPlanForm());
      setEditPlanId("");
      loadData();
    } catch (error) {
      toast.error("Failed to update fee plan");
      console.error("Update plan error:", error);
    }
  }

  async function onDeletePlan(id: string, name: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Fee Plan",
      message: `Are you sure you want to delete "${name}"? This will also delete all associated fee plan items.`,
      onConfirm: async () => {
        try {
          await deleteFeePlan(id);
          toast.success("Fee plan deleted successfully");
          if (selectedPlanForItems === id) {
            setSelectedPlanForItems("");
          }
          loadData();
        } catch (error) {
          toast.error("Failed to delete fee plan");
          console.error("Delete plan error:", error);
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }

  // Item CRUD functions
  async function onCreateItem() {
    if (
      !itemForm.fee_plan_id.trim() ||
      !itemForm.component_id.trim() ||
      !itemForm.amount.trim()
    ) {
      toast.error("Plan, component, and amount are required");
      return;
    }

    // Validate year_number if provided
    if (
      itemForm.year_number?.trim() &&
      isNaN(parseInt(itemForm.year_number.trim(), 10))
    ) {
      toast.error("Year number must be a valid number");
      return;
    }

    // Check for duplicate items (same plan, component, year, and admission phase)
    const existingItems = planItems[itemForm.fee_plan_id] || [];
    const yearNum = itemForm.year_number?.trim()
      ? parseInt(itemForm.year_number.trim(), 10)
      : null;
    const duplicate = existingItems.find(
      (item) =>
        item.component_id === itemForm.component_id &&
        item.year_number === yearNum &&
        item.is_admission_phase === itemForm.is_admission_phase
    );

    if (duplicate) {
      toast.error(
        "A fee item with this component, year, and admission phase already exists for this plan"
      );
      return;
    }

    try {
      await addFeePlanItem({
        fee_plan_id: itemForm.fee_plan_id,
        component_id: itemForm.component_id,
        amount: parseFloat(itemForm.amount),
        year_number: itemForm.year_number?.trim()
          ? parseInt(itemForm.year_number.trim(), 10)
          : null,
        is_admission_phase: itemForm.is_admission_phase,
        notes: itemForm.notes?.trim() || null,
      });
      toast.success("Fee plan item added successfully");
      setItemForm(getEmptyItemForm());
      setIsItemAddOpen(false);
      // Refresh all plan items to maintain consistency
      await reloadPlanItems();
    } catch (error: unknown) {
      // Handle specific error cases
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes(
          "duplicate key value violates unique constraint"
        ) ||
        errorMessage.includes("already exists")
      ) {
        toast.error(
          "A fee item with this component, year, and admission phase already exists for this plan"
        );
      } else {
        toast.error("Failed to add fee plan item");
      }
      console.error("Create item error:", error);
    }
  }

  async function onUpdateItem() {
    if (!editItemForm.component_id?.trim() || !editItemForm.amount?.trim()) {
      toast.error("Component and amount are required");
      return;
    }

    // Validate year_number if provided
    if (
      editItemForm.year_number?.trim() &&
      isNaN(parseInt(editItemForm.year_number.trim(), 10))
    ) {
      toast.error("Year number must be a valid number");
      return;
    }

    try {
      await updateFeePlanItem(editItemId, {
        component_id: editItemForm.component_id,
        amount: parseFloat(editItemForm.amount),
        year_number: editItemForm.year_number?.trim()
          ? parseInt(editItemForm.year_number.trim(), 10)
          : null,
        is_admission_phase: editItemForm.is_admission_phase,
        notes: editItemForm.notes?.trim() || null,
      });
      toast.success("Fee plan item updated successfully");
      setIsItemEditOpen(false);
      setEditItemForm(getEmptyItemForm());
      setEditItemId("");
      await reloadPlanItems();
    } catch (error) {
      toast.error("Failed to update fee plan item");
      console.error("Update item error:", error);
    }
  }

  async function onDeleteItem(id: string, componentLabel: string) {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Fee Plan Item",
      message: `Are you sure you want to delete the "${componentLabel}" fee item?`,
      onConfirm: async () => {
        try {
          await deleteFeePlanItem(id);
          toast.success("Fee plan item deleted successfully");
          await reloadPlanItems();
        } catch (error) {
          toast.error("Failed to delete fee plan item");
          console.error("Delete item error:", error);
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }

  // Edit handlers
  function openEditComponent(component: FeeComponent) {
    setEditComponentForm({
      code: component.code,
      label: component.label,
      frequency: component.frequency,
      description: component.description || "",
    });
    setEditComponentId(component.id);
    setIsComponentEditOpen(true);
  }

  function openEditPlan(plan: FeePlan) {
    setEditPlanForm({
      course_id: plan.course_id,
      session_id: plan.session_id || "",
      name: plan.name,
      currency: plan.currency,
      status: plan.status,
      effective_start: plan.effective_start,
      effective_end: plan.effective_end || "",
    });
    setEditPlanId(plan.id);
    setIsPlanEditOpen(true);
  }

  function openEditItem(item: FeePlanItem) {
    setEditItemForm({
      fee_plan_id: item.fee_plan_id,
      component_id: item.component_id,
      amount: item.amount.toString(),
      year_number: item.year_number?.toString() || "",
      is_admission_phase: item.is_admission_phase,
      notes: item.notes || "",
    });
    setEditItemId(item.id);
    setIsItemEditOpen(true);
  }

  // Filtered data
  const filteredComponents = useMemo(() => {
    return components.filter(
      (component) =>
        component.label.toLowerCase().includes(componentSearch.toLowerCase()) ||
        component.code.toLowerCase().includes(componentSearch.toLowerCase())
    );
  }, [components, componentSearch]);

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) =>
      plan.name.toLowerCase().includes(planSearch.toLowerCase())
    );
  }, [plans, planSearch]);

  if (!isHydrated || loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">Loading fee management...</div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Fee Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage fee components, plans, and items
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          🔄 Refresh All
        </Button>
      </div>

      <Separator />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="components">Fee Components</TabsTrigger>
          <TabsTrigger value="plans">Fee Plans</TabsTrigger>
        </TabsList>

        {/* Fee Components Tab */}
        <TabsContent value="components" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search components..."
                value={componentSearch}
                onChange={(e) => setComponentSearch(e.target.value)}
                className="w-64"
              />
              <div className="text-sm text-muted-foreground">
                {filteredComponents.length} of {components.length} components
              </div>
            </div>
            <Button onClick={() => setIsComponentAddOpen(true)}>
              + Add Component
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComponents.map((component) => (
                <TableRow key={component.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {component.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {component.label}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{component.frequency}</Badge>
                  </TableCell>
                  <TableCell>{component.description || "—"}</TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                    <div className="flex justify-end gap-2">
                      <Tooltip>
                          <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditComponent(component)}
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
                          onDeleteComponent(component.id, component.label)
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
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* Fee Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search plans..."
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                className="w-64"
              />
              <div className="text-sm text-muted-foreground">
                {filteredPlans.length} of {plans.length} plans
              </div>
            </div>
            <Button onClick={() => setIsPlanAddOpen(true)}>+ Add Plan</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Currency & Status</TableHead>
                <TableHead>Fee Items</TableHead>
                <TableHead>Effective Period</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    {courses.find((c) => c.id === plan.course_id)?.name ||
                      "Unknown"}
                  </TableCell>
                  <TableCell>
                    {plan.session_id
                      ? sessions.find((s) => s.id === plan.session_id)?.title ||
                        "Unknown"
                      : "Any"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-mono text-sm">{plan.currency}</div>
                      <Badge
                        variant={plan.status === 1 ? "default" : "secondary"}
                      >
                        {plan.status === 1 ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {planItems[plan.id]?.length > 0 ? (
                        planItems[plan.id].map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                          >
                            <div className="flex-1">
                              <div className="font-medium">
                                {components.find(
                                  (c) => c.id === item.component_id
                                )?.label || "Unknown Component"}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                {item.year_number && (
                                  <span>Year {item.year_number}</span>
                                )}
                                {item.is_admission_phase && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs py-0 px-1"
                                  >
                                    Admission
                                  </Badge>
                                )}
                                {item.notes && <span>• {item.notes}</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-medium">
                                ₹{item.amount.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground italic p-2">
                          No fee items defined
                        </div>
                      )}
                      {planItems[plan.id]?.length > 0 && (
                        <div className="text-right pt-1 border-t">
                          <div className="text-sm font-semibold">
                            Total: ₹
                            {planItems[plan.id]
                              ?.reduce((sum, item) => sum + item.amount, 0)
                              .toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{plan.effective_start}</div>
                      {plan.effective_end && (
                        <div className="text-muted-foreground">
                          to {plan.effective_end}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    
                   <div className="flex justify-end gap-2">
  <TooltipProvider>
    {/* Manage Items */}
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedPlanForManagement(plan);
            setIsManageItemsOpen(true);
          }}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Manage Items</TooltipContent>
    </Tooltip>

    {/* Edit */}
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEditPlan(plan)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Edit</TooltipContent>
    </Tooltip>

    {/* Delete */}
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDeletePlan(plan.id, plan.name)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Delete</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Add Component Dialog */}
      <Dialog open={isComponentAddOpen} onOpenChange={setIsComponentAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fee Component</DialogTitle>
            <DialogDescription>
              Create a new fee component type
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Code *</label>
              <Input
                placeholder="e.g., TUITION, ADMISSION"
                value={componentForm.code}
                onChange={(e) =>
                  setComponentForm({
                    ...componentForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Label *</label>
              <Input
                placeholder="e.g., Tuition Fee, Admission Fee"
                value={componentForm.label}
                onChange={(e) =>
                  setComponentForm({ ...componentForm, label: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Frequency *</label>
              <select
                value={componentForm.frequency}
                onChange={(e) =>
                  setComponentForm({
                    ...componentForm,
                    frequency: e.target.value,
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="one_time">One Time</option>
                <option value="annual">Annual</option>
                <option value="semester">Semester</option>
                <option value="monthly">Monthly</option>
                <option value="on_admission">On Admission</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="Optional description"
                value={componentForm.description}
                onChange={(e) =>
                  setComponentForm({
                    ...componentForm,
                    description: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsComponentAddOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={onCreateComponent}>Create Component</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Component Dialog */}
      <Dialog open={isComponentEditOpen} onOpenChange={setIsComponentEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fee Component</DialogTitle>
            <DialogDescription>
              Update the fee component details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Code *</label>
              <Input
                value={editComponentForm.code}
                onChange={(e) =>
                  setEditComponentForm({
                    ...editComponentForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Label *</label>
              <Input
                value={editComponentForm.label}
                onChange={(e) =>
                  setEditComponentForm({
                    ...editComponentForm,
                    label: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Frequency *</label>
              <select
                value={editComponentForm.frequency}
                onChange={(e) =>
                  setEditComponentForm({
                    ...editComponentForm,
                    frequency: e.target.value,
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="one_time">One Time</option>
                <option value="annual">Annual</option>
                <option value="semester">Semester</option>
                <option value="monthly">Monthly</option>
                <option value="on_admission">On Admission</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={editComponentForm.description}
                onChange={(e) =>
                  setEditComponentForm({
                    ...editComponentForm,
                    description: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsComponentEditOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={onUpdateComponent}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Plan Dialog */}
      <Dialog open={isPlanAddOpen} onOpenChange={setIsPlanAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fee Plan</DialogTitle>
            <DialogDescription>
              Create a new fee plan for a course
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Course *</label>
              <select
                value={planForm.course_id}
                onChange={(e) =>
                  setPlanForm({ ...planForm, course_id: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select Course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Session</label>
              <select
                value={planForm.session_id}
                onChange={(e) =>
                  setPlanForm({ ...planForm, session_id: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Any Session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Plan Name *</label>
              <Input
                placeholder="e.g., Standard Fee Plan 2024"
                value={planForm.name}
                onChange={(e) =>
                  setPlanForm({ ...planForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Currency</label>
              <select
                value={planForm.currency}
                onChange={(e) =>
                  setPlanForm({ ...planForm, currency: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">
                Effective Start Date *
              </label>
              <Input
                type="date"
                value={planForm.effective_start}
                onChange={(e) =>
                  setPlanForm({ ...planForm, effective_start: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Effective End Date</label>
              <Input
                type="date"
                value={planForm.effective_end}
                onChange={(e) =>
                  setPlanForm({ ...planForm, effective_end: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreatePlan}>Create Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={isPlanEditOpen} onOpenChange={setIsPlanEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fee Plan</DialogTitle>
            <DialogDescription>Update the fee plan details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Course *</label>
              <select
                value={editPlanForm.course_id}
                onChange={(e) =>
                  setEditPlanForm({
                    ...editPlanForm,
                    course_id: e.target.value,
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select Course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Session</label>
              <select
                value={editPlanForm.session_id}
                onChange={(e) =>
                  setEditPlanForm({
                    ...editPlanForm,
                    session_id: e.target.value,
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Any Session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Plan Name *</label>
              <Input
                value={editPlanForm.name}
                onChange={(e) =>
                  setEditPlanForm({ ...editPlanForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Currency</label>
              <select
                value={editPlanForm.currency}
                onChange={(e) =>
                  setEditPlanForm({ ...editPlanForm, currency: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                value={editPlanForm.status}
                onChange={(e) =>
                  setEditPlanForm({
                    ...editPlanForm,
                    status: Number(e.target.value),
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">
                Effective Start Date *
              </label>
              <Input
                type="date"
                value={editPlanForm.effective_start}
                onChange={(e) =>
                  setEditPlanForm({
                    ...editPlanForm,
                    effective_start: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Effective End Date</label>
              <Input
                type="date"
                value={editPlanForm.effective_end}
                onChange={(e) =>
                  setEditPlanForm({
                    ...editPlanForm,
                    effective_end: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onUpdatePlan}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={isItemAddOpen} onOpenChange={setIsItemAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fee Plan Item</DialogTitle>
            <DialogDescription>
              Add a fee component to the selected plan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Fee Component *</label>
              <select
                value={itemForm.component_id}
                onChange={(e) =>
                  setItemForm({ ...itemForm, component_id: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select Component</option>
                {components.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.code} - {component.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Amount *</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={itemForm.amount}
                onChange={(e) =>
                  setItemForm({ ...itemForm, amount: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Year Number</label>
              <Input
                type="number"
                placeholder="Leave empty for all years"
                value={itemForm.year_number}
                onChange={(e) =>
                  setItemForm({ ...itemForm, year_number: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="admission_phase"
                checked={itemForm.is_admission_phase}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    is_admission_phase: e.target.checked,
                  })
                }
              />
              <label htmlFor="admission_phase" className="text-sm font-medium">
                Admission Phase
              </label>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                placeholder="Optional notes"
                value={itemForm.notes}
                onChange={(e) =>
                  setItemForm({ ...itemForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onCreateItem}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isItemEditOpen} onOpenChange={setIsItemEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fee Plan Item</DialogTitle>
            <DialogDescription>
              Update the fee plan item details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Fee Component *</label>
              <select
                value={editItemForm.component_id}
                onChange={(e) =>
                  setEditItemForm({
                    ...editItemForm,
                    component_id: e.target.value,
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select Component</option>
                {components.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.code} - {component.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Amount *</label>
              <Input
                type="number"
                step="0.01"
                value={editItemForm.amount}
                onChange={(e) =>
                  setEditItemForm({ ...editItemForm, amount: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Year Number</label>
              <Input
                type="number"
                value={editItemForm.year_number}
                onChange={(e) =>
                  setEditItemForm({
                    ...editItemForm,
                    year_number: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit_admission_phase"
                checked={editItemForm.is_admission_phase}
                onChange={(e) =>
                  setEditItemForm({
                    ...editItemForm,
                    is_admission_phase: e.target.checked,
                  })
                }
              />
              <label
                htmlFor="edit_admission_phase"
                className="text-sm font-medium"
              >
                Admission Phase
              </label>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={editItemForm.notes}
                onChange={(e) =>
                  setEditItemForm({ ...editItemForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onUpdateItem}>Save Changes</Button>
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
        <DialogContent>
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
            <Button variant="destructive" onClick={confirmDialog.onConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Items Modal */}
      <Dialog open={isManageItemsOpen} onOpenChange={setIsManageItemsOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Items for &ldquo;{selectedPlanForManagement?.name}&rdquo;
            </DialogTitle>
            <DialogDescription>
              Add, edit, or remove fee items for this specific fee plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedPlanForManagement
                  ? `${
                      (planItems[selectedPlanForManagement.id] || []).length
                    } items`
                  : "No plan selected"}
              </div>
              <Button
                onClick={() => {
                  if (selectedPlanForManagement) {
                    setItemForm({
                      ...getEmptyItemForm(),
                      fee_plan_id: selectedPlanForManagement.id,
                    });
                    setIsItemAddOpen(true);
                  }
                }}
                disabled={!selectedPlanForManagement}
              >
                + Add Item
              </Button>
            </div>

            {selectedPlanForManagement ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Admission Phase</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(planItems[selectedPlanForManagement.id] || []).map(
                    (item) => {
                      const component = components.find(
                        (c) => c.id === item.component_id
                      );
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono">
                                {component?.code || "Unknown"}
                              </Badge>
                              <span>
                                {component?.label || "Unknown Component"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            ₹{item.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {item.year_number
                              ? `Year ${item.year_number}`
                              : "All Years"}
                          </TableCell>
                          <TableCell>
                            {item.is_admission_phase ? (
                              <Badge variant="outline">Admission</Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{item.notes || "—"}</TableCell>
                          <TableCell className="text-right">
                          <TooltipProvider>
                            <div className="flex justify-end gap-2">
                        <Tooltip>
                              <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditItem(item)}
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
                                  onDeleteItem(
                                    item.id,
                                    component?.label || "Unknown"
                                  )
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
                    }
                  )}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No fee plan selected for management
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsManageItemsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
