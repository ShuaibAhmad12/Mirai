import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface StudentContact {
  contact_type: string;
  value_norm: string | null;
}

interface StudentAddress {
  addr_type: string;
  address_text: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

interface College {
  name: string;
  code: string;
}

interface Course {
  name: string;
  colleges: College;
}

interface AcademicSession {
  title: string;
}

interface StudentEnrollment {
  id: string;
  enrollment_code: string | null;
  enrollment_date: string;
  joining_date: string | null;
  status: string;
  courses: Course;
  academic_sessions: AcademicSession;
}

interface StudentData {
  id: string;
  full_name: string;
  status: string;
  student_contacts: StudentContact[];
  student_addresses: StudentAddress[];
  student_enrollments: StudentEnrollment[];
}

interface AgentNoteRecord {
  student_id: string;
  is_paid: boolean | null;
  remarks: string | null;
  created_at: string;
  students: StudentData;
}

interface StudentRecord {
  student_id: string;
  student_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  course_name: string | null;
  college_code: string | null;
  admission_status: string;
  admission_date: string | null;
  joining_date: string | null;
  referral_date: string;
  is_paid: boolean | null;
  remarks: string | null;
  session_year: string | null;
  enrollment_code: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agentId = id;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const country = searchParams.get("country") || "";

    const supabase = await createClient();

    // Get agent referrals with comprehensive student data
    const query = supabase
      .from("agent_notes")
      .select(
        `
        *,
        students (
          id,
          full_name,
          status,
          student_contacts (
            contact_type,
            value_norm
          ),
          student_addresses (
            addr_type,
            address_text,
            state,
            country
          ),
          student_enrollments (
            id,
            enrollment_code,
            enrollment_date,
            joining_date,
            status,
            courses (
              name,
              colleges (
                code
              )
            ),
            academic_sessions (
              title
            )
          )
        )
      `
      )
      .eq("agent_id", agentId);

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch students" },
        { status: 500 }
      );
    }

    // Transform the data with proper typing
    const students: StudentRecord[] =
      data?.map((record: AgentNoteRecord) => {
        const student = record.students;

        // Extract email from contacts
        const email =
          student?.student_contacts?.find(
            (contact: StudentContact) => contact.contact_type === "email"
          )?.value_norm || null;

        // Extract phone from contacts
        const phone =
          student?.student_contacts?.find(
            (contact: StudentContact) => contact.contact_type === "phone"
          )?.value_norm || null;

        // Extract address info
        const address =
          student?.student_addresses?.find(
            (addr: StudentAddress) => addr.addr_type === "permanent"
          ) || student?.student_addresses?.[0];

        // Extract enrollment info
        const enrollment = student?.student_enrollments?.[0];
        const course = enrollment?.courses;
        const college = course?.colleges;
        const session = enrollment?.academic_sessions;

        return {
          student_id: record.student_id,
          student_name: student?.full_name || "Unknown Student",
          email,
          phone,
          country: address?.country || null,
          city: address?.city || null,
          state: address?.state || null,
          course_name: course?.name || null,
          college_code: college?.code || null,
          admission_status: enrollment?.status || "pending",
          admission_date: enrollment?.enrollment_date || null,
          joining_date: enrollment?.joining_date || null,
          referral_date: record.created_at,
          is_paid: record.is_paid,
          remarks: record.remarks,
          session_year: session?.title || null,
          enrollment_code: enrollment?.enrollment_code || null,
        };
      }) || [];

    // Apply client-side filters for now
    let filteredStudents = students;

    if (search) {
      filteredStudents = filteredStudents.filter(
        (student: StudentRecord) =>
          student.student_name.toLowerCase().includes(search.toLowerCase()) ||
          student.email?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (status && status !== "all") {
      filteredStudents = filteredStudents.filter(
        (student: StudentRecord) => student.admission_status === status
      );
    }

    if (country && country !== "all") {
      filteredStudents = filteredStudents.filter(
        (student: StudentRecord) => student.country === country
      );
    }

    return NextResponse.json({
      students: filteredStudents,
      total: filteredStudents.length,
    });
  } catch (error) {
    console.error("Error fetching agent students:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
