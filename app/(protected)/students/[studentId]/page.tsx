import { Suspense } from "react";
import { StudentProfile } from "@/components/students/student-profile";
import { Skeleton } from "@/components/ui/skeleton";

interface PageProps {
  params: {
    studentId: string;
  };
}

export default function StudentProfilePage({ params }: PageProps) {
  return (
    <div className="container mx-auto p-6">
      <Suspense fallback={<StudentProfileSkeleton />}>
        <StudentProfile studentId={params.studentId} />
      </Suspense>
    </div>
  );
}

function StudentProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
