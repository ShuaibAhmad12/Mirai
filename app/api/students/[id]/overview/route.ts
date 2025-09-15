import { NextRequest, NextResponse } from "next/server";
import { studentService } from "@/lib/services/student.service";
import { enrollmentService } from "@/lib/services/enrollment.service";
import { feesService } from "@/lib/services/fees.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;

    // Get basic student info and profile
    const [student, profile, currentEnrollment, feeSummary] = await Promise.all(
      [
        studentService.getStudentBasicInfo(studentId),
        studentService.getStudentProfile(studentId),
        enrollmentService.getCurrentEnrollment(studentId),
        feesService.getFeeSummary(studentId),
      ]
    );

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Prepare overview data
    const overview = {
      student: {
        id: student.id,
        full_name: student.full_name,
        status: student.status,
        enrollment_code: currentEnrollment?.enrollment_code || "",
      },
      profile: profile
        ? {
            father_name: profile.father_name,
            mother_name: profile.mother_name,
            dob: profile.dob,
            gender: profile.gender,
            category: profile.category,
            nationality: profile.nationality,
          }
        : null,
      current_enrollment: currentEnrollment
        ? {
            course_name: currentEnrollment.course_name,
            college_name: currentEnrollment.college_name,
            college_code: currentEnrollment.college_code,
            session_title: currentEnrollment.session_title,
            current_year: currentEnrollment.current_year,
            course_duration: currentEnrollment.course_duration,
            enrollment_date: currentEnrollment.enrollment_date,
            joining_date: currentEnrollment.joining_date,
            entry_type: currentEnrollment.entry_type,
            status: currentEnrollment.status,
          }
        : null,
      quick_stats: feeSummary
        ? {
            total_outstanding: feeSummary.total_outstanding,
            previous_balance: feeSummary.previous_balance,
            current_due: feeSummary.current_due,
            total_paid: feeSummary.total_paid,
            fee_plan_name: feeSummary.fee_plan_name,
          }
        : null,
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Error fetching student overview:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
