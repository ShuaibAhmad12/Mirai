import { NextResponse } from "next/server";
import { getReportingCapabilities } from "@/lib/reports/reporting.service";

export async function GET() {
  try {
    const caps = await getReportingCapabilities();
    return NextResponse.json({ sources: caps });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load reporting capabilities",
      },
      { status: 500 }
    );
  }
}
