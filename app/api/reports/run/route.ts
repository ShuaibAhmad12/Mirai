import { NextResponse } from "next/server";
import { runReport } from "@/lib/reports/reporting.service";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await runReport(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Report run failed" },
      { status: 500 }
    );
  }
}
