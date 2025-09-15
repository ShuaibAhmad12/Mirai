import { NextResponse } from "next/server";
import { z } from "zod";
import { svcCreateCourse, svcListCourses } from "@/lib/services/academic";

export async function GET() {
  try {
    const data = await svcListCourses();

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

const CreateCourseSchema = z.object({
  college_id: z.string().uuid(),
  college_code: z.string().min(1),
  course_identity: z.string().min(1),
  name: z.string().min(1),
  duration: z.number().int().min(1).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CreateCourseSchema.parse(body);
    const created = await svcCreateCourse(input);
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const message = error.message;
      return NextResponse.json({ error: { message } }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
