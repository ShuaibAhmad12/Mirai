import { NextRequest, NextResponse } from "next/server";
import { getAgentById } from "@/lib/services/agents.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agentId = id;

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    const agent = await getAgentById(agentId);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error("Error fetching agent:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
