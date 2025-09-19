// lib/services/agents.service.ts (server-only)
import { createClient } from "@/lib/supabase/server";

export interface AgentBasic {
  id: string;
  name: string;
}

export interface AgentWithStats {
  id: string;
  name: string;
  email: string | null;
  phone_e164: string | null;
  source_channel: string | null;
  status: number;
  notes: string | null;
  total_referrals: number;
  paid_referrals: number;
  pending_referrals: number;
  total_students: number;
  last_referral_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentFilters {
  search?: string;
  status?: "all" | "active" | "inactive";
  source_channel?: string;
  has_referrals?: boolean;
  payment_status?: "all" | "paid" | "pending";
}

export interface CreateAgentRequest {
  name: string;
  email?: string;
  phone?: string;
  source_channel?: string;
  notes?: string;
}

export interface UpdateAgentRequest {
  name?: string;
  email?: string;
  phone?: string;
  status?: number;
  source_channel?: string;
  notes?: string;
}

interface AgentNote {
  id: string;
  is_paid: boolean;
  student_id: string | null;
  created_at: string;
}

interface AgentWithNotes {
  id: string;
  name: string;
  email: string | null;
  phone_e164: string | null;
  source_channel: string | null;
  status: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  agent_notes: AgentNote[];
}

export async function listActiveAgentsBasic(): Promise<AgentBasic[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agents")
    .select("id, name, status")
    .eq("status", 1)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String((r as { name: unknown }).name),
  }));
}

export async function listAgentsWithStats(
  filters: AgentFilters = {}
): Promise<AgentWithStats[]> {
  const supabase = await createClient();

  // Build the base query with stats
  let query = supabase.from("agents").select(`
      id,
      name,
      email,
      phone_e164,
      source_channel,
      status,
      notes,
      created_at,
      updated_at,
      agent_notes (
        id,
        is_paid,
        student_id,
        created_at
      )
    `);

  // Apply filters
  if (filters.status === "active") {
    query = query.eq("status", 1);
  } else if (filters.status === "inactive") {
    query = query.eq("status", 0);
  }

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    );
  }

  if (filters.source_channel) {
    query = query.eq("source_channel", filters.source_channel);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;

  // Calculate stats for each agent
  let result = ((data as AgentWithNotes[]) ?? []).map((agent) => {
    const notes = agent.agent_notes || [];
    const total_referrals = notes.length;
    const paid_referrals = notes.filter((n) => n.is_paid).length;
    const pending_referrals = total_referrals - paid_referrals;
    const unique_students = new Set(
      notes.map((n) => n.student_id).filter(Boolean)
    ).size;
    const last_referral_date =
      notes.length > 0
        ? notes.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )[0].created_at
        : null;

    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      phone_e164: agent.phone_e164,
      source_channel: agent.source_channel,
      status: agent.status,
      notes: agent.notes,
      total_referrals,
      paid_referrals,
      pending_referrals,
      total_students: unique_students,
      last_referral_date,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
    };
  });

  // Apply client-side filters for payment status and referrals
  if (filters.payment_status && filters.payment_status !== "all") {
    result = result.filter((agent) => {
      if (filters.payment_status === "paid") {
        return agent.paid_referrals > 0;
      } else if (filters.payment_status === "pending") {
        return agent.pending_referrals > 0;
      }
      return true;
    });
  }

  if (filters.has_referrals !== undefined) {
    result = result.filter((agent) => {
      if (filters.has_referrals) {
        return agent.total_referrals > 0;
      } else {
        return agent.total_referrals === 0;
      }
    });
  }

  return result;
}

export async function getAgentById(agentId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agents")
    .select(
      `
      *,
      agent_notes (
        id,
        student_id,
        is_paid,
        remarks,
        created_at
      )
    `
    )
    .eq("id", agentId)
    .single();

  if (error) {
    console.error("Error fetching agent:", error);
    throw error;
  }

  if (!data) {
    return null;
  }

  // Define the structure of agent notes
  interface AgentNote {
    id: string;
    student_id: string;
    is_paid: boolean | null;
    remarks: string | null;
    created_at: string;
  }

  const agentNotes = (data.agent_notes as AgentNote[]) || [];

  // Calculate statistics
  const totalReferrals = agentNotes.length;
  const paidReferrals = agentNotes.filter(
    (note: AgentNote) => note.is_paid === true
  ).length;
  const pendingReferrals = totalReferrals - paidReferrals;
  const lastReferralDate =
    agentNotes.sort(
      (a: AgentNote, b: AgentNote) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )?.[0]?.created_at || null;

  return {
    ...data,
    total_referrals: totalReferrals,
    paid_referrals: paidReferrals,
    pending_referrals: pendingReferrals,
    total_students: totalReferrals, // Same as referrals for now
    last_referral_date: lastReferralDate,
  };
}

