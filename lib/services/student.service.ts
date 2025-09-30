import { createClient } from "@/lib/supabase/server";

export interface StudentBasicInfo {
  id: string;
  full_name: string;
  status: string;
  enrollment_code?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  student_id: string;
  father_name?: string;
  mother_name?: string;
  dob?: string;
  gender?: string;
  category?: string;
  nationality?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentAddress {
  id: string;
  student_id: string;
  addr_type: "permanent" | "correspondence";
  address_text?: string;
  state?: string;
  country?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentContact {
  id: string;
  student_id: string;
  contact_type: "phone" | "parent_phone" | "guardian_phone" | "email" | "other";
  value_raw?: string;
  value_norm?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentDocument {
  id: string;
  student_id: string;
  doc_type: string;
  doc_number?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentNote {
  id: string;
  student_id: string;
  note: string;
  created_at: string;
  created_by?: string;
}

export interface StudentInternalRef {
  id: string;
  student_id: string;
  ref_group: "card" | "eno";
  slot_number: number;
  raw_value?: string;
  created_at: string;
}
type StudentDocumentUpdate = Partial<
  Omit<StudentDocument, "id" | "student_id" | "created_at" | "updated_at">
>;
export class StudentService {
  private async getSupabase() {
    return await createClient();
  }

  // Basic Student Operations
  async getStudentBasicInfo(
    studentId: string
  ): Promise<StudentBasicInfo | null> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("students")
      .select("id, full_name, status, created_at, updated_at")
      .eq("id", studentId)
      .single();

    if (error) throw error;
    return data;
  }

  async getStudentProfile(studentId: string): Promise<StudentProfile | null> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("student_id", studentId)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    return data;
  }

  // Contact & Address Operations
  async getStudentAddresses(studentId: string): Promise<{
    permanent?: StudentAddress;
    correspondence?: StudentAddress;
  }> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_addresses")
      .select("*")
      .eq("student_id", studentId);

    if (error) throw error;

    const addresses = (data || []) as StudentAddress[];
    const permanent = addresses.find((addr) => addr.addr_type === "permanent");
    const correspondence = addresses.find(
      (addr) => addr.addr_type === "correspondence"
    );


    return { permanent, correspondence };
  }

  async getStudentContacts(studentId: string): Promise<StudentContact[]> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_contacts")
      .select("*")
      .eq("student_id", studentId)
      .order("contact_type");

    if (error) throw error;
    return data || [];
  }

  async upsertStudentContact(
    studentId: string,
    contactType: string,
    value: string
  ): Promise<StudentContact> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_contacts")
      .upsert(
        {
          student_id: studentId,
          contact_type: contactType,
          value_raw: value,
          value_norm: value,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "student_id,contact_type",
        }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Document Operations
  async getStudentDocuments(studentId: string): Promise<StudentDocument[]> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_identity_documents")
      .select("*")
      .eq("student_id", studentId)
      .order("is_primary", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateStudentDocument(
    documentId: string,
    updates: StudentDocumentUpdate
  ): Promise<StudentDocument> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_identity_documents")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Notes Operations
  async getStudentNotes(
    studentId: string,
    limit = 10,
    offset = 0
  ): Promise<{
    notes: StudentNote[];
    total_count: number;
  }> {
    const supabase = await this.getSupabase();

    // Get notes with pagination
    const { data: notes, error: notesError } = await supabase
      .from("student_notes")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (notesError) throw notesError;

    // Get total count
    const { count, error: countError } = await supabase
      .from("student_notes")
      .select("*", { count: "exact", head: true })
      .eq("student_id", studentId);

    if (countError) throw countError;

    return {
      notes: notes || [],
      total_count: count || 0,
    };
  }

  // Internal References
  async getStudentInternalRefs(studentId: string): Promise<{
    cards: StudentInternalRef[];
    enos: StudentInternalRef[];
  }> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_internal_refs")
      .select("*")
      .eq("student_id", studentId)
      .order("ref_group", { ascending: true })
      .order("slot_number", { ascending: true });

    if (error) throw error;

    const refs = (data || []) as StudentInternalRef[];
    const cards = refs.filter((ref) => ref.ref_group === "card");
    const enos = refs.filter((ref) => ref.ref_group === "eno");


    return { cards, enos };
  }

  // Update Operations
  async updateStudentBasicInfo(
    studentId: string,
    updates: Partial<Pick<StudentBasicInfo, "full_name" | "status">>
  ): Promise<StudentBasicInfo> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("students")
      .update(updates)
      .eq("id", studentId)
      .select("id, full_name, status, created_at, updated_at")
      .single();

    if (error) throw error;
    return data;
  }

  async updateStudentProfile(
    studentId: string,
    profileData: Partial<
      Omit<StudentProfile, "student_id" | "created_at" | "updated_at">
    >
  ): Promise<StudentProfile> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_profiles")
      .upsert({
        student_id: studentId,
        ...profileData,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async upsertStudentAddress(
    studentId: string,
    addrType: "permanent" | "correspondence",
    addressData: Partial<
      Pick<StudentAddress, "address_text" | "state" | "country">
    >
  ): Promise<StudentAddress> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_addresses")
      .upsert({
        student_id: studentId,
        addr_type: addrType,
        ...addressData,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async addStudentNote(
    studentId: string,
    note: string,
    createdBy?: string
  ): Promise<StudentNote> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("student_notes")
      .insert({
        student_id: studentId,
        note,
        created_by: createdBy,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async updateInternalRefs(
    studentId: string,
    refs: Array<{
      ref_group: "card" | "eno";
      slot_number: number;
      raw_value?: string;
    }>
  ): Promise<StudentInternalRef[]> {
    const supabase = await this.getSupabase();

    // Delete existing refs for this student
    await supabase
      .from("student_internal_refs")
      .delete()
      .eq("student_id", studentId);

    // Insert new refs (only non-empty values)
    const validRefs = refs.filter((ref) => ref.raw_value?.trim());

    if (validRefs.length === 0) return [];

    const { data, error } = await supabase
      .from("student_internal_refs")
      .insert(
        validRefs.map((ref) => ({
          student_id: studentId,
          ...ref,
        }))
      )
      .select("*");

    if (error) throw error;
    return data || [];
  }
}

export const studentService = new StudentService();
