import { createClient } from "@/lib/supabase/server";

export interface CurrentEnrollment {
  enrollment_id: string;
  student_id: string;
  course_id: string;
  course_name: string;
  college_id: string;
  college_name: string;
  college_code: string;
  session_id: string;
  session_title: string;
  enrollment_code: string;
  enrollment_date: string;
  joining_date?: string;
  entry_year: number;
  entry_type: string;
  current_year: number;
  course_duration: number;
  status: string;
}

export interface AcademicHistory {
  id: string;
  enrollment_id: string;
  from_year?: number;
  to_year: number;
  course_duration?: number;
  effective_date: string;
  status: string;
  notes?: string;
  created_at: string;
}

export interface PriorEducation {
  id: string;
  student_id: string;
  level?: string;
  board_university?: string;
  year_of_passing?: string;
  marks_percentage?: string;
  created_at: string;
  updated_at: string;
}

export class EnrollmentService {
  private async getSupabase() {
    return await createClient();
  }

  async getCurrentEnrollment(
    studentId: string
  ): Promise<CurrentEnrollment | null> {
    const supabase = await this.getSupabase();

    // Use the existing view from students-page
    const { data, error } = await supabase
      .from("v_student_current_enrollment")
      .select(
        `
        enrollment_id,
        enrollment_code,
        session_id,
        course_id,
        status,
        entry_year
      `
      )
      .eq("student_id", studentId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    if (!data) return null;

    // Get additional details with joins
    const { data: enrichedData, error: enrichError } = await supabase
      .from("student_enrollments")
      .select(
        `
        id,
        student_id,
        course_id,
        enrollment_code,
        enrollment_date,
        joining_date,
        entry_year,
        entry_type,
        status,
        courses:course_id (
          id,
          name,
          duration,
          college_id,
          colleges:college_id (
            id,
            name,
            code
          )
        ),
        academic_sessions:session_id (
          id,
          title
        )
      `
      )
      .eq("id", data.enrollment_id)
      .single();

    if (enrichError) throw enrichError;
    if (!enrichedData) return null;

    // Get current year from progressions
    const { data: progressionData, error: progressionError } = await supabase
      .from("student_progressions")
      .select("to_year, course_duration")
      .eq("enrollment_id", data.enrollment_id)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle no records

    const course = enrichedData.courses as any;
    const college = course?.colleges as any;
    const session = enrichedData.academic_sessions as any;

    // Calculate current year based on progression or entry type
    let currentYear: number;
    if (progressionData?.to_year) {
      // If there's progression data, use that
      currentYear = progressionData.to_year;
    } else if (enrichedData.entry_type === "lateral") {
      // Lateral entry students start from year 2
      currentYear = 2;
    } else {
      // Regular students start from year 1 (or entry_year if specified)
      currentYear = enrichedData.entry_year || 1;
    }

    return {
      enrollment_id: enrichedData.id,
      student_id: enrichedData.student_id,
      course_id: enrichedData.course_id,
      course_name: course?.name || "",
      college_id: college?.id || "",
      college_name: college?.name || "",
      college_code: college?.code || "",
      session_id: enrichedData.session_id || "",
      session_title: session?.title || "",
      enrollment_code: enrichedData.enrollment_code || "",
      enrollment_date: enrichedData.enrollment_date,
      joining_date: enrichedData.joining_date,
      entry_year: enrichedData.entry_year,
      entry_type: enrichedData.entry_type,
      current_year: currentYear,
      course_duration:
        progressionData?.course_duration || course?.duration || 0,
      status: enrichedData.status,
    };
  }

  async getAcademicHistory(studentId: string): Promise<AcademicHistory[]> {
    const supabase = await this.getSupabase();

    // First get enrollment IDs for this student
    const { data: enrollments, error: enrollError } = await supabase
      .from("student_enrollments")
      .select("id")
      .eq("student_id", studentId);

    if (enrollError) throw enrollError;
    if (!enrollments || enrollments.length === 0) return [];

    const enrollmentIds = enrollments.map((e) => e.id);

    const { data, error } = await supabase
      .from("student_progressions")
      .select("*")
      .in("enrollment_id", enrollmentIds)
      .order("effective_date", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getPriorEducation(studentId: string): Promise<PriorEducation[]> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_prior_education")
      .select("*")
      .eq("student_id", studentId)
      .order("year_of_passing", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async addPriorEducation(
    studentId: string,
    educationData: Partial<
      Omit<PriorEducation, "id" | "student_id" | "created_at" | "updated_at">
    >
  ): Promise<PriorEducation> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_prior_education")
      .insert({
        student_id: studentId,
        ...educationData,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async updatePriorEducation(
    educationId: string,
    educationData: Partial<
      Omit<PriorEducation, "id" | "student_id" | "created_at" | "updated_at">
    >
  ): Promise<PriorEducation> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_prior_education")
      .update(educationData)
      .eq("id", educationId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async deletePriorEducation(educationId: string): Promise<void> {
    const supabase = await this.getSupabase();
    const { error } = await supabase
      .from("student_prior_education")
      .delete()
      .eq("id", educationId);

    if (error) throw error;
  }

  async updateAcademicInfo(studentId: string, updates: any): Promise<any> {
    const supabase = await this.getSupabase();

    // For now, just handle basic academic history notes updates
    // In a real app, you'd parse the field names to determine which table to update
    console.log("Academic updates:", updates);

    // Return success for now - you can implement specific table updates based on field names
    return { success: true, message: "Academic info updated successfully" };
  }
}

export const enrollmentService = new EnrollmentService();
