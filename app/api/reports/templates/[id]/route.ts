import { NextResponse } from "next/server";
import {
  getTemplate,
  updateTemplate,
  removeTemplate,
} from "@/lib/reports/templates.service";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await getTemplate(id);
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch template",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const item = await updateTemplate(id, body);
    return NextResponse.json(item);
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
          error instanceof Error ? error.message : "Failed to update template",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await removeTemplate(id);
    return NextResponse.json(res);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete template",
      },
      { status: 500 }
    );
  }
}
