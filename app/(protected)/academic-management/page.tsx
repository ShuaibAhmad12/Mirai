import CollegesPanel from "@/components/academic/CollegesPanel";
import CoursesPanel from "@/components/academic/CoursesPanel";
import SessionsPanel from "@/components/academic/SessionsPanel";
import FeesPanel from "@/components/academic/FeesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AcademicManagementPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Academic Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage colleges, courses, sessions and fee structures.
        </p>
      </header>

      <Tabs defaultValue="colleges" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="colleges">Colleges</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="fees">Fee Management</TabsTrigger>
        </TabsList>

        <TabsContent value="colleges" className="mt-6">
          <CollegesPanel />
        </TabsContent>

        <TabsContent value="courses" className="mt-6">
          <CoursesPanel />
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <SessionsPanel />
        </TabsContent>

        <TabsContent value="fees" className="mt-6">
          <FeesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
