import { NextResponse } from "next/server";
import { getAgentStats } from "@/lib/services/agents.service";

export async function GET() {
  try {
    const stats = await getAgentStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching agent stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent statistics" },
      { status: 500 }
    );
  }
}
