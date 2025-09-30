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
import { createCourse, updateCourse, deleteCourse } from "@/lib/api/academic";
import { toast } from "sonner";
import { useAcademicData } from "@/lib/stores/academic-store";
import {
  Tooltip,
  TooltipContent,
  
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil, Trash2 } from "lucide-react";
export default function CoursesPanel() {
  const { colleges, courses, loading, isHydrated, invalidateCourses } =
    useAcademicData();

  const [form, setForm] = useState<{
    college_id: string;
    course_identity: string;
    name: string;
    duration: string;
  }>({ college_id: "", course_identity: "", name: "", duration: "" });

  const [editForm, setEditForm] = useState<{
    id: string;
    college_id: string;
    course_identity: string;
    name: string;
    duration: string;
  }>({ id: "", college_id: "", course_identity: "", name: "", duration: "" });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Filter states
  const [selectedCollegeFilter, setSelectedCollegeFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const collegeMap = useMemo(
    () => Object.fromEntries(colleges.map((c) => [c.id, c])),
    [colleges]
  );

  // Filtered courses with search and college filter
  const filteredCourses = useMemo(() => {
    let filtered = courses;

    // Filter by college
    if (selectedCollegeFilter) {
      filtered = filtered.filter(
        (course) => course.college_id === selectedCollegeFilter
      );  
    }

    // Filter by search term (course name or college name)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (course) =>
          course.name.toLowerCase().includes(term) ||
          (course.course_identity || "").toLowerCase().includes(term) ||
          (collegeMap[course.college_id]?.name || "")
            .toLowerCase()
            .includes(term) ||
          (collegeMap[course.college_id]?.code || "")
            .toLowerCase()
            .includes(term)
      );
    }

    return filtered;
  }, [courses, selectedCollegeFilter, searchTerm, collegeMap]);

  async function onCreate() {
    if (
      !form.college_id ||
      !(form.course_identity && form.course_identity.trim()) ||
      !(form.name && form.name.trim())
    ) {
      toast.error(
        "Please select a college, enter a course identity, and course name."
      );
      return;
    }
    try {
      const college = collegeMap[form.college_id];
      await createCourse({
        college_id: form.college_id,
        college_code: college?.code || college?.name || "COLLEGE",
        course_identity: form.course_identity,
        name: form.name,
        duration: form.duration.trim() === "" ? null : Number(form.duration),
      });
      setForm({ college_id: "", course_identity: "", name: "", duration: "" });
      setIsAddOpen(false);
      invalidateCourses();
      toast.success("Course created successfully!");
    } catch (error) {
      toast.error("Failed to create course. Please try again.");
      console.error("Create course error:", error);
    }
  }

  async function onUpdate() {
    if (
      !(editForm.course_identity && editForm.course_identity.trim()) ||
      !(editForm.name && editForm.name.trim())
    ) {
      toast.error("Please enter a course identity and course name.");
      return;
    }
    try {
      await updateCourse(editForm.id, {
        course_identity: editForm.course_identity,
        name: editForm.name,
        duration:
          editForm.duration.trim() === "" ? null : Number(editForm.duration),
      });
      setIsEditOpen(false);
      setEditForm({
        id: "",
        college_id: "",
        course_identity: "",
        name: "",
        duration: "",
      });
      invalidateCourses();
      toast.success("Course updated successfully!");
    } catch (error) {
      toast.error("Failed to update course. Please try again.");
      console.error("Update course error:", error);
    }
  }

  async function onDelete(id: string, courseName?: string) {
    if (
      !confirm(
        `Are you sure you want to delete ${
          courseName ? `"${courseName}"` : "this course"
        }? This action cannot be undone.`
      )
    )
      return;
    try {
      await deleteCourse(id);
      invalidateCourses();
      toast.success(
        `Course ${courseName ? `"${courseName}"` : ""} deleted successfully!`
      );
    } catch (error) {
      toast.error("Failed to delete course. Please try again.");
      console.error("Delete course error:", error);
    }
  }

  function openEdit(course: {
    id: string;
    college_id: string;
    course_identity: string | null;
    name: string;
    duration: number | null;
  }) {
    setEditForm({
      id: course.id,
      college_id: course.college_id,
      course_identity: course.course_identity || "",
      name: course.name,
      duration: course.duration?.toString() || "",
    });
    setIsEditOpen(true);
  }

  return (
    <Card className="p-6 space-y-4">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Course Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage course catalog and academic programs
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{courses.length}</p>
            <p className="text-xs text-muted-foreground">Total Courses</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">
              {filteredCourses.length}
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
              Search Courses
            </label>
            <Input
              placeholder="Search by course name, identity, or college..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Filter by College
            </label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={selectedCollegeFilter}
              onChange={(e) => setSelectedCollegeFilter(e.target.value)}
            >
              <option value="">All Colleges</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} - ${c.name}` : c.name}
                </option>
              ))}
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
                setSelectedCollegeFilter("");
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

      {/* Add New Course Section */}
      <div className="flex items-center justify-between">
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => invalidateCourses()}
            className="shrink-0"
          >
            🔄 Refresh
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="shrink-0">
            + Add Course
          </Button>
        </div>
      </div>

      <Separator />
      {/* Courses Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Course List</h3>
          {selectedCollegeFilter && (
            <Badge variant="secondary">
              Showing courses for: {collegeMap[selectedCollegeFilter]?.name}
            </Badge>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          {loading || !isHydrated ? (
            <div className="p-8 text-center">
              <div className="text-sm text-muted-foreground">
                Loading courses...
              </div>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-sm text-muted-foreground">
                {searchTerm || selectedCollegeFilter
                  ? "No courses match your current filters."
                  : "No courses found. Add your first course above."}
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-16">S.No.</TableHead>
                  <TableHead className="w-32">Identity</TableHead>
                  <TableHead>Course Name</TableHead>
                  <TableHead>College</TableHead>
                  <TableHead className="w-32">Duration</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourses.map((course, index) => (
                  <TableRow key={course.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {course.course_identity || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{course.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {collegeMap[course.college_id]?.code ||
                            course.college_code ||
                            "—"}
                        </Badge>
                        <span className="text-sm text-muted-foreground truncate">
                          {collegeMap[course.college_id]?.name ||
                            "Unknown College"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {course.duration ? (
                          <Badge variant="secondary">
                            {course.duration} year
                            {course.duration !== 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(course)}
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
                              onClick={() => onDelete(course.id, course.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Add Course Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setForm({
              college_id: "",
              name: "",
              duration: "",
              course_identity: "",
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Course</DialogTitle>
            <DialogDescription>
              Create a new course and assign it to a college. All fields marked
              with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                College <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.college_id}
                onChange={(e) =>
                  setForm({ ...form, college_id: e.target.value })
                }
              >
                <option value="">Select a college...</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} - ${c.name}` : c.name}
                  </option>
                ))}
              </select>
              {form.college_id && (
                <div className="text-xs text-muted-foreground">
                  Selected: {collegeMap[form.college_id]?.name}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Course Identity <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g., BCS2025, MCA-01, ENG-HONS"
                value={form.course_identity}
                onChange={(e) =>
                  setForm({ ...form, course_identity: e.target.value })
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    form.college_id &&
                    form.name &&
                    form.name.trim() &&
                    form.course_identity &&
                    form.course_identity.trim()
                  ) {
                    onCreate();
                  }
                }}
              />
              <div className="text-xs text-muted-foreground">
                Unique identifier/code for this course program
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Course Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g., Bachelor of Computer Science"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    form.college_id &&
                    form.name &&
                    form.name.trim() &&
                    form.course_identity &&
                    form.course_identity.trim()
                  ) {
                    onCreate();
                  }
                }}
              />
              <div className="text-xs text-muted-foreground">
                Enter the full name of the course program
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Duration (Years)
              </label>
              <Input
                placeholder="e.g., 4"
                type="number"
                min="1"
                max="10"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    form.college_id &&
                    form.name &&
                    form.name.trim() &&
                    form.course_identity &&
                    form.course_identity.trim()
                  ) {
                    onCreate();
                  }
                }}
              />
              <div className="text-xs text-muted-foreground">
                Leave empty if duration is not applicable or varies
              </div>
            </div>

            {form.college_id && form.name && form.course_identity && (
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Preview:
                </div>
                <div className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {form.course_identity}
                  </Badge>
                  <strong>{form.name}</strong>
                  {form.duration && <span> ({form.duration} years)</span>}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  at {collegeMap[form.college_id]?.name}
                  {collegeMap[form.college_id]?.code && (
                    <Badge variant="outline" className="text-xs">
                      {collegeMap[form.college_id].code}
                    </Badge>
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
                setForm({
                  college_id: "",
                  name: "",
                  duration: "",
                  course_identity: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={
                !form.college_id ||
                !(form.name && form.name.trim()) ||
                !(form.course_identity && form.course_identity.trim())
              }
            >
              Create Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update the course information below. College assignment cannot be
              changed after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Assigned College
              </label>
              <div className="p-3 border rounded-md bg-muted/50 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {collegeMap[editForm.college_id]?.code || "—"}
                  </Badge>
                  <span>
                    {collegeMap[editForm.college_id]?.name || "Unknown College"}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Course Identity <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g., BCS2025, MCA-01, ENG-HONS"
                value={editForm.course_identity}
                onChange={(e) =>
                  setEditForm({ ...editForm, course_identity: e.target.value })
                }
              />
              <div className="text-xs text-muted-foreground">
                Unique identifier/code for this course program
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Course Name
              </label>
              <Input
                placeholder="e.g., Computer Science"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Duration (Years)
              </label>
              <Input
                placeholder="e.g., 4"
                type="number"
                value={editForm.duration}
                onChange={(e) =>
                  setEditForm({ ...editForm, duration: e.target.value })
                }
              />
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
                  editForm.course_identity && editForm.course_identity.trim()
                ) || !(editForm.name && editForm.name.trim())
              }
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
