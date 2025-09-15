import { NextResponse } from "next/server";
import { z } from "zod";
import { svcDeleteCourse, svcUpdateCourse } from "@/lib/services/academic";

const UpdateCourseSchema = z.object({
  course_identity: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  duration: z.number().int().min(1).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch = UpdateCourseSchema.parse(body);
    await svcUpdateCourse(id, patch);
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
    await svcDeleteCourse(id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
