import { NextResponse } from "next/server";
import {
  listActiveAgentsBasic,
  listAgentsWithStats,
  createAgent,
  getAgentStats,
  type AgentFilters,
  type CreateAgentRequest,
} from "@/lib/services/agents.service";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const basic = searchParams.get("basic");

    if (basic === "true") {
      // For compatibility with existing admission form
      const agents = await listActiveAgentsBasic();
      return NextResponse.json({ agents });
    }

    // Full agent list with stats and filters
    const filters: AgentFilters = {
      search: searchParams.get("search") || undefined,
      status:
        (searchParams.get("status") as "all" | "active" | "inactive") || "all",
      source_channel: searchParams.get("source_channel") || undefined,
    };

    const agents = await listAgentsWithStats(filters);
    const stats = await getAgentStats();

    return NextResponse.json({ agents, stats });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch agents",
      },
      { status: 500 }
    );
  }
}

const CreateAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  source_channel: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = CreateAgentSchema.parse(body) as CreateAgentRequest;

    const agent = await createAgent(input);
    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create agent",
      },
      { status: 500 }
    );
  }
}