export async function createAgent(data: CreateAgentRequest) {
  try {
    console.log('🔍 Creating agent with data:', data);

    // Initialize supabase client
    const supabase = await createClient();
    
    // Test connection first
    console.log('🔗 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('agents')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Supabase connection test failed:', testError);
      throw new Error(`Supabase connection failed: ${testError.message}`);
    }
    
    console.log('✅ Supabase connection successful');

    // Prepare the insert data
    const insertData = {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      source_channel: data.source_channel || null,
      notes: data.notes || null,
    };

    console.log('📝 Insert data:', insertData);

    const { data: agent, error } = await supabase
      .from('agents')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase insert error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Supabase error: ${error.message} (Code: ${error.code})`);
    }

    console.log('🎉 Agent created successfully:', agent);
    return agent;

  } catch (error) {
    console.error('💥 Database error creating agent:', error);
    
    // Re-throw the original error with more context
    if (error instanceof Error) {
      throw error; // This preserves the original error message
    }
    
    throw new Error('Failed to create agent in database');
  }
}
export async function updateAgent(
  id: string,
  data: UpdateAgentRequest
): Promise<AgentWithStats> {
  const supabase = await createClient();

  // Get user for audit trail
  let updated_by: string | null = null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    updated_by = userData?.user?.id ?? null;
  } catch {
    updated_by = null;
  }

  const updateData: Record<string, unknown> = { updated_by };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) {
    updateData.email_raw = data.email;
    updateData.email = data.email?.toLowerCase().trim();
  }
  if (data.phone !== undefined) {
    updateData.phone_raw = data.phone;
    updateData.phone_e164 = data.phone; // TODO: Add phone normalization
  }
  if (data.status !== undefined) updateData.status = data.status;
  if (data.source_channel !== undefined)
    updateData.source_channel = data.source_channel;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const { error } = await supabase
    .from("agents")
    .update(updateData)
    .eq("id", id);

  if (error) throw error;

  const result = await getAgentById(id);
  if (!result) throw new Error("Failed to retrieve updated agent");
  return result;
}

export async function getAgentStats() {
  const supabase = await createClient();

  const { data: agentStats, error: agentError } = await supabase
    .from("agents")
    .select("status");

  const { data: noteStats, error: noteError } = await supabase
    .from("agent_notes")
    .select("is_paid, student_id");

  if (agentError || noteError) throw agentError || noteError;

  const totalAgents = agentStats?.length || 0;
  const activeAgents = agentStats?.filter((a) => a.status === 1).length || 0;
  const inactiveAgents = totalAgents - activeAgents;

  const totalReferrals = noteStats?.length || 0;
  const paidReferrals = noteStats?.filter((n) => n.is_paid).length || 0;
  const pendingReferrals = totalReferrals - paidReferrals;
  const uniqueStudents = new Set(
    noteStats?.map((n) => n.student_id).filter(Boolean)
  ).size;

  return {
    totalAgents,
    activeAgents,
    inactiveAgents,
    totalReferrals,
    paidReferrals,
    pendingReferrals,
    uniqueStudents,
  };
}

export interface AddAgentNoteInput {
  agent_id: string;
  student_id: string;
  is_paid: boolean;
  remarks: string;
}

export async function addAgentNote(input: AddAgentNoteInput) {
  const supabase = await createClient();
  // Best-effort actor attribution
  let created_by: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    created_by = data?.user?.id ?? null;
  } catch {
    created_by = null;
  }
  const payload = {
    agent_id: input.agent_id,
    student_id: input.student_id,
    is_paid: input.is_paid,
    remarks: input.remarks || "—",
    created_by,
  } as const;
  const { error } = await supabase.from("agent_notes").insert(payload);
  if (error) throw error;
}
