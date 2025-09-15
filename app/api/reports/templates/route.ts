import { NextResponse } from "next/server";
import { listTemplates, createTemplate } from "@/lib/reports/templates.service";
import { z } from "zod";

export async function GET() {
  try {
    const items = await listTemplates();
    return NextResponse.json({ templates: items });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list templates",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const item = await createTemplate(body);
    return NextResponse.json(item, { status: 201 });
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
          error instanceof Error ? error.message : "Failed to create template",
      },
      { status: 500 }
    );
  }
}
