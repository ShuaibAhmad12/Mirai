import { NextResponse } from "next/server";
import { z } from "zod";
import { svcDeleteSession, svcUpdateSession } from "@/lib/services/academic";

const UpdateSessionSchema = z.object({
  title: z.string().min(1).optional(),
  start_date: z.string().min(1).optional(),
  end_date: z.string().min(1).optional(),
  is_current: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch = UpdateSessionSchema.parse(body);
    await svcUpdateSession(id, patch);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const message = error.message;
      return NextResponse.json({ error: { message } }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await svcDeleteSession(id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
